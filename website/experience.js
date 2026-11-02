(() => {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function selectAll(scope, selector) {
    try {
      return scope && typeof scope.querySelectorAll === 'function'
        ? Array.from(scope.querySelectorAll(selector) || []) : [];
    } catch (_) { return []; }
  }

  function ownedAll(group, selector) {
    return selectAll(group, selector).filter(node => {
      try {
        return node && typeof node.closest === 'function' ? node.closest('[data-mode-lab]') === group : !!node;
      } catch (_) { return false; }
    });
  }

  const attribute = (node, name) => node && typeof node.getAttribute === 'function'
    ? node.getAttribute(name) : null;
  const canClass = node => !!(node && node.classList &&
    ((typeof node.classList.add === 'function' && typeof node.classList.remove === 'function') ||
      typeof node.classList.toggle === 'function'));

  function setClass(node, name, enabled) {
    const list = node.classList;
    if (typeof list.contains === 'function' && list.contains(name) === enabled) return;
    const method = enabled ? 'add' : 'remove';
    if (typeof list[method] === 'function') list[method](name);
    else list.toggle(name, enabled);
  }

  function clearClass(node, name) {
    try { setClass(node, name, false); return; } catch (_) { /* Try the attribute fallback. */ }
    try {
      if (typeof node.setAttribute === 'function') {
        node.setAttribute('class', (attribute(node, 'class') || '').split(/\s+/)
          .filter(value => value && value !== name).join(' '));
      }
    } catch (_) { /* Other groups and native controls remain independent. */ }
  }

  function notifyLayout() {
    // Minimal/older environments can still use the previews without custom events.
    try {
      if (typeof window.Event === 'function' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new window.Event('expenzo:layout'));
      }
    } catch (_) { /* Best-effort notification. */ }
  }

  function normalActivation(event) {
    return !event || !(event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey ||
      (typeof event.button === 'number' && event.button !== 0));
  }

  function readPair(group) {
    try {
      if (!canClass(group)) return null;
      const buttons = ownedAll(group, '[data-mode-button]');
      const panels = ownedAll(group, '[data-mode-panel]');
      const statuses = ownedAll(group, '[data-mode-status]');
      if (buttons.length !== 2 || panels.length !== 2 || statuses.length !== 1) return null;
      const status = statuses[0];
      if (attribute(status, 'role') !== 'status' || attribute(status, 'aria-live') !== 'polite' ||
        attribute(status, 'aria-hidden') === 'true' || typeof status.textContent !== 'string') return null;
      const entries = ['personal', 'company'].map(mode => {
        const button = buttons.find(node => attribute(node, 'data-mode-button') === mode);
        const panel = panels.find(node => attribute(node, 'data-mode-panel') === mode);
        const id = attribute(panel, 'id');
        if (!button || !panel || String(button.tagName || '').toLowerCase() !== 'button' ||
          typeof button.addEventListener !== 'function' || typeof button.setAttribute !== 'function' ||
          !canClass(button) || !canClass(panel) || typeof panel.hidden !== 'boolean' || button.hidden === true ||
          button.disabled === true || attribute(button, 'disabled') !== null || attribute(button, 'aria-disabled') === 'true' ||
          attribute(button, 'aria-hidden') === 'true' || attribute(panel, 'aria-hidden') === 'true' ||
          !['true', 'false'].includes(attribute(button, 'aria-pressed')) ||
          typeof id !== 'string' || !id || /\s/.test(id) || attribute(button, 'aria-controls') !== id) return null;
        const type = attribute(button, 'type');
        if (type !== null && type.toLowerCase() !== 'button') return null;
        if (type === null && button.form) return null;
        if (typeof document.getElementById === 'function' && document.getElementById(id) !== panel) return null;
        return { mode, button, panel };
      });
      if (entries.some(entry => !entry) || entries[0].panel === entries[1].panel ||
        attribute(entries[0].panel, 'id') === attribute(entries[1].panel, 'id') ||
        new Set(buttons.concat(panels, status)).size !== 5) return null;
      return { entries, status };
    } catch (_) {
      return null;
    }
  }

  function enhanceModes(group) {
    const pair = readPair(group);
    if (!pair) return;
    const { entries, status } = pair;
    const attached = [];
    let enabled = false;
    let mutated = false;
    let currentMode = null;
    let originalStatus;
    let originals;

    function restore() {
      enabled = false;
      clearClass(group, 'modes-enhanced');
      const panels = new Set(entries.map(entry => entry.panel).concat(ownedAll(group, '[data-mode-panel]')));
      panels.forEach(panel => {
        try { panel.hidden = false; } catch (_) { /* Also try the native attribute below. */ }
        try { if (typeof panel.removeAttribute === 'function') panel.removeAttribute('hidden'); } catch (_) { /* Keep restoring the pair. */ }
        clearClass(panel, 'is-current');
      });
      if (originals) originals.forEach(original => {
        try { original.button.setAttribute('aria-pressed', original.pressed); } catch (_) { /* Hidden controls cannot block the previews. */ }
        try { setClass(original.button, 'is-current', original.current); } catch (_) { clearClass(original.button, 'is-current'); }
      });
      try { if (originalStatus !== undefined) status.textContent = originalStatus; } catch (_) { /* The sample records stay readable. */ }
      attached.forEach(({ button, handler }) => {
        try { if (typeof button.removeEventListener === 'function') button.removeEventListener('click', handler); } catch (_) { /* The enabled guard also disables old handlers. */ }
      });
      currentMode = null;
      if (mutated) notifyLayout();
    }

    function apply(mode) {
      if (currentMode === mode) return;
      mutated = true;
      entries.forEach(entry => {
        const current = entry.mode === mode;
        entry.button.setAttribute('aria-pressed', String(current));
        setClass(entry.button, 'is-current', current);
        entry.panel.hidden = !current;
        setClass(entry.panel, 'is-current', current);
      });
      status.textContent = `${mode === 'personal' ? 'Personal' : 'Company'} preview — sample records, not a live account.`;
      setClass(group, 'modes-enhanced', true);
      currentMode = mode;
      // Notify only after the complete panel/ARIA update, using script.js's existing scheduler.
      notifyLayout();
    }

    try {
      originalStatus = status.textContent;
      originals = entries.map(({ button }) => ({ button, pressed: attribute(button, 'aria-pressed'),
        current: typeof button.classList.contains === 'function' && button.classList.contains('is-current') }));
      entries.forEach(entry => {
        const handler = event => {
          if (!enabled || !normalActivation(event)) return;
          try {
            const latest = readPair(group);
            if (!latest || latest.status !== status || latest.entries.some((next, index) =>
              next.button !== entries[index].button || next.panel !== entries[index].panel)) {
              restore();
              return;
            }
            apply(entry.mode);
          } catch (_) { restore(); }
        };
        // Track even an API that attaches and then throws; no panel is hidden until both binds succeed.
        attached.push({ button: entry.button, handler });
        entry.button.addEventListener('click', handler, { passive: true });
      });
      enabled = true;
      apply('personal');
    } catch (_) { restore(); }
  }

  selectAll(document, '[data-mode-lab]').forEach(enhanceModes);

  function listen(target, type, handler) {
    try {
      if (target && typeof target.addEventListener === 'function') target.addEventListener(type, handler, { passive: true });
    } catch (_) { /* Native details and links still work. */ }
  }

  selectAll(document, 'details').forEach(details => {
    if (String(details.tagName || '').toLowerCase() === 'details') listen(details, 'toggle', notifyLayout);
  });

  selectAll(document, 'details.mobile-menu').forEach(menu => {
    if (String(menu.tagName || '').toLowerCase() !== 'details' || typeof menu.open !== 'boolean') return;

    selectAll(menu, 'a[href]').forEach(link => {
      if (String(link.tagName || '').toLowerCase() !== 'a') return;
      listen(link, 'click', event => {
        if (!normalActivation(event)) return;
        try {
          const href = attribute(link, 'href');
          const target = attribute(link, 'target');
          if (typeof href !== 'string' || !href.startsWith('#') || href.length < 2 ||
            (target && target.toLowerCase() !== '_self') || attribute(link, 'download') !== null) return;
          menu.open = false;
        } catch (_) { /* Preserve native anchor navigation. */ }
      });
    });

    // Scoped to the menu: ordinary document keys and scrolling are never intercepted.
    listen(menu, 'keydown', event => {
      if (!event || event.key !== 'Escape' || event.defaultPrevented || !menu.open) return;
      try {
        menu.open = false;
        const summary = selectAll(menu, 'summary')[0];
        if (summary && typeof summary.focus === 'function') summary.focus({ preventScroll: true });
      } catch (_) { /* The native disclosure remains available. */ }
    });
  });
})();
