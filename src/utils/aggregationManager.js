import { watch, reactive } from 'vue';
import { filterAggregationRequests, getQueryableEdgeIds, normalizeString } from '@/utils/edgeAvailability.js';
import { useDataStore } from '@/store/dataStore';

export class AggregationManager {
  constructor(ws, auth, intervalRef, edges = null) {
    this.ws = ws;
    this.auth = auth;
    this.edges = edges;
    this.subscribers = new Map();
    // Unique keys mapped to callbacks so we can route results easily
    this.keyMap = new Map();
    this.hasFetched = false;
    this.pollingInterval = null;
    this.intervalRef = intervalRef;
    
    // We bind our listeners just like CurrentDataManager
    this._handleMessage = this._handleMessage.bind(this);
    this._handleOpen = this._handleOpen.bind(this);
    
    this._initialize();
  }

  _initialize() {
    if (!this.ws) return;
    
    this.ws.addEventListener('message', this._handleMessage);
    this.ws.addEventListener('open', this._handleOpen);

    if (this.auth) {
      watch(() => this.auth.ready, (ready) => {
        if (ready) {
          this._attemptFetch();
        }
      }, { immediate: true });
    }

    if (this.edges) {
      watch(
        () => (this.edges.list || []).map((edge) => `${normalizeString(edge?.id) || ''}:${edge?.isOnline ? 1 : 0}`),
        () => {
          this._attemptFetch();
        },
        { immediate: true }
      );
    }

    if (this.intervalRef) {
       watch(this.intervalRef, (newVal) => {
         this._startPolling(newVal?.value || 0);
       }, { immediate: true, deep: true });
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      this._attemptFetch();
    }
  }

  _startPolling(ms) {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (ms > 0) {
      this.pollingInterval = setInterval(() => {
        this._attemptFetch();
      }, ms);
    }
  }

  /**
   * Register a component's aggregation demands. 
   * @param {string} id - Component identifier
   * @param {Array<Object>} aggregations - List of aggregation requirement objects 
   * @param {Function} callback - Called with { key: [values] } when backend replies
   */
  register(id, aggregations, callback) {
    
    // Give each aggregation object a dynamic key if missing, and store it
    const trackedAggregations = aggregations.map(agg => {
      const key = agg.key || `agg_${Math.random().toString(36).substring(2, 9)}`;
      
      // Store which callback belongs to this key for easy routing later
      this.keyMap.set(key, callback);
      
      return { ...agg, key };
    });

    this.subscribers.set(id, { aggregations: trackedAggregations, callback });
    
    // We debounce the fetch so if multiple components mount exactly at the same time,
    // they batch into one giant JSON-RPC request automatically.
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      this._attemptFetch();
    }, 50);
  }

  unregister(id) {
    const subscriber = this.subscribers.get(id);
    
    if (subscriber) {
      subscriber.aggregations.forEach(agg => {
        this.keyMap.delete(agg.key);
      });
      this.subscribers.delete(id);
    }
  }

  _handleOpen() {
    this._attemptFetch();
  }

  async _attemptFetch() {
    if (!this.ws || 
        this.ws.readyState !== WebSocket.OPEN || 
        !this.auth?.ready || 
        this.subscribers.size === 0 ||
        this.fetchInFlight) { // Protect against parallel fetches
      return;
    }

    // Collect all unique aggregations currently active
    const allAggregations = [];
    for (const { aggregations } of this.subscribers.values()) {
      allAggregations.push(...aggregations);
    }

    const queryableEdgeIds = this.edges
      ? getQueryableEdgeIds(this.edges, { onlineOnly: true })
      : null;
    const filteredAggregations = filterAggregationRequests(allAggregations, queryableEdgeIds);

    if (filteredAggregations.length === 0) return;

    this.fetchInFlight = true;
    try {
      const requestId = crypto.randomUUID();
      
      const response = await this._sendMessage({
        jsonrpc: '2.0',
        id: requestId,
        method: 'aggregateAndGetEdgesChannelsValues',
        params: {
          timezone: 'Africa/Casablanca', // Hardcoded as per user request
          aggregations: filteredAggregations
        }
      });
      
      this._distributeData(response);
      
      // NEW: Feed the global DataStore
      // Aggregation responses are a bit different, but they contain current states (TODAY values)
      const dataStore = useDataStore();
      const flattened = {};
      // response is key -> value (one value per key for TODAY aggregations)
      for (const [key, val] of Object.entries(response)) {
          // We need to resolve the key back to a channel if possible, 
          // or just track the key itself as a source of "truth".
          // For now, tracking the key is enough to detect if "Energy Today" is stale.
          flattened[key] = val;
      }
      dataStore.updateBatch(flattened);

      this.lastError = null; // Clear error tracking on success
      
    } catch (error) {
      const msg = error.message || "";
      if (msg.includes('not available for query')) {
        // Only warn once for the same missing data state
        if (this.lastError !== 'SIMULATOR_WAITING') {
          this.lastError = 'SIMULATOR_WAITING';
        }
      } else {
        // non-transient error, swallow silently
      }
    } finally {
      this.fetchInFlight = false;
    }
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
          // Look for direct replies to our random UUID
          if (response.id === messageId) {
            clearTimeout(timeout);
            this.ws.removeEventListener('message', handleResponse);
            if (response.error) {
              reject(new Error(response.error.message || 'Server error'));
            } else {
              resolve(response.result); // result is an object mapping key -> data
            }
          }
        } catch (e) {
          // Ignore parsing errors for other messages
        }
      };

      const timeout = setTimeout(() => {
        this.ws.removeEventListener('message', handleResponse);
        reject(new Error('Message timeout in AggregationManager'));
      }, 15000); // Historical queries can take a bit longer

      this.ws.addEventListener('message', handleResponse);
      this.ws.send(JSON.stringify(message));
    });
  }

  _handleMessage(event) {
    // Unlike CurrentDataManager, we rely entirely on the Promise resolution
    // of _sendMessage to funnel data back, because historical aggregation is 
    // a request/response model, not an unprompted WebSocket stream.
    // So this is intentionally blank unless you later add "push" aggregation support.
  }

  _distributeData(dataMap) {
    if (!dataMap || typeof dataMap !== 'object') return;
    
    // The backend returns an object that looks like: 
    // { "agg_x3jf8": [10.5, 20.3...], "agg_p4ll2": [1.1, 2.2...] }
    
    // Because we mapped every key directly to its component callback during register(), 
    // we just iterate the keys!
    
    const componentPayloads = new Map();
    
    for (const [key, aggregateArray] of Object.entries(dataMap)) {
      const callback = this.keyMap.get(key);
      if (callback) {
        if (!componentPayloads.has(callback)) {
           componentPayloads.set(callback, {});
        }
        componentPayloads.get(callback)[key] = aggregateArray;
      }
    }
    
    // Fire all callbacks containing only the keys they explicitly asked for
    for (const [callback, filteredData] of componentPayloads.entries()) {
       try {
         callback(filteredData);
       } catch (e) {
         // swallow callback errors silently
       }
    }
  }

  // Exposed method in case a component wants to force a manual recalculation
  forceRefresh() {
    return this._attemptFetch();
  }

  destroy() {
    if (this.ws) {
      this.ws.removeEventListener('message', this._handleMessage);
      this.ws.removeEventListener('open', this._handleOpen);
    }
    this.subscribers.clear();
    this.keyMap.clear();
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }
}
