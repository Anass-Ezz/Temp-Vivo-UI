<script setup>
/**
 * @component MeterSelector
 * @description Renders a dropdown UI allowing navigation across configured metering devices.
 * Dynamically resolves edge configuration to derive the contextual layout, displaying active alarms.
 */

import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import Dropdown from 'primevue/dropdown';
import { config } from '@/config/config.js';
import { useMeterAlertCounts } from '@/composables/useMeterAlertCounts.js';

const router = useRouter();
const route = useRoute();

// Dropdown options come from config; fullReference is the display label
const meters = config.meters;

const selectedMeter = ref(null);

// Find the config entry matching the current route param
const currentMeter = computed(() => {
    const ref = route.params.meterReference;
    return config.meters.find((m) => m.reference === ref) ?? config.meters[0];
});

// Header card info derived from config
const meterInfo = computed(() => {
    if (!currentMeter.value) return { name: 'Select a Meter', code: '—', location: '—', type: '—' };
    return {
        name: currentMeter.value.fullReference,
        code: currentMeter.value.reference,
        location: currentMeter.value.location || 'Usine CHIBA',
        type: currentMeter.value.type || '3-Phase'
    };
});

// Use reference directly as ID for alert lookups
const legacyId = computed(() => {
    return currentMeter.value?.reference ?? 'default';
});

// Reactive image path based on config property
const meterImage = computed(() => {
    const imageName = currentMeter.value?.image || 'default.png';
    // Use the /src/ path for Vite dynamic URL resolution
    return new URL(`/src/assets/images/devices/${imageName}`, import.meta.url).href;
});

// ✅ Fallback if image fails
/**
 * Event handler triggered when a dynamically injected device image fails to load.
 * Overrides the `src` attribute with a safe default image representation.
 * 
 * @param {Event} e - Native DOM Error Event from the img tag.
 */
function fallbackToDefaultImage(e) {
    e.target.src = new URL('/src/assets/images/devices/I-30.png', import.meta.url).href;
}

// ✅ Preload images on mount
onMounted(() => {
    // Collect all unique images from config
    const uniqueImages = [...new Set(config.meters.map(m => m.image).filter(Boolean))];
    uniqueImages.forEach((imgName) => {
        const src = new URL(`/src/assets/images/devices/${imgName}`, import.meta.url).href;
        const img = new Image();
        img.src = src;
    });
});

const { faultCount, warningCount } = useMeterAlertCounts();

const faultBadgeAnimate = ref(false);
const warningBadgeAnimate = ref(false);

watch(faultCount, () => {
    faultBadgeAnimate.value = true;
    setTimeout(() => { faultBadgeAnimate.value = false; }, 400);
});

watch(warningCount, () => {
    warningBadgeAnimate.value = true;
    setTimeout(() => { warningBadgeAnimate.value = false; }, 400);
});

// Sync dropdown selection when route changes
watch(
    () => route.params.meterReference,
    (ref) => {
        selectedMeter.value = config.meters.find((m) => m.reference === ref) ?? config.meters[0] ?? null;
    },
    { immediate: true }
);

// Navigate to the selected meter's route on dropdown change
function onMeterChange() {
    if (selectedMeter.value) {
        router.push(`/meters/${encodeURIComponent(selectedMeter.value.reference)}`);
    }
}
</script>

<template>
    <div class="border border-gray-600 rounded-lg p-6 grid grid-cols-12 mb-6">
        <!-- Meter Selection -->
        <div class="col-span-2">
            <img :src="meterImage" alt="Meter Model" class="w-60 h-60 object-contain" @error="fallbackToDefaultImage" />
        </div>
        <div class="col-span-10">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-baseline">
                    <i class="bi bi-speedometer2 text-orange-500 text-xl mr-3"></i>
                    <h1 class="text-xl font-semibold">Meter Selection</h1>
                </div>
                <div class="flex items-center space-x-4">
                    <!-- ✅ Replaced dots with Bootstrap Icons -->
                    <span class="text-red-500 text-sm flex items-center">
                        <i class="bi bi-exclamation-circle text-red-500 mr-1"></i>
                        <span :class="['alert-count-badge', { 'badge-pulse': faultBadgeAnimate }]">{{ faultCount }}</span>
                    </span>
                    <span class="text-yellow-500 text-sm flex items-center">
                        <i class="bi bi-exclamation-triangle text-yellow-500 mr-1"></i>
                        <span :class="['alert-count-badge', { 'badge-pulse': warningBadgeAnimate }]">{{ warningCount }}</span>
                    </span>
                    <Dropdown v-model="selectedMeter" :options="meters" optionLabel="fullReference" placeholder="Select Meter" class="bg-orange-600 border-orange-600" @change="onMeterChange">
                        <template #value="slotProps">
                            <span class="text-white">
                                {{ slotProps.value ? slotProps.value.fullReference : 'Select Meter' }}
                            </span>
                        </template>
                    </Dropdown>
                </div>
            </div>

            <!-- Meter Info -->
            <div class="flex items-center justify-between bg-gray-800 bg-opacity-30 rounded p-4 border border-gray-700">
                <div class="flex items-center">
                    <div>
                        <h3 class="font-medium">{{ meterInfo.name }} <i class="bi bi-check2-circle text-green-500 text-xl mr-3"></i></h3>
                        <p class="text-sm text-gray-400">{{ meterInfo.code }} • {{ meterInfo.location }} • {{ meterInfo.type }}</p>
                    </div>
                </div>
                <!-- <div class="flex items-center space-x-8">
                    <div class="text-right">
                        <div class="text-green-500 font-bold">ONLINE</div>
                        <div class="text-xs text-gray-400">Status</div>
                    </div>
                    <div class="text-right">
                        <div class="text-white font-bold">Just now</div>
                        <div class="text-xs text-gray-400">Last Reading</div>
                    </div>
                </div> -->
            </div>
        </div>
    </div>
</template>

<style scoped>
.alert-count-badge {
  display: inline-block;
  transition: transform 0.2s ease;
}

@keyframes badge-pulse {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.4); }
  100% { transform: scale(1); }
}

.badge-pulse {
  animation: badge-pulse 0.4s ease;
}
</style>
