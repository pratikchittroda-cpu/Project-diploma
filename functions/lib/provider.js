'use strict';
const { HttpError } = require('./validation');
const PROVIDER_MODEL = 'nvidia/nemotron-3.5-super-vl-120b-a12b';
async function callProvider({ apiKey, messages, maxTokens = 900, fetchImpl = fetch, timeoutMs = 18000 }) {
  if (!apiKey) throw new HttpError(503, 'ai/not-configured', 'AI is unavailable.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: PROVIDER_MODEL, messages, temperature: 0.2, max_tokens: Math.min(maxTokens, 900), stream: false }),
    });
    if (!response.ok) throw new HttpError(502, 'ai/unavailable', 'The assistant is temporarily unavailable.');
    // Bound the body before JSON parsing; provider error bodies are never read/logged.
    const reader = response.body.getReader();
    let bytes = 0, parts = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65536) { await reader.cancel(); throw new HttpError(502, 'ai/invalid-output', 'Invalid assistant response.'); }
      parts.push(Buffer.from(value));
    }
    const data = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (data?.choices?.[0]?.finish_reason !== 'stop') throw new HttpError(502, 'ai/incomplete-output', 'The assistant could not finish a response.');
    return data?.choices?.[0]?.message?.content;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, controller.signal.aborted ? 'ai/timeout' : 'ai/unavailable', 'The assistant is temporarily unavailable.');
  } finally { clearTimeout(timer); }
}
module.exports = { callProvider };
