/**
 * Generates a UUID v4.
 * Provides a fallback for non-secure contexts (HTTP) where crypto.randomUUID is not available.
 */
export function generateUUID() {
    // 1. Try native crypto.randomUUID (Secure Contexts only: HTTPS or localhost)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // 2. Try crypto.getRandomValues (More widely supported than randomUUID)
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        try {
            return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
                (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
            );
        } catch (e) {
            // If getRandomValues fails for some reason, fall through
        }
    }

    // 3. Ultimate fallback using Math.random (Works everywhere, unique enough for RPC IDs)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
