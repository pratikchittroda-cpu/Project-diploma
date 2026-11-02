import { auth } from '../config/firebase';
import { AI_API_BASE_URL, API_BASE_URL } from '../config/publicConfig';
import { AI_FEATURES_ENABLED, SERVER_FEATURES_ENABLED } from '../config/releaseFeatures';

const AI_ROUTES = new Set(['/financial-chat', '/categorize', '/parse-receipt']);
const ROUTES = new Set([...AI_ROUTES, '/report', '/account/delete']);
const TIMEOUT_MS = 30000;
let appCheckTokenProvider = null;

// Wire a platform App Check SDK before enabling backend enforcement. No debug
// token is compiled into the client. An unset provider sends no attestation.
export function setBackendAppCheckTokenProvider(provider) {
    appCheckTokenProvider = typeof provider === 'function' ? provider : null;
}

function failure(code, message, status = 0) {
    return Object.assign(new Error(message), { code, status });
}

export async function requestBackend(path, payload, { signal } = {}) {
    if (!ROUTES.has(path)) throw failure('backend/invalid-route', 'Unknown service route.');
    const aiRoute = AI_ROUTES.has(path);
    if (aiRoute ? !(AI_FEATURES_ENABLED || SERVER_FEATURES_ENABLED) : !SERVER_FEATURES_ENABLED) {
        throw failure('backend/disabled', aiRoute
            ? 'The secure AI connection is not enabled in this build.'
            : 'This server feature is not enabled in this build.');
    }
    const baseUrl = aiRoute ? (AI_API_BASE_URL || API_BASE_URL) : API_BASE_URL;
    try {
        const url = new URL(baseUrl);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
            /\s/.test(baseUrl) || /(^|\.)(localhost|example\.(com|org|net)|invalid|test)$/.test(url.hostname) ||
            /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) throw new Error();
    } catch {
        throw failure('backend/not-configured', aiRoute
            ? 'The secure AI service is not configured. Set its HTTPS API connection first.'
            : 'The secure service is not configured.');
    }
    const user = auth.currentUser;
    if (!user) throw failure('auth/unauthenticated', 'Please sign in again.', 401);
    if (signal?.aborted) throw failure('backend/cancelled', 'Request cancelled.');

    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel);
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
    // Promise.race also bounds token retrieval, which has no AbortSignal API.
    let removeAbort;
    const aborted = new Promise((_, reject) => {
        const handler = () => reject(failure(timedOut ? 'backend/timeout' : 'backend/cancelled',
            timedOut ? 'The request timed out. Check status before retrying.' : 'Request cancelled.'));
        controller.signal.addEventListener('abort', handler);
        removeAbort = () => controller.signal.removeEventListener('abort', handler);
    });
    try {
        return await Promise.race([aborted, (async () => {
            const token = await user.getIdToken();
            if (controller.signal.aborted) throw failure('backend/cancelled', 'Request cancelled.');
            if (auth.currentUser !== user) throw failure('auth/session-changed', 'Account changed.');
            const appCheckToken = appCheckTokenProvider ? await appCheckTokenProvider() : null;
            if (controller.signal.aborted) throw failure('backend/cancelled', 'Request cancelled.');
            if (auth.currentUser !== user) throw failure('auth/session-changed', 'Account changed.');
            const response = await fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
                redirect: 'error',
            });
            const text = await response.text();
            if (controller.signal.aborted) throw failure('backend/cancelled', 'Request cancelled.');
            if (text.length > 65536) throw failure('backend/invalid-response', 'Invalid service response.');
            let data;
            try { data = JSON.parse(text); } catch { throw failure('backend/invalid-response', 'Invalid service response.', response.status); }
            if (auth.currentUser !== user) throw failure('auth/session-changed', 'Account changed.');
            if (!response.ok) throw failure(data?.code || 'backend/unavailable', data?.error || 'Service unavailable.', response.status);
            return data;
        })()]);
    } catch (error) {
        if (error.code) throw error;
        throw failure('backend/unavailable', 'Unable to reach the secure service.');
    } finally {
        clearTimeout(timer);
        removeAbort?.();
        signal?.removeEventListener('abort', cancel);
    }
}
