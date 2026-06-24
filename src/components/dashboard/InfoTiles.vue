<template>
  <div class="mb-4 grid grid-cols-12 gap-4">
    <!-- ───────────────────────── Electricity (animated) ───────────────────────── -->
    <div class="col-span-6 fade-container border-gray-600 border px-4 py-2.5 rounded-lg gap-1.5 flex flex-col">
      <div class="flex gap-2 items-center">
        <div class="bg-blue-800 w-[36px] h-[36px] flex items-center justify-center rounded-lg shrink-0">
          <i class="bi bi-lightning-charge text-blue-400 text-[20px] text-bold"></i>
        </div>
        <div>
          <p class="p-0 m-0 text-[18px] text-gray-400 font-bold leading-tight"><span>Electricity</span></p>
          <span class="text-[12px] m-0 p-0 text-gray-500">{{ rangeLabel }}</span>
        </div>
      </div>

      <!-- Consumption row -->
      <div class="grid grid-cols-12 items-center">
        <div class="col-span-5">
          <span class="text-[14px]">Consumption</span>
        </div>
        <div class="col-span-5">
          <!-- loading skeleton -->
          <div v-if="loadingConsumption" class="h-5 w-28 animate-pulse bg-gray-700 rounded"></div>

          <!-- animated value -->
          <p v-else class="text-[16px] font-bold m-0">
            {{ formatNum(displayConsumptionVal, displayDecimals, displayDecimals) }}
            <span class="text-[12px] ml-1 text-gray-500">{{ displayConsumptionUnit }}</span>
          </p>
        </div>
        <div class="col-span-2">
          <span v-if="!loadingConsumption" :class="pctMovement >= 0 ? 'text-red-500' : 'text-green-500'" class="text-[12px]">
            {{ isAnchoredPeriod ? '--- %' : signedPct(pctMovement) }}
          </span>
          <div v-else class="h-4 w-10 animate-pulse bg-gray-700 rounded"></div>
        </div>
      </div>

      <!-- Cost row -->
      <div class="grid grid-cols-12 items-center">
        <div class="col-span-5">
          <span class="text-[13px]">Cost</span>
        </div>
        <div class="col-span-5">
          <span class="text-[13px] font-bold">{{ formatNum(displayCostVal, displayCostDecimals, displayCostDecimals) }} <span class="text-[12px] ml-1 text-gray-500">{{ displayCostUnit }}</span></span>
        </div>
        <div class="col-span-2">
          <span :class="pctCostMovement >= 0 ? 'text-red-500' : 'text-green-500'" class="text-[12px]">{{ isAnchoredPeriod ? '--- %' : signedPct(pctCostMovement) }}</span>
        </div>
      </div>

      <img :src="getImagePath(pctMovement)" alt="Background image" class="fade-image" />
    </div>

    <!-- ===================================== -->

    <div class="col-span-6 relative fade-container border-gray-600 border px-4 py-2.5 rounded-lg gap-1.5 flex flex-col">
      <div class="flex gap-2 items-center">
        <div class="bg-orange-900 w-[36px] h-[36px] flex items-center justify-center rounded-lg shrink-0">
          <i class="text-orange-400 text-[16px] text-bold">CO₂</i>
        </div>
        <div>
          <p class="p-0 m-0 text-[18px] text-gray-400 font-bold leading-tight"><span>CO2 Emissions</span></p>
          <span class="text-[12px] m-0 p-0 text-gray-500">{{ rangeLabel }}</span>
        </div>
      </div>

      <div class="grid grid-cols-12 items-center">
        <div class="col-span-7">
          <p class="text-[14px] m-0">Total Emissions <span :class="pctCO2Movement >= 0 ? 'text-red-500' : 'text-green-500'" class="text-[12px] ml-2">{{ isAnchoredPeriod ? '--- %' : signedPct(pctCO2Movement) }}</span></p>
          <p class="text-[16px] font-bold m-0">{{ formatNum(displayCO2Val, displayCO2Decimals, displayCO2Decimals) }} <span class="text-[12px] ml-1 text-gray-500">{{ displayCO2Unit }}</span></p>
        </div>
        <div class="col-span-5">
          <div class="absolute right-0 bottom-0">
            <PictorialBar
              :seriesData="co2ChartSeries"
              height="100%"
              primaryColor="#e54035"
            />
          </div>
        </div>
      </div>

      <img :src="getImagePath(pctCO2Movement)" alt="Background image" class="fade-image" />
    </div>
  </div>
</template>

<script setup>
/**
 * @component InfoTiles
 * @description UI Component for InfoTiles.
 *
 */

import { computed, onMounted, onUnmounted, ref, watch, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/store/dashboard'
import { useTenantStore } from '@/store/tenant'
import { config } from '@/config/config'
import PictorialBar from '@/components/charts/PictorialBar.vue'
import { formatNum, signedPct, formatValue } from '@/utils/formatting'
import { getAddressesForNode } from '@/utils/configHelper'

const dashboardStore = useDashboardStore()
const tenantStore = useTenantStore()
const { range, rangeLabel, hierarchyLevel } = storeToRefs(dashboardStore)

// Injected Managers
const aggregationManager = inject('aggregationManager')
const subscriberId = `info-tiles-${Math.random().toString(36).substring(7)}`

// ─── Reactive state for Electricity ─────────────────────────
const loadingConsumption = ref(true)
const pctMovement = ref(1)        // Hardcoded to 1% as per user request
const pctCostMovement = ref(1)    // Hardcoded to 1%

const displayConsumptionVal = ref(0)
const displayConsumptionUnit = ref('kWh')
const displayDecimals = ref(2)
const displayCostVal = ref(0)
const displayCostUnit = ref('MAD')
const displayCostDecimals = ref(2)

// ─── State for CO2 ───
const pctCO2Movement = ref(1)     
const displayCO2Val = ref(0)
const displayCO2Unit = ref('kg')
const displayCO2Decimals = ref(2)
const co2ChartSeries = ref([])

// ─── Anchored Period Helper (Percentage Deactivation) ───
const isAnchoredPeriod = computed(() => ['TODAY', 'THIS_MONTH'].includes(range.value))

// ─── Image Path Helper ───────────────────────────────────────────
function getImagePath(percentage) {
  return percentage >= 0 
    ? new URL('@/assets/images/down.png', import.meta.url).href 
    : new URL('@/assets/images/up.png', import.meta.url).href
}

// ─── Live Data Fetching ───────────────────────────────────────────
function fetchLiveData() {
  if (!aggregationManager) return;
  
  loadingConsumption.value = true;
  
  const backendPeriod = range.value;

  // Resolve the global node using the priority lookup:
  //   1. level -1 (virtual global level) — canonical, preferred
  //   2. any node with isGlobal: true on a regular level — legacy fallback
  const currentHierarchy = tenantStore.selectedHierarchy;

  const virtualLevel = currentHierarchy.find(h => h.level === -1);
  const globalNode = virtualLevel?.nodes?.[0]
    ?? currentHierarchy.flatMap(h => h.nodes).find(n => n.isGlobal)
    ?? null;

  const targetNodes = globalNode ? [globalNode] : [];

  if (targetNodes.length === 0) {
    loadingConsumption.value = false;
    displayConsumptionVal.value = 0;
    displayCostVal.value = 0;
    displayCO2Val.value = 0;
    return;
  }
  
  const energyChannels = [];
  const costChannels = [];
  const emissionsChannels = [];

  targetNodes.forEach(node => {
    energyChannels.push(...getAddressesForNode(node, config.meterChannels.activeEnergyChannel.name));
    costChannels.push(...getAddressesForNode(node, config.meterChannels.activeEnergyCostChannel.name));
    emissionsChannels.push(...getAddressesForNode(node, config.meterChannels.activeEnergyEmissionsChannel.name));
  });

  // Electricity Energy Aggregation
  const energyAgg = {
    key: "tilesGlobalElectricityEnergy",
    channels: energyChannels,
    channelType: "energy",
    channelsAggregationType: "sum",
    periodAggregation: {
      period: backendPeriod
    }
  };

  // Electricity Cost Aggregation
  const costAgg = {
    key: "tilesGlobalElectricityCost",
    channels: costChannels,
    channelType: "cost",
    channelsAggregationType: "sum",
    periodAggregation: {
      period: backendPeriod
    }
  };

  // Emissions Aggregation
  const emissionsAgg = {
    key: "tilesGlobalEmissions",
    channels: emissionsChannels,
    channelType: "emissions",
    channelsAggregationType: "sum",
    periodAggregation: {
      period: backendPeriod
    }
  };

  aggregationManager.register(
    subscriberId,
    [energyAgg, costAgg, emissionsAgg], 
    (dataMap) => {
      // Handle Energy
      if (dataMap["tilesGlobalElectricityEnergy"] !== undefined) {
        const energyData = dataMap["tilesGlobalElectricityEnergy"];
        let totalEnergyWh = energyData?.value || 0;
        pctMovement.value = energyData?.movementPercentage || 0;
        
        const scaled = formatValue(totalEnergyWh, config.meterChannels.activeEnergyChannel.unit);
        displayConsumptionVal.value = scaled.value;
        displayConsumptionUnit.value = scaled.unit;
        displayDecimals.value = scaled.decimals;
      }
      
      // Handle Cost
      if (dataMap["tilesGlobalElectricityCost"] !== undefined) {
        const costData = dataMap["tilesGlobalElectricityCost"];
        let totalCost = costData?.value || 0;
        pctCostMovement.value = costData?.movementPercentage || 0;
        
        const scaled = formatValue(totalCost, config.meterChannels.activeEnergyCostChannel.unit);
        displayCostVal.value = scaled.value;
        displayCostUnit.value = scaled.unit;
        displayCostDecimals.value = scaled.decimals;
      }

      // Handle Emissions
      if (dataMap["tilesGlobalEmissions"] !== undefined) {
        const emissionsData = dataMap["tilesGlobalEmissions"];
        let totalEmissions = emissionsData?.value || 0;
        pctCO2Movement.value = emissionsData?.movementPercentage || 0;
        
        const scaled = formatValue(totalEmissions, config.meterChannels.activeEnergyEmissionsChannel.unit);
        displayCO2Val.value = scaled.value;
        displayCO2Unit.value = scaled.unit;
        displayCO2Decimals.value = scaled.decimals;
      }
      
      loadingConsumption.value = false;
    }
  );
}

onMounted(() => {
  fetchLiveData();
})

onUnmounted(() => {
  aggregationManager?.unregister(subscriberId);
})

// Re-register if the user toggles the global range (day/week/month), hierarchy level, or tenant
watch([range, hierarchyLevel, () => tenantStore.selectedTenantId], () => {
  aggregationManager?.unregister(subscriberId);
  fetchLiveData();
})
</script>

<style scoped>
.fade-container {
  position: relative;
  width: 100%;
  /* height: 300px; */
  overflow: hidden;
}

.fade-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -99;
  mask-image: linear-gradient(to right, 
    transparent 0%, 
    rgba(0, 0, 0, 0.3) 50%, 
    rgba(0, 0, 0, 1) 70%
  );
  -webkit-mask-image: linear-gradient(to right, 
    transparent 0%, 
    rgba(0, 0, 0, 0.0) 50%, 
    rgba(0, 0, 0, 0.3) 70%
  );
}

.content {
  position: relative;
  z-index: 2;
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>