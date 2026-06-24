<template>
  <div class="grid">
    <div class="col-12">
      <div class="card mb-4 border-round-xl shadow-2">
        <div class="flex align-items-center gap-3">
          <i class="pi pi-server text-indigo-500 text-3xl"></i>
          <div>
            <h4 class="m-0 text-900 font-bold">Real-Time Data Test</h4>
            <p class="text-500 mb-0 mt-1">
              Verifying <code>CurrentDataManager</code> WebSocket stream for <b>edge0</b> and <b>edge1</b>.
            </p>
          </div>
        </div>
      </div>
    </div>
    
    <div v-for="(meter, index) in config.meters" :key="index" class="col-12 md:col-6">
      <RealtimeDataWidget 
        :title="`${meter.edgeParent} - ${meter.name} Active Power`" 
        :address="`${meter.edgeParent}/${meter.name}/${config.meterChannels.activePowerChannel.name}`" 
      />
    </div>
    
    <div class="col-12 mt-4">
      <AggregationTestWidget />
    </div>
    
    <div class="col-12 mt-4">
      <AggregationCostTestWidget />
    </div>
  </div>
</template>

<script setup>
/**
 * @component Dashboard2
 * @description UI Component for Dashboard2.
 *
 */

import RealtimeDataWidget from '@/the_components/RealtimeDataWidget.vue';
import AggregationTestWidget from '@/the_components/AggregationTestWidget.vue';
import AggregationCostTestWidget from '@/the_components/AggregationCostTestWidget.vue';
import { config } from '@/config/config';

// Nothing else is required here! The component self-registers and cleans up.
</script>
