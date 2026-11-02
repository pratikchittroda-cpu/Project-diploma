// Optional real-browser check. It uses an isolated profile and localhost only.
// npm test does not require Playwright; pass an explicitly installed module path.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
const modulePath = args.includes('--playwright') ? option('--playwright') : 'playwright';
const output = path.resolve(args.includes('--output') ? option('--output') : '.expo/website-preview');
const origin = args.includes('--url') ? option('--url') : 'http://127.0.0.1:4173';
const parsed = new URL(origin);
assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname), 'Browser smoke checks only use a local preview');
const { chromium } = require(modulePath);
const AxeBuilder = args.includes('--axe') ? require(option('--axe')).default : null;
const errors = [], badResponses = [], externalRequests = [];

async function accessibility(page, label) {
  if (!AxeBuilder) return;
  // Check the settled UI, not transient contrast halfway through an entrance fade.
  await page.evaluate(async () => {
    let previous = scrollY, stable = 0;
    const deadline = performance.now() + 4000;
    await new Promise(resolve => {
      const frame = () => {
        stable = Math.abs(scrollY - previous) < 0.5 ? stable + 1 : 0;
        previous = scrollY;
        if (stable >= 12 || performance.now() > deadline) return resolve();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})));
  });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  assert.deepEqual(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, detail: n.failureSummary })) })), [], `Automated accessibility: ${label}`);
  console.log(JSON.stringify({ check: 'axe', layout: label, violations: results.violations.length }));
}

async function metrics(page) {
  return page.evaluate(() => {
    const story = document.querySelector('[data-scroll-showcase]');
    const phone = document.querySelector('[data-phone]');
    const box = phone.getBoundingClientRect();
    return {
      width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      enhanced: document.documentElement.classList.contains('story-enhanced'),
      progress: story.style.getPropertyValue('--story-progress'),
      active: [...document.querySelectorAll('[data-tour-screen]')].findIndex(e => e.classList.contains('is-active')),
      phone: { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
      previews: [...document.querySelectorAll('[data-tour-screen]')].map(e => ({
        display: getComputedStyle(e).display, visibility: getComputedStyle(e).visibility,
        height: e.getBoundingClientRect().height,
      })),
    };
  });
}

async function screenFit(page) {
  const captures = await page.locator('.app-screenshot').evaluateAll(nodes => nodes.map(image => ({
    loaded: image.complete && image.naturalWidth > 0,
    source: new URL(image.currentSrc).pathname,
    fit: getComputedStyle(image).objectFit,
  })));
  assert.equal(captures.length, 5, 'Hero and four walkthrough captures are present');
  assert.ok(captures.every(image => image.loaded && image.fit === 'contain'), 'Every screenshot loads without cropping');
  assert.deepEqual(captures.slice(1).map(image => image.source), [
    '/assets/expenzo-dashboard.png', '/assets/expenzo-transactions.png',
    '/assets/expenzo-budget.png', '/assets/expenzo-statistics.png',
  ], 'Walkthrough stages use their corresponding native captures');
  const clipped = await page.locator('.app-body').evaluateAll(nodes => nodes.map(e => ({
    screen: e.closest('[data-tour-screen]')?.className || 'hero',
    excess: e.scrollHeight - e.clientHeight,
  })).filter(e => e.excess > 2));
  assert.deepEqual(clipped, [], 'Illustrative screen content must fit above the bottom navigation');
}

async function modePreview(page, label) {
  const personal = page.getByRole('button', { name: 'Personal', exact: true });
  const company = page.getByRole('button', { name: 'Company', exact: true });
  assert.equal(await personal.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#mode-personal').isVisible(), true);
  assert.equal(await page.locator('#mode-company').isVisible(), false);
  await company.focus();
  await company.press('Enter');
  assert.equal(await company.getAttribute('aria-pressed'), 'true');
  assert.equal(await personal.getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('#mode-company').isVisible(), true);
  assert.equal(await page.locator('#mode-personal').isVisible(), false);
  assert.equal(await company.evaluate(e => e === document.activeElement), true);
  assert.match(await page.locator('[data-mode-status]').textContent(), /Company preview.*not a live account/);
  const width = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(width.page <= width.viewport + 1, 'Company preview must not overflow');
  await page.waitForTimeout(600);
  await accessibility(page, `company-${label}`);
  if (label === 'desktop') {
    await page.locator('#mode-lab').screenshot({ path: path.join(output, 'company-desktop.png') });
    // A preview switch changes section height; the cached story must be remeasured.
    await page.getByRole('button', { name: 'Jump to Budgets' }).click();
    await page.waitForTimeout(1400);
    const progress = await page.locator('[data-scroll-showcase]').evaluate(e => ({
      actual: (scrollY - (e.getBoundingClientRect().top + scrollY)) / (e.getBoundingClientRect().height - innerHeight),
      rendered: Number(e.style.getPropertyValue('--story-progress')),
    }));
    assert.ok(Math.abs(progress.actual - 2 / 3) < 0.002, 'Step control must target the newly measured story');
    assert.ok(Math.abs(progress.actual - progress.rendered) < 0.002);
    assert.equal((await metrics(page)).active, 2);
  }
  await personal.focus();
  await personal.press('Space');
  assert.equal(await personal.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#mode-company').isVisible(), false);
  assert.match(await page.locator('[data-mode-status]').textContent(), /Personal preview/);
  console.log(JSON.stringify({ check: 'interactive-preview', layout: label, keyboard: true, ownerScope: true }));
}

async function load(page, route = '') {
  await page.goto(origin + route, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  const m = await metrics(page);
  assert.ok(m.scrollWidth <= m.width + 1, `Horizontal overflow at ${m.width}: ${m.scrollWidth}`);
  await screenFit(page);
  await accessibility(page, `personal-${m.width}x${m.height}`);
  return m;
}

async function accessLayout(page, label) {
  await page.locator('.access-header').click();
  await page.waitForTimeout(1000);
  const form = page.locator('#access-request');
  assert.equal(await page.getByLabel('Email address', { exact: true }).count(), 1);
  assert.equal(await form.getByRole('textbox').count(), 1);
  assert.equal(await page.locator('#get-access-button').isEnabled(), true);
  const dimensions = await form.evaluate(element => ({
    left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right,
    viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
    controls: [...element.querySelectorAll('#access-email, #get-access-button')].map(control => control.getBoundingClientRect().height),
  }));
  assert.ok(dimensions.left >= 0 && dimensions.right <= dimensions.viewport + 1, `Access form fits at ${label}`);
  assert.ok(dimensions.pageWidth <= dimensions.viewport + 1, `No access overflow at ${label}`);
  assert.ok(dimensions.controls.every(height => height >= 44), `Accessible access controls at ${label}`);
  await form.screenshot({ path: path.join(output, `access-${label}.png`) });
  console.log(JSON.stringify({ check: 'access-layout', layout: label, emailOnly: true, minTarget: true }));
}

async function accessHandoff(page, label, reduced = false) {
  const hero = page.locator('[data-access-hero]'), header = page.locator('[data-access-header]');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(360);
  assert.equal(await hero.isVisible(), true);
  assert.equal(await header.isVisible(), false);
  assert.equal(await header.getAttribute('aria-hidden'), 'true');
  assert.equal(await header.getAttribute('tabindex'), '-1');
  assert.equal(await page.locator('.brand span').textContent(), 'EXPENZO');
  const geometry = await hero.evaluate(element => ({
    threshold: element.getBoundingClientRect().bottom + scrollY - document.querySelector('[data-header]').getBoundingClientRect().bottom,
    headerLeft: document.querySelector('[data-access-header]').offsetLeft,
  }));
  await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), Math.max(0, Math.ceil(geometry.threshold) - 3));
  await page.waitForTimeout(360);
  assert.equal(await header.isVisible(), false);
  await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), Math.ceil(geometry.threshold) + 4);
  await page.waitForFunction(() => document.querySelector('[data-access-header]').dataset.handoffState === 'header');
  const transition = await header.evaluate(element => ({
    duration: getComputedStyle(element).transitionDuration.split(',').map(Number.parseFloat), left: element.offsetLeft,
  }));
  assert.equal(transition.left, geometry.headerLeft, 'The reserved slot avoids navigation jumps');
  assert.equal(transition.duration.some(duration => duration > 0), !reduced);
  await page.waitForTimeout(360);
  assert.equal(await header.isVisible(), true);
  assert.equal(await header.getAttribute('inert'), null);
  assert.equal(await header.getAttribute('tabindex'), null);
  assert.equal(await header.getAttribute('href'), '#get-access');
  if (label === 'desktop' || label === '390') await page.screenshot({ path: path.join(output, `handoff-header-${label}.png`) });
  await header.focus();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(360);
  assert.equal(await header.isVisible(), false);
  assert.equal(await hero.evaluate(element => element === document.activeElement), true);
  assert.equal(await page.evaluate(() => scrollY), 0);
  console.log(JSON.stringify({ check: 'access-scroll-handoff', layout: label, initiallyHidden: true, thresholdCorrect: true,
    smooth: !reduced, restoredOnReturn: true, keyboardFocusSafe: true }));
}

async function accessSubmission(browser) {
  // A separate, isolated context intercepts every remote request. These are UI
  // contract fixtures, not real email delivery or user/browser-profile access.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const requests = [], unexpected = [];
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let responseMode = 'success';
  const endpoint = 'https://formsubmit.co/ajax/pratikchittroda@gmail.com';
  await context.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).origin === parsed.origin) return route.continue();
    if (request.url() !== endpoint) { unexpected.push(request.url()); return route.abort(); }
    const headers = { 'Access-Control-Allow-Origin': parsed.origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept', 'Cache-Control': 'no-store' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    assert.equal(request.method(), 'POST');
    const payload = request.postDataJSON();
    assert.deepEqual(Object.keys(payload).sort(), ['_captcha', '_honey', '_replyto', '_subject', '_template', 'email']);
    assert.equal(payload.email, payload._replyto);
    assert.equal(payload._subject, 'Expenzo APK access request');
    requests.push(payload);
    await held;
    const body = responseMode === 'success' ? { success: 'true', message: 'The form was submitted successfully.' }
      : { success: false, message: 'This form needs activation.' };
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(body) });
  });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/#get-access`, { waitUntil: 'networkidle' });
    assert.equal(requests.length, 0);
    const email = page.getByLabel('Email address', { exact: true }), button = page.locator('#get-access-button');
    await email.fill('not-an-email');
    await button.click();
    assert.equal(requests.length, 0);
    assert.equal(await email.getAttribute('aria-invalid'), 'true');
    await email.fill('synthetic+apk@example.org');
    await button.click();
    await page.waitForFunction(() => document.getElementById('access-request').dataset.state === 'sending');
    assert.equal(await button.isDisabled(), true);
    await page.locator('#access-request').evaluate(form => form.dispatchEvent(new Event('submit', { cancelable: true })));
    release();
    await page.waitForFunction(() => document.getElementById('access-request').dataset.state === 'success');
    assert.equal(requests.length, 1);
     assert.match(await page.locator('#access-status').textContent(), /publisher will reply by email if the APK becomes available/);
    assert.equal(await button.isDisabled(), true);
    assert.ok(page.url().startsWith(origin));
    responseMode = 'activation';
    await email.fill('another-synthetic@example.org');
    await button.click();
    await page.waitForFunction(() => document.getElementById('access-request').dataset.state === 'unavailable');
    assert.equal(requests.length, 2);
    assert.equal(await email.inputValue(), 'another-synthetic@example.org');
    assert.equal(await button.isDisabled(), true);
    assert.deepEqual(unexpected, []);
    console.log(JSON.stringify({ check: 'access-submit-fixture', validation: true, duplicateLock: true, acknowledged: true, activationFailureHonest: true, realEmailsSent: 0 }));
  } finally { release(); await context.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) badResponses.push({ url: r.url(), status: r.status() }); });
    page.on('request', r => { if (new URL(r.url()).origin !== parsed.origin) externalRequests.push(r.url()); });
    let m = await load(page);
    assert.equal(m.enhanced, true);
    await page.screenshot({ path: path.join(output, 'desktop-hero.png') });
    console.log(JSON.stringify({ check: 'desktop-hero', ...m }));
    await accessHandoff(page, 'desktop');
    const story = await page.locator('[data-scroll-showcase]').evaluate(e => ({ top: e.getBoundingClientRect().top + scrollY, height: e.getBoundingClientRect().height }));
    for (let stage = 0; stage < 4; stage++) {
      await page.evaluate(({ top, stage }) => scrollTo({ top, behavior: 'instant' }), { top: story.top + (story.height - 900) * stage / 3, stage });
      await page.waitForTimeout(600);
      m = await metrics(page);
      assert.equal(m.active, stage);
      assert.ok(m.phone.top >= 72 && m.phone.bottom <= 900, `Pinned phone clipped at stage ${stage}`);
      await page.screenshot({ path: path.join(output, `desktop-story-${stage}.png`) });
      console.log(JSON.stringify({ check: `desktop-story-${stage}`, ...m }));
    }
    await page.getByRole('button', { name: 'Jump to Transactions' }).click();
    await page.waitForTimeout(1400);
    assert.equal((await metrics(page)).active, 1);
    await modePreview(page, 'desktop');
    await accessLayout(page, 'desktop');
    const question = page.locator('.faq details').last();
    await question.locator('summary').focus();
    await question.locator('summary').press('Enter');
    assert.equal(await question.getAttribute('open'), '');
    assert.match(await question.textContent(), /no guaranteed response or completion deadline/);
    await question.locator('summary').press('Enter');
    assert.equal(await question.getAttribute('open'), null);
    for (const selector of ['#product', '#mode-lab', '#feature-tour', '#insights', '#availability', '.site-footer']) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
    }
    for (const details of await page.locator('.faq details').all()) {
      await details.locator('summary').click();
    }
    await accessibility(page, 'all-sections-and-open-FAQ');

    for (const size of [{ width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 375, height: 667 }, { width: 320, height: 640 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      m = await load(page);
       assert.equal(m.enhanced, (size.width >= 900 && size.height >= 760) ||
         (size.width >= 360 && size.width < 900 && size.height >= 640));
      if (!m.enhanced) assert.ok(m.previews.every(p => p.visibility === 'visible' && p.height > 0));
      await page.screenshot({ path: path.join(output, `viewport-${size.width}.png`) });
      console.log(JSON.stringify({ check: 'responsive', ...m }));
      await accessHandoff(page, String(size.width));
      if (m.enhanced) {
        for (let stage = 0; stage < 4; stage++) {
          await page.evaluate(({ stage }) => {
            const e = document.querySelector('[data-scroll-showcase]');
            scrollTo({ top: e.getBoundingClientRect().top + scrollY + (e.offsetHeight - innerHeight) * stage / 3, behavior: 'instant' });
          }, { stage });
          await page.waitForTimeout(600);
          m = await metrics(page);
          assert.equal(m.active, stage);
          assert.ok(m.scrollWidth <= m.width + 1);
           assert.ok(m.phone.top >= 72 && m.phone.bottom <= size.height, `Pinned phone clipped at ${size.width}px stage ${stage}`);
           if (size.width < 900) {
             const layout = await page.evaluate(() => ({
               controls: document.querySelector('.story-controls').getBoundingClientRect().bottom,
               caption: document.querySelector('#tour-preview-caption').getBoundingClientRect().bottom,
               targets: [...document.querySelectorAll('[data-step-link]')].map(button => button.getBoundingClientRect().height),
             }));
             assert.ok(m.phone.top >= layout.controls + 4, 'Mobile phone must clear the step controls');
             assert.ok(layout.caption <= size.height, 'Mobile caption fits in the pinned viewport');
             assert.ok(layout.targets.every(height => height >= 44), 'Mobile step buttons have touch-sized targets');
           }
          await screenFit(page);
        }
        await page.screenshot({ path: path.join(output, `story-${size.width}.png`) });
      }
       if (size.width === 390) {
         await page.locator('[data-hero-phone]').screenshot({ path: path.join(output, 'mobile-phone.png') });
         await page.getByRole('button', { name: 'Jump to Transactions' }).click();
         await page.waitForTimeout(1400);
         assert.equal((await metrics(page)).active, 1);
         await page.locator('.showcase-phone').screenshot({ path: path.join(output, 'mobile-story-phone.png') });
       }
      await modePreview(page, String(size.width));
      await accessLayout(page, String(size.width));
      if (size.width === 390 || size.width === 320) {
        const menu = page.locator('details.mobile-menu');
        await menu.locator('summary').click();
        assert.equal(await menu.getAttribute('open'), '');
        await menu.locator('a[href="#product"]').click();
        await page.waitForTimeout(1400);
        assert.equal(await menu.getAttribute('open'), null);
        assert.ok(await page.locator('#product').evaluate(e => e.getBoundingClientRect().top >= 70), 'Mobile navigation must not land under the masthead');
        await menu.locator('summary').click();
        await menu.locator('summary').press('Escape');
        assert.equal(await menu.getAttribute('open'), null);
        assert.equal(await menu.locator('summary').evaluate(e => e === document.activeElement), true);
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    m = await load(page);
    assert.equal(m.enhanced, false);
    assert.ok(m.previews.every(p => p.visibility === 'visible' && p.height > 0));
    await page.locator('[data-scroll-showcase]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'reduced-motion.png') });
    console.log(JSON.stringify({ check: 'reduced-motion', ...m }));
    await page.setViewportSize({ width: 390, height: 844 });
    m = await metrics(page);
    assert.ok(m.previews.every(p => p.visibility === 'visible' && p.height > 0), 'Reduced-motion phones retain all four captures');
    await page.setViewportSize({ width: 1440, height: 900 });
    await accessHandoff(page, 'reduced-motion', true);
    await modePreview(page, 'reduced-motion');
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await accessLayout(page, 'large-text');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await accessSubmission(browser);

    for (const route of ['/privacy.html', '/account-deletion.html']) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(origin + route, { waitUntil: 'networkidle' });
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(width <= 391, `Legal page overflow: ${route}`);
      if (route.includes('deletion')) assert.equal(await page.locator('#prepare-request').isEnabled(), true);
      await accessibility(page, route);
      await page.screenshot({ path: path.join(output, route.includes('deletion') ? 'deletion-mobile.png' : 'privacy-mobile.png') });
    }
    const plain = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    const nojs = await plain.newPage();
    await nojs.goto(origin, { waitUntil: 'networkidle' });
    assert.equal(await nojs.locator('[data-access-header]').isVisible(), false);
    assert.equal(await nojs.locator('[data-access-hero]').isVisible(), true);
    assert.equal(await nojs.locator('[data-tour-screen]:visible').count(), 4);
    assert.equal(await nojs.locator('[data-reveal]:visible').count(), await nojs.locator('[data-reveal]').count());
    assert.equal(await nojs.locator('[data-mode-panel]:visible').count(), 2);
    assert.equal(await nojs.locator('.mode-switch').isVisible(), false);
    await nojs.setViewportSize({ width: 390, height: 844 });
    assert.equal(await nojs.locator('[data-tour-screen]:visible').count(), 4);
    await nojs.locator('.mobile-menu summary').click();
    assert.equal(await nojs.locator('.mobile-menu nav').isVisible(), true);
    await nojs.goto(origin + '/account-deletion.html', { waitUntil: 'networkidle' });
    assert.equal(await nojs.locator('#prepare-request').isEnabled(), false);
    assert.match(await nojs.locator('#request-status').textContent(), /email pratikchittroda@gmail.com directly/);
    console.log(JSON.stringify({ check: 'no-javascript', visibleScreens: 4 }));
    assert.deepEqual(errors, []);
    assert.deepEqual(badResponses, []);
    assert.deepEqual(externalRequests, []);
    console.log('Browser smoke passed: responsive, all stages, keyboard previews, layout invalidation, menu, FAQ, reduced motion, no-JS and legal pages.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
