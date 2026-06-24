<template>
    <div class="flex items-center justify-between w-full mb-4">
        <HierarchyToggle />
        <RangeToggle />
    </div>
    
    <div class="">        
        <InfoTiles />

        <!-- Row 2: Energy Pie (2/3) + Cost & CO2 (1/3) -->
        <div class="grid grid-cols-12 mb-5 gap-4" style="height: 380px; min-height: 380px; max-height: 380px; overflow: hidden;">
            <div class="col-span-8 flex flex-col" style="height: 380px; min-height: 0;">
                <p class="text-xl font-bold m-0 mb-2 flex gap-2 flex-shrink-0">
                    Energy Consumption 
                    <span class="text-[14px] text-gray-400 bg-slate-800 px-1 rounded-lg transition-all duration-300">
                        {{ dashboardStore.rangeLabel }}
                    </span>
                </p>
                <div class="border border-gray-600 rounded-lg overflow-hidden flex-1 min-h-0">
                    <EnergyPie />
                </div>
            </div>
            <div class="col-span-4 flex flex-col" style="height: 380px; min-height: 0;">
                <p class="text-[17px] font-bold m-0 mb-2 flex gap-1 items-center flex-shrink-0">
                    Cost & CO2
                    <span class="text-[12px] text-gray-400 bg-slate-800 px-1 rounded-lg transition-all duration-300">
                        {{ dashboardStore.rangeLabel }}
                    </span>
                </p>
                <div class="border border-gray-600 rounded-lg overflow-hidden flex-1 min-h-0">
                    <CostAndCo2 />
                </div>
            </div>
        </div>

        <!-- Row 3: Power Flow full width -->
        <div class="mb-5 flex flex-col" style="height: 420px; min-height: 420px; max-height: 420px;">
            <p class="text-xl font-bold m-0 mb-2 flex gap-2 flex-shrink-0">
                Power Flow Live 
                <img 
                src="@/assets/images/RedDot.gif" 
                alt="Background image"
                class="h-[13px] mt-2"
                />
            </p>
            <div class="border border-gray-600 rounded-lg flex-1 min-h-0 overflow-hidden">
                <PowerFlowSankey />
            </div>
        </div>

        <div class="grid grid-cols-11 my-2">
            <hr class="col-span-5">
            <p class="col-span-1 text-center text-2xl font-bold">
                History
            </p>
            <hr class="col-span-5">
        </div>
        
        <div class="grid grid-cols-12 ">
            <div class="col-span-12 border border-gray-600 rounded-lg" >
                <EnergyHistogram :channels="[]" />
            </div>
        </div>
    </div>
</template>

<script setup>
/**
 * @component Dashboard
 * @description UI Component for Dashboard.
 *
 */

import { computed, ref } from 'vue'
import { useDashboardStore } from '@/store/dashboard'

import CostAndCo2 from '@/components/charts/CostAndCo2.vue'
import EnergyHistogram from '@/components/charts/EnergyHistogram.vue'
import EnergyPie from '@/components/charts/EnergyPie.vue'
import PowerFlowSankey from '@/components/charts/PowerFlowSankey.vue'
import InfoTiles from '@/components/dashboard/InfoTiles.vue'
import RangeToggle from '@/components/dashboard/RangeToggle.vue'
import HierarchyToggle from '@/components/dashboard/HierarchyToggle.vue'

const dashboardStore = useDashboardStore()
</script>