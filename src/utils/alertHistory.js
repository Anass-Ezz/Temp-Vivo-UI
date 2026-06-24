/**
 * Alert History utility functions
 *
 * Utilities for building channel addresses, flattening backend transition
 * responses into TransitionRow objects, and applying client-side filters.
 */

/**
 * Build a flat, deduplicated array of channel address strings from selected
 * components and the channel metadata cache.
 *
 * @param {Array<{edgeId: string, componentId: string}>} selectedComponents
 * @param {Map<string, {text: string, level: string}>} channelMetaCache
 *   Keyed by "edgeId/componentId/channelId"
 * @returns {string[]} Unique addresses in "edgeId/componentId/channelId" format
 *
 * Requirements: 6.3
 */
export function buildChannelAddresses(selectedComponents, channelMetaCache) {
  const seen = new Set();
  const addresses = [];

  for (const { edgeId, componentId } of selectedComponents) {
    const prefix = `${edgeId}/${componentId}/`;
    for (const key of channelMetaCache.keys()) {
      if (key.startsWith(prefix)) {
        if (!seen.has(key)) {
          seen.add(key);
          addresses.push(key);
        }
      }
    }
  }

  return addresses;
}

/**
 * Flatten the per-channel backend response into a sorted list of TransitionRow objects.
 *
 * Channels with transitions produce normal rows (timestamp + direction).
 * Channels with no transitions but a known last value produce a single "static"
 * row (no timestamp, no direction) so the UI can show their persisted state.
 *
 * @param {Object.<string, {timestamps: string[], data: number[], staticValue: number|null}>} response
 *   Keys are "edgeId/componentId/channelId".
 * @param {Map<string, {text: string, level: string}>} channelMetaCache
 *   Keyed by "edgeId/componentId/channelId"
 * @returns {TransitionRow[]} Transition rows sorted newest-first, followed by static rows
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */
export function flattenTransitions(response, channelMetaCache) {
  const rows = [];
  const staticRows = [];

  for (const [channelAddress, series] of Object.entries(response)) {
    const parts = channelAddress.split('/');
    const channelId = parts[parts.length - 1];
    const componentId = parts[parts.length - 2];
    const edgeId = parts.slice(0, parts.length - 2).join('/');

    const meta = channelMetaCache.get(channelAddress);
    const channelText = meta ? meta.text : channelId;
    const level = meta ? meta.level || meta.severity : 'UNKNOWN';
    const alertType = meta ? meta.type : channelId;
    const description = meta ? meta.description : channelText;
    const source = meta ? meta.source : 'edge';
    const activeValues = meta?.activeValues ?? [1];

    const { timestamps = [], data = [], staticValue = null } = series || {};
    const isActiveValue = (value) => activeValues.includes(value);

    if (data.length > 0) {
      // Normal transition rows
      for (let i = 0; i < data.length; i++) {
        const rawValue = data[i];

        rows.push({
          timestamp: timestamps[i],
          direction: rawValue,
          eventKind: isActiveValue(rawValue) ? 'fired' : 'recovered',
          channelId,
          componentId,
          edgeId,
          channelText,
          level,
          alertType,
          description,
          source,
          isStatic: false
        });
      }
    } else if (staticValue !== null && isActiveValue(staticValue)) {
      // Static row — channel had no transitions in the period but is active
      staticRows.push({
        timestamp: null,
        direction: staticValue ?? null,
        eventKind: 'static',
        channelId,
        componentId,
        edgeId,
        channelText,
        level,
        alertType,
        description,
        source,
        isStatic: true
      });
    }
  }

  // Sort transition rows descending (newest first)
  rows.sort((a, b) => (a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0));

  // Static rows appended after all transition rows, sorted by channelId for consistency
  staticRows.sort((a, b) => a.channelId.localeCompare(b.channelId));

  return [...rows, ...staticRows];
}

/**
 * Apply client-side filters to a list of TransitionRow objects.
 *
 * @param {TransitionRow[]} rows
 * @param {'all'|'fired'|'normal'} transitionType
 *   'fired'  → keep only direction === 1 (normal→fired)
 *   'normal' → keep only direction === 0 (fired→normal)
 *   'all'    → no direction filter
 * @param {string[]} levels  Non-empty array restricts to matching levels; empty = no filter
 * @param {string[]} alertTypes  Non-empty array restricts to matching alert types; empty = no filter
 * @returns {TransitionRow[]}
 *
 * Requirements: 3.3, 3.4, 3.5, 3.6
 */
export function applyFilters(rows, transitionType, levels, alertTypes = []) {
  let result = rows;

  if (transitionType === 'fired') {
    result = result.filter((r) => (r.eventKind ?? (r.direction === 1 ? 'fired' : 'recovered')) === 'fired');
  } else if (transitionType === 'normal') {
    result = result.filter((r) => (r.eventKind ?? (r.direction === 1 ? 'fired' : 'recovered')) === 'recovered');
  }

  if (levels && levels.length > 0) {
    const levelSet = new Set(levels);
    result = result.filter((r) => levelSet.has(r.level));
  }

  if (alertTypes && alertTypes.length > 0) {
    const typeSet = new Set(alertTypes);
    result = result.filter((r) => typeSet.has(r.alertType));
  }

  return result;
}