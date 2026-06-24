import { watch } from 'vue';
import { getQueryableEdgeIds, normalizeString } from '@/utils/edgeAvailability.js';
import { useDataStore } from '@/store/dataStore';

export class CurrentDataManager {
    constructor(ws, auth, edges = null) {
        this.ws = ws;
        this.auth = auth;
        this.edges = edges;
        this.subscribers = new Map();
        this.edgeSet = new Set();
        // channelGroups holds a map of EdgeID -> Set of channels (e.g. 'edge0' -> ['meter0/ActivePower'])
        this.channelGroups = new Map();
        this.isSubscribed = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        this._handleMessage = this._handleMessage.bind(this);
        this._handleOpen = this._handleOpen.bind(this);
        this._handleClose = this._handleClose.bind(this);
        this._handleError = this._handleError.bind(this);

        this._initialize();
    }

    _initialize() {
        if (!this.ws) return;

        // Add all WebSocket event listeners
        this.ws.addEventListener('message', this._handleMessage);
        this.ws.addEventListener('open', this._handleOpen);
        this.ws.addEventListener('close', this._handleClose);
        this.ws.addEventListener('error', this._handleError);

        // Watch for auth changes
        if (this.auth) {
            watch(
                () => this.auth.ready,
                (ready) => {
                    if (ready) {
                        this._attemptSubscription();
                    }
                },
                { immediate: true }
            );
        }

        if (this.edges) {
            watch(
                () => (this.edges.list || []).map((edge) => `${normalizeString(edge?.id) || ''}:${edge?.isOnline ? 1 : 0}`),
                () => {
                    this.isSubscribed = false;
                    this._attemptSubscription();
                },
                { immediate: true }
            );
        }

        // If WebSocket is already open, attempt subscription
        if (this.ws.readyState === WebSocket.OPEN) {
            this._attemptSubscription();
        }
    }

    // Components will now just pass an array of fully qualified channel addresses:
    // e.g., ["edge0/meter0/ActivePower", "edge1/inverter1/Voltage"]
    register(id, channels, callback) {
        this.subscribers.set(id, { channels, callback });
        this._updateSets();
        // Subscriber/channel set changed, so we need to send a fresh subscribe request.
        this.isSubscribed = false;
        this._attemptSubscription();
    }

    unregister(id) {
        this.subscribers.delete(id);
        this._updateSets();
        // Keep subscription state in sync with current subscriber set.
        this.isSubscribed = false;

        // If no more subscribers, we could optionally unsubscribe
        if (this.subscribers.size === 0) {
            this.isSubscribed = false;
        }
    }

    _updateSets() {
        this.edgeSet = new Set();
        this.channelGroups = new Map();

        for (const { channels } of this.subscribers.values()) {
            (channels || []).forEach((fullAddress) => {
                const normalizedAddress = normalizeString(fullAddress);
                if (!normalizedAddress) {
                    return;
                }

                // Parse the edge out of the address "edge0/meter0/ActivePower"
                const parts = normalizedAddress.split('/');
                if (parts.length >= 3) {
                    const edge = normalizeString(parts[0]);

                    // Reconstruct the channel part "meter0/ActivePower"
                    // We assume everything after the first slash is the component/channel
                    const componentChannel = normalizeString(parts.slice(1).join('/'));

                    if (!edge || !componentChannel) {
                        return;
                    }

                    this.edgeSet.add(edge);

                    if (!this.channelGroups.has(edge)) {
                        this.channelGroups.set(edge, new Set());
                    }
                    this.channelGroups.get(edge).add(componentChannel);
                }
            });
        }
    }

    _handleOpen() {
        this.reconnectAttempts = 0;
        this._attemptSubscription();
    }

    _handleClose(event) {
        this.isSubscribed = false;

        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this._attemptSubscription(), 2000 * this.reconnectAttempts);
        }
    }

    _handleError(error) {
        // WebSocket error — connection will close automatically
    }

    async _attemptSubscription() {
        // Check all prerequisites
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.auth?.ready || this.isSubscribed || this.edgeSet.size === 0) {
            return;
        }

        try {
            await this._subscribeAll();
        } catch (error) {
            // subscription failed silently
        }
    }

    async _subscribeAll() {
        const queryableEdges = this.edges
            ? getQueryableEdgeIds(this.edges, { onlineOnly: true })
            : new Set(this.edgeSet);
        const edges = Array.from(this.edgeSet).filter((edge) => queryableEdges.has(edge));

        if (!edges.length) {
            return;
        }

        // Subscribe to channels. (Edges are subscribed globally on connection in createWs.js)

        // Send an individual subscribeChannels command for each edge bundled with ONLY its channels
        const channelSubscribePromises = edges
            .map((edge) => {
                const edgeChannels = Array.from(this.channelGroups.get(edge) || []).filter(Boolean);

                if (!edgeChannels.length) {
                    return null;
                }

                return this._sendMessage({
                    jsonrpc: '2.0',
                    id: crypto.randomUUID(),
                    method: 'edgeRpc',
                    params: {
                        edgeId: edge,
                        payload: {
                            jsonrpc: '2.0',
                            id: crypto.randomUUID(),
                            method: 'subscribeChannels',
                            params: { count: 1, channels: edgeChannels }
                        }
                    }
                });
            })
            .filter(Boolean);

        if (!channelSubscribePromises.length) {
            return;
        }

        await Promise.all(channelSubscribePromises);
        this.isSubscribed = true;
    }

    async _requestInitialData() {
        // Method intentionally removed as backend pushes data automatically on subscribe
        // and does not support a dedicated getCurrentData fetch.
        return Promise.resolve();
    }

    _sendMessage(message) {
        return new Promise((resolve, reject) => {
            if (this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not open'));
                return;
            }

            const messageId = message.id;

            const handleResponse = (event) => {
                try {
                    const response = JSON.parse(event.data);
                    if (response.id === messageId) {
                        clearTimeout(timeout);
                        this.ws.removeEventListener('message', handleResponse);
                        if (response.error) {
                            reject(new Error(response.error.message || 'Server error'));
                        } else {
                            resolve(response.result);
                        }
                    }
                } catch (e) {
                    // Ignore parsing errors for other messages
                }
            };

            const timeout = setTimeout(() => {
                this.ws.removeEventListener('message', handleResponse);
                reject(new Error('Message timeout'));
            }, 10000); // 10 second timeout

            this.ws.addEventListener('message', handleResponse);
            this.ws.send(JSON.stringify(message));
        });
    }

    _handleMessage(event) {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            return;
        }

        // Handle real-time data updates
        if (msg.method === 'edgeRpc' && msg.params?.payload?.method === 'currentData') {
            const edgeId = msg.params.edgeId; // Note context of which edge this data is from
            const data = msg.params.payload.params;
            
            // NEW: Feed the global DataStore
            const dataStore = useDataStore();
            const flattened = {};
            for (const [chan, val] of Object.entries(data)) {
                flattened[`${edgeId}/${chan}`] = val;
            }
            dataStore.updateBatch(flattened);
            
            this._distributeData(edgeId, data);
        }
    }

    _distributeData(sourceEdgeId, data) {
        if (!data || typeof data !== 'object') return;

        // Distribute data to all subscribers
        for (const { channels, callback } of this.subscribers.values()) {
            const filtered = {};
            let hasData = false;

            channels.forEach((fullAddress) => {
                // e.g. fullAddress = "edge0/meter0/ActivePower"
                const parts = fullAddress.split('/');
                if (parts.length >= 2) {
                    const targetEdgeId = parts[0];
                    const componentChannel = parts.slice(1).join('/');

                    // CRITICAL: Only map data if the incoming message's edge ID perfectly matches this component's requested edge!
                    if (targetEdgeId === sourceEdgeId && data[componentChannel] !== undefined) {
                        filtered[fullAddress] = data[componentChannel];
                        hasData = true;
                    }
                }
            });

            if (hasData) {
                try {
                    callback(filtered);
                } catch (error) {
                    // callback error
                }
            }
        }
    }

    // Method to manually refresh data
    async refreshData() {
        if (this.isSubscribed) {
            await this._requestInitialData();
        }
    }

    destroy() {
        if (this.ws) {
            this.ws.removeEventListener('message', this._handleMessage);
            this.ws.removeEventListener('open', this._handleOpen);
            this.ws.removeEventListener('close', this._handleClose);
            this.ws.removeEventListener('error', this._handleError);
        }

        this.subscribers.clear();
        this.edgeSet.clear();
        this.channelGroups.clear();
        this.isSubscribed = false;
    }
}
