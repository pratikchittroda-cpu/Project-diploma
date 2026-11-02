# Expenzo — website APK access requests

Date: **6 October 2026, Asia/Kolkata**.

**Live:** https://project1-7a465.web.app/#get-access

## Publication

The initial Hosting-only deployment published six reviewed changed/new website files.
They were staged over a freshly verified snapshot of the live site, not unrelated
local website changes. Independent HTTPS reads verified all **22 published file
bytes**; the other **16 published files remained unchanged**. Cache keys match
the new CSS, controller and public configuration. No APK/build/API deployment or
database write was included.

The scroll-handoff follow-up published only `index.html`, `styles.css`,
`access-header.js` and stylesheet-key changes in the two legal pages. Independent
HTTPS reads verified all **23 current published files**; the other **18 files
were preserved byte-for-byte**, including the activated email controller/config.

## User flow

At the top, visitors see **Get access** in the hero only. Once that button scrolls
above the sticky header, a smooth header CTA becomes available; returning to the
top hides it again. The masthead wordmark is **EXPENZO**. Mobile menu and footer
alternatives remain. All access links lead to one on-page form with just an email
address and Get access button.
Submitting stays on the page; it does not open the visitor’s mail app.

FormSubmit sends the request to **pratikchittroda@gmail.com**, with the submitted
address as Reply-To and subject **Expenzo APK access request**. The publisher
personally replies with the APK or a download link. There is no automatic APK
delivery, Expenzo account creation, attachment upload or promised delivery time.

The publisher approved FormSubmit, confirmed its one-time activation and
confirmed receiving the real test notification. A live POST returned HTTP 200
with the provider’s success acknowledgement; browser CORS preflight also passed.
The initial activation-required response was not treated as successful delivery.
No third-party visitor address was used for the real test.

## Changed files

- `website/index.html`: access CTAs, email-only form, integration scripts and
  truthful current availability/FAQ text; existing product scenes preserved.
- `website/styles.css`: scoped access styles, 44px+ targets and mobile layout.
- `website/access.js`: explicit AJAX submission, strict recipient allowlist,
  validation, pending lock, acknowledgement checks and safe error states.
- `website/access-header.js`: scroll-triggered CTA handoff, fresh geometry,
  coalesced updates, keyboard-safe hiding and page lifecycle cleanup.
- `website/public-config.js` / `website/validate-config.cjs`: public form routing
  and validated matching publisher recipient. No email password/API key exists.
- `website/privacy.html`: FormSubmit/publisher processing and retention notice.
- `website/account-deletion.html`: stylesheet cache-key refresh only; the separate
  manual deletion procedure is unchanged.
- `tests/website-access.test.cjs`, `tests/website-access-header.test.cjs` and
  `tests/website-browser-smoke.cjs`: form validation, handoff thresholds/reversal,
  response/error, lifecycle, real DOM and responsive regression coverage.

## Behaviour and boundaries

- No request on page load or invalid input; filled honeypots are rejected.
- Payload contains only the email/Reply-To and fixed subject/template/technical
  fields. The visitor cannot select another recipient, message or attachment.
- Duplicate submits are blocked while pending; acknowledged addresses are
  suppressed for the page lifetime. No address is kept in browser storage or
  Expenzo’s database.
- Success requires a provider acknowledgement, not HTTP 200 alone. Activation,
  pending, error and malformed response states never claim delivery.
- The request has a 15-second deadline and a 16 KiB response limit. Ambiguous
  outcomes preserve the draft and explain that it may have processed; there are
  no automatic retries. Pagehide aborts pending work.
- Standard provider anti-spam restrictions apply. This email-only AJAX flow uses
  a honeypot rather than making visitors complete reCAPTCHA; it is not a guarantee
  against all bots or spam.
- FormSubmit currently documents a 30-day submission archive. Publisher Gmail
  messages remain until the publisher deletes them; removal requests go to the
  public privacy contact. This is access follow-up, not marketing consent.

## Actual checks

Using Node **22.23.3** / npm **11.11.0**:

- `npm test`: **330 passed**, none failed/skipped after the header follow-up.
- `npm run check:source`: **144 app/test files, zero errors**.
- `node --check website/access.js`, `website/public-config.js` and
  `website/validate-config.cjs`: passed.
- `node --check website/access-header.js`: passed.
- `node website/validate-config.cjs` and scoped whitespace checks: passed.
- Isolated headless Chromium checked 1440×900, 1024×768, 1280×720, 768×1024,
  390×844 and 320×640 layouts, 200% access-form text, reduced motion, keyboard
  previews/menu/FAQ and no-JavaScript fallback. No horizontal overflow, clipped
  phone content, unexpected external request on load or page errors.
- Axe accessibility checks returned **zero violations** at the tested layouts.
- Real DOM submits used intercepted synthetic provider responses, never sent
  test visitor addresses externally, and verified validation, duplicate locks,
  positive acknowledgements and truthful activation failure.
- Separate real FormSubmit submission and publisher confirmation establish the
  actual notification path. Desktop and 320px form screenshots were inspected.
- Header follow-up: all six responsive sizes verify initial header hiding, the
  actual button/header boundary, smooth 260ms reveal, no navigation shift, reversal
  and focus returning to the hero without scrolling. Reduced motion disables
  animation; no-JavaScript keeps hero access available. Initial and scrolled
  desktop screenshots were visually inspected. No new real email was sent for
  this visual follow-up.

The optional browser test uses temporary browser binaries and an existing cached
Playwright package, not new repository dependencies or a personal browser profile.
Safari/Firefox, real mobile devices, future provider uptime and actual APK sharing
are not verified here. Native app, EAS AI API, credentials and Firebase finance
rules were not changed by this feature. Source remains uncommitted.
