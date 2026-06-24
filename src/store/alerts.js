import { defineStore } from 'pinia'
import { ref, reactive, computed, watch } from 'vue'
import { useTenantStore } from './tenant'
import { buildAlertCatalog } from '@/utils/alertCatalog'

/**
 * @typedef {Object} AlertsStoreInterface
 * @property {Object<string, number>} edgeStates - Mapping of Edge IDs to their current aggregate error state.
 * @property {Object<string, Object>} components - Discovery map of active Edge components.
 * @property {Object<string, Object>} factories - Bundle registry of available OSGi factories.
 * @property {Object<string, Array>} stateChannels - List of alarm-capable channels per component.
 * @property {Object<string, Object>} channelValues - Real-time value cache for specific component channels.
 * @property {ComputedRef<number>} overallState - Reactive maximum alarm level across active fleet.
 * @property {Ref<boolean>} loading - Background task execution flag.
 * @property {Ref<string>} currentView - Active UI mode ('list' or 'detail').
 * @property {Ref<string|null>} focusEdgeId - Selected edge for inspection details.
 * @property {Object<string, boolean>} expandedComponents - UI state map for component detail sections.
 * @property {Function} init - Mounts WebSocket listener and hydrates initial fleet ID list.
 * @property {Function} setEdgeIds - Overrides the active fleet IDs list.
 * @property {Function} startPolling - Triggers the JSON-RPC timer.
 * @property {Function} stopPolling - Halts the periodic data retrieval.
 * @property {Function} setFocusEdge - Directs view logic to a specific Edge context.
 * @property {Function} clearFocusEdge - Resets view back to fleet overview.
 * @property {Function} toggleComponentExpanded - Updates local expansion state and triggers channel discovery.
 */

/**
 * Reactive store managing real-time alarming and component states across the fleet.
 * Handles background JSON-RPC polling over WebSocket.
 *
 * @returns {AlertsStoreInterface} Structured store object containing observables and actions.
 */
export const useAlertsStore = defineStore('alerts', () => {
    // ── state ───────────────────────────────────────────
    const edgeStates = reactive({})
    const components = reactive({})
    const factories = reactive({})
    const stateChannels = reactive({})
    const channelValues = reactive({})
    
    const edgeIds = ref([])
    const tenantStore = useTenantStore()
    
    const loading = ref(false)
    
    // ── focus / mode ─────────────────────────────────────
    const currentView = ref('list') // 'list' or 'detail'
    const focusEdgeId = ref(null)
    const focusEdgeOffline = ref(false)
    const expandedComponents = reactive({}) // Map of componentId -> boolean
    
    // ── internal ────────────────────────────────────────
    let pollInterval = null
    let ws = null
    let auth = null
    
    // Request IDs
    let edgeStatesReqId = null
    let componentStatesReqId = null
    let configReqId = null
    const channelValuesReqMap = reactive({}) // reqId -> componentName
    const channelDefReqMap = reactive({})    // reqId -> componentName

    // ── computed ────────────────────────────────────────
    const overallState = computed(() => {
        if (currentView.value === 'detail' && focusEdgeId.value) {
            if (focusEdgeOffline.value) return 0
            return components['_sum']?.state ?? 0
        }
        const filteredIds = edgeIds.value.filter(id => tenantStore.tenantEdges.includes(id))
        if (!filteredIds.length) return 0
        
        return Math.max(0, ...filteredIds.map(id => edgeStates[id] || 0))
    })

    // ── initialization ──────────────────────────────────
    function init(websocket, authService, initialEdgeIds = []) {
        if (ws) return // Already initialized
        ws = websocket
        auth = authService
        edgeIds.value = initialEdgeIds
        ws.addEventListener('message', handleMessage)
    }

    function setEdgeIds(ids) {
        edgeIds.value = ids
    }

    function waitOpen() {
        return new Promise(resolve => {
            if (ws && ws.readyState === WebSocket.OPEN) return resolve()
            ws?.addEventListener('open', resolve, { once: true })
        })
    }

    // ── polling logic ──────────────────────────────────
    function startPolling(intervalRef) {
        stopPolling()
        
        const getInterval = () => {
            if (typeof intervalRef === 'number') return intervalRef
            return intervalRef?.value?.value || 5000
        }

        const tick = () => {
            if (!auth?.ready) return
            fetchData()
        }
        
        tick() // Initial fetch
        pollInterval = setInterval(tick, getInterval())

        // If it's a ref, watch for changes to restart interval
        if (typeof intervalRef !== 'number' && intervalRef?.value) {
            watch(() => intervalRef.value?.value, (newVal) => {
                if (pollInterval) clearInterval(pollInterval)
                if (newVal > 0) {
                    pollInterval = setInterval(tick, newVal)
                }
            })
        }
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
        }
    }

    // ── focus management ────────────────────────────────
    function setFocusEdge(edgeId, options = {}) {
        focusEdgeId.value = edgeId
        focusEdgeOffline.value = Boolean(options.offline)
        currentView.value = 'detail'
        // Clear components when switching edges
        Object.keys(components).forEach(k => delete components[k])
        Object.keys(factories).forEach(k => delete factories[k])
        Object.keys(stateChannels).forEach(k => delete stateChannels[k])
        Object.keys(channelValues).forEach(k => delete channelValues[k])
        Object.keys(expandedComponents).forEach(k => delete expandedComponents[k])
        
        if (!focusEdgeOffline.value) {
            fetchEdgeConfig(edgeId)
        }
    }

    // Reset when tenant changes
    watch(() => tenantStore.selectedTenantId, () => {
        clearFocusEdge()
        // Clear all edge states to ensure fresh start for new tenant
        Object.keys(edgeStates).forEach(k => delete edgeStates[k])
        fetchData()
    })

    function clearFocusEdge() {
        focusEdgeId.value = null
        focusEdgeOffline.value = false
        currentView.value = 'list'
        Object.keys(components).forEach(k => delete components[k])
        Object.keys(factories).forEach(k => delete factories[k])
        Object.keys(stateChannels).forEach(k => delete stateChannels[k])
        Object.keys(channelValues).forEach(k => delete channelValues[k])
        Object.keys(expandedComponents).forEach(k => delete expandedComponents[k])
    }

    function toggleComponentExpanded(componentId) {
        expandedComponents[componentId] = !expandedComponents[componentId]
        if (expandedComponents[componentId] && !stateChannels[componentId]) {
            fetchComponentChannelDefs(componentId)
        }
    }

    // ── data fetching ──────────────────────────────────
    async function fetchData() {
        await waitOpen()
        
        // Always poll all online edges _sum/State to keep the bell accurate
        // We only poll if NOT in detail view, or if we want to keep it updated globally.
        // The user said: "the periodic requesting shouldn't be done also when i click on the bell and i expand the components"
        // This implies switching.
        
        const expandedIds = Object.keys(expandedComponents).filter(id => expandedComponents[id])

        if (expandedIds.length > 0 && focusEdgeId.value) {
            // "the request of state channel values should be periodic also"
            // If components are expanded, poll their channel values
            expandedIds.forEach(id => {
                const channels = stateChannels[id]
                if (channels) fetchChannelValues(id, channels)
            })
        } else if (focusEdgeId.value) {
            // If in detail view but no expansion, poll component states
            fetchComponentStates()
        } else {
            // Default: poll edge states
            fetchEdgeStates()
        }
    }

    function fetchEdgeStates() {
        const filteredIds = edgeIds.value.filter(id => tenantStore.tenantEdges.includes(id))
        if (!filteredIds.length) return
        
        // 1. Always poll _sum/State for overall health
        edgeStatesReqId = crypto.randomUUID()
        ws.send(JSON.stringify({
            jsonrpc: '2.0', id: edgeStatesReqId,
            method: 'getEdgesChannelsValues',
            params: { ids: filteredIds, channels: ['_sum/State'] }
        }))

        // 2. Poll all threshold and communication alarms from the catalog 
        // to ensure value-status color coding works globally.
        const catalog = buildAlertCatalog(filteredIds);
        const edgeToChannels = {};
        
        catalog.forEach(item => {
            if (item.source === 'edge' && item.edgeId && item.componentId && item.channelId) {
                if (!edgeToChannels[item.edgeId]) edgeToChannels[item.edgeId] = [];
                edgeToChannels[item.edgeId].push(`${item.componentId}/${item.channelId}`);
            }
        });

        // Send a request for each edge to fetch its specific alarms
        Object.entries(edgeToChannels).forEach(([edgeId, channels]) => {
            const reqId = crypto.randomUUID();
            // Reuse the channelValues tracking logic in handleMessage
            channelValuesReqMap[reqId] = '_GLOBAL_'; // Special flag for global channel updates
            ws.send(JSON.stringify({
                jsonrpc: '2.0', id: reqId,
                method: 'getEdgesChannelsValues',
                params: { ids: [edgeId], channels }
            }));
        });
    }

    async function fetchEdgeConfig(edgeId) {
        await waitOpen()
        configReqId = crypto.randomUUID()
        const INN = crypto.randomUUID()
        ws.send(JSON.stringify({
            jsonrpc:'2.0', id: configReqId, method:'edgeRpc', params:{
                edgeId, payload:{ jsonrpc:'2.0', id:INN, method:'getEdgeConfig', params:{} }
            }
        }))
    }

    function fetchComponentStates() {
        if (!focusEdgeId.value || !Object.keys(components).length) return
        componentStatesReqId = crypto.randomUUID()
        ws.send(JSON.stringify({
            jsonrpc:'2.0', id: componentStatesReqId,
            method:'getEdgesChannelsValues',
            params:{ ids:[focusEdgeId.value], channels: Object.keys(components).map(n => `${n}/State`) }
        }))
    }

    function fetchComponentChannelDefs(name) {
        const OUT = crypto.randomUUID()
        const MID = crypto.randomUUID()
        const INN = crypto.randomUUID()
        channelDefReqMap[OUT] = name
        ws.send(JSON.stringify({
            jsonrpc:'2.0', id:OUT, method:'edgeRpc', params:{
                edgeId: focusEdgeId.value, payload:{
                    jsonrpc:'2.0', id:MID, method:'componentJsonApi', params:{
                        componentId:'_componentManager', payload:{
                            jsonrpc:'2.0', id:INN, method:'getStateChannelsOfComponent', params:{ componentId:name }
                        }
                    }
                }
            }
        }))
    }

    function fetchChannelValues(name, channels) {
        if (!channels.length) return
        const reqId = crypto.randomUUID()
        channelValuesReqMap[reqId] = name
        const addresses = channels.map(ch => `${name}/${ch.id}`)
        ws.send(JSON.stringify({
            jsonrpc:'2.0', id:reqId,
            method:'getEdgesChannelsValues',
            params:{ ids:[focusEdgeId.value], channels: addresses }
        }))
    }

    // ── message handling ──────────────────────────────
    function handleMessage(evt) {
        let msg
        try { msg = JSON.parse(evt.data) } catch { return }

        // Edge states
        if (msg.id === edgeStatesReqId && msg.result) {
            for (const [edgeId, channels] of Object.entries(msg.result)) {
                edgeStates[edgeId] = channels['_sum/State'] ?? 0
            }
            return
        }

        // Edge config
        if (msg.id === configReqId && msg.result) {
            const cfg = msg.result?.payload?.result
            if (!cfg) return
            Object.assign(factories, cfg.factories)
            Object.entries(cfg.components).forEach(([n, c]) => {
                components[n] = { alias: c.alias, factoryId: c.factoryId, state: 0, lastUpdated: null }
            })
            loading.value = false
            fetchComponentStates()
            return
        }

        // Component states
        if (msg.id === componentStatesReqId && msg.result) {
            const values = msg.result[focusEdgeId.value] || {}
            Object.entries(values).forEach(([chan, val]) => {
                const name = chan.replace('/State', '')
                if (components[name]) {
                    components[name].state = val
                    components[name].lastUpdated = new Date().toLocaleTimeString()
                }
            })
            return
        }

        // Channel definitions
        if (channelDefReqMap[msg.id] && msg.result) {
            const name = channelDefReqMap[msg.id]
            const channels = msg.result?.payload?.result?.channels ?? []
            stateChannels[name] = channels
            delete channelDefReqMap[msg.id]
            fetchChannelValues(name, channels)
            return
        }

        // Channel values (including Global pulses)
        if (channelValuesReqMap[msg.id] && msg.result) {
            const context = channelValuesReqMap[msg.id] // name (e.g. 'meter0') or '_GLOBAL_'
            
            // Iterate over all edges in the result
            for (const [edgeId, edgeValues] of Object.entries(msg.result)) {
                for (const [addr, val] of Object.entries(edgeValues)) {
                    // addr is "componentId/channelId"
                    const parts = addr.split('/');
                    const componentId = parts[0];
                    const channelId = parts.slice(1).join('/');

                    if (!channelValues[componentId]) channelValues[componentId] = {};
                    channelValues[componentId][channelId] = val;
                }
            }
            delete channelValuesReqMap[msg.id]
            return
        }
    }

    return {
        edgeStates, components, factories, stateChannels, channelValues,
        overallState, loading, currentView, focusEdgeId, focusEdgeOffline, expandedComponents,
        init, setEdgeIds, startPolling, stopPolling, setFocusEdge, clearFocusEdge, toggleComponentExpanded
    }
})
