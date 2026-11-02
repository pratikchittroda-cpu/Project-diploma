const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const config = require('../website/public-config.js');
const { validate } = require('../website/validate-config.cjs');
const website = path.resolve(__dirname, '../website');

function page(settings = config) {
  const field = { dataset: { config: 'publisherName' }, textContent: '' };
  const warning = { hidden: true }, link = { href: '' };
  const button = { disabled: true }, status = { textContent: '' };
  const form = { reportValidity: () => true, addEventListener: (event, handler) => { form.submit = handler; } };
  const nodes = { 'deletion-request': form, 'prepare-request': button, 'request-status': status,
    'account-email': { value: ' reader@example.org ' }, 'account-type': { value: 'personal' } };
  const window = { EXPENZO_PUBLIC_CONFIG: settings, location: { href: '' } };
  const document = { querySelectorAll: selector => ({ '[data-config]': [field], '[data-config-warning]': [warning], '[data-contact]': [link] })[selector],
    getElementById: id => nodes[id] };
  vm.runInNewContext(fs.readFileSync(path.join(website, 'legal.js'), 'utf8'), { window, document, encodeURIComponent });
  return { window, form, button, status, warning, link, field };
}

test('legal configuration covers consented hosted AI without inventing retention or manual-deletion guarantees', () => {
  assert.deepEqual(validate(config), []);
  assert.equal(config.publisherName, 'Expenzo');
  assert.equal(config.supportEmail, 'pratikchittroda@gmail.com');
  assert.match(config.providerRetention, /consented requests to NVIDIA through Expo EAS Hosting/);
  assert.match(config.providerRetention, /does not promise a provider deletion deadline/);
  assert.match(config.deletionRequestTimescale, /no response or completion deadline is guaranteed/);
});

test('configured form only prepares a mailto request, never sends or claims deletion', () => {
  const p = page();
  assert.equal(p.button.disabled, false);
  assert.equal(p.warning.hidden, true);
  assert.equal(p.field.textContent, 'Expenzo');
  let prevented = false;
  p.form.submit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.ok(p.window.location.href.startsWith('mailto:pratikchittroda@gmail.com?'));
  assert.match(decodeURIComponent(p.window.location.href), /reader@example.org/);
  assert.match(p.status.textContent, /has not submitted or completed/);
});

test('missing policy/contact keeps email form disabled and warning visible', () => {
  for (const settings of [{ ...config, supportEmail: '' }, { ...config, privacyPolicyUrl: '' }]) {
    const p = page(settings);
    assert.equal(p.button.disabled, true);
    assert.equal(p.warning.hidden, false);
    p.form.submit({ preventDefault() {} });
    assert.equal(p.window.location.href, '');
  }
});

test('hosted relative resources stay inside the static website and exist', () => {
  for (const name of ['index.html', 'privacy.html', 'account-deletion.html']) {
    const html = fs.readFileSync(path.join(website, name), 'utf8');
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = match[1];
      if (url.startsWith('#') || /^[a-z]+:/i.test(url)) continue;
      const file = path.resolve(website, url.split(/[?#]/)[0]);
      assert.ok(file.startsWith(`${website}${path.sep}`), `${name}: ${url}`);
      assert.ok(fs.existsSync(file), `${name}: missing ${url}`);
    }
  }
});

test('phone hero uses the scroll controller variables and fonts are self-hosted', () => {
  const css = fs.readFileSync(path.join(website, 'styles.css'), 'utf8');
  assert.match(css, /html\.motion-enabled \.hero-phone[^}]+--hero-lift/);
  assert.match(css, /html\.motion-enabled \.hero-phone[^}]+--hero-rotate/);
  assert.doesNotMatch(css, /--hero-progress/);
  const resources = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => match[1]);
  assert.equal(resources.length, 2);
  for (const url of resources) {
    assert.ok(url.startsWith('./assets/fonts/'));
    assert.equal(fs.readFileSync(path.resolve(website, url)).subarray(0, 4).toString(), 'wOF2');
  }
});

test('rebuilt page anchors and control targets resolve to unique IDs', () => {
  for (const name of ['index.html', 'privacy.html', 'account-deletion.html']) {
    const html = fs.readFileSync(path.join(website, name), 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${name}: duplicate IDs`);
    for (const match of html.matchAll(/(?:href="#|aria-controls=")([^"\s]+)"/g)) {
      assert.ok(ids.includes(match[1]), `${name}: missing anchor/control target ${match[1]}`);
    }
  }
});

test('homepage makes the product, audience and pre-release access status clear before the first screen', () => {
  const html = fs.readFileSync(path.join(website, 'index.html'), 'utf8');
  assert.match(html, /Manual personal and company finance tracking/);
  assert.match(html, /Budgets, reports and optional AI assistance/);
  assert.match(html, /Android APK not yet available/);
  assert.match(html, /Request early access/);
  assert.match(html, /does not create an account, start a download or guarantee delivery timing/);
  assert.match(html, /Illustrative product preview/);
  assert.match(html, /same sample personal ledger/);
  assert.doesNotMatch(html, /Captured from the running Expenzo app/);
  assert.doesNotMatch(html, /Real Expenzo screens from the iOS simulator/);
});

test('sample data and legal pages identify the records as illustrative and use the current policy date', () => {
  const html = fs.readFileSync(path.join(website, 'index.html'), 'utf8');
  const privacy = fs.readFileSync(path.join(website, 'privacy.html'), 'utf8');
  const deletion = fs.readFileSync(path.join(website, 'account-deletion.html'), 'utf8');
  assert.match(html, /recorded difference/);
  assert.match(html, /ALL AMOUNTS IN INDIAN RUPEES/);
  assert.match(privacy, /Before you share information/);
  assert.match(privacy, /pre-release native app/);
  assert.match(privacy, /2026-10-25/);
  assert.match(deletion, /no automated deletion receipt or status tracker/);
});

test('legal pages share the new branded shell without changing request boundaries', () => {
  for (const name of ['privacy.html', 'account-deletion.html']) {
    const html = fs.readFileSync(path.join(website, name), 'utf8');
    assert.match(html, /<header class="legal-header">/);
    assert.match(html, /<footer class="legal-footer">/);
    assert.match(html, /class="skip-link"/);
    assert.match(html, /assets\/expenzo-logo\.png/);
    assert.match(html, /no guaranteed response or completion deadline/);
    assert.doesNotMatch(html, /type="password"/);
  }
  const deletion = fs.readFileSync(path.join(website, 'account-deletion.html'), 'utf8');
  assert.match(deletion, /id="prepare-request"[^>]*disabled/);
  assert.match(deletion, /does not submit anything to this website/);
  assert.match(deletion, /A prepared email is not proof of submission or deletion/);
});

test('content cache keys match shipped resources and HTML is revalidated', () => {
  for (const name of ['index.html', 'privacy.html', 'account-deletion.html']) {
    const html = fs.readFileSync(path.join(website, name), 'utf8');
    let keys = 0;
    for (const match of html.matchAll(/(?:href|src)="(\.\/[^"?]+\?v=[^"]+)"/g)) {
      const [resource, query] = match[1].split('?');
      const digest = crypto.createHash('sha256').update(fs.readFileSync(path.resolve(website, resource))).digest('hex').slice(0, 12);
      assert.equal(new URLSearchParams(query).get('v'), digest, `Refresh the ?v cache key for ${resource} in ${name} after editing it`);
      keys += 1;
    }
    assert.ok(keys >= 3, `${name}: stylesheet, icon and brand use content keys`);
  }
  const { hosting } = JSON.parse(fs.readFileSync(path.join(website, '../firebase.json'), 'utf8'));
  for (const source of ['/', '**/*.html']) {
    const policy = hosting.headers.find(entry => entry.source === source);
    assert.ok(policy?.headers.some(header => header.key === 'Cache-Control' && header.value.includes('no-cache')));
  }
});
