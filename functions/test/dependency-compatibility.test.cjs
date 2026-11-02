'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { text } = require('node:stream/consumers');
const net = require('node:net');
const http = require('node:http');

// Resolve through the actual CLI callers, including when npm nests dependencies.
const fromTools = createRequire(require.resolve('firebase-tools/package.json'));
const fromPubsub = createRequire(fromTools.resolve('@google-cloud/pubsub'));
const fromProxy = createRequire(fromTools.resolve('proxy-agent'));
const fromPac = createRequire(fromProxy.resolve('pac-proxy-agent'));
const fromGetUri = createRequire(fromPac.resolve('get-uri'));

test('dependency overrides preserve actual PubSub W3C trace propagation', () => {
  assert.equal(fromPubsub('@opentelemetry/core/package.json').version, '2.8.0');
  const api = fromPubsub('@opentelemetry/api');
  const telemetry = fromPubsub('./telemetry-tracing.js');
  const spanContext = {
    traceId: '0123456789abcdef0123456789abcdef', spanId: '1234567890abcdef',
    traceFlags: api.TraceFlags.SAMPLED, traceState: api.createTraceState('vendor=state'),
  };
  const span = { spanContext: () => spanContext };
  let extractedContext;
  // Only the tracer sink is synthetic; PubSub and core perform real propagation.
  assert.equal(api.trace.setGlobalTracerProvider({ getTracer: () => ({
    startSpan: (name, options, context) => {
      extractedContext = api.trace.getSpanContext(context || api.ROOT_CONTEXT);
      return span;
    },
  }) }), true);
  try {
    telemetry.setGloballyEnabled(true);
    const message = {};
    telemetry.injectSpan(span, message);
    assert.equal(message.attributes.googclient_traceparent, '00-0123456789abcdef0123456789abcdef-1234567890abcdef-01');
    assert.equal(message.attributes.googclient_tracestate, 'vendor=state');
    assert.equal(message.parentSpan, span);
    delete message.parentSpan; // Simulate serialization across the transport.
    assert.equal(telemetry.containsSpanContext(message), true);
    assert.equal(telemetry.extractSpan(message, 'projects/demo-expenzo/subscriptions/compatibility'), span);
    assert.equal(extractedContext.traceId, spanContext.traceId);
    assert.equal(extractedContext.spanId, spanContext.spanId);
    assert.equal(extractedContext.traceState.serialize(), 'vendor=state');
    assert.equal(extractedContext.isRemote, true);
    telemetry.extractSpan({ attributes: { googclient_traceparent: 'invalid' } }, 'compatibility');
    assert.equal(extractedContext, undefined);
  } finally {
    telemetry.setGloballyEnabled(false);
    api.trace.disable();
  }
});

test('dependency GHSA-8988-4f7v-96qf: baggage parsing bounds entries and sizes', () => {
  // https://github.com/advisories/GHSA-8988-4f7v-96qf (fixed in core 2.8.0)
  const api = fromPubsub('@opentelemetry/api');
  const { W3CBaggagePropagator } = fromPubsub('@opentelemetry/core');
  const propagator = new W3CBaggagePropagator();
  const parse = baggage => api.propagation.getBaggage(propagator.extract(api.ROOT_CONTEXT, { baggage }, api.defaultTextMapGetter));
  const many = Array.from({ length: 1000 }, (_, i) => `k${i}=v`);
  assert.equal(parse(many.join(',')).getAllEntries().length, 180);
  assert.equal(parse(many).getAllEntries().length, 180);
  const oversizedEntry = parse(`ok=yes,too_big=${'a'.repeat(5000)}`);
  assert.equal(oversizedEntry.getEntry('ok').value, 'yes');
  assert.equal(oversizedEntry.getEntry('too_big'), undefined);
  const large = Array.from({ length: 100 }, (_, i) => `k${i}=${'v'.repeat(1000)}`).join(',');
  const entries = parse(large).getAllEntries();
  assert.ok(entries.length > 0 && entries.length <= 8);
  assert.ok(Buffer.byteLength(entries.map(([key, entry]) => `${key}=${entry.value}`).join(',')) <= 8192);
  assert.equal(parse('normal=value').getEntry('normal').value, 'value');
});

test('dependency GHSA-c475-qrg2-pj4r: malformed Unix listing terminates promptly', () => {
  // https://github.com/advisories/GHSA-c475-qrg2-pj4r
  // A node:test timeout cannot interrupt synchronous regexp backtracking. Run the
  // 128KB upstream reproducer in a killable process, with ample CI startup slack.
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const { parseList } = require(${JSON.stringify(fromGetUri.resolve('basic-ftp'))});
    const malicious = '-rw-r--r-- 1 ' + 'a '.repeat(64 * 1024) + '!';
    const files = parseList(malicious + '\\r\\n-rw-r--r-- 1 owner group 42 Jan 1 2020 file.txt\\r\\n');
    assert.equal(files.length, 1);
    assert.equal(files[0].name, 'file.txt');
    assert.equal(files[0].size, 42);
  `], { encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL', env: {} });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

async function ftpFixture(t, { fallback = false, pasvOnly = false } = {}) {
  const sockets = new Set(), servers = new Set(), commands = [];
  const payload = 'function FindProxyForURL(url, host) { return "DIRECT"; }';
  const abort = new AbortController();
  let stopping = false, failure;
  const wait = (emitter, event) => once(emitter, event, { signal: abort.signal });
  const track = socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    socket.on('error', () => {}); // Clients may reset after expected FTP errors.
    socket.setTimeout(5000, () => socket.destroy());
    return socket;
  };
  const control = net.createServer(socket => {
    track(socket).setEncoding('utf8');
    let buffer = '', pending = Promise.resolve(), dataReady;
    const reply = value => socket.write(`${value}\r\n`);
    reply('220 local compatibility fixture');
    const handle = async line => {
      const [verb] = line.split(' ');
      commands.push(verb);
      if (verb === 'USER') return reply('331 password required');
      if (verb === 'PASS') return reply('230 logged in');
      if (verb === 'FEAT') return reply('211-features\r\n MLST type*;size*;modify*;\r\n UTF8\r\n211 End');
      if (verb === 'MDTM') return reply(line.includes('missing') ? '550 not found' : fallback ? '502 unsupported' : '213 20261004120000');
      if (verb === 'EPSV' || verb === 'PASV') {
        if (verb === 'EPSV' && pasvOnly) return reply('502 unsupported');
        const server = net.createServer();
        servers.add(server);
        dataReady = wait(server, 'connection').then(([data]) => { server.close(); return track(data); });
        // Ensure teardown aborts never leave an unobserved pending rejection.
        dataReady.catch(() => {});
        server.listen(0, '127.0.0.1');
        await wait(server, 'listening');
        const port = server.address().port;
        // v6's safer default must use the control host, not this different IP.
        return reply(verb === 'EPSV' ? `229 (|||${port}|)` : `227 (127,0,0,2,${port >> 8},${port & 255})`);
      }
      if (['MLSD', 'LIST', 'RETR'].includes(verb)) {
        reply('150 transfer ready');
        const data = await dataReady;
        const finished = wait(data, 'close');
        data.end(verb === 'RETR' ? payload : `type=file;size=${payload.length};modify=20261004120000; proxy.pac\r\n`);
        await finished;
        return reply('226 transfer complete');
      }
      if (verb === 'QUIT') return socket.end('221 bye\r\n');
      if (['OPTS', 'TYPE', 'STRU'].includes(verb)) return reply('200 OK');
      throw new Error(`Unexpected fixture command: ${verb}`);
    };
    socket.on('data', chunk => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 2);
        pending = pending.then(() => handle(line)).catch(error => {
          if (!stopping) failure ||= error;
          socket.destroy();
        });
      }
    });
  });
  servers.add(control);
  t.after(async () => {
    let timer;
    try {
      // Stream EOF precedes get-uri's download promise and final FTP 226/QUIT.
      // Drain protocol completion first, then forcibly clean up on failure.
      await Promise.race([
        Promise.all([...sockets].map(socket => new Promise(resolve => socket.once('close', resolve)))),
        new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('FTP fixture did not drain')), 2000); }),
      ]);
    } finally {
      clearTimeout(timer);
      stopping = true;
      abort.abort();
      for (const socket of sockets) socket.destroy();
      await Promise.all([...servers].map(server => new Promise(resolve => server.close(resolve))));
    }
    if (failure) throw failure;
  });
  control.listen(0, '127.0.0.1');
  await wait(control, 'listening');
  return { url: `ftp://127.0.0.1:${control.address().port}/proxy.pac`, payload, commands };
}

test('dependency get-uri FTP retrieval preserves MDTM, cache and missing-file errors', { timeout: 10000 }, async t => {
  assert.equal(fromGetUri('basic-ftp/package.json').version, '6.2.2');
  const fixture = await ftpFixture(t);
  const { getUri } = fromPac('get-uri');
  const stream = await getUri(fixture.url);
  assert.equal(await text(stream), fixture.payload);
  assert.equal(stream.lastModified.toISOString(), '2026-10-04T12:00:00.000Z');
  await assert.rejects(getUri(fixture.url, { cache: stream }), { code: 'ENOTMODIFIED' });
  await assert.rejects(getUri(fixture.url.replace('proxy.pac', 'missing.pac')), { code: 'ENOTFOUND' });
  assert.equal(fixture.commands.filter(command => command === 'RETR').length, 1);
});

test('dependency get-uri listing fallback works with safer PASV host selection', { timeout: 10000 }, async t => {
  const fixture = await ftpFixture(t, { fallback: true, pasvOnly: true });
  const stream = await fromPac('get-uri').getUri(fixture.url);
  assert.equal(await text(stream), fixture.payload);
  assert.equal(stream.lastModified.toISOString(), '2026-10-04T12:00:00.000Z');
  assert.ok(fixture.commands.includes('MLSD'));
  assert.ok(fixture.commands.includes('PASV'));
});

test('dependency proxy-agent retrieves a PAC file through its actual FTP chain', { timeout: 10000 }, async t => {
  const fixture = await ftpFixture(t);
  const server = http.createServer((req, res) => res.end('local-response'));
  const { ProxyAgent } = fromTools('proxy-agent');
  const agent = new ProxyAgent({ getProxyForUrl: () => `pac+${fixture.url}` });
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const response = await new Promise((resolve, reject) => {
      const request = http.get(`http://127.0.0.1:${server.address().port}/`, { agent }, resolve);
      request.once('error', reject);
      request.setTimeout(5000, () => request.destroy(new Error('Local PAC request timed out')));
    });
    assert.equal(await text(response), 'local-response');
    assert.ok(fixture.commands.includes('RETR'));
  } finally {
    agent.destroy();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
