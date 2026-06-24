<template>
  <div class="w-full h-full p-2 overflow-y-auto custom-scroll">
    <div v-if="loading" class="flex justify-center items-center h-full text-gray-400 text-sm">
      <i class="pi pi-spin pi-spinner mr-2"></i> Loading...
    </div>
    
    <div v-else class="flex flex-col gap-2">
      <!-- Header Row -->
      <div class="grid grid-cols-12 text-xs text-gray-500 font-semibold border-b border-gray-700 pb-1 mb-1 px-1">
        <div class="col-span-12 mb-1">Source</div>
        <div class="col-span-6 flex items-center gap-1 text-green-500">MAD Cost</div>
        <div class="col-span-6 flex items-center gap-1 text-orange-400"><i>CO₂</i></div>
      </div>

      <!-- Meter Rows -->
      <div 
        v-for="(row, i) in tableData" 
        :key="i"
        class="bg-slate-800/50 hover:bg-slate-700/50 transition-colors rounded p-2 text-sm flex flex-col gap-1 border border-transparent hover:border-gray-600"
      >
        <div class="font-bold text-gray-300 text-[13px] truncate" :title="row.title">
          {{ row.title }}
        </div>
        <div class="grid grid-cols-12 text-[12px]">
          <div class="col-span-6 font-mono text-gray-400">
            {{ formatNum(row.costVal, row.costDec, row.costDec) }} <span class="text-[10px]">{{ row.costUnit }}</span>
          </div>
          <div class="col-span-6 font-mono text-gray-400">
            {{ formatNum(row.co2Val, row.co2Dec, row.co2Dec) }} <span class="text-[10px]">{{ row.co2Unit }}</span>
          </div>
        </div>
      </div>
      
      <!-- Fallback empty state -->
      <div v-if="tableData.length === 0" class="text-center text-gray-500 text-xs mt-4">
        No active meters
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * @component CostAndCo2
 * @description UI Component for CostAndCo2.
 *
 */

import { ref, onMounted, onUnmounted, watch, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/store/dashboard'
import { useTenantStore } from '@/store/tenant'
import { config } from '@/config/config'
import { formatValue, formatNum } from '@/utils/formatting'
import { getAddressesForNode } from '@/utils/configHelper'

const dashboardStore = useDashboardStore()
const tenantStore = useTenantStore()
const { range, hierarchyLevel } = storeToRefs(dashboardStore)

const aggregationManager = inject('aggregationManager')
const subscriberId = `cost-co2-table-${Math.random().toString(36).substring(7)}`

const loading = ref(true)
const tableData = ref([])

function fetchLiveData() {
  if (!aggregationManager) return;
  
  loading.value = true;
  const backendPeriod = range.value;
  
  const currentHierarchy = tenantStore.selectedHierarchy;
  const currentLevel = currentHierarchy.find(h => h.level === hierarchyLevel.value) || currentHierarchy[0];

  if (!currentLevel) {
    tableData.value = [];
    loading.value = false;
    return;
  }
  
  const aggregations = [];
  
  currentLevel.nodes.forEach(node => {
    // We register two aggregations per node: one for Cost, one for Emissions
    aggregations.push({
      key: `table_cost_node_${node.id}`,
      channels: getAddressesForNode(node, config.meterChannels.activeEnergyCostChannel.name),
      channelType: "cost",
      channelsAggregationType: "sum",
      periodAggregation: { period: backendPeriod }
    });
    
    aggregations.push({
      key: `table_co2_node_${node.id}`,
      channels: getAddressesForNode(node, config.meterChannels.activeEnergyEmissionsChannel.name),
      channelType: "emissions",
      channelsAggregationType: "sum",
      periodAggregation: { period: backendPeriod }
    });
  });

  aggregationManager.register(
    subscriberId,
    aggregations, 
    (dataMap) => {
      const newTableData = [];

      currentLevel.nodes.forEach(node => {
        const costKey = `table_cost_node_${node.id}`;
        const co2Key  = `table_co2_node_${node.id}`;
        
        let costSum = 0;
        let co2Sum = 0;

        // Extract Cost Sum
        if (dataMap[costKey] !== undefined) {
          costSum = dataMap[costKey]?.value || 0;
        }
        
        // Extract CO2 Sum
        if (dataMap[co2Key] !== undefined) {
          co2Sum = dataMap[co2Key]?.value || 0;
        }

        const scaledCost = formatValue(costSum, config.meterChannels.activeEnergyCostChannel.unit);
        const scaledCo2 = formatValue(co2Sum, config.meterChannels.activeEnergyEmissionsChannel.unit);
        
        newTableData.push({
          title: node.name,
          costVal: scaledCost.value,
          costUnit: scaledCost.unit,
          costDec: scaledCost.decimals,
          co2Val: scaledCo2.value,
          co2Unit: scaledCo2.unit,
          co2Dec: scaledCo2.decimals
        });
      });

      tableData.value = newTableData;
      loading.value = false;
    }
  );
}

onMounted(() => {
  fetchLiveData()
})

onUnmounted(() => {
  aggregationManager?.unregister(subscriberId);
})

watch([range, hierarchyLevel, () => tenantStore.selectedTenantId], () => {
  aggregationManager?.unregister(subscriberId);
  fetchLiveData();
})
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar {
  width: 4px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background-color: #4b5563;
  border-radius: 4px;
}
</style>