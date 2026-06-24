<script setup>
/**
 * @component AlertHistoryPage
 * @description UI Component for AlertHistoryPage.
 *
 */

import { computed, inject, ref, watch } from 'vue';

import {
    buildAlertCatalog,
    buildAlertMetaCache,
    buildMeterStateAlertEntry,
    dedupeAlertCatalog,
    getAlertTypeOptionsFromCatalog,
    getTenantMeters,
    splitAlertAddressesBySource
} from '@/utils/alertCatalog';
import { applyFilters, flattenTransitions } from '@/utils/alertHistory';
import { sendWsRpc } from '@/utils/wsRpc';
import { useTenantStore } from '@/store/tenant';

const ws = inject('ws');
const auth = inject('auth');
const edges = inject('edges', null);
const tenantStore = useTenantStore();

const loading = ref(false);
const error = ref('');
const rows = ref([]);
const lastLoadedAt = ref(null);
const discoveredAlertCatalog = ref([]);
const initialHistoryLoaded = ref(false);
const defaultRange = buildDefaultDateRange();
const severityOptions = ['WARNING', 'FAULT'];

const fromDate = ref(defaultRange.from);
const toDate = ref(defaultRange.to);
const selectedType = ref('all');
const selectedSeverities = ref([...severityOptions]);

const tenantEdgeIds = computed(() => tenantStore.tenantEdges || []);
const onlineEdgeIds = computed(() => {
    const ids = (edges?.list || [])
        .filter((edge) => edge?.isOnline)
        .map((edge) => (typeof edge?.id === 'string' ? edge.id.trim() : ''))
        .filter(Boolean);

    return new Set(ids);
});
const queryableTenantEdgeIds = computed(() => {
    const availableIds = onlineEdgeIds.value;
    return tenantEdgeIds.value.filter((edgeId) => availableIds.has(edgeId));
});
const alertCatalog = computed(() => buildAlertCatalog(queryableTenantEdgeIds.value));
const fullAlertCatalog = computed(() => dedupeAlertCatalog([...alertCatalog.value, ...discoveredAlertCatalog.value]));
const alertMetaCache = computed(() => buildAlertMetaCache(queryableTenantEdgeIds.value, discoveredAlertCatalog.value));
const typeOptions = computed(() => getAlertTypeOptionsFromCatalog(fullAlertCatalog.value));
const filteredRows = computed(() =>
    applyFilters(rows.value, 'all', selectedSeverities.value, selectedType.value === 'all' ? [] : [selectedType.value])
);
const displayRows = computed(() => buildDisplayRows(filteredRows.value));
const initialHistoryReady = computed(() => auth?.ready && (tenantEdgeIds.value.length === 0 || queryableTenantEdgeIds.value.length > 0));

watch(
    initialHistoryReady,
    (isReady) => {
        if (!isReady || initialHistoryLoaded.value) {
            return;
        }

        initialHistoryLoaded.value = true;
        loadHistory();
    },
    { immediate: true }
);

watch(typeOptions, (options) => {
    if (selectedType.value !== 'all' && !options.includes(selectedType.value)) {
        selectedType.value = 'all';
    }
});

async function loadHistory() {
    if (!auth?.ready || loading.value) {
        return;
    }

    const fromValue = new Date(`${fromDate.value}T00:00:00`);
    const toValue = new Date(`${toDate.value}T23:59:59`);

    if (Number.isNaN(fromValue.getTime()) || Number.isNaN(toValue.getTime())) {
        error.value = 'Please choose a valid start and end date.';
        rows.value = [];
        return;
    }

    if (fromValue > toValue) {
        error.value = 'The start date must be before the end date.';
        rows.value = [];
        return;
    }

    loading.value = true;
    error.value = '';

    try {
        discoveredAlertCatalog.value = await discoverMeterStateAlerts();
        const { edgeChannels, backendChannels } = splitAlertAddressesBySource(fullAlertCatalog.value);
        const requests = [];

        if (edgeChannels.length > 0) {
            requests.push(
                sendWsRpc(ws, 'queryHistoricEdgesStateChannelsTransitions', {
                    channels: edgeChannels,
                    timezone: resolvedTimezone(),
                    fromDate: fromDate.value,
                    toDate: toDate.value
                })
            );
        }

        if (backendChannels.length > 0) {
            requests.push(
                sendWsRpc(ws, 'queryHistoricBackendStateChannelsTransitions', {
                    channels: backendChannels,
                    timezone: resolvedTimezone(),
                    fromDate: fromDate.value,
                    toDate: toDate.value
                })
            );
        }

        const results = await Promise.all(requests);
        const merged = results.reduce((accumulator, result) => ({ ...accumulator, ...(result || {}) }), {});

        rows.value = flattenTransitions(merged, alertMetaCache.value);
        lastLoadedAt.value = new Date();
    } catch (loadError) {
        error.value = loadError instanceof Error ? loadError.message : 'Unable to load alert history.';
        rows.value = [];
    } finally {
        loading.value = false;
    }
}

async function discoverMeterStateAlerts() {
    const meters = getTenantMeters(queryableTenantEdgeIds.value);

    if (meters.length === 0) {
        return [];
    }

    const results = await Promise.all(
        meters.map(async (meter) => {
            const edgeId = normalizeString(meter?.edgeParent);
            const componentId = normalizeString(meter?.name);

            if (!edgeId || !componentId) {
                return [];
            }

            try {
                const result = await sendWsRpc(ws, 'edgeRpc', {
                    edgeId,
                    payload: {
                        jsonrpc: '2.0',
                        id: crypto.randomUUID(),
                        method: 'componentJsonApi',
                        params: {
                            componentId: '_componentManager',
                            payload: {
                                jsonrpc: '2.0',
                                id: crypto.randomUUID(),
                                method: 'getStateChannelsOfComponent',
                                params: { componentId }
                            }
                        }
                    }
                });

                const channels = result?.payload?.result?.channels ?? [];

                return channels
                    .map((channel) => buildMeterStateAlertEntry({ edgeId, componentId, channel }))
                    .filter(Boolean);
            } catch {
                return [];
            }
        })
    );

    return dedupeAlertCatalog(results.flat());
}

function resetFilters() {
    const range = buildDefaultDateRange();
    fromDate.value = range.from;
    toDate.value = range.to;
    selectedType.value = 'all';
    selectedSeverities.value = [...severityOptions];
}

function normalizeString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toggleSeverity(level) {
    if (selectedSeverities.value.includes(level)) {
        selectedSeverities.value = selectedSeverities.value.filter((value) => value !== level);
        return;
    }

    selectedSeverities.value = [...selectedSeverities.value, level];
}

function severityClass(level) {
    return (
        {
            INFO: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
            WARNING: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
            FAULT: 'border-red-500/40 bg-red-500/10 text-red-300'
        }[level] || 'border-slate-600 bg-slate-800 text-slate-300'
    );
}

function sourceLabel(row) {
    if (row.source === 'backend') {
        return `${row.edgeId}/${row.componentId}`;
    }

    return `${row.edgeId}/${row.componentId}`;
}

function formatTimestamp(row) {
    if (!row.timestamp) {
        return 'Active before Date Range Start';
    }

    return formatBackendLocalDateTime(row.timestamp);
}

function formatLoadedAt(value) {
    return value ? formatLocalDateTime(value) : 'Not loaded yet';
}

function resolvedTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function formatLocalDateTime(value) {
    return new Date(value).toLocaleString(undefined, {
        timeZone: resolvedTimezone(),
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    });
}

function formatBackendLocalDateTime(value) {
    const parsed = parseBackendLocalDateTime(value);

    if (!parsed) {
        return '';
    }

    return parsed.toLocaleString(undefined, {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    });
}

function parseBackendLocalDateTime(value) {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);

    if (!match) {
        return null;
    }

    const [, year, month, day, hour, minute, second] = match;

    // Alert-transition timestamps are already generated in the requested local
    // timezone by the backend, but are serialized with a trailing UTC marker.
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
}

function buildDefaultDateRange() {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return {
        from: toDateInputValue(weekAgo),
        to: toDateInputValue(today)
    };
}

function toDateInputValue(date) {
    const pad = (value) => String(value).padStart(2, '0');

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join('-');
}

function buildDisplayRows(items) {
    const groupedRows = new Map();

    items.forEach((row) => {
        const key = `${row.edgeId}/${row.componentId}/${row.channelId}`;
        if (!groupedRows.has(key)) {
            groupedRows.set(key, []);
        }
        groupedRows.get(key).push(row);
    });

    const pairedRows = [];

    groupedRows.forEach((group) => {
        const ordered = [...group].sort(compareRowsAscending);

        ordered.forEach((row, index) => {
            if (row.eventKind !== 'fired' && row.eventKind !== 'static') {
                return;
            }

            const recoveredRow = ordered.slice(index + 1).find((candidate) => candidate.eventKind === 'recovered');

            pairedRows.push({
                ...row,
                recoveredAt: recoveredRow?.timestamp ?? null
            });
        });
    });

    return pairedRows.sort(compareRowsDescending);
}

function compareRowsAscending(left, right) {
    if (!left.timestamp && !right.timestamp) return 0;
    if (!left.timestamp) return -1;
    if (!right.timestamp) return 1;
    return left.timestamp.localeCompare(right.timestamp);
}

function compareRowsDescending(left, right) {
    if (!left.timestamp && !right.timestamp) return 0;
    if (!left.timestamp) return 1;
    if (!right.timestamp) return -1;
    return right.timestamp.localeCompare(left.timestamp);
}

function formatRecoveryTimestamp(value) {
    return value ? formatBackendLocalDateTime(value) : '';
}

</script>

<template>
    <div class="min-h-screen text-white p-6">
        <div class="flex flex-col gap-3 mb-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
                <h1 class="text-3xl font-bold mb-2">Alerts History</h1>
                <p class="text-gray-400 max-w-3xl">
                    Review state-channel transitions for live alert types, including edge offline, threshold, communication failure, and backend low-storage alerts.
                </p>
            </div>

            <div class="text-sm text-gray-400">
                Last loaded: <span class="text-gray-200">{{ formatLoadedAt(lastLoadedAt) }}</span>
            </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-6">
            <section class="rounded-2xl border border-slate-700 bg-slate-950/70 backdrop-blur-sm p-5 h-fit">
                <div class="flex items-center justify-between mb-5">
                    <div>
                        <h2 class="text-lg font-semibold">Filters</h2>
                        <p class="text-sm text-gray-400">Choose the period and alert slices to load.</p>
                    </div>
                    <button class="text-sm text-sky-300 hover:text-sky-200 transition-colors" @click="resetFilters">
                        Reset
                    </button>
                </div>

                <div class="space-y-5">
                    <div class="space-y-2">
                        <label class="text-sm text-gray-300">From</label>
                        <input v-model="fromDate" type="date" class="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" />
                    </div>

                    <div class="space-y-2">
                        <label class="text-sm text-gray-300">To</label>
                        <input v-model="toDate" type="date" class="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" />
                    </div>

                    <div class="space-y-2">
                        <label class="text-sm text-gray-300">Alert type</label>
                        <select v-model="selectedType" class="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white">
                            <option value="all">All alert types</option>
                            <option v-for="type in typeOptions" :key="type" :value="type">
                                {{ type }}
                            </option>
                        </select>
                    </div>

                    <div class="space-y-2">
                        <label class="text-sm text-gray-300">Severity</label>
                        <div class="flex flex-wrap gap-2">
                            <button
                                v-for="level in severityOptions"
                                :key="level"
                                class="rounded-full border px-3 py-1.5 text-sm transition-colors"
                                :class="selectedSeverities.includes(level) ? severityClass(level) : 'border-slate-700 bg-slate-900 text-gray-400'"
                                @click="toggleSeverity(level)"
                            >
                                {{ level }}
                            </button>
                        </div>
                    </div>

                    <button class="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400" :disabled="loading" @click="loadHistory">
                        {{ loading ? 'Loading history...' : 'Load history' }}
                    </button>
                </div>
            </section>

            <section class="space-y-4">
                <div class="rounded-2xl border border-slate-700 bg-slate-950/70 backdrop-blur-sm overflow-hidden">
                    <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                        <div>
                            <h2 class="text-lg font-semibold">Timeline</h2>
                            <p class="text-sm text-gray-400">Transitions inside the selected period are shown first. If none exist for an alert, an active state at range start is shown instead.</p>
                        </div>
                        <div class="text-xs uppercase tracking-[0.2em] text-gray-500">
                            {{ resolvedTimezone() }}
                        </div>
                    </div>

                    <div v-if="error" class="m-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {{ error }}
                    </div>

                    <div v-else-if="loading && !lastLoadedAt" class="px-5 py-12 text-center text-gray-400">
                        Loading alert history...
                    </div>

                    <div v-else-if="!lastLoadedAt" class="px-5 py-12 text-center text-gray-400">
                        Choose filters, then load alert history.
                    </div>

                    <div v-else-if="displayRows.length === 0" class="px-5 py-12 text-center text-gray-400">
                        No fired alerts found for the selected filters.
                    </div>

                    <div v-else class="divide-y divide-slate-800">
                        <div v-for="(row, index) in displayRows" :key="`${row.edgeId}-${row.componentId}-${row.channelId}-${row.timestamp || 'static'}-${index}`" class="px-5 py-4">
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div class="space-y-2">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="rounded-full border px-2.5 py-1 text-xs font-semibold" :class="severityClass(row.level)">
                                            {{ row.level }}
                                        </span>
                                    </div>

                                    <div>
                                        <h3 class="text-base font-semibold text-white">{{ row.channelText }}</h3>
                                        <p class="text-sm text-gray-400">{{ row.description }}</p>
                                    </div>
                                </div>

                                <div class="text-sm text-gray-300 lg:text-right">
                                    <div class="font-medium">{{ formatTimestamp(row) }}</div>
                                    <div class="text-gray-500">{{ sourceLabel(row) }}</div>
                                    <div v-if="row.recoveredAt" class="text-xs text-gray-400 mt-1">
                                        <span class="text-emerald-300 font-medium">Recovered</span> at {{ formatRecoveryTimestamp(row.recoveredAt) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>
