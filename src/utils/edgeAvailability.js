/**
 * Trims and validates a string value, returning null for empty, non-string, or object-coerced values.
 *
 * @param {*} value - The value to normalize.
 * @returns {string|null} The trimmed string, or null if invalid.
 */
export function normalizeString(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();
    if (!normalized || normalized === '[object Object]') {
        return null;
    }

    return normalized;
}

function getEdgeList(edges) {
    if (Array.isArray(edges?.list)) {
        return edges.list;
    }

    if (Array.isArray(edges)) {
        return edges;
    }

    return [];
}

/**
 * Returns the set of valid edge IDs from an edge list or edges object, optionally restricted to online edges.
 *
 * @param {Object|Array} edges - Either an array of edge objects or an object with a `list` array property.
 * @param {Object} [options={}]
 * @param {boolean} [options.onlineOnly=false] - If true, excludes edges where isOnline is not true.
 * @returns {Set<string>} Set of normalized edge ID strings.
 */
export function getQueryableEdgeIds(edges, { onlineOnly = false } = {}) {
    const ids = new Set();

    getEdgeList(edges).forEach((edge) => {
        const id = normalizeString(edge?.id);
        if (!id) {
            return;
        }

        if (onlineOnly && edge?.isOnline !== true) {
            return;
        }

        ids.add(id);
    });

    return ids;
}

/**
 * Checks whether a specific edge ID is present in the queryable set.
 *
 * @param {string} edgeId - The edge ID to check.
 * @param {Object|Array} edges - Edge list or edges object.
 * @param {Object} [options={}] - Options forwarded to getQueryableEdgeIds (e.g. onlineOnly).
 * @returns {boolean} True if the edge is queryable, false otherwise.
 */
export function isEdgeQueryable(edgeId, edges, options = {}) {
    const normalizedEdgeId = normalizeString(edgeId);
    if (!normalizedEdgeId) {
        return false;
    }

    return getQueryableEdgeIds(edges, options).has(normalizedEdgeId);
}

/**
 * Filters and deduplicates a list of channel address strings, removing malformed entries
 * and optionally restricting to queryable edges.
 *
 * @param {string[]} channels - Raw channel address strings in edgeId/componentId/channelId format.
 * @param {Set<string>|null} [queryableEdgeIds=null] - If provided, only addresses from these edges are kept.
 * @returns {string[]} Cleaned, deduplicated channel address strings.
 */
export function filterChannelAddresses(channels, queryableEdgeIds = null) {
    const filtered = [];
    const seen = new Set();

    (channels || []).forEach((channel) => {
        const normalizedAddress = normalizeString(channel);
        if (!normalizedAddress) {
            return;
        }

        const parts = normalizedAddress.split('/');
        if (parts.length < 3) {
            return;
        }

        const edgeId = normalizeString(parts[0]);
        const componentChannel = normalizeString(parts.slice(1).join('/'));

        if (!edgeId || !componentChannel || componentChannel.includes('[object Object]')) {
            return;
        }

        if (queryableEdgeIds && !queryableEdgeIds.has(edgeId)) {
            return;
        }

        const rebuilt = `${edgeId}/${componentChannel}`;
        if (seen.has(rebuilt)) {
            return;
        }

        seen.add(rebuilt);
        filtered.push(rebuilt);
    });

    return filtered;
}

/**
 * Filters an array of aggregation request objects, removing those whose channel lists
 * become empty after filtering for queryable edges.
 *
 * @param {Object[]} aggregations - Aggregation request objects each with a channels array.
 * @param {Set<string>|null} [queryableEdgeIds=null] - If provided, restricts channels to these edges.
 * @returns {Object[]} Aggregation objects with non-empty filtered channel lists.
 */
export function filterAggregationRequests(aggregations, queryableEdgeIds = null) {
    return (aggregations || [])
        .map((aggregation) => {
            const channels = filterChannelAddresses(aggregation?.channels || [], queryableEdgeIds);
            if (channels.length === 0) {
                return null;
            }

            return {
                ...aggregation,
                channels
            };
        })
        .filter(Boolean);
}
