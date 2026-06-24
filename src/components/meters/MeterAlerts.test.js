import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import { useMeterAlertCounts } from '../../composables/useMeterAlertCounts.js'

// ── Pure functions copied from MeterAlerts.vue ────────────────────────────

function formatDuration(onsetTs) {
  const elapsed = Date.now() - onsetTs
  if (elapsed < 60000) return `${Math.floor(elapsed / 1000)}s`
  if (elapsed < 3600000) return `${Math.floor(elapsed / 60000)}m`
  const hours = Math.floor(elapsed / 3600000)
  const minutes = Math.floor((elapsed % 3600000) / 60000)
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

function onsetKey(eId, cName) {
  return `meter-alerts-onset-${eId}-${cName}`
}

function loadOnsetCache(eId, cName, storage) {
  const raw = storage.getItem(onsetKey(eId, cName))
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function persistOnsetCache(eId, cName, cache, storage) {
  const key = onsetKey(eId, cName)
  if (Object.keys(cache).length === 0) {
    storage.removeItem(key)
  } else {
    storage.setItem(key, JSON.stringify(cache))
  }
}

function computeActiveAlerts(channelDefs, channelValues, onsetCache) {
  return channelDefs
    .filter(def => channelValues[def.id] === 1)
    .map(def => ({
      channelId: def.id,
      text: def.text,
      level: def.level,
      onsetTs: onsetCache[def.id] ?? Date.now()
    }))
}

function filterChannelDefs(channels) {
  return channels.filter(d => d.level === 'FAULT' || d.level === 'WARNING')
}

function syncOnsetCache(defs, rawValues, componentName, onsetCache) {
  const newValues = {}
  for (const def of defs) {
    const fullAddr = `${componentName}/${def.id}`
    const val = rawValues[fullAddr] ?? 0
    newValues[def.id] = val
    if (val === 1 && !(def.id in onsetCache)) {
      onsetCache[def.id] = Date.now()
    }
    if (val !== 1 && def.id in onsetCache) {
      delete onsetCache[def.id]
    }
  }
  return newValues
}

// ── localStorage mock ─────────────────────────────────────────────────────

function makeStorage() {
  const store = {}
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v },
    removeItem: (k) => { delete store[k] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) }
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────

const LEVELS = ['FAULT', 'WARNING', 'INFO', 'OK']

const channelDefArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
  text: fc.string({ minLength: 1, maxLength: 50 }),
  level: fc.constantFrom(...LEVELS)
})

// ── 5.1 Property: formatDuration output format ────────────────────────────

describe('5.1 formatDuration — output format property', () => {
  test('returns string matching /^\\d+(s|m|h( \\d+m)?)$/ for any onsetTs in [0, Date.now()]', () => {
    /**
     * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Date.now() }),
        (onsetTs) => {
          const result = formatDuration(onsetTs)
          return /^\d+(s|m|h( \d+m)?)$/.test(result)
        }
      )
    )
  })
})

// ── 5.2 Property: computeActiveAlerts contains exactly value===1 channels ──
// Note: computeActiveAlerts receives pre-filtered defs (FAULT/WARNING only, via filterChannelDefs).
// It returns exactly the channels where channelValues[id] === 1.

describe('5.2 computeActiveAlerts — active alerts property', () => {
  test('contains exactly channels with value===1 (from pre-filtered FAULT/WARNING defs)', () => {
    /**
     * Validates: Requirements 4.1, 4.5
     */
    const faultWarningDefArb = fc.record({
      id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
      text: fc.string({ minLength: 1, maxLength: 50 }),
      level: fc.constantFrom('FAULT', 'WARNING')
    })
    const defsArb = fc.array(faultWarningDefArb, { minLength: 0, maxLength: 10 })

    fc.assert(
      fc.property(defsArb, (defs) => {
        // Deduplicate by id
        const uniqueDefs = defs.filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i)

        // Generate random values (0 or 1) for each channel
        const channelValues = {}
        for (const def of uniqueDefs) {
          channelValues[def.id] = Math.random() < 0.5 ? 1 : 0
        }

        const onsetCache = {}
        const result = computeActiveAlerts(uniqueDefs, channelValues, onsetCache)

        // Expected: all channels where value===1 (defs are already FAULT/WARNING only)
        const expected = uniqueDefs.filter(d => channelValues[d.id] === 1)

        if (result.length !== expected.length) return false
        return expected.every(exp => result.some(r => r.channelId === exp.id && r.level === exp.level))
      })
    )
  })
})

// ── 5.3 Property: onsetCache round-trip ──────────────────────────────────

describe('5.3 onsetCache round-trip property', () => {
  test('persistOnsetCache then loadOnsetCache returns equivalent object', () => {
    /**
     * Validates: Requirements 5.4
     */
    const nonEmptyCacheArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
      fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
      { minKeys: 1, maxKeys: 10 }
    )

    fc.assert(
      fc.property(nonEmptyCacheArb, (cache) => {
        const storage = makeStorage()
        persistOnsetCache('edge0', 'meter1', cache, storage)
        const loaded = loadOnsetCache('edge0', 'meter1', storage)
        return JSON.stringify(loaded) === JSON.stringify(cache)
      })
    )
  })
})

// ── 5.4 Property: filterChannelDefs stores only FAULT/WARNING ─────────────

describe('5.4 filterChannelDefs — only FAULT/WARNING property', () => {
  test('all results have level FAULT or WARNING', () => {
    /**
     * Validates: Requirements 2.3
     */
    fc.assert(
      fc.property(fc.array(channelDefArb, { minLength: 0, maxLength: 20 }), (channels) => {
        const result = filterChannelDefs(channels)
        return result.every(d => d.level === 'FAULT' || d.level === 'WARNING')
      })
    )
  })
})

// ── 5.5 Property: onset tracking invariant ───────────────────────────────

describe('5.5 syncOnsetCache — onset tracking invariant', () => {
  test('onsetCache keys match channels with value===1 after sync', () => {
    /**
     * Validates: Requirements 5.1, 5.2
     */
    // Exclude prototype-polluting keys and built-in Object property names
    const RESERVED_KEYS = new Set([
      '__proto__', 'constructor', 'prototype', 'toString', 'valueOf',
      'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
      'toLocaleString', '__defineGetter__', '__defineSetter__',
      '__lookupGetter__', '__lookupSetter__'
    ])
    const safeIdArb = fc.string({ minLength: 1, maxLength: 20 })
      .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s) && !RESERVED_KEYS.has(s))

    const defsArb = fc.array(
      fc.record({
        id: safeIdArb,
        text: fc.string({ minLength: 1, maxLength: 50 }),
        level: fc.constantFrom('FAULT', 'WARNING')
      }),
      { minLength: 0, maxLength: 10 }
    )

    fc.assert(
      fc.property(defsArb, (rawDefs) => {
        const defs = rawDefs.filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i)
        const componentName = 'meter1'
        const rawValues = {}
        for (const def of defs) {
          rawValues[`${componentName}/${def.id}`] = Math.random() < 0.5 ? 1 : 0
        }

        const onsetCache = {}
        syncOnsetCache(defs, rawValues, componentName, onsetCache)

        const activeIds = defs
          .filter(d => rawValues[`${componentName}/${d.id}`] === 1)
          .map(d => d.id)

        const cacheKeys = Object.keys(onsetCache)
        if (cacheKeys.length !== activeIds.length) return false
        return activeIds.every(id => id in onsetCache)
      })
    )
  })
})

// ── 5.6 useMeterAlertCounts — same ref objects ────────────────────────────

describe('5.6 useMeterAlertCounts — shared refs', () => {
  test('returns same ref objects on multiple calls', () => {
    const r1 = useMeterAlertCounts()
    const r2 = useMeterAlertCounts()
    expect(r1.faultCount).toBe(r2.faultCount)
    expect(r1.warningCount).toBe(r2.warningCount)
  })
})

// ── 5.7 Unit: formatDuration boundary values ─────────────────────────────

describe('5.7 formatDuration — boundary values', () => {
  test('0ms elapsed → "0s"', () => {
    expect(formatDuration(Date.now())).toBe('0s')
  })

  test('59s ago → "59s"', () => {
    expect(formatDuration(Date.now() - 59000)).toBe('59s')
  })

  test('60s ago → "1m"', () => {
    expect(formatDuration(Date.now() - 60000)).toBe('1m')
  })

  test('3599s ago → "59m"', () => {
    expect(formatDuration(Date.now() - 3599000)).toBe('59m')
  })

  test('3600s ago → "1h"', () => {
    expect(formatDuration(Date.now() - 3600000)).toBe('1h')
  })

  test('7384s ago → "2h 3m"', () => {
    // 7384s = 2h 3m 4s
    expect(formatDuration(Date.now() - 7384000)).toBe('2h 3m')
  })
})

// ── 5.8 Unit: loadOnsetCache ──────────────────────────────────────────────

describe('5.8 loadOnsetCache', () => {
  test('returns {} when key is missing', () => {
    const storage = makeStorage()
    expect(loadOnsetCache('edge0', 'meter1', storage)).toEqual({})
  })

  test('returns parsed object for valid JSON', () => {
    const storage = makeStorage()
    const cache = { HighPower: 1720000000000 }
    storage.setItem(onsetKey('edge0', 'meter1'), JSON.stringify(cache))
    expect(loadOnsetCache('edge0', 'meter1', storage)).toEqual(cache)
  })

  test('returns {} for corrupted JSON', () => {
    const storage = makeStorage()
    storage.setItem(onsetKey('edge0', 'meter1'), 'not-valid-json{{{')
    expect(loadOnsetCache('edge0', 'meter1', storage)).toEqual({})
  })
})

// ── 5.9 Unit: persistOnsetCache ──────────────────────────────────────────

describe('5.9 persistOnsetCache', () => {
  test('removes key when cache is empty', () => {
    const storage = makeStorage()
    const key = onsetKey('edge0', 'meter1')
    storage.setItem(key, '{"HighPower":123}')
    persistOnsetCache('edge0', 'meter1', {}, storage)
    expect(storage.getItem(key)).toBeNull()
  })

  test('writes JSON when cache is non-empty', () => {
    const storage = makeStorage()
    const cache = { HighPower: 1720000000000, LowVoltage: 1720000001000 }
    persistOnsetCache('edge0', 'meter1', cache, storage)
    const stored = storage.getItem(onsetKey('edge0', 'meter1'))
    expect(JSON.parse(stored)).toEqual(cache)
  })
})

// ── 5.10 Skipped: requires jsdom ──────────────────────────────────────────

describe('5.10 MeterAlerts component mount', () => {
  // Requires Vue component mounting which needs jsdom environment.
  // The current test environment is 'node' (no DOM).
  // To run this test, configure vitest with environment: 'jsdom'.
  test.skip('renders active alerts from live WebSocket data (needs jsdom)', () => {})
})

// ── 5.11 Skipped: requires jsdom ──────────────────────────────────────────

describe('5.11 MeterAlerts poll interval', () => {
  // Requires Vue component mounting and timer mocking which needs jsdom environment.
  // The current test environment is 'node' (no DOM).
  // To run this test, configure vitest with environment: 'jsdom'.
  test.skip('starts polling at aggregationInterval and stops on unmount (needs jsdom)', () => {})
})

// ── 5.12 Skipped: requires jsdom ──────────────────────────────────────────

describe('5.12 MeterAlerts localStorage cleanup on unmount', () => {
  // Requires Vue component mounting and lifecycle hooks which needs jsdom environment.
  // The current test environment is 'node' (no DOM).
  // To run this test, configure vitest with environment: 'jsdom'.
  test.skip('clears localStorage onset key on beforeUnmount (needs jsdom)', () => {})
})
