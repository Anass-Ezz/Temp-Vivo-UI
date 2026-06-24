<!-- src/components/meters/RealTimeMeterData.vue -->
<script setup>
/**
 * @component RealTimeMeterData
 * @description UI Component for RealTimeMeterData.
 *
 */

import { ref, computed, inject, onBeforeUnmount, watch } from 'vue';
import { useSelectedMeter } from '@/composables/useSelectedMeter.js';
import { useChannelStatus } from '@/composables/useChannelStatus.js';
import { config } from '@/config/config.js';
import { formatValue } from '@/utils/formatting';

// Formatting functions — UPDATED to return value + unit separately
const placeholder = '---';

const { edgeId, componentName, isQueryableEdge } = useSelectedMeter();

function formatPower(value) {
    if (value === null || typeof value === 'undefined') return { value: placeholder, unit: '' };
    const absValue = Math.abs(value);
    if (absValue < 1000) return { value: value.toFixed(0), unit: 'W' };
    if (absValue < 1000000) return { value: (value / 1000).toFixed(2), unit: 'kW' };
    return { value: (value / 1000000).toFixed(2), unit: 'MW' };
}

function formatReactivePower(value) {
    if (value === null || typeof value === 'undefined') return { value: placeholder, unit: '' };
    const absValue = Math.abs(value);
    if (absValue < 1000) return { value: value.toFixed(0), unit: 'var' };
    if (absValue < 1000000) return { value: (value / 1000).toFixed(2), unit: 'kVAR' };
    return { value: (value / 1000000).toFixed(2), unit: 'MVAR' };
}

function formatUnitless(value) {
    if (value === null || typeof value === 'undefined') return placeholder;
    // ✅ DIVIDE BY 1000 and show 2 decimals
    if (!Number.isFinite(value)) return placeholder;
    return (value / 1000).toFixed(2);
}

function formatEnergy(value) {
    const scaled = formatValue(value, config.meterChannels.activeEnergyChannel.unit);
    return { value: scaled.value.toFixed(scaled.decimals), unit: scaled.unit };
}

function formatCurrencyMud(value) {
    if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return { value: placeholder, unit: '' };
    return { value: value.toFixed(2), unit: 'MAD' };
}

// Reactive state
const activePower = ref(null);
const reactivePower = ref(null);
const powerFactor = ref(null);
const energyToday = ref(null);
const costToday = ref(null);

// ✅ Display values + units (computed separately for styling)
const displayActivePower = computed(() => {
    const formatted = formatPower(activePower.value);
    return formatted.value;
});
const unitActivePower = computed(() => {
    const formatted = formatPower(activePower.value);
    return formatted.unit;
});

const displayReactivePower = computed(() => {
    const formatted = formatReactivePower(reactivePower.value);
    return formatted.value;
});
const unitReactivePower = computed(() => {
    const formatted = formatReactivePower(reactivePower.value);
    return formatted.unit;
});

// ✅ Power Factor: divided by 1000, 2 decimals
const displayPowerFactor = computed(() => {
    return formatUnitless(powerFactor.value);
});

const displayEnergyToday = computed(() => {
    const formatted = formatEnergy(energyToday.value);
    return formatted.value;
});
const unitEnergyToday = computed(() => {
    const formatted = formatEnergy(energyToday.value);
    return formatted.unit;
});

const displayCostToday = computed(() => {
    const formatted = formatCurrencyMud(costToday.value);
    return formatted.value;
});
const unitCostToday = computed(() => {
    const formatted = formatCurrencyMud(costToday.value);
    return formatted.unit;
});

// ✅ Color Status for each metric
const apStatus = useChannelStatus(computed(() => `${edgeId.value}/${componentName.value}/ActivePower`), 'meter', 'text-blue-400');
const rpStatus = useChannelStatus(computed(() => `${edgeId.value}/${componentName.value}/ReactivePower`), 'meter', 'text-blue-400');
const pfStatus = useChannelStatus(computed(() => `${edgeId.value}/${componentName.value}/PowerFactor`), 'meter', 'text-blue-400');

// Aggregated values status (using unique keys)
const energyKey = computed(() => `meterpage-${edgeId.value}-${componentName.value}-energy`);
const costKey = computed(() => `meterpage-${edgeId.value}-${componentName.value}-cost`);

const etStatus = useChannelStatus(energyKey, 'meter', 'text-blue-400');
const ctStatus = useChannelStatus(costKey, 'meter', 'text-blue-400');

// Inject
const currentDataManager = inject('currentDataManager');
const aggregationManager = inject('aggregationManager');

// Keep a stable subscriber id for this component instance.
const SUBSCRIBER_ID = 'RealTimeMeterData';
const AGGREGATION_SUBSCRIBER_ID = 'RealTimeMeterDataAggregation';

// Build fully-qualified channel addresses for the current meter
function buildChannels() {
    if (!isQueryableEdge.value || !edgeId.value || !componentName.value) {
        return [];
    }

    return [`${edgeId.value}/${componentName.value}/ActivePower`, `${edgeId.value}/${componentName.value}/ReactivePower`, `${edgeId.value}/${componentName.value}/PowerFactor`];
}

// Receive and map live push data from CurrentDataManager
function handleLiveData(data) {
    const ap = data[`${edgeId.value}/${componentName.value}/ActivePower`];
    const rp = data[`${edgeId.value}/${componentName.value}/ReactivePower`];
    const pf = data[`${edgeId.value}/${componentName.value}/PowerFactor`];
    if (ap !== undefined) activePower.value = ap;
    if (rp !== undefined) reactivePower.value = rp;
    if (pf !== undefined) powerFactor.value = pf;
}

// (Re-)register the subscription with CurrentDataManager
function subscribe() {
    if (!currentDataManager) return;
    // Always clear the previous subscription before switching meter channels.
    currentDataManager.unregister(SUBSCRIBER_ID);
    const channels = buildChannels();
    if (!channels.length) {
        return;
    }

    currentDataManager.register(SUBSCRIBER_ID, channels, handleLiveData);
}

function subscribeAggregation() {
    if (!aggregationManager) return;
    aggregationManager.unregister(AGGREGATION_SUBSCRIBER_ID);

    if (!isQueryableEdge.value || !edgeId.value || !componentName.value) {
        return;
    }

    const meterChannelPrefix = `${edgeId.value}/${componentName.value}`;
    const energyKey = `meterpage-${edgeId.value}-${componentName.value}-energy`;
    const costKey = `meterpage-${edgeId.value}-${componentName.value}-cost`;

    const aggregations = [
        {
            key: energyKey,
            channels: [`${meterChannelPrefix}/${config.meterChannels.activeEnergyChannel.name}`],
            channelType: 'energy',
            periodAggregation: { period: 'TODAY' }
        },
        {
            key: costKey,
            channels: [`${meterChannelPrefix}/${config.meterChannels.activeEnergyCostChannel.name}`],
            channelType: 'cost',
            periodAggregation: { period: 'TODAY' }
        }
    ];

    try {
        aggregationManager.register(AGGREGATION_SUBSCRIBER_ID, aggregations, (dataMap) => {
            try {
                const energy = dataMap?.[energyKey]?.value;
                const cost = dataMap?.[costKey]?.value;

                if (typeof energy === 'number' && Number.isFinite(energy)) energyToday.value = energy;
                if (typeof cost === 'number' && Number.isFinite(cost)) costToday.value = cost;
            } catch (error) {
                // parse error
            }
        });

        const refreshPromise = aggregationManager.forceRefresh();
        if (refreshPromise?.then) {
            refreshPromise.catch(() => {});
        }
    } catch (error) {
        // registration failed
    }
}

// Re-subscribe and reset display values when the selected meter changes
watch(
    [edgeId, componentName, isQueryableEdge],
    () => {
        activePower.value = null;
        reactivePower.value = null;
        powerFactor.value = null;
        energyToday.value = null;
        costToday.value = null;
        subscribe();
        subscribeAggregation();
    },
    { immediate: true }
);

onBeforeUnmount(() => {
    currentDataManager?.unregister(SUBSCRIBER_ID);
    aggregationManager?.unregister(AGGREGATION_SUBSCRIBER_ID);
});
</script>

<template>
    <div class="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6">
        <!-- Current Power Tile — NOW BLUE -->
        <div class="border border-gray-600 rounded-lg p-6">
            <div class="text-gray-400 text-sm mb-2">CURRENT POWER</div>
            <div class="text-3xl font-bold" :class="apStatus.colorClass">
                {{ displayActivePower }}
                <span class="text-gray-400 text-[15px] ml-1">{{ unitActivePower }}</span>
            </div>
        </div>

        <!-- Current Reactive Power Tile — NOW RED -->
        <div class="border border-gray-600 rounded-lg p-6">
            <div class="text-gray-400 text-sm mb-2">CURRENT REACTIVE POWER</div>
            <div class="text-3xl font-bold" :class="rpStatus.colorClass">
                {{ displayReactivePower }}
                <span class="text-gray-400 text-[15px] ml-1">{{ unitReactivePower }}</span>
            </div>
        </div>

        <!-- Current Power Factor Tile — DIVIDED BY 1000, 2 DECIMALS -->
        <div class="border border-gray-600 rounded-lg p-6">
            <div class="text-gray-400 text-sm mb-2">CURRENT POWER FACTOR</div>
            <div class="text-3xl font-bold" :class="pfStatus.colorClass">
                {{ displayPowerFactor }}
                <span class="text-gray-400 text-[15px] ml-1"></span>
            </div>
        </div>

        <!-- Energy Today Tile -->
        <div class="border border-gray-600 rounded-lg p-6">
            <div class="text-gray-400 text-sm mb-2">ENERGY TODAY</div>
            <div class="text-3xl font-bold" :class="etStatus.colorClass">
                {{ displayEnergyToday }}
                <span class="text-gray-400 text-[15px] ml-1">{{ unitEnergyToday }}</span>
            </div>
        </div>

        <!-- Cost Today Tile -->
        <div class="border border-gray-600 rounded-lg p-6">
            <div class="text-gray-400 text-sm mb-2">COST TODAY</div>
            <div class="text-3xl font-bold" :class="ctStatus.colorClass">
                {{ displayCostToday }}
                <span class="text-gray-400 text-[15px] ml-1">{{ unitCostToday }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Optional: if you want to fine-tune unit spacing or weight */
</style>
