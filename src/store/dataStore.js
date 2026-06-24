import { defineStore } from 'pinia';
import { reactive, onBeforeUnmount } from 'vue';

/**
 * useDataStore tracks the "Pulse" of the system.
 * It stores the latest values and timestamps for every channel to determine staleness.
 */
export const useDataStore = defineStore('data', () => {
    // Map of "edgeId/componentId/channelId" -> { value, timestamp }
    const channels = reactive({});
    
    // Global Pulse State (updated by managers)
    let stalenessInterval = null;

    /**
     * Update a channel's value and mark it as active
     * @param {string} address - "edgeId/componentId/channelId"
     * @param {any} value 
     */
    function updateChannel(address, value) {
        if (!channels[address]) {
            channels[address] = { value: null, timestamp: 0, isStale: false };
        }
        
        channels[address].value = value;
        channels[address].timestamp = Date.now();
        channels[address].isStale = false;
    }

    /**
     * Batch update multiple channels
     * @param {Object} dataMap - { "address": value }
     */
    function updateBatch(dataMap) {
        const now = Date.now();
        const entries = Object.entries(dataMap);
        if (entries.length > 0) {
            // console.log(`[DataStore] Updating ${entries.length} channels...`);
        }
        
        for (const [address, value] of entries) {
            if (!channels[address]) {
                // console.log(`[DataStore] New channel discovered: ${address}`);
                channels[address] = { value: null, timestamp: 0, isStale: false };
            }
            channels[address].value = value;
            channels[address].timestamp = now;
            channels[address].isStale = false;
        }
    }

    /**
     * Background task to check for stale channels.
     * @param {number} timeoutMs - Threshold for staleness (default 30s)
     */
    function startStalenessMonitor(timeoutMs = 30000) {
        if (stalenessInterval) return;
        
        stalenessInterval = setInterval(() => {
            const now = Date.now();
            for (const addr in channels) {
                if (now - channels[addr].timestamp > timeoutMs) {
                    channels[addr].isStale = true;
                }
            }
        }, 5000); // Check every 5 seconds
    }

    function stopStalenessMonitor() {
        if (stalenessInterval) {
            clearInterval(stalenessInterval);
            stalenessInterval = null;
        }
    }

    return {
        channels,
        updateChannel,
        updateBatch,
        startStalenessMonitor,
        stopStalenessMonitor
    };
});
