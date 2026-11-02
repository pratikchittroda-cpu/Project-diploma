(() => {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const select = (scope, selector) => scope && typeof scope.querySelector === 'function'
    ? scope.querySelector(selector) : null;
  const selectAll = (scope, selector) => scope && typeof scope.querySelectorAll === 'function'
    ? Array.from(scope.querySelectorAll(selector) || []) : [];
  const root = document.documentElement;
  const header = select(document, '[data-header]');
  const hero = select(document, '[data-hero]');
  const heroPhone = select(hero, '[data-hero-phone]');
  const showcase = select(document, '[data-scroll-showcase]');
  const sticky = select(showcase, '.showcase-sticky');
  const phone = select(showcase, '[data-phone]');
  const stack = select(showcase, '.screen-stack');
  const steps = selectAll(showcase, '[data-step]');
  const screens = selectAll(stack, '[data-tour-screen]');
  const stepLinks = selectAll(showcase, '[data-step-link]');
  const storyBar = select(showcase, '[data-story-progress]');
  const storyCounter = select(showcase, '[data-story-counter]');
  const documentBar = select(document, '[data-scroll-progress]');
  const reveals = selectAll(document, '[data-reveal]');

  // Legal pages can share this script without creating observers or scroll work.
  if (!header && !heroPhone && !showcase && !documentBar && !reveals.length) return;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const classValues = new Map();
  const variableValues = new Map();
  const canClass = element => !!(element && element.classList &&
    ((typeof element.classList.add === 'function' && typeof element.classList.remove === 'function') ||
      typeof element.classList.toggle === 'function'));
  const canStyle = element => !!(element && element.style && typeof element.style.setProperty === 'function');

  function setClass(element, name, enabled) {
    if (!canClass(element)) return;
    const list = element.classList;
    const values = classValues.get(element) || new Map();
    const current = typeof list.contains === 'function' ? list.contains(name) : values.get(name);
    if (current === enabled) return;
    const method = enabled ? 'add' : 'remove';
    if (typeof list[method] === 'function') list[method](name);
    else list.toggle(name, enabled);
    values.set(name, enabled);
    classValues.set(element, values);
  }

  function setVariable(element, name, value) {
    if (!canStyle(element)) return;
    const values = variableValues.get(element) || new Map();
    if (values.get(name) === value) return;
    element.style.setProperty(name, value);
    values.set(name, value);
    variableValues.set(element, values);
  }

  function clearVariables(element, names) {
    if (!canStyle(element)) return;
    const values = variableValues.get(element);
    names.forEach(name => {
      const inline = typeof element.style.getPropertyValue === 'function' && element.style.getPropertyValue(name);
      if (!(values && values.has(name)) && !inline) return;
      if (typeof element.style.removeProperty === 'function') element.style.removeProperty(name);
      else element.style.setProperty(name, '');
      if (values) values.delete(name);
    });
  }

  function setAttribute(element, name, value) {
    if (!element || typeof element.setAttribute !== 'function') return;
    if (typeof element.getAttribute === 'function' && element.getAttribute(name) === value) return;
    element.setAttribute(name, value);
  }

  function removeAttribute(element, name) {
    if (!element || typeof element.removeAttribute !== 'function') return;
    if (typeof element.getAttribute === 'function' && element.getAttribute(name) === null) return;
    element.removeAttribute(name);
  }

  const storyVariables = ['--story-progress', '--phone-rotate', '--phone-tilt', '--phone-lift',
    '--phone-scale', '--active-step', '--screen-progress'];
  const heroVariables = ['--hero-lift', '--hero-rotate', '--hero-depth'];
  const originalCounter = storyCounter ? storyCounter.textContent : '';
  const originalBarValue = storyBar && typeof storyBar.getAttribute === 'function'
    ? storyBar.getAttribute('aria-valuenow') : null;
  const progressRole = storyBar && typeof storyBar.getAttribute === 'function' &&
    storyBar.getAttribute('role') === 'progressbar';
  const completeStory = !!(showcase && sticky && phone && stack && steps.length === 4 &&
    screens.length === 4 && canStyle(showcase) && steps.every(canClass) && screens.every(canClass));
  const revealed = new Set();
  const revealTargets = new Set(reveals);
  let motionEnabled = false;
  let storyEnabled = false;
  let storyTooShort = false;
  let failed = false;
  let activeStep = -1;
  let lastStoryProgress = null;
  let observer = null;
  let observerVersion = 0;
  let heroNear = true;
  let storyNear = true;
  let frame = null;
  let frameVersion = 0;
  let geometryDirty = true;
  let geometry = { viewport: 1, documentDistance: 0, hero: null, story: null };
  let preference = null;
  let pinQuery = null;
  let mediaReady = false;
  let reduced = true;
  let schedulerReady = typeof window.requestAnimationFrame === 'function' &&
    typeof window.cancelAnimationFrame === 'function';

  function revealAll() {
    reveals.forEach(element => {
      revealed.add(element);
      setClass(element, 'is-visible', true);
    });
  }

  function staticStory() {
    setClass(root, 'story-enhanced', false);
    setClass(showcase, 'story-static', true);
    // The default layout is an ordinary document: every preview stays readable.
    steps.concat(screens).forEach(element => setClass(element, 'is-active', true));
    stepLinks.forEach(link => {
      setClass(link, 'is-active', false);
      removeAttribute(link, 'aria-current');
    });
    clearVariables(showcase, storyVariables);
    if (storyCounter && storyCounter.textContent !== originalCounter) storyCounter.textContent = originalCounter;
    if (progressRole) {
      if (originalBarValue === null) removeAttribute(storyBar, 'aria-valuenow');
      else setAttribute(storyBar, 'aria-valuenow', originalBarValue);
    }
    activeStep = -1;
    lastStoryProgress = null;
  }

  function disconnectObserver() {
    observerVersion += 1;
    const old = observer;
    observer = null;
    if (old) {
      try { old.disconnect(); } catch (_) { /* Queued callbacks are invalidated by the version. */ }
    }
  }

  function cancelFrame() {
    frameVersion += 1;
    if (frame === null) return;
    const old = frame;
    frame = null;
    try { window.cancelAnimationFrame(old); } catch (_) { schedulerReady = false; }
  }

  function staticMotion() {
    motionEnabled = false;
    storyEnabled = false;
    disconnectObserver();
    setClass(root, 'motion-enabled', false);
    staticStory();
    clearVariables(hero, heroVariables);
    clearVariables(documentBar, ['--scroll-progress']);
    revealAll();
    geometryDirty = true;
  }

  function failMotion() {
    failed = true;
    cancelFrame();
    staticMotion();
  }

  function scrollPosition() {
    return Math.max(0, finite(window.scrollY, finite(window.pageYOffset, finite(root && root.scrollTop))));
  }

  function viewport() {
    return {
      width: Math.max(0, finite(window.innerWidth, finite(root && root.clientWidth))),
      height: Math.max(1, finite(window.innerHeight, finite(root && root.clientHeight, 1))),
    };
  }

  function rectFor(element, scroll) {
    const rect = element.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.top) || !Number.isFinite(rect.height)) throw new Error('Invalid geometry');
    return { top: rect.top + scroll, height: Math.max(0, rect.height) };
  }

  function measure(scroll) {
    const view = viewport();
    try {
      const heroRect = motionEnabled && heroPhone ? rectFor(hero, scroll) : null;
      let storyRect = storyEnabled ? rectFor(showcase, scroll) : null;
      if (storyRect && storyRect.height <= view.height) {
        storyTooShort = true;
        storyEnabled = false;
        staticStory();
        storyRect = null;
      }
      const height = Math.max(finite(root && root.scrollHeight), finite(document.body && document.body.scrollHeight));
      geometry = { viewport: view.height, documentDistance: Math.max(0, height - view.height),
        hero: heroRect, story: storyRect };
      geometryDirty = false;
    } catch (_) {
      failMotion();
    }
  }

  function stepNumber(link) {
    const value = typeof link.getAttribute === 'function' ? link.getAttribute('data-step-link') : null;
    return typeof value === 'string' && /^[0-3]$/.test(value) ? Number(value) : null;
  }

  function updateStory(progress) {
    if (progress === lastStoryProgress) return;
    lastStoryProgress = progress;
    const screenProgress = progress * (screens.length - 1);
    const nextStep = clamp(Math.round(screenProgress), 0, screens.length - 1);
    const arc = Math.sin(progress * Math.PI);
    setVariable(showcase, '--story-progress', progress.toFixed(4));
    setVariable(showcase, '--phone-rotate', `${(-7 + progress * 14).toFixed(3)}deg`);
    setVariable(showcase, '--phone-tilt', `${(3 - progress * 6).toFixed(3)}deg`);
    setVariable(showcase, '--phone-lift', `${(-16 * arc).toFixed(3)}px`);
    setVariable(showcase, '--phone-scale', (1 - 0.025 * arc).toFixed(4));
    setVariable(showcase, '--screen-progress', screenProgress.toFixed(4));
    if (nextStep !== activeStep) {
      activeStep = nextStep;
      setVariable(showcase, '--active-step', String(nextStep));
      steps.forEach((step, index) => setClass(step, 'is-active', index === nextStep));
      screens.forEach((screen, index) => setClass(screen, 'is-active', index === nextStep));
      stepLinks.forEach(link => {
        const current = stepNumber(link) === nextStep;
        setClass(link, 'is-active', current);
        if (current) setAttribute(link, 'aria-current', 'step');
        else removeAttribute(link, 'aria-current');
      });
      if (storyCounter) {
        const label = `${String(nextStep + 1).padStart(2, '0')} / ${String(screens.length).padStart(2, '0')}`;
        if (storyCounter.textContent !== label) storyCounter.textContent = label;
      }
    }
    if (progressRole) setAttribute(storyBar, 'aria-valuenow', String(Math.round(progress * 100)));
  }

  function updateHeader(scroll) {
    setClass(header, 'is-scrolled', scroll > 18);
  }

  function near(rect, scroll) {
    return scroll + geometry.viewport + 160 >= rect.top && scroll - 160 <= rect.top + rect.height;
  }

  function render() {
    const scroll = scrollPosition();
    updateHeader(scroll);
    if (geometryDirty) measure(scroll);
    if (!motionEnabled) return;
    if (documentBar) {
      const progress = geometry.documentDistance > 0 ? clamp(scroll / geometry.documentDistance, 0, 1) : 0;
      setVariable(documentBar, '--scroll-progress', progress.toFixed(4));
    }
    if (heroPhone && geometry.hero && heroNear && near(geometry.hero, scroll)) {
      const progress = clamp((scroll - geometry.hero.top) / Math.max(1, geometry.hero.height), 0, 1);
      setVariable(hero, '--hero-lift', `${(-22 * progress).toFixed(2)}px`);
      setVariable(hero, '--hero-rotate', `${(-2 * progress).toFixed(2)}deg`);
      setVariable(hero, '--hero-depth', progress.toFixed(4));
    }
    if (storyEnabled && geometry.story) {
      const distance = Math.max(1, geometry.story.height - geometry.viewport);
      const progress = clamp((scroll - geometry.story.top) / distance, 0, 1);
      // Crossing an offscreen boundary needs one final state, not ongoing phone updates.
      if ((storyNear && near(geometry.story, scroll)) || progress === 0 || progress === 1) updateStory(progress);
    }
  }

  function requestFrame() {
    if (!schedulerReady || document.hidden || frame !== null) return;
    const version = ++frameVersion;
    try {
      frame = window.requestAnimationFrame(() => {
        if (version !== frameVersion) return;
        frame = null;
        if (!document.hidden) render();
      });
    } catch (_) {
      frame = null;
      schedulerReady = false;
      failMotion();
    }
  }

  function startObserver() {
    if (observer) return true;
    const version = ++observerVersion;
    heroNear = true;
    storyNear = true;
    try {
      observer = new window.IntersectionObserver(entries => {
        if (version !== observerVersion || !motionEnabled || document.hidden) return;
        let needsFrame = false;
        entries.forEach(entry => {
          const visible = entry.isIntersecting === true || entry.intersectionRatio > 0;
          if (entry.target === hero && heroNear !== visible) {
            heroNear = visible;
            needsFrame = true;
          }
          if (entry.target === showcase && storyNear !== visible) {
            storyNear = visible;
            needsFrame = true;
          }
          if (visible && revealTargets.has(entry.target) && !revealed.has(entry.target)) {
            revealed.add(entry.target);
            setClass(entry.target, 'is-visible', true);
            if (entry.target !== hero && entry.target !== showcase) {
              try { observer.unobserve(entry.target); } catch (_) { /* Already visible; never hide it again. */ }
            }
          }
        });
        if (needsFrame) requestFrame();
      }, { rootMargin: '160px 0px', threshold: 0 });
      const targets = new Set(reveals.filter(element => !revealed.has(element)));
      if (heroPhone) targets.add(hero);
      if (completeStory) targets.add(showcase);
      targets.forEach(element => observer.observe(element));
      return true;
    } catch (_) {
      disconnectObserver();
      return false;
    }
  }

  function configure() {
    try {
      reduced = !mediaReady || preference.matches !== false;
      const ready = !failed && schedulerReady && mediaReady && canClass(root) &&
        typeof window.IntersectionObserver === 'function' && (heroPhone || reveals.length || completeStory);
      if (!ready || reduced) {
        staticMotion();
        return;
      }
      if (!startObserver()) {
        failMotion();
        return;
      }
      motionEnabled = true;
      const view = viewport();
       const desktopStory = view.width >= 900 && view.height >= 760;
       const mobileStory = view.width >= 360 && view.width < 900 && view.height >= 640;
       const nextStory = completeStory && !storyTooShort && pinQuery.matches === true &&
         (desktopStory || mobileStory) && typeof window.scrollTo === 'function';
      if (nextStory !== storyEnabled) {
        storyEnabled = nextStory;
        geometryDirty = true;
        if (nextStory) {
          activeStep = -1;
          lastStoryProgress = null;
          updateStory(0);
          setClass(showcase, 'story-static', false);
          setClass(root, 'story-enhanced', true);
        } else {
          staticStory();
        }
      } else if (!nextStory) {
        staticStory();
      }
      setClass(root, 'motion-enabled', true);
    } catch (_) {
      reduced = true;
      failMotion();
    }
  }

  function invalidate() {
    geometryDirty = true;
    storyTooShort = false;
    configure();
    requestFrame();
  }

  function mediaChanged() {
    cancelFrame();
    invalidate();
  }

  function listen(target, event, handler, options) {
    if (!target || typeof target.addEventListener !== 'function') return false;
    try {
      target.addEventListener(event, handler, options);
      return true;
    } catch (_) {
      return false;
    }
  }

  function watchMedia(query) {
    if (!query || typeof query.matches !== 'boolean') return false;
    if (typeof query.addEventListener === 'function') return listen(query, 'change', mediaChanged);
    if (typeof query.addListener === 'function') {
      try { query.addListener(mediaChanged); return true; } catch (_) { return false; }
    }
    return false;
  }

  function staticJump(index) {
    const target = steps[index];
    if (!target) return;
    // Focus the readable description, not a decorative phone's aria-hidden contents.
    if (typeof target.focus === 'function') {
      if (typeof target.getAttribute === 'function' && target.getAttribute('tabindex') === null) {
        setAttribute(target, 'tabindex', '-1');
      }
      try { target.focus({ preventScroll: true }); } catch (_) { /* Scrolling remains usable without focus options. */ }
    }
    if (typeof target.scrollIntoView === 'function') {
      try { target.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch (_) { /* The static preview remains in the document. */ }
    }
  }

  stepLinks.forEach(link => {
    // Anchors retain their native hash, modifier-key, and keyboard behavior.
    if (String(link.tagName || '').toLowerCase() !== 'button' || stepNumber(link) === null) return;
    listen(link, 'click', event => {
      if (event && (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey ||
        (typeof event.button === 'number' && event.button !== 0))) return;
      const index = stepNumber(link);
      if (index === null || !steps[index]) return;
      if (geometryDirty) measure(scrollPosition());
      if (storyEnabled && geometry.story && typeof window.scrollTo === 'function') {
        const top = geometry.story.top + (geometry.story.height - geometry.viewport) * index / (steps.length - 1);
        try {
          window.scrollTo({ top: clamp(top, 0, geometry.documentDistance), behavior: 'smooth' });
          return;
        } catch (_) {
          failMotion();
        }
      }
      staticJump(index);
    });
  });

  try {
    if (typeof window.matchMedia === 'function') {
      preference = window.matchMedia('(prefers-reduced-motion: reduce)');
       pinQuery = window.matchMedia('(min-width: 360px) and (min-height: 640px)');
      mediaReady = watchMedia(preference) && watchMedia(pinQuery);
    }
  } catch (_) {
    mediaReady = false;
  }

  const scrollReady = listen(window, 'scroll', requestFrame, { passive: true });
  const resizeReady = listen(window, 'resize', invalidate, { passive: true });
  const restorationReady = listen(window, 'pageshow', invalidate, { passive: true });
  const visibilityReady = listen(document, 'visibilitychange', () => {
    if (document.hidden) {
      cancelFrame();
      disconnectObserver();
    } else {
      invalidate();
    }
  });
  if (!scrollReady || !resizeReady || !restorationReady || !visibilityReady) failed = true;
  listen(window, 'pagehide', () => { cancelFrame(); disconnectObserver(); }, { passive: true });
  listen(window, 'load', invalidate, { passive: true, once: true });
  listen(window, 'expenzo:layout', invalidate, { passive: true });

  configure();
  updateHeader(scrollPosition());
  requestFrame();
})();
