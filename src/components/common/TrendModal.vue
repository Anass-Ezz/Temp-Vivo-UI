<template>
  <Dialog
    v-model:visible="visible"
    :header="`${metricName} Trend`"
    :modal="true"
    :closable="true"
    :style="{ width: '80vw', maxWidth: '1200px' }"
    class="trend-modal"
  >
    <div class="trend-content">
      <div v-if="loading" class="loading-state">
        <i class="bi bi-hourglass-split text-orange-500 text-2xl mr-2"></i>
        <span>Loading trend data...</span>
      </div>

      <div v-else-if="error" class="error-state">
        <i class="bi bi-exclamation-triangle text-red-500 text-2xl mr-2"></i>
        <span>{{ error }}</span>
      </div>

      <div v-else-if="chartData.length === 0" class="no-data-state">
        <i class="bi bi-graph-down text-gray-500 text-2xl mr-2"></i>
        <span>No data available for this metric</span>
      </div>

      <div v-else class="chart-container">
        <div class="chart-header">
          <div class="metric-info">
            <h4 class="metric-title">{{ metricName }}</h4>
            <p class="metric-description">{{ metricDescription }}</p>
          </div>
          <div class="time-range">
            <span class="text-sm text-gray-400">
              Last 30 min • {{ chartData.length }} data points
            </span>
          </div>
        </div>

        <div class="chart-wrapper">
          <v-chart
            :option="chartOption"
            :style="{ height: '400px', width: '100%' }"
            autoresize
          />
        </div>

        <div class="chart-footer">
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">Current</span>
              <span class="stat-value">{{ currentValue }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Average</span>
              <span class="stat-value">{{ averageValue }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Min</span>
              <span class="stat-value">{{ minValue }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Max</span>
              <span class="stat-value">{{ maxValue }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup>
/**
 * @component TrendModal
 * @description UI Component for TrendModal.
 *
 * @prop {any} visible - Component property
 * @prop {any} metricName - Component property
 * @prop {any} metricDescription - Component property
 * @prop {any} channel - Component property
 * @prop {any} unit - Component property
 * @prop {any} meterType - Component property
 * @prop {any} meterIndex - Component property
 * @prop {any} ws - Component property
 * @prop {any} auth - Component property
 * @prop {any} dateRange - Component property
 * @prop {any} resolution - Component property
 * @emits {string} update:visible - Emitted event
 */

import { formatValue, formatNum, formatTime } from '@/utils/formatting'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import Dialog from 'primevue/dialog'
import { computed, ref, watch } from 'vue'
import VChart from 'vue-echarts'

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

function waitForSocketOpen(ws) {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.OPEN) return resolve()
    ws.addEventListener('open', resolve, { once: true })
  })
}

const props = defineProps({
  visible:           { type: Boolean, default: false },
  metricName:        { type: String,  required: true },
  metricDescription: { type: String,  default: '' },
  channel:           { type: String,  required: true },
  // raw stored unit from config (e.g. 'mV', 'mA', 'mHz', 'W', 'PF')
  unit:              { type: String,  default: '' },
  meterType:         { type: String,  required: true },
  meterIndex:        { type: Number,  required: true },
  ws:                { type: Object,  required: true },
  auth:              { type: Object,  required: true },
  dateRange:         { type: Object,  required: true },
  resolution:        { type: Object,  required: true },
})

const emit = defineEmits(['update:visible'])

const visible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const loading  = ref(false)
const error    = ref(null)
const chartData = ref([]) // [{ time: string, raw: number, scaled: number, unit: string }]

// ---------------------------------------------------------------------------
// Formatting helpers — fixed scale derived from the dataset max
// ---------------------------------------------------------------------------

// Compute one scale for the entire dataset based on the max absolute value
function datasetScale(rawPoints) {
  if (!rawPoints.length) return { divider: 1, unit: props.unit, decimals: 2 }
  const maxAbs = Math.max(...rawPoints.filter(Number.isFinite).map(Math.abs))
  const s = formatValue(maxAbs, props.unit)
  return { divider: maxAbs !== 0 ? maxAbs / s.value : 1, unit: s.unit, decimals: s.decimals }
}

const scale = ref({ divider: 1, unit: props.unit, decimals: 2 })

function applyScale(raw) {
  if (raw == null || !Number.isFinite(raw)) return null
  return raw / scale.value.divider
}

function fmtScaled(scaled) {
  if (scaled == null) return '—'
  return `${formatNum(scaled, scale.value.decimals, scale.value.decimals)} ${scale.value.unit}`.trim()
}

function fmtStat(raw) {
  if (raw == null || !Number.isFinite(raw)) return '—'
  return fmtScaled(applyScale(raw))
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
const currentValue = computed(() => {
  if (!chartData.value.length) return '—'
  return fmtStat(chartData.value[chartData.value.length - 1].raw)
})
const averageValue = computed(() => {
  if (!chartData.value.length) return '—'
  const valid = chartData.value.filter(d => d.raw != null)
  if (!valid.length) return '—'
  return fmtStat(valid.reduce((s, d) => s + d.raw, 0) / valid.length)
})
const minValue = computed(() => {
  if (!chartData.value.length) return '—'
  const valid = chartData.value.filter(d => d.raw != null)
  if (!valid.length) return '—'
  return fmtStat(Math.min(...valid.map(d => d.raw)))
})
const maxValue = computed(() => {
  if (!chartData.value.length) return '—'
  const valid = chartData.value.filter(d => d.raw != null)
  if (!valid.length) return '—'
  return fmtStat(Math.max(...valid.map(d => d.raw)))
})

// ---------------------------------------------------------------------------
// Chart option
// ---------------------------------------------------------------------------
const chartOption = computed(() => {
  if (!chartData.value.length) return {}

  const times  = chartData.value.map(d => d.time)
  const values = chartData.value.map(d => d.scaled)
  const displayUnit = scale.value.unit

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#374151',
      borderColor: '#4b5563',
      textStyle: { color: '#d1d5db' },
      formatter(params) {
        const p = params[0]
        const raw = chartData.value[p.dataIndex]?.raw
        const valStr = fmtStat(raw)
        return `<div><strong>${p.axisValue}</strong><br/>${props.metricName}: <strong>${valStr}</strong></div>`
      }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: times,
      axisLine:  { lineStyle: { color: '#4b5563' } },
      axisLabel: { color: '#9ca3af', fontSize: 10, interval: 'auto' },
      axisTick:  { show: false },
    },
    yAxis: {
      type: 'value',
      name: displayUnit,
      nameTextStyle: { color: '#9ca3af' },
      axisLine:  { lineStyle: { color: '#4b5563' } },
      axisLabel: {
        color: '#9ca3af',
        formatter: (v) => formatNum(v, 0, 2),
      },
      splitLine: { lineStyle: { color: '#374151' } },
    },
    series: [{
      name: props.metricName,
      type: 'line',
      data: values,
      smooth: true,
      lineStyle: { color: '#ea580c', width: 2 },
      itemStyle: { color: '#ea580c' },
      symbol: 'circle',
      symbolSize: 4,
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(234,88,12,0.3)' },
            { offset: 1, color: 'rgba(234,88,12,0.03)' },
          ],
        },
      },
    }],
  }
})

// ---------------------------------------------------------------------------
// Fetch real data via WebSocket
// ---------------------------------------------------------------------------
async function fetchTrendData() {
  if (!props.visible || !props.ws) return

  loading.value  = true
  error.value    = null
  chartData.value = []

  try {
    await waitForSocketOpen(props.ws)

    const now  = new Date()
    const from = new Date(now.getTime() - 30 * 60 * 1000)

    // channel is already the full "componentId/channelName" e.g. "meter1/VoltageL1"
    // We need to split it to get edgeId — channel is passed as "meter1/VoltageL1"
    // The edgeId comes from the parent via meterIndex context; we use edgeRpc
    const edgeId = `edge${props.meterIndex > 0 ? props.meterIndex - 1 : 0}`

    const OUTER_ID = crypto.randomUUID()
    const INNER_ID = crypto.randomUUID()

    // Helper to get UTC HH:mm:ss from a Date object
    const getUtcTimeStr = (d) => d.toISOString().split('T')[1].split('.')[0];

    props.ws.send(JSON.stringify({
      jsonrpc: '2.0', id: OUTER_ID, method: 'edgeRpc',
      params: {
        edgeId,
        payload: {
          jsonrpc: '2.0', id: INNER_ID,
          method: 'queryHistoricTimeseriesData',
          params: {
            channels: [props.channel],
            fromDate: from.toISOString().split('T')[0],
            toDate:   now.toISOString().split('T')[0],
            fromTime: getUtcTimeStr(from),
            toTime:   getUtcTimeStr(now),
            resolution: { value: 1, unit: 'Minutes' },
            timezone: 'UTC',
          },
        },
      },
    }))

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        props.ws.removeEventListener('message', handler)
        reject(new Error('Timeout waiting for trend data'))
      }, 15_000)

      const handler = ({ data }) => {
        try {
          const msg = JSON.parse(data)
          if (msg.id !== OUTER_ID) return
          clearTimeout(timeout)
          props.ws.removeEventListener('message', handler)

          const result = msg.result?.payload?.result
          if (!result) { resolve([]); return }

          const timestamps = result.timestamps ?? []
          const series     = result.data?.[props.channel] ?? []
          const nowMs      = Date.now()
          const rawPoints  = []

          for (let i = 0; i < timestamps.length; i++) {
            const raw = series[i]
            if (raw == null || !Number.isFinite(raw)) continue
            rawPoints.push({
              time: formatTime(timestamps[i], { hour: '2-digit', minute: '2-digit', hour12: false }),
              raw,
            })
          }

          rawPoints.sort((a, b) => a.time.localeCompare(b.time))

          // Fix scale once from the max of the whole dataset
          scale.value = datasetScale(rawPoints.map(p => p.raw))

          chartData.value = rawPoints.map(p => ({
            time:   p.time,
            raw:    p.raw,
            scaled: applyScale(p.raw),
          }))
          resolve(chartData.value)
        } catch { /* ignore parse errors */ }
      }

      props.ws.addEventListener('message', handler)
    })

  } catch (err) {
    error.value = err.message ?? 'Failed to load trend data'
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (v) => { if (v) fetchTrendData() })
</script>

<style scoped>
.trend-modal :deep(.p-dialog) {
  background: #1f2937;
  color: #d1d5db;
  border: 1px solid #4b5563;
}
.trend-modal :deep(.p-dialog-header) {
  background: #374151;
  border-bottom: 1px solid #4b5563;
  color: #d1d5db;
}
.trend-modal :deep(.p-dialog-content) {
  background: #1f2937;
  padding: 1.5rem;
}
.trend-content { min-height: 500px; }
.loading-state, .error-state, .no-data-state {
  display: flex; align-items: center; justify-content: center;
  height: 400px; font-size: 1.1rem; color: #9ca3af;
}
.chart-container { display: flex; flex-direction: column; gap: 1rem; }
.chart-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding-bottom: 1rem; border-bottom: 1px solid #374151;
}
.metric-info h4 { font-size: 1.25rem; font-weight: 600; color: #d1d5db; margin: 0 0 0.25rem 0; }
.metric-description { color: #9ca3af; margin: 0; font-size: 0.875rem; }
.chart-wrapper {
  background: #111827; border: 1px solid #374151;
  border-radius: 0.5rem; padding: 1rem;
}
.chart-footer { padding-top: 1rem; border-top: 1px solid #374151; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.stat-item { text-align: center; }
.stat-label {
  display: block; font-size: 0.75rem; color: #9ca3af;
  margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em;
}
.stat-value { display: block; font-size: 1.125rem; font-weight: 600; color: #ea580c; }
</style>
