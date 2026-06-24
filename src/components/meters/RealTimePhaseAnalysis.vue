<!-- src/components/meters/RealTimePhaseAnalysis.vue -->
<template>
  <div class="h-80">
    <LoadDistributionPie 
        v-if="activePhaseTab === 'distribution' && hasData"
        :phases="[aL1, aL2, aL3]"
        :unit="unitI"
    />
    <PhasorDiagram
        v-else-if="activePhaseTab === 'phasor' && hasData"
        :vMag="[vL1, vL2, vL3]"
        :iMag="[aL1, aL2, aL3]"
        :pf="[pf, pf, pf]"
        :pfSign="['lag', 'lag', 'lag']"
        :voltageIsLineToLine="false"
        :vUnit="unitV"
        :iUnit="unitI"
    />
    <!-- Show placeholder if no data -->
    <div v-else class="flex items-center justify-center h-full text-gray-500 text-sm">
        <div class="text-center">
            <i class="bi bi-cpu text-2xl mb-2 block opacity-20"></i>
            Waiting for live phase data...
        </div>
    </div>
  </div>
</template>

<script setup>
import LoadDistributionPie from '@/components/meters/LoadDistributionPie.vue';
import PhasorDiagram from '@/components/charts/PhasorChart.vue';
import { ref, watch, inject, onBeforeUnmount } from 'vue';
import { config } from '@/config/config';

const props = defineProps({
  edgeId: String,
  componentName: String,
  isQueryable: Boolean,
  activePhaseTab: String
});

const currentDataManager = inject('currentDataManager');
const SUBSCRIBER_ID = 'RealTimePhaseAnalysisSub';

const vL1 = ref(0);
const vL2 = ref(0);
const vL3 = ref(0);
const aL1 = ref(0);
const aL2 = ref(0);
const aL3 = ref(0);
const pf = ref(0);
const hasData = ref(false);

const unitV = config.meterChannels.voltageL1Channel.unit.replace('m', ''); // mV -> V
const unitI = config.meterChannels.currentL1Channel.unit.replace('m', ''); // mA -> A

function handleLivePhaseData(data) {
    const base = `${props.edgeId}/${props.componentName}/`;
    
    const getVal = (chan, div = 1000) => {
        const val = data[base + chan];
        return (val !== undefined) ? val / div : null;
    };

    const _vL1 = getVal(config.meterChannels.voltageL1Channel.name);
    const _vL2 = getVal(config.meterChannels.voltageL2Channel.name);
    const _vL3 = getVal(config.meterChannels.voltageL3Channel.name);
    const _aL1 = getVal(config.meterChannels.currentL1Channel.name);
    const _aL2 = getVal(config.meterChannels.currentL2Channel.name);
    const _aL3 = getVal(config.meterChannels.currentL3Channel.name);
    const _pfRaw = data[base + config.meterChannels.powerFactorChannel.name];

    if (_vL1 !== null) vL1.value = _vL1;
    if (_vL2 !== null) vL2.value = _vL2;
    if (_vL3 !== null) vL3.value = _vL3;
    if (_aL1 !== null) aL1.value = _aL1;
    if (_aL2 !== null) aL2.value = _aL2;
    if (_aL3 !== null) aL3.value = _aL3;
    if (_pfRaw !== undefined) pf.value = _pfRaw / 1000;
    
    hasData.value = true;
}

function subscribe() {
    if (!currentDataManager || !props.isQueryable || !props.edgeId || !props.componentName) return;
    
    const base = `${props.edgeId}/${props.componentName}/`;
    const channels = [
        base + config.meterChannels.voltageL1Channel.name,
        base + config.meterChannels.voltageL2Channel.name,
        base + config.meterChannels.voltageL3Channel.name,
        base + config.meterChannels.currentL1Channel.name,
        base + config.meterChannels.currentL2Channel.name,
        base + config.meterChannels.currentL3Channel.name,
        base + config.meterChannels.powerFactorChannel.name,
    ];

    currentDataManager.register(SUBSCRIBER_ID, channels, handleLivePhaseData);
}

watch(() => [props.edgeId, props.componentName, props.isQueryable], () => {
    hasData.value = false;
    currentDataManager?.unregister(SUBSCRIBER_ID);
    subscribe();
}, { immediate: true });

onBeforeUnmount(() => {
    currentDataManager?.unregister(SUBSCRIBER_ID);
});
</script>
