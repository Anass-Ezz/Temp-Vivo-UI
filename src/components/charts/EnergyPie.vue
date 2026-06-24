<template>
  <div class="energy-pie-wrapper w-full h-full flex items-stretch p-3 gap-3 overflow-hidden">

    <!-- ── Left: donut chart ── -->
    <div class="relative flex-shrink-0" style="width: 55%;">
      <div ref="pieContainer" class="w-full h-full"></div>

      <!-- Glowing centre overlay -->
      <div class="pie-center-overlay pointer-events-none">
        <div class="pie-center-inner">
          <span class="pie-total-value">{{ displayTotal }}</span>
          <span class="pie-total-unit">{{ totalUnit }}</span>
          <span class="pie-total-label">Total</span>
        </div>
      </div>
    </div>

    <!-- ── Right: custom legend ── -->
    <div class="legend-panel flex flex-col justify-center gap-1.5 overflow-y-auto custom-scroll flex-1 min-w-0 pr-1">
      <div
        v-for="(item, i) in legendItems"
        :key="item.name"
        class="legend-row"
        :class="{ 'legend-row--active': hoveredIndex === i }"
        @mouseenter="onLegendHover(i)"
        @mouseleave="onLegendLeave"
      >
        <!-- colour swatch -->
        <span class="legend-dot" :style="{ background: item.color }"></span>

        <!-- name -->
        <span class="legend-name truncate flex-1 min-w-0">{{ item.name }}</span>

        <!-- value + pct -->
        <div class="legend-stats">
          <span class="legend-value">{{ item.displayVal }}&thinsp;<span class="legend-unit">{{ item.unit }}</span></span>
          <span class="legend-pct" :style="{ color: item.color }">{{ item.pct }}%</span>
        </div>
      </div>

      <div v-if="legendItems.length === 0 && !loading" class="text-gray-500 text-xs text-center mt-4">
        No data available
      </div>
      <div v-if="loading" class="flex flex-col gap-2 mt-2">
        <div v-for="n in 4" :key="n" class="h-7 rounded-md animate-pulse bg-gray-700/60"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * @component EnergyPie
 * @description Donut chart showing energy consumption breakdown by source,
 *              with a custom interactive legend panel on the right.
 */

import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/store/dashboard'
import { useTenantStore } from '@/store/tenant'
import { config } from '@/config/config'
import { formatValue } from '@/utils/formatting'
import { getAddressesForNode } from '@/utils/configHelper'
import * as echarts from 'echarts'

// ─── Props ────────────────────────────────────────────────────────────────────
const props = defineProps({
  height: { type: Number, default: 100 }
})

// ─── Stores / injections ──────────────────────────────────────────────────────
const dashboardStore = useDashboardStore()
const tenantStore    = useTenantStore()
const { range, hierarchyLevel } = storeToRefs(dashboardStore)
const aggregationManager = inject('aggregationManager')
const subscriberId = `energy-pie-${Math.random().toString(36).substring(7)}`

// ─── Palette ──────────────────────────────────────────────────────────────────
const COLORS = [
  '#38bdf8', // sky-400
  '#34d399', // emerald-400
  '#fb923c', // orange-400
  '#a78bfa', // violet-400
  '#f472b6', // pink-400
  '#facc15', // yellow-400
  '#2dd4bf', // teal-400
  '#f87171', // red-400
  '#60a5fa', // blue-400
  '#4ade80', // green-400
]

// ─── State ────────────────────────────────────────────────────────────────────
const pieContainer  = ref(null)
const data          = ref([])
const total         = ref(0)
const totalUnit     = ref('')
const totalDecimals = ref(2)
const loading       = ref(true)
const hoveredIndex  = ref(null)
let pie = null
let resizeObserver = null

// ─── Computed ─────────────────────────────────────────────────────────────────
const displayTotal = computed(() =>
  total.value.toFixed(totalDecimals.value)
)

const legendItems = computed(() => {
  const sum = data.value.reduce((acc, d) => acc + d.value, 0)
  return data.value.map((d, i) => {
    const scaled = formatValue(d.value, config.meterChannels.activeEnergyChannel.unit)
    return {
      name:       d.name,
      color:      COLORS[i % COLORS.length],
      displayVal: scaled.value.toFixed(scaled.decimals),
      unit:       scaled.unit,
      pct:        sum > 0 ? ((d.value / sum) * 100).toFixed(1) : '0.0'
    }
  })
})

// ─── ECharts option ───────────────────────────────────────────────────────────
function buildOption() {
  return {
    backgroundColor: 'transparent',
    color: COLORS,
    tooltip: {
      show: false   // we handle hover via legend interaction
    },
    series: [{
      name: 'Energy',
      type: 'pie',
      radius: ['48%', '78%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      padAngle: 2,
      itemStyle: {
        borderWidth: 2,
        borderColor: 'rgba(15,23,42,0.8)',
        borderRadius: 6,
        shadowBlur: 0,
        shadowColor: 'transparent'
      },
      emphasis: {
        scale: true,
        scaleSize: 6,
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(255,255,255,0.25)'
        }
      },
      label:     { show: false },
      labelLine: { show: false },
      data: data.value
    }]
  }
}

// ─── Legend hover → highlight chart slice ─────────────────────────────────────
function onLegendHover(index) {
  hoveredIndex.value = index
  if (!pie) return
  pie.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: index })
}

function onLegendLeave() {
  if (hoveredIndex.value !== null && pie) {
    pie.dispatchAction({ type: 'downplay', seriesIndex: 0, dataIndex: hoveredIndex.value })
  }
  hoveredIndex.value = null
}

// ─── Chart update ─────────────────────────────────────────────────────────────
const updateChart = () => {
  if (!pie) return
  const opt = buildOption()
  pie.setOption(opt, { notMerge: true })
}

// ─── Data fetching ────────────────────────────────────────────────────────────
function fetchLiveData() {
  if (!aggregationManager) return

  loading.value = true
  const backendPeriod   = range.value
  const currentHierarchy = tenantStore.selectedHierarchy
  const currentLevel    = currentHierarchy.find(h => h.level === hierarchyLevel.value) || currentHierarchy[0]

  if (!currentLevel) {
    data.value  = []
    total.value = 0
    loading.value = false
    updateChart()
    return
  }

  const aggregations = currentLevel.nodes.map(node => ({
    key:                  `energyPie_node_${node.id}`,
    channels:             getAddressesForNode(node, config.meterChannels.activeEnergyChannel.name),
    channelType:          'energy',
    channelsAggregationType: 'sum',
    periodAggregation:    { period: backendPeriod }
  }))

  aggregationManager.register(subscriberId, aggregations, (dataMap) => {
    const newChartData = []
    let sum = 0

    currentLevel.nodes.forEach(node => {
      const key = `energyPie_node_${node.id}`
      if (dataMap[key] !== undefined) {
        const meterEnergy = dataMap[key]?.value || 0
        newChartData.push({ name: node.name, value: meterEnergy })
        sum += meterEnergy
      }
    })

    const scaledTotal   = formatValue(sum, config.meterChannels.activeEnergyChannel.unit)
    data.value          = newChartData
    total.value         = scaledTotal.value
    totalUnit.value     = scaledTotal.unit
    totalDecimals.value = scaledTotal.decimals
    loading.value       = false

    updateChart()
  })
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  if (!pieContainer.value) return
  pie = echarts.init(pieContainer.value, null, { renderer: 'canvas' })
  pie.setOption(buildOption())

  // keep chart sized to its container
  resizeObserver = new ResizeObserver(() => pie?.resize())
  resizeObserver.observe(pieContainer.value)

  // chart slice hover → sync legend highlight
  pie.on('mouseover', ({ dataIndex }) => { hoveredIndex.value = dataIndex })
  pie.on('mouseout',  ()             => { hoveredIndex.value = null })

  fetchLiveData()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  aggregationManager?.unregister(subscriberId)
  pie?.dispose()
})

watch([range, hierarchyLevel, () => tenantStore.selectedTenantId], () => {
  aggregationManager?.unregister(subscriberId)
  fetchLiveData()
})
</script>

<style scoped>
/* ── wrapper ── */
.energy-pie-wrapper {
  background: transparent;
}

/* ── glowing centre overlay ── */
.pie-center-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pie-center-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
  /* subtle glow behind the text */
  filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.35));
}

.pie-total-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: -0.02em;
}

.pie-total-unit {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 500;
  margin-top: 1px;
}

.pie-total-label {
  font-size: 0.65rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 2px;
}

/* ── legend panel ── */
.legend-panel {
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: default;
  transition: background 0.15s, border-color 0.15s;
}

.legend-row--active {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}

.legend-name {
  font-size: 0.75rem;
  color: #cbd5e1;
}

.legend-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  gap: 1px;
}

.legend-value {
  font-size: 0.72rem;
  font-weight: 600;
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}

.legend-unit {
  font-size: 0.65rem;
  color: #64748b;
  font-weight: 400;
}

.legend-pct {
  font-size: 0.65rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}
</style>
