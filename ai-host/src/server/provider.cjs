'use strict';

const { HttpError, callProvider } = require('./lib/shared.cjs');
const { discardBody } = require('./runtime.cjs');
const PROVIDER_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

function sharedProviderRuntime() {
  // The shared provider's bounded decoder uses Buffer. EAS Hosting and
  // Cloudflare's nodejs_compat expose node:buffer; no Node networking is used.
  if (typeof globalThis.Buffer?.from === 'function' && typeof globalThis.Buffer?.concat === 'function') return;
  try { globalThis.Buffer = require('node:buffer').Buffer; }
  catch { throw new HttpError(503, 'ai/not-configured', 'AI is unavailable.'); }
}

async function invokeProvider({ provider = callProvider, apiKey, messages, maxTokens, fetchImpl, scope }) {
  if (provider === callProvider) sharedProviderRuntime();
  const providerFetch = async (url, init) => {
    if (url !== PROVIDER_URL) throw new HttpError(503, 'ai/not-configured', 'AI is unavailable.');
    // Nemotron enables reasoning by default. For these short chat/JSON outputs,
    // use its documented direct-answer mode so reasoning cannot consume the
    // bounded output budget before returning a usable answer.
    const body = JSON.parse(init.body);
    body.chat_template_kwargs = { enable_thinking: false };
    const response = await scope.fetch(fetchImpl, PROVIDER_URL, { ...init, body: JSON.stringify(body) });
    if (!response.ok) { discardBody(response); return response; }
    if (!response.body) throw new HttpError(502, 'ai/invalid-output', 'The assistant returned an invalid result.');
    return {
      ok: response.ok, status: response.status, headers: response.headers,
      body: {
        getReader() {
          scope.check();
          const reader = response.body.getReader();
          const unwatch = scope.watchReader(reader);
          const release = () => {
            unwatch();
            try { reader.releaseLock(); } catch { /* Pending cancellation is already bounded. */ }
          };
          return {
            async read() {
              try {
                scope.check();
                const part = await scope.run(reader.read());
                if (part.done) release();
                return part;
              } catch (error) { release(); throw error; }
            },
            async cancel() {
              try { return await scope.run(reader.cancel()); }
              finally { release(); }
            },
          };
        },
      },
    };
  };
  const timeoutMs = Math.max(1, Math.min(18000, scope.remaining()));
  // One paid attempt only. The same whole-request signal also reaches injected
  // providers, while the shared provider uses its own shorter timeout.
  return scope.run(Promise.resolve().then(() => {
    scope.check();
    return provider({ apiKey, messages, maxTokens, fetchImpl: providerFetch, timeoutMs, signal: scope.signal });
  }));
}

module.exports = { invokeProvider };
