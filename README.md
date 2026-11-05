# Expenzo

Personal and company expense tracking and INR budgets on Firebase's **Spark
free tier**, with optional AI served by **EAS Hosting**. AI is enabled separately
by `AI_FEATURES_ENABLED`; `SERVER_FEATURES_ENABLED = false` still keeps cloud-photo
uploads, AI reporting and automated account deletion disabled.

Personal and company screens retain the original gradient/glass design, including
finance forms, history, reports, profiles, settings, themes and floating tabs.
**Home → Ask Financial AI** opens the restored interactive chat client with drafts,
question shortcuts, explicit sharing consent (asked once per account, remembered on the
device until revoked or sign-out) and send/retry/cancel.
The hosted API requires Firebase sign-in and explicit sharing consent. Chat stays
in memory and resets on account changes or Clear chat. Add Transaction also offers
consented category suggestions and receipt-text parsing with review before Save.
Home and Budget show accurate on-device budget/spending recommendations without
provider requests. Provider keys never enter the app bundle. Unimplemented
backup/payment/upload/security extras remain honestly labelled.

**Live:** the authenticated EAS AI API, Firestore owner-isolating rules/indexes and the informational website
at https://project1-7a465.web.app. Privacy and manual deletion-request pages are
hosted there. **Not live:** a downloadable app or browser expense-tracking app.
The website’s **Get access** form sends an email-only request to the publisher
through activated FormSubmit. APK sharing remains manual; no automatic download
or account creation occurs. See `reports/access-request.md` for checks.
No signed build was made or device-tested; Android work is paused by request.
See [`reports/ai-activation.md`](reports/ai-activation.md) for current AI verification,
and [`reports/spark-core-release.md`](reports/spark-core-release.md) for earlier
deployment history. This is **not certified for Google Play release**.

## Reproducible local setup

- Node **22.23.3** (`.nvmrc`), npm **11.11.0**; use a per-project Node manager.
- Java **21+** for Firebase emulator tests; CI uses Java 21.
- Android SDK/build tools and a device for native Android testing; Xcode and
  CocoaPods for iOS. Expo Go cannot exercise Google sign-in or native App Check.
- Preserve lockfiles. Do not run `npm audit fix --force` or downgrade Expo to
  the old versions suggested by inherited dependency advisory paths.

```sh
npm ci
npm ci --prefix functions
npm test
npm run lint
npm run test:backend
npm run test:rules
EXPO_NO_DOTENV=1 APP_VARIANT=test npm run check:expo
```

`npm test` runs isolated unit tests. `test:rules` separately starts only the
Firestore/Storage emulators for **demo-expenzo**; it refuses live project and
non-loopback emulator settings. Neither suite needs real accounts or a paid AI
provider. No SDK installation or native build is part of this core setup.

The root postinstall applies a version-checked RNFirebase 26.4.0 App Check patch
so token requests await asynchronous native initialization. Its regression tests
use the installed SDK source. Review/remove the patch when upgrading RNFirebase;
do not bypass a patch mismatch error.

## Public and private configuration

Use `.env.example` as the public configuration inventory. Local Expo development
can use an ignored `.env`; command-line validators and native setup scripts
expect values exported in their process environment. CI/EAS deliberately do not
read `.env`. Only names in `scripts/public-env.cjs` may enter the client bundle.

- The existing registered Firebase **Web** app supplies the public identifiers
  for JS Auth/Firestore. They were provisioned in EAS project **@pratik2467/Expenzo**,
   development, preview and production environments, along with the support/publisher/retention/hosted URLs.
  Public API keys are not authorisation controls; the deployed rules enforce access.
- Email/password sign-in is configured. Google sign-in has no production OAuth
  variables and honestly remains unavailable; existing Google-only users need a
  linked email/password method or future verified OAuth setup.
- Core release configuration needs **no Storage bucket, backend URL, provider
   metadata or native App Check file** for finance-only use. Live AI needs its
   separate public URL. Supplied optional native/OAuth values are
  still checked. Core startup does not register backend App Check or create Storage.
- `AI_API_BASE_URL` is the public hosted AI endpoint, currently
  `https://expenzo-ai-pratik2467.expo.app/api`. It is configured locally and in
  EAS development, preview and production environments. Missing/unsafe URLs fail
  before tokens or network. A leftover `API_BASE_URL` cannot enable deletion or reporting.
- Never put NVIDIA/Hugging Face/provider secrets in public build variables.
  The publisher reports that prior builds/key were never shared and elected to
  leave the old local key unchanged during the core restoration. During hosted
  AI activation the publisher updated the local NVIDIA key after inference was
  rejected. The replacement is configured as a server-side sensitive EAS variable,
  never a public import. Review rotation if any earlier key exposure is suspected.

Unconfigured builds show setup/unavailable messages. `npm run check:release`
validates **core configuration**, not a deployed app, legal compliance or store
approval. The dormant backend validation can be tested explicitly with
`node scripts/validate-release-config.cjs --production --server-features`.
Do not enable direct JS Firestore App Check enforcement without a tested adapter.

## Native workflow

Android is generated by Expo/EAS from `app.config.js` and `app.json`, with SDK 36
target/compile settings and broad camera/media/audio permissions blocked. Inspect
the actual merged release manifest and native libraries before publication.

iOS is **manually maintained in git**. `npm run ios` synchronizes reviewed plist
settings before building; EAS runs the same synchronization in its post-install
hook. Install updated CocoaPods after dependency changes. Do not run a destructive
`expo prebuild --clean` over the tracked project. Keep App Check provider setup
before `FirebaseApp.configure()`, static Firebase frameworks and the validated
native-file build phase. Expo Doctor's non-CNG warning is still visible; native
compilation/device checks must establish correctness.

## Backend and publication

Firestore rules/indexes and Hosting were deployed to **project1-7a465**. Rules
were independently read back byte-for-byte; all eight indexes are READY,
including the preserved uppercase `Transactions` index. The prior broad
authenticated-user rules were saved outside git before deployment. No existing
finance documents were read/changed, no legacy migration was performed, and no Storage
rules or Functions were deployed. Stricter schemas may expose malformed legacy
records that need separate review rather than bypassing ownership checks.

The free plan cannot deploy the existing Functions/Secret Manager architecture.
The publisher chose EAS Hosting for AI while keeping Firebase Spark; no Blaze
billing was enabled. The separate `ai-host/` API uses verified Firebase ID tokens
and rule-bound Firestore REST reads/reservations, without an admin service-account
key. Native navigation and dependencies stay unchanged. See `ai-host/README.md`
for deployment and `reports/ai-activation.md` for verification. Existing Functions
code/tests remain dormant; do not deploy them using the core instructions.

Public pages:
- https://project1-7a465.web.app/privacy.html
- https://project1-7a465.web.app/account-deletion.html

Publisher: **Expenzo**. Support: **pratikchittroda@gmail.com**. Data is retained
until individual records are deleted or the publisher processes a verified
deletion request. Requests are manual with **no guaranteed turnaround**; the
publisher's “until I delete it” response was not rewritten as a made-up deadline.
The form prepares a mailto email, never submits/deletes anything itself. The
publisher must monitor the inbox, verify ownership and remove **both** owned
Firestore documents (including daily AI usage counters) and Firebase Auth identity; removing a profile or Auth user
  alone does not delete the other records. Do not request passwords or tokens.

To redeploy reviewed core changes after tests (this changes production):
```sh
node website/validate-config.cjs
firebase deploy --only firestore:rules,firestore:indexes,hosting --project project1-7a465
```
Never use an unscoped `firebase deploy` for this free-plan release. Public legal
pages and a database are **not** a downloadable app or Google Play certification.
The support process, real application login/finance flows and any later signed
build still require human/end-to-end verification.

## Data behaviour and limits

- Amounts remain numeric INR major units in Firestore; calculations use paise.
  Date-only ledger entries keep their calendar date. Periods are local-calendar
  week/month/year to date; weeks start Monday and range ends are exclusive.
- Summaries use complete owner snapshots, not 20-row history pages. History
  paginates separately. Very large ledgers still need measured aggregation work.
- Budget saves/renames/archive operations synchronize three periods atomically.
  Canonical records and archive markers shadow legacy duplicates without a
  destructive migration. Old clients must not continue writing incompatible data.
- Salary records are owner/member/month-idempotent; recording an expense does
  **not** transfer money. Retire old random-ID salary clients before a rollout.
- AI requests need affirmative consent. The EAS API persists no question, answer,
  receipt or chat history; it stores only daily usage counters. Limits are **20
  requests per account/day and 200 service-wide/day**, on UTC days. Provider/host
  quotas and policies also apply. Existing uploaded HTTPS images may be displayed,
  but photo uploads and new image fields remain unavailable.
- Spark quotas apply to the project; large ledgers/full snapshots can consume
  daily reads quickly. Monitor usage. No load test or native device test is claimed.
