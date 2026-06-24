<template>
  <div class="card mb-0 shadow-2 border-round-xl p-4 surface-card flex flex-column gap-3 mt-4">
    <div class="flex align-items-center justify-content-between">
      <span class="text-500 font-medium text-lg">Aggregation Manager Test</span>
      <i class="pi pi-chart-bar text-primary text-xl"></i>
    </div>
    
    <div class="flex flex-column gap-2 mt-2">
      <div v-if="aggregatedData === null" class="text-sm text-500">
        <i class="pi pi-spin pi-spinner mr-2"></i> Fetching historical aggregation...
      </div>
      <div v-else class="text-sm">
        <div class="font-bold text-900 mb-1">Received Array Length: <span class="text-primary">{{ aggregatedData.length }}</span></div>
        <div class="surface-100 p-2 border-round overflow-hidden text-overflow-ellipsis white-space-nowrap font-mono text-xs">
          {{ JSON.stringify(aggregatedData) || '[]' }}
        </div>
      </div>
    </div>
    
    <div class="text-xs text-500 flex align-items-center gap-2 mt-2">
      <i class="pi pi-info-circle"></i>
      <span>Testing globalConsumptionEnergy (edge0 & edge1 sum)</span>
    </div>
  </div>
</template>

<script setup>
/**
 * @component AggregationTestWidget
 * @description UI Component for AggregationTestWidget.
 *
 */

import { inject, ref, onMounted, onUnmounted } from 'vue';
import { config } from '@/config/config';

const aggregationManager = inject('aggregationManager');
const aggregatedData = ref(null);
const subscriberId = `agg-widget-${Math.random().toString(36).substring(7)}`;

// Defining exact payload shape required by backend Java struct
const testAggregation = {
  key: "globalConsumptionEnergyTest",
  channels: config.meters.map(m => `${m.edgeParent}/${m.name}/${config.meterChannels.activeEnergyChannel.name}`),
  channelType: "energy",
  channelsAggregationType: "sum",
  periodAggregation: {
    period: "Day"
  }
};

onMounted(() => {
  if (aggregationManager) {
    console.log(`[AggTestWidget] Registering historical query`);
    
    aggregationManager.register(
      subscriberId,
      [testAggregation], 
      (dataMap) => {
        // dataMap will contain our specific key mapping to the result array
        if (dataMap["globalConsumptionEnergyTest"] !== undefined) {
          aggregatedData.value = dataMap["globalConsumptionEnergyTest"];
        }
      }
    );
  }
});

onUnmounted(() => {
  if (aggregationManager) {
    aggregationManager.unregister(subscriberId);
  }
});
</script>
