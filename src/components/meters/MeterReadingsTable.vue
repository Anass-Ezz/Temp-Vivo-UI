

<!-- src/components/meters/MeterReadingsTable.vue -->
<script setup>
/**
 * @component MeterReadingsTable
 * @description UI Component for MeterReadingsTable.
 *
 * @prop {any} channelPrefix - Component property
 * @prop {any} edgeId - Component property
 * @prop {any} meterIndex - Component property
 * @emits {string} update:latestReading - Emitted event
 */

import TrendModal from '@/components/common/TrendModal.vue';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { config } from '@/config/config';
import { isEdgeQueryable, normalizeString } from '@/utils/edgeAvailability.js';
import { formatValue, formatNum, formatTime } from '@/utils/formatting';
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

function waitForSocketOpen(ws) {
    return new Promise((resolve) => {
        if (ws.readyState === WebSocket.OPEN) return resolve();
        ws.addEventListener('open', resolve, { once: true });
    });
}

const emit = defineEmits(['update:latestReading']);

const props = defineProps({
    channelPrefix: { type: String, required: true },
    edgeId: { type: String, required: true },
    meterIndex: { type: Number, required: true }
});

const ws = inject('ws');
const auth = inject('auth');
const edges = inject('edges', null);
const dateRange = inject('dateRange');
const resolution = inject('resolution');
const route = useRoute();
const normalizedEdgeId = computed(() => normalizeString(props.edgeId));
const normalizedChannelPrefix = computed(() => normalizeString(props.channelPrefix));
const queryableEdge = computed(() => isEdgeQueryable(normalizedEdgeId.value, edges, { onlineOnly: true }));

// ---------------------------------------------------------------------------
// Column definitions — driven entirely from config.meterChannels
// Each entry: { key, label, channelKey, unit }
//   channelKey  → key in config.meterChannels (e.g. 'voltageL1Channel')
//   unit        → taken from config.meterChannels[channelKey].unit at runtime
// ---------------------------------------------------------------------------
const COLUMNS = [
    { key: 'vL1', label: 'V L1', channelKey: 'voltageL1Channel' },
    { key: 'vL2', label: 'V L2', channelKey: 'voltageL2Channel' },
    { key: 'vL3', label: 'V L3', channelKey: 'voltageL3Channel' },
    { key: 'aL1', label: 'I L1', channelKey: 'currentL1Channel' },
    { key: 'aL2', label: 'I L2', channelKey: 'currentL2Channel' },
    { key: 'aL3', label: 'I L3', channelKey: 'currentL3Channel' },
    { key: 'power', label: 'Power', channelKey: 'activePowerChannel' },
    { key: 'pf',    label: 'PF',    channelKey: 'powerFactorChannel' },
    { key: 'freq',  label: 'Freq',  channelKey: 'frequencyChannel' },
]

// Resolve channel name and unit from config at runtime
function colDef(col) {
    const ch = config.meterChannels[col.channelKey]
    return { name: ch?.name ?? col.key, unit: ch?.unit ?? '' }
}

// Header label — just the label, no unit
function colHeader(col) {
    return col.label
}

// ---------------------------------------------------------------------------
// Reactive state
// ---------------------------------------------------------------------------
const rawReadings = ref([])
const displayedReadings = computed(() => rawReadings.value.slice(0, 10))

let refreshInterval = null

const trendModalVisible = ref(false)
const selectedMetric = ref('')
const selectedMetricDescription = ref('')
const selectedChannel = ref('')
const selectedUnit = ref('')

function openTrendModal(col) {
    const { name, unit } = colDef(col)
    selectedMetric.value = col.label
    selectedMetricDescription.value = `${col.label} — ${name}`
    selectedChannel.value = `${props.channelPrefix}${name}`
    selectedUnit.value = unit
    trendModalVisible.value = true
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
async function fetchHistoricData() {
    if (!ws || !normalizedEdgeId.value || !normalizedChannelPrefix.value || !queryableEdge.value) {
        rawReadings.value = []
        return
    }
    await waitForSocketOpen(ws)

    const now = new Date()
    const from = new Date(now.getTime() - 30 * 60 * 1000)

    const OUTER_ID = crypto.randomUUID()
    const INNER_ID = crypto.randomUUID()

    // Helper to get UTC HH:mm:ss from a Date object
    const getUtcTimeStr = (d) => d.toISOString().split('T')[1].split('.')[0];

    // Build channel list from config
    const channels = COLUMNS.map(col => `${normalizedChannelPrefix.value}${colDef(col).name}`)

    ws.send(JSON.stringify({
        jsonrpc: '2.0', id: OUTER_ID, method: 'edgeRpc',
        params: {
            edgeId: normalizedEdgeId.value,
            payload: {
                jsonrpc: '2.0', id: INNER_ID,
                method: 'queryHistoricTimeseriesData',
                params: {
                    channels,
                    fromDate: from.toISOString().split('T')[0],
                    toDate:   now.toISOString().split('T')[0],
                    fromTime: getUtcTimeStr(from),
                    toTime:   getUtcTimeStr(now),
                    resolution: { value: 1, unit: 'Minutes' },
                    timezone: 'Africa/Casablanca'
                }
            }
        }
    }))

    const handler = ({ data }) => {
        const msg = JSON.parse(data)
        if (msg.id !== OUTER_ID) {
            return
        }

        if (msg.error) {
            rawReadings.value = []
            ws.removeEventListener('message', handler)
            return
        }

        if (msg.result?.payload?.result) {
            processHistoricData(msg.result.payload.result)
            ws.removeEventListener('message', handler)
        }
    }
    ws.addEventListener('message', handler, { once: false })
}

// ---------------------------------------------------------------------------
// Scale groups — columns that must share the same unit/divider
// ---------------------------------------------------------------------------
const SCALE_GROUPS = [
    { keys: ['vL1', 'vL2', 'vL3'], channelKey: 'voltageL1Channel' },
    { keys: ['aL1', 'aL2', 'aL3'], channelKey: 'currentL1Channel' },
]
// Columns NOT in a group are formatted individually per-value
const GROUPED_KEYS = new Set(SCALE_GROUPS.flatMap(g => g.keys))

// ---------------------------------------------------------------------------
// Process
// ---------------------------------------------------------------------------
function processHistoricData(historic) {
    const timestamps = historic?.timestamps
    if (!Array.isArray(timestamps) || timestamps.length === 0) {
        rawReadings.value = []
        return
    }

    const data = historic.data || {}
    const nowMs = Date.now()

    // --- 1. Collect all raw numeric values per column ---
    const allRaw = {}   // key → number[]
    const timeRows = [] // { ts, date, rawByKey }

    for (let i = 0; i < timestamps.length; i++) {
        const tsEnd = timestamps[i]
        if (!tsEnd) continue
        const date = new Date(tsEnd)
        
        // Shift 1 minute back (as table resolution is 1m) to show Start of Period
        date.setUTCMinutes(date.getUTCMinutes() - 1)
        
        if (date.getTime() > nowMs) continue

        const rawByKey = {}
        for (const col of COLUMNS) {
            const { name, unit } = colDef(col)
            const raw = data[`${normalizedChannelPrefix.value}${name}`]?.[i]
            rawByKey[col.key] = (raw != null && Number.isFinite(raw)) ? raw : null
            if (rawByKey[col.key] !== null) {
                if (!allRaw[col.key]) allRaw[col.key] = []
                allRaw[col.key].push(rawByKey[col.key])
            }
        }
        timeRows.push({ ts: date.toISOString(), date, rawByKey })
    }

    // --- 2. Derive one fixed scale per group from the group's global max ---
    const groupScale = {} // key → { divider, unit, decimals }
    for (const group of SCALE_GROUPS) {
        const { unit } = colDef(COLUMNS.find(c => c.channelKey === group.channelKey))
        const allVals = group.keys.flatMap(k => allRaw[k] ?? [])
        const maxAbs = allVals.length ? Math.max(...allVals.map(Math.abs)) : 0
        const s = maxAbs > 0 ? formatValue(maxAbs, unit) : formatValue(0, unit)
        const divider = maxAbs > 0 ? maxAbs / s.value : 1
        for (const k of group.keys) {
            groupScale[k] = { divider, unit: s.unit, decimals: s.decimals }
        }
    }

    // --- 3. Build display rows using fixed group scales ---
    const records = []

    // Store group units in a side-channel so MetersPage can pass them to PhasorChart
    const groupUnits = {}
    for (const group of SCALE_GROUPS) {
        const repKey = group.keys[0]
        if (groupScale[repKey]) groupUnits[repKey] = groupScale[repKey].unit
    }
    for (const { ts, rawByKey } of timeRows) {
        const row = { timestamp: formatTime(ts, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) }
        const rawRow = {}

        for (const col of COLUMNS) {
            const raw = rawByKey[col.key]
            if (GROUPED_KEYS.has(col.key)) {
                const sc = groupScale[col.key]
                if (raw == null) {
                    row[col.key] = '—'
                    rawRow[col.key] = null
                } else {
                    const scaled = raw / sc.divider
                    row[col.key] = `${formatNum(scaled, sc.decimals, sc.decimals)} ${sc.unit}`.trim()
                    rawRow[col.key] = scaled
                }
            } else {
                // individual formatting for power, PF, freq
                const { unit } = colDef(col)
                row[col.key] = formatCell(raw, unit)
                if (raw != null && Number.isFinite(raw)) {
                    rawRow[col.key] = formatValue(raw, unit).value
                } else {
                    rawRow[col.key] = null
                }
            }
        }

        records.push({ ...row, _raw: rawRow })
    }

    records.sort((a, b) =>
        new Date(`1970-01-01T${b.timestamp}`) - new Date(`1970-01-01T${a.timestamp}`)
    )

    rawReadings.value = records.slice(0, 10)
    if (rawReadings.value.length > 0) {
        emit('update:latestReading', { ...rawReadings.value[0], _units: groupUnits })
    }
}

/**
 * Format a raw value using the unit from config.
 * Returns a display string like "230.1 V" or "0.950".
 */
function formatCell(value, unit) {
    if (value == null || !Number.isFinite(value)) return '—'
    const scaled = formatValue(value, unit)
    const num = formatNum(scaled.value, scaled.decimals, scaled.decimals)
    return scaled.unit ? `${num} ${scaled.unit}` : num
}

// ---------------------------------------------------------------------------
// CSV — built dynamically from COLUMNS
// ---------------------------------------------------------------------------
function downloadCSV() {
    const headers = ['Timestamp', ...COLUMNS.map(c => colHeader(c))].join(',')
    const rows = rawReadings.value.map(r =>
        [r.timestamp, ...COLUMNS.map(c => r[c.key])].join(',')
    )
    const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: 'meter-readings.csv' })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval)
    refreshInterval = setInterval(fetchHistoricData, 60_000)
}

function stopAutoRefresh() {
    if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null }
}

watch([() => route.params.meterReference, queryableEdge], () => {
    rawReadings.value = []
    fetchHistoricData()
})

onMounted(() => {
    if (!ws) return
    if (auth?.ready) {
        fetchHistoricData(); startAutoRefresh()
    } else {
        const stop = watch(() => auth?.ready, (ready) => {
            if (ready) { fetchHistoricData(); startAutoRefresh(); stop() }
        }, { immediate: true })
    }
})

onBeforeUnmount(stopAutoRefresh)
</script>

<template>
    <div class="border border-gray-600 rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-baseline">
                <i class="bi bi-table text-orange-500 text-xl mr-3"></i>
                <h3 class="font-semibold">Live Meter Readings</h3>
            </div>
            <div class="flex items-center gap-3">
                <div class="text-sm text-gray-400">Updates every 1 minute</div>
                <button @click="downloadCSV"
                    class="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                    <i class="bi bi-download text-xs"></i> Save CSV
                </button>
            </div>
        </div>

        <DataTable :value="displayedReadings" class="custom-table">
            <Column field="timestamp" header="Timestamp" class="text-gray-300" />

            <Column v-for="col in COLUMNS" :key="col.key" :field="col.key" class="text-gray-300">
                <template #header>
                    <div class="flex items-center gap-2">
                        <span>{{ colHeader(col) }}</span>
                        <button @click="openTrendModal(col)" class="trend-icon-btn" title="View trend">
                            <i class="bi bi-graph-up text-orange-500 hover:text-orange-400"></i>
                        </button>
                    </div>
                </template>
            </Column>
        </DataTable>

        <TrendModal
            v-model:visible="trendModalVisible"
            :metric-name="selectedMetric"
            :metric-description="selectedMetricDescription"
            :channel="selectedChannel"
            :unit="selectedUnit"
            meter-type="electricity"
            :meter-index="meterIndex"
            :ws="ws"
            :auth="auth"
            :date-range="dateRange"
            :resolution="resolution"
        />
    </div>
</template>

<style scoped>
.trend-icon-btn {
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.2s ease;
}
.trend-icon-btn:hover { background: rgba(234, 88, 12, 0.1); }
.trend-icon-btn i { font-size: 14px; }
</style>
