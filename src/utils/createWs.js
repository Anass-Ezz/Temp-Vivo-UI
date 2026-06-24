// src/utils/createWs.js
// Helper to wire WebSocket + token verification so App.vue stays lean.

import { clearToken, getStoredToken } from '@/utils/auth';
import { flush, track } from '@/services/activityLog';
import { useInfrastructureConfigStore } from '@/store/infrastructureConfig';
import { useToast } from 'primevue/usetoast';
import { reactive, watch } from 'vue';

/**
 * @typedef {Object} WsInterface
 * @property {WebSocket} ws - The active WebSocket connection.
 * @property {Object} auth - Reactive authentication state holder.
 * @property {Object} edges - Reactive edge discovery and management state cache.
 * @property {Object} infraConfig - Shared infrastructure configuration state.
 */

/**
 * Initializes the backend WebSocket bridge and wires up authentication handlers.
 * 
 * @param {Router} router – Vue Router instance so we can redirect on expiry.
 * @param {Ref|number} [edgeRefreshIntervalRef=5000] - Polling frequency for fleet discovery.
 * @returns {WsInterface} Structured reactive bridge interface.
 */
export function createWs(router, edgeRefreshIntervalRef = 5000) {
    const toast = useToast();
    const infraConfig = useInfrastructureConfigStore();

    /* ---------- shared auth state ---------- */
    const stored = getStoredToken();
    const auth = reactive({
        token: stored,
        ready: false, // becomes true only after socket & token verification
        user: JSON.parse(sessionStorage.getItem('ems_user') || localStorage.getItem('ems_user') || 'null')
    });
    const edges = reactive({
        list: [],
        loading: false,
        error: null
    });

    /* ---------- socket ---------- */
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host; // includes port if present
    const ws = new WebSocket(`${protocol}//${wsHost}/websocket`);
    
    // Global Logging Interceptors for WebSocket Activity
    const originalSend = ws.send.bind(ws);
    ws.send = (data) => {
        originalSend(data);
    };

    let subscribeInFlight = false;
    let subscribedEdgesSignature = '';
    let edgesRefreshInterval = null;

    const getRefreshInterval = () => {
        if (typeof edgeRefreshIntervalRef === 'number') {
            return edgeRefreshIntervalRef;
        }

        return edgeRefreshIntervalRef?.value?.value ?? edgeRefreshIntervalRef?.value ?? 5000;
    };

    const sendRpc = (method, params, timeoutMs = 10000) =>
        new Promise((resolve, reject) => {
            if (ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket is not open'));
                return;
            }

            const id = crypto.randomUUID();
            const timeout = setTimeout(() => {
                ws.removeEventListener('message', handleMessage);
                reject(new Error(`RPC call ${method} timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            const handleMessage = (event) => {
                let msg;
                try {
                    msg = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (msg.id !== id) return;
                clearTimeout(timeout);
                ws.removeEventListener('message', handleMessage);

                if (msg.error) {
                    reject(new Error(msg.error.message || `RPC error in ${method}`));
                    return;
                }

                resolve(msg.result);
            };

            ws.addEventListener('message', handleMessage);
            ws.send(
                JSON.stringify({
                    jsonrpc: '2.0',
                    id,
                    method,
                    params
                })
            );
        });


    const getEdgesAndSubscribe = async () => {
        if (!auth.ready || !auth.token || ws.readyState !== WebSocket.OPEN || subscribeInFlight) {
            return;
        }

        subscribeInFlight = true;
        edges.loading = true;
        edges.error = null;
        try {
            const result = await sendRpc('getEdges', {
                limit: 100,
                page: 0,
                searchParams: {}
            });

            const fetchedEdges = Array.isArray(result?.edges) ? result.edges : [];
            const edgeIds = fetchedEdges.map((edge) => edge?.id).filter(Boolean);
            edges.list = fetchedEdges;

            if (!edgeIds.length) {
                return;
            }

            const signature = edgeIds.slice().sort().join(',');
            if (signature === subscribedEdgesSignature) {
                return;
            }

            await sendRpc('subscribeEdges', { edges: edgeIds });
            subscribedEdgesSignature = signature;
        } catch (error) {
            edges.error = error instanceof Error ? error.message : 'Unable to get edges.';
            toast.add({
                severity: 'error',
                summary: 'Subscription Error',
                detail: 'Unable to subscribe to edges.',
                life: 3000
            });
        } finally {
            edges.loading = false;
            subscribeInFlight = false;
        }
    };

    const startEdgesRefresh = () => {
        stopEdgesRefresh();

        edgesRefreshInterval = setInterval(() => {
            getEdgesAndSubscribe();
        }, getRefreshInterval());
    };

    const stopEdgesRefresh = () => {
        if (!edgesRefreshInterval) {
            return;
        }

        clearInterval(edgesRefreshInterval);
        edgesRefreshInterval = null;
    };

    const connectionTimeout = setTimeout(() => {
        if (!infraConfig.ready && ws.readyState !== WebSocket.OPEN) {
            infraConfig.error = 'Failed to connect to the backend server. Please check your network or if the backend is running.';
            infraConfig.loading = false;
            track('ems.websocket.connection_timeout', {
                category: 'operational',
                service: 'websocket',
                result: 'failure',
                requiresToken: false,
                metadata: {
                    endpoint: '/websocket',
                    readyState: ws.readyState
                }
            });
            flush();
        }
    }, 10000);

    ws.onopen = async () => {
        clearTimeout(connectionTimeout);
        track('ems.websocket.connected', {
            category: 'operational',
            service: 'websocket',
            result: 'success',
            metadata: { endpoint: '/websocket' }
        });
        flush();

        // No token → unauthenticated area of app is allowed right away
        if (!auth.token) {
            auth.ready = true;
            return;
        }

        try {
            // Step 1: Verify Token
            const authResult = await sendRpc('authenticateWithToken', { token: auth.token });
            
            if (!authResult) {
                throw new Error('AUTH_INVALID');
            }

            // Step 2: Fetch Infrastructure Config
            await infraConfig.fetchConfig(ws);
            
            if (infraConfig.error) {
                const errorStr = (infraConfig.error || '').toLowerCase();
                const isAuthError = errorStr.includes('auth') || errorStr.includes('user-id is empty');
                
                if (isAuthError) {
                    throw new Error(infraConfig.error);
                }
                
                auth.ready = false;
            } else {
                auth.ready = true;
            }
            return;

        } catch (error) {
            const errMsg = (error?.message || '').toLowerCase();
            const isAuthError = errMsg.includes('auth') || errMsg.includes('user-id is empty');
            
            if (isAuthError) {
                clearToken();
                auth.token = null;
                auth.ready = false;
                edges.list = [];

                toast.add({
                    severity: 'warn',
                    summary: 'Session Expired',
                    detail: 'Please log in again.',
                    life: 3000
                });

                if (!router.currentRoute.value.path.startsWith('/auth')) {
                    router.push({
                        path: '/auth/login',
                        query: { redirect: router.currentRoute.value.fullPath }
                    });
                }
                // Allow the app to proceed to the login page
                auth.ready = true;

            } else {
                // It's a connectivity or configuration error
                infraConfig.error = error.message || 'Initialization failed.';
            }
        }
    };

    ws.onclose = () => {
        track('ems.websocket.closed', {
            category: 'operational',
            service: 'websocket',
            result: 'failure',
            requiresToken: false,
            metadata: {
                endpoint: '/websocket',
                readyState: ws.readyState
            }
        });
        flush();
        if (!infraConfig.ready) {
            infraConfig.error = 'Backend connection lost. Retrying...';
        }
    };

    ws.onerror = (err) => {
        track('ems.websocket.error', {
            category: 'operational',
            service: 'websocket',
            result: 'failure',
            requiresToken: false,
            metadata: {
                endpoint: '/websocket',
                readyState: ws.readyState
            }
        });
        flush();
        if (!infraConfig.ready) {
            infraConfig.error = 'Unable to establish connection to backend. The service might be down.';
        }
        toast.add({
            severity: 'error',
            summary: 'WebSocket Error',
            detail: 'A connection error occurred. Please check your network.',
            life: 4000
        });
    };

    watch(
        () => [auth.ready, auth.token],
        ([isReady, token]) => {
            if (isReady && token) {
                if (!infraConfig.ready && !infraConfig.error && ws.readyState === WebSocket.OPEN) {
                    infraConfig.fetchConfig(ws);
                }
                getEdgesAndSubscribe();
                startEdgesRefresh();
                return;
            }

            stopEdgesRefresh();
            subscribedEdgesSignature = '';
            edges.list = [];
            edges.error = null;
        }
    );


    if (typeof edgeRefreshIntervalRef !== 'number') {
        watch(
            () => edgeRefreshIntervalRef?.value?.value ?? edgeRefreshIntervalRef?.value,
            () => {
                if (auth.ready && auth.token) {
                    startEdgesRefresh();
                }
            }
        );
    }

    return { ws, auth, edges, infraConfig };
}
