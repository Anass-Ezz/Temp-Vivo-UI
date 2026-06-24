import { getStoredToken } from '@/utils/auth'

const ENDPOINT = '/api/logs/events'
const FLUSH_DELAY_MS = 800
const MAX_BATCH_SIZE = 20

let queue = []
let timer = null

function getStoredUser() {
    try {
        return JSON.parse(sessionStorage.getItem('ems_user') || localStorage.getItem('ems_user') || 'null')
    } catch {
        return null
    }
}

function getBrowserReportedIdentity() {
    const user = getStoredUser()
    if (!user) return {}

    const userId = user.id || user.uid || user.userId || user.email || user.login || null
    const userEmail = user.email || user.login || user.id || null
    const userRole = user.globalRole || user.role || null
    const userName = user.name || null

    return { userId, userEmail, userRole, userName }
}

function scheduleFlush() {
    if (timer) return
    timer = window.setTimeout(flush, FLUSH_DELAY_MS)
}

export function track(event, payload = {}) {
    const identity = getBrowserReportedIdentity()
    queue.push({
        event,
        category: payload.category || 'analytics',
        app: 'ems-dashboard',
        service: payload.service,
        result: payload.result || 'success',
        page: payload.page || window.location.pathname,
        routeName: payload.routeName,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        userId: payload.userId || identity.userId,
        userEmail: payload.userEmail || identity.userEmail,
        userRole: payload.userRole || identity.userRole,
        requiresToken: payload.requiresToken !== false,
        metadata: {
            ...(payload.metadata || {}),
            ...(identity.userName ? { userName: identity.userName } : {})
        }
    })

    if (queue.length >= MAX_BATCH_SIZE) {
        flush()
        return
    }
    scheduleFlush()
}

function prepareEvent(event) {
    const { requiresToken, ...payload } = event
    return payload
}

async function sendEvents(events, token = null) {
    if (!events.length) return

    const headers = { 'Content-Type': 'application/json' }
    if (token) {
        headers['X-EMS-Token'] = token
    }

    await fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ events: events.map(prepareEvent) })
    })
}

export async function flush() {
    if (timer) {
        window.clearTimeout(timer)
        timer = null
    }
    if (!queue.length) return

    const token = getStoredToken()
    const batch = queue.splice(0, MAX_BATCH_SIZE)
    const tokenEvents = token ? batch.filter((event) => event.requiresToken !== false) : []
    const anonymousEvents = batch.filter((event) => event.requiresToken === false)

    try {
        await sendEvents(anonymousEvents)
        await sendEvents(tokenEvents, token)
    } catch {
        // Activity logging should never interrupt the EMS dashboard.
    }

    if (queue.length) scheduleFlush()
}

if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush()
    })
}
