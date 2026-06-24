<template>
  <div class="card mb-0 shadow-2 border-round-xl p-4 surface-card flex flex-column gap-3">
    <div class="flex align-items-center justify-content-between">
      <span class="text-500 font-medium text-lg">{{ title }}</span>
      <i class="pi pi-bolt text-primary text-xl"></i>
    </div>
    
    <div class="flex align-items-end gap-2">
      <span class="text-4xl font-bold font-italic" :class="colorClass">
        {{ currentValue !== null ? currentValue.toFixed(2) : '--' }}
      </span>
      <span class="text-500 font-medium pb-1" v-if="currentValue !== null">kW</span>
    </div>
    
    <div class="text-sm flex align-items-center gap-2" :class="isStale ? 'text-orange-500' : (activeAlarm ? 'text-red-500' : 'text-green-500')">
      <i class="pi" :class="isStale ? 'pi-sync spin' : (activeAlarm ? 'pi-exclamation-triangle' : 'pi-check-circle')"></i>
      <span>
        {{ activeAlarm ? 'Threshold Alert Active' : (isStale ? 'Waiting for updates...' : 'Live Data Stream Active') }}
      </span>
    </div>
  </div>
</template>

<script setup>
/**
 * @component RealtimeDataWidget
 * @description UI Component for RealtimeDataWidget.
 *
 * @prop {any} title - Component property
 * @prop {any} type - Component property
 * @prop {any} required - Component property
 * @prop {any} address - Component property
 * @prop {any} type - Component property
 * @prop {any} required - Component property
 */

import { inject, ref, onMounted, onUnmounted, computed } from 'vue';
import { useChannelStatus } from '@/composables/useChannelStatus.js';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  address: {
    type: String, // e.g., "edge0/meter0/ActivePower"
    required: true
  }
});

const currentDataManager = inject('currentDataManager');
const currentValue = ref(null);
const lastUpdate = ref(null);

const { colorClass, status, isStale, activeAlarm } = useChannelStatus(computed(() => props.address), 'meter');

// Timer to force re-evaluation if needed (though useChannelStatus is reactive)
let intervalId = null;

const subscriberId = `widget-${props.address.replace(/\//g, '-')}-${Math.random().toString(36).substring(7)}`;

onMounted(() => {
  if (currentDataManager) {
    console.log(`[RealtimeDataWidget] Registering ${subscriberId} for Address: ${props.address}`);
    
    // Pass the single fully qualified address to the new manager architecture
    currentDataManager.register(
      subscriberId,
      [props.address], 
      (data) => {
        // The manager now maps data back to the full address requested!
        if (data[props.address] !== undefined) {
          currentValue.value = data[props.address];
          lastUpdate.value = Date.now();
        }
      }
    );
  } else {
    console.error('[RealtimeDataWidget] currentDataManager not provided! Make sure you are under App.vue hierarchy.');
  }

  // Check connection status every second to update the UI if data stops arriving
  intervalId = setInterval(() => {
    // Just trigger reactivity on the computed property by accessing a ref
    // The computed uses Date.now() which isn't reactive, so we need a fake reactive trigger
    // Actually, Vue computed won't auto-update on Date.now(). Let's use a trigger ref.
    ticker.value++;
  }, 1000);
});

const ticker = ref(0);
// Re-implement isConnected to be reactive to the ticker
const isConnectedComputed = computed(() => {
  // read ticker to create dependency
  const _ = ticker.value;
  return currentValue.value !== null && (Date.now() - (lastUpdate.value || 0) < 15000);
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
  
  if (currentDataManager) {
     console.log(`[RealtimeDataWidget] Unregistering ${subscriberId}`);
    currentDataManager.unregister(subscriberId);
  }
});
</script>

<style scoped>
.spin {
  animation: spin 2s linear infinite;
}
@keyframes spin {
  100% { transform: rotate(360deg); }
}
</style>
