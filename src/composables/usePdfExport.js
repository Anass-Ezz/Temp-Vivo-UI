import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/**
 * Formats a Vue Router route name (hyphen-separated) into title case.
 * e.g. "alert-history" → "Alert History"
 * Returns null if routeName is null or undefined.
 * 
 * @param {string|null} routeName - The router name string to transform.
 * @returns {string|null} The capitalized and spaced title string.
 */
export function formatTitle(routeName) {
    if (routeName == null) return null
    return routeName
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

/**
 * Builds a timestamp string in "YYYY-MM-DD_HH-mm" format.
 * 
 * @param {Date} date - The Javascript Date instance.
 * @returns {string} Formatted timestamp suffix.
 */
export function buildTimestamp(date) {
    const pad = (n) => String(n).padStart(2, '0')
    const yyyy = date.getFullYear()
    const mm = pad(date.getMonth() + 1)
    const dd = pad(date.getDate())
    const hh = pad(date.getHours())
    const min = pad(date.getMinutes())
    return `${yyyy}-${mm}-${dd}_${hh}-${min}`
}

/**
 * Builds the export filename from a title and date.
 * Falls back to "export_{timestamp}.pdf" when title is null.
 * 
 * @param {string|null} title - Formatted human-readable page title.
 * @param {Date} date - Javascript Date used for chronological uniqueness.
 * @returns {string} The final target filename for the browser export.
 */
export function buildFilename(title, date) {
    const ts = buildTimestamp(date)
    if (title == null) return `export_${ts}.pdf`
    return `${title}_${ts}.pdf`
}

/**
 * @typedef {Object} PdfExportState
 * @property {Ref<boolean>} isExporting - Tracks active export status.
 * @property {Function} exportPage - Triggers the document capture process.
 */

/**
 * Contextual composable for capturing the current UI layout and encoding it to a downloadable PDF.
 * 
 * @returns {PdfExportState} Composable state interface.
 */
export function usePdfExport() {
    const isExporting = ref(false)
    const router = useRouter()
    const toast = useToast()

    async function exportPage() {
        if (isExporting.value) return

        isExporting.value = true

        const element = document.querySelector('.layout-main')

        if (element == null) {
            toast.add({ severity: 'error', summary: 'PDF export failed. Please try again.' })
            isExporting.value = false
            return
        }

        try {
            const routeName = router.currentRoute.value.name
            const title = formatTitle(routeName)
            const filename = buildFilename(title, new Date())

            // Read the actual background color from the element so the PDF
            // matches the rendered theme instead of defaulting to white.
            const bgColor = window.getComputedStyle(element).backgroundColor
            const resolvedBg = (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent')
                ? bgColor
                : '#0f172a'

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                backgroundColor: resolvedBg
            })

            const imgData = canvas.toDataURL('image/png')

            // Use landscape if the content is wider than tall, otherwise portrait
            const isLandscape = canvas.width > canvas.height
            const pdf = new jsPDF({
                orientation: isLandscape ? 'landscape' : 'portrait',
                unit: 'px',
                format: [canvas.width / 2, canvas.height / 2]
            })

            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
            pdf.save(filename)
        } catch (error) {
            toast.add({ severity: 'error', summary: 'PDF export failed. Please try again.' })
        } finally {
            isExporting.value = false
        }
    }

    return { isExporting, exportPage }
}
