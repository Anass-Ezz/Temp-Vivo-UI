<!-- src/components/meters/LoadDistributionPie.vue -->
<template>
  <div class="w-full h-full relative">
    <v-chart
      ref="chartRef"
      :option="chartOption"
      :autoresize="true"
      class="w-full h-full"
    />
    <div v-if="!hasData" class="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 text-gray-400 rounded-lg">
      No data available
    </div>
  </div>
</template>

<script setup>
/**
 * @component LoadDistributionPie
 * @description UI Component for LoadDistributionPie.
 *
 */

import { ref, computed, watch, shallowRef } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import VChart from 'vue-echarts'

use([
  CanvasRenderer,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

const props = defineProps({
  // Array of 3 numbers representing load (e.g., current or power) per phase
  phases: {
    type: Array,
    default: () => [0, 0, 0]
  },
  unit: {
    type: String,
    default: ''
  }
})

const chartRef = ref(null)

const hasData = computed(() => {
  return props.phases && props.phases.some(v => v > 0)
})

const processedData = computed(() => {
  const [p1, p2, p3] = props.phases.map(v => v || 0)
  const total = p1 + p2 + p3

  if (total === 0) {
    return [
      { value: 0, name: 'Phase 1', itemStyle: { color: '#f97316' } },
      { value: 0, name: 'Phase 2', itemStyle: { color: '#06b6d4' } },
      { value: 0, name: 'Phase 3', itemStyle: { color: '#10b981' } }
    ]
  }

  return [
    { value: parseFloat(((p1 / total) * 100).toFixed(1)), rawValue: p1, name: 'Phase 1', itemStyle: { color: '#f97316' } },
    { value: parseFloat(((p2 / total) * 100).toFixed(1)), rawValue: p2, name: 'Phase 2', itemStyle: { color: '#06b6d4' } },
    { value: parseFloat(((p3 / total) * 100).toFixed(1)), rawValue: p3, name: 'Phase 3', itemStyle: { color: '#10b981' } }
  ]
})

const chartOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: '#374151',
    borderColor: '#6b7280',
    textStyle: {
      color: '#ffffff'
    },
    formatter: (params) => {
      const { name, value, data } = params
      return `<b>${name}</b><br/>Distribution: ${value}%<br/>Value: ${data.rawValue} ${props.unit}`
    }
  },
  series: [
    {
      type: 'pie',
      radius: ['50%', '70%'],
      center: ['50%', '50%'],
      data: processedData.value,
      label: {
        show: true,
        position: 'outside',
        formatter: '{b}: {c}%',
        fontSize: 12,
        color: '#ffffff',
      },
      labelLine: {
        show: true,
        length: 8,
        length2: 12,
        lineStyle: {
          color: '#ffffff',
          opacity: 0.6
        }
      },
      clockwise: true,
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#1f2937'
      },
      padAngle: 2,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      animation: true,
      animationDuration: 500
    }
  ]
}))

watch(processedData, (newData) => {
  if (chartRef.value) {
    chartRef.value.setOption({
      series: [{ data: newData }]
    })
  }
})
</script>

  
  <style scoped>
  /* Add scoped styles if needed later */
  </style>