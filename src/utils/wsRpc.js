
/**
 * Waits for a WebSocket connection to reach the OPEN state.
 *
 * @param {WebSocket} ws - The active WebSocket instance to monitor.
 * @returns {Promise<void>} Resolves when open, rejects if closed or error bounds met.
 */
export function waitForSocketOpen(ws) {
    return new Promise((resolve, reject) => {
        if (!ws) {
            reject(new Error('WebSocket is not available.'));
            return;
        }

        if (ws.readyState === WebSocket.OPEN) {
            resolve();
            return;
        }

        if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
            reject(new Error('WebSocket is not open.'));
            return;
        }

        const cleanup = () => {
            ws.removeEventListener('open', handleOpen);
            ws.removeEventListener('error', handleError);
        };

        const handleOpen = () => {
            cleanup();
            resolve();
        };

        const handleError = () => {
            cleanup();
            reject(new Error('WebSocket failed to open.'));
        };

        ws.addEventListener('open', handleOpen, { once: true });
        ws.addEventListener('error', handleError, { once: true });
    });
}

/**
 * Sends a JSON-RPC 2.0 payload over an active WebSocket connection.
 * Automatically waits for the socket to open before transmitting.
 *
 * @param {WebSocket} ws - The connected or connecting WebSocket instance.
 * @param {string} method - The RPC method string to call.
 * @param {Object} [params={}] - The JSON-RPC params object or array.
 * @param {Object} [options={}] - Request options mapping.
 * @param {number} [options.timeoutMs=15000] - Duration in ms before the request times out.
 * @returns {Promise<any>} Resolves with the RPC generic result object payload.
 */
export async function sendWsRpc(ws, method, params = {}, options = {}) {
    const { timeoutMs = 15000 } = options;

    await waitForSocketOpen(ws);

    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        let timeoutId = null;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            ws.removeEventListener('message', handleMessage);
        };

        const handleMessage = (event) => {
            let message;

            try {
                message = JSON.parse(event.data);
            } catch {
                return;
            }

            if (message.id !== id) {
                return;
            }

            cleanup();

            if (message.error) {
                reject(new Error(message.error.message || `RPC error while calling ${method}.`));
                return;
            }

            resolve(message.result);
        };

        timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error(`Timed out while calling ${method}.`));
        }, timeoutMs);

        ws.addEventListener('message', handleMessage);
        ws.send(
            JSON.stringify({
                jsonrpc: '2.0',
                id,
                method,
                params
            })
        );
    });
}
