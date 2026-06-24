<template>
  <div class="interval-picker-container">
    <div class="display-box" @click="op.toggle($event)">
      <i class="bi bi-clock-history mr-2 text-sky-400"></i>
      <span class="display-text">
        Live: <b class="text-white">{{ aggregationInterval?.label || 'Off' }}</b> 
        <span class="mx-2 opacity-30">|</span> 
        Hist: <b class="text-white">{{ historyInterval?.label || 'Off' }}</b>
      </span>
      <i class="pi pi-chevron-down ml-3 text-xs opacity-50"></i>
    </div>

    <OverlayPanel ref="op" class="interval-panel">
      <div class="p-3 flex flex-col gap-4 w-[240px]">
        <div>
          <label class="block text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">Live Interval</label>
          <Dropdown 
            v-model="aggregationInterval" 
            :options="intervalOptions" 
            optionLabel="label" 
            class="w-full h-[36px] items-center"
          />
        </div>
        
        <div class="border-t border-gray-700 pt-3">
          <label class="block text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">Histogram Interval</label>
          <Dropdown 
            v-model="historyInterval" 
            :options="intervalOptions" 
            optionLabel="label" 
            class="w-full h-[36px] items-center"
          />
        </div>
      </div>
    </OverlayPanel>
  </div>
</template>

<script setup>
/**
 * @component IntervalPicker
 * @description UI Component for IntervalPicker.
 *
 */

import { ref, inject } from 'vue'
import OverlayPanel from 'primevue/overlaypanel'
import Dropdown from 'primevue/dropdown'

const op = ref(null)

const aggregationInterval = inject('aggregationInterval')
const historyInterval = inject('historyInterval')

const intervalOptions = [
    { label: 'Off', value: 0 },
    { label: '5s', value: 5000 },
    { label: '1m', value: 60000 },
    { label: '5m', value: 300000 },
    { label: '15m', value: 900000 },
    { label: '1h', value: 3600000 }
]
</script>

<style scoped>
.display-box {
  display: flex;
  align-items: center;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 0 12px;
  height: 38px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.display-box:hover {
  border-color: #0ea5e9;
  background: #1e293b;
}

.display-text {
  color: #94a3b8;
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  white-space: nowrap;
}

:deep(.interval-panel) {
  background: #111827 !important;
  border: 1px solid #334155 !important;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4) !important;
}
</style>
