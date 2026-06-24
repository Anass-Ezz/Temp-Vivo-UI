<template>
  <div ref="viewport" class="w-full h-full rounded-lg overflow-hidden"></div>
</template>

<script setup>
/**
 * @component PowerFlowSankey
 * @description Static ECharts Sankey diagram that fills its container.
 * No pan, zoom, or settings controls — the chart auto-fits on mount and
 * resizes whenever the container changes size.
 */

import { ref, computed, watch, onMounted, onUnmounted, nextTick, inject } from 'vue'
import { useChannelStatus } from '@/composables/useChannelStatus.js'
import * as echarts from 'echarts'
import { config } from '@/config/config'
import { useTenantStore } from '@/store/tenant'

// ─── Refs ─────────────────────────────────────────────────────────────────────
const viewport = ref(null)
let chart = null
let resizeObserver = null

// ─── Stores / injections ──────────────────────────────────────────────────────
const tenantStore        = useTenantStore()
const currentDataManager = inject('currentDataManager')
const aggregationManager = inject('aggregationManager')

const SUBSCRIBER_ID_CD  = `sankey-cd-${Math.random().toString(36).substring(7)}`
const SUBSCRIBER_ID_AGG = `sankey-agg-${Math.random().toString(36).substring(7)}`

// ─── Raw data cache ───────────────────────────────────────────────────────────
const rawDataCache = ref({})

// ─── Node status ──────────────────────────────────────────────────────────────
const nodeStatuses = ref({})

const getAddressesForNode = (node) => {
  const addresses = []
  const channel = config.meterChannels.activePowerChannel.name
  if (!node.meter) return addresses

  const { meterDepthType } = node.meter
  if (meterDepthType === 'normal' || meterDepthType === 'cluster' || meterDepthType === 'clusterMeter') {
    const meterName = node.meter.normalMeter || node.meter.clusterMeter || node.meter.clusterName
    if (meterName) {
      const entry = config.meters.find(m => m.name === meterName)
                 ?? config.meterClusters.find(c => c.name === meterName)
      if (entry) addresses.push(`${entry.edgeParent}/${meterName}/${channel}`)
    }
  } else if (meterDepthType === 'aggregation') {
    ;(node.meter.meterAggregation ?? []).forEach(mName => {
      const t = config.meters.find(m => m.name === mName)
      if (t) addresses.push(`${t.edgeParent}/${mName}/${channel}`)
    })
  }
  return addresses
}

const getStatusForNode = (node) => {
  const addresses = getAddressesForNode(node)
  if (addresses.length === 0) {
    if (node.meter?.meterDepthType === 'aggregation') {
      return useChannelStatus(computed(() => `sankey_agg_node_${node.id}`), 'meter')
    }
    return { colorClass: ref(''), svgColor: ref('inherit'), status: ref('normal') }
  }
  return useChannelStatus(computed(() => addresses[0]), 'meter')
}

const updateNodeStatuses = () => {
  const newStatuses = {}
  tenantStore.selectedHierarchy.filter(h => h.level >= 0).forEach(levelObj => {
    levelObj.nodes.forEach(node => { newStatuses[node.id] = getStatusForNode(node) })
  })
  nodeStatuses.value = newStatuses
}

// ─── Node load ────────────────────────────────────────────────────────────────
const computeNodeLoad = (node) => {
  let sum = 0
  const channel = config.meterChannels.activePowerChannel.name

  if (node.meter) {
    const { meterDepthType } = node.meter
    if (meterDepthType === 'aggregation') {
      sum = rawDataCache.value[`sankey_agg_node_${node.id}`] || 0
    } else {
      const meterName = node.meter.normalMeter || node.meter.clusterMeter || node.meter.clusterName
      if (meterName) {
        const entry = config.meters.find(m => m.name === meterName)
                   ?? config.meterClusters.find(c => c.name === meterName)
        if (entry) sum += rawDataCache.value[`${entry.edgeParent}/${meterName}/${channel}`] || 0
      }
    }
  }
  return sum > 0 ? sum / 1000 : 0.001
}

// ─── Chart options ────────────────────────────────────────────────────────────
const chartOptions = computed(() => {
  const nodes = []
  const links = []
  const nodeNameMap = {}
  const currentHierarchy = tenantStore.selectedHierarchy.filter(h => h.level >= 0)

  currentHierarchy.forEach(levelObj => {
    levelObj.nodes.forEach(node => {
      nodeNameMap[node.id] = node.name
      const load   = computeNodeLoad(node)
      const status = nodeStatuses.value[node.id]
      const color  = status?.svgColor?.value
      const finalColor = (color && color !== 'currentColor' && color !== 'inherit') ? color : null
      nodes.push({
        name:      node.name,
        depth:     levelObj.level,
        nodeLoad:  load,
        itemStyle: finalColor ? { color: finalColor } : null,
        label:     finalColor ? { color: finalColor } : null,
      })
    })
  })

  currentHierarchy.forEach(levelObj => {
    levelObj.nodes.forEach(node => {
      if (node.predecessors?.length) {
        node.predecessors.forEach(predId => {
          const parentName = nodeNameMap[predId]
          if (parentName) links.push({ source: parentName, target: node.name, value: computeNodeLoad(node) })
        })
      }
    })
  })

  const maxDepth = currentHierarchy.reduce((max, l) => Math.max(max, l.level), 0)
  const levelColors = ['#f59e0b', '#60a5fa', '#34d399', '#a78bfa', '#f87171', '#fb923c']

  const levels = Array.from({ length: maxDepth + 1 }, (_, depth) => ({
    depth,
    itemStyle: { color: levelColors[depth % levelColors.length] },
    ...(depth === maxDepth
      ? { label: { position: 'left', color: '#e5e7eb', fontSize: 11 } }
      : {}),
  }))

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(17,24,39,0.9)',
      borderColor: '#374151',
      textStyle: { color: '#f9fafb' },
      formatter: (p) =>
        p.dataType === 'edge'
          ? `${p.data.source} → ${p.data.target}<br/>${p.data.value.toFixed(1)} kW`
          : `${p.data.name}<br/>${(p.data.nodeLoad || p.value || 0).toFixed(1)} kW`,
    },
    series: [{
      type:             'sankey',
      orient:           'horizontal',
      left:             '1%',
      right:            '1%',
      top:              '5%',
      bottom:           '5%',
      nodeAlign:        'left',
      nodeGap:          20,
      nodeWidth:        6,
      layoutIterations: 0,
      data:             nodes,
      links,
      lineStyle:  { color: 'gradient', curveness: 0.25 },
      itemStyle:  { borderWidth: 1, borderColor: '#4b5563' },
      label: {
        color:    '#e5e7eb',
        fontSize: 11,
        formatter: (p) => `${p.data.name}\n${(p.data.nodeLoad || p.value || 0).toFixed(1)} kW`,
      },
      levels,
    }],
  }
})

// ─── Chart helpers ────────────────────────────────────────────────────────────
const initChart = () => {
  if (!viewport.value) return
  if (chart) { chart.dispose(); chart = null }

  chart = echarts.init(viewport.value, 'dark', { renderer: 'canvas' })
  chart.setOption(chartOptions.value)
}

const updateChart = () => {
  if (!chart) return
  chart.setOption(chartOptions.value)
}

// ─── Meter registration ───────────────────────────────────────────────────────
const registerMeters = () => {
  if (!currentDataManager || !aggregationManager) return

  const currentHierarchy = tenantStore.selectedHierarchy.filter(h => h.level >= 0)
  const cdAddresses = new Set()
  const aggregations = []

  currentHierarchy.forEach(levelObj => {
    levelObj.nodes.forEach(node => {
      if (!node.meter) return
      if (node.meter.meterDepthType === 'aggregation') {
        const addresses = getAddressesForNode(node)
        if (addresses.length > 0) {
          const key = `sankey_agg_node_${node.id}`
          if (rawDataCache.value[key] === undefined) rawDataCache.value[key] = 0
          aggregations.push({ key, channels: addresses, channelType: 'power', channelsAggregationType: 'sum' })
        }
      } else {
        getAddressesForNode(node).forEach(addr => cdAddresses.add(addr))
      }
    })
  })

  const uniqueCdAddresses = Array.from(cdAddresses)
  uniqueCdAddresses.forEach(addr => { if (rawDataCache.value[addr] === undefined) rawDataCache.value[addr] = 0 })

  if (uniqueCdAddresses.length > 0) {
    currentDataManager.register(SUBSCRIBER_ID_CD, uniqueCdAddresses, (dataObj) => {
      uniqueCdAddresses.forEach(addr => {
        if (dataObj[addr] !== undefined) rawDataCache.value[addr] = dataObj[addr] || 0
      })
    })
  }

  if (aggregations.length > 0) {
    aggregationManager.register(SUBSCRIBER_ID_AGG, aggregations, (dataMap) => {
      aggregations.forEach(agg => {
        if (dataMap[agg.key] !== undefined) {
          const raw = dataMap[agg.key]
          rawDataCache.value[agg.key] = typeof raw === 'object' ? (raw?.value || 0) : (raw || 0)
        }
      })
    })
  }
}

const unregisterMeters = () => {
  currentDataManager?.unregister(SUBSCRIBER_ID_CD)
  aggregationManager?.unregister(SUBSCRIBER_ID_AGG)
}

// ─── Watchers ─────────────────────────────────────────────────────────────────
watch(rawDataCache, updateChart, { deep: true })
watch(chartOptions, updateChart, { deep: true })

watch(() => tenantStore.selectedTenantId, () => {
  unregisterMeters()
  rawDataCache.value = {}
  registerMeters()
  updateNodeStatuses()
  updateChart()
})

watch(() => tenantStore.selectedHierarchy, () => {
  updateNodeStatuses()
  updateChart()
}, { deep: true })

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  nextTick(() => {
    setTimeout(() => {
      updateNodeStatuses()
      initChart()
      registerMeters()

      // keep chart sized to its container
      resizeObserver = new ResizeObserver(() => chart?.resize())
      resizeObserver.observe(viewport.value)
    }, 150)
  })
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  unregisterMeters()
  chart?.dispose()
})
</script>
