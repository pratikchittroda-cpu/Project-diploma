'use strict';

const { HttpError } = require('./lib/shared.cjs');
const REQUEST_TIMEOUT_MS = 28000;

function discardBody(response) {
  if (!response?.body || response.body.locked) return;
  try { Promise.resolve(response.body.cancel()).catch(() => {}); } catch { /* No upstream content is logged. */ }
}

// A single deadline also covers slow request bodies and response streams. A
// Promise race bounds injected transports that do not implement cancellation.
function createScope(requestSignal, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const readers = new Set();
  const cleanup = [];
  let reason;
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  aborted.catch(() => {});
  const started = Date.now();
  const duration = Math.min(REQUEST_TIMEOUT_MS, Math.max(1, timeoutMs));
  const cancelReaders = () => {
    for (const reader of readers) {
      try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* Best-effort cancellation only. */ }
    }
  };
  const abort = cancelled => {
    if (controller.signal.aborted) return;
    reason = new HttpError(cancelled ? 408 : 504, cancelled ? 'request/cancelled' : 'request/timeout',
      cancelled ? 'The request was cancelled.' : 'The request timed out. Please try later.');
    controller.abort(reason);
    cancelReaders();
    rejectAbort(reason);
  };
  const onRequestAbort = () => abort(true);
  requestSignal?.addEventListener('abort', onRequestAbort, { once: true });
  if (requestSignal?.aborted) abort(true);
  const timer = setTimeout(() => abort(false), duration);

  const scope = {
    signal: controller.signal,
    remaining: () => Math.max(0, duration - (Date.now() - started)),
    check() {
      if (!controller.signal.aborted && scope.remaining() <= 0) abort(false);
      if (controller.signal.aborted) throw reason;
    },
    run(promise) {
      const pending = Promise.resolve(promise);
      try { scope.check(); }
      catch (error) { pending.catch(() => {}); throw error; }
      return Promise.race([pending, aborted]);
    },
    watchReader(reader) {
      scope.check();
      readers.add(reader);
      return () => readers.delete(reader);
    },
    async fetch(fetchImpl, url, init = {}) {
      scope.check();
      const target = new URL(url);
      if (target.protocol !== 'https:' || target.port || target.username || target.password || target.hash ||
          !['identitytoolkit.googleapis.com', 'firestore.googleapis.com', 'integrate.api.nvidia.com'].includes(target.hostname)) {
        throw new HttpError(503, 'backend/not-configured', 'Service unavailable.');
      }
      const downstream = new AbortController();
      const parentAbort = () => downstream.abort(controller.signal.reason);
      const childAbort = () => downstream.abort(init.signal?.reason);
      controller.signal.addEventListener('abort', parentAbort, { once: true });
      init.signal?.addEventListener('abort', childAbort, { once: true });
      if (init.signal?.aborted) childAbort();
      cleanup.push(() => {
        controller.signal.removeEventListener('abort', parentAbort);
        init.signal?.removeEventListener('abort', childAbort);
        downstream.abort();
      });
      // Redirects must never carry a Firebase token or provider key elsewhere.
      return scope.run(Promise.resolve().then(() => {
        scope.check();
        // EAS's fetch adapter rejects redirect:'error'. Manual mode is portable
        // and never follows; reject the redirect response explicitly below.
        return fetchImpl(url, { ...init, signal: downstream.signal, redirect: 'manual' });
      }).then(response => {
        if (controller.signal.aborted) { discardBody(response); scope.check(); }
        if (response.redirected || response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
          discardBody(response);
          throw new HttpError(502, 'backend/redirect-refused', 'The service refused an unexpected upstream redirect.');
        }
        return response;
      }));
    },
    close() {
      clearTimeout(timer);
      requestSignal?.removeEventListener('abort', onRequestAbort);
      cancelReaders();
      cleanup.forEach(fn => fn());
      readers.clear();
    },
  };
  return scope;
}

async function readText(body, limit, scope, invalid, tooLarge = invalid) {
  if (!body || typeof body.getReader !== 'function') throw invalid();
  const reader = body.getReader();
  let unwatch = () => {};
  const chunks = [];
  let size = 0;
  let complete = false;
  try {
    unwatch = scope.watchReader(reader);
    while (true) {
      scope.check();
      const { value, done } = await scope.run(reader.read());
      if (done) { complete = true; break; }
      // Native fetch streams can cross the worker's module realm. A strict
      // instanceof rejects valid byte views from that realm; inspect the view
      // and normalize it without accepting arbitrary objects or strings.
      if (!ArrayBuffer.isView(value) || value.BYTES_PER_ELEMENT !== 1) throw invalid();
      size += value.byteLength;
      if (size > limit) throw tooLarge();
      if (value.byteLength) chunks.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw invalid(); }
  } finally {
    unwatch();
    if (!complete) {
      try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* Never retain an invalid body. */ }
    }
    try { reader.releaseLock(); } catch { /* A cancelled read can still be pending. */ }
  }
}

async function readJSON(response, limit, scope, invalid, tooLarge = invalid) {
  const length = response.headers?.get('content-length');
  if (length !== null && length !== undefined) {
    if (!/^\d+$/.test(length)) { discardBody(response); throw invalid(); }
    if (Number(length) > limit) { discardBody(response); throw tooLarge(); }
  }
  const text = await readText(response.body, limit, scope, invalid, tooLarge);
  try { return JSON.parse(text); } catch { throw invalid(); }
}

module.exports = { REQUEST_TIMEOUT_MS, createScope, discardBody, readText, readJSON };
