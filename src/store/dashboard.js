import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * Pinia store managing the active time range and hierarchy depth for the main dashboard.
 * Time range drives all historical energy chart queries; hierarchy level controls
 * which aggregation depth is displayed in the multi-site view.
 *
 * @returns {{ range: Ref, rangeLabel: ComputedRef, setRange: Function,
 *   hierarchyLevel: Ref, setHierarchyLevel: Function }}
 */
export const useDashboardStore = defineStore('dashboard', () => {
  const range = ref('TODAY') 

  const rangeLabel = computed(() => {
    switch(range.value) {
      case 'LAST_24_HOURS': return 'Last 24 Hours'
      case 'LAST_7_DAYS': return 'Last 7 Days'
      case 'LAST_30_DAYS': return 'Last 30 Days'
      case 'TODAY': return 'Today'
      case 'THIS_MONTH': return 'This Month'
      default: return 'Last 24 Hours'
    }
  })

  function setRange(newRange) {
    range.value = newRange
  }

  const hierarchyLevel = ref(0) // Default to Level 0

  function setHierarchyLevel(newLevel) {
    hierarchyLevel.value = newLevel
  }

  return {
    range,
    rangeLabel,
    setRange,
    hierarchyLevel,
    setHierarchyLevel
  }
})
