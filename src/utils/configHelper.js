// src/utils/configHelper.js
import { config } from '@/config/config'

/**
 * Resolves all OpenEMS channel addresses for a hierarchy node based on its meter depth type.
 *
 * - 'normal' / 'cluster' / 'clusterMeter':
 *     The backend aggregates all sub-meters under the component name itself, so these
 *     are all treated identically — one address: edgeParent/componentName/channel.
 *     The meterClusters list exists for other purposes (e.g. topology display) but is
 *     NOT expanded here.
 *
 * - 'aggregation':
 *     No single aggregated component exists on the backend. The UI must sum multiple
 *     individual meter addresses itself, so each meter in meterAggregation is resolved
 *     to its own address.
 *
 * @param {Object} node    - Hierarchy node with an optional meter property.
 * @param {string} channel - Channel name to append (e.g. 'ActiveConsumptionEnergy').
 * @returns {string[]} Fully qualified channel addresses: edgeId/componentId/channel.
 */
export function getAddressesForNode(node, channel) {
    const addresses = [];

    if (!node.meter) return addresses;

    const { meterDepthType } = node.meter;

    if (meterDepthType === 'normal' || meterDepthType === 'cluster' || meterDepthType === 'clusterMeter') {
        // All three resolve to a single address using the component name directly.
        const meterName = node.meter.normalMeter || node.meter.clusterMeter || node.meter.clusterName;
        if (meterName) {
            // Look up edgeParent from meters first, then meterClusters.
            const entry = config.meters.find(m => m.name === meterName)
                       ?? config.meterClusters.find(c => c.name === meterName);
            if (entry) {
                addresses.push(`${entry.edgeParent}/${meterName}/${channel}`);
            }
        }
    } else if (meterDepthType === 'aggregation') {
        // No backend aggregate — expand each meter individually so the UI can sum them.
        (node.meter.meterAggregation ?? []).forEach(mName => {
            const targetMeter = config.meters.find(m => m.name === mName);
            if (targetMeter) {
                addresses.push(`${targetMeter.edgeParent}/${mName}/${channel}`);
            }
        });
    }

    return addresses;
}
