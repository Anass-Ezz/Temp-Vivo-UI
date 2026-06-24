

/**
 * Centralized formatting and unit handling utilities
 */

/**
 * Formats a date or timestamp string into a localized date string.
 * 
 * @param {Date|String|Number} date - The date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {String} Formatted date string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('fr-FR', options);
};

/**
 * Formats a date or timestamp string into a localized time string.
 * 
 * @param {Date|String|Number} date - The date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {String} Formatted time string
 */
export const formatTime = (date, options = {}) => {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('fr-FR', options);
};

/**
 * Formats a date or timestamp string into a localized date-time string.
 * 
 * @param {Date|String|Number} date - The date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {String} Formatted date-time string
 */
export const formatDateTime = (date, options = {}) => {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString('fr-FR', options);
};

/**
 * Formats a number with specific fraction digits using the fr-FR locale (e.g., 1 000,50).
 * 
 * @param {Number} v - The value to format
 * @param {Number} min - Minimum fraction digits
 * @param {Number} max - Maximum fraction digits
 * @returns {String} Formatted number string
 */
export const formatNum = (v, min = 0, max = 2) => {
  if (v === null || v === undefined || isNaN(v)) return '-';
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max }).format(v)
}

/**
 * Formats a percentage with a forced sign (+ or -).
 * 
 * @param {Number} v - The value to format
 * @param {Number} [min=2] - Minimum fraction digits for formatting
 * @param {Number} [max=2] - Maximum fraction digits for formatting
 * @returns {String} Formatted string like "+15 %" or "-5 %"
 */
export const signedPct = (v, min = 2, max = 2) => {
  if (v === null || v === undefined || isNaN(v)) return '- %';
  const prefix = v > 0 ? '+' : '';
  const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max }).format(v);
  return `${prefix}${formatted} %`;
}

/**
 * Maps a base unit to its scaling thresholds and derived units.
 * Thresholds must be sorted in descending order.
 */
const UNIT_SCALES = {
  'Wh': [
    { threshold: 1_000_000_000, unit: 'GWh', divider: 1_000_000_000, decimals: 2 },
    { threshold: 1_000_000,     unit: 'MWh', divider: 1_000_000,     decimals: 2 },
    { threshold: 1_000,         unit: 'kWh', divider: 1_000,         decimals: 2 },
    { threshold: 0,             unit: 'Wh',  divider: 1,             decimals: 0 }
  ],
  'W': [
    { threshold: 1_000_000,     unit: 'MW',  divider: 1_000_000,     decimals: 2 },
    { threshold: 1_000,         unit: 'kW',  divider: 1_000,         decimals: 2 },
    { threshold: 0,             unit: 'W',   divider: 1,             decimals: 0 }
  ],
  'var': [
    { threshold: 1_000_000,     unit: 'Mvar', divider: 1_000_000,    decimals: 2 },
    { threshold: 1_000,         unit: 'kvar', divider: 1_000,        decimals: 2 },
    { threshold: 0,             unit: 'var',  divider: 1,            decimals: 0 }
  ],
  'VA': [
    { threshold: 1_000_000,     unit: 'MVA',  divider: 1_000_000,    decimals: 2 },
    { threshold: 1_000,         unit: 'kVA',  divider: 1_000,        decimals: 2 },
    { threshold: 0,             unit: 'VA',   divider: 1,            decimals: 0 }
  ],
  'g': [
    { threshold: 1_000_000,     unit: 't',    divider: 1_000_000,    decimals: 2 },
    { threshold: 1_000,         unit: 'kg',   divider: 1_000,        decimals: 2 },
    { threshold: 0,             unit: 'g',    divider: 1,            decimals: 0 }
  ],
  'kg': [
    { threshold: 1_000,         unit: 't',    divider: 1_000,        decimals: 2 },
    { threshold: 0,             unit: 'kg',   divider: 1,            decimals: 2 }
  ],
  'V': [
    { threshold: 1_000_000,     unit: 'MV',   divider: 1_000_000,    decimals: 2 },
    { threshold: 1_000,         unit: 'kV',   divider: 1_000,        decimals: 2 },
    { threshold: 0,             unit: 'V',    divider: 1,            decimals: 1 }
  ],
  'A': [
    { threshold: 1_000,         unit: 'kA',   divider: 1_000,        decimals: 2 },
    { threshold: 0,             unit: 'A',    divider: 1,            decimals: 2 }
  ],
  'Hz': [
    { threshold: 1_000,         unit: 'kHz',  divider: 1_000,        decimals: 2 },
    { threshold: 0,             unit: 'Hz',   divider: 1,            decimals: 2 }
  ],
  // milli-units — stored as mV, mA, mHz by OpenEMS
  'mV': [
    { threshold: 1_000_000_000, unit: 'MV',   divider: 1_000_000_000, decimals: 2 },
    { threshold: 1_000_000,     unit: 'kV',   divider: 1_000_000,     decimals: 2 },
    { threshold: 1_000,         unit: 'V',    divider: 1_000,         decimals: 1 },
    { threshold: 0,             unit: 'mV',   divider: 1,             decimals: 0 }
  ],
  'mA': [
    { threshold: 1_000_000,     unit: 'kA',   divider: 1_000_000,     decimals: 2 },
    { threshold: 1_000,         unit: 'A',    divider: 1_000,         decimals: 2 },
    { threshold: 0,             unit: 'mA',   divider: 1,             decimals: 1 }
  ],
  'mHz': [
    { threshold: 1_000,         unit: 'Hz',   divider: 1_000,         decimals: 2 },
    { threshold: 0,             unit: 'mHz',  divider: 1,             decimals: 0 }
  ],
  // Reactive / Apparent power
  'VAR': [
    { threshold: 1_000_000,     unit: 'MVAR', divider: 1_000_000,    decimals: 2 },
    { threshold: 1_000,         unit: 'kVAR', divider: 1_000,        decimals: 2 },
    { threshold: 0,             unit: 'VAR',  divider: 1,            decimals: 0 }
  ],
  // Power Factor: stored as integer e.g. 950 → 0.950 (dimensionless ratio /1000)
  'PF': [
    { threshold: 0,             unit: '',     divider: 1_000,         decimals: 3 }
  ]
};

/**
 * Maps a stored (raw) unit to the canonical human-readable display unit
 * used in column headers. This is the unit you'd expect to see for typical
 * real-world values (e.g. mV → V, mA → A, mHz → Hz).
 *
 * For chart axes and table headers — not for cell formatting (use formatValue for that).
 */
export const canonicalUnit = (rawUnit) => {
  const map = {
    'mV':  'V',
    'mA':  'A',
    'mHz': 'Hz',
    'W':   'kW',
    'var': 'kvar',
    'VAR': 'kvar',
    'VA':  'kVA',
    'Wh':  'kWh',
    'g':   'kg',
    'kg':  'kg',
    'PF':  '',       // dimensionless
    '':    '',
  }
  return map[rawUnit] ?? rawUnit
}

/**
 * Dynamically scales a value based on its magnitude and base unit.
 * Examples: 1500 Wh -> 1.5 kWh. 2000000 W -> 2 MW.
 * 
 * @param {Number} value - The initial raw value
 * @param {String} baseUnit - The base unit string (e.g., 'Wh', 'W', 'kg')
 * @returns {Object} { value: Number, unit: String, decimals: Number }
 */
export const formatValue = (value, baseUnit) => {
  if (value === null || value === undefined || isNaN(value)) {
    return { value: 0, unit: baseUnit || '', decimals: 0 };
  }

  // Absolute check to handle negative magnitudes seamlessly (e.g. export vs import)
  const absVal = Math.abs(value);
  const scales = UNIT_SCALES[baseUnit];

  if (scales) {
    for (const scale of scales) {
      if (absVal >= scale.threshold) {
        return {
          value: value / scale.divider,
          unit: scale.unit,
          decimals: scale.decimals
        };
      }
    }
  }

  // Fallback if the unit is not mapped (e.g., 'MAD', '%', 'Hz') or value is exactly 0
  return { value: value, unit: baseUnit, decimals: 2 };
};
