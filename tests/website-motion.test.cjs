const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const website = path.resolve(__dirname, '../website');
const source = fs.readFileSync(path.join(website, 'script.js'), 'utf8');
const storyVariables = ['--story-progress', '--phone-rotate', '--phone-tilt', '--phone-lift',
  '--phone-scale', '--active-step', '--screen-progress'];

function fixture(options = {}) {
  const registrations = [];
  const queries = [];
  const observers = [];
  const queue = new Map();
  const cancelled = [];
  const scrollCalls = [];
  const omitted = new Set(options.omit || []);
  let nextFrame = 1;
  let requests = 0;
  let document;
  let window;

  function events(name) {
    const handlers = new Map();
    return {
      handlers,
      addEventListener(type, callback, settings) {
        if (options.eventThrows === `${name}:${type}`) throw new Error('Unavailable event API');
        const entry = { name, type, callback, settings };
        registrations.push(entry);
        handlers.set(type, [...(handlers.get(type) || []), entry]);
      },
      dispatch(type, detail = {}) {
        const event = { type, defaultPrevented: false, preventions: 0,
          preventDefault() { this.preventions += 1; this.defaultPrevented = true; }, ...detail };
        for (const entry of [...(handlers.get(type) || [])]) {
          entry.callback.call(this, event);
          if (entry.settings && entry.settings.once) {
            handlers.set(type, handlers.get(type).filter(item => item !== entry));
          }
        }
        return event;
      },
    };
  }

  function element(name, classes = [], attributes = {}) {
    const node = events(name);
    const values = new Set(classes);
    const styles = new Map();
    const attrs = new Map(Object.entries(attributes));
    const singles = new Map();
    const multiples = new Map();
    Object.assign(node, {
      name, values, styles, attrs, singles, multiples, styleWrites: [], classWrites: [], attrWrites: [],
      focusCalls: [], intoViewCalls: [], rectReads: 0, tagName: 'DIV', textContent: '', hidden: false, inert: false,
      classList: {
        contains: name => values.has(name),
        add(name) { values.add(name); node.classWrites.push([name, true]); },
        remove(name) { values.delete(name); node.classWrites.push([name, false]); },
        toggle(name, force) {
          const enabled = typeof force === 'boolean' ? force : !values.has(name);
          if (enabled) values.add(name); else values.delete(name);
          node.classWrites.push([name, enabled]);
          return enabled;
        },
      },
      style: {
        setProperty(name, value) { styles.set(name, String(value)); node.styleWrites.push([name, String(value)]); },
        getPropertyValue(name) { return styles.get(name) || ''; },
        removeProperty(name) { const old = styles.get(name) || ''; styles.delete(name); node.styleWrites.push([name, null]); return old; },
      },
      querySelector(selector) { queries.push([name, selector]); return singles.get(selector) || null; },
      querySelectorAll(selector) { queries.push([name, selector]); return multiples.get(selector) || []; },
      getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
      hasAttribute(name) { return attrs.has(name); },
      setAttribute(name, value) { attrs.set(name, String(value)); node.attrWrites.push([name, String(value)]); },
      removeAttribute(name) { attrs.delete(name); node.attrWrites.push([name, null]); },
      focus(settings) { node.focusCalls.push(settings); document.activeElement = node; },
      scrollIntoView(settings) { node.intoViewCalls.push(settings); },
      getBoundingClientRect() {
        node.rectReads += 1;
        if (options.rectThrows === name) throw new Error('Geometry unavailable');
        return node.rectangle ? node.rectangle() : { top: 0, height: 400 };
      },
    });
    if (options.classList === 'toggle-only') {
      delete node.classList.add;
      delete node.classList.remove;
      delete node.classList.contains;
    }
    if (options.style === 'set-only') {
      delete node.style.removeProperty;
      delete node.style.getPropertyValue;
    }
    return node;
  }

  const root = element('root');
  const body = element('body');
  const header = element('header');
  const hero = element('hero', ['hero']);
  const heroPhone = element('hero-phone', ['phone-shell']);
  const showcase = element('showcase', ['scroll-showcase']);
  const sticky = element('sticky', ['showcase-sticky']);
  const phone = element('phone', ['showcase-phone']);
  const stack = element('stack', ['screen-stack']);
  const steps = Array.from({ length: options.stepCount ?? 4 }, (_, index) => element(`step-${index}`, index === 0 ? ['is-active'] : []));
  const screens = Array.from({ length: options.screenCount ?? 4 }, (_, index) => element(`screen-${index}`));
  const links = Array.from({ length: 4 }, (_, index) => element(`link-${index}`, [], { 'data-step-link': String(index), type: 'button' }));
  links.forEach(link => { link.tagName = 'BUTTON'; });
  for (const [index, extra] of (options.extraLinks || []).entries()) {
    const link = element(`extra-${index}`, [], { 'data-step-link': extra.value, ...(extra.attrs || {}) });
    link.tagName = extra.tagName || 'BUTTON';
    links.push(link);
  }
  const storyBar = element('story-bar', [], options.progressRole ? { role: 'progressbar', 'aria-valuenow': '0' } : {});
  const counter = element('counter');
  counter.textContent = 'Four everyday views';
  const documentBar = element('document-bar');
  const reveals = options.empty || options.headerOnly ? [] : [element('reveal-0'), element('reveal-1')];
  if (options.heroReveal) reveals.push(hero);
  if (options.storyReveal) reveals.push(showcase);

  document = { ...events('document'), documentElement: root, body, hidden: false, activeElement: null,
    querySelector(selector) {
      queries.push(['document', selector]);
      if (options.empty) return null;
      const nodes = { '[data-header]': header, '[data-hero]': hero,
        '[data-scroll-showcase]': showcase, '[data-scroll-progress]': documentBar };
      const node = nodes[selector];
      return !node || omitted.has(node.name) || (options.headerOnly && node !== header) ? null : node;
    },
    querySelectorAll(selector) { queries.push(['document', selector]); return selector === '[data-reveal]' ? reveals : []; },
  };
  hero.singles.set('[data-hero-phone]', omitted.has('hero-phone') ? null : heroPhone);
  for (const [selector, node] of [['.showcase-sticky', sticky], ['[data-phone]', phone], ['.screen-stack', stack],
    ['[data-story-progress]', storyBar], ['[data-story-counter]', counter]]) {
    showcase.singles.set(selector, omitted.has(node.name) ? null : node);
  }
  showcase.multiples.set('[data-step]', steps);
  showcase.multiples.set('[data-step-link]', links);
  stack.multiples.set('[data-tour-screen]', screens);
  root.scrollHeight = options.documentHeight ?? 7600;
  body.scrollHeight = root.scrollHeight;
  if (options.noRootClassList) delete root.classList;

  const reducedQuery = { ...events('reduced-query'), matches: !!options.reduced };
  const pinQuery = { ...events('pin-query'), matches: false };
  if (options.legacyMedia) {
    for (const query of [reducedQuery, pinQuery]) {
      query.addListener = callback => query.handlers.set('change', [{ callback }]);
      delete query.addEventListener;
    }
  }
  window = { ...events('window'), innerWidth: options.width ?? 1280, innerHeight: options.height ?? 900,
    scrollY: options.scrollY ?? 0, pageYOffset: options.scrollY ?? 0,
    matchMedia(query) {
      queries.push(['media', query]);
      if (options.mediaThrows) throw new Error('Media unavailable');
      return query.includes('prefers-reduced-motion') ? reducedQuery : pinQuery;
    },
    requestAnimationFrame(callback) {
      requests += 1;
      if (options.rafThrows) throw new Error('Frames unavailable');
      const id = nextFrame++;
      queue.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      cancelled.push(id);
      if (options.cancelThrows) throw new Error('Cannot cancel');
      queue.delete(id);
    },
    scrollTo(settings) {
      if (options.scrollToThrows) throw new Error('Scrolling unavailable');
      scrollCalls.push(settings);
    },
    IntersectionObserver: class {
      constructor(callback, settings) {
        if (options.observerThrows) throw new Error('Observer unavailable');
        this.callback = callback;
        this.settings = settings;
        this.observed = new Set();
        this.unobserved = [];
        this.disconnected = false;
        this.observeCalls = 0;
        observers.push(this);
      }
      observe(node) {
        this.observeCalls += 1;
        if (this.observeCalls === options.observeThrowsAt) throw new Error('Cannot observe');
        this.observed.add(node);
      }
      unobserve(node) {
        if (options.unobserveThrows) throw new Error('Cannot unobserve');
        this.unobserved.push(node);
        this.observed.delete(node);
      }
      disconnect() {
        this.disconnected = true;
        if (options.disconnectThrows) throw new Error('Cannot disconnect');
        this.observed.clear();
      }
      emit(entries) { this.callback(entries); }
    },
  };
  for (const name of options.missingApis || []) delete window[name];
  pinQuery.matches = (window.innerWidth >= 900 && window.innerHeight >= 760) ||
    (window.innerWidth >= 360 && window.innerWidth < 900 && window.innerHeight >= 640);
  root.clientWidth = window.innerWidth;
  root.clientHeight = window.innerHeight;
  hero.rectangle = () => ({ top: -window.scrollY, height: options.heroHeight ?? 920 });
  showcase.storyTop = options.storyTop ?? 1000;
  showcase.rectangle = () => ({ top: showcase.storyTop - window.scrollY,
    height: options.storyHeight ?? (root.values.has('story-enhanced') ? window.innerHeight * 5 : 2900) });

  vm.runInNewContext(source, { window, document }, { filename: 'website/script.js', timeout: 1000 });

  return {
    window, document, root, header, hero, heroPhone, showcase, steps, screens, links, reveals,
    counter, storyBar, documentBar, registrations, queries, observers, queue, cancelled, scrollCalls,
    reducedQuery, pinQuery, get requests() { return requests; },
    flush() { const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(callback => callback(16)); return callbacks.length; },
    scroll(y) { window.scrollY = y; window.pageYOffset = y; return window.dispatch('scroll'); },
    resize(width, height) {
      window.innerWidth = width; window.innerHeight = height;
      root.clientWidth = width; root.clientHeight = height;
      pinQuery.matches = (width >= 900 && height >= 760) ||
        (width >= 360 && width < 900 && height >= 640);
      window.dispatch('resize');
    },
    reduce(value) { reducedQuery.matches = value; reducedQuery.dispatch('change'); },
    hide(value) { document.hidden = value; document.dispatch('visibilitychange'); },
  };
}

const has = (node, name) => node.values.has(name);
const value = (node, name) => Number.parseFloat(node.styles.get(name));
const active = nodes => nodes.flatMap((node, index) => has(node, 'is-active') ? [index] : []);
const plain = value => JSON.parse(JSON.stringify(value));
const assertReadable = page => {
  assert.equal(has(page.root, 'story-enhanced'), false);
  assert.equal(has(page.showcase, 'story-static'), true);
  assert.deepEqual(active(page.steps), page.steps.map((_, index) => index));
  assert.deepEqual(active(page.screens), page.screens.map((_, index) => index));
  for (const node of page.screens) {
    assert.equal(node.hidden, false);
    assert.equal(node.inert, false);
    assert.notEqual(node.getAttribute('aria-hidden'), 'true');
  }
  for (const name of storyVariables) assert.ok(!page.showcase.styles.get(name), `${name} is cleared`);
};

const assertEnhanced = page => {
  assert.equal(has(page.root, 'story-enhanced'), true);
  assert.equal(has(page.showcase, 'story-static'), false);
  assert.equal(active(page.screens).length, 1);
  assert.equal(active(page.steps).length, 1);
};

test('desktop tour clamps both ends and selects the corresponding readable preview', () => {
  const page = fixture({ progressRole: true });
  page.flush();
  assert.equal(has(page.root, 'motion-enabled'), true);
  assert.equal(has(page.root, 'story-enhanced'), true);
  assert.equal(has(page.showcase, 'story-static'), false);
  assert.equal(value(page.showcase, '--story-progress'), 0);
  assert.equal(value(page.showcase, '--screen-progress'), 0);
  assert.deepEqual(active(page.screens), [0]);
  assert.deepEqual(active(page.steps), [0]);
  assert.equal(page.counter.textContent, '01 / 04');
  assert.equal(page.links[0].getAttribute('aria-current'), 'step');
  assert.equal(page.storyBar.getAttribute('aria-valuenow'), '0');

  page.scroll(1000 + 3600);
  page.flush();
  assert.equal(value(page.showcase, '--story-progress'), 1);
  assert.equal(value(page.showcase, '--screen-progress'), 3);
  assert.equal(value(page.showcase, '--active-step'), 3);
  assert.deepEqual(active(page.screens), [3]);
  assert.deepEqual(active(page.steps), [3]);
  assert.equal(page.counter.textContent, '04 / 04');
  assert.equal(page.storyBar.getAttribute('aria-valuenow'), '100');
  assert.equal(page.links[0].getAttribute('aria-current'), null);
  assert.equal(page.links[3].getAttribute('aria-current'), 'step');
  const writes = page.showcase.styleWrites.length;
  page.scroll(9000);
  page.flush();
  assert.equal(page.showcase.styleWrites.length, writes);
  assert.equal(value(page.showcase, '--story-progress'), 1);
  page.scroll(-90);
  page.flush();
  assert.equal(value(page.showcase, '--story-progress'), 0);
  assert.equal(value(page.showcase, '--phone-rotate'), -7);
  assert.equal(page.queue.size, 0);
});

test('scrub position is proportional, including positions between all four stages', () => {
  const page = fixture();
  page.flush();
  for (const [progress, step] of [[1 / 12, 0], [1 / 3, 1], [0.5, 2], [2 / 3, 2], [5 / 6, 3], [1, 3]]) {
    page.scroll(1000 + 3600 * progress);
    page.flush();
    assert.ok(Math.abs(value(page.showcase, '--story-progress') - progress) < 0.0001);
    assert.ok(Math.abs(value(page.showcase, '--screen-progress') - progress * 3) < 0.0001);
    assert.ok(Math.abs(value(page.showcase, '--phone-rotate') - (-7 + progress * 14)) < 0.001);
    assert.ok(Math.abs(value(page.showcase, '--phone-tilt') - (3 - progress * 6)) < 0.001);
    assert.ok(value(page.showcase, '--phone-lift') >= -16 && value(page.showcase, '--phone-lift') <= 0);
    assert.ok(value(page.showcase, '--phone-scale') >= 0.975 && value(page.showcase, '--phone-scale') <= 1);
    assert.deepEqual(active(page.steps), [step]);
    assert.deepEqual(active(page.screens), [step]);
  }
});

test('scroll bursts coalesce into one frame and there is no idle animation loop', () => {
  const page = fixture();
  assert.equal(page.queue.size, 1);
  assert.equal(page.flush(), 1);
  const requests = page.requests;
  const queries = page.queries.length;
  for (let y = 1000; y <= 2800; y += 100) page.scroll(y);
  assert.equal(page.queue.size, 1);
  assert.equal(page.requests, requests + 1);
  page.flush();
  assert.equal(value(page.showcase, '--story-progress'), 0.5);
  assert.equal(page.queue.size, 0);
  assert.equal(page.flush(), 0);
  assert.equal(page.queries.length, queries, 'scroll uses cached elements');
  assert.equal(page.showcase.rectReads, 1, 'scroll uses cached layout');
  assert.equal(page.hero.rectReads, 1);
  const writes = page.showcase.styleWrites.length;
  page.scroll(2800);
  page.flush();
  assert.equal(page.showcase.styleWrites.length, writes, 'unchanged scroll does not rewrite phone styles');
});

test('hero depth is a unitless clamped scroll value updated by the existing coalesced frame', () => {
  const page = fixture();
  page.flush();
  assert.equal(value(page.hero, '--hero-depth'), 0);
  const requests = page.requests;
  for (const y of [90, 180, 460]) page.scroll(y);
  assert.equal(page.queue.size, 1);
  assert.equal(page.requests, requests + 1);
  page.flush();
  assert.equal(value(page.hero, '--hero-depth'), 0.5);
  assert.match(page.hero.styles.get('--hero-depth'), /^\d(?:\.\d+)?$/);
  assert.equal(value(page.hero, '--hero-lift'), -11);
  assert.equal(value(page.hero, '--hero-rotate'), -1);
  assert.equal(page.hero.rectReads, 1);
  const writes = page.hero.styleWrites.length;
  page.scroll(460);
  page.flush();
  assert.equal(page.hero.styleWrites.length, writes);
  page.scroll(920);
  page.flush();
  assert.equal(value(page.hero, '--hero-depth'), 1);
  page.scroll(-90);
  page.flush();
  assert.equal(value(page.hero, '--hero-depth'), 0);
  assert.equal(page.queue.size, 0);

  const zeroHeight = fixture({ heroHeight: 0 });
  zeroHeight.flush();
  zeroHeight.scroll(1);
  zeroHeight.flush();
  assert.equal(value(zeroHeight.hero, '--hero-depth'), 1);
  assert.ok([...zeroHeight.hero.styles.values()].every(entry => !/NaN|Infinity/.test(entry)));
});

test('phone-sized viewports use the pinned story and short screens restore the readable fallback', () => {
  const page = fixture();
  page.flush();
  page.scroll(2800);
  page.flush();
  page.resize(899, 900);
  assertEnhanced(page);
  page.flush();
  assert.equal(has(page.root, 'motion-enabled'), true, 'gentle reveals can still run on small screens');
  page.resize(1280, 759);
  page.flush();
  assertReadable(page);
  page.resize(900, 760);
  page.flush();
  assertEnhanced(page);
  assert.ok(Math.abs(value(page.showcase, '--story-progress') - 1800 / 3040) < 0.0001);
  assert.deepEqual(active(page.screens), [2]);
  assert.equal(page.queue.size, 0);
});

test('the pin media query independently controls the long-story mode', () => {
  const page = fixture();
  page.flush();
  page.pinQuery.matches = false;
  page.pinQuery.dispatch('change');
  page.flush();
  assertReadable(page);
  page.pinQuery.matches = true;
  page.pinQuery.dispatch('change');
  page.flush();
  assert.equal(has(page.root, 'story-enhanced'), true);
});

test('reduced-motion changes cancel existing work, clear motion styles, and keep every preview readable', () => {
  const page = fixture({ progressRole: true });
  page.flush();
  page.scroll(200);
  page.flush();
  assert.ok(page.hero.styles.has('--hero-lift'));
  assert.ok(page.hero.styles.has('--hero-depth'));
  page.scroll(2800);
  const oldFrame = [...page.queue.values()][0];
  const oldObserver = page.observers[0];
  page.reduce(true);
  assertReadable(page);
  assert.equal(has(page.root, 'motion-enabled'), false);
  assert.equal(page.hero.styles.size, 0);
  assert.equal(page.hero.styles.has('--hero-depth'), false);
  assert.equal(page.documentBar.styles.size, 0);
  assert.ok(page.reveals.every(node => has(node, 'is-visible')));
  assert.equal(page.counter.textContent, 'Four everyday views');
  assert.equal(page.storyBar.getAttribute('aria-valuenow'), '0');
  assert.ok(page.links.every(link => link.getAttribute('aria-current') === null));
  oldFrame(16);
  oldObserver.emit([{ target: page.showcase, isIntersecting: false }, { target: page.reveals[0], isIntersecting: false }]);
  page.flush();
  assertReadable(page);
  assert.equal(page.documentBar.styles.size, 0);
  assert.equal(page.queue.size, 0);

  page.reduce(false);
  page.flush();
  assert.equal(has(page.root, 'motion-enabled'), true);
  assert.equal(has(page.root, 'story-enhanced'), true);
  assert.equal(value(page.showcase, '--story-progress'), 0.5);
  assert.notEqual(page.observers.at(-1), oldObserver);
  assert.ok(page.reveals.every(node => has(node, 'is-visible')), 'once-visible text never hides again');
});

test('hero depth clears and resumes with reduced-motion media changes, including set-only style APIs', () => {
  for (const options of [{}, { style: 'set-only' }]) {
    const page = fixture(options);
    page.flush();
    page.scroll(460);
    page.flush();
    assert.equal(value(page.hero, '--hero-depth'), 0.5);
    page.reduce(true);
    assert.ok(!page.hero.styles.get('--hero-depth'));
    page.window.dispatch('expenzo:layout');
    page.flush();
    assertReadable(page);
    assert.ok(!page.hero.styles.get('--hero-depth'));
    page.reduce(false);
    page.flush();
    assert.equal(value(page.hero, '--hero-depth'), 0.5);
    assert.equal(page.queue.size, 0);
  }
});

test('starting with reduced motion needs no observer and exposes the static tour immediately', () => {
  const page = fixture({ reduced: true });
  assertReadable(page);
  assert.equal(has(page.root, 'motion-enabled'), false);
  assert.equal(page.observers.length, 0);
  page.flush();
  page.scroll(3000);
  page.flush();
  assertReadable(page);
  assert.ok(page.reveals.every(node => has(node, 'is-visible')));
  assert.equal(page.hero.styles.size, 0);
});

test('entrances reveal once, ignore non-owned targets, and do not start an idle frame loop', () => {
  const page = fixture();
  page.flush();
  const observer = page.observers[0];
  observer.emit([{ target: page.reveals[0], isIntersecting: false, intersectionRatio: 0 }]);
  assert.equal(has(page.reveals[0], 'is-visible'), false);
  observer.emit([{ target: page.reveals[0], isIntersecting: true, intersectionRatio: 0.6 },
    { target: page.links[0], isIntersecting: true }]);
  assert.equal(has(page.reveals[0], 'is-visible'), true);
  assert.equal(observer.observed.has(page.reveals[0]), false);
  assert.equal(has(page.links[0], 'is-visible'), false);
  const writes = page.reveals[0].classWrites.length;
  observer.emit([{ target: page.reveals[0], isIntersecting: false }, { target: page.reveals[0], isIntersecting: true }]);
  assert.equal(page.reveals[0].classWrites.length, writes);
  assert.equal(page.queue.size, 0);
});

test('hero or story reveal targets retain their offscreen observation after the entrance', () => {
  const page = fixture({ heroReveal: true, storyReveal: true });
  page.flush();
  const observer = page.observers[0];
  observer.emit([{ target: page.hero, isIntersecting: true }, { target: page.showcase, isIntersecting: true }]);
  assert.equal(has(page.hero, 'is-visible'), true);
  assert.equal(has(page.showcase, 'is-visible'), true);
  assert.equal(observer.observed.has(page.hero), true);
  assert.equal(observer.observed.has(page.showcase), true);
  observer.emit([{ target: page.hero, isIntersecting: false }, { target: page.showcase, isIntersecting: false }]);
  page.flush();
  const writes = page.showcase.styleWrites.length;
  page.scroll(2800);
  page.flush();
  assert.equal(page.showcase.styleWrites.length, writes);
  assert.equal(has(page.showcase, 'is-visible'), true);
});

test('offscreen phones skip scrub updates and resume with the current scroll position', () => {
  const page = fixture();
  page.flush();
  const observer = page.observers[0];
  observer.emit([{ target: page.hero, isIntersecting: false }, { target: page.showcase, isIntersecting: false }]);
  page.flush();
  const phoneWrites = page.showcase.styleWrites.length;
  const heroWrites = page.hero.styleWrites.length;
  page.scroll(2500);
  page.flush();
  assert.equal(page.showcase.styleWrites.length, phoneWrites);
  assert.equal(page.hero.styleWrites.length, heroWrites);
  assert.equal(page.showcase.rectReads, 1);
  observer.emit([{ target: page.showcase, isIntersecting: true }]);
  page.flush();
  assert.ok(Math.abs(value(page.showcase, '--story-progress') - 1500 / 3600) < 0.0001);
  assert.equal(page.queue.size, 0);
  page.scroll(7000);
  page.flush();
  assert.equal(value(page.showcase, '--story-progress'), 1, 'a jump past the story resolves its final screen');
});

test('hidden documents suspend frames and stale observers; visibility resumes at the latest position', () => {
  const page = fixture();
  page.flush();
  const oldObserver = page.observers[0];
  page.scroll(1900);
  const oldFrame = [...page.queue.values()][0];
  page.hide(true);
  assert.equal(page.queue.size, 0);
  const writes = page.showcase.styleWrites.length;
  page.scroll(3400);
  oldFrame(16);
  oldObserver.emit([{ target: page.showcase, isIntersecting: false }, { target: page.reveals[1], isIntersecting: true }]);
  assert.equal(page.showcase.styleWrites.length, writes);
  assert.equal(has(page.reveals[1], 'is-visible'), false);
  assert.equal(page.queue.size, 0);
  page.hide(false);
  page.flush();
  assert.ok(Math.abs(value(page.showcase, '--story-progress') - 2 / 3) < 0.0001);
  assert.deepEqual(active(page.screens), [2]);
  assert.equal(page.showcase.rectReads, 2);
  assert.equal(page.queue.size, 0);
});

test('pageshow and back-forward restoration remeasure layout and recover the correct stage', () => {
  const page = fixture({ scrollY: 2200 });
  page.flush();
  assert.equal(value(page.showcase, '--screen-progress'), 1);
  page.window.dispatch('pagehide', { persisted: true });
  assert.equal(page.observers[0].disconnected, true);
  page.showcase.storyTop = 1200;
  page.window.scrollY = 3600;
  page.window.pageYOffset = 3600;
  page.window.dispatch('pageshow', { persisted: true });
  page.flush();
  assert.equal(value(page.showcase, '--screen-progress'), 2);
  assert.equal(page.counter.textContent, '03 / 04');
  assert.equal(page.showcase.rectReads, 2);
  assert.equal(page.queue.size, 0);
});

test('document progress and the header follow native scroll, including a page with no scroll distance', () => {
  const page = fixture();
  page.flush();
  assert.equal(has(page.header, 'is-scrolled'), false);
  assert.equal(value(page.documentBar, '--scroll-progress'), 0);
  page.scroll(3350);
  page.flush();
  assert.equal(has(page.header, 'is-scrolled'), true);
  assert.equal(value(page.documentBar, '--scroll-progress'), 0.5);
  page.scroll(10000);
  page.flush();
  assert.equal(value(page.documentBar, '--scroll-progress'), 1);
  page.scroll(0);
  page.flush();
  assert.equal(has(page.header, 'is-scrolled'), false);

  const short = fixture({ documentHeight: 900 });
  short.flush();
  short.scroll(40);
  short.flush();
  assert.equal(value(short.documentBar, '--scroll-progress'), 0);
  for (const node of [short.showcase, short.hero, short.documentBar]) {
    assert.ok([...node.styles.values()].every(value => !/NaN|Infinity/.test(value)));
  }
});

test('scroll and resize listeners are passive and the script never hijacks wheel, touch, or keyboard events', () => {
  const page = fixture();
  for (const type of ['scroll', 'resize']) {
    const registered = page.registrations.filter(event => event.name === 'window' && event.type === type);
    assert.equal(registered.length, 1);
    assert.equal(registered[0].settings.passive, true);
  }
  assert.ok(!page.registrations.some(event => /^(wheel|mousewheel|touchstart|touchmove|keydown|keyup|pointermove)$/.test(event.type)));
  for (const type of ['scroll', 'wheel', 'touchmove', 'keydown']) {
    const event = page.window.dispatch(type, { key: 'ArrowDown' });
    assert.equal(event.preventions, 0);
  }
  const click = page.links[1].dispatch('click', { detail: 0 });
  assert.equal(click.preventions, 0, 'keyboard-generated native button clicks retain their default behavior');
});

test('desktop story buttons smoothly scroll to each actual stage without moving keyboard focus', () => {
  const page = fixture();
  page.flush();
  for (let index = 0; index < 4; index += 1) {
    const event = page.links[index].dispatch('click');
    assert.deepEqual(plain(page.scrollCalls.at(-1)), { top: 1000 + 1200 * index, behavior: 'smooth' });
    assert.equal(event.preventions, 0);
    assert.equal(page.screens[index].focusCalls.length, 0);
    page.scroll(page.scrollCalls.at(-1).top);
    page.flush();
    assert.deepEqual(active(page.screens), [index]);
    assert.equal(page.links[index].getAttribute('aria-current'), 'step');
  }
  page.resize(1280, 800);
  page.showcase.storyTop = 1300;
  page.links[2].dispatch('click');
  assert.deepEqual(plain(page.scrollCalls.at(-1)), { top: 1300 + 3200 * 2 / 3, behavior: 'smooth' });
});

test('mobile story buttons smoothly scroll while reduced-motion keeps readable static previews', () => {
  const mobile = fixture({ width: 390, height: 844 });
  mobile.flush();
  assertEnhanced(mobile);
  const event = mobile.links[2].dispatch('click', { detail: 0 });
  assert.equal(event.preventions, 0);
  assert.deepEqual(plain(mobile.scrollCalls.at(-1)), { top: 1000 + (844 * 4) * 2 / 3, behavior: 'smooth' });
  assert.equal(mobile.screens[2].focusCalls.length, 0);

  for (const options of [{ reduced: true }]) {
    const page = fixture(options);
    page.flush();
    assertReadable(page);
    const event = page.links[2].dispatch('click', { detail: 0 });
    assert.equal(event.preventions, 0);
    assert.equal(page.scrollCalls.length, 0);
    assert.equal(page.document.activeElement, page.steps[2]);
    assert.equal(page.steps[2].getAttribute('tabindex'), '-1');
    assert.deepEqual(plain(page.steps[2].focusCalls.at(-1)), { preventScroll: true });
    assert.deepEqual(plain(page.steps[2].intoViewCalls.at(-1)), { block: 'start', behavior: 'auto' });
    assert.equal(page.screens[2].focusCalls.length, 0, 'decorative phone contents do not receive focus');
    page.steps[1].setAttribute('tabindex', '0');
    page.links[1].dispatch('click');
    assert.equal(page.steps[1].getAttribute('tabindex'), '0', 'authored focusability is preserved');
    assertReadable(page);
  }
});

test('invalid step attributes are inert and anchors keep their native hash and modifier-key behavior', () => {
  const page = fixture({ extraLinks: [
    ...['', '00', ' 2', '-1', '4', '2x', '1.1', 'Infinity'].map(value => ({ value })),
    { value: '2', tagName: 'A', attrs: { href: '#screen-2' } },
  ] });
  page.flush();
  for (const link of page.links.slice(4)) {
    assert.equal((link.handlers.get('click') || []).length, 0);
    const event = link.dispatch('click', { ctrlKey: true });
    assert.equal(event.preventions, 0);
  }
  assert.equal(page.links.at(-1).getAttribute('href'), '#screen-2');
  for (const detail of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true },
    { button: 1 }, { defaultPrevented: true }]) page.links[1].dispatch('click', detail);
  assert.equal(page.scrollCalls.length, 0);
  page.links[2].setAttribute('data-step-link', '4');
  page.links[2].dispatch('click');
  assert.equal(page.scrollCalls.length, 0, 'a changed invalid attribute is checked again at activation');
});

test('stories shorter than the viewport fall back to all visible previews without invalid transforms', () => {
  for (const storyHeight of [0, 1, 900]) {
    const page = fixture({ storyHeight });
    page.flush();
    assertReadable(page);
    for (const y of [0, 1000, 1500, 10000]) {
      page.scroll(y);
      page.flush();
      assertReadable(page);
    }
    assert.equal(page.queue.size, 0);
    for (const node of [page.showcase, page.hero, page.documentBar]) {
      assert.ok([...node.styles.values()].every(value => !/NaN|Infinity/.test(value)));
    }
  }
});

test('optional indicators and hero phone can be omitted without breaking the four-stage story', () => {
  const page = fixture({ omit: ['header', 'hero-phone', 'story-bar', 'counter', 'document-bar'] });
  page.flush();
  assert.equal(has(page.root, 'story-enhanced'), true);
  page.scroll(3400);
  page.flush();
  assert.deepEqual(active(page.screens), [2]);
  assert.equal(page.hero.styleWrites.length, 0);
  assert.equal(page.queue.size, 0);
});

test('incomplete stories stay readable rather than pinning a hidden or missing screen', () => {
  for (const options of [{ screenCount: 3 }, { stepCount: 3 }, { omit: ['phone'] }, { omit: ['sticky'] }, { omit: ['stack'] }]) {
    const page = fixture(options);
    page.flush();
    assert.equal(has(page.root, 'story-enhanced'), false);
    assert.equal(has(page.showcase, 'story-static'), true);
    assert.deepEqual(active(page.steps), page.steps.map((_, index) => index));
    assert.equal(page.showcase.styles.size, 0);
    assert.equal(page.queue.size, 0);
  }
});

test('absent browser capabilities preserve the fully readable static site', async t => {
  const cases = [
    ['no animation frames', { missingApis: ['requestAnimationFrame'] }],
    ['no cancellation API', { missingApis: ['cancelAnimationFrame'] }],
    ['no media queries', { missingApis: ['matchMedia'] }],
    ['no intersection observer', { missingApis: ['IntersectionObserver'] }],
    ['no root classList', { noRootClassList: true }],
    ['no media change listener', { eventThrows: 'reduced-query:change' }],
    ['no resize event API', { eventThrows: 'window:resize' }],
  ];
  for (const [name, options] of cases) {
    await t.test(name, () => {
      const page = fixture(options);
      page.flush();
      assertReadable(page);
      assert.equal(has(page.root, 'motion-enabled'), false);
      assert.ok(page.reveals.every(node => has(node, 'is-visible')));
      page.scroll(3000);
      page.resize(400, 850);
      page.flush();
      assertReadable(page);
      assert.equal(page.queue.size, 0);
    });
  }
});

test('throwing capability setup falls back, including a partially attached observer', async t => {
  const cases = [
    ['matchMedia', { mediaThrows: true }],
    ['observer construction', { observerThrows: true }],
    ['observer attachment', { observeThrowsAt: 2 }],
    ['frame scheduling', { rafThrows: true }],
    ['geometry', { rectThrows: 'showcase' }],
  ];
  for (const [name, options] of cases) {
    await t.test(name, () => {
      const page = fixture(options);
      page.flush();
      assertReadable(page);
      assert.equal(has(page.root, 'motion-enabled'), false);
      assert.ok(page.reveals.every(node => has(node, 'is-visible')));
      if (page.observers.length) assert.equal(page.observers[0].disconnected, true);
      page.scroll(3000);
      page.flush();
      assertReadable(page);
      assert.equal(page.queue.size, 0);
    });
  }
});

test('stale callbacks stay harmless even if observer disconnect or frame cancellation throws', () => {
  const page = fixture({ cancelThrows: true, disconnectThrows: true });
  page.flush();
  page.scroll(2800);
  const oldObserver = page.observers[0];
  page.reduce(true);
  const writes = page.showcase.styleWrites.length;
  oldObserver.emit([{ target: page.showcase, isIntersecting: true }, { target: page.reveals[0], isIntersecting: true }]);
  page.flush();
  assertReadable(page);
  assert.equal(has(page.root, 'motion-enabled'), false);
  assert.equal(page.showcase.styleWrites.length, writes);
  assert.equal(page.queue.size, 0);
});

test('an obsolete observer cannot change visibility flags after motion is re-enabled', () => {
  const page = fixture();
  page.flush();
  const oldObserver = page.observers[0];
  page.reduce(true);
  page.flush();
  page.reduce(false);
  page.flush();
  oldObserver.emit([{ target: page.hero, isIntersecting: false }, { target: page.showcase, isIntersecting: false }]);
  assert.equal(page.queue.size, 0);
  page.scroll(200);
  page.flush();
  assert.ok(value(page.hero, '--hero-lift') < 0);
  page.scroll(2800);
  page.flush();
  assert.equal(value(page.showcase, '--screen-progress'), 1.5);
});

test('a missing programmatic scrolling API keeps story buttons in the accessible static mode', () => {
  const page = fixture({ missingApis: ['scrollTo'] });
  page.flush();
  assertReadable(page);
  page.links[2].dispatch('click');
  assert.equal(page.document.activeElement, page.steps[2]);
  assert.equal(page.steps[2].intoViewCalls.length, 1);
});

test('legacy media listeners and minimal classList/style mocks still support progressive motion', () => {
  const page = fixture({ legacyMedia: true, classList: 'toggle-only', style: 'set-only' });
  page.flush();
  assert.equal(has(page.root, 'story-enhanced'), true);
  page.scroll(3400);
  page.flush();
  assert.deepEqual(active(page.screens), [2]);
  page.reduce(true);
  page.flush();
  assertReadable(page);
  assert.equal(has(page.root, 'motion-enabled'), false);
  assert.ok(page.reveals.every(node => has(node, 'is-visible')));
});

test('scrollTo failures safely expose static previews and usable button destinations', () => {
  const page = fixture({ scrollToThrows: true });
  page.flush();
  page.links[3].dispatch('click');
  assertReadable(page);
  assert.equal(has(page.root, 'motion-enabled'), false);
  assert.equal(page.document.activeElement, page.steps[3]);
  assert.equal(page.steps[3].intoViewCalls.length, 1);
});

test('late layout loads invalidate cached measurements without creating an idle loop', () => {
  const page = fixture();
  page.flush();
  page.showcase.storyTop = 1600;
  page.root.scrollHeight = 10000;
  page.document.body.scrollHeight = 10000;
  page.scroll(2800);
  page.window.dispatch('load');
  page.flush();
  assert.equal(value(page.showcase, '--screen-progress'), 1);
  assert.ok(Math.abs(value(page.documentBar, '--scroll-progress') - 2800 / 9100) < 0.0001);
  assert.equal(page.showcase.rectReads, 2);
  assert.equal(page.queue.size, 0);
});

test('mode and native-details layout notifications refresh cached story geometry through one passive listener', () => {
  const page = fixture();
  page.flush();
  page.scroll(2800);
  page.flush();
  assert.equal(value(page.showcase, '--screen-progress'), 1.5);
  assert.deepEqual(active(page.steps), [2]);
  page.showcase.storyTop = 1600;
  page.showcase.rectangle = () => ({ top: page.showcase.storyTop - page.window.scrollY, height: 3900 });
  page.root.scrollHeight = 10000;
  page.document.body.scrollHeight = 10000;
  page.scroll(2800);
  page.flush();
  assert.equal(value(page.showcase, '--screen-progress'), 1.5, 'native scroll normally uses cached geometry');
  assert.equal(page.showcase.rectReads, 1);
  const requests = page.requests;
  const listener = page.registrations.filter(entry => entry.name === 'window' && entry.type === 'expenzo:layout');
  assert.equal(listener.length, 1);
  assert.equal(listener[0].settings.passive, true);
  page.window.dispatch('expenzo:layout');
  page.window.dispatch('expenzo:layout');
  page.scroll(2800);
  assert.equal(page.queue.size, 1);
  assert.equal(page.requests, requests + 1);
  assert.equal(page.showcase.rectReads, 1, 'layout events do not force synchronous scroll measurements');
  page.flush();
  assert.equal(value(page.showcase, '--story-progress'), 0.4);
  assert.equal(value(page.showcase, '--screen-progress'), 1.2);
  assert.deepEqual(active(page.steps), [1]);
  assert.deepEqual(active(page.screens), [1]);
  assert.ok(Math.abs(value(page.documentBar, '--scroll-progress') - 2800 / 9100) < 0.0001);
  assert.equal(page.showcase.rectReads, 2);
  assert.equal(page.hero.rectReads, 2);
  page.links[2].dispatch('click');
  assert.deepEqual(plain(page.scrollCalls.at(-1)), { top: 3600, behavior: 'smooth' });
  page.scroll(2820);
  page.flush();
  assert.equal(page.showcase.rectReads, 2, 'fresh geometry is cached again');
  assert.equal(page.queue.size, 0);
});

test('a layout notification can restore a previously too-short story after its content expands', () => {
  const page = fixture({ storyHeight: 900 });
  page.flush();
  assertReadable(page);
  page.showcase.rectangle = () => ({ top: page.showcase.storyTop - page.window.scrollY, height: 4500 });
  page.scroll(2800);
  page.window.dispatch('expenzo:layout');
  page.flush();
  assert.equal(has(page.root, 'story-enhanced'), true);
  assert.equal(value(page.showcase, '--screen-progress'), 1.5);
  assert.deepEqual(active(page.screens), [2]);
  assert.equal(page.queue.size, 0);
});

test('legal or empty pages create no motion state, observers, listeners, or frames', () => {
  const page = fixture({ empty: true, missingApis: ['matchMedia', 'requestAnimationFrame', 'IntersectionObserver'] });
  assert.equal(page.root.values.size, 0);
  assert.equal(page.observers.length, 0);
  assert.equal(page.registrations.length, 0);
  assert.equal(page.queue.size, 0);
  assert.ok(!page.queries.some(([scope]) => scope === 'media'));
});

test('a header-only page remains usable without adding animation classes', () => {
  const page = fixture({ headerOnly: true });
  page.flush();
  page.scroll(90);
  page.flush();
  assert.equal(has(page.header, 'is-scrolled'), true);
  assert.equal(has(page.root, 'motion-enabled'), false);
  assert.equal(has(page.root, 'story-enhanced'), false);
  assert.equal(page.observers.length, 0);
  assert.equal(page.queue.size, 0);
});

test('the shipped no-JavaScript document retains four descriptive steps and visible static previews', () => {
  const html = fs.readFileSync(path.join(website, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(website, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const tour = html.match(/<section\b[^>]*\bdata-scroll-showcase\b[^>]*>[\s\S]*?<\/section>/)?.[0];
  assert.ok(tour, 'the walkthrough is present in the static document');
  assert.equal([...tour.matchAll(/\bdata-tour-screen\b/g)].length, 4);
  const descriptions = [...tour.matchAll(/<article\b([^>]*\bdata-step\b[^>]*)>([\s\S]*?)<\/article>/g)];
  assert.equal(descriptions.length, 4);
  for (const [, attributes, content] of descriptions) {
    assert.doesNotMatch(attributes, /(?:^|\s)hidden(?:\s|=|$)|aria-hidden=["']true["']/);
    assert.match(content, /<h3\b[^>]*>[^<]+<\/h3>/);
    assert.match(content, /<p\b[^>]*>[^<]+<\/p>/);
  }
  assert.doesNotMatch(html.match(/<html\b[^>]*>/)?.[0] || '', /motion-enabled|story-enhanced/);

  // Validate the progressive CSS boundary, not colors, dimensions, or screen copy.
  for (const [, selectors, declarations] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const selector of selectors.split(',')) {
      if (/\.story-enhanced|\.motion-enabled|::before|::after/.test(selector)) continue;
      const target = selector.trim().split(/\s+/).at(-1);
      const textTarget = /^\[data-reveal\]|^\.tour-screen\b|^\.feature-step\b/.test(target) ||
        (/\.feature-step\b/.test(selector) && /^(?:h3|p)$/.test(target));
      if (textTarget) {
        assert.doesNotMatch(declarations, /(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?\s*(?:!important\s*)?[;}])/i,
          `static text must not be hidden by ${selector.trim()}`);
      }
      if (/^\.tour-screen\b/.test(target)) {
        assert.doesNotMatch(declarations, /position\s*:\s*(?:absolute|fixed)\b/i, `static screens must remain in flow: ${selector.trim()}`);
      }
      if (/^\.showcase-sticky\b/.test(target)) {
        assert.doesNotMatch(declarations, /position\s*:\s*sticky\b/i, 'the no-JS tour must not pin');
      }
    }
  }
});
