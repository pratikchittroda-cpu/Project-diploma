const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const website = path.resolve(__dirname, '../website');
const source = fs.readFileSync(path.join(website, 'experience.js'), 'utf8');

function fixture(options = {}) {
  const registrations = [];
  const layouts = [];
  const writes = [];
  const localCalls = [];
  const failures = new Set();
  const nodes = [];
  let document;

  function fault(key) {
    if (failures.has(key)) throw new Error(`Unavailable API: ${key}`);
  }

  function events(name) {
    const handlers = new Map();
    return {
      handlers,
      addEventListener(type, callback, settings) {
        fault(`listen:${name}:${type}`);
        const entry = { name, type, callback, settings };
        registrations.push(entry);
        handlers.set(type, [...(handlers.get(type) || []), entry]);
        writes.push([name, 'listen', type]);
        fault(`listen-after:${name}:${type}`);
      },
      removeEventListener(type, callback) {
        fault(`unlisten:${name}:${type}`);
        handlers.set(type, (handlers.get(type) || []).filter(entry => entry.callback !== callback));
      },
      dispatch(type, detail = {}) {
        const event = { type, target: this, currentTarget: this, defaultPrevented: false, preventions: 0,
          preventDefault() { this.preventions += 1; this.defaultPrevented = true; }, ...detail };
        for (const entry of [...(handlers.get(type) || [])]) entry.callback.call(this, event);
        return event;
      },
    };
  }

  function element(name, tagName = 'DIV', attributes = {}) {
    const node = events(name);
    const attrs = new Map(Object.entries(attributes));
    const values = new Set((attrs.get('class') || '').split(/\s+/).filter(Boolean));
    let text = '';
    let open = false;
    function updateClass(value, enabled) {
      fault(`class:${name}:${value}:${enabled}`);
      if (enabled) values.add(value); else values.delete(value);
      attrs.set('class', [...values].join(' '));
      writes.push([name, 'class', value, enabled]);
      fault(`class-after:${name}:${value}:${enabled}`);
    }
    Object.assign(node, {
      name, tagName, attrs, values, multiples: new Map(), owner: null, focusCalls: [], disabled: false, inert: false,
      classList: {
        contains(value) { return values.has(value); },
        add(value) { updateClass(value, true); },
        remove(value) { updateClass(value, false); },
        toggle(value, force) {
          const enabled = typeof force === 'boolean' ? force : !values.has(value);
          updateClass(value, enabled);
          return enabled;
        },
      },
      getAttribute(value) { fault(`read:${name}:${value}`); return attrs.has(value) ? attrs.get(value) : null; },
      setAttribute(value, content) {
        fault(`attribute:${name}:${value}:${content}`);
        attrs.set(value, String(content));
        if (value === 'class') {
          values.clear();
          for (const item of String(content).split(/\s+/).filter(Boolean)) values.add(item);
        }
        writes.push([name, 'attribute', value, String(content)]);
      },
      removeAttribute(value) { attrs.delete(value); writes.push([name, 'remove', value]); },
      querySelectorAll(selector) { fault(`query:${name}:${selector}`); return node.multiples.get(selector) || []; },
      closest(selector) { return selector === '[data-mode-lab]' ? node.owner : null; },
      focus(settings) { node.focusCalls.push(settings); document.activeElement = node; },
    });
    Object.defineProperties(node, {
      hidden: { configurable: true, get() { return attrs.has('hidden'); }, set(value) {
        fault(`hidden:${name}:${value}`);
        if (value) attrs.set('hidden', ''); else attrs.delete('hidden');
        writes.push([name, 'hidden', !!value]);
      } },
      open: { get() { return open; }, set(value) { fault(`open:${name}:${value}`); open = !!value; } },
      textContent: { get() { return text; }, set(value) {
        fault(`text:${name}`);
        text = String(value);
        writes.push([name, 'text', text]);
      } },
    });
    nodes.push(node);
    return node;
  }

  const groups = Array.from({ length: options.groupCount ?? 1 }, (_, index) => {
    const group = element(`group-${index}`, 'SECTION', { id: index === 0 ? 'mode-lab' : `mode-lab-${index}`, 'data-mode-lab': '' });
    const entries = ['personal', 'company'].map(mode => {
      const panel = element(`panel-${mode}-${index}`, 'ARTICLE', { id: `mode-${mode}-${index}`, 'data-mode-panel': mode });
      const button = element(`button-${mode}-${index}`, 'BUTTON', { type: 'button', 'data-mode-button': mode,
        'aria-controls': panel.getAttribute('id'), 'aria-pressed': String(mode === 'personal') });
      panel.owner = group;
      button.owner = group;
      return { mode, panel, button };
    });
    const status = element(`status-${index}`, 'P', { 'data-mode-status': '', role: 'status', 'aria-live': 'polite' });
    status.textContent = 'Both previews use sample records, not live accounts.';
    status.owner = group;
    group.multiples.set('[data-mode-button]', entries.map(entry => entry.button));
    group.multiples.set('[data-mode-panel]', entries.map(entry => entry.panel));
    group.multiples.set('[data-mode-status]', [status]);
    Object.assign(group, { entries, status, personal: entries[0], company: entries[1] });
    return group;
  });

  const menu = element('menu', 'DETAILS', { class: 'mobile-menu' });
  const summary = element('summary', 'SUMMARY');
  const links = [
    { href: '#feature-tour' }, { href: '#mode-lab' }, { href: './privacy.html' },
    { href: 'https://example.test/#product' }, { href: 'mailto:demo@example.test' },
    { href: '#feature-tour', target: '_blank' }, { href: '#feature-tour', download: '' },
  ].map((attrs, index) => element(`menu-link-${index}`, 'A', attrs));
  menu.multiples.set('a[href]', links);
  menu.multiples.set('summary', [summary]);
  menu.open = !!options.menuOpen;
  const faqs = [element('faq-0', 'DETAILS'), element('faq-1', 'DETAILS')];
  faqs[0].open = true;
  const details = options.noDetails ? [] : [menu, ...faqs];

  const forbidden = name => () => { localCalls.push(name); throw new Error(`${name} is not part of a local preview`); };
  const window = { ...events('window'),
    Event: class {
      constructor(type) { fault('Event'); this.type = type; this.defaultPrevented = false; }
    },
    dispatchEvent(event) {
      fault('dispatchEvent');
      if (event.type === 'expenzo:layout') layouts.push(groups.map(group => ({
        enhanced: group.values.has('modes-enhanced'), status: group.status.textContent,
        entries: group.entries.map(({ mode, panel, button }) => ({ mode, hidden: panel.hidden,
          pressed: button.attrs.get('aria-pressed'), current: button.values.has('is-current') })),
      })));
      window.dispatch(event.type, event);
      return true;
    },
    fetch: forbidden('fetch'), XMLHttpRequest: forbidden('XMLHttpRequest'), WebSocket: forbidden('WebSocket'),
    requestAnimationFrame: forbidden('requestAnimationFrame'), setTimeout: forbidden('setTimeout'),
    scrollTo: forbidden('scrollTo'), IntersectionObserver: forbidden('IntersectionObserver'),
    navigator: { sendBeacon: forbidden('sendBeacon') },
  };
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(window, name, { get: forbidden(name) });
  }
  document = { ...events('document'), activeElement: null,
    getElementById(id) { return nodes.find(node => node.attrs.get('id') === id) || null; },
    querySelectorAll(selector) {
      fault(`query:document:${selector}`);
      if (selector === '[data-mode-lab]') return groups;
      if (selector === 'details') return details;
      if (selector === 'details.mobile-menu') return options.noDetails ? [] : [menu];
      return [];
    },
  };
  Object.defineProperty(document, 'cookie', { get: forbidden('cookie'), set: forbidden('cookie') });

  const page = { window, document, groups, nodes, menu, summary, links, faqs, registrations,
    layouts, writes, localCalls, failures,
    run() {
      const globals = { window, document, Event: window.Event, fetch: window.fetch,
        XMLHttpRequest: window.XMLHttpRequest, WebSocket: window.WebSocket, navigator: window.navigator,
        requestAnimationFrame: window.requestAnimationFrame, setTimeout: window.setTimeout,
        IntersectionObserver: window.IntersectionObserver, scrollTo: window.scrollTo };
      for (const name of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(globals, name, Object.getOwnPropertyDescriptor(window, name));
      }
      vm.runInNewContext(source, globals, { filename: 'website/experience.js', timeout: 1000 });
    },
  };
  if (options.before) options.before(page);
  for (const failure of options.failures || []) failures.add(failure);
  writes.length = 0;
  if (options.run !== false) page.run();
  return page;
}

function assertStatic(group) {
  assert.equal(group.values.has('modes-enhanced'), false);
  for (const { panel } of group.entries) {
    assert.equal(panel.hidden, false);
    assert.equal(panel.inert, false);
    assert.notEqual(panel.getAttribute('aria-hidden'), 'true');
  }
}

function assertMode(group, mode) {
  assert.equal(group.values.has('modes-enhanced'), true);
  for (const entry of group.entries) {
    const current = entry.mode === mode;
    assert.equal(entry.panel.hidden, !current);
    assert.equal(entry.panel.values.has('is-current'), current);
    assert.equal(entry.button.values.has('is-current'), current);
    assert.equal(entry.button.getAttribute('aria-pressed'), String(current));
    assert.equal(entry.button.getAttribute('aria-controls'), entry.panel.getAttribute('id'));
    assert.notEqual(entry.button.getAttribute('aria-hidden'), 'true');
  }
  assert.equal(group.status.textContent, `${mode === 'personal' ? 'Personal' : 'Company'} preview — sample records, not a live account.`);
  assert.equal(group.status.getAttribute('role'), 'status');
  assert.equal(group.status.getAttribute('aria-live'), 'polite');
  assert.notEqual(group.status.getAttribute('aria-hidden'), 'true');
}

test('without JavaScript both sample panels and the native disclosures are readable', () => {
  const page = fixture({ run: false });
  assertStatic(page.groups[0]);
  assert.equal(page.groups[0].personal.button.getAttribute('aria-pressed'), 'true');
  assert.equal(page.groups[0].company.button.getAttribute('aria-pressed'), 'false');
  assert.equal(page.registrations.length, 0);
  assert.equal(page.layouts.length, 0);
  assert.equal(page.faqs[0].open, true);
});

test('a complete group initializes Personal only after both native click handlers are bound', () => {
  const page = fixture();
  const group = page.groups[0];
  assertMode(group, 'personal');
  const listeners = page.registrations.filter(entry => entry.name.startsWith('button-'));
  assert.equal(listeners.length, 2);
  assert.ok(listeners.every(entry => entry.type === 'click' && entry.settings.passive));
  const lastBind = Math.max(...listeners.map(entry => page.writes.findIndex(write =>
    write[0] === entry.name && write[1] === 'listen' && write[2] === 'click')));
  const firstPanelWrite = page.writes.findIndex(write => write[1] === 'hidden');
  assert.ok(firstPanelWrite > lastBind, 'both listeners succeed before changing any panel visibility');
  assert.equal(page.layouts.length, 1);
  assert.equal(page.layouts[0][0].enhanced, true);
  assert.deepEqual(page.layouts[0][0].entries.map(entry => entry.hidden), [false, true]);
  assert.deepEqual(page.layouts[0][0].entries.map(entry => entry.pressed), ['true', 'false']);
  assert.equal(page.layouts[0][0].status, group.status.textContent, 'the event sees the completed state');
  assert.equal(page.document.activeElement, null);
  assert.ok(group.entries.every(({ button, panel }) => button.focusCalls.length === 0 && panel.focusCalls.length === 0));
});

test('Personal and Company switches update panels, pressed state and sample status without moving focus', () => {
  const page = fixture();
  const group = page.groups[0];
  for (const mode of ['company', 'personal', 'company']) {
    const button = group[mode].button;
    page.document.activeElement = button;
    const event = button.dispatch('click', { detail: 0 });
    assertMode(group, mode);
    assert.equal(page.document.activeElement, button, 'keyboard focus stays on the activated native button');
    assert.equal(event.preventions, 0);
    assert.equal(button.focusCalls.length, 0);
    const snapshot = page.layouts.at(-1)[0];
    assert.equal(snapshot.status, group.status.textContent);
    assert.equal(snapshot.entries.find(entry => entry.mode === mode).hidden, false);
    assert.equal(snapshot.entries.find(entry => entry.mode !== mode).hidden, true);
  }
  assert.equal(page.layouts.length, 4);
});

test('activating the current mode does not repeat a live announcement or layout notification', () => {
  const page = fixture();
  const group = page.groups[0];
  const writes = page.writes.length;
  const events = page.layouts.length;
  page.document.activeElement = group.personal.button;
  group.personal.button.dispatch('click');
  assertMode(group, 'personal');
  assert.equal(page.writes.length, writes);
  assert.equal(page.layouts.length, events);
  assert.equal(page.document.activeElement, group.personal.button);
});

test('modified, non-primary and already-prevented clicks retain their native behavior', () => {
  const page = fixture();
  const group = page.groups[0];
  for (const detail of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true },
    { button: 1 }, { button: 2 }, { defaultPrevented: true }]) {
    const event = group.company.button.dispatch('click', detail);
    assertMode(group, 'personal');
    assert.equal(event.preventions, 0);
  }
  assert.equal(page.layouts.length, 1);
});

test('incomplete, malformed or inaccessible groups never hide either preview', async t => {
  const cases = [
    ['missing Company button', group => group.multiples.set('[data-mode-button]', [group.personal.button])],
    ['missing Company panel', group => group.multiples.set('[data-mode-panel]', [group.personal.panel])],
    ['missing status', group => group.multiples.set('[data-mode-status]', [])],
    ['duplicate status', group => group.multiples.set('[data-mode-status]', [group.status, group.status])],
    ['extra button', group => group.multiples.get('[data-mode-button]').push(group.personal.button)],
    ['extra panel', group => group.multiples.get('[data-mode-panel]').push(group.company.panel)],
    ['duplicate mode buttons', group => group.company.button.setAttribute('data-mode-button', 'personal')],
    ['duplicate mode panels', group => group.company.panel.setAttribute('data-mode-panel', 'personal')],
    ['whitespace mode', group => group.company.button.setAttribute('data-mode-button', ' company')],
    ['unknown mode', group => group.company.panel.setAttribute('data-mode-panel', 'business')],
    ['empty mode', group => group.company.button.setAttribute('data-mode-button', '')],
    ['corrupted mode value', group => group.company.button.attrs.set('data-mode-button', { value: 'company' })],
    ['a link is not a toggle button', group => { group.company.button.tagName = 'A'; }],
    ['a submit button is not a preview toggle', group => group.company.button.setAttribute('type', 'submit')],
    ['disabled Company button', group => { group.company.button.disabled = true; }],
    ['missing pressed state', group => group.company.button.removeAttribute('aria-pressed')],
    ['invalid pressed state', group => group.company.button.setAttribute('aria-pressed', 'mixed')],
    ['unmatched controls ID', group => group.company.button.setAttribute('aria-controls', 'missing-panel')],
    ['controls cannot list unrelated panels', group => group.company.button.setAttribute('aria-controls', 'mode-company-0 mode-personal-0')],
    ['duplicate IDs', group => {
      group.company.panel.setAttribute('id', 'mode-personal-0');
      group.company.button.setAttribute('aria-controls', 'mode-personal-0');
    }],
    ['a non-live status', group => group.status.removeAttribute('aria-live')],
    ['a hidden status', group => group.status.setAttribute('aria-hidden', 'true')],
  ];
  for (const [name, modify] of cases) await t.test(name, () => {
    const page = fixture({ before: page => modify(page.groups[0]) });
    const group = page.groups[0];
    assertStatic(group);
    assert.ok(group.entries.every(({ button }) => !(button.handlers.get('click') || []).length));
    assert.equal(page.layouts.length, 0);
    assert.equal(group.status.textContent, 'Both previews use sample records, not live accounts.');
  });
});

test('missing class, hidden, attribute or click APIs leave the static document usable', async t => {
  const cases = [
    ['group classList', group => { delete group.classList; }],
    ['button classList', group => { delete group.company.button.classList; }],
    ['panel classList', group => { delete group.company.panel.classList; }],
    ['Company event API', group => { delete group.company.button.addEventListener; }],
    ['Company attribute writer', group => { delete group.company.button.setAttribute; }],
    ['panel attribute reader', group => { delete group.company.panel.getAttribute; }],
    ['panel hidden property', group => { delete group.company.panel.hidden; }],
    ['scoped selector API', group => { delete group.querySelectorAll; }],
  ];
  for (const [name, modify] of cases) await t.test(name, () => {
    const page = fixture({ before: page => modify(page.groups[0]) });
    const group = page.groups[0];
    assert.equal(group.values.has('modes-enhanced'), false);
    assert.ok(group.entries.every(({ panel }) => !panel.attrs.has('hidden')));
    assert.ok(group.entries.every(({ button }) => !(button.handlers.get('click') || []).length));
    assert.equal(page.layouts.length, 0);
  });
});

test('throwing setup rolls back partially attached listeners and partially hidden panels', async t => {
  const cases = [
    ['attribute read', ['read:button-company-0:data-mode-button']],
    ['scoped selector', ['query:group-0:[data-mode-panel]']],
    ['first listener', ['listen:button-personal-0:click']],
    ['second listener', ['listen:button-company-0:click']],
    ['listener attaches before throwing', ['listen-after:button-company-0:click']],
    ['failed listener removal', ['listen-after:button-company-0:click', 'unlisten:button-personal-0:click', 'unlisten:button-company-0:click']],
    ['hidden property', ['hidden:panel-company-0:true']],
    ['live status writer after hiding', ['text:status-0']],
    ['enhancement class after hiding', ['class-after:group-0:modes-enhanced:true']],
    ['throwing class removal uses attributes', ['class-after:group-0:modes-enhanced:true', 'class:group-0:modes-enhanced:false']],
  ];
  for (const [name, failures] of cases) await t.test(name, () => {
    const page = fixture({ failures });
    const group = page.groups[0];
    assertStatic(group);
    for (const { button } of group.entries) button.dispatch('click');
    assertStatic(group);
    assert.equal(group.personal.button.getAttribute('aria-pressed'), 'true');
    assert.equal(group.company.button.getAttribute('aria-pressed'), 'false');
    assert.equal(page.localCalls.length, 0);
    for (const layout of page.layouts) assert.equal(layout[0].enhanced, false, 'only the restored layout is announced');
  });
});

test('attributes or APIs corrupted after enhancement restore every panel and leave stale handlers inert', async t => {
  const cases = [
    ['button mode', group => group.company.button.setAttribute('data-mode-button', 'company ')],
    ['panel mode', group => group.company.panel.setAttribute('data-mode-panel', 'other')],
    ['controls', group => group.company.button.setAttribute('aria-controls', 'missing')],
    ['panel ID', group => group.company.panel.setAttribute('id', 'renamed')],
    ['pressed state', group => group.company.button.setAttribute('aria-pressed', 'mixed')],
    ['button tag', group => { group.company.button.tagName = 'DIV'; }],
    ['a newly duplicated panel', group => group.multiples.get('[data-mode-panel]').push(group.personal.panel)],
    ['an unavailable scoped lookup', group => Object.defineProperty(group, 'querySelectorAll', {
      get() { throw new Error('DOM lookup became unavailable'); },
    })],
  ];
  for (const [name, corrupt] of cases) await t.test(name, () => {
    const page = fixture();
    const group = page.groups[0];
    const staleHandler = group.company.button.handlers.get('click')[0].callback;
    corrupt(group);
    page.document.activeElement = group.company.button;
    group.company.button.dispatch('click');
    assertStatic(group);
    assert.equal(page.document.activeElement, group.company.button);
    assert.equal(group.status.textContent, 'Both previews use sample records, not live accounts.');
    staleHandler({ detail: 0 });
    assertStatic(group);
    assert.equal(page.layouts.length, 2);
    assert.deepEqual(page.layouts.at(-1)[0].entries.map(entry => entry.hidden), [false, false]);
  });
});

test('a failure during a later switch restores the whole pair rather than leaving both hidden', async t => {
  const cases = [
    ['attribute writer', 'attribute:button-company-0:aria-pressed:true'],
    ['showing the next panel', 'hidden:panel-company-0:false'],
    ['current class', 'class:panel-company-0:is-current:true'],
    ['status writer', 'text:status-0'],
  ];
  for (const [name, failure] of cases) await t.test(name, () => {
    const page = fixture();
    const group = page.groups[0];
    assertMode(group, 'personal');
    page.failures.add(failure);
    group.company.button.dispatch('click');
    assertStatic(group);
    group.personal.button.dispatch('click');
    assertStatic(group);
    assert.equal(page.layouts.at(-1)[0].enhanced, false);
    assert.deepEqual(page.layouts.at(-1)[0].entries.map(entry => entry.hidden), [false, false]);
  });
});

test('separate and nested groups keep their own controls, panels and announcements', () => {
  const page = fixture({ groupCount: 3, before: page => {
    const [outer, inner, invalid] = page.groups;
    for (const selector of ['[data-mode-button]', '[data-mode-panel]', '[data-mode-status]']) {
      outer.multiples.set(selector, outer.multiples.get(selector).concat(inner.multiples.get(selector)));
    }
    invalid.company.button.setAttribute('aria-controls', 'missing');
  } });
  const [outer, inner, invalid] = page.groups;
  assertMode(outer, 'personal');
  assertMode(inner, 'personal');
  assertStatic(invalid);
  inner.company.button.dispatch('click');
  assertMode(inner, 'company');
  assertMode(outer, 'personal');
  assertStatic(invalid);
  outer.company.button.dispatch('click');
  assertMode(outer, 'company');
  assertMode(inner, 'company');
});

test('duplicate document IDs do not bind a second group to the first group’s panels', () => {
  const page = fixture({ groupCount: 2, before: page => {
    for (const entry of page.groups[1].entries) {
      entry.panel.setAttribute('id', `mode-${entry.mode}-0`);
      entry.button.setAttribute('aria-controls', `mode-${entry.mode}-0`);
    }
  } });
  assertMode(page.groups[0], 'personal');
  assertStatic(page.groups[1]);
  assert.ok(page.groups[1].entries.every(({ button }) => !(button.handlers.get('click') || []).length));
});

test('optional custom-event APIs can be absent or throwing without breaking local mode clicks', async t => {
  const cases = [
    ['no Event constructor', page => { delete page.window.Event; }],
    ['no event dispatch', page => { delete page.window.dispatchEvent; }],
    ['throwing Event constructor', page => page.failures.add('Event')],
    ['throwing dispatch', page => page.failures.add('dispatchEvent')],
  ];
  for (const [name, before] of cases) await t.test(name, () => {
    const page = fixture({ before });
    const group = page.groups[0];
    assertMode(group, 'personal');
    group.company.button.dispatch('click');
    assertMode(group, 'company');
    page.faqs[0].dispatch('toggle');
    assert.equal(page.layouts.length, 0);
  });
});

test('toggle-only class lists and an absent ID lookup still support the complete pair', () => {
  const page = fixture({ before: page => {
    delete page.document.getElementById;
    for (const node of page.nodes) {
      delete node.classList.add;
      delete node.classList.remove;
      delete node.classList.contains;
    }
  } });
  assertMode(page.groups[0], 'personal');
  page.groups[0].company.button.dispatch('click');
  assertMode(page.groups[0], 'company');
});

test('native details toggles announce layout changes without creating a FAQ accordion', () => {
  const states = [];
  const page = fixture({ before: page => page.window.addEventListener('expenzo:layout', () => {
    states.push({ menu: page.menu.open, faqs: page.faqs.map(details => details.open) });
  }) });
  page.faqs[1].open = true;
  page.faqs[1].dispatch('toggle');
  assert.deepEqual(page.faqs.map(details => details.open), [true, true]);
  assert.deepEqual(states.at(-1).faqs, [true, true], 'notification follows the native open state');
  page.faqs[0].open = false;
  page.faqs[0].dispatch('toggle');
  assert.deepEqual(page.faqs.map(details => details.open), [false, true]);
  page.menu.open = true;
  page.menu.dispatch('toggle');
  assert.equal(states.at(-1).menu, true);
  assert.equal(page.layouts.length, 4);
  for (const details of page.faqs) {
    assert.equal((details.handlers.get('click') || []).length, 0);
    assert.equal((details.handlers.get('keydown') || []).length, 0);
    assert.equal(details.handlers.get('toggle').length, 1);
  }
});

test('normal internal-anchor navigation closes the native mobile menu without intercepting the link', () => {
  const page = fixture({ menuOpen: true });
  const link = page.links[0];
  page.document.activeElement = link;
  const event = link.dispatch('click', { detail: 0 });
  assert.equal(page.menu.open, false);
  assert.equal(event.preventions, 0);
  assert.equal(link.getAttribute('href'), '#feature-tour');
  assert.equal(page.document.activeElement, link);
  assert.equal(link.focusCalls.length, 0);
  page.menu.dispatch('toggle');
  assert.equal(page.layouts.length, 2, 'native toggle invalidates layout through the shared notification');
  assert.deepEqual(page.faqs.map(details => details.open), [true, false]);
});

test('modified, prevented, external, download and new-tab links do not close the mobile menu', () => {
  const page = fixture({ menuOpen: true });
  for (const detail of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
    { button: 1 }, { defaultPrevented: true }]) {
    const event = page.links[0].dispatch('click', detail);
    assert.equal(page.menu.open, true);
    assert.equal(event.preventions, 0);
  }
  for (const link of page.links.slice(2)) {
    const event = link.dispatch('click');
    assert.equal(page.menu.open, true, `native destination stays intact: ${link.getAttribute('href')}`);
    assert.equal(event.preventions, 0);
  }
  assert.equal(page.layouts.length, 1);
});

test('changed or malformed menu link attributes are checked again at activation', () => {
  const page = fixture({ menuOpen: true });
  const link = page.links[0];
  for (const href of ['', '#', './privacy.html', { value: '#feature-tour' }]) {
    link.attrs.set('href', href);
    const event = link.dispatch('click');
    assert.equal(page.menu.open, true);
    assert.equal(event.preventions, 0);
  }
  link.setAttribute('href', '#product');
  link.setAttribute('target', '_self');
  link.dispatch('click');
  assert.equal(page.menu.open, false);
});

test('Escape is scoped to an open mobile menu and returns focus to its native summary', () => {
  const page = fixture({ menuOpen: true });
  const ordinaryKey = page.menu.dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(page.menu.open, true);
  assert.equal(ordinaryKey.preventions, 0);
  page.menu.dispatch('keydown', { key: 'Escape', defaultPrevented: true });
  assert.equal(page.menu.open, true);
  const event = page.menu.dispatch('keydown', { key: 'Escape' });
  assert.equal(page.menu.open, false);
  assert.equal(event.preventions, 0);
  assert.equal(page.document.activeElement, page.summary);
  assert.equal(page.summary.focusCalls.length, 1);
  assert.equal(page.summary.focusCalls[0].preventScroll, true);
  page.menu.dispatch('keydown', { key: 'Escape' });
  assert.equal(page.summary.focusCalls.length, 1, 'a closed menu does not take focus');
  assert.deepEqual(page.faqs.map(details => details.open), [true, false]);
  const keyboard = page.registrations.filter(entry => entry.type === 'keydown');
  assert.equal(keyboard.length, 1);
  assert.equal(keyboard[0].name, 'menu');
  assert.equal(keyboard[0].settings.passive, true);
});

test('missing details event APIs leave native disclosures usable and independent of mode enhancement', () => {
  const page = fixture({ failures: ['listen:menu:toggle', 'listen:menu:keydown', 'listen:faq-0:toggle'] });
  assertMode(page.groups[0], 'personal');
  page.groups[0].company.button.dispatch('click');
  assertMode(page.groups[0], 'company');
  assert.deepEqual(page.faqs.map(details => details.open), [true, false]);
});

test('all interaction stays local and introduces no document/window scroll, pointer or keyboard listeners', () => {
  const page = fixture({ menuOpen: true });
  page.groups[0].company.button.dispatch('click');
  page.faqs[1].open = true;
  page.faqs[1].dispatch('toggle');
  page.menu.dispatch('keydown', { key: 'Escape' });
  assert.equal(page.localCalls.length, 0, 'no requests, storage, cookies, timers, observers or extra frames');
  assert.ok(!page.registrations.some(entry => entry.name === 'window' || entry.name === 'document'));
  assert.ok(!page.registrations.some(entry => /^(scroll|resize|wheel|mousewheel|touchstart|touchmove|pointermove|mousemove)$/.test(entry.type)));
  for (const type of ['scroll', 'wheel', 'touchmove', 'keydown', 'pointermove']) {
    const event = page.window.dispatch(type, { key: 'ArrowDown' });
    assert.equal(event.preventions, 0);
  }
});

test('empty pages and absent DOM globals need no assumed APIs or event work', () => {
  const page = fixture({ groupCount: 0, noDetails: true, before: page => {
    delete page.window.Event;
    delete page.window.dispatchEvent;
  } });
  assert.equal(page.registrations.length, 0);
  assert.equal(page.layouts.length, 0);
  assert.equal(page.localCalls.length, 0);
  for (const globals of [{}, { window: {} }, { document: {} }, { window: {}, document: {} }]) {
    assert.doesNotThrow(() => vm.runInNewContext(source, globals, { timeout: 1000 }));
  }
});

function htmlAttributes(markup) {
  return new Map([...markup.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
    .map(([, name, double, single, bare]) => [name.toLowerCase(), double ?? single ?? bare ?? '']));
}

test('the shipped mode lab keeps both panels readable before JS, with correctly linked accessible controls', () => {
  const html = fs.readFileSync(path.join(website, 'index.html'), 'utf8');
  const match = html.match(/<section\b([^>]*\bdata-mode-lab\b[^>]*)>([\s\S]*?)<\/section>/);
  assert.ok(match, 'the mode lab is in the static page');
  const section = htmlAttributes(match[1]);
  assert.equal(section.get('id'), 'mode-lab');
  assert.doesNotMatch(section.get('class') || '', /\bmodes-enhanced\b/);
  assert.equal(section.has('hidden'), false);
  assert.notEqual(section.get('aria-hidden'), 'true');
  const buttons = [...match[2].matchAll(/<button\b([^>]*\bdata-mode-button\b[^>]*)>([\s\S]*?)<\/button>/g)];
  const panels = [...match[2].matchAll(/<[a-z][\w-]*\b([^>]*\bdata-mode-panel\b[^>]*)>/g)]
    .map(([, attributes]) => htmlAttributes(attributes));
  assert.equal(buttons.length, 2);
  assert.equal(panels.length, 2);
  for (const mode of ['personal', 'company']) {
    const button = buttons.find(([_, attributes]) => htmlAttributes(attributes).get('data-mode-button') === mode);
    const panel = panels.find(attributes => attributes.get('data-mode-panel') === mode);
    assert.ok(button && panel, `complete ${mode} preview`);
    const attributes = htmlAttributes(button[1]);
    assert.equal(attributes.get('type'), 'button');
    assert.equal(attributes.get('aria-controls'), panel.get('id'));
    assert.equal(attributes.get('aria-pressed'), String(mode === 'personal'));
    assert.equal(attributes.has('hidden'), false);
    assert.notEqual(attributes.get('aria-hidden'), 'true');
    assert.equal(panel.has('hidden'), false);
    assert.notEqual(panel.get('aria-hidden'), 'true');
    const label = button[2].replace(/<svg\b[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim();
    assert.ok(label, 'each native control has a visible text label');
    const occurrences = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].filter(([, id]) => id === panel.get('id'));
    assert.equal(occurrences.length, 1, 'aria-controls references one actual panel');
  }
  const statuses = [...match[2].matchAll(/<[a-z][\w-]*\b([^>]*\bdata-mode-status\b[^>]*)>/g)];
  assert.equal(statuses.length, 1);
  const status = htmlAttributes(statuses[0][1]);
  assert.equal(status.get('role'), 'status');
  assert.equal(status.get('aria-live'), 'polite');
  assert.equal(status.has('hidden'), false);
  assert.notEqual(status.get('aria-hidden'), 'true');
  assert.match(html, /<details\b[^>]*\bclass=["'][^"']*\bmobile-menu\b[^"']*["']/);

  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map(([, attributes]) => htmlAttributes(attributes));
  const experience = scripts.findIndex(attributes => (attributes.get('src') || '').split('?')[0] === './experience.js');
  const motion = scripts.findIndex(attributes => (attributes.get('src') || '').split('?')[0] === './script.js');
  assert.ok(experience >= 0 && motion > experience, 'experience initializes panel visibility before motion measures layout');
  assert.equal(scripts[experience].has('async'), false);
  assert.equal(scripts[motion].has('async'), false);
});

test('the shipped CSS shows mode controls only after enhancement and keeps static panels in flow', () => {
  const css = fs.readFileSync(path.join(website, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  let hiddenSwitch = false;
  let enhancedSwitch = false;
  for (const [, selectors, declarations] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const selector of selectors.split(',')) {
      const target = selector.trim().split(/\s+/).at(-1);
      if (target === '.mode-switch') {
        if (/\.modes-enhanced\b/.test(selector)) {
          enhancedSwitch ||= /display\s*:\s*(?:inline-flex|flex|grid|block)\b/.test(declarations);
        } else {
          hiddenSwitch ||= /display\s*:\s*none\b/.test(declarations);
        }
      }
      if (/\.modes-enhanced\b|\[hidden\]/.test(selector)) continue;
      if (/^\.(?:mode-panel|personal-panel|company-panel)\b|^\[data-mode-panel\]/.test(target)) {
        assert.doesNotMatch(declarations, /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?\s*(?:!important\s*)?[;}]/i,
          `static panels stay readable: ${selector.trim()}`);
        assert.doesNotMatch(declarations, /position\s*:\s*(?:absolute|fixed)\b/i, 'static previews remain in normal flow');
      }
    }
  }
  assert.ok(hiddenSwitch, 'unbound mode controls are hidden before enhancement');
  assert.ok(enhancedSwitch, 'bound mode controls become available');
});
