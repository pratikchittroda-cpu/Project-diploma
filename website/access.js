(function () {
  'use strict';

  const RECIPIENT = 'pratikchittroda@gmail.com';
  const ENDPOINT = `https://formsubmit.co/ajax/${RECIPIENT}`;
  const NATIVE_ENDPOINT = `https://formsubmit.co/${RECIPIENT}`;
  const DEADLINE_MS = 15000;
  const MAX_RESPONSE_BYTES = 16 * 1024;
  const MAILBOX = /^[^\s@<>\u0000-\u001f\u007f]+@[^\s@<>\u0000-\u001f\u007f]+\.[^\s@<>\u0000-\u001f\u007f]+$/;
  const MESSAGES = Object.freeze({
    idle: 'Enter your email to request early access. The publisher replies manually if the APK becomes available.',
    sending: 'Submitting your access request…',
    success: 'Early-access request submitted. The publisher will reply by email if the APK becomes available',
    error: 'Your access request was not confirmed. Please wait before submitting again.',
    uncertain: 'Your request may have been processed, but we could not confirm it. Wait and check your email before choosing to submit again.',
    unavailable: 'Access requests are temporarily unavailable. Please try again later.',
    invalid: 'Enter a valid email address (up to 254 characters).',
    blocked: 'Your request could not be submitted. Please refresh the page and try again.',
  });

  function approvedConfiguration(config) {
    if (!config || config.supportEmail !== RECIPIENT || config.accessRequestRecipient !== RECIPIENT || config.accessRequestEndpoint !== ENDPOINT) return false;
    try {
      const url = new URL(config.accessRequestEndpoint);
      return url.protocol === 'https:' && url.hostname === 'formsubmit.co' && !url.port && !url.username && !url.password && !url.search && !url.hash && url.pathname === `/ajax/${RECIPIENT}`;
    } catch { return false; }
  }

  function supportedBrowser() {
    if (typeof window.fetch !== 'function' || typeof window.AbortController !== 'function' || typeof window.TextDecoder !== 'function' || typeof window.ReadableStream !== 'function' || typeof window.Request !== 'function') return false;
    try { return new window.Request(ENDPOINT, { redirect: 'error' }).redirect === 'error'; }
    catch { return false; }
  }

  // Read incrementally: response.json()/text() would allow an unbounded provider body.
  async function readAcknowledgement(response, controller) {
    const length = response.headers.get('content-length');
    if (length && Number(length) > MAX_RESPONSE_BYTES) throw new Error('Unconfirmed response');
    if (!response.body || typeof response.body.getReader !== 'function') throw new Error('Unconfirmed response');
    const reader = response.body.getReader();
    const decoder = new window.TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let text = '';
    let complete = false;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) { complete = true; break; }
        bytes += chunk.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) throw new Error('Unconfirmed response');
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
      return JSON.parse(text);
    } finally {
      if (!complete) {
        controller.abort();
        reader.cancel().catch(function () {});
      }
      reader.releaseLock();
    }
  }

  function acknowledgementState(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return 'uncertain';
    // Provider prose is inspected only for negative signals, never rendered or logged.
    const signals = [data.message, data.status, data.error].filter(value => typeof value === 'string').join(' ').replace(/[_-]+/g, ' ');
    const activationRequired = data.activationRequired === true || data.activationRequired === 'true' || data.activated === false || data.activated === 'false' || data.active === false || data.active === 'false';
    if (activationRequired || /\b(?:de)?activat(?:e(?:d)?|ion|ing)\b|\bverif(?:y|ication)\b|\bconfirmation\b|\bconfirm your\b|\b(?:not active|inactive)\b/i.test(signals)) return 'unavailable';
    if (data.pending === true || data.pending === 'true' || /\b(?:pending|queued|processing|awaiting)\b/i.test(signals)) return 'uncertain';
    const hasError = data.error != null && data.error !== false && data.error !== 'false' && data.error !== '';
    if (hasError || /\b(?:fail(?:ed|ure)?|error|reject(?:ed|ion)?|unable|blocked|invalid|captcha|spam|unsuccessful)\b|\bnot (?:submitted|sent|confirmed)\b/i.test(signals)) return 'error';
    if (data.success === true || data.success === 'true') return 'success';
    if (data.success === false || data.success === 'false') return 'error';
    return 'uncertain';
  }

  function initialize() {
    const form = document.getElementById('access-request');
    if (!form || form.dataset.accessController === 'ready') return;
    form.dataset.accessController = 'ready';
    const email = document.getElementById('access-email');
    const button = document.getElementById('get-access-button');
    const status = document.getElementById('access-status');
    const honey = document.getElementById('access-company');

    if (!email || !button || !status || !honey || email.form !== form || button.form !== form || honey.form !== form) {
      form.addEventListener('submit', event => event.preventDefault());
      form.removeAttribute('action');
      form.dataset.state = 'unavailable';
      if (email) email.disabled = true;
      if (button) button.disabled = true;
      if (status) status.textContent = MESSAGES.unavailable;
      return;
    }

    const configured = approvedConfiguration(window.EXPENZO_PUBLIC_CONFIG) && supportedBrowser();
    const acknowledgedEmails = new Set(); // Page-lifetime only; no browser storage.
    let sending = false;
    let suspended = false;
    let activeAttempt = null;

    email.type = 'email';
    email.required = true;
    email.multiple = false;
    email.maxLength = 254;
    // Trim and set custom validity in our handler, then use native reportValidity.
    form.noValidate = true;
    status.setAttribute('role', 'status');

    if (configured && form.hasAttribute('action')) {
      // Preserve a native fallback only when the markup intentionally provides one.
      form.setAttribute('action', NATIVE_ENDPOINT);
      form.setAttribute('method', 'post');
    } else {
      form.removeAttribute('action');
    }

    function identity(value) { return value.trim().toLowerCase(); }
    function mounted() { return form.isConnected && email.isConnected && button.isConnected && status.isConnected && honey.isConnected; }

    function cancelAttempt() {
      const attempt = activeAttempt;
      if (!attempt) return;
      activeAttempt = null;
      window.clearTimeout(attempt.timer);
      attempt.controller.abort();
      attempt.reject(new Error('Unconfirmed request'));
      sending = false;
    }

    function render(state, message) {
      if (suspended || !mounted()) return;
      form.dataset.state = state;
      form.setAttribute('aria-busy', state === 'sending' ? 'true' : 'false');
      status.textContent = message || MESSAGES[state];
      email.disabled = state === 'sending' || state === 'unavailable';
      button.disabled = email.disabled || acknowledgedEmails.has(identity(email.value));
    }

    email.addEventListener('input', function () {
      if (suspended || sending || !configured || form.dataset.state === 'unavailable' || !mounted()) return;
      email.setCustomValidity('');
      email.removeAttribute('aria-invalid');
      if (acknowledgedEmails.has(identity(email.value))) render('success');
      else if (form.dataset.state === 'success') render('idle');
      else button.disabled = false;
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (suspended || sending) return;
      if (!mounted()) { cancelAttempt(); return; }
      if (!configured || form.dataset.state === 'unavailable') { render('unavailable'); return; }

      const address = email.value.trim();
      email.value = address;
      email.setCustomValidity(address.length <= 254 && MAILBOX.test(address) ? '' : MESSAGES.invalid);
      if (!email.reportValidity()) {
        email.setAttribute('aria-invalid', 'true');
        render('error', MESSAGES.invalid);
        return;
      }
      email.removeAttribute('aria-invalid');
      if (honey.value) { render('error', MESSAGES.blocked); return; }
      if (acknowledgedEmails.has(identity(address))) { render('success'); return; }

      sending = true;
      render('sending');
      const attempt = { controller: new window.AbortController(), timer: null, reject: null };
      const deadline = new Promise(function (_, reject) {
        attempt.reject = reject;
        attempt.timer = window.setTimeout(function () {
          attempt.controller.abort();
          reject(new Error('Unconfirmed request'));
        }, DEADLINE_MS);
      });
      activeAttempt = attempt;
      let result = 'uncertain';
      try {
        result = await Promise.race([
          (async function () {
            const response = await window.fetch(ENDPOINT, {
              method: 'POST',
              mode: 'cors',
              credentials: 'omit',
              redirect: 'error',
              cache: 'no-store',
              referrerPolicy: 'strict-origin',
              signal: attempt.controller.signal,
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              // Never serialize arbitrary form fields, URLs, messages or attachments.
              body: JSON.stringify({
                email: address,
                _replyto: address,
                _subject: 'Expenzo APK access request',
                _template: 'table',
                _captcha: 'false',
                _honey: '',
              }),
            });
            if (response.redirected || (response.url && response.url !== ENDPOINT)) return 'uncertain';
            if (!response.ok) return 'error';
            return acknowledgementState(await readAcknowledgement(response, attempt.controller));
          })(),
          deadline,
        ]);
      } catch {
        // Timeout, network loss or an unreadable acknowledgement may follow a processed request.
        result = 'uncertain';
      } finally {
        window.clearTimeout(attempt.timer);
        attempt.controller.abort();
        if (activeAttempt === attempt) {
          activeAttempt = null;
          sending = false;
          if (result === 'success') acknowledgedEmails.add(identity(address));
          render(result);
        }
      }
    });

    window.addEventListener('pagehide', function () {
      suspended = true;
      cancelAttempt();
    });
    window.addEventListener('pageshow', function (event) {
      if (!event.persisted || !suspended || !mounted()) return;
      suspended = false;
      // A bfcache return never repeats the aborted request.
      if (form.dataset.state === 'sending') render('uncertain');
    });

    render(configured ? 'idle' : 'unavailable');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
