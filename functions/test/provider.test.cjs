'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { callProvider } = require('../lib/provider');
test('provider sends one bounded nonstreaming request to fixed endpoint', async () => {
  let calls = 0;
  const answer = await callProvider({ apiKey: 'test-only', messages: [{ role: 'user', content: 'hello' }], maxTokens: 9999, fetchImpl: async (url, options) => {
    calls++; assert.equal(url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    const body = JSON.parse(options.body); assert.equal(body.model, 'nvidia/nemotron-3.5-super-vl-120b-a12b'); assert.equal(body.max_tokens, 900); assert.equal(body.stream, false);
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'answer' } }] }));
  } });
  assert.equal(answer, 'answer'); assert.equal(calls, 1);
});
test('provider never retries, reads error bodies or leaks transport/provider secrets', async () => {
  for (const status of [401, 429, 500]) {
    let calls = 0;
    await assert.rejects(callProvider({ apiKey: 'test-only', messages: [], fetchImpl: async () => {
      calls++; return { ok: false, status, get body() { throw new Error('error body must not be read'); } };
    } }), e => e.code === 'ai/unavailable' && !e.message.includes('PRIVATE'));
    assert.equal(calls, 1);
  }
  await assert.rejects(callProvider({ apiKey: 'test-only', messages: [], fetchImpl: async () => { throw new Error('PRIVATE key/token/details'); } }), e => e.code === 'ai/unavailable' && !e.message.includes('PRIVATE'));
  await assert.rejects(callProvider({ apiKey: '', messages: [], fetchImpl: () => assert.fail('No key, no call') }), e => e.code === 'ai/not-configured');
});
test('timeouts, oversized JSON, invalid JSON and truncated completions are rejected', async () => {
  await assert.rejects(callProvider({ apiKey: 'test-only', messages: [], timeoutMs: 5, fetchImpl: async (_, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))) }), e => e.code === 'ai/timeout');
  for (const [body, code] of [['x'.repeat(65537), 'ai/invalid-output'], ['{', 'ai/unavailable'], [JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: 'partial' } }] }), 'ai/incomplete-output']]) {
    await assert.rejects(callProvider({ apiKey: 'test-only', messages: [], fetchImpl: async () => new Response(body) }), e => e.code === code);
  }
});
