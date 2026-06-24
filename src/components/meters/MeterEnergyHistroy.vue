<script setup>
/**
 * @component MeterEnergyHistroy
 * @description Energy / Cost / Emissions history chart for a single meter.
 * When chartType === 'energy' a tab bar lets the user switch between the three
 * data series.  When chartType === 'power' the power line chart is shown directly.
 *
 * @prop {String} edgeId        - Target edge id
 * @prop {String} channelPrefix - Meter channel prefix, e.g. "meter0/"
 * @prop {Array}  channels      - Explicit channel list (used for power chart)
 * @prop {String} chartType     - 'energy' | 'power'
 */

import { ref, computed, inject, watch, onMounted, shallowRef } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import { isEdgeQueryable, normalizeString } from '@/utils/edgeAvailability.js';
import { formatValue, formatNum, formatDate, formatDateTime } from '@/utils/formatting';
import { config } from '@/config/config';

use([CanvasRenderer, BarChart, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent]);

// ─── Props ────────────────────────────────────────────────────────────────────
const props = defineProps({
    edgeId:        { type: String, default: 'edge0' },
    channelPrefix: { type: String, default: '' },       // e.g. "meter0/"
    channels:      { type: Array,  default: () => [] }, // used for power chart
    chartType:     { type: String, default: 'energy' }  // 'energy' | 'power'
});

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
    {
        id: 'energy',
        label: 'Energy',
        icon: 'bi-lightning-charge',
        color: '#60a5fa',
        gradientFrom: 'rgba(96,165,250,0.15)',
        gradientTo:   'rgba(96,165,250,1)',
        sliderFill:   'rgba(96,165,250,0.12)',
        channelKey:   'activeEnergyChannel',
        baseUnit:     'Wh',
        method:       'queryHistoricTimeseriesEnergyPerPeriod',
        seriesName:   'Active Energy',
        seriesType:   'bar'
    },
    {
        id: 'cost',
        label: 'Cost',
        icon: 'bi-cash-coin',
        color: '#34d399',
        gradientFrom: 'rgba(52,211,153,0.15)',
        gradientTo:   'rgba(52,211,153,1)',
        sliderFill:   'rgba(52,211,153,0.12)',
        channelKey:   'activeEnergyCostChannel',
        baseUnit:     'MAD',
        method:       'queryHistoricTimeseriesEnergyPerPeriod',
        seriesName:   'Cost',
        seriesType:   'bar'
    },
    {
        id: 'emissions',
        label: 'CO₂',
        icon: 'bi-cloud',
        color: '#f97316',
        gradientFrom: 'rgba(249,115,22,0.15)',
        gradientTo:   'rgba(249,115,22,1)',
        sliderFill:   'rgba(249,115,22,0.12)',
        channelKey:   'activeEnergyEmissionsChannel',
        baseUnit:     'kg',
        method:       'queryHistoricTimeseriesEnergyPerPeriod',
        seriesName:   'CO₂ Emissions',
        seriesType:   'bar'
    }
];

const activeTab = ref('energy');
const currentTab = computed(() => TABS.find(t => t.id === activeTab.value) ?? TABS[0]);

// ─── Injections ───────────────────────────────────────────────────────────────
const ws               = inject('ws');
const auth             = inject('auth');
const edges            = inject('edges', null);
const dateRangeContext = inject('dateRange');
const resolutionContext= inject('resolution');
const refreshContext   = inject('refresh');

// ─── State ────────────────────────────────────────────────────────────────────
const loading     = ref(false);
const chartData   = ref({ timestamps: [], rawTimestamps: [], series: [] });
const chartOption = shallowRef(null);

// ─── Computed ─────────────────────────────────────────────────────────────────
const fromDate = computed(() => {
    const d = dateRangeContext.value.value[0];
    return d ? new Date(d).toISOString().split('T')[0] : null;
});
const toDate = computed(() => {
    const d = dateRangeContext.value.value[1];
    return d ? new Date(d).toISOString().split('T')[0] : null;
});
const resolution       = computed(() => resolutionContext.value.value);
const normalizedEdgeId = computed(() => normalizeString(props.edgeId));
const queryableEdge    = computed(() => isEdgeQueryable(normalizedEdgeId.value, edges, { onlineOnly: true }));

// Channel(s) to query — depends on mode
const activeChannels = computed(() => {
    if (props.chartType === 'power') {
        return props.channels.map(normalizeString).filter(Boolean);
    }
    // energy / cost / emissions tab
    const tab     = currentTab.value;
    const chName  = config.meterChannels[tab.channelKey]?.name ?? '';
    const prefix  = normalizeString(props.channelPrefix || '');
    return prefix && chName ? [`${prefix}${chName}`] : [];
});

// ─── WebSocket helpers ────────────────────────────────────────────────────────
function waitForSocketOpen(socket) {
    return new Promise(resolve => {
        if (socket.readyState === WebSocket.OPEN) return resolve();
        socket.addEventListener('open', resolve, { once: true });
    });
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchData() {
    if (!fromDate.value || !toDate.value || !auth.ready || !ws ||
        !normalizedEdgeId.value || !queryableEdge.value || activeChannels.value.length === 0) {
        chartData.value  = { timestamps: [], rawTimestamps: [], series: [] };
        chartOption.value = null;
        loading.value    = false;
        return;
    }

    loading.value = true;

    try {
        await waitForSocketOpen(ws);

        const OUTER = crypto.randomUUID();
        const INNER = crypto.randomUUID();

        const method = props.chartType === 'power'
            ? 'queryHistoricTimeseriesData'
            : currentTab.value.method;

        const payload = {
            jsonrpc: '2.0', id: OUTER,
            method: 'edgeRpc',
            params: {
                edgeId: normalizedEdgeId.value,
                payload: {
                    jsonrpc: '2.0', id: INNER,
                    method,
                    params: {
                        channels: activeChannels.value,
                        fromDate: fromDate.value,
                        toDate:   toDate.value,
                        resolution: { value: resolution.value.value, unit: resolution.value.unit },
                        timezone: 'Africa/Casablanca'
                    }
                }
            }
        };

        ws.send(JSON.stringify(payload));

        const cleanup = (handler, tid) => {
            ws.removeEventListener('message', handler);
            clearTimeout(tid);
            loading.value = false;
        };

        const tid = setTimeout(() => { loading.value = false; }, 20000);

        const handleMessage = ({ data }) => {
            let msg;
            try { msg = JSON.parse(data); } catch { return; }
            if (msg.id !== OUTER) return;
            if (msg.error) { cleanup(handleMessage, tid); return; }

            const result = msg.result?.payload?.result ?? msg.result;
            if (result?.timestamps && result?.data) {
                processChartData(result);
                updateChartOption();
            }
            cleanup(handleMessage, tid);
        };

        ws.addEventListener('message', handleMessage);
    } catch {
        loading.value = false;
    }
}

// ─── Date formatting ──────────────────────────────────────────────────────────
function resUnit() {
    return (resolution.value?.unit ?? 'Days').toLowerCase();
}

function formatXLabel(ts) {
    const u = resUnit();
    if (u === 'seconds')  return formatTime(ts, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (u === 'minutes')  return formatTime(ts, { hour: '2-digit', minute: '2-digit' });
    if (u === 'hours')    return formatDateTime(ts, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    if (u === 'days' || u === 'weeks') return formatDate(ts, { day: '2-digit', month: 'short' });
    if (u === 'months')   return formatDate(ts, { month: 'short', year: 'numeric' });
    if (u === 'years')    return formatDate(ts, { year: 'numeric' });
    return formatDate(ts);
}

function formatTooltipDate(ts) {
    const u = resUnit();
    if (u === 'seconds')  return formatDateTime(ts, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (u === 'minutes' || u === 'hours') return formatDateTime(ts, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (u === 'days' || u === 'weeks')    return formatDate(ts, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    if (u === 'months')   return formatDate(ts, { month: 'long', year: 'numeric' });
    if (u === 'years')    return formatDate(ts, { year: 'numeric' });
    return formatDate(ts, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}


// ─── Data processing ──────────────────────────────────────────────────────────
function processChartData(result) {
    const res = resolution.value;
    const rawTimestampsEnd = result.timestamps ?? [];

    // Shift timestamps back by the resolution to show "Start of Period" labels
    // as the backend returns "End of Period" (window stop time).
    const rawTimestamps = rawTimestampsEnd.map(ts => {
        const d = new Date(ts);
        const val = res.value || 1;
        const unit = (res.unit || 'Days').toLowerCase();

        if (unit === 'seconds') d.setUTCSeconds(d.getUTCSeconds() - val);
        else if (unit === 'minutes') d.setUTCMinutes(d.getUTCMinutes() - val);
        else if (unit === 'hours') d.setUTCHours(d.getUTCHours() - val);
        else if (unit === 'days') d.setUTCDate(d.getUTCDate() - val);
        else if (unit === 'weeks') d.setUTCDate(d.getUTCDate() - (val * 7));
        else if (unit === 'months') d.setUTCMonth(d.getUTCMonth() - val);
        else if (unit === 'years') d.setUTCFullYear(d.getUTCFullYear() - val);

        return d.toISOString();
    });

    const seriesData = activeChannels.value.map(ch => ({
        name: ch,
        values: result.data[ch] || [],
        rawTimestamps
    }));
    chartData.value = {
        timestamps: rawTimestamps.map(formatXLabel),
        rawTimestamps,
        series: seriesData
    };
}

// ─── Chart option builders ────────────────────────────────────────────────────
function buildEnergyTabOption(tab, labels, rawTimestamps) {
    const allValues = chartData.value.series.flatMap(s => s.values).filter(v => v != null);
    const maxVal    = allValues.length ? Math.max(...allValues) : 0;

    // For MAD and kg we don't use the Wh scaler — just round nicely
    let displayUnit, divider;
    if (tab.baseUnit === 'Wh') {
        const scaled = formatValue(maxVal, 'Wh');
        displayUnit  = scaled.unit;
        divider      = maxVal > 0 ? maxVal / scaled.value : 1;
    } else if (tab.baseUnit === 'kg') {
        const scaled = formatValue(maxVal, 'kg');
        displayUnit  = scaled.unit;
        divider      = maxVal > 0 ? maxVal / scaled.value : 1;
    } else {
        // MAD — no scaling
        displayUnit = 'MAD';
        divider     = 1;
    }

    const gradient = {
        type: 'linear', x: 0, y: 1, x2: 0, y2: 0,
        colorStops: [
            { offset: 0, color: tab.gradientFrom },
            { offset: 1, color: tab.gradientTo   }
        ]
    };

    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: '#1f2937',
            borderColor: '#374151',
            textStyle: { color: '#ffffff' },
            formatter(params) {
                const idx = params[0]?.dataIndex;
                const ts  = rawTimestamps[idx];
                const dateLabel = ts ? formatTooltipDate(ts) : params[0]?.axisValue;
                let html = `<div style="font-weight:bold;margin-bottom:4px">${dateLabel}</div>`;
                params.forEach(p => {
                    if (p.value == null) return;
                    html += `<div>${p.marker} ${p.seriesName}: <b>${formatNum(p.value, 2, 2)} ${displayUnit}</b></div>`;
                });
                return html;
            }
        },
        legend: { show: false },
        grid: { left: '4%', right: '4%', bottom: '16%', top: '6%', containLabel: true },
        xAxis: {
            type: 'category',
            data: labels,
            axisLabel: { color: '#9ca3af', fontSize: 11, rotate: labels.length > 14 ? 45 : 0 },
            axisLine: { lineStyle: { color: '#374151' } },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            name: displayUnit,
            nameTextStyle: { color: tab.color, fontSize: 11 },
            axisLabel: { color: '#9ca3af', formatter: v => formatNum(v, 0, 2) },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { type: 'dotted', color: '#374151', opacity: 0.5 } }
        },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', bottom: 2, height: 20, textStyle: { color: '#9ca3af' }, borderColor: '#374151', fillerColor: tab.sliderFill }
        ],
        series: [{
            name: tab.seriesName,
            type: 'bar',
            data: chartData.value.series[0]?.values.map(v => v != null ? Math.round((v / divider) * 1000) / 1000 : null) ?? [],
            itemStyle: { color: gradient, borderRadius: [3, 3, 0, 0] },
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: tab.gradientTo } }
        }]
    };
}

function buildPowerOption(labels, rawTimestamps) {
    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#1f2937',
            borderColor: '#374151',
            textStyle: { color: '#ffffff' },
            formatter(params) {
                if (!params?.length) return '';
                const idx = params[0].dataIndex;
                const ts  = rawTimestamps[idx];
                const dateLabel = ts ? formatTooltipDate(ts) : params[0].axisValue;
                let html = `<div style="font-weight:bold;margin-bottom:4px">${dateLabel}</div>`;
                params.forEach(p => {
                    if (p.value == null) return;
                    const fmt = formatValue(p.value, 'W');
                    html += `<div>${p.marker} Power: <b>${formatNum(fmt.value, 2, 2)} ${fmt.unit}</b></div>`;
                });
                return html;
            }
        },
        grid: { left: '4%', right: '4%', bottom: '16%', top: '6%', containLabel: true },
        xAxis: {
            type: 'category',
            data: labels,
            axisLabel: { color: '#9ca3af', fontSize: 11, rotate: labels.length > 14 ? 45 : 0 },
            axisLine: { lineStyle: { color: '#374151' } },
            axisTick: { show: false },
            splitLine: { show: false }
        },
        yAxis: {
            type: 'value',
            name: 'kW',
            nameTextStyle: { color: '#9ca3af', fontSize: 11 },
            axisLabel: { color: '#9ca3af', formatter: v => formatNum(v / 1000, 0, 2) },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { type: 'dotted', color: '#374151', opacity: 0.4 } }
        },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', bottom: 2, height: 20, textStyle: { color: '#9ca3af' }, borderColor: '#374151', fillerColor: 'rgba(107,114,128,0.15)' }
        ],
        series: chartData.value.series.map(s => ({
            name: 'Power',
            type: 'line',
            data: s.values,
            smooth: true,
            symbol: 'circle',
            symbolSize: 5,
            itemStyle: { color: '#6b7280' },
            lineStyle: { color: '#6b7280', width: 2, opacity: 0.8 },
            areaStyle: { color: '#6b7280', opacity: 0.1 }
        }))
    };
}

function updateChartOption() {
    const labels        = chartData.value.timestamps;
    const rawTimestamps = chartData.value.rawTimestamps ?? [];

    chartOption.value = props.chartType === 'power'
        ? buildPowerOption(labels, rawTimestamps)
        : buildEnergyTabOption(currentTab.value, labels, rawTimestamps);
}

// ─── Emits ────────────────────────────────────────────────────────────────────
const emit = defineEmits(['update:activeTab']);

// Emit whenever the active tab changes
watch(activeTab, tab => emit('update:activeTab', tab), { immediate: true });

// Expose so parent can render the tab bar and drive the selection
defineExpose({ TABS, activeTab });

// ─── Watchers ─────────────────────────────────────────────────────────────────
watch(
    () => [fromDate.value, toDate.value, resolution.value, refreshContext?.count,
           normalizedEdgeId.value, queryableEdge.value, activeChannels.value, activeTab.value],
    () => { if (auth.ready) fetchData(); },
    { deep: true }
);

watch(() => auth.ready, r => { if (r) fetchData(); }, { immediate: true });

onMounted(() => { if (auth.ready) fetchData(); });
</script>

<template>
    <div class="w-full h-full flex flex-col">

        <!-- Chart area -->
        <div class="flex-1 min-h-0 relative">
            <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
                <div class="flex items-center gap-2 text-gray-500 text-sm">
                    <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Loading...
                </div>
            </div>
            <v-chart v-else-if="chartOption" :option="chartOption" class="w-full h-full" autoresize />
            <div v-else class="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                No data available
            </div>
        </div>

    </div>
</template>
