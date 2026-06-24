<script setup>
/**
 * @component AlertsTable
 * @description UI Component for AlertsTable.
 *
 */

import ProgressSpinner from 'primevue/progressspinner';
import { computed, inject, ref, watch } from 'vue';
import { config } from '@/config/config.js';
import { useAlertsStore } from '@/store/alerts';
import { useTenantStore } from '@/store/tenant';
import { buildAlertMetaCache } from '@/utils/alertCatalog';
import { flattenTransitions } from '@/utils/alertHistory';
import { sendWsRpc } from '@/utils/wsRpc';

const alertsStore = useAlertsStore();
const tenantStore = useTenantStore();
const edges = inject('edges');
const ws = inject('ws');
const auth = inject('auth');

const offlineRows = ref([]);
const offlineRowsLoading = ref(false);

const filteredEdges = computed(() => {
    if (!edges?.list) return [];
    return edges.list.filter((e) => tenantStore.tenantEdges.includes(e.id));
});

const focusedEdge = computed(() => {
    return filteredEdges.value.find((edge) => edge.id === alertsStore.focusEdgeId) || null;
});

const isFocusedEdgeOffline = computed(() => alertsStore.focusEdgeOffline || focusedEdge.value?.isOnline === false);

// ── category meta ─────────────────────────────────────────────
function camelToLabel(key) {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
}

function getCategoryMeta(key) {
    return { label: camelToLabel(key) };
}

// ── computed: active alert components for detail view ─────────
const activeComponents = computed(() => {
    const allComponentIds = Object.keys(alertsStore.components);
    if (!allComponentIds.length) return [];

    const configFactories = config.factories || {};
    const result = [];

    for (const [catKey, factoryIds] of Object.entries(configFactories)) {
        const category = getCategoryMeta(catKey);

        for (const factoryId of factoryIds) {
            const matched = allComponentIds.filter((id) => {
                const comp = alertsStore.components[id];
                return comp?.factoryId === factoryId && comp?.state >= 2;
            });

            matched.forEach((id) => {
                const comp = { id, ...alertsStore.components[id] };
                const meter = config.meters?.find((m) => m.name === comp.id);
                result.push({
                    ...comp,
                    categoryLabel: category.label,
                    factoryName: alertsStore.factories[factoryId]?.name || factoryId,
                    displayName: meter?.fullReference || comp.alias || comp.id,
                    displayLocation: meter?.location || ''
                });
            });
        }
    }

    return result;
});

const alertRows = computed(() => {
    return activeComponents.value.flatMap((comp) => {
        return sortedChannels(comp.id).map((channel) => ({
            key: `${comp.id}/${channel.id}`,
            meta: [comp.categoryLabel, comp.factoryName, comp.displayName].filter(Boolean).join(' | '),
            time: comp.lastUpdated || '—',
            description: channel.text,
            details: '',
            level: channel.level,
            state: levelOrder[channel.level] ?? comp.state
        }));
    });
});

const visibleAlertRows = computed(() => (isFocusedEdgeOffline.value ? offlineRows.value : alertRows.value));

const hasPendingAlertDetails = computed(() => {
    if (isFocusedEdgeOffline.value) {
        return offlineRowsLoading.value;
    }

    return activeComponents.value.some((comp) => !alertsStore.stateChannels[comp.id] || !alertsStore.channelValues[comp.id]);
});

// ── helpers ───────────────────────────────────────────────────
function stateText(s) {
    return { 0: 'OK', 1: 'INFO', 2: 'WARNING', 3: 'FAULT' }[s] ?? 'UNKNOWN';
}
function stateDotClass(s) {
    return { 0: 'bg-emerald-400', 1: 'bg-blue-400', 2: 'bg-amber-400', 3: 'bg-red-400' }[s] ?? 'bg-gray-500';
}
function detailStateText() {
    return isFocusedEdgeOffline.value ? 'Offline' : stateText(alertsStore.overallState);
}
function detailStateDotClass() {
    return isFocusedEdgeOffline.value ? 'bg-gray-600' : stateDotClass(alertsStore.overallState);
}
function detailStatePillClass() {
    return isFocusedEdgeOffline.value ? 'bg-gray-800 text-gray-500 border-gray-700' : statePillClass(alertsStore.overallState);
}
function statePillClass(s) {
    return (
        {
            0: 'bg-emerald-900/40 text-emerald-400 border-emerald-800',
            1: 'bg-blue-900/40 text-blue-400 border-blue-800',
            2: 'bg-amber-900/40 text-amber-400 border-amber-800',
            3: 'bg-red-900/40 text-red-400 border-red-800'
        }[s] ?? 'bg-gray-800 text-gray-400 border-gray-700'
    );
}
function levelPillClass(l) {
    return { INFO: 'bg-blue-900/40 text-blue-400 border-blue-800', WARNING: 'bg-amber-900/40 text-amber-400 border-amber-800', FAULT: 'bg-red-900/40 text-red-400 border-red-800', Offline: 'bg-gray-800 text-gray-500 border-gray-700' }[l] ?? 'bg-gray-800 text-gray-400 border-gray-700';
}
function alertAccentStyle(s) {
    const colors = { offline: '#4b5563', 0: '#34d399', 1: '#60a5fa', 2: '#fbbf24', 3: '#f87171' };
    return { borderLeft: `3px solid ${colors[s] ?? '#6b7280'}` };
}
function sortedChannels(compName) {
    const defs = alertsStore.stateChannels[compName] ?? [];
    const vals = alertsStore.channelValues[compName] ?? {};
    return defs.filter((ch) => (vals[ch.id] ?? 0) > 0).sort((a, b) => (levelOrder[b.level] ?? 0) - (levelOrder[a.level] ?? 0));
}
const levelOrder = { FAULT: 3, WARNING: 2, INFO: 1 };

// ── navigation ────────────────────────────────────────────────
function selectEdge(edge) {
    offlineRows.value = [];

    if (edge?.isOnline === false) {
        alertsStore.setFocusEdge(edge.id, { offline: true });
        loadOfflineEdgeAlert(edge.id);
        return;
    }

    alertsStore.setFocusEdge(edge.id);
}

function goBack() {
    offlineRows.value = [];
    alertsStore.clearFocusEdge();
}

async function loadOfflineEdgeAlert(edgeId) {
    offlineRowsLoading.value = true;
    offlineRows.value = [fallbackOfflineRow(edgeId)];

    if (!auth?.ready) {
        offlineRowsLoading.value = false;
        return;
    }

    const range = buildDefaultDateRange();
    const address = `${edgeId}/_sum/ConnectionState`;

    try {
        const result = await sendWsRpc(ws, 'queryHistoricEdgesStateChannelsTransitions', {
            channels: [address],
            timezone: resolvedTimezone(),
            fromDate: range.from,
            toDate: range.to
        });
        const rows = flattenTransitions(result || {}, buildAlertMetaCache([edgeId]));
        const activeOfflineRow = rows.find((row) => row.eventKind === 'fired' || row.eventKind === 'static');

        if (alertsStore.focusEdgeId !== edgeId || !alertsStore.focusEdgeOffline) {
            return;
        }

        offlineRows.value = [fallbackOfflineRow(edgeId, activeOfflineRow)];
    } catch {
        if (alertsStore.focusEdgeId !== edgeId || !alertsStore.focusEdgeOffline) {
            return;
        }

        offlineRows.value = [fallbackOfflineRow(edgeId)];
    } finally {
        if (alertsStore.focusEdgeId === edgeId && alertsStore.focusEdgeOffline) {
            offlineRowsLoading.value = false;
        }
    }
}

function fallbackOfflineRow(edgeId, historyRow = null) {
    return {
        key: `${edgeId}/_sum/ConnectionState`,
        meta: `Edge Status | ${edgeId} | _sum/ConnectionState`,
        time: formatOfflineTimestamp(historyRow),
        description: historyRow?.channelText || 'Edge offline',
        details: historyRow?.description || 'The edge lost its connection and is considered offline.',
        level: 'Offline',
        state: 'offline'
    };
}

function formatOfflineTimestamp(row) {
    if (!row?.timestamp) {
        return 'Active before Date Range Start';
    }

    return new Date(row.timestamp).toLocaleString();
}

function resolvedTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
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

// Watch edges to update store when they change
watch(
    () => edges.list,
    (newEdges) => {
        const onlineIds = newEdges.filter((e) => e.isOnline).map((e) => e.id);
        alertsStore.setEdgeIds(onlineIds);
    },
    { immediate: true, deep: true }
);

watch(
    activeComponents,
    (components) => {
        if (isFocusedEdgeOffline.value) {
            return;
        }

        components.forEach((comp) => {
            if (!alertsStore.expandedComponents[comp.id]) {
                alertsStore.toggleComponentExpanded(comp.id);
            }
        });
    },
    { immediate: true }
);
</script>

<template>
    <Card class="flex flex-col rounded-xl border-0 shadow-2xl bg-gray-900 overflow-hidden" style="background: linear-gradient(145deg, #111827 0%, #0f172a 100%)">
        <template #title>
            <div v-if="alertsStore.currentView === 'detail'" class="flex items-center gap-3 px-5 pt-1 pb-3 border-b border-gray-800">
                <!-- Back button -->
                <button @click="goBack" class="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all text-gray-400 hover:text-white">
                    <i class="pi pi-arrow-left text-sm"></i>
                </button>

                <!-- Title -->
                <div class="flex flex-col">
                    <span class="text-sm font-semibold text-gray-100 tracking-wide">
                        {{ alertsStore.focusEdgeId }}
                    </span>
                    <span class="text-xs text-gray-500 mt-0.5">
                        {{ isFocusedEdgeOffline ? 'Edge Status' : 'Component States' }}
                    </span>
                </div>

                <!-- Overall state pill -->
                <div class="ml-auto">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border" :class="detailStatePillClass()">
                        <span class="w-1.5 h-1.5 rounded-full" :class="detailStateDotClass()"></span>
                        {{ detailStateText() }}
                    </span>
                </div>
            </div>
        </template>

        <template #content>
            <!-- Loading -->
            <div v-if="alertsStore.loading" class="flex items-center justify-center h-80">
                <div class="flex flex-col items-center gap-3">
                    <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="4" />
                    <span class="text-xs text-gray-500">Loading...</span>
                </div>
            </div>

            <!-- ── EDGE LIST ── -->
            <div v-else-if="alertsStore.currentView === 'list'" class="h-80 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin">
                <div
                    v-for="edge in filteredEdges"
                    :key="edge.id"
                    @click="selectEdge(edge)"
                    class="group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-150 border border-transparent hover:border-gray-700 hover:bg-gray-800"
                >
                    <!-- Status dot -->
                    <span class="w-2 h-2 rounded-full flex-shrink-0" :class="edge.isOnline ? stateDotClass(alertsStore.edgeStates[edge.id] ?? 0) : 'bg-gray-600'"></span>

                    <!-- Edge info -->
                    <div class="flex flex-col flex-1 min-w-0">
                        <span class="text-sm font-medium text-gray-200 truncate">{{ edge.id }}</span>
                        <span v-if="edge.description" class="text-xs text-gray-500 truncate">{{ edge.description }}</span>
                    </div>

                    <!-- State badge -->
                    <span class="px-2 py-0.5 rounded-md text-xs font-semibold border flex-shrink-0" :class="edge.isOnline ? statePillClass(alertsStore.edgeStates[edge.id] ?? 0) : 'bg-gray-800 text-gray-500 border-gray-700'">
                        {{ edge.isOnline ? stateText(alertsStore.edgeStates[edge.id] ?? 0) : 'Offline' }}
                    </span>

                    <i class="pi pi-chevron-right text-xs text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0"></i>
                </div>

                <div v-if="filteredEdges.length === 0" class="flex flex-col items-center justify-center h-64 text-gray-600">
                    <i class="pi pi-server text-3xl mb-2"></i>
                    <span class="text-sm">No edges found</span>
                </div>
            </div>

            <!-- ── DETAIL VIEW ── -->
            <div v-else-if="alertsStore.currentView === 'detail'" class="h-80 overflow-y-auto px-2 py-2 space-y-2 scrollbar-thin">
                <div v-if="visibleAlertRows.length" class="space-y-2">
                    <div v-for="row in visibleAlertRows" :key="row.key" class="rounded-lg border border-gray-700 overflow-hidden" :style="alertAccentStyle(row.state)">
                        <div class="px-4 py-2 border-b border-gray-700 flex items-center justify-between gap-4 bg-gray-800 bg-opacity-60">
                            <span class="text-xs text-gray-400 font-medium truncate">{{ row.meta }}</span>
                            <span class="text-xs text-gray-600 flex-shrink-0">{{ row.time }}</span>
                        </div>
                        <div class="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-gray-800 transition-colors">
                            <div class="min-w-0">
                                <div class="text-sm text-gray-300">{{ row.description }}</div>
                                <div v-if="row.details" class="text-xs text-gray-500 mt-0.5">{{ row.details }}</div>
                            </div>
                            <span class="text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0" :class="levelPillClass(row.level)">{{ row.level }}</span>
                        </div>
                    </div>
                </div>

                <div v-else-if="hasPendingAlertDetails" class="flex flex-col items-center justify-center h-64 text-gray-600">
                    <ProgressSpinner style="width: 28px; height: 28px" strokeWidth="4" />
                    <span class="text-sm mt-3">{{ isFocusedEdgeOffline ? 'Loading offline details...' : 'Loading alert details...' }}</span>
                </div>

                <div v-else class="flex flex-col items-center justify-center h-64 text-gray-600">
                    <i class="pi pi-cog text-3xl mb-2"></i>
                    <span class="text-sm">No active alerts found</span>
                </div>
            </div>
        </template>
    </Card>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
    width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
    background: #374151;
    border-radius: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #4b5563;
}
</style>
