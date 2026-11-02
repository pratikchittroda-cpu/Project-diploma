const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../website/access-header.js'), 'utf8');

function eventSource() {
  const handlers = new Map();
  return { handlers,
    addEventListener(event, callback) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event).add(callback); },
    removeEventListener(event, callback) { handlers.get(event)?.delete(callback); },
    emit(event, value = {}) { [...(handlers.get(event) || [])].forEach(callback => callback(value)); },
  };
}

function harness(options = {}) {
  const frames = new Map(), cancelled = [], observers = [];
  let nextFrame = 0, scroll = options.scroll || 0, heroBottom = 200, headerBottom = 84, valid = true, reads = 0;
  const attributes = () => {
    const values = new Map();
    return { getAttribute: name => values.has(name) ? values.get(name) : null,
      setAttribute: (name, value) => values.set(name, String(value)), removeAttribute: name => values.delete(name) };
  };
  const root = attributes(), document = { ...eventSource(), documentElement: root, readyState: options.loading ? 'loading' : 'complete', activeElement: null };
  const classes = new Set();
  const proxy = { ...eventSource(), ...attributes(), isConnected: true,
    classList: { contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value) },
    contains: element => element === proxy, blur: () => { document.activeElement = null; } };
  const hero = { isConnected: true, getClientRects: () => [1],
    getBoundingClientRect: () => { reads++; return { top: heroBottom - 54 - scroll, bottom: valid ? heroBottom - scroll : NaN, width: 190 }; },
    focus(options) { hero.focusOptions = options; document.activeElement = hero; } };
  const header = { getClientRects: () => [1], getBoundingClientRect: () => { reads++; return { top: 0, bottom: headerBottom, width: 1440 }; } };
  document.querySelector = selector => options.missing ? null : ({ '[data-access-header]': proxy, '[data-access-hero]': hero,
    '[data-header]': header, '[data-hero]': hero })[selector] || null;
  const window = { ...eventSource(), visualViewport: eventSource(),
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => { cancelled.push(id); frames.delete(id); },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; observers.push(this); }
      observe(target) { this.targets.add(target); }
      disconnect() { this.disconnected = true; }
    },
    fetch() { assert.fail('Scroll handoff must never send network requests'); },
  };
  if (options.noRaf) { delete window.requestAnimationFrame; delete window.cancelAnimationFrame; }
  if (options.noObserver) delete window.ResizeObserver;
  const run = () => vm.runInNewContext(source, { window, document, Number, Array, Map, Set }, { filename: 'website/access-header.js' });
  run();
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); };
  return { window, document, proxy, hero, observers, frames, cancelled, flush, run,
    reads: () => reads, setScroll: value => { scroll = value; }, invalid: () => { valid = false; },
    headerHeight: value => { headerBottom = value; }, moveHero: value => { heroBottom = value; },
    visible: () => classes.has('is-visible'),
    click() { let prevented = false; proxy.emit('click', { preventDefault() { prevented = true; }, stopImmediatePropagation() {} }); return prevented; },
  };
}

test('hero access stays primary initially, and the header appears only after the button passes the sticky header', () => {
  const h = harness(); h.flush();
  assert.equal(h.visible(), false);
  assert.equal(h.proxy.getAttribute('aria-hidden'), 'true');
  assert.equal(h.proxy.getAttribute('tabindex'), '-1');
  assert.equal(h.proxy.getAttribute('inert'), '');
  assert.equal(h.click(), true);
  h.setScroll(115); h.window.emit('scroll'); h.flush();
  assert.equal(h.visible(), false); // Hero bottom 85, header bottom 84.
  h.setScroll(116); h.window.emit('scroll'); h.flush();
  assert.equal(h.visible(), true);
  assert.equal(h.proxy.getAttribute('data-handoff-state'), 'header');
  assert.equal(h.proxy.getAttribute('aria-hidden'), null);
  assert.equal(h.proxy.getAttribute('tabindex'), null);
  assert.equal(h.proxy.getAttribute('inert'), null);
  assert.equal(h.click(), false);
  h.setScroll(0); h.window.emit('scroll'); h.flush();
  assert.equal(h.visible(), false);
  assert.equal(h.proxy.getAttribute('data-handoff-state'), 'hero');
});

test('scroll work is coalesced and duplicate initialization or idle frames do not create extra listeners/work', () => {
  const h = harness(); h.flush(); const initialReads = h.reads();
  for (let i = 0; i < 20; i++) h.window.emit('scroll');
  assert.equal(h.frames.size, 1);
  assert.equal(h.reads(), initialReads);
  h.flush();
  assert.equal(h.reads(), initialReads + 2);
  assert.equal(h.frames.size, 0);
  h.run();
  assert.equal(h.window.handlers.get('scroll').size, 1);
  assert.equal(h.window.handlers.get('pageshow').size, 1);
});

test('initial retained scroll, resized masthead and layout changes use actual button geometry', () => {
  const h = harness({ scroll: 130 }); h.flush();
  assert.equal(h.visible(), true);
  h.headerHeight(64); h.window.emit('resize'); h.flush();
  assert.equal(h.visible(), false);
  h.headerHeight(100); h.observers[0].callback(); h.flush();
  assert.equal(h.visible(), true);
  h.moveHero(1000); h.window.emit('hashchange'); h.flush();
  assert.equal(h.visible(), false); // A button BELOW the viewport has not passed above it.
  h.invalid(); h.window.emit('scroll'); h.flush();
  assert.equal(h.visible(), false);
});

test('focused header access returns to the visible hero without scrolling and stale hidden activation is blocked', () => {
  const h = harness({ scroll: 140 }); h.flush();
  h.document.activeElement = h.proxy;
  h.setScroll(0);
  assert.equal(h.click(), true); // Fresh geometry is rechecked even before the scheduled frame.
  assert.equal(h.visible(), false);
  assert.equal(h.document.activeElement, h.hero);
  assert.equal(h.hero.focusOptions.preventScroll, true);
});

test('pagehide cancels pending work and bfcache resume rejects stale callbacks and duplicate listeners', () => {
  const h = harness(); h.flush();
  h.setScroll(140); h.window.emit('scroll');
  const oldFrame = [...h.frames.values()][0], oldObserver = h.observers[0];
  h.window.emit('pagehide');
  assert.equal(h.frames.size, 0);
  assert.equal(h.window.handlers.get('scroll').size, 0);
  assert.equal(oldObserver.disconnected, true);
  oldFrame(); oldObserver.callback();
  assert.equal(h.visible(), false);
  assert.equal(h.frames.size, 0);
  h.window.emit('pageshow', { persisted: true }); h.flush();
  assert.equal(h.visible(), true);
  assert.equal(h.window.handlers.get('scroll').size, 1);
  h.window.emit('pageshow', { persisted: true }); h.flush();
  assert.equal(h.window.handlers.get('scroll').size, 1);
  oldFrame(); oldObserver.callback();
  assert.equal(h.frames.size, 0);
});

test('DOM-ready, missing sections and no observer/scheduler fallbacks keep access usable', () => {
  const delayed = harness({ loading: true });
  assert.equal(delayed.frames.size, 0);
  delayed.document.emit('DOMContentLoaded'); delayed.flush();
  assert.equal(delayed.visible(), false);
  const missing = harness({ missing: true });
  assert.equal(missing.frames.size, 0);
  assert.equal(missing.window.handlers.size, 0);
  const fallback = harness({ noRaf: true, noObserver: true });
  fallback.setScroll(140); fallback.window.emit('scroll');
  assert.equal(fallback.visible(), true);
  fallback.setScroll(0); fallback.window.emit('scroll');
  assert.equal(fallback.visible(), false);
  assert.equal(fallback.frames.size, 0);
});
