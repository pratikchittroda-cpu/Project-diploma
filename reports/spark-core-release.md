# Expenzo — Spark core deployment

**Resume here:** [10 October handoff](#resumable-handoff--10-october-2026).
This file preserves historical checkpoints. The later AI/access-request reports
and the handoff distinguish those checkpoints from the current working tree.

**Current AI state (6 October 2026):** the later, explicitly authorised EAS Hosting
activation supersedes the historical disabled-AI statements below. Live chat,
categorisation and receipt-text parsing have been verified with a temporary
synthetic account; its profile/usage/Auth records were removed. Local budget
recommendations are restored, and provider credentials stay off the native bundle.
Firebase stays on Spark; reporting, uploads and automated deletion stay disabled.
No APK/device test was made. See [`ai-activation.md`](ai-activation.md).

Initial deployment: **5 October 2026, Asia/Kolkata**. Website redesign update:
**6 October 2026, Asia/Kolkata**, documented below. This supersedes earlier
“nothing deployed” and full-backend requirements in the historical audit/handoff.

## What is actually public

- Informational website: https://project1-7a465.web.app
- Privacy: https://project1-7a465.web.app/privacy.html
- Manual account-deletion requests: https://project1-7a465.web.app/account-deletion.html
- Firestore owner-isolating security rules and eight indexes on the existing
  **project1-7a465** default database. Metadata confirms its **free tier**.

**This is not a public downloadable app or browser expense tracker.** The website
shows labelled sample screens/product information. No APK/AAB or device test was
performed, no store listing/release was submitted, and no paid build was launched.
Android SDK/build/device work stays paused at the user's request. Billing remains
on the chosen free plan. No Functions, Secret Manager or Storage rule deployment
was included.

## Core application boundaries

- Firebase JS email/password Auth, Firestore transactions, budgets, reports and
  company/member records remain. Existing Google-only users need a linked password
  method or a future verified OAuth build; production Google IDs were not invented.
- `config/releaseFeatures.js` hard-disables server features. A leftover endpoint
  cannot enable them. `App.js` does not register backend App Check in core;
  `services/backendClient.js` rejects before obtaining tokens or sending requests.
- AIChat is restored as an interactive client for ready personal/company accounts.
  Drafts, shortcuts and conversation-only consent work; the unchanged backend gate
  rejects sends before tokens/network. No server-side AI data is stored or sent.
- Account deletion is disabled in-app; Privacy/external support links remain.
  No pretend server success or client-first cloud erase was added.
- Profile-photo picker/upload is removed. New image fields/file URIs are rejected;
  no Firebase Storage instance is created in core. Legacy HTTPS photos can still
  display; their availability was not tested and records were not migrated.
- Core production validation no longer demands disabled-feature endpoints,
  AI terms, Storage or native App Check files. Optional supplied OAuth/native
  values remain validated. Dormant strict-server tests explicitly opt in.

## Initial personal Home and chat UI restoration — 6 October 2026

This records the first, UI-only pass. The whole-app follow-up below supersedes
its disabled composer and personal-only chat route.

The original gradient, greeting/profile, glass balance card, period toggles and
recent-transactions styling are restored in `components/finance/PersonalDashboard.js`.
`screens/personal/DashboardScreen.js` still uses the `FinanceAccount` identity/theme
guard. Complete-snapshot, local Monday/to-date and paise calculations use the
existing finance utilities; real saved budgets replace invented defaults.
Company/report screens remain unchanged.

`components/finance/HomeAIEntry.js` appears directly below the overview even when
finance data is loading or unavailable. It opens `screens/personal/AIChatScreen.js`,
which restores the chat layout with explicit unavailable notices and disabled
submission paths. Back and Privacy remain usable. The protected route is absent
for signed-out, recovery and company accounts. Billing, backend gates and provider
credentials were not changed; no server or Hosting deployment was performed.

Checks: `npm test` **266 passed**, `npm run check:source` **0 errors**, and a test-only
iOS Expo/Hermes export compiled **1,184 modules**. These checks used the installed
Node **25.8.1**, not the documented release runtime **22.23.3**. Export used
`EXPO_NO_DOTENV=1 APP_VARIANT=test` and intentionally lacked release configuration;
it is not a native build, configured release or device verification.

Manual smoke: reload the running app, open Home, change Week/Month/Year, then tap
Ask Financial AI. Confirm the unavailable notice and disabled composer/Send;
check Back returns to Home and Privacy opens. Live Home/chat tap-through and
small-screen/large-font layout checks remain manual.

## Whole-app UI follow-up — 6 October 2026

The user requested the original appearance throughout the app, then explicitly
required **no backend changes**. The restoration therefore changes front-end
screens and navigation, not Functions, Firebase configuration, service gates,
provider credentials, billing, dependencies or native projects.

- The six shared `components/finance/Finance*.js` components restore gradients,
  glass cards, transaction/category forms, history, budget progress, team forms,
  company dashboards and real-ledger report charts. Existing complete-snapshot,
  local-calendar, paise and atomic-mutation behavior is retained.
- `components/account/AccountPrimitives.js`, auth/profile/editor/recovery
  components and personal/company settings restore branded forms, avatars,
  menu sections and password visibility without reverting account protections.
- `navigation/SharedTabBar.js`, navigators, `components/ThemedMessageBox.js`
  and utility screens restore floating Add/Close tabs, loading/account selection,
  theme grids, password/privacy cards and confirmation/prompt appearance.
- Personal BackupRestore and company BillingSubscription routes are restored
  behind the matching ready-account branches. Their missing operations remain
  honestly inactive, without invented backups, purchases or entitlements.
- `screens/personal/AIChatScreen.js` restores editable drafts, suggestions,
  explicit conversation-only consent, send/loading/retry/edit/cancel/clear,
  full answers and privacy navigation. Both ready account types can open it;
  company Home also keeps its entry visible while finance data is loading.
- Chat state is memory-only. Auth replacement, including a new login to the
  same UID, resets consent/history and aborts pending work. Each handler checks
  the exact session object so an old callback cannot send new-session credentials
  with old consent or conversation state.

Actual checks: `npm test` **282 passed**, no skips/failures;
`npm run check:source` **119 files, 0 errors**; scoped `git diff --check` passed.
The test-only iOS Expo/Hermes export compiled **1,189 modules and 38 assets** using
`EXPO_NO_DOTENV=1 APP_VARIANT=test npm exec -- expo export --platform ios` with an
approved temporary output directory. Tests ran on installed Node **25.8.1**;
the documented release runtime **22.23.3** and a signed native build were not tested.

Regression cases cover actual UI controllers, numeric transaction payloads,
complete totals versus paginated history, single budget saves, local report data,
account-type sign-in, password visibility, tab event prevention/return/keyboard,
prompt callback ownership, consent, duplicate sends, draft preservation, retries,
cancellation and account changes. A real chat-service/backend-client stack test
confirms the unchanged default rejects sends before tokens, attestation or fetch.
Positive AI answers in tests are synthetic service fixtures, **not live provider
verification**. Live AI replies remain blocked by `SERVER_FEATURES_ENABLED=false`;
uploads/deletion and genuinely unimplemented backup/payment/security extras are
not made functional by their restored appearance.

Manual check: reopen the development client, review personal/company tabs and
settings, then Home → Ask Financial AI. Draft/edit and consent work; Send should
show the genuine connection requirement without an AI reply. Confirm clear,
back and privacy navigation. Native tap-through, small-screen/large-font layout
and live Firebase/AI end-to-end verification remain manual; no simulator was
booted during the final automated checks. No production deployment was made.

The local Expo dev-client packager was started with
`CI=1 npm start -- --host localhost --port 8081`. Its working directory was
verified as this repository and `http://localhost:8081/status` returned
`packager-status:running`. This is a Metro/dev-client connection, not a browser
expense-tracking app; reopen the native client to inspect the restored screens.

## Production changes and independent verification

The previous live Firestore policy allowed **all authenticated users to read/write
all documents**. It was read and staged outside git before deployment; no finance
documents were queried. The replacement enforces owner/company scope, immutable
identity, allowed schemas and server-only internal paths. The existing uppercase
`Transactions` index was preserved rather than automatically deleted.

Deployment command, run under Node **22.23.3**:

```sh
node functions/node_modules/firebase-tools/lib/bin/firebase.js deploy \
  --only firestore:rules,firestore:indexes,hosting \
  --project project1-7a465 --non-interactive
```

The CLI compiled/released rules, deployed indexes and finalized the Hosting live
version. It emitted one **unused `category` helper warning**, not a compile error.
A later intentional Hosting-only deployment included final copy/JavaScript fixes.

Independent reads, not just dispatch/deployment messages, confirmed:

- Ruleset: `projects/project1-7a465/rulesets/f3d546dd-cb98-4d5e-8dcd-3a9f36e12e4d`.
- Its content exactly equals `firestore.rules`; SHA-256:
  `3c70a703ae79f37f4010f3766dfd35070d63f81919501d6a4d7a0e055d3bcbc6`.
- All **8 composite indexes READY**, including the original uppercase index.
- Auth configuration has email authentication enabled. `passwordRequired: false`
  permits either password or email-link authentication per the official Config
  schema; no provider setting or production account was changed.
- Initial verified Hosting version: `projects/project1-7a465/sites/project1-7a465/versions/ebc430906a60e7aa`,
  **FINALIZED**, released `2026-10-05T18:19:22.305Z`.
- At that deployment, all **9 hosted files** returned HTTP 200 and byte-for-byte matched the local
  website, including both legal pages, public configuration, JavaScript, CSS,
  logo and favicon. No external broken `../assets` paths remain.

No existing finance documents/users were created, deleted, read or migrated.
Stricter rules may reveal malformed old writes that need separate correction.
No claim is made about every current legacy record's compatibility.

## EAS configuration

Using the existing registered Firebase **Web app** `expenzo`, public config was
retrieved without printing API-key bytes and scoped to **@pratik2467/Expenzo**,
**production**. These ten values were created/updated and independently read back:

- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`
- `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`
- `SUPPORT_EMAIL`, `LEGAL_ENTITY_NAME`, `DATA_RETENTION_SUMMARY`
- `PRIVACY_POLICY_URL`, `ACCOUNT_DELETION_URL`

Only public Firebase/build metadata was transmitted. No provider key, password,
OAuth secret, native service-file content or account credential was provisioned.
No Google OAuth or backend URL variable was present in the inspected project
environment. The actual core validator passed with the registered public config
and server/native/Storage values absent. EAS configuration is **not a built app**.

## Privacy/deletion operation

Publisher: **Expenzo**. Contact: **pratikchittroda@gmail.com**. Effective date:
**2026-10-05**. User's “until I delete it” answer is represented as retention
until records are removed or support processes an ownership-verified request,
with **no guaranteed response or completion deadline**. No 5/30-day promise was
invented. This does not establish Google Play/legal compliance.

The request form only prepares a mailto email. It does not send mail, accept
credentials or erase records. It enables after valid configuration loads;
without JavaScript the displayed address/instructions remain usable. Local DOM
tests verified preparation, failed-configuration disabling and truthful status
messages. Real email delivery/support processing was not tested.

The publisher must monitor the support inbox and verify ownership before any
manual deletion. With the Firebase Console/admin access, remove all owned
transaction/budget/team/member records, the profile and Auth identity; Auth/profile
removal alone does **not** erase separately stored Firestore records. Prevent
further writes during handling, check the affected UID carefully and verify
completion. No deletion procedure was exercised on a real account here.

AI/cloud photos are disabled; legal/marketing copy no longer promises them. No
automatic server retention jobs run. Firebase infrastructure/backup/service-log
retention is controlled by Google, not an invented Expenzo retention guarantee.
No ads, bank transfers or working application download is advertised.

## Initial deployment checks

Under Node **22.23.3**, npm **11.11.0**:

- `npm test`: **127 passed**, none failed/skipped. This includes core feature
  boundaries, strict-server regression fixtures and website behaviour tests.
- `npm run check:source`: **110 source/test files, zero errors**.
- `npm --prefix functions test`: **34 passed**, none failed/skipped. Dormant
  backend behaviour remains locally tested, not deployed in Spark.
- `npm run test:rules`: **12 passed** in `demo-expenzo` Firestore/Storage emulators,
  before production deployment; no live records were used. Java 25 emitted an
  Unsafe deprecation warning without failing the suite.
- `node scripts/validate-release-config.cjs --production` with the real public
  core configuration: **passed**; no endpoint/provider/native/Storage required.
- `node website/validate-config.cjs`: **passed** for presence/format. This is not
  a legal review or proof that the support inbox handles requests.
- All hosted file bytes, rules content and ready indexes independently verified
  as described above. `git diff --check`: **passed**.

One initial combined unit run failed because an old iOS resource test expected a
missing native file error rather than the new missing-core-config error. Its
assertion/description was updated to the actual fail-before-copy contract, and
the full suite was rerun successfully. No SDK/native build was involved.

Known prior dependency status remains **19 high app entries**, **3 high Functions
tooling entries**, **zero Functions production advisories**; no new forced
dependency upgrade or audit suppression was applied in this core adaptation.
No signed binary, store submission, real login/finance/device flow or production
support deletion was tested. A downloadable application remains a separate,
explicitly authorised build/distribution step.

## Files and next step

Meaningful changes: `config/releaseFeatures.js`, Firebase/public validation,
startup/backend gating, account/navigation/photo/privacy UI, `firebase.json`,
`firestore.indexes.json`, website/legal/assets, core/config/website tests,
`.env.example`, `README.md` and this report. Older audit/handoff remains history.
All source changes are **uncommitted**; unrelated `.DS_Store` was preserved.

The publisher reports no app/bundle/key was shared and chose to leave the NVIDIA
key unchanged. It remains unused in core and no revocation is claimed.

**Next step:** if a downloadable app is wanted, decide on a separately authorised
cloud build/distribution approach. Until then, only database security/config and
the informational website are public—not the finance app itself.

## First website redesign — 6 October 2026 (superseded design)

The live informational site now has an editorial cream/ink/lime layout,
self-hosted Space Grotesk and Manrope typography, a custom brand mark and a
detailed titanium-style phone with camera island, side buttons, status icons
and a home indicator. Fonts include their SIL Open Font License notice; there
are no runtime font-service requests or added application dependencies.

A four-stage, pinned desktop walkthrough rotates the phone and crossfades
Dashboard, Transactions, Budgets and Reports as the visitor scrolls. It uses
passive events and coalesced animation frames, without hijacking scrolling or
an idle animation loop. Mobile/short viewports and reduced-motion mode use
readable static previews; a no-JavaScript fallback also shows all four screens.
All amounts are labelled illustrative INR data. Core availability and manual
deletion/support copy remain accurate; no app download is advertised.

Changed website files: `website/index.html`, `website/styles.css`,
`website/script.js`, `website/assets/expenzo-mark.svg` and
`website/assets/fonts/`. Regression coverage lives in
`tests/website-motion.test.cjs`, `tests/website-core.test.cjs` and the optional
`tests/website-browser-smoke.cjs` real-browser check.

Verification under Node **22.23.3**, npm **11.11.0**:

- `npm test`: **171 passed**, zero failed/skipped.
- `npm run check:source`: **112 source/test files**, zero errors.
- `node website/validate-config.cjs` and scoped `git diff --check`: passed.
- Isolated headless Chromium checked 1440×900, 1024×768, 1280×720,
  768×1024, 390×844 and 320×640 layouts, all four pinned stages at both
  eligible desktop sizes, the step button, reduced-motion and no-JavaScript
  fallbacks, and both legal pages. No horizontal overflow, clipped screen
  contents, page errors, failed resource responses or external requests.
  Screenshots were visually inspected. This is **not** a real-device or
  Safari/Firefox test. The built-in local preview timed out; the checks used
  a separate temporary browser installation/profile, not the user's browser.
- To repeat the optional check, serve `website/` locally and run
  `node tests/website-browser-smoke.cjs`; Playwright must be separately
  available. `--playwright`, `--output` and `--url` accept explicit paths/a
  localhost URL. The check refuses non-local websites.

Published with `firebase deploy --only hosting --project project1-7a465`
through the existing Firebase CLI under Node 22.23.3. The CLI finalized and
released the version. Independent public HTTP reads at
**2026-10-05T19:19:24.441Z (6 October, 00:49 IST)** verified all **14 hosted
files** returned HTTP 200 and exactly matched local bytes, including both
fonts and the unchanged legal pages. The root route also matched
`website/index.html`; its SHA-256 is
`3ec3b2d7e63ab791d29db089938cdf2b0c01631ad43b087f458223afb89cc1d6`.

This was a **Hosting-only** update. No billing, Firestore policy/index,
authentication, EAS, Functions, Storage, account-data or native-build change
was performed. Android work stays paused. Changes remain uncommitted.

## Complete website rebuild — 6 October 2026 checkpoint

The earlier cream/lime design above is now history. The user requested a
complete replacement, so the public site now uses a cobalt/ink/ice palette,
self-hosted Syne display typography, a new brand mark and a centered oversized
“Money. Minus the mess.” hero with custom orbital artwork. The phone is now a
graphite Android-style model with a centered camera lens, machined frame and
side controls. Distinct full-bleed manifesto, preview-lab, immersive scroll,
data-ledger and oversized footer compositions replace the previous layouts.

The Personal/Company controls switch between labelled sample ledgers; they
change actual panels, accessible pressed states and status text without
calling a service or pretending to operate a live account. Native mobile
navigation and FAQ disclosures work without JavaScript. Preview/disclosure
changes invalidate the existing scroll scheduler's cached layout, so the
four-stage phone story remains aligned. Reduced-motion, short-screen and
no-JavaScript fallbacks remain readable. All four static phone previews and
both mode ledgers are visible when JavaScript is unavailable.

Both legal pages were visually rebuilt with matching branding, navigation,
skip links, readable metadata and forms. Privacy also has an on-page contents
navigation. Publisher, support address, retention and manual-deletion/no-deadline
boundaries are unchanged. The deletion form still only prepares an email.

Verification at this checkpoint (unit/source/config tools: Node **22.23.3**, npm **11.11.0**):

- `npm test`: **258 passed**, zero failed/skipped.
- `npm run check:source`: **113 source/test files**, zero errors.
- `node website/validate-config.cjs`, CSS parsing, script syntax and scoped
  `git diff --check`: passed.
- The optional `tests/website-browser-smoke.cjs` passed in isolated Chromium
  at the same six desktop/tablet/mobile viewport sizes listed above. Checks
  include all four pinned stages, keyboard-driven preview switching, updated
  story measurements after switching, mobile menu navigation/Escape, FAQ
  keyboard activation, no-JavaScript and reduced-motion states, legal pages,
  screen fit and absence of failed/external resource requests or page errors.
- With optional `--axe` pointing to a separately installed
  `@axe-core/playwright`, **17 settled-state automated scans** returned zero
  WCAG A/AA rule violations for desktop/mobile Personal/Company previews,
  revealed sections/open FAQs, reduced motion and both legal pages. Initial
  scans exposed low-contrast decimals/budget text and an invalid footer label;
  these were fixed and the full checks rerun. This is not a comprehensive
  accessibility certification, manual screen-reader or real-device test.

No project dependency was added for browser/axe checks. Screenshots of the
hero, phone story, personal/company compositions, data section, footer and
legal/mobile layouts were visually inspected. Safari/Firefox remain untested.
The isolated browser/axe harness used the host's Node **25.8.1**; production
deployment and project checks used the pinned Node 22 toolchain.

Publication used the existing Firebase CLI with **`--only hosting`**. A final
intentional Hosting release added content-derived cache keys for the changed
stylesheet, scripts and brand asset. `firebase.json` now makes the root and
HTML pages revalidate instead of staying fresh for an hour; existing security
headers and deployment exclusions are preserved. The cache-key unit test
requires updating the HTML `?v=` values when those resource bytes change.

Independent public HTTP reads at **2026-10-05T20:22:09.291Z
(6 October, 01:52 IST)** verified all **19 hosted files** returned HTTP 200
and exactly matched local bytes. The root route matched too, as did all four
content-versioned asset URLs. Root and HTML responses carry
`Cache-Control: no-cache, max-age=0, must-revalidate`. Index SHA-256 at this checkpoint:
`164aff3fea22bf3b89ded2f5d473f31c04fb522975424bd9fa10b024ce80e7fe`.

Main files: `website/index.html`, `website/styles.css`, `website/script.js`,
new `website/experience.js`, both legal HTML pages, new brand/orbital/font
assets, `firebase.json` cache headers and the website test suites. The live
URLs at the top of this report are unchanged. No billing, native build,
Firestore rules/index, Auth setting, EAS, Functions, Storage or real account
data change was made. The app is still not downloadable; Android work stays
paused. All changes remain uncommitted and unrelated work is preserved.

## Resumable handoff — 10 October 2026

Recorded **21:15 IST (Asia/Kolkata)**. Repository:
`/Users/pratik/Documents/GitHub/Project-diploma`; branch `main`, base HEAD
`9d4ac0b3abd786ad2529bdec799f24e1a7a910e3`. Working tree is dirty; these changes
are not committed or merged. Only this report was edited for the handoff.

### Goal

The latest user request was: **“change the whole website and make it
impressive.”** The acceptance target is a distinctive, polished Expenzo
informational website that works at desktop/mobile sizes, communicates the
product honestly, keeps sample UI clearly illustrative, and preserves the
existing privacy/manual-deletion boundaries. Hosting may be updated; Firebase
billing, native builds and the paused Android work must not be resumed
implicitly.

### State

- **Completed and published on 6 October:** The cobalt/ink/ice redesign at the
  three URLs above includes the centered “Money. Minus the mess.”
  hero, graphite Android-style phone, orbital artwork, manifesto, personal and
  company ledger previews, four-stage scroll story, data composition, FAQ,
  matching legal pages and oversized footer.
- **Complete:** Personal/Company mode switching works with keyboard input,
  `aria-pressed`, hidden panel state and status messaging. It is explicitly a
  sample preview and performs no account/service operation. Mobile menu,
  native FAQ details, reduced-motion and no-JavaScript fallbacks work.
- **Completed at the redesign checkpoint:** Content-derived `?v=` keys and
  root/HTML revalidation were verified across 19 files on 6 October. That
  historical file count/hash is superseded by the later access-request work;
  no fresh production read or deployment was performed during this handoff.
- **Later work found in the current tree/reports:** The public page contains the
  email-only APK access-request flow documented in `reports/access-request.md`.
  It submits only to the fixed publisher FormSubmit endpoint after validation,
  reports acknowledgement/uncertain/error states honestly, and never promises
  automatic delivery or creates an account. `reports/access-request.md` records
  publisher activation/notification confirmation and byte verification of
  **23 published files** after its header follow-up. These are that report's
  receipts, not newly repeated live checks. Actual APK sharing is still manual.
- **Current product context:** Hosted AI activation is now the current state,
  as documented in `reports/ai-activation.md`; AI chat/category/receipt-text
  flows were live-tested with a temporary synthetic account, while uploads,
  AI reporting, automated deletion and payments remain disabled. Do not use
  the older disabled-AI wording in the historical sections as the current
  product state.
- **Current verification gap:** The browser rerun could not launch because the
  old temporary Chromium installation has gone. There are also no listeners
  on localhost ports 4173 or 8081 at handoff time. No Safari/Firefox, real-device,
  manual screen-reader or native app test was run for this website task.
- No published downloadable app or store submission is established by these
  reports. Android SDK/build/device work remains paused.
- **Blocked by scope:** A signed app/distribution requires a separate explicit
  decision and authorised build/distribution approach. Do not enable billing or
  deploy Functions/Secret Manager/Storage as a substitute.

### Files

Original redesign ownership:

- `website/index.html` — complete public page structure, sample ledgers, mode
  controls, phone screens, FAQ, honest release scope and cache-keyed assets.
- `website/styles.css` — new visual system, responsive compositions, phone
  hardware, static/pinned story states, legal-page styling and contrast fixes.
- `website/script.js` — preserved motion scheduler plus hero-depth and layout
  invalidation support.
- `website/experience.js` — progressive Personal/Company preview controller,
  native mobile-menu/FAQ layout notifications and keyboard-safe interactions.
- `website/privacy.html`, `website/account-deletion.html` — matching branded
  legal pages; deletion remains email preparation only.
- `website/assets/expenzo-mark.svg`, `website/assets/ledger-orbits.svg` and
  `website/assets/fonts/` — local brand/art/font resources and licenses.
- `firebase.json` — Hosting-only cache headers for root/HTML revalidation.
- `tests/website-core.test.cjs`, `tests/website-experience.test.cjs`,
  `tests/website-motion.test.cjs`, `tests/website-browser-smoke.cjs` — static,
  interaction, motion, browser, no-JS and optional axe coverage.
- `reports/spark-core-release.md` — this release record and current handoff.

Later/other work, inspected and preserved rather than attributed to this redesign:

- `website/access.js`, `website/access-header.js`, `website/public-config.js` and
  `website/validate-config.cjs` — APK access requests and fixed FormSubmit routing.
  That work also changes the shared index, CSS, privacy and browser tests.
- `tests/website-access.test.cjs`, `tests/website-access-header.test.cjs` —
  access form validation/acknowledgement and scroll-handoff coverage.
- `reports/access-request.md`, `reports/ai-activation.md` — later publication
  and hosted-AI evidence that supersede older disabled-feature statements.
- `reports/ui-theme-fix.md` — separate app theme/navigation work with native
  visual checks still outstanding. Its old failing unit-test checkpoint is
  superseded by today's full 338-test pass, not by a new native visual check.

The repository also contains a large set of unrelated uncommitted app,
backend, native, configuration and asset changes visible in `git status`.
They predate or sit outside this website handoff and must be preserved. The
current branch is `main`, revision `9d4ac0b3`; no commit or push was made.
Both redesign agents finished and their visual/interaction changes were
integrated; there is no unresolved agent task to resume.

### Decisions

- Keep the informational/product-preview distinction and labelled sample INR
  data. Preserve the later access-request form without promising automatic APK
  delivery. Access submission (FormSubmit) and deletion requests (mailto) are
  different flows.
- Keep Firebase on Spark and perform a Hosting-only deployment. Do not change
  Firestore rules/indexes, Auth settings, EAS, Functions, Storage or account
  data for visual work.
- Keep email/password/Auth, owner-isolating Firestore, owner-only company
  records, disabled photo uploads and manual deletion wording accurate.
- Keep AI/provider/backend claims consistent with the current top-of-report
  AI activation note and `README.md`; do not infer a native app release from
  the website preview.
- Use native disclosure controls and progressive enhancement. JavaScript may
  hide inactive mode panels only after the complete valid control pair binds;
  no-JavaScript must show both panels and all four phone screens.
- Use local licensed fonts only. Do not add runtime font/CDN dependencies.

### Checks

**Current tree, 10 October**, from the repository root, using this exact command:

```sh
npx --yes --package=node@22.23.3 --package=npm@11.11.0 -c 'npm test && npm run check:source && node website/validate-config.cjs'
```

- **Tests — passed:** 338 passed, 0 failed/skipped, including later access work.
- **Lint/source — passed:** 145 source/test files, 0 errors. `npm run lint` is
  an alias for the executed `npm run check:source`; not a separate extra run.
- **Typecheck — missing:** no dedicated project typecheck script. Source and
  JavaScript syntax checks are not a substitute for a typecheck.
- **Build — not run:** the static site needs no compilation; native/signed
  builds remain paused. Backend/EAS exports were not rerun for this handoff.
- **Configuration — passed:** public legal/access-request configuration present.
- **Syntax — passed:** `node --check` on `website/access.js`,
  `website/access-header.js`, `website/experience.js` and `website/script.js`.
- **Whitespace — passed:** `git diff --check -- website tests/website* firebase.json reports/spark-core-release.md`.
- **Browser/accessibility — blocked:** the rerun below failed before page load
  with a missing `chromium_headless_shell-1243/.../chrome-headless-shell` binary.
  The obsolete temporary output directory also no longer existed; moving
  output into the current approved temp directory exposed the binary error.

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/var/folders/lz/fl1lj6rn7d15zl8b6j_3pmzc0000gn/T/opencode/expenzo-preview-browsers node tests/website-browser-smoke.cjs --playwright /Users/pratik/.npm/_npx/e41f203b7505f1fb/node_modules/playwright --axe /Users/pratik/.npm/_npx/45ade96657b89d26/node_modules/@axe-core/playwright --output /var/folders/lz/fl1lj6rn7d15zl8b6j_3pmzc0000gn/T/omnirush/expenzo-handoff-browser
```

**Historical evidence only:** the 6 October redesign passed 258 tests, source
checks, six viewport/browser flows and 17 axe scans. Its 19-file byte/hash
receipt above belongs to that checkpoint. `reports/access-request.md` records
later browser/axe passes and a 23-file publication; `reports/ai-activation.md`
records live synthetic-account AI verification. None of those live operations
was repeated for this handoff. Do not roll back those additions based on the
old disabled-AI copy or redeploy the old 19-file snapshot.

### Next step

For the next website-verification session, **restore the isolated Chromium
installation and rerun `tests/website-browser-smoke.cjs` against the current
tree**. No service is currently listening on 4173 or 8081 (`lsof` checked);
start `python3 -m http.server 4173 --bind 127.0.0.1 --directory website` from
the repository root. Install Chromium for the cached Playwright package into
the current approved temp folder, then use that same `PLAYWRIGHT_BROWSERS_PATH`
for the test. Preserve the browser test's synthetic response interception;
verification must not send fresh real access emails.

No deployment is needed merely to resume. For a requested further visual edit,
preserve access/AI/privacy additions, refresh content-derived asset query keys,
run checks, and review the local-versus-live changes before a Hosting-only
publish. APK/AAB work needs a separate explicit build/distribution decision.
