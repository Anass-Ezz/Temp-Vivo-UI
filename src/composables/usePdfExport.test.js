import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

// --- Hoisted mock refs (must be declared before vi.mock calls) ---
const { mockToastAdd, mockHtml2canvas, mockPdfSave, mockPdfAddImage, mockPdfAddPage, MockJsPDF } =
    vi.hoisted(() => {
        const mockToastAdd = vi.fn()
        const mockHtml2canvas = vi.fn()
        const mockPdfSave = vi.fn()
        const mockPdfAddImage = vi.fn()
        const mockPdfAddPage = vi.fn()
        const MockJsPDF = vi.fn(() => ({
            internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
            addImage: mockPdfAddImage,
            addPage: mockPdfAddPage,
            save: mockPdfSave
        }))
        return { mockToastAdd, mockHtml2canvas, mockPdfSave, mockPdfAddImage, mockPdfAddPage, MockJsPDF }
    })

vi.mock('primevue/usetoast', () => ({
    useToast: () => ({ add: mockToastAdd })
}))

vi.mock('vue-router', () => ({
    useRouter: () => ({ currentRoute: { value: { name: 'test-page' } } })
}))

vi.mock('html2canvas', () => ({ default: mockHtml2canvas }))

vi.mock('jspdf', () => ({ jsPDF: MockJsPDF }))

import { formatTitle, buildTimestamp, buildFilename, usePdfExport } from './usePdfExport.js'

// ---------------------------------------------------------------------------
// Unit tests — pure functions
// ---------------------------------------------------------------------------

describe('formatTitle', () => {
    it('single word', () => {
        expect(formatTitle('dashboard')).toBe('Dashboard')
    })

    it('multi-word hyphenated', () => {
        expect(formatTitle('alert-history')).toBe('Alert History')
    })

    it('name with numbers', () => {
        expect(formatTitle('meter-1-data')).toBe('Meter 1 Data')
    })

    it('null input returns null', () => {
        expect(formatTitle(null)).toBeNull()
    })

    it('undefined input returns null', () => {
        expect(formatTitle(undefined)).toBeNull()
    })
})

describe('buildTimestamp', () => {
    it('produces correct zero-padded output for a known date', () => {
        const date = new Date(2025, 0, 5, 9, 3)
        expect(buildTimestamp(date)).toBe('2025-01-05_09-03')
    })
})

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('Property 1 — formatTitle title-case invariant', () => {
    it('every word starts uppercase, no leading/trailing spaces', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-z]+$/), { minLength: 1 }).map((words) => words.join('-')),
                (routeName) => {
                    const result = formatTitle(routeName)
                    const words = result.split(' ')
                    return (
                        words.every((w) => w.length === 0 || w[0] === w[0].toUpperCase()) &&
                        !result.startsWith(' ') &&
                        !result.endsWith(' ')
                    )
                }
            )
        )
    })
})

describe('Property 2 — buildFilename timestamp format', () => {
    it('always ends in .pdf with correct timestamp pattern', () => {
        fc.assert(
            fc.property(
                fc.option(fc.string({ minLength: 1 }), { nil: null }),
                fc.date(),
                (title, date) => {
                    const filename = buildFilename(title, date)
                    return (
                        filename.endsWith('.pdf') &&
                        /\d{4}-\d{2}-\d{2}_\d{2}-\d{2}/.test(filename)
                    )
                }
            )
        )
    })
})

describe('Property 3 — buildFilename null title uses fallback prefix', () => {
    it('always starts with "export_" when title is null', () => {
        fc.assert(
            fc.property(fc.date(), (date) => {
                return buildFilename(null, date).startsWith('export_')
            })
        )
    })
})

// ---------------------------------------------------------------------------
// Integration tests — exportPage()
// ---------------------------------------------------------------------------

function makeFakeElement(scrollWidth = 1200, scrollHeight = 800) {
    return { scrollWidth, scrollHeight }
}

function makeFakeCanvas(width = 1200, height = 800) {
    return {
        width,
        height,
        toDataURL: () => 'data:image/png;base64,fake'
    }
}

describe('exportPage integration tests', () => {
    let mockQuerySelector

    beforeEach(() => {
        vi.clearAllMocks()
        // Provide a global document mock since the test environment is 'node'
        mockQuerySelector = vi.fn()
        global.document = { querySelector: mockQuerySelector }
        global.window = { scrollY: 0 }
    })

    afterEach(() => {
        delete global.document
        delete global.window
    })

    it('4.6 isExporting is false after successful export (Property 4 success)', async () => {
        mockQuerySelector.mockReturnValue(makeFakeElement())
        mockHtml2canvas.mockResolvedValue(makeFakeCanvas())

        const { isExporting, exportPage } = usePdfExport()
        await exportPage()

        expect(isExporting.value).toBe(false)
    })

    it('4.7 isExporting is false after html2canvas rejects (Property 4 error)', async () => {
        mockQuerySelector.mockReturnValue(makeFakeElement())
        mockHtml2canvas.mockRejectedValue(new Error('canvas error'))

        const { isExporting, exportPage } = usePdfExport()
        await exportPage()

        expect(isExporting.value).toBe(false)
    })

    it('4.8 second exportPage call while exporting does not invoke html2canvas again (Property 5)', async () => {
        mockQuerySelector.mockReturnValue(makeFakeElement())
        let resolveCanvas
        mockHtml2canvas.mockReturnValue(new Promise((res) => { resolveCanvas = res }))

        const { exportPage } = usePdfExport()
        const first = exportPage()
        const second = exportPage()

        resolveCanvas(makeFakeCanvas())
        await first
        await second

        expect(mockHtml2canvas).toHaveBeenCalledTimes(1)
    })

    it('4.9 when querySelector returns null, console.error and toast are called', async () => {
        mockQuerySelector.mockReturnValue(null)
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const { exportPage } = usePdfExport()
        await exportPage()

        expect(consoleSpy).toHaveBeenCalledWith('PDF export: .layout-main element not found')
        expect(mockToastAdd).toHaveBeenCalledWith({
            severity: 'error',
            summary: 'PDF export failed. Please try again.'
        })

        consoleSpy.mockRestore()
    })

    it('4.10 html2canvas called with .layout-main element and scroll dimension options', async () => {
        const fakeElement = makeFakeElement(1200, 800)
        mockQuerySelector.mockReturnValue(fakeElement)
        mockHtml2canvas.mockResolvedValue(makeFakeCanvas())

        const { exportPage } = usePdfExport()
        await exportPage()

        expect(mockHtml2canvas).toHaveBeenCalledWith(fakeElement, {
            scale: 2,
            useCORS: true,
            scrollX: 0,
            scrollY: expect.any(Number),
            windowWidth: 1200,
            windowHeight: 800
        })
    })
})
