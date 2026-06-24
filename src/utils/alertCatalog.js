import { config } from '@/config/config.js';

/**
 * Ordered list of alert severity levels used for filtering and display.
 * @type {string[]}
 */
export const ALERT_LEVELS = ['INFO', 'WARNING', 'FAULT'];

export const ALERT_TYPE_LABELS = Object.freeze({
    EDGE_OFFLINE: 'Edge offline',
    THRESHOLD: 'Threshold',
    EDGE_COMMUNICATION_FAILURE: 'Edge communication failure',
    LOW_STORAGE: 'Low storage',
    COMPONENT_STATE: 'Component state alert'
});

const OPENEMS_DATA_TYPE_LABELS = new Set([
    'BOOLEAN',
    'BYTE',
    'SHORT',
    'INTEGER',
    'LONG',
    'FLOAT',
    'DOUBLE',
    'STRING',
    'ENUM',
    'UNAVAILABLE',
    'NOT_AVAILABLE'
]);

const ACTIVE_BOOLEAN_VALUES = [1, '1', true];
const ACTIVE_STATE_VALUES = [1, '1', true, 2, '2', 3, '3'];

const EDGE_ALERT_DEFINITIONS = [
    {
        type: ALERT_TYPE_LABELS.EDGE_OFFLINE,
        source: 'edge',
        componentId: '_sum',
        channelId: 'ConnectionState',
        severity: 'FAULT',
        activeValues: [0, '0', false],
        text: 'Edge offline',
        description: 'The edge lost its connection and is considered offline.'
    }
];

const METER_ALERT_DEFINITIONS = [
    {
        type: ALERT_TYPE_LABELS.THRESHOLD,
        source: 'edge',
        channelId: 'HighPower',
        severity: 'WARNING',
        activeValues: ACTIVE_BOOLEAN_VALUES,
        text: 'High power',
        description: 'High power threshold exceeded.'
    },
    {
        type: ALERT_TYPE_LABELS.THRESHOLD,
        source: 'edge',
        channelId: 'OverDailyEnergyLimit',
        severity: 'WARNING',
        activeValues: ACTIVE_BOOLEAN_VALUES,
        text: 'Over daily energy limit',
        description: 'Daily energy limit exceeded.'
    },
    {
        type: ALERT_TYPE_LABELS.EDGE_COMMUNICATION_FAILURE,
        source: 'edge',
        channelId: 'ModbusCommunicationFailure',
        severity: 'WARNING',
        activeValues: ACTIVE_BOOLEAN_VALUES,
        text: 'Modbus communication failed',
        description: 'Modbus communication failed.'
    }
];

const BACKEND_ALERT_DEFINITIONS = [
    {
        type: ALERT_TYPE_LABELS.LOW_STORAGE,
        source: 'backend',
        address: 'backend0/diskspacemonitor0/StateDiskIsLow',
        componentId: 'diskspacemonitor0',
        channelId: 'StateDiskIsLow',
        severity: 'WARNING',
        activeValues: ACTIVE_BOOLEAN_VALUES,
        text: 'Low storage',
        description: 'Backend disk space is low.'
    }
];

function normalizeString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function dedupe(values) {
    return [...new Set(values.map(normalizeString).filter(Boolean))];
}

function findMeterAlertDefinition(channelId) {
    return METER_ALERT_DEFINITIONS.find((definition) => definition.channelId === channelId) || null;
}

function humanizeChannelId(channelId) {
    const normalized = normalizeString(channelId);
    if (!normalized) {
        return '';
    }

    const words = normalized
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    return words.charAt(0).toUpperCase() + words.slice(1);
}

function isCommunicationAlert(channel) {
    const combined = [
        normalizeString(channel?.id),
        normalizeString(channel?.text),
        normalizeString(channel?.description)
    ]
        .filter(Boolean)
        .join(' ');

    return /modbus|communication/i.test(combined);
}

function mergeAlertEntry(current, next) {
    const merged = { ...current, ...next };

    if (isOpenemsDataType(next?.type) && current?.type) {
        merged.type = current.type;
    }

    return merged;
}

export function isOpenemsDataType(value) {
    const normalized = normalizeString(value);
    return Boolean(normalized && OPENEMS_DATA_TYPE_LABELS.has(normalized.toUpperCase()));
}

export function normalizeAlertType(value, fallback = ALERT_TYPE_LABELS.COMPONENT_STATE) {
    const normalized = normalizeString(value);

    if (!normalized || isOpenemsDataType(normalized)) {
        return fallback;
    }

    return normalized;
}

export function classifyMeterStateAlertType(channel) {
    const knownDefinition = findMeterAlertDefinition(normalizeString(channel?.id));

    if (knownDefinition?.type) {
        return knownDefinition.type;
    }

    if (isCommunicationAlert(channel)) {
        return ALERT_TYPE_LABELS.EDGE_COMMUNICATION_FAILURE;
    }

    return ALERT_TYPE_LABELS.THRESHOLD;
}

export function buildMeterStateAlertEntry({ edgeId, componentId, channel }) {
    const normalizedEdgeId = normalizeString(edgeId);
    const normalizedComponentId = normalizeString(componentId);
    const channelId = normalizeString(channel?.id);
    const level = normalizeString(channel?.level || channel?.severity);

    if (!normalizedEdgeId || !normalizedComponentId || !channelId || !['WARNING', 'FAULT'].includes(level)) {
        return null;
    }

    const knownDefinition = findMeterAlertDefinition(channelId);
    const text = normalizeString(channel?.text) || knownDefinition?.text || humanizeChannelId(channelId) || channelId;
    const description = normalizeString(channel?.description) || knownDefinition?.description || text;

    return {
        ...(knownDefinition || {}),
        type: classifyMeterStateAlertType(channel),
        source: 'edge',
        edgeId: normalizedEdgeId,
        componentId: normalizedComponentId,
        channelId,
        severity: level,
        level,
        activeValues: knownDefinition?.activeValues || ACTIVE_STATE_VALUES,
        text,
        description,
        address: `${normalizedEdgeId}/${normalizedComponentId}/${channelId}`
    };
}

export function dedupeAlertCatalog(entries = []) {
    const byAddress = new Map();

    entries.forEach((entry) => {
        const address = normalizeString(entry?.address);

        if (!address) {
            return;
        }

        const next = { ...entry, address };
        const current = byAddress.get(address);
        byAddress.set(address, current ? mergeAlertEntry(current, next) : next);
    });

    return [...byAddress.values()];
}

export function getAlertTypeOptionsFromCatalog(entries = []) {
    return dedupe(entries.map((entry) => normalizeAlertType(entry?.type, null)));
}

/**
 * Returns the subset of configured meters that belong to the given set of edge IDs.
 *
 * @param {string[]} [edgeIds=[]] - List of edge IDs to filter meters by.
 * @returns {Object[]} Array of meter config objects whose edgeParent is in edgeIds.
 */
export function getTenantMeters(edgeIds = []) {
    const edgeSet = new Set(edgeIds);

    return (config.meters || []).filter((meter) => {
        const edgeParent = normalizeString(meter?.edgeParent);
        const meterName = normalizeString(meter?.name);

        return edgeParent && meterName && edgeSet.has(edgeParent);
    });
}

/**
 * Builds the full list of alert definitions for the given edges, including
 * edge-level, meter-level, and backend-level alert entries with resolved channel addresses.
 *
 * @param {string[]} [edgeIds=[]] - Edge IDs to include in the catalog.
 * @returns {Object[]} Flat array of alert definition objects, each with address, edgeId, severity, and type.
 */
export function buildAlertCatalog(edgeIds = []) {
    const normalizedEdgeIds = dedupe(edgeIds);
    const meterComponents = getTenantMeters(normalizedEdgeIds);
    const catalog = [];

    normalizedEdgeIds.forEach((edgeId) => {
        EDGE_ALERT_DEFINITIONS.forEach((definition) => {
            catalog.push({
                ...definition,
                edgeId,
                address: `${edgeId}/${definition.componentId}/${definition.channelId}`
            });
        });
    });

    meterComponents.forEach((meter) => {
        const edgeParent = normalizeString(meter?.edgeParent);
        const meterName = normalizeString(meter?.name);

        if (!edgeParent || !meterName) {
            return;
        }

        METER_ALERT_DEFINITIONS.forEach((definition) => {
            catalog.push({
                ...definition,
                edgeId: edgeParent,
                componentId: meterName,
                address: `${edgeParent}/${meterName}/${definition.channelId}`
            });
        });
    });

    BACKEND_ALERT_DEFINITIONS.forEach((definition) => {
        catalog.push({ ...definition });
    });

    return dedupeAlertCatalog(catalog);
}

/**
 * Builds a Map from channel address to alert definition for O(1) alert lookup during polling.
 *
 * @param {string[]} [edgeIds=[]] - Edge IDs to include.
 * @returns {Map<string, Object>} Map keyed by channel address, valued by alert definition object.
 */
export function buildAlertMetaCache(edgeIds = [], extraEntries = []) {
    return new Map(dedupeAlertCatalog([...buildAlertCatalog(edgeIds), ...extraEntries]).map((entry) => [entry.address, entry]));
}

/**
 * Splits alert catalog entries into separate edge and backend channel address lists.
 * Used to route subscriptions to the correct WebSocket endpoint.
 *
 * @param {Object[]} entries - Alert definition objects (from buildAlertCatalog).
 * @returns {{ edgeChannels: string[], backendChannels: string[] }}
 */
export function splitAlertAddressesBySource(entries) {
    const edgeChannels = [];
    const backendChannels = [];

    entries.forEach((entry) => {
        if (entry.source === 'backend') {
            backendChannels.push(entry.address);
            return;
        }

        edgeChannels.push(entry.address);
    });

    return {
        edgeChannels: dedupe(edgeChannels),
        backendChannels: dedupe(backendChannels)
    };
}

/**
 * Returns a deduplicated list of alert type strings for the given edges, used to populate filter dropdowns.
 *
 * @param {string[]} [edgeIds=[]] - Edge IDs to include.
 * @returns {string[]} Unique alert type labels (e.g. 'Edge offline', 'Threshold', 'Low storage').
 */
export function getAlertTypeOptions(edgeIds = []) {
    return getAlertTypeOptionsFromCatalog(buildAlertCatalog(edgeIds));
}
