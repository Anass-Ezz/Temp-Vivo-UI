import { computed, inject, toValue } from 'vue';
import { useDataStore } from '@/store/dataStore';
import { useAlertsStore } from '@/store/alerts';
import { getRelatedAlarms } from '@/utils/statusMapping';

/**
 * useChannelStatus
 * 
 * Determines the visual status (color, stale state, alert state) of a given channel.
 * 
 * @param {string|Ref|Computed} channelAddress - The fully qualified channel address 
 * @param {string} componentType - The type of component (e.g., 'meter')
 * @param {string} defaultColor - The CSS class for the 'normal' state (e.g. 'text-blue-500')
 */
export function useChannelStatus(channelAddress, componentType = 'meter', defaultColor = '') {
    const dataStore = useDataStore();
    const alertsStore = useAlertsStore();

    // Safely resolve the address if it's reactive
    const addr = computed(() => toValue(channelAddress));

    const channelInfo = computed(() => dataStore.channels[addr.value] || { value: null, timestamp: 0, isStale: true });

    // Determine if any related threshold alarm is active
    const activeAlarm = computed(() => {
        const path = addr.value;
        if (!path) return null;
        
        const parts = path.split('/');
        if (parts.length < 3) return null;

        const edgeId = parts[0];
        const componentId = parts[1];
        const channelName = parts[parts.length - 1];

        const relatedAlarms = getRelatedAlarms(componentType, channelName);
        
        const componentAlarms = alertsStore.channelValues[componentId] || {};
        
        for (const alarmId of relatedAlarms) {
            if (componentAlarms[alarmId] > 0) {
                return alarmId;
            }
        }
        
        return null;
    });

    const isStale = computed(() => channelInfo.value.isStale);

    const colorClass = computed(() => {
        const path = addr.value;
        const res = activeAlarm.value ? 'text-red-500' : (isStale.value ? 'text-gray-500' : defaultColor);
        
        // Debugging (Uncomment to troubleshoot)
        if (path && path.includes('ActivePower')) {
           // status computed
        }

        return res || defaultColor;
    });
    
    const svgColor = computed(() => {
        if (activeAlarm.value) return 'red';
        if (isStale.value) return 'gray';
        return 'currentColor';
    });

    const status = computed(() => {
        if (activeAlarm.value) return 'alert';
        if (isStale.value) return 'stale';
        return 'normal';
    });

    return {
        channelInfo,
        activeAlarm,
        isStale,
        colorClass,
        svgColor,
        status
    };
}
