<template>
    <div class="flex items-center py-2 h-[54px]">
      <div class="range-toggle-container">
        <div class="range-toggle-wrapper">
          <!-- Fixed Enums (the first 3) -->
          <div 
            v-for="opt in fixedOptions" 
            :key="opt.value"
            @click="range = opt.value"
            class="range-toggle-label"
            :class="{ 'active': range === opt.value }"
          >
            {{ opt.label }}
          </div>

          <!-- Dynamic Selection Slot (4th) -->
          <div 
            class="range-toggle-label dynamic-slot"
            :class="{ 'active': isDynamicSelected }"
            @click="handleDynamicSlotClick"
          >
            <Dropdown 
              v-model="selectedDynamic" 
              :options="dynamicOptions" 
              optionLabel="label" 
              @change="onDynamicChange"
              class="range-dropdown"
              :placeholder="selectedDynamic.label"
            >
               <template #value="slotProps">
                  <div v-if="slotProps.value" class="flex align-items-center">
                      <div>{{ slotProps.value.label }}</div>
                  </div>
                  <span v-else>
                      {{ slotProps.placeholder }}
                  </span>
              </template>
            </Dropdown>
          </div>
        </div>
      </div>
    </div>
</template>
  
<script setup>
/**
 * @component RangeToggle
 * @description UI Component for RangeToggle.
 *
 */

import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/store/dashboard'
import Dropdown from 'primevue/dropdown'
  
const dashboardStore = useDashboardStore()
const { range } = storeToRefs(dashboardStore)
  
const fixedOptions = [
  { label: '24H', value: 'LAST_24_HOURS' },
  { label: '7D', value: 'LAST_7_DAYS' },
  { label: '30D', value: 'LAST_30_DAYS' },
]

const dynamicOptions = [
  { label: 'Today', value: 'TODAY' },
  { label: 'This Month', value: 'THIS_MONTH' }
]

const selectedDynamic = ref(dynamicOptions[0])

const isDynamicSelected = computed(() => {
  return dynamicOptions.some(opt => opt.value === range.value)
})

function handleDynamicSlotClick() {
  range.value = selectedDynamic.value.value
}

function onDynamicChange(event) {
  range.value = event.value.value
}

// Ensure the dropdown shows the correct label if the range is changed elsewhere (though unlikely)
watch(range, (newRange) => {
  const matchingDynamic = dynamicOptions.find(opt => opt.value === newRange)
  if (matchingDynamic) {
    selectedDynamic.value = matchingDynamic
  }
}, { immediate: true })

</script>
  
<style scoped>
.range-toggle-wrapper {
  position: relative;
  display: inline-flex;
  background: #1e293b;
  border-radius: 10px;
  padding: 4px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
  height: 46px;
  align-items: center;
}

.range-toggle-label {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  padding: 0 16px;
  height: 38px;
  font-size: 13px;
  font-weight: 500;
  color: #94a3b8;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  white-space: nowrap;
  z-index: 1;
}

.range-toggle-label:hover:not(.active) {
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.05);
}

.range-toggle-label.active {
  color: #f8fafc;
  background: #334155;
  font-weight: 600;
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.2),
    0 1px 2px rgba(0, 0, 0, 0.15),
    inset 0 0 0 1px rgba(148, 163, 184, 0.1);
  transform: translateY(-1px);
}

.dynamic-slot {
  min-width: 120px;
  padding-right: 12px;
}

/* Override PrimeVue Dropdown styles to blend in */
:deep(.range-dropdown) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: inherit !important;
  font-size: inherit !important;
  font-weight: inherit !important;
  width: 100%;
}

:deep(.range-dropdown .p-dropdown-label) {
  padding: 0 !important;
  color: inherit !important;
  text-align: center;
}

:deep(.range-dropdown .p-dropdown-trigger) {
  width: 2rem !important;
}

:deep(.p-dropdown-panel) {
  background: #1e293b !important;
  border: 1px solid #334155 !important;
  color: #f8fafc !important;
}

:deep(.p-dropdown-panel .p-dropdown-item) {
  color: #94a3b8 !important;
  font-size: 13px !important;
  padding: 8px 12px !important;
}

:deep(.p-dropdown-panel .p-dropdown-item.p-highlight) {
  background: #334155 !important;
  color: #f8fafc !important;
}

:deep(.p-dropdown-panel .p-dropdown-item:not(.p-highlight):not(.p-disabled):hover) {
  background: #2d3a4f !important;
  color: #f8fafc !important;
}
</style>