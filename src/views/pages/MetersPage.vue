<script setup>
/**
 * @component MetersPage
 * @description UI Component for MetersPage.
 *
 */

import { ref, computed } from 'vue';
// import { useRoute } from 'vue-router';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
// import VChart from 'vue-echarts';
// import DataTable from 'primevue/datatable';
// import Column from 'primevue/column';
import EnergyConsumptionHistory from '@/components/meters/MeterEnergyHistroy.vue';
import RealTimeMeterData from '@/components/meters/RealTimeMeterData.vue';
import MeterAlerts from '@/components/meters/MeterAlerts.vue';
import MeterSelector from '@/components/meters/MeterSelector.vue';
// ✅ Import new components
import MeterReadingsTable from '@/components/meters/MeterReadingsTable.vue';
import RealTimePhaseAnalysis from '@/components/meters/RealTimePhaseAnalysis.vue';
import { useSelectedMeter } from '@/composables/useSelectedMeter.js';


use([CanvasRenderer, PieChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent]);

// const route = useRoute();

// Resolve the selected meter from config via route param
const { selectedMeter, edgeId, componentName, channelPrefix, isQueryableEdge } = useSelectedMeter();

// Numeric index extracted from componentName (e.g. 'meter0' → 0).
// Passed to MeterReadingsTable for TrendModal compatibility.
const meterIndex = computed(() => {
    const match = componentName.value.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 0;
});

// Latest reading received from MeterReadingsTable (keep for table)
const latestReading = ref(null);

// Active tab for the phase analysis section
const activePhaseTab = ref('phasor');

// Ref to the energy chart component — used to read activeTab / TABS
const energyChartRef = ref(null);

// Dynamic title based on the active tab
const energyChartActiveTab = ref('energy');
const energyTitleMap = {
    energy:    'Energy Consumption',
    cost:      'Energy Consumption Cost',
    emissions: 'Energy Consumption Emissions'
};
const energyChartTitle = computed(() => energyTitleMap[energyChartActiveTab.value] ?? 'Energy Consumption');

// CSV download function
const downloadCSV = (type) => {
    const csvContent = 'Timestamp,Value\n' + new Date().toISOString() + ',0\n' + new Date(Date.now() - 3600000).toISOString() + ',0\n';

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}-data.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
</script>

<template>
    <div class="min-h-screen text-white p-6">
        <!-- Meter Selection -->
        <MeterSelector />

        <!-- Stats Cards Row -->
        <div class="mb-6">
            <RealTimeMeterData />
        </div>

        <!-- Charts Row -->
        <div class="grid grid-cols-12 gap-6 mb-6">
            <!-- Monthly Energy Chart -->
            <div class="col-span-8 border border-gray-600 rounded-lg p-6">
                <!-- Tab selector — above the title -->
                <div class="flex gap-1 mb-3">
                    <button
                        v-for="tab in energyChartRef?.TABS ?? []"
                        :key="tab.id"
                        @click="energyChartRef.activeTab = tab.id"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150"
                        :style="energyChartActiveTab === tab.id
                            ? { background: tab.color + '22', color: tab.color, border: '1px solid ' + tab.color + '66' }
                            : { background: 'transparent', color: '#6b7280', border: '1px solid #374151' }"
                    >
                        <i :class="['bi', tab.icon, 'text-[11px]']"></i>
                        {{ tab.label }}
                    </button>
                </div>

                <div class="flex items-baseline justify-between mb-4">
                    <div class="flex items-baseline">
                        <i class="bi bi-bar-chart text-orange-500 text-xl mr-3"></i>
                        <h3 class="font-semibold">{{ energyChartTitle }}</h3>
                    </div>
                    <button @click="downloadCSV('energy-consumption')" class="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                        <i class="bi bi-download text-xs"></i>
                        Save CSV
                    </button>
                </div>
                <div class="h-80">
                    <EnergyConsumptionHistory
                        ref="energyChartRef"
                        :edge-id="edgeId"
                        :channel-prefix="channelPrefix"
                        :chart-type="'energy'"
                        @update:activeTab="energyChartActiveTab = $event"
                    />
                </div>
            </div>
            

            <!-- Phase Analysis (Load Distribution & Phasor) -->
            <div class="col-span-4 border border-gray-600 rounded-lg p-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-baseline">
                        <i class="bi bi-pie-chart text-orange-500 text-xl mr-3"></i>
                        <h3 class="font-semibold">{{ activePhaseTab === 'distribution' ? 'Load Distribution' : 'Phasor Diagram' }}</h3>
                    </div>
                    <div class="flex bg-gray-800 rounded p-1">
                        <button 
                            @click="activePhaseTab = 'distribution'" 
                            class="px-2 py-0.5 text-[10px] rounded transition-all duration-200"
                            :class="activePhaseTab === 'distribution' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-gray-200'"
                        >
                            PIE
                        </button>
                        <button 
                            @click="activePhaseTab = 'phasor'" 
                            class="px-2 py-0.5 text-[10px] rounded transition-all duration-200"
                            :class="activePhaseTab === 'phasor' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-gray-200'"
                        >
                            PHASOR
                        </button>
                    </div>
                </div>
                <!-- Real-time Phase Analysis Component (Isolated) -->
                <RealTimePhaseAnalysis 
                    :edge-id="edgeId"
                    :component-name="componentName"
                    :is-queryable="isQueryableEdge"
                    :active-phase-tab="activePhaseTab"
                />
            </div>
        </div>

        <!-- Bottom Row -->
        <div class="grid grid-cols-12 gap-6">
            <!-- Power Fluctuation -->
            <div class="col-span-8 border border-gray-600 rounded-lg p-6">
                <div class="flex items-baseline justify-between mb-4">
                    <div class="flex items-baseline">
                        <i class="bi bi-lightning text-orange-500 text-xl mr-3"></i>
                        <div>
                            <h3 class="font-semibold">Power Fluctuation Over Time</h3>
                            <p class="text-sm text-gray-400">Detailed power kW demand over time</p>
                        </div>
                    </div>
                    <button @click="downloadCSV('power-fluctuation')" class="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                        <i class="bi bi-download text-xs"></i>
                        Save CSV
                    </button>
                </div>
                <div class="h-64">
                    <EnergyConsumptionHistory :edge-id="edgeId" :channels="[`${channelPrefix}ActivePower`]" :chart-type="'power'" />
                </div>
            </div>

            <!-- Meter Alerts -->
            <div class="col-span-4 border border-gray-600 rounded-lg p-6">
                <MeterAlerts :meter-id="selectedMeter?.reference ?? null" />
            </div>
        </div>

        <!-- Live Meter Readings Table -->
        <div class="mt-6">
            <MeterReadingsTable :channel-prefix="channelPrefix" :edge-id="edgeId" :meter-index="meterIndex" @update:latestReading="latestReading = $event" />
        </div>
    </div>
</template>

<style>
.custom-table {
    background: transparent;
}

.custom-table .p-datatable-table {
    background: transparent;
}

.custom-table .p-datatable-thead > tr > th {
    background: #374151;
    color: #9ca3af;
    border: 1px solid #4b5563;
}

.custom-table .p-datatable-tbody > tr > td {
    background: transparent;
    color: #d1d5db;
    border: 1px solid #4b5563;
}

.custom-table .p-datatable-tbody > tr:hover {
    background: #374151;
}

.p-dropdown {
    background: #ea580c !important;
    border: 1px solid #ea580c !important;
}

.p-dropdown .p-dropdown-label {
    color: white !important;
}
</style>
