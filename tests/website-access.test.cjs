const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const config = require('../website/public-config.js');
const { validate } = require('../website/validate-config.cjs');
const source = fs.readFileSync(path.join(__dirname, '../website/access.js'), 'utf8');
const endpoint = 'https://formsubmit.co/ajax/pratikchittroda@gmail.com';
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };

function element(attributes = {}) {
  const attrs = new Map(Object.entries(attributes)), handlers = new Map();
  return { dataset: {}, isConnected: true, value: '', disabled: false, textContent: '',
    addEventListener: (event, callback) => handlers.set(event, callback),
    emit: (event, data = {}) => handlers.get(event)?.({ preventDefault() {}, ...data }),
    setAttribute: (name, value) => attrs.set(name, String(value)),
    removeAttribute: name => attrs.delete(name),
    hasAttribute: name => attrs.has(name),
    getAttribute: name => attrs.get(name),
    setCustomValidity(message) { this.validityMessage = message; },
    reportValidity() { return !this.validityMessage; },
  };
}

function harness(options = {}) {
  const form = element({ action: 'https://formsubmit.co/pratikchittroda@gmail.com' });
  const email = element(), button = element(), status = element(), honey = element();
  for (const control of [email, button, honey]) control.form = form;
  button.disabled = true;
  const nodes = { 'access-request': form, 'access-email': email, 'get-access-button': button,
    'access-status': status, 'access-company': honey };
  const handlers = new Map(), timers = new Map(), requests = [];
  let nextTimer = 0;
  const document = { readyState: options.readyState || 'complete', getElementById: id => nodes[id],
    addEventListener: (event, callback) => handlers.set(`document:${event}`, callback) };
  const window = {
    EXPENZO_PUBLIC_CONFIG: options.config === undefined ? config : options.config,
    AbortController, TextDecoder, ReadableStream, Request,
    addEventListener: (event, callback) => handlers.set(event, callback),
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, init) => {
      requests.push({ url, init });
      if (options.fetch) return options.fetch(url, init);
      return Response.json({ success: 'true', message: 'The form was submitted successfully.' });
    },
  };
  if (options.unsupported) window.ReadableStream = undefined;
  const context = { window, document, URL, Uint8Array, Set, ArrayBuffer };
  const initialize = () => vm.runInNewContext(source, context, { filename: 'website/access.js' });
  initialize();
  return { form, email, button, status, honey, requests, timers, initialize,
    event: (name, event) => handlers.get(name)?.(event || {}),
    input(value) { email.value = value; email.emit('input'); },
    submit(value) { if (value !== undefined) email.value = value; return form.emit('submit'); },
    expire() { [...timers.values()].forEach(callback => callback()); },
  };
}

test('access form initializes after DOM controls exist, makes no initial request and keeps only email visible', () => {
  const h = harness({ readyState: 'loading' });
  assert.equal(h.button.disabled, true);
  h.event('document:DOMContentLoaded');
  assert.equal(h.form.dataset.state, 'idle');
  assert.equal(h.button.disabled, false);
  assert.equal(h.requests.length, 0);
  h.initialize();
  assert.equal(h.requests.length, 0);
  const html = fs.readFileSync(path.join(__dirname, '../website/index.html'), 'utf8');
  const markup = html.match(/<form id="access-request"[\s\S]*?<\/form>/)[0];
  const inputs = [...markup.matchAll(/<input\b[^>]+>/g)].map(match => match[0]);
  assert.equal(inputs.filter(input => !/type="hidden"|id="access-company"/.test(input)).length, 1);
  assert.match(markup, /type="email"[^>]*required/);
  assert.match(markup, /role="status"[^>]*aria-live="polite"/);
  assert.match(html, /href="#get-access">Request early access/);
  assert.ok(html.indexOf('src="./public-config.js') < html.indexOf('src="./access.js'));
  const header = html.match(/<header class="site-header"[\s\S]*?<\/header>/)[0];
  const hero = html.match(/<section class="hero"[\s\S]*?<\/section>/)[0];
  assert.match(header, /aria-label="EXPENZO home"/);
  assert.match(header, /<span>EXPENZO<\/span>/);
  assert.equal((header.match(/class="nav-action access-header"/g) || []).length, 1);
  assert.match(header, /data-access-header[^>]+aria-hidden="true"[^>]+tabindex="-1"[^>]+inert/);
  assert.match(hero, /<a[^>]+href="#get-access"[^>]+data-access-hero/);
  assert.match(markup, /id="get-access-button"[^>]*type="submit"/);
});

test('invalid emails, empty entries and honeypots fail before any network call', async () => {
  const h = harness();
  for (const address of ['', 'not an email', 'missing-at.example.org', 'a@example', 'a\n@example.org', `${'a'.repeat(255)}@example.org`]) {
    await h.submit(address);
    assert.equal(h.form.dataset.state, 'error');
    assert.equal(h.requests.length, 0);
  }
  h.honey.value = 'Synthetic bot field';
  await h.submit('visitor@example.org');
  assert.equal(h.requests.length, 0);
  assert.match(h.status.textContent, /could not be submitted/);
});

test('approved configuration permits only the fixed HTTPS publisher recipient, never visitor routing or secrets', async () => {
  assert.deepEqual(validate(config), []);
  for (const accessRequestEndpoint of ['http://formsubmit.co/ajax/pratikchittroda@gmail.com',
    'https://formsubmit.co/ajax/another@example.org', 'https://formsubmit.co:443/ajax/pratikchittroda@gmail.com',
    'https://user:password@formsubmit.co/ajax/pratikchittroda@gmail.com', `${endpoint}?key=synthetic`,
    `${endpoint}#fragment`, 'https://untrusted.example.org/ajax/pratikchittroda@gmail.com']) {
    const settings = { ...config, accessRequestEndpoint };
    assert.ok(validate(settings).some(error => error.startsWith('accessRequestEndpoint')));
    const h = harness({ config: settings });
    await h.submit('visitor@example.org');
    assert.equal(h.requests.length, 0);
    assert.equal(h.button.disabled, true);
    assert.equal(h.form.hasAttribute('action'), false);
  }
  for (const settings of [null, {}, { ...config, accessRequestRecipient: 'another@example.org' },
    { ...config, supportEmail: 'another@example.org' }]) {
    const h = harness({ config: settings });
    await h.submit('visitor@example.org');
    assert.equal(h.form.dataset.state, 'unavailable');
    assert.equal(h.requests.length, 0);
  }
  const h = harness({ unsupported: true });
  assert.equal(h.form.dataset.state, 'unavailable');
});

test('a single submit sends only the email and fixed metadata, locks duplicates and acknowledges manual APK follow-up', async () => {
  const pending = defer(), h = harness({ fetch: () => pending.promise });
  const submitting = h.submit('  visitor+apk@example.org  ');
  assert.equal(h.form.dataset.state, 'sending');
  assert.equal(h.email.disabled, true);
  assert.equal(h.button.disabled, true);
  assert.equal(h.form.getAttribute('aria-busy'), 'true');
  await h.submit();
  assert.equal(h.requests.length, 1);
  const { url, init } = h.requests[0];
  assert.equal(url, endpoint);
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'error');
  assert.equal(init.credentials, 'omit');
  assert.deepEqual(JSON.parse(init.body), { email: 'visitor+apk@example.org', _replyto: 'visitor+apk@example.org',
    _subject: 'Expenzo APK access request', _template: 'table', _captcha: 'false', _honey: '' });
  pending.resolve(Response.json({ success: true, message: 'The form was submitted successfully.' }));
  await submitting;
  assert.equal(h.form.dataset.state, 'success');
  assert.equal(h.form.getAttribute('aria-busy'), 'false');
  assert.equal(h.email.disabled, false);
  assert.equal(h.button.disabled, true);
  assert.match(h.status.textContent, /publisher will reply by email if the APK becomes available/);
  assert.ok(!/download ready|APK sent|email delivered/i.test(h.status.textContent));
  assert.equal(h.timers.size, 0);
  assert.equal(init.signal.aborted, true);
  await h.submit();
  h.input('VISITOR+APK@example.org');
  await h.submit();
  assert.equal(h.requests.length, 1);
  h.input('another@example.org');
  assert.equal(h.button.disabled, false);
  assert.equal(h.form.dataset.state, 'idle');
  await h.submit();
  assert.equal(h.requests.length, 2);
});

test('HTTP 200 alone, activation-required, failure, pending and unreadable responses never claim email delivery', async () => {
  for (const [data, expected] of [
    [{ success: 'false', message: 'Could not submit' }, 'error'],
    [{ success: true, message: 'Please activate your form first.' }, 'unavailable'],
    [{ success: true, activated: false }, 'unavailable'],
    [{ success: true, message: 'Your request is pending.' }, 'uncertain'],
    [{ success: true, error: '<img src=x onerror=alert(1)>' }, 'error'],
    [{ message: 'The form was submitted successfully.' }, 'uncertain'],
    [[], 'uncertain'],
  ]) {
    const h = harness({ fetch: async () => Response.json(data) });
    await h.submit('visitor@example.org');
    assert.equal(h.form.dataset.state, expected);
    assert.ok(!h.status.textContent.includes('<img'));
    assert.ok(!h.status.textContent.includes('Access request submitted.'));
    assert.equal(h.email.value, 'visitor@example.org');
    assert.equal(h.requests.length, 1);
  }
  for (const response of [Response.json({ success: true }, { status: 429 }),
    new Response('invalid JSON'), new Response(new Uint8Array([255])), new Response('x'.repeat(16385))]) {
    const h = harness({ fetch: async () => response });
    await h.submit('visitor@example.org');
    assert.ok(['error', 'uncertain'].includes(h.form.dataset.state));
    assert.equal(h.timers.size, 0);
    assert.equal(h.requests.length, 1);
  }
});

test('timeouts, network ambiguity and pagehide abort without automatic resends or late success', async () => {
  const pending = defer(), h = harness({ fetch: () => pending.promise });
  const submitting = h.submit('visitor@example.org');
  h.expire();
  await submitting;
  assert.equal(h.form.dataset.state, 'uncertain');
  assert.match(h.status.textContent, /may have been processed/);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].init.signal.aborted, true);
  assert.equal(h.email.value, 'visitor@example.org');
  pending.resolve(Response.json({ success: true }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.form.dataset.state, 'uncertain');
  const failure = harness({ fetch: async () => { throw new Error('Synthetic network loss'); } });
  await failure.submit('visitor@example.org');
  assert.equal(failure.form.dataset.state, 'uncertain');
  assert.equal(failure.requests.length, 1);

  const late = defer(), leaving = harness({ fetch: () => late.promise });
  const beforeHide = leaving.submit('visitor@example.org');
  leaving.event('pagehide');
  await beforeHide;
  assert.equal(leaving.requests[0].init.signal.aborted, true);
  assert.equal(leaving.timers.size, 0);
  leaving.event('pageshow', { persisted: true });
  assert.equal(leaving.form.dataset.state, 'uncertain');
  late.resolve(Response.json({ success: true }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(leaving.form.dataset.state, 'uncertain');
  assert.equal(leaving.requests.length, 1);
});
