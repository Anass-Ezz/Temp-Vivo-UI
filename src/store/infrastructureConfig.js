// src/store/infrastructureConfig.js
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { config } from '@/config/config.js';

/**
 * Pinia store that manages the lifecycle of the remote infrastructure config.
 *
 * Usage from any component / composable:
 *   const infraConfig = useInfrastructureConfigStore();
 *   await infraConfig.fetchConfig(ws);
 */
export const useInfrastructureConfigStore = defineStore('infrastructureConfig', () => {
    const loading = ref(false);
    const ready   = ref(false);
    const error   = ref(null);

    /**
     * Send getInfrastructureConfig over the existing WebSocket and merge the
     * result into the shared reactive `config` object so all consumers that
     * already `import { config } from '@/config/config'` update automatically.
     *
     * @param {WebSocket} ws — the open WebSocket connection
     */
    async function fetchConfig(ws) {
        if (ready.value || loading.value) return; // already loaded or loading — skip


        loading.value = true;
        error.value   = null;

        try {
            const content = await _sendRpc(ws, 'getInfrastructureConfig', {});

            // Strict Validation: Config must not only arrive but also contain at least one site/tenant.
            // If it's just an empty object or has no tenants, we treat it as an error to block the app.
            if (!content || typeof content !== 'object' || 
                (!content.tenants || content.tenants.length === 0) && (!content.meters || content.meters.length === 0)) {
                throw new Error('EMS Infrastructure is not configured. Please contact support or configure it in Odoo.');
            }

            // Deep-merge backend data into the reactive config object.
            _deepMerge(config, content);
            ready.value = true;
        } catch (err) {
            error.value = err instanceof Error ? err.message : String(err);
            // We intentionally do NOT set ready=true on failure so the caller
            // can show an error screen and let the user retry.
        } finally {
            loading.value = false;
        }
    }

    function reset() {
        loading.value = false;
        ready.value   = false;
        error.value   = null;
    }

    return { loading, ready, error, fetchConfig, reset };
});

/* ─────────────────── private helpers ─────────────────── */

function _sendRpc(ws, method, params, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        if (ws.readyState !== WebSocket.OPEN) {
            reject(new Error('Backend connection is closed. Please check if the server is running.'));
            return;
        }

        const id = crypto.randomUUID();
        
        const timeout = setTimeout(() => {
            ws.removeEventListener('message', handler);
            reject(new Error(`Connection timed out while fetching configuration. the server might be overloaded or unreachable.`));
        }, timeoutMs);

        const handler = (event) => {
            let msg;
            try { msg = JSON.parse(event.data); } catch { return; }
            if (msg.id !== id) return;

            clearTimeout(timeout);
            ws.removeEventListener('message', handler);

            if (msg.error) {
                reject(new Error(msg.error.message || `RPC error[${method}]`));
                return;
            }
            // The backend wraps the payload in `result.content`
            resolve(msg.result?.content ?? msg.result);
        };

        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
}

/**
 * Recursively merge `src` into `dst` (mutates dst in-place).
 * Arrays are replaced outright (not concatenated) to keep predictable behaviour.
 */
function _deepMerge(dst, src) {
    for (const key of Object.keys(src)) {
        const srcVal = src[key];
        if (
            srcVal !== null &&
            typeof srcVal === 'object' &&
            !Array.isArray(srcVal) &&
            typeof dst[key] === 'object' &&
            dst[key] !== null &&
            !Array.isArray(dst[key])
        ) {
            // Both sides are plain objects — recurse
            _deepMerge(dst[key], srcVal);
        } else {
            // Primitive, array, or dst doesn't have the key — replace
            dst[key] = srcVal;
        }
    }
}
