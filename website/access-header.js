(() => {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const marker = 'data-access-header-controller';
  const root = document.documentElement;
  if (!root || typeof root.getAttribute !== 'function' || typeof root.setAttribute !== 'function' ||
      typeof document.querySelector !== 'function') return;
  if (root.getAttribute(marker)) return;
  root.setAttribute(marker, 'pending');

  function initialize() {
    if (typeof document.removeEventListener === 'function') {
      document.removeEventListener('DOMContentLoaded', initialize);
    }
    root.setAttribute(marker, 'ready');

    const proxy = document.querySelector('[data-access-header]');
    if (!proxy || typeof proxy.setAttribute !== 'function' || typeof proxy.removeAttribute !== 'function') return;
    const hero = document.querySelector('[data-access-hero]');
    const header = document.querySelector('[data-header]');
    const heroSection = document.querySelector('[data-hero]');
    const passive = { passive: true };
    const capturePassive = { capture: true, passive: true };
    const capture = { capture: true };
    const removers = [];
    let visible = false;
    let active = false;
    let generation = 0;
    let frame = null;
    let observer = null;
    let schedulerReady = typeof window.requestAnimationFrame === 'function' &&
      typeof window.cancelAnimationFrame === 'function';

    function setAttribute(name, value) {
      if (typeof proxy.getAttribute !== 'function' || proxy.getAttribute(name) !== value) {
        proxy.setAttribute(name, value);
      }
    }

    function removeAttribute(name) {
      if (typeof proxy.getAttribute !== 'function' || proxy.getAttribute(name) !== null) {
        proxy.removeAttribute(name);
      }
    }

    function setVisibleClass(enabled) {
      const list = proxy.classList;
      if (!list) return;
      if (typeof list.contains === 'function' && list.contains('is-visible') === enabled) return;
      const method = enabled ? 'add' : 'remove';
      if (typeof list[method] === 'function') list[method]('is-visible');
      else if (typeof list.toggle === 'function') list.toggle('is-visible', enabled);
    }

    function rectFor(element) {
      if (!element || element.isConnected === false || typeof element.getBoundingClientRect !== 'function') return null;
      try {
        if (typeof element.getClientRects === 'function' && !element.getClientRects().length) return null;
        const rect = element.getBoundingClientRect();
        if (!rect || !Number.isFinite(rect.top) || !Number.isFinite(rect.bottom) || rect.bottom <= rect.top) return null;
        if (typeof rect.width === 'number' && (!Number.isFinite(rect.width) || rect.width <= 0)) return null;
        return rect;
      } catch (_) {
        return null;
      }
    }

    function geometry() {
      const heroRect = rectFor(hero);
      const headerRect = rectFor(header);
      return heroRect && headerRect ? { hero: heroRect, header: headerRect } : null;
    }

    function ownsFocus() {
      const focused = document.activeElement;
      return focused === proxy || !!(focused && typeof proxy.contains === 'function' && proxy.contains(focused));
    }

    function transferFocus(measured) {
      if (!ownsFocus()) return;
      if (measured && measured.hero.bottom > measured.header.bottom && hero && typeof hero.focus === 'function') {
        try { hero.focus({ preventScroll: true }); } catch (_) { /* Never fall back to a scrolling focus call. */ }
      }
      if (ownsFocus() && typeof proxy.blur === 'function') proxy.blur();
    }

    function render(next, measured) {
      visible = next;
      if (next) {
        removeAttribute('aria-hidden');
        removeAttribute('tabindex');
        removeAttribute('inert');
        setAttribute('data-handoff-state', 'header');
        setVisibleClass(true);
      } else {
        transferFocus(measured);
        setVisibleClass(false);
        setAttribute('data-handoff-state', 'hero');
        setAttribute('aria-hidden', 'true');
        setAttribute('tabindex', '-1');
        setAttribute('inert', '');
      }
    }

    function update() {
      if (!active) return;
      const measured = geometry();
      const list = proxy.classList;
      const canReveal = !!(proxy.isConnected !== false && list && ((typeof list.add === 'function' && typeof list.remove === 'function') ||
        typeof list.toggle === 'function'));
      // Compare the actual button, not the hero section or an estimated scroll offset.
      render(!!(canReveal && measured && measured.hero.bottom <= measured.header.bottom), measured);
    }

    function cancelFrame() {
      const pending = frame;
      frame = null;
      if (!pending || pending.id === null) return;
      try { window.cancelAnimationFrame(pending.id); } catch (_) { schedulerReady = false; }
    }

    function schedule() {
      if (!active || frame !== null) return;
      if (!schedulerReady) { update(); return; }
      const pending = { id: null, generation };
      frame = pending;
      try {
        pending.id = window.requestAnimationFrame(() => {
          if (!active || frame !== pending || pending.generation !== generation) return;
          frame = null;
          update();
        });
      } catch (_) {
        if (frame === pending) frame = null;
        schedulerReady = false;
        update();
      }
    }

    function listen(target, event, handler, options) {
      if (!target || typeof target.addEventListener !== 'function' || typeof target.removeEventListener !== 'function') return;
      try {
        target.addEventListener(event, handler, options);
        removers.push(() => target.removeEventListener(event, handler, options));
      } catch (_) { /* Optional event sources may be absent. */ }
    }

    function preventHiddenActivation(event) {
      // A native/synthetic click can arrive before the pending scroll frame.
      if (active && visible) update();
      if (active && visible) return;
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (event && typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      else if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    }

    function guardKey(event) {
      if (event && (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar')) {
        preventHiddenActivation(event);
      }
    }

    function guardFocus() {
      if (active && visible) update();
      if (!active || !visible) transferFocus(geometry());
    }

    function visibilityChanged() {
      if (!document.hidden) schedule();
    }

    function layoutTransitionEnded(event) {
      const target = event && event.target;
      if (target === hero || target === header || (target && typeof target.contains === 'function' &&
          ((hero && target.contains(hero)) || (header && target.contains(header))))) schedule();
    }

    function disconnectObserver() {
      const previous = observer;
      observer = null;
      if (previous) {
        try { previous.disconnect(); } catch (_) { /* Generation checks also reject queued callbacks. */ }
      }
    }

    function suspend() {
      active = false;
      generation += 1;
      cancelFrame();
      disconnectObserver();
      removers.splice(0).forEach(remove => {
        try { remove(); } catch (_) { /* A detached optional event source is harmless. */ }
      });
    }

    function resume() {
      if (active) {
        cancelFrame();
        update();
        schedule();
        return;
      }
      active = true;
      const currentGeneration = ++generation;
      listen(window, 'pagehide', suspend, passive);
      listen(window, 'scroll', schedule, passive);
      listen(window, 'resize', schedule, passive);
      listen(window, 'hashchange', schedule, passive);
      listen(window, 'load', schedule, passive);
      listen(window.visualViewport, 'resize', schedule, passive);
      listen(window.visualViewport, 'scroll', schedule, passive);
      listen(document, 'visibilitychange', visibilityChanged, passive);
      listen(document, 'load', schedule, capturePassive);
      listen(document, 'transitionend', layoutTransitionEnded, capturePassive);
      listen(document, 'animationend', layoutTransitionEnded, capturePassive);
      listen(proxy, 'click', preventHiddenActivation, capture);
      listen(proxy, 'auxclick', preventHiddenActivation, capture);
      listen(proxy, 'keydown', guardKey, capture);
      listen(proxy, 'focus', guardFocus, capturePassive);

      if (typeof window.ResizeObserver === 'function') {
        try {
          const current = new window.ResizeObserver(() => {
            if (active && generation === currentGeneration && observer === current) schedule();
          });
          observer = current;
          [header, hero, heroSection].forEach((element, index, targets) => {
            if (element && targets.indexOf(element) === index) current.observe(element);
          });
        } catch (_) { disconnectObserver(); }
      }

      const fonts = document.fonts;
      listen(fonts, 'loadingdone', schedule, passive);
      listen(fonts, 'loadingerror', schedule, passive);
      if (fonts && fonts.ready && typeof fonts.ready.then === 'function') {
        const fontsSettled = () => {
          if (active && generation === currentGeneration) schedule();
        };
        fonts.ready.then(fontsSettled, fontsSettled);
      }

      update();
      schedule();
    }

    render(false, null);
    if (typeof window.addEventListener !== 'function' || typeof window.removeEventListener !== 'function') return;
    // Only this wake-up listener survives pagehide; resume reinstalls everything else once.
    window.addEventListener('pageshow', resume, passive);
    resume();
  }

  if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true, passive: true });
  } else {
    initialize();
  }
})();
