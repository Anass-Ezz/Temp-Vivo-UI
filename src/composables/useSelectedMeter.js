/**
 * Resolves the currently selected electricity meter context for views using the :meterReference parameter.
 * @module useSelectedMeter
 */
// src/composables/useSelectedMeter.js
import { computed, inject } from 'vue';
import { useRoute } from 'vue-router';
import { config } from '@/config/config.js';
import { isEdgeQueryable, normalizeString } from '@/utils/edgeAvailability.js';

/**
 * @typedef {Object} SelectedMeterContext
 * @property {ComputedRef<Object|null>} selectedMeter - The resolved active meter object.
 * @property {ComputedRef<string>} edgeId - Target Edge identity for JSON-RPC.
 * @property {ComputedRef<string>} componentName - Resolved OSGi component name.
 * @property {ComputedRef<string>} channelPrefix - Normalized channel prefix (e.g., 'meter0/').
 * @property {ComputedRef<boolean>} isQueryableEdge - Status indicating if the Edge is reachable.
 */

/**
 * Resolves the currently selected electricity meter from config.meters
 * based on the :meterReference route param.
 * Falls back to the first meter in config if the param is missing or unknown.
 *
 * @returns {SelectedMeterContext} Resolved reactive references.
 */
export function useSelectedMeter() {
    const route = useRoute();
    const edges = inject('edges', null);

    const validMeters = computed(() =>
        (config.meters || []).filter(
            (meter) =>
                normalizeString(meter?.reference) &&
                normalizeString(meter?.name) &&
                normalizeString(meter?.edgeParent)
        )
    );

    // Find the config entry matching the route param, fall back to first meter
    const selectedMeter = computed(() => {
        const ref = normalizeString(route.params.meterReference);
        return validMeters.value.find((meter) => meter.reference === ref) ?? validMeters.value[0] ?? null;
    });

    // Convenience values derived from the selected config entry
    /** @type {ComputedRef<string>} Edge identity for JSON-RPC */
    const edgeId = computed(() => normalizeString(selectedMeter.value?.edgeParent));
    /** @type {ComputedRef<string>} OSGi component name */
    const componentName = computed(() => normalizeString(selectedMeter.value?.name));
    /** @type {ComputedRef<boolean>} Online and queryable status */
    const isQueryableEdge = computed(() => isEdgeQueryable(edgeId.value, edges, { onlineOnly: true }));
    /** @type {ComputedRef<string>} Channel prefix e.g 'meter0/' */
    const channelPrefix = computed(() => (componentName.value ? `${componentName.value}/` : ''));

    return { selectedMeter, edgeId, componentName, channelPrefix, isQueryableEdge };
}
