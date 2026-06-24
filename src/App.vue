<script setup>
/**
 * @component App
 * @description UI Component for App.
 *
 */

import { createAuthGuard } from '@/router/authGuard';
import { CurrentDataManager } from '@/utils/currentDataManager';
import { AggregationManager } from '@/utils/aggregationManager';
import { useDataStore } from '@/store/dataStore';
import { provide, reactive, ref, watch, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

/* NEW → */
import { createWs } from '@/utils/createWs'; // ⬅️ 1

/* ───────────────────────── setup ───────────────────────── */
const router = useRouter();

/* Global Polling Intervals */
const aggregationInterval = ref({ label: '5s', value: 5000 });
const historyInterval = ref({ label: '5m', value: 300000 });

/* NEW → build socket & auth in one line — infraConfig now also returned */
const { ws, auth, edges, infraConfig } = createWs(router, aggregationInterval); // ⬅️ 2

/* rest of the file keeps working exactly the same */
const dateRange = ref([null, null]);
const resolution = ref({ value: 1, unit: 'Hours' });

/* currentDataManager now receives ws & auth as before */
const currentDataManager = new CurrentDataManager(ws, auth, edges);
const aggregationManager = new AggregationManager(ws, auth, aggregationInterval, edges);

/* provide injections */
provide('dateRange', { value: dateRange, update: (r) => (dateRange.value = r) });
provide('resolution', { value: resolution, update: (r) => (resolution.value = r) });
provide('aggregationInterval', aggregationInterval);
provide('historyInterval', historyInterval);
provide('ws', ws);
provide('auth', auth);
provide('edges', edges);
provide('infraConfig', infraConfig);  // ← NEW: components can inject this to react to ready/loading
provide('currentDataManager', currentDataManager);
provide('aggregationManager', aggregationManager);

/* refresh context unchanged */
const refreshContext = reactive({
    count: 0,
    triggerRefresh() {
        this.count++;
    }
});
provide('refresh', refreshContext);

/* guard comes after auth is ready */
createAuthGuard(router, auth);

onMounted(() => {
    const dataStore = useDataStore();
    dataStore.startStalenessMonitor();
});

/* ───────── loading / error state derived from infraConfig ───────── */
// Show the loading screen until the system initialization is complete (auth.ready)
// or until a fatal error occurs (infraConfig.error).
const isLoadingConfig = computed(() =>
    !auth.ready && !infraConfig.error
);

const hasConfigError = computed(() =>
    !infraConfig.ready && !!infraConfig.error
);




function retryConfig() {
    infraConfig.reset();
    infraConfig.fetchConfig(ws);
}
</script>

<template>
    <!-- ══════════════ CONFIG LOADING SCREEN ══════════════ -->
    <div
        v-if="isLoadingConfig"
        class="boot-screen"
        aria-live="polite"
        aria-label="Loading application"
    >
        <div class="boot-container">
            <img src="@/assets/images/logo_embeddia_2.png" alt="Embeddia logo" class="boot-logo">
            
            <div class="boot-loader">
                <div class="spinner"></div>
                <span class="boot-status">Initializing System...</span>
            </div>

            <div class="boot-progress">
                <div class="progress-track">
                    <div class="progress-bar"></div>
                </div>
                <p class="progress-text">Synchronizing infrastructure configuration</p>
            </div>
        </div>
    </div>
    <!-- ══════════════ CONFIG ERROR SCREEN ══════════════ -->
    <div v-else-if="hasConfigError" class="boot-screen">
        <div class="error-container card border-red-500/20 shadow-2xl">
            <div class="error-header">
                <div class="error-icon-wrapper">
                    <i class="pi pi-exclamation-circle text-4xl text-red-500"></i>
                </div>
                <h1 class="error-title">Initialization Failed</h1>
            </div>

            <div class="error-body">
                <p class="error-message">
                    We encountered an issue while setting up your environment. This usually happens when the dashboard cannot reach the backend service.
                </p>
                
                <div class="error-details">
                    <span class="details-label">Error Details:</span>
                    <p class="details-text">{{ infraConfig.error }}</p>
                </div>

                <div class="error-actions">
                    <button class="retry-button" @click="retryConfig">
                        <i class="pi pi-refresh"></i>
                        <span>Try Again</span>
                    </button>
                    
                    <div class="support-check">
                        <i class="pi pi-info-circle mr-2"></i>
                        <span>If the issue persists, please check if the <b>OpenEMS Backend</b> is running.</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ══════════════ NORMAL APP ══════════════ -->
    <router-view v-else />
</template>

<style scoped>
/* ── Container ── */
.boot-screen {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #09090b; /* Zinc 950 / Black */

    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* ── Loading State ── */
.boot-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2.5rem;
    max-width: 400px;
    width: 90%;
    text-align: center;
}

.boot-logo {
    width: 160px;
    height: auto;
    opacity: 0.9;
}

.boot-loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(14, 165, 233, 0.2);
    border-top-color: #0ea5e9;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.boot-status {
    font-size: 1.1rem;
    font-weight: 500;
    color: #94a3b8;
}

.boot-progress {
    width: 100%;
}

.progress-track {
    height: 4px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 0.75rem;
}

.progress-bar {
    height: 100%;
    width: 40%;
    background: #0ea5e9;
    border-radius: 2px;
    animation: slide 2s ease-in-out infinite;
}

.progress-text {
    font-size: 0.85rem;
    color: #64748b;
    margin: 0;
}

/* ── Error State ── */
.error-container {
    background: rgba(9, 9, 11, 0.85); /* Zinc 950 / Near black */

    backdrop-filter: blur(12px);
    border-radius: 1.5rem;
    padding: 3rem 2.5rem;
    max-width: 500px;
    width: 95%;
    border: 1px solid rgba(239, 68, 68, 0.1);
}

.error-header {
    margin-bottom: 2rem;
    text-align: center;
}

.error-icon-wrapper {
    margin-bottom: 1rem;
}

.error-title {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0;
    color: #f8fafc;
}

.error-body {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.error-message {
    color: #94a3b8;
    line-height: 1.6;
    margin: 0;
    text-align: center;
}

.error-details {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 0.75rem;
    padding: 1.25rem;
    border-left: 4px solid #ef4444;
}

.details-label {
    display: block;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    margin-bottom: 0.5rem;
    font-weight: 700;
}

.details-text {
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.9rem;
    color: #ef4444;
    word-break: break-word;
}

.error-actions {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-top: 1rem;
}

.retry-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #0ea5e9;
    color: white;
    border: none;
    border-radius: 0.75rem;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
}

.retry-button:hover {
    background: #0284c7;
    transform: translateY(-1px);
}

.retry-button:active {
    transform: translateY(0);
}

.support-check {
    display: flex;
    align-items: flex-start;
    font-size: 0.85rem;
    color: #64748b;
    line-height: 1.4;
    padding: 0 0.5rem;
}

/* ── Animations ── */
@keyframes spin {
    to { transform: rotate(360deg); }
}

@keyframes slide {
    0% { transform: translateX(-100%); width: 0%; }
    50% { transform: translateX(0%); width: 40%; }
    100% { transform: translateX(100%); width: 0%; }
}
</style>
