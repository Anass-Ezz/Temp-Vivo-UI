<template>
  <div class="w-full h-full rounded-lg shadow-lg relative bg-[#0b1220] p-4">
    <div ref="histEl" class="w-full" :style="{ height: height + 'px' }"></div>
  </div>
</template>

<script setup>
/**
 * @component EnergyHistogram
 * @description UI Component for EnergyHistogram.
 *
 * @prop {any} height - Component property
 */

import { ref, onMounted, onUnmounted, watch, computed, inject } from 'vue'
import * as echarts from 'echarts'
import { config } from '@/config/config'
import { useTenantStore } from '@/store/tenant'
import { getAddressesForNode } from '@/utils/configHelper'
import { formatValue, formatNum, formatDate, formatDateTime, formatTime } from '@/utils/formatting'

const props = defineProps({
  height: { type: Number, default: 480 }
})

const ws = inject('ws')
const auth = inject('auth')
const tenantStore = useTenantStore()
const dateRangeContext = inject('dateRange')
const resolutionContext = inject('resolution')
const historyInterval = inject('historyInterval')

// --- Reactive state ---
const chartData = ref({
  timestamps: [],
  rawTimestamps: [],
  cost: [],
  emissions: [],
  energy: []
})

const histEl = ref(null)
const isLoading = ref(false)
let chart = null
let histPollingInterval = null

const fromDate = computed(() => dateRangeContext?.value?.value?.[0] ? new Date(dateRangeContext.value.value[0]).toISOString().split('T')[0] : null)
const toDate = computed(() => dateRangeContext?.value?.value?.[1] ? new Date(dateRangeContext.value.value[1]).toISOString().split('T')[0] : null)
const resolution = computed(() => resolutionContext?.value?.value)

async function fetchData() {
  if (!fromDate.value || !toDate.value || !auth.ready || !ws || isLoading.value) return
  
  isLoading.value = true;
  const reqId = crypto.randomUUID()
  
  try {
    // Resolve the global node using the priority lookup:
    //   1. level -1 (virtual global level) — canonical, preferred
    //   2. any node with isGlobal: true on a regular level — legacy fallback
    const currentHierarchy = tenantStore.selectedHierarchy;

    const virtualLevel = currentHierarchy.find(h => h.level === -1);
    const globalNode = virtualLevel?.nodes?.[0]
      ?? currentHierarchy.flatMap(h => h.nodes).find(n => n.isGlobal)
      ?? null;

    let energyChannels = [];
    let costChannels = [];
    let emissionChannels = [];

    if (globalNode) {
      energyChannels = getAddressesForNode(globalNode, config.meterChannels.activeEnergyChannel.name);
      costChannels = getAddressesForNode(globalNode, config.meterChannels.activeEnergyCostChannel.name);
      emissionChannels = getAddressesForNode(globalNode, config.meterChannels.activeEnergyEmissionsChannel.name);
    } else {
      const tenantEdges = tenantStore.tenantEdges;
      const tenantMeters = config.meters.filter(m => tenantEdges.includes(m.edgeParent));
      energyChannels = tenantMeters.map(m => `${m.edgeParent}/${m.name}/${config.meterChannels.activeEnergyChannel.name}`)
      costChannels = tenantMeters.map(m => `${m.edgeParent}/${m.name}/${config.meterChannels.activeEnergyCostChannel.name}`)
      emissionChannels = tenantMeters.map(m => `${m.edgeParent}/${m.name}/${config.meterChannels.activeEnergyEmissionsChannel.name}`)
    }

    if (energyChannels.length === 0 && costChannels.length === 0 && emissionChannels.length === 0) {
      isLoading.value = false;
      return;
    }

    const aggregations = [
      ...(energyChannels.length > 0 ? [{
        key: 'hist_energy',
        channels: energyChannels,
        channelType: 'energy',
        channelsAggregationType: 'sum'
      }] : []),
      ...(costChannels.length > 0 ? [{
        key: 'hist_cost',
        channels: costChannels,
        channelType: 'cost',
        channelsAggregationType: 'sum'
      }] : []),
      ...(emissionChannels.length > 0 ? [{
        key: 'hist_emissions',
        channels: emissionChannels,
        channelType: 'emissions',
        channelsAggregationType: 'sum'
      }] : [])
    ];

    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: reqId,
      method: 'aggregateAndQueryEdgesChannelsHistory',
      params: {
        aggregations,
        fromDate: fromDate.value,
        toDate: toDate.value,
        resolution: {
          value: resolution.value.value,
          unit: resolution.value.unit
        },
        timezone: 'Africa/Casablanca'
      }
    });

    const handleMessage = ({ data }) => {
      try {
        const msg = JSON.parse(data)
        if (msg.id === reqId) {
          ws.removeEventListener('message', handleMessage)
          isLoading.value = false;
          if (msg.result) {
            processChartData(msg.result)
            updateChart()
          } else if (msg.error) {
            // server error
          }
        }
      } catch (e) {
        // ignore JSON parse errors
      }
    }
    
    ws.addEventListener('message', handleMessage)
    ws.send(message)

    setTimeout(() => {
      ws.removeEventListener('message', handleMessage);
      if (isLoading.value) isLoading.value = false;
    }, 15000);
    
  } catch (error) {
    isLoading.value = false;
  }
}

/**
 * Parses the server response into chartData arrays.
 * Response shape: { timestamps: string[], data: { hist_energy: number[], hist_cost: number[], hist_emissions: number[] } }
 */
function processChartData(result) {
  const raw = result.data ?? {}
  const tsEnd = result.timestamps ?? []
  const res = resolution.value

  // Shift timestamps back by the resolution to show "Start of Period" labels
  // as the backend returns "End of Period" (window stop time).
  const ts = tsEnd.map(t => {
      const d = new Date(t);
      const val = res.value || 1;
      const unit = (res.unit || 'Days').toLowerCase();

      if (unit === 'seconds') d.setUTCSeconds(d.getUTCSeconds() - val);
      else if (unit === 'minutes') d.setUTCMinutes(d.getUTCMinutes() - val);
      else if (unit === 'hours') d.setUTCHours(d.getUTCHours() - val);
      else if (unit === 'days') d.setUTCDate(d.getUTCDate() - val);
      else if (unit === 'weeks') d.setUTCDate(d.getUTCDate() - (val * 7));
      else if (unit === 'months') d.setUTCMonth(d.getUTCMonth() - val);
      else if (unit === 'years') d.setUTCFullYear(d.getUTCFullYear() - val);

      return d.toISOString();
  });

  chartData.value.rawTimestamps = ts;

  // Format labels based on resolution unit
  const unit = (res.unit || 'Days').toLowerCase();
  chartData.value.timestamps = ts.map(t => {
    if (unit === 'days' || unit === 'weeks') return formatDate(t, { day: '2-digit', month: 'short' });
    if (unit === 'hours') return formatDateTime(t, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    if (unit === 'months') return formatDate(t, { month: 'short', year: 'numeric' });
    return formatDate(t);
  })

  // Scale energy (Wh → kWh/MWh)
  const rawEnergy = raw.hist_energy ?? []
  const energyScaled = rawEnergy.map(v => {
    if (v === null || v === undefined) return null
    return formatValue(v, config.meterChannels.activeEnergyChannel.unit)
  })
  chartData.value.energy = energyScaled.map(s => s?.value ?? null)
  const energyUnit = energyScaled.find(s => s !== null)?.unit ?? config.meterChannels.activeEnergyChannel.unit

  // Cost (MAD — no scaling needed, just round)
  chartData.value.cost = (raw.hist_cost ?? []).map(v => v !== null && v !== undefined ? Math.round(v * 100) / 100 : null)

  // Emissions (kg → t if large)
  const rawEmissions = raw.hist_emissions ?? []
  const emissionsScaled = rawEmissions.map(v => {
    if (v === null || v === undefined) return null
    return formatValue(v, config.meterChannels.activeEnergyEmissionsChannel.unit)
  })
  chartData.value.emissions = emissionsScaled.map(s => s?.value ?? null)
  const emissionsUnit = emissionsScaled.find(s => s !== null)?.unit ?? config.meterChannels.activeEnergyEmissionsChannel.unit

  // Store units for axis labels
  chartData.value.energyUnit = energyUnit
  chartData.value.emissionsUnit = emissionsUnit
}

function updateChart() {
  if (!histEl.value) return
  if (!chart) {
    chart = echarts.init(histEl.value, 'dark')
  }

  const labels = chartData.value.timestamps
  const energyUnit = chartData.value.energyUnit ?? 'kWh'
  const emissionsUnit = chartData.value.emissionsUnit ?? 'kg'

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter(params) {
        let html = `<div style="font-weight:bold;margin-bottom:4px">${params[0]?.axisValue}</div>`
        // Always show energy in tooltip even though it has no visible series
        const energyVal = chartData.value.energy[params[0]?.dataIndex]
        if (energyVal !== null && energyVal !== undefined) {
          html += `<div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#60a5fa;margin-right:4px"></span>Energy: <b>${formatNum(energyVal, 2, 2)} ${energyUnit}</b></div>`
        }
        params.forEach(p => {
          const val = p.value !== null && p.value !== undefined ? formatNum(p.value, 2, 2) : '-'
          html += `<div>${p.marker} ${p.seriesName}: <b>${val}</b></div>`
        })
        return html
      }
    },
    legend: {
      top: 4,
      textStyle: { color: '#9ca3af' }
    },
    grid: { left: '4%', right: '4%', bottom: '12%', top: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#9ca3af', rotate: labels.length > 14 ? 45 : 0, fontSize: 11 },
      axisLine: { lineStyle: { color: '#374151' } }
    },
    yAxis: [
      {
        type: 'value',
        name: 'MAD',
        nameTextStyle: { color: '#34d399', fontSize: 11 },
        axisLabel: { color: '#9ca3af', formatter: v => formatNum(v, 0, 0) },
        splitLine: { lineStyle: { color: '#1f2937' } }
      },
      {
        type: 'value',
        name: emissionsUnit,
        nameTextStyle: { color: '#f97316', fontSize: 11 },
        axisLabel: { color: '#9ca3af', formatter: v => formatNum(v, 0, 2) },
        splitLine: { show: false }
      }
    ],
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', bottom: 4, height: 20, textStyle: { color: '#9ca3af' } }
    ],
    series: [
      {
        name: 'Cost (MAD)',
        type: 'bar',
        yAxisIndex: 0,
        data: chartData.value.cost,
        itemStyle: { color: '#34d399', borderRadius: [3, 3, 0, 0] },
        emphasis: { itemStyle: { color: '#6ee7b7' } }
      },
      {
        name: `CO₂ (${emissionsUnit})`,
        type: 'line',
        yAxisIndex: 1,
        data: chartData.value.emissions,
        smooth: true,
        symbol: 'diamond',
        symbolSize: 5,
        lineStyle: { color: '#f97316', width: 2, type: 'dashed' },
        itemStyle: { color: '#f97316' }
      }
    ]
  }

  chart.setOption(option, true)
}

onMounted(() => {
  window.addEventListener('resize', () => chart?.resize())
})

onUnmounted(() => {
  if (chart) chart.dispose()
  if (histPollingInterval) clearInterval(histPollingInterval)
  window.removeEventListener('resize', () => chart?.resize())
})

watch(
  [() => auth.ready, fromDate, toDate, () => resolution.value, () => tenantStore.selectedTenantId],
  ([isReady]) => {
    if (isReady) fetchData()
  },
  { deep: true, immediate: true }
)

watch(() => historyInterval?.value?.value, (ms) => {
  if (histPollingInterval) clearInterval(histPollingInterval)
  if (ms > 0) {
    histPollingInterval = setInterval(() => fetchData(), ms)
  }
}, { immediate: true, deep: true })
</script>
