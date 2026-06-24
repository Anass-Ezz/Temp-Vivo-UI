<template>
  <div class="card w-full h-[calc(97vh-100px)] overflow-hidden relative flex flex-col !p-0 !m-0 bg-[#09090b]">
    <!-- Loading Overlay -->
    <div v-if="isLoading" class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#09090b] bg-opacity-80 backdrop-blur-sm">
      <div class="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mb-4"></div>
      <span class="text-sky-400 font-medium tracking-wider">Synchronizing Diagram...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="noDiagram" class="absolute inset-0 z-40 flex flex-col items-center justify-center p-8 text-center bg-[#09090b] border-2 border-dashed border-zinc-800 m-4 rounded-2xl">
      <div class="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6">
        <i class="pi pi-map text-4xl text-zinc-500"></i>
      </div>
      <h3 class="text-2xl font-bold text-zinc-100 mb-2">No Infrastructure Diagram</h3>
      <p class="text-zinc-400 max-w-sm">This tenant doesn't have a structure diagram linked yet. You can upload one in the Administration panel.</p>
    </div>

    <!-- Diagram Viewport -->
    <div 
      v-show="!isLoading && !noDiagram"
      class="flex-1 overflow-hidden relative w-full h-full"
      @wheel.prevent="handleZoom"
      @mousedown="startDrag"
      @mousemove="onDrag"
      @mouseup="endDrag"
      @mouseleave="endDrag"
      ref="container"
    >
      <div 
        class="absolute top-0 left-0 origin-top-left transform-gpu transition-transform duration-100 ease-linear"
        :style="{
          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }"
        v-v-html="processedSvg"
        v-html="processedSvg"
        ref="svgContainer"
      ></div>
    </div>
  </div>
</template>

<script setup>
/**
 * @component DiagramPage
 * @description UI Component for DiagramPage.
 *
 */

import { computed, nextTick, onMounted, onUnmounted, ref, watch, inject } from 'vue'
// Remove useChannelStatus as it can't be used in loops
// import { useChannelStatus } from '@/composables/useChannelStatus.js'
import { useDataStore } from '@/store/dataStore'
import { useAlertsStore } from '@/store/alerts'
import { getRelatedAlarms } from '@/utils/statusMapping'

const svgContent = ref('')
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/store/dashboard'
import { useTenantStore } from '@/store/tenant'
import { storeToRefs } from 'pinia'
import { formatValue } from '@/utils/formatting'

const currentDataManager = inject('currentDataManager')
const aggregationManager = inject('aggregationManager')
const ws = inject('ws')

const dashboardStore = useDashboardStore()
const tenantStore = useTenantStore()
const { range } = storeToRefs(dashboardStore)

// --- Router ---
const router = useRouter()

// --- Refs ---
const container = ref(null)
const svgContainer = ref(null)
const position = ref({ x: 0, y: 0 })
const zoom = ref(1)
const initialPosition = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const isLoading = ref(false)
const noDiagram = ref(false)

const dataStore = useDataStore()
const alertsStore = useAlertsStore()

// We will keep track of IDs we register so we can unregister them on unmount
const registeredCurrentIds = new Set()
const registeredAggregationKeys = new Set()
const subscriberId = `diagram-page-${Math.random().toString(36).substring(7)}`

// Persistent mapping of configured texts so we don't lose the JSON string when it gets visually overwritten
let parsedBindings = []


// --- SVG Processing ---
const processedSvg = computed(() => {
  if (!svgContent.value) return ''
  
  return svgContent.value
    .replace(/<g id="node-a"/g, '<g id="node-a" data-node="A" style="cursor: pointer"')
    .replace(/<g id="node-b"/g, '<g id="node-b" data-node="B" style="cursor: pointer"')
    .replace(/<g id="gm-0"/g, '<g id="gm-0" style="cursor: pointer"')
    .replace(/<g id="gm-1"/g, '<g id="gm-1" style="cursor: pointer"')
    .replace(/<g id="fm-0"/g, '<g id="fm-0" style="cursor: pointer"')
    .replace(/<g id="pv-0"/g, '<g id="pv-0" style="cursor: pointer"')
})

// --- Click Handling ---
const handleDiagramClick = (event) => {
  const nodeElement = event.target.closest('[data-node]')
  if (nodeElement) return;

  const deviceElement = event.target.closest('[data-device-ref]')
  if (deviceElement) {
    const ref = deviceElement.getAttribute('data-device-ref')
    router.push({ name: 'meters', params: { meterReference: ref } })
    return
  }

  const smElement = event.target.closest('[id^="sm-"]')
  const gmElement = event.target.closest('[id^="gm-"]')
  const fmElement = event.target.closest('[id^="fm-"]')
  const pvElement = event.target.closest('#pv-0')

  if (smElement) {
    router.push({ path: '/meters', query: { meterId: smElement.id, meterName: `Meter ${smElement.id}` } })
  } else if (gmElement) {
    router.push({ path: '/gas-meters', query: { meterId: gmElement.id, meterName: `Gas Meter ${gmElement.id}` } })
  } else if (fmElement) {
    router.push({ path: '/fuel-meters', query: { meterId: fmElement.id, meterName: `Fuel Meter ${fmElement.id}` } })
  } else if (pvElement) {
    router.push({ path: '/pv', query: { meterId: pvElement.id, meterName: 'Solar PV System' } })
  }
}

// --- Panning/Zooming ---
const handleZoom = (event) => {
  if (!container.value) return
  const rect = container.value.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  
  const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(0.1, Math.min(5, zoom.value * zoomFactor))
  
  if (newZoom !== zoom.value) {
    const diagramX = (mouseX - position.value.x) / zoom.value
    const diagramY = (mouseY - position.value.y) / zoom.value
    zoom.value = newZoom
    position.value = {
      x: mouseX - diagramX * newZoom,
      y: mouseY - diagramY * newZoom
    }
  }
}

const startDrag = (event) => {
  if (
    event.target.closest('[data-node]') || 
    event.target.closest('[data-device-ref]') ||
    event.target.closest('[id^="sm-"]') || 
    event.target.closest('[id^="gm-"]') || 
    event.target.closest('[id^="fm-"]') || 
    event.target.closest('#pv-0')
  ) {
    handleDiagramClick(event)
    return
  }
  isDragging.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  initialPosition.value = { ...position.value }
  event.preventDefault()
}

const onDrag = (event) => {
  if (!isDragging.value) return
  const dx = event.clientX - dragStart.value.x
  const dy = event.clientY - dragStart.value.y
  position.value = {
    x: initialPosition.value.x + dx,
    y: initialPosition.value.y + dy
  }
}

const endDrag = () => { isDragging.value = false }

// --- Center and Fit Diagram ---
const centerAndFitDiagram = () => {
  nextTick(() => {
    if (!container.value || !svgContainer.value) return
    const svgElement = svgContainer.value.querySelector('svg')
    if (!svgElement) return
    
    setTimeout(() => {
      const containerRect = container.value.getBoundingClientRect()
      // getBBox is usually more precise for the actual drawing boundaries in Draw.io
      const svgRect = svgElement.getBBox ? svgElement.getBBox() : svgElement.getBoundingClientRect()
      
      if (svgRect.width > 0 && svgRect.height > 0) {
        // Force zoom to be EXACTLY the width of the container
        const newZoom = containerRect.width / svgRect.width
        
        const scaledWidth = svgRect.width * newZoom
        const scaledHeight = svgRect.height * newZoom
        
        // Horizontal: Start at exactly 0 (left edge), vertical: center in the panel
        const centeredX = -(svgRect.x * newZoom)
        const centeredY = (containerRect.height - scaledHeight) / 2 - (svgRect.y * newZoom)
        
        zoom.value = newZoom
        position.value = { x: centeredX, y: centeredY }
      }
    }, 100)
  })
}

// --- Parse Draw.io Native Data ---
const applyBindingsToManagers = () => {
    // Purge old registrations if running cleanly again
    registeredCurrentIds.forEach(id => currentDataManager?.unregister(id));
    aggregationManager?.unregister(subscriberId);
    registeredCurrentIds.clear();
    registeredAggregationKeys.clear();
    
    const aggregations = [];
    
    parsedBindings.forEach((binding, idx) => {
        let { config, element } = binding; // Make config mutable
        const autoId = `binding-${idx}`;

        // Some Draw.io exports might manually nest everything inside a "data" property
        if (config.data) {
            config = config.data;
        }

        const blinkText = (el) => {
            el.style.transition = 'opacity 0.05s ease-out';
            el.style.opacity = '0.3'; // More subtle than disappearing entirely
            setTimeout(() => { 
                if(el) {
                    el.style.transition = 'opacity 0.2s ease-in';
                    el.style.opacity = '1'; 
                }
            }, 250);
        };

        // 1. Current Data Tracker (Instantaneous e.g., Power)
        if (config.type === 'current' && config.channel) {
            registeredCurrentIds.add(autoId);
            
            // Manual color update instead of hook in loop
            updateElementColor(element, config.channel, config.componentType || 'meter');

            currentDataManager.register(autoId, [config.channel], (record) => {
                const matchedVal = record[config.channel];
                if (matchedVal !== undefined) {
                    const baseUnit = config.unit; 
                    const scaled = formatValue(matchedVal, baseUnit);
                    element.textContent = `${scaled.value.toFixed(scaled.decimals || 1)} ${scaled.unit || ''}`.trim();
                    blinkText(element);
                    // Update color on data arrival too
                    updateElementColor(element, config.channel, config.componentType || 'meter');
                }
            });
        } 
        // 2. Aggregation Data Tracker (Period Sums or Multi-Channel Combinations)
        else if (config.type === 'aggregation' && config.channels) {
            const arrKey = `diagram_agg_${autoId}`;
            
            // Manual color update
            updateElementColor(element, arrKey, config.componentType || 'meter');

            aggregations.push({
                key: arrKey,
                channels: config.channels,
                channelType: config.channelType || 'energy', 
                channelsAggregationType: config.channelAggregationType || 'sum'
            });
            registeredAggregationKeys.add(autoId);
        }
    });

    // Bulk register all valid aggregations
    if (aggregations.length > 0) {
        aggregationManager.register(
            subscriberId,
            aggregations,
            (dataMap) => {
                parsedBindings.forEach((binding, idx) => {
                    const autoId = `binding-${idx}`;
                    if (registeredAggregationKeys.has(autoId)) {
                        const arrKey = `diagram_agg_${autoId}`;
                        if (dataMap[arrKey] !== undefined) {
                            const sumVal = dataMap[arrKey]?.value || 0;
                            const baseUnit = binding.config.unit;
                            const scaled = formatValue(sumVal, baseUnit); 
                            
                            binding.element.textContent = `${scaled.value.toFixed(scaled.decimals || 1)} ${scaled.unit || ''}`.trim();
                            blinkText(binding.element);
                            
                            // Update color
                            updateElementColor(binding.element, arrKey, binding.config.componentType || 'meter');
                        }
                    }
                });
            }
        );
    }
}

// --- Status Color Helpers ---
function updateElementColor(element, path, componentType) {
    const info = dataStore.channels[path] || { value: null, isStale: true };
    
    // Alert Detection
    let activeAlarm = null;
    const parts = path.split('/');
    if (parts.length >= 3) {
        const componentId = parts[1];
        const channelName = parts[parts.length - 1];
        const relatedAlarms = getRelatedAlarms(componentType, channelName);
        const componentAlarms = alertsStore.channelValues[componentId] || {};
        activeAlarm = relatedAlarms.find(a => componentAlarms[a] > 0);
    }

    if (activeAlarm) {
        element.style.fill = '#ef4444'; // Red-500
        element.style.color = '#ef4444';
    } else if (info.isStale) {
        element.style.fill = '#9ca3af'; // Gray-400
        element.style.color = '#9ca3af';
    } else {
        // Normal state (Default to white/cyan depending on diagram context)
        element.style.fill = '#22d3ee'; // Cyan-400 for data nodes
        element.style.color = '#22d3ee';
    }
}

// Watch global store changes to trigger re-checks of all node colors (e.g. for staleness)
watch(() => dataStore.lastUpdate, () => {
    parsedBindings.forEach(b => {
        const path = b.config.type === 'current' ? b.config.channel : `diagram_agg_binding-${parsedBindings.indexOf(b)}`;
        updateElementColor(b.element, path, b.config.componentType || 'meter');
    });
});

const parseDrawioObjects = () => {
    if (!svgContainer.value) return;

    // Reset bindings on completely new SVG loads
    parsedBindings = [];

    // Find all potential text elements in the SVG
    // Draw.io renders text cleanly either inside `<foreignObject>` or `<text>` nodes
    const candidateNodes = svgContainer.value.querySelectorAll('foreignObject div div div, text');
    
    candidateNodes.forEach(node => {
        let textContent = node.textContent?.trim();
        if (!textContent) return;

        // Strip non-breaking spaces if Draw.io injected any
        textContent = textContent.replace(/\u00A0/g, ' ');

        // Check if the text contains a JSON pattern (e.g. might be prefixed with "data": )
        const startIdx = textContent.indexOf('{');
        const endIdx = textContent.lastIndexOf('}');
        
        if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
            try {
                // Extract just the JSON part
                const jsonStr = textContent.substring(startIdx, endIdx + 1);
                
                // The user mentioned they write: {"type":"aggregation", "channels"["egde1...]}
                // Let's attempt to fix the missing colon before parsing.
                const sanitizedData = jsonStr.replace(/"channels"\s*\[/g, '"channels":[');
                const config = JSON.parse(sanitizedData);
                
                if (typeof config === 'object' && config !== null) {
                    // Check for specialized device navigation nodes
                    if (config.device && config.device.reference) {
                        node.textContent = config.device.reference;
                        node.style.cursor = 'pointer';
                        node.style.color = '#38bdf8'; // Sky blue link color
                        node.style.textDecoration = 'underline';
                        node.setAttribute('data-device-ref', config.device.reference);
                        return;
                    }

                    parsedBindings.push({
                        element: node,
                        config: config
                    });
                    
                    // Immediately wipe the ugly JSON string off the screen while we wait for WebSockets
                    node.textContent = "...";
                }
            } catch (e) {
                // invalid JSON in text node, skip
            }
        }
    });

    if (parsedBindings.length > 0) {
        applyBindingsToManagers();
    }
}

const _sendRpc = (wsClient, method, params) => {
    return new Promise((resolve, reject) => {
        if (wsClient.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket is not open'));
            return;
        }

        const id = crypto.randomUUID();

        const handler = (event) => {
            let msg;
            try { msg = JSON.parse(event.data); } catch { return; }
            if (msg.id !== id) return;

            wsClient.removeEventListener('message', handler);

            if (msg.error) {
                reject(new Error(msg.error.message || `RPC error[${method}]`));
                return;
            }
            // Tenant diagram payload comes back as result.svgData
            resolve(msg.result?.svgData ?? null);
        };

        wsClient.addEventListener('message', handler);
        wsClient.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
};

const loadSvg = async () => {
    const tenantId = tenantStore.selectedTenantId
    if (!tenantId) {
        svgContent.value = ''
        noDiagram.value = true
        return
    }
    
    isLoading.value = true
    noDiagram.value = false
    try {
        const svgBase64 = await _sendRpc(ws, 'getTenantDiagramById', { tenantId })
        if (svgBase64) {
             svgContent.value = atob(svgBase64)
             noDiagram.value = false
        } else {
             svgContent.value = ''
             noDiagram.value = true
        }
    } catch (e) {
        svgContent.value = ''
        noDiagram.value = true
    } finally {
        isLoading.value = false
    }
}

// --- Watchers ---
watch(() => tenantStore.selectedTenantId, loadSvg, { immediate: true })

watch([range, () => tenantStore.selectedTenantId], () => {
   if (svgContainer.value) {
       // Only re-apply manager subscriptions since the bindings (elements & configs) are already saved
       applyBindingsToManagers();
   }
});

watch(processedSvg, () => {
  nextTick(() => {
    parseDrawioObjects()
    setTimeout(() => { centerAndFitDiagram() }, 100)
  })
})

// --- Lifecycle ---
onMounted(() => {
  setTimeout(() => { centerAndFitDiagram() }, 200)
  nextTick(() => { parseDrawioObjects() });
})

onUnmounted(() => {
  registeredCurrentIds.forEach(id => currentDataManager?.unregister(id));
  aggregationManager?.unregister(subscriberId);
})
</script>

<style scoped>
/* The dotted background is handled via the computed style binding */
</style>