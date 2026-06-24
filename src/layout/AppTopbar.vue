<script setup>
/**
 * @component AppTopbar
 * @description UI Component for AppTopbar.
 *
 */

import { useLayout } from '@/layout/composables/layout';
import DatePicker from '@/components/common/DatePicker.vue';
// import RefreshButton from '@/components/common/RefreshButton.vue';
import IntervalPicker from '@/components/common/IntervalPicker.vue';
import TenantSelector from '@/components/common/TenantSelector.vue';
import AlertsTable from '@/components/dashboard/AlertsTable.vue';
import { usePdfExport } from '@/composables/usePdfExport';

import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Drawer from 'primevue/drawer';
import { useRouter } from 'vue-router';

import { useAlertsStore } from '@/store/alerts';
import { useTenantStore } from '@/store/tenant';
import { sendWsRpc } from '@/utils/wsRpc';

const visibleRight = ref(false);
const activeDrawerTab = ref('live');
const alertsStore = useAlertsStore();
const tenantStore = useTenantStore();
const router = useRouter();

const ws = inject('ws');
const auth = inject('auth');
const edges = inject('edges');
const aggregationInterval = inject('aggregationInterval');

const { toggleMenu } = useLayout();
const { isExporting, exportPage } = usePdfExport();

const diskSpaceLoading = ref(false);
const diskSpaceError = ref('');
const diskSpaceValue = ref(null);
const diskSpaceUpdatedAt = ref(null);
const BACKEND_LOW_STORAGE_CHANNEL = 'backend0/diskspacemonitor0/StateDiskIsLow';
let diskSpacePollTimer = null;
let diskSpaceRequestInFlight = false;

const tenantEdges = computed(() => {
  return (edges?.list || []).filter((edge) => tenantStore.tenantEdges.includes(edge.id));
});

const hasOfflineEdge = computed(() => tenantEdges.value.some((edge) => !edge.isOnline));
const diskSpaceAlertActive = computed(() => isActiveAlertValue(diskSpaceValue.value));
const hasCriticalSystemAlert = computed(() => diskSpaceAlertActive.value);

onMounted(() => {
  const onlineIds = edges.list.filter((e) => e.isOnline).map((e) => e.id);
  alertsStore.init(ws, auth, onlineIds);
  alertsStore.startPolling(aggregationInterval);
});

onBeforeUnmount(() => {
  stopDiskSpacePolling();
});

watch(() => edges.list, (newList) => {
  const onlineIds = newList.filter((e) => e.isOnline).map((e) => e.id);
  alertsStore.setEdgeIds(onlineIds);
}, { deep: true });

watch(visibleRight, (isVisible) => {
  if (!isVisible) {
    activeDrawerTab.value = 'live';
    alertsStore.clearFocusEdge();
    return;
  }

  fetchDiskSpaceAlert();
});

watch(activeDrawerTab, (tab) => {
  if (tab === 'system' && visibleRight.value) {
    fetchDiskSpaceAlert();
  }
});

watch(() => auth?.ready, (isReady) => {
  if (isReady) {
    fetchDiskSpaceAlert({ silent: true });
    startDiskSpacePolling();
    return;
  }

  stopDiskSpacePolling();
  diskSpaceValue.value = null;
  diskSpaceError.value = '';
}, { immediate: true });

watch(() => getLiveInterval(), () => {
  if (auth?.ready) {
    startDiskSpacePolling();
  }
});

function openAlertsDrawer() {
  visibleRight.value = true;
}

function getLiveInterval() {
  if (typeof aggregationInterval === 'number') {
    return aggregationInterval;
  }

  return aggregationInterval?.value?.value ?? aggregationInterval?.value ?? 5000;
}

function startDiskSpacePolling() {
  stopDiskSpacePolling();

  const interval = getLiveInterval();
  if (!interval || interval <= 0) {
    return;
  }

  diskSpacePollTimer = setInterval(() => {
    fetchDiskSpaceAlert({ silent: true });
  }, interval);
}

function stopDiskSpacePolling() {
  if (!diskSpacePollTimer) {
    return;
  }

  clearInterval(diskSpacePollTimer);
  diskSpacePollTimer = null;
}

function isActiveAlertValue(value) {
  if (value === true) {
    return true;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === 'false') {
      return false;
    }

    const numericValue = Number(normalized);
    return normalized === 'true' || (Number.isFinite(numericValue) && numericValue !== 0);
  }

  return false;
}

async function fetchDiskSpaceAlert({ silent = false } = {}) {
  if (!auth?.ready || diskSpaceRequestInFlight) {
    return;
  }

  diskSpaceRequestInFlight = true;
  if (!silent) {
    diskSpaceLoading.value = true;
  }
  diskSpaceError.value = '';

  try {
    const result = await sendWsRpc(ws, 'getBackendChannelValue', {
      channels: [BACKEND_LOW_STORAGE_CHANNEL]
    });

    diskSpaceValue.value = result?.[BACKEND_LOW_STORAGE_CHANNEL] ?? null;
    diskSpaceUpdatedAt.value = new Date();
  } catch (error) {
    diskSpaceError.value = error instanceof Error ? error.message : 'Unable to load low-storage status.';
  } finally {
    diskSpaceRequestInFlight = false;
    if (!silent) {
      diskSpaceLoading.value = false;
    }
  }
}

function openAlertHistoryPage() {
  visibleRight.value = false;
  router.push('/alert-history');
}

function getDrawerTabClass(tab) {
  const isActive = activeDrawerTab.value === tab;

  if (tab === 'system' && hasCriticalSystemAlert.value) {
    return isActive
      ? 'border border-red-400/70 bg-red-500 text-white shadow-[0_0_18px_rgba(239,68,68,0.28)]'
      : 'system-alert-tab-attention border border-red-500/60 bg-red-500/15 text-red-100 hover:bg-red-500/25';
  }

  return isActive ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800';
}

function diskStatusText() {
  if (diskSpaceLoading.value) {
    return 'Checking backend storage alert...';
  }

  if (diskSpaceError.value) {
    return diskSpaceError.value;
  }

  if (diskSpaceAlertActive.value) {
    return 'Backend storage is low.';
  }

  if (diskSpaceValue.value === null) {
    return 'Storage alert status has not been loaded yet.';
  }

  return 'No backend storage alert is active.';
}

function getBellColorClass() {
  if (hasOfflineEdge.value || hasCriticalSystemAlert.value) {
    return 'text-red-600';
  }

  return ({
    0: 'text-green-500', 1: 'text-blue-500', 2: 'text-yellow-500', 3: 'text-red-600'
  }[alertsStore.overallState] || 'text-gray-500');
}

function getBellBorderClass() {
  if (hasOfflineEdge.value || hasCriticalSystemAlert.value) {
    return '#dc2626';
  }

  return ({
    0: '#22c55e', 1: '#3b82f6', 2: '#eab308', 3: '#dc2626'
  }[alertsStore.overallState] || '#6b7280');
}
</script>

<template>
    <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" @click="toggleMenu">
                <i class="pi pi-bars"></i>
            </button>
            <router-link to="/" class="layout-topbar-logo">
                <span class="flex flex-row gap-2 font-bold items-center">
                  <img src="@/assets/images/logo_embeddia_2.png" alt="Embeddia logo" class="w-[110px] shrink-0 mx-auto"> 
                  EMS
                </span>
            </router-link>
            
            <div class="layout-topbar-tenant">
                <TenantSelector />
            </div>
        </div>
        
        <div class="layout-topbar-actions">
            <div class="flex items-center gap-3">
                <router-link to="/" class="global-view-btn" v-tooltip.bottom="'Go back to Global View'">
                    <i class="pi pi-globe"></i>
                    <span>Global View</span>
                </router-link>
                
                <Drawer :pt="{ root: { style: 'width:1010px;' } }" v-model:visible="visibleRight" position="right" class="w-[700px]">
                    <div class="space-y-5">
                        <div class="flex items-center justify-between gap-4">
                            <div>
                                <p class="text-2xl text-bold flex items-center gap-3">
                                    Alerts Center
                                    <img src="@/assets/images/RedDot.gif" alt="Live" class="h-[13px] mt-2" />
                                </p>
                                <p class="text-sm text-gray-400">
                                    Live state alerts, backend storage status, and alert history access.
                                </p>
                            </div>

                            <button class="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-sky-500 hover:text-white" @click="openAlertHistoryPage">
                                Open history page
                            </button>
                        </div>

                        <div class="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-2">
                            <button
                                class="rounded-xl border border-transparent px-4 py-2 text-sm font-medium transition-colors"
                                :class="getDrawerTabClass('live')"
                                @click="activeDrawerTab = 'live'"
                            >
                                Live alerts
                            </button>
                            <button
                                class="rounded-xl border border-transparent px-4 py-2 text-sm font-medium transition-colors"
                                :class="getDrawerTabClass('system')"
                                @click="activeDrawerTab = 'system'"
                            >
                                <span class="inline-flex items-center gap-2">
                                    <i v-if="hasCriticalSystemAlert" class="pi pi-exclamation-triangle text-xs"></i>
                                    <span>System alerts</span>
                                    <span v-if="hasCriticalSystemAlert" class="system-alert-dot"></span>
                                </span>
                            </button>
                            <button
                                class="rounded-xl border border-transparent px-4 py-2 text-sm font-medium transition-colors"
                                :class="getDrawerTabClass('history')"
                                @click="activeDrawerTab = 'history'"
                            >
                                History
                            </button>
                        </div>

                        <div v-if="activeDrawerTab === 'live'">
                            <AlertsTable />
                        </div>

                        <div v-else-if="activeDrawerTab === 'system'" class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                            <div class="flex items-start justify-between gap-4">
                                <div>
                                    <div class="flex items-center gap-2 mb-2">
                                        <span class="rounded-full border px-2.5 py-1 text-xs font-semibold" :class="diskSpaceAlertActive ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'">
                                            {{ diskSpaceAlertActive ? 'WARNING' : 'OK' }}
                                        </span>
                                        <span class="text-xs uppercase tracking-[0.18em] text-gray-500">{{ BACKEND_LOW_STORAGE_CHANNEL }}</span>
                                    </div>

                                    <h3 class="text-lg font-semibold text-white">Low storage</h3>
                                    <p class="text-sm text-gray-400 mt-1">
                                        {{ diskStatusText() }}
                                    </p>
                                    <p class="text-xs text-gray-500 mt-4">
                                        Last checked:
                                        {{ diskSpaceUpdatedAt ? diskSpaceUpdatedAt.toLocaleString() : 'Not checked yet' }}
                                    </p>
                                </div>

                                <button class="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-sky-500 hover:text-white" :disabled="diskSpaceLoading" @click="fetchDiskSpaceAlert">
                                    {{ diskSpaceLoading ? 'Refreshing...' : 'Refresh' }}
                                </button>
                            </div>
                        </div>

                        <div v-else class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                            <div class="max-w-2xl">
                                <h3 class="text-lg font-semibold text-white mb-2">Alert history page</h3>
                                <p class="text-sm text-gray-400 mb-5">
                                    Use the full history page to query transition history for edge offline, threshold, communication failure, and low-storage alerts, then filter by date, type, severity, and transition state.
                                </p>

                                <button class="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400" @click="openAlertHistoryPage">
                                    Go to alert history
                                </button>
                            </div>
                        </div>
                    </div>
                </Drawer>

                <!-- Action Group -->
                <div 
                    class="bell-btn"
                    :style="{ borderColor: getBellBorderClass() }"
                    @click="openAlertsDrawer"
                >
                    <i class="bi bi-bell" :class="getBellColorClass()"></i>
                </div>

                <IntervalPicker />
                <DatePicker />
                <!-- <RefreshButton /> -->

                <button
                    class="export-button"
                    @click="exportPage"
                    :disabled="isExporting"
                    v-tooltip.bottom="'Export page as PDF'"
                >
                    <i :class="isExporting ? 'pi pi-spin pi-spinner' : 'pi pi-download'"></i>
                </button>

            </div>
        </div>
    </div>
</template>

<style scoped>
.layout-topbar-actions {
  display: flex;
  align-items: center;
}

.global-view-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 12px;
  height: 38px;
  background: #0ea5e9;
  border: 1px solid #0284c7;
  border-radius: 6px;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.global-view-btn:hover {
  background: #0284c7;
  border-color: #0369a1;
}

.bell-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1.2rem;
}

.bell-btn:hover {
  border-color: #0ea5e9;
  background: #1e293b;
}

.system-alert-tab-attention {
  animation: system-alert-tab-pulse 1.2s ease-in-out infinite;
}

.system-alert-dot {
  display: inline-block;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 9999px;
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18);
}

@keyframes system-alert-tab-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.36);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .system-alert-tab-attention {
    animation: none;
  }
}

.export-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1rem;
}

.export-button:hover:not(:disabled) {
  border-color: #0ea5e9;
  background: #1e293b;
  color: #e2e8f0;
}

.export-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
