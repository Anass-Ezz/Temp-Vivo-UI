<!-- src/components/meters/MeterAlerts.vue -->
<template>
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-baseline">
          <i class="bi bi-exclamation-triangle text-orange-500 text-xl mr-3"></i>
          <h3 class="font-semibold">Meter Alerts</h3>
        </div>
        <div class="flex items-center">
          <span v-if="faultCount > 0" class="bg-red-600 text-white px-2 py-1 rounded text-xs mr-2">
            {{ faultCount }} Critical
          </span>
          <span v-else-if="warningCount > 0" class="bg-yellow-600 text-white px-2 py-1 rounded text-xs mr-2">
            {{ warningCount }} Warning{{ warningCount > 1 ? 's' : '' }}
          </span>
          <span class="text-gray-400 text-sm">{{ meterId?.toUpperCase() || 'MTR-001' }}</span>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center flex-1 text-gray-400 text-sm">
        <i class="bi bi-arrow-repeat animate-spin mr-2"></i> Loading alerts…
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="flex items-center flex-1 text-red-400 text-sm p-3 bg-red-900 bg-opacity-30 rounded">
        <i class="bi bi-exclamation-circle mr-2"></i> {{ error }}
      </div>

      <!-- Alert list -->
      <div v-else class="space-y-3 mb-4 flex-1 overflow-y-auto">
        <div
          v-for="alert in activeAlerts"
          :key="alert.channelId"
          class="flex items-center p-3 rounded"
          :class="{
            'bg-red-900 bg-opacity-50 border border-red-600': alert.level === 'FAULT',
            'bg-yellow-900 bg-opacity-50 border border-yellow-600': alert.level === 'WARNING'
          }"
        >
          <div
            class="w-2 h-2 rounded-full mr-3 flex-shrink-0"
            :class="{
              'bg-red-500': alert.level === 'FAULT',
              'bg-yellow-500': alert.level === 'WARNING'
            }"
          ></div>
          <div class="flex-1 min-w-0">
            <div
              class="text-sm font-medium truncate"
              :class="{
                'text-red-400': alert.level === 'FAULT',
                'text-yellow-400': alert.level === 'WARNING'
              }"
            >
              {{ alert.text }}
            </div>
            <span
              class="text-xs px-1 rounded"
              :class="{
                'bg-red-700 text-red-200': alert.level === 'FAULT',
                'bg-yellow-700 text-yellow-200': alert.level === 'WARNING'
              }"
            >{{ alert.level }}</span>
          </div>
          <div class="text-xs text-gray-400 ml-2 flex-shrink-0">{{ formatDuration(alert.onsetTs) }}</div>
        </div>

        <!-- Empty state (3.2) -->
        <div v-if="activeAlerts.length === 0" class="text-gray-500 text-sm italic py-4 text-center">
          No active alerts
        </div>
      </div>

      <!-- Footer: Critical + Warning only (3.3) -->
      <div class="flex justify-between text-sm pt-2 border-t border-gray-700 mt-auto">
        <div class="text-center">
          <div class="text-red-500 font-bold text-lg">{{ faultCount }}</div>
          <div class="text-gray-400">Critical</div>
        </div>
        <div class="text-center">
          <div class="text-yellow-500 font-bold text-lg">{{ warningCount }}</div>
          <div class="text-gray-400">Warning</div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
/**
 * @component MeterAlerts
 * @description UI Component for MeterAlerts.
 *
 * @prop {any} meterId - Component property
 * @prop {any} type - Component property
 * @prop {any} default - Component property
 */

  import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
  import { useSelectedMeter } from '@/composables/useSelectedMeter.js'
  import { useMeterAlertCounts } from '@/composables/useMeterAlertCounts.js'

  // ── Props ──────────────────────────────────────────────────────────────────
  const props = defineProps({
    meterId: {
      type: String,
      default: null
    }
  })

  // ── 2.1 Injections ─────────────────────────────────────────────────────────
  const ws = inject('ws')
  const auth = inject('auth')
  const aggregationInterval = inject('aggregationInterval')

  // ── 2.2 Selected meter ─────────────────────────────────────────────────────
  const { componentName, edgeId, isQueryableEdge } = useSelectedMeter()

  // ── 2.13 Loading / error state ─────────────────────────────────────────────
  const loading = ref(false)
  const error = ref(null)

  // ── Internal reactive state ────────────────────────────────────────────────
  const channelDefs = ref([])      // FAULT/WARNING defs only
  const channelValues = ref({})    // channelId → current numeric value
  let onsetCache = {}              // channelId → Unix ms onset timestamp (plain object, persisted to localStorage)
  let pollTimer = null

  // ── 2.3 OnsetCache helpers ─────────────────────────────────────────────────
  function onsetKey(eId, cName) {
    return `meter-alerts-onset-${eId}-${cName}`
  }

  function loadOnsetCache(eId, cName) {
    const raw = localStorage.getItem(onsetKey(eId, cName))
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  function persistOnsetCache(eId, cName, cache) {
    const key = onsetKey(eId, cName)
    if (Object.keys(cache).length === 0) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(cache))
    }
  }

  function clearOnsetCache(eId, cName) {
    localStorage.removeItem(onsetKey(eId, cName))
  }

  // ── 2.4 Fetch state channel definitions ────────────────────────────────────
  function fetchStateChannelDefs() {
    if (!edgeId.value || !componentName.value || !isQueryableEdge.value) {
      return Promise.resolve([])
    }

    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID()

      const handleMessage = (event) => {
        let msg
        try { msg = JSON.parse(event.data) } catch { return }
        if (msg.id !== id) return
        ws.removeEventListener('message', handleMessage)
        if (msg.error) {
          reject(new Error(msg.error.message || 'getStateChannelsOfComponent failed'))
          return
        }
        const channels = msg.result?.payload?.result?.channels ?? []
        resolve(channels)
      }

      ws.addEventListener('message', handleMessage)
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'edgeRpc',
        params: {
          edgeId: edgeId.value,
          payload: {
            jsonrpc: '2.0',
            id: crypto.randomUUID(),
            method: 'componentJsonApi',
            params: {
              componentId: '_componentManager',
              payload: {
                jsonrpc: '2.0',
                id: crypto.randomUUID(),
                method: 'getStateChannelsOfComponent',
                params: { componentId: componentName.value }
              }
            }
          }
        }
      }))
    })
  }

  // ── 2.5 Poll once ──────────────────────────────────────────────────────────
  function pollOnce() {
    if (!edgeId.value || !componentName.value || !isQueryableEdge.value) {
      channelValues.value = {}
      return Promise.resolve()
    }

    const channelAddresses = channelDefs.value.map(def => `${componentName.value}/${def.id}`)
    if (channelAddresses.length === 0) return Promise.resolve()

    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID()

      const handleMessage = (event) => {
        let msg
        try { msg = JSON.parse(event.data) } catch { return }
        if (msg.id !== id) return
        ws.removeEventListener('message', handleMessage)
        if (msg.error) {
          reject(new Error(msg.error.message || 'getEdgesChannelsValues failed'))
          return
        }

        const rawValues = msg.result?.[edgeId.value] ?? {}
        const newValues = {}

        for (const def of channelDefs.value) {
          const fullAddr = `${componentName.value}/${def.id}`
          const val = rawValues[fullAddr] ?? 0
          newValues[def.id] = val

          if (val === 1 && !(def.id in onsetCache)) {
            onsetCache[def.id] = Date.now()
          }
          if (val !== 1 && def.id in onsetCache) {
            delete onsetCache[def.id]
          }
        }

        channelValues.value = newValues
        persistOnsetCache(edgeId.value, componentName.value, onsetCache)
        resolve()
      }

      ws.addEventListener('message', handleMessage)
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'getEdgesChannelsValues',
        params: {
          ids: [edgeId.value],
          channels: channelAddresses
        }
      }))
    })
  }

  // ── 2.6 Format duration ────────────────────────────────────────────────────
  function formatDuration(onsetTs) {
    const elapsed = Date.now() - onsetTs
    if (elapsed < 60000) {
      return `${Math.floor(elapsed / 1000)}s`
    }
    if (elapsed < 3600000) {
      return `${Math.floor(elapsed / 60000)}m`
    }
    const hours = Math.floor(elapsed / 3600000)
    const minutes = Math.floor((elapsed % 3600000) / 60000)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  // ── Poll interval helpers ──────────────────────────────────────────────────
  function startPoll() {
    if (!isQueryableEdge.value) return
    const interval = aggregationInterval?.value?.value ?? aggregationInterval?.value ?? 5000
    pollTimer = setInterval(async () => {
      try {
        await pollOnce()
      } catch (e) {
        // poll failed silently
      }
    }, interval)
  }

  // ── 2.7 onMounted ─────────────────────────────────────────────────────────
  async function loadAlerts() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }

    channelDefs.value = []
    channelValues.value = {}
    error.value = null

    if (!auth.ready || !edgeId.value || !componentName.value || !isQueryableEdge.value) {
      loading.value = false
      return
    }

    onsetCache = loadOnsetCache(edgeId.value, componentName.value)

    loading.value = true
    try {
      const defs = await fetchStateChannelDefs()
      channelDefs.value = defs.filter(d => d.level === 'FAULT' || d.level === 'WARNING')
      if (channelDefs.value.length === 0) return
      await pollOnce()
      startPoll()
    } catch (e) {
      error.value = e.message || 'Failed to load alerts'
    } finally {
      loading.value = false
    }
  }

  // ── 2.8 Watch aggregationInterval ─────────────────────────────────────────
  watch(aggregationInterval, () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
    if (channelDefs.value.length > 0 && isQueryableEdge.value) startPoll()
  })

  watch(
    [() => auth.ready, edgeId, componentName, isQueryableEdge],
    ([ready]) => {
      if (ready) {
        loadAlerts()
        return
      }

      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
      loading.value = false
      error.value = null
      channelDefs.value = []
      channelValues.value = {}
    },
    { immediate: true }
  )

  // ── 2.9 onBeforeUnmount ───────────────────────────────────────────────────
  onBeforeUnmount(() => {
    if (pollTimer) clearInterval(pollTimer)
    clearOnsetCache(edgeId.value, componentName.value)
  })

  // ── 2.10 activeAlerts computed ────────────────────────────────────────────
  const activeAlerts = computed(() =>
    channelDefs.value
      .filter(def => channelValues.value[def.id] === 1)
      .map(def => ({
        channelId: def.id,
        text: def.text,
        level: def.level,
        onsetTs: onsetCache[def.id] ?? Date.now()
      }))
  )

  // ── 2.11 Counts ───────────────────────────────────────────────────────────
  const faultCount = computed(() => activeAlerts.value.filter(a => a.level === 'FAULT').length)
  const warningCount = computed(() => activeAlerts.value.filter(a => a.level === 'WARNING').length)

  // ── 2.12 Sync to shared composable ───────────────────────────────────────
  const { faultCount: sharedFaultCount, warningCount: sharedWarningCount } = useMeterAlertCounts()
  watch(faultCount, v => { sharedFaultCount.value = v })
  watch(warningCount, v => { sharedWarningCount.value = v })


  </script>
  
  <style scoped></style>
