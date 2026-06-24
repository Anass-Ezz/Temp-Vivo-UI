import { ref } from 'vue'

// Module-level refs — shared across all component instances on the same page
const faultCount = ref(0)
const warningCount = ref(0)

/**
 * Composable that exposes shared module-level alert counters for fault and warning states.
 * Counts are updated externally by the alert polling logic and consumed by header/badge components.
 *
 * @returns {{ faultCount: Ref, warningCount: Ref }}
 */
export function useMeterAlertCounts() {
  return { faultCount, warningCount }
}
