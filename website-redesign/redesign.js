/* EXPENZO redesign — motion engine.
   One requestAnimationFrame loop drives every scroll scene. Everything uses
   transform/opacity only so it stays smooth on phones. Reduced-motion users
   get a static, fully readable page. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduce = doc.classList.contains('reduce');
  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var mobileQuery = window.matchMedia ? window.matchMedia('(max-width: 760px)') : { matches: false };
  var start = performance.now();

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { if (a === undefined) { a = 0; b = 1; } return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function absTop(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; }

  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var scrollY = window.scrollY;
  var lastY = scrollY;
  var velocity = 0;
  var mouse = { x: 0, y: 0, nx: 0, ny: 0 };

  /* ---------- split hero characters ---------- */
  var charIndex = 0;
  $$('[data-split-chars]').forEach(function (el) {
    var text = el.textContent;
    el.textContent = '';
    Array.prototype.forEach.call(text, function (ch) {
      var mask = document.createElement('span');
      mask.className = 'char-mask';
      var c = document.createElement('span');
      c.className = 'char';
      c.textContent = ch === ' ' ? ' ' : ch;
      c.style.setProperty('--i', charIndex++);
      mask.appendChild(c);
      el.appendChild(mask);
    });
  });

  /* ---------- word split for scroll-filled headings ---------- */
  var words = [];
  function splitWords(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === 3) {
        var parts = child.textContent.split(/(\s+)/);
        var frag = document.createDocumentFragment();
        parts.forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var w = document.createElement('span');
          w.className = 'w';
          w.textContent = part;
          words.push(w);
          frag.appendChild(w);
        });
        child.parentNode.replaceChild(frag, child);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') {
        splitWords(child);
      }
    });
  }
  var wordsHost = $('[data-words]');
  if (wordsHost && !reduce) splitWords(wordsHost);

  /* ---------- loader ---------- */
  function markLoaded() {
    var wait = reduce ? 0 : Math.max(0, 1150 - (performance.now() - start));
    window.setTimeout(function () {
      doc.classList.add('loaded');
      measure();
      // Remove the curtain outright once its exit transition has had time to run.
      window.setTimeout(function () { var l = $('.loader'); if (l) l.style.display = 'none'; }, reduce ? 0 : 1400);
    }, wait);
  }
  if (document.readyState === 'complete') markLoaded();
  else window.addEventListener('load', markLoaded, { once: true });

  /* ---------- header + menu ---------- */
  var header = $('[data-header]');
  var progressBar = $('[data-scroll-progress]');
  var menuToggle = $('[data-menu-toggle]');
  var menu = $('[data-menu]');
  var menuOpen = false;
  var dock = $('[data-dock]');
  var accessSection = $('[data-access-section]');
  var footer = $('[data-footer]');

  function setMenu(open) {
    if (!menu || !menuToggle) return;
    menuOpen = open;
    menuToggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    $('.menu-toggle-label', menuToggle).textContent = open ? 'Close' : 'Menu';
    if (open) {
      menu.hidden = false;
      void menu.offsetWidth;
      menu.classList.add('is-open');
      doc.style.overflow = 'hidden';
      header.classList.remove('is-hidden');
    } else {
      menu.classList.remove('is-open');
      doc.style.overflow = '';
      window.setTimeout(function () { if (!menuOpen) menu.hidden = true; }, reduce ? 0 : 800);
    }
  }
  if (menuToggle) menuToggle.addEventListener('click', function () { setMenu(!menuOpen); });
  if (menu) $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) { setMenu(false); menuToggle.focus(); } });
  mobileQuery.addEventListener && mobileQuery.addEventListener('change', function () { measure(); });

  /* ---------- reveal on view ---------- */
  var revealTargets = $$('[data-reveal], [data-lines], [data-stagger]');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- count-ups ---------- */
  var fmt = function (n) { return Math.round(n).toLocaleString('en-IN'); };
  function countUp(el) {
    if (reduce) return;
    var target = parseFloat(el.getAttribute('data-count'));
    if (!isFinite(target)) return;
    var t0 = performance.now();
    var dur = 1500;
    (function step(now) {
      var t = clamp((now - t0) / dur);
      el.textContent = fmt(target * (1 - Math.pow(2, -10 * t)) * (t === 1 ? 1 : 1));
      if (t < 1) requestAnimationFrame(step); else el.textContent = fmt(target);
    })(t0);
  }
  if ('IntersectionObserver' in window) {
    var countIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var panel = entry.target.closest('[data-mode-panel]');
        if (panel && !panel.classList.contains('is-active')) return;
        countIO.unobserve(entry.target);
        countUp(entry.target);
      });
    }, { threshold: 0.6 });
    $$('[data-count]').forEach(function (el) { countIO.observe(el); });
  }

  /* ---------- mode switch ---------- */
  var modeSwitch = $('[data-mode-switch]');
  $$('[data-mode-button]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.getAttribute('data-mode-button');
      if (modeSwitch) modeSwitch.setAttribute('data-mode', mode);
      $$('[data-mode-button]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      $$('[data-mode-panel]').forEach(function (panel) {
        var on = panel.getAttribute('data-mode-panel') === mode;
        panel.classList.toggle('is-active', on);
        if (on) $$('[data-count]', panel).forEach(countUp);
      });
    });
  });

  /* ---------- FAQ accordion with real height animation ---------- */
  $$('.faq details').forEach(function (details) {
    var summary = $('summary', details);
    var body = $('.faq-body', details);
    if (!summary || !body || !body.animate) return;
    var anim = null;
    summary.addEventListener('click', function (e) {
      if (reduce) return;
      e.preventDefault();
      if (anim) anim.cancel();
      if (!details.open) {
        details.open = true;
        var h = body.scrollHeight;
        anim = body.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
        anim.onfinish = function () { anim = null; };
      } else {
        var h2 = body.scrollHeight;
        anim = body.animate([{ height: h2 + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 380, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
        anim.onfinish = function () { details.open = false; anim = null; };
      }
    });
  });

  /* ---------- nav current section ---------- */
  var navLinks = $$('.nav-links a');
  if ('IntersectionObserver' in window) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = '#' + entry.target.id;
        navLinks.forEach(function (a) { a.classList.toggle('is-current', a.getAttribute('href') === id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['product', 'mode-lab', 'feature-tour', 'availability'].forEach(function (id) { var s = document.getElementById(id); if (s) navIO.observe(s); });
  }

  /* =========================================================
     HERO SCENE — scattered entries tidy themselves into order
     ========================================================= */
  var hero = {
    track: $('[data-hero-track]'), stage: $('[data-hero-stage]'), intro: $('[data-hero-intro]'),
    title: $('[data-hero-title]'), device: $('[data-hero-device]'), orbits: $('[data-hero-orbits]'),
    hint: $('[data-hero-hint]'), scribble: $('[data-scribble]'),
    chips: $$('[data-chip]'), slots: $$('[data-slot]'),
    top: 0, len: 1, y0: 0, yf: 0, data: []
  };

  function measureHero() {
    if (!hero.track || !hero.stage) return;
    hero.top = absTop(hero.track);
    hero.len = Math.max(1, hero.track.offsetHeight - vh);
    var stageRect = hero.stage.getBoundingClientRect();
    var mobile = mobileQuery.matches;
    hero.data = hero.chips.map(function (chip, i) {
      chip.style.transform = 'none';
      var visible = chip.offsetParent !== null;
      var cs = getComputedStyle(chip);
      var r = parseFloat(cs.getPropertyValue(mobile ? '--mr' : '--r')) || 0;
      var slot = hero.slots[i];
      if (!visible || !slot || slot.offsetParent === null) return { visible: false };
      var a = chip.getBoundingClientRect();
      var b = slot.getBoundingClientRect();
      return { visible: true, dx: b.left - a.left, dy: b.top - a.top, r: r, depth: 0.4 + ((i * 37) % 10) / 10 };
    });
    // Device: final position centred on the tidy columns (desktop) or tucked above the stack (phone).
    var H = hero.device.offsetHeight;
    var sh = stageRect.height;
    var finalCenter = sh / 2;
    var firstSlot = hero.slots[0];
    if (mobile) {
      // Phone sits just under the header; the sorted stack lands over its lower half.
      var headerH = parseFloat(getComputedStyle(doc).getPropertyValue('--header-h')) || 64;
      finalCenter = headerH + 12 + H / 2;
    } else if (firstSlot && firstSlot.offsetParent) {
      var grid = firstSlot.parentElement.getBoundingClientRect();
      finalCenter = (grid.top - stageRect.top) + grid.height / 2;
    }
    hero.yf = finalCenter - H / 2 - sh / 2;
    hero.y0 = sh * (mobile ? 0.34 : 0.3);
  }

  function updateHero(now) {
    if (!hero.track) return;
    var p = reduce ? 0 : clamp((scrollY - hero.top) / hero.len);
    if (!reduce && scrollY > hero.top + hero.len + vh) return; // off-screen
    var t = now * 0.001;

    // intro + hint
    if (hero.intro) { hero.intro.style.opacity = 1 - clamp(p / 0.12); hero.intro.style.transform = 'translateY(' + (-p * 120) + 'px)'; hero.intro.style.visibility = p > 0.13 ? 'hidden' : ''; }
    if (hero.hint) hero.hint.style.opacity = 1 - clamp(p / 0.05);

    // title recedes
    var te = easeOut(clamp(p / 0.5));
    hero.title.style.transform = 'translate(-50%, calc(-50% - ' + (te * vh * 0.14) + 'px)) scale(' + (1 - 0.16 * te) + ')';
    hero.title.style.opacity = 1 - 0.93 * clamp(p / 0.42);

    // "mess" gets crossed out
    if (hero.scribble) hero.scribble.style.strokeDashoffset = 420 * (1 - easeOut(clamp((p - 0.02) / 0.2)));

    // phone rises and flattens
    var de = easeOut(clamp(p / 0.55));
    var ry = finePointer ? mouse.nx * 8 * (0.3 + de) : 0;
    var rx = 30 * (1 - de) + (finePointer ? -mouse.ny * 5 * de : 0);
    hero.device.style.transform = 'translate3d(-50%, ' + lerp(hero.y0, hero.yf, de).toFixed(1) + 'px, 0) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) scale(' + lerp(0.9, 1, de).toFixed(3) + ')';
    hero.device.style.setProperty('--shine', (100 - de * 100) + '%');

    // orbits
    if (hero.orbits) hero.orbits.style.transform = 'translate(-50%, -50%) rotate(' + (p * 35) + 'deg) scale(' + (1 + p * 0.25) + ')';

    // chips: float while messy, then settle into slots
    var mobile = mobileQuery.matches;
    var sorted = 0;
    hero.chips.forEach(function (chip, i) {
      var d = hero.data[i];
      if (!d || !d.visible) return;
      var s = easeInOut(clamp((p - 0.16 - i * 0.035) / 0.4));
      if (s > 0.98) sorted++;
      var free = 1 - s;
      var fx = Math.sin(t * 0.9 + i * 1.7) * 6 * free;
      var fy = Math.cos(t * 1.1 + i * 2.3) * 9 * free;
      var px = finePointer ? mouse.nx * 26 * d.depth * free : 0;
      var py = finePointer ? mouse.ny * 20 * d.depth * free : 0;
      var sc = mobile ? lerp(0.84, 1, s) : 1;
      chip.style.transform = 'translate3d(' + (d.dx * s + fx + px).toFixed(1) + 'px,' + (d.dy * s + fy + py).toFixed(1) + 'px,0) rotate(' + (d.r * free).toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
    });
    hero.stage.classList.toggle('is-tidy', p > 0.74);
  }

  /* =========================================================
     MANIFESTO — card expands, words light up, verbs drift
     ========================================================= */
  var mani = { card: $('[data-manifesto-card]'), verbs: $$('[data-drift]'), arrow: $('[data-spin]') };
  function updateManifesto() {
    if (!mani.card || reduce) return;
    var r = mani.card.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) return;
    var m = easeOut(clamp((vh - r.top) / (vh * 0.85)));
    var maxInset = Math.min(vw * 0.05, 60);
    mani.card.style.setProperty('--inset', ((1 - m) * maxInset).toFixed(1) + 'px');
    mani.card.style.setProperty('--rad', ((1 - m) * 56 + 0).toFixed(1) + 'px');
    if (words.length && wordsHost) {
      var hr = wordsHost.getBoundingClientRect();
      var w = clamp((vh * 0.88 - hr.top) / (vh * 0.45));
      var n = words.length;
      words.forEach(function (el, i) { el.style.setProperty('--o', (0.16 + 0.84 * clamp(w * n - i)).toFixed(3)); });
    }
    mani.verbs.forEach(function (el) {
      var er = el.getBoundingClientRect();
      var c = er.top + er.height / 2 - vh / 2;
      el.style.transform = 'translate3d(' + (c * 0.35 * parseFloat(el.getAttribute('data-drift'))).toFixed(1) + 'px,0,0)';
    });
    if (mani.arrow) mani.arrow.style.transform = 'rotate(' + ((1 - m) * -90 + clamp((vh / 2 - r.top) / vh, -1, 1) * 45) + 'deg)';
  }

  /* =========================================================
     MARQUEE — constant drift, speeds up with scroll velocity
     ========================================================= */
  var marquee = { row: $('[data-marquee-row]'), pos: 0, w: 0, dir: 1 };
  if (marquee.row) {
    var track = $('.marquee-track', marquee.row);
    marquee.row.appendChild(track.cloneNode(true));
  }
  function updateMarquee(dt) {
    if (!marquee.row || reduce) return;
    if (!marquee.w) marquee.w = marquee.row.firstElementChild.offsetWidth || 1;
    if (Math.abs(velocity) > 0.5) marquee.dir = velocity > 0 ? 1 : -1;
    marquee.pos += (0.045 * dt + Math.abs(velocity) * 0.6) * marquee.dir;
    var x = ((marquee.pos % marquee.w) + marquee.w) % marquee.w;
    var skew = clamp(velocity * 0.25, -8, 8);
    marquee.row.style.transform = 'translate3d(' + (-x).toFixed(1) + 'px,0,0) skewX(' + (-skew).toFixed(2) + 'deg)';
  }

  /* =========================================================
     FEATURE TOUR — a deck of phones; each step deals the top card away
     ========================================================= */
  var GLOWS = [[49, 87, 255], [60, 207, 160], [255, 156, 128], [130, 150, 255]];
  var tour = {
    track: $('[data-tour-track]'), sticky: $('.tour-sticky'), cards: $$('[data-deck-card]'), notes: $$('[data-note]'),
    steps: $$('[data-step]'), links: $$('[data-step-link]'), counter: $('[data-story-counter]'),
    reel: $('[data-bignum]'), glow: $('[data-tour-glow]'), top: 0, len: 1, active: -1, manual: 0
  };
  function measureTour() { if (!tour.track) return; tour.top = absTop(tour.track); tour.len = Math.max(1, tour.track.offsetHeight - vh); }
  function setActiveStep(a) {
    if (a === tour.active) return;
    tour.active = a;
    tour.steps.forEach(function (s, i) { s.classList.toggle('is-active', i === a); s.classList.toggle('is-past', i < a); });
    tour.links.forEach(function (l, i) { if (i === a) l.setAttribute('aria-current', 'step'); else l.removeAttribute('aria-current'); });
    tour.notes.forEach(function (n) { n.classList.toggle('on', +n.getAttribute('data-note') === a); });
    if (tour.counter) tour.counter.textContent = '0' + (a + 1) + ' / 04';
  }
  function deckPosition(q, n) {
    // Each step dwells, then the last 40% of its slice deals the card away.
    var raw = q * n;
    var idx = Math.min(n - 1, Math.floor(raw));
    if (idx >= n - 1) return n - 1;
    return idx + easeInOut(clamp((raw - idx - 0.6) / 0.4));
  }
  function renderDeck(pos, now) {
    var n = tour.cards.length;
    var mobile = mobileQuery.matches;
    var t = now * 0.001;
    tour.cards.forEach(function (card, i) {
      var k = i - pos;
      var tf, op = 1, dim = 0, z;
      if (k <= -1) { op = 0; z = 1; tf = 'translate3d(-120%,0,0)'; }
      else if (k < 0) {
        var e = -k; // leaving: swing out to the left like a dealt card
        var tx = -e * (mobile ? vw * 0.75 : Math.min(vw * 0.42, 560));
        tf = 'translate3d(' + tx.toFixed(1) + 'px,' + (-e * 40 - Math.sin(e * Math.PI) * 30).toFixed(1) + 'px,' + (e * 80).toFixed(1) + 'px) rotateZ(' + (-e * 22).toFixed(2) + 'deg) rotateY(' + (e * 38).toFixed(2) + 'deg)';
        op = 1 - clamp((e - 0.55) / 0.45);
        z = 30;
      } else {
        // waiting in the stack, fanned slightly up and to the right
        var c = Math.min(k, 3);
        var float = k < 0.05 ? Math.sin(t * 1.2) * 6 : 0;
        var tiltY = k < 0.05 && finePointer ? mouse.nx * 10 : 0;
        var tiltX = k < 0.05 && finePointer ? -mouse.ny * 6 : 0;
        tf = 'translate3d(' + (c * (mobile ? 16 : 34)).toFixed(1) + 'px,' + (-c * (mobile ? 14 : 24) + float).toFixed(1) + 'px,' + (-c * 90).toFixed(1) + 'px) rotateZ(' + (c * 5).toFixed(2) + 'deg) rotateY(' + (tiltY - c * 6).toFixed(2) + 'deg) rotateX(' + tiltX.toFixed(2) + 'deg)';
        dim = clamp(c * 0.32, 0, 0.85);
        op = k > 2.6 ? 0 : 1;
        z = 20 - Math.round(c * 4);
      }
      card.style.transform = tf;
      card.style.opacity = op.toFixed(3);
      card.style.zIndex = z;
      card.style.setProperty('--dim', dim.toFixed(3));
    });
    if (tour.reel) tour.reel.style.transform = 'translate3d(0,' + (-pos * 100 / n).toFixed(3) + '%,0)';
    if (tour.glow) {
      var a = Math.floor(pos), b = Math.min(n - 1, a + 1), f = pos - a;
      var g = GLOWS[a].map(function (v, j) { return Math.round(lerp(v, GLOWS[b][j], f)); }).join(', ');
      tour.sticky.style.setProperty('--g', g);
      tour.glow.style.setProperty('--g', g);
    }
  }
  function updateTour(now) {
    if (!tour.track) return;
    var n = tour.cards.length;
    if (reduce) {
      setActiveStep(tour.manual);
      renderDeck(tour.manual, 0);
      return;
    }
    if (scrollY < tour.top - vh * 1.2 || scrollY > tour.top + tour.len + vh) return;
    var q = clamp((scrollY - tour.top) / tour.len);
    var pos = deckPosition(q, n);
    setActiveStep(Math.min(n - 1, Math.round(pos)));
    renderDeck(pos, now || performance.now());
    tour.links.forEach(function (l, i) { l.style.setProperty('--f', clamp(q * n - i).toFixed(3)); });
  }
  tour.links.forEach(function (link, i) {
    link.addEventListener('click', function () {
      if (reduce) { tour.manual = i; updateTour(); return; }
      window.scrollTo({ top: tour.top + ((i + 0.3) / tour.cards.length) * tour.len, behavior: 'smooth' });
    });
  });

  /* ---------- footer wordmark rises letter by letter ---------- */
  var wordmark = $('[data-wordmark]');
  var wordLetters = wordmark ? $$('span', wordmark) : [];
  function updateWordmark() {
    if (!wordmark || reduce) return;
    var r = wordmark.getBoundingClientRect();
    if (r.top > vh + 50) return;
    // Fully settled once the wordmark is ~60% into view, so it never ends half-finished.
    var wp = clamp((vh - r.top) / (r.height + vh * 0.25));
    wordLetters.forEach(function (l, i) { l.style.setProperty('--wp', clamp(wp * 2.2 - i * 0.12).toFixed(3)); });
  }

  /* ---------- header state, progress, dock ---------- */
  function updateChrome() {
    var max = Math.max(1, document.documentElement.scrollHeight - vh);
    document.body.classList.toggle('past-intro', reduce || scrollY > hero.top + hero.len * 0.1);
    if (progressBar) progressBar.style.setProperty('--scroll-progress', (scrollY / max).toFixed(4));
    if (header) {
      header.classList.toggle('is-scrolled', scrollY > 24);
      if (!menuOpen) {
        if (velocity > 2 && scrollY > vh * 0.8) header.classList.add('is-hidden');
        else if (velocity < -2 || scrollY < vh * 0.5) header.classList.remove('is-hidden');
      }
    }
    if (dock) {
      var ar = accessSection ? accessSection.getBoundingClientRect() : null;
      var fr = footer ? footer.getBoundingClientRect() : null;
      var inTour = tour.track && scrollY > tour.top - vh * 0.5 && scrollY < tour.top + tour.len + vh * 0.3;
      var nearForm = inTour || (ar && ar.top < vh && ar.bottom > 0) || (fr && fr.top < vh);
      var show = scrollY > hero.top + hero.len * 0.9 && !nearForm && !menuOpen;
      document.body.classList.toggle('show-dock', show);
      dock.setAttribute('aria-hidden', String(!show));
      dock.tabIndex = show ? 0 : -1;
    }
  }

  /* ---------- pointer: cursor, magnetic, tilt ---------- */
  if (finePointer && !reduce) {
    var cursor = $('.cursor');
    var dot = $('.cursor-dot');
    var ring = $('.cursor-ring');
    var rx = 0, ry = 0;
    window.addEventListener('pointermove', function (e) {
      mouse.x = e.clientX; mouse.y = e.clientY;
      mouse.nx = (e.clientX / vw) * 2 - 1; mouse.ny = (e.clientY / vh) * 2 - 1;
      if (dot) dot.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) translate(-50%,-50%)';
      if (cursor) cursor.classList.remove('is-hidden');
    }, { passive: true });
    document.addEventListener('pointerleave', function () { if (cursor) cursor.classList.add('is-hidden'); });
    (function follow() {
      rx = lerp(rx, mouse.x, 0.18); ry = lerp(ry, mouse.y, 0.18);
      if (ring) ring.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px) translate(-50%,-50%)';
      requestAnimationFrame(follow);
    })();
    document.addEventListener('pointerover', function (e) {
      var hit = e.target.closest && e.target.closest('a, button, summary, input, label');
      if (cursor) cursor.classList.toggle('is-hover', !!hit && !(hit.tagName === 'INPUT'));
    });

    $$('.magnetic').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - (r.left + r.width / 2);
        var y = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + (x * 0.22).toFixed(1) + 'px,' + (y * 0.32).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });

    $$('[data-tilt]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ---------- measure + loop ---------- */
  function measure() {
    vw = window.innerWidth; vh = window.innerHeight;
    measureHero(); measureTour();
    marquee.w = 0;
    tick(performance.now(), true);
  }
  var resizeTimer = null;
  var lastW = vw, lastH = vh;
  window.addEventListener('resize', function () {
    // Ignore the small height changes caused by mobile URL bars.
    if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) return;
    lastW = window.innerWidth; lastH = window.innerHeight;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 120);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  var lastTime = performance.now();
  function tick(now, once) {
    var dt = Math.min(64, now - lastTime);
    lastTime = now;
    scrollY = window.scrollY;
    var raw = scrollY - lastY;
    lastY = scrollY;
    velocity = lerp(velocity, raw, 0.2);
    updateHero(now);
    updateManifesto();
    updateMarquee(dt);
    updateTour(now);
    updateWordmark();
    updateChrome();
    if (once !== true) requestAnimationFrame(tick);
  }
  measure();
  requestAnimationFrame(tick);
})();
