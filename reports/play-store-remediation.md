# Expenzo remediation and release handoff

> **Latest core deployment:** [spark-core-release.md](spark-core-release.md)
> supersedes the older “not deployed” and all-feature configuration statements
> below. Firestore rules/indexes and Hosting are now live on Spark; server features
> and photo uploads are disabled. The app itself was not built/distributed.
> Publisher reports no prior key/bundle sharing and chose not to rotate the key.
> Earlier audit results/rotation cautions below remain historical evidence.

> **Follow-up, 5 October 2026 (Asia/Kolkata):** Functions advisories were reduced
> again from 9 to **3 high**, with **0 production advisories**. Publisher/contact
> values were saved and independently read back from EAS production. Firebase
> Secret Manager requires a Blaze upgrade; no billing upgrade, key rotation or
> deployment was performed. The user chose **Keep free plan**, so the Functions/
> Secret Manager deployment path is now paused rather than awaiting permission to
> upgrade. **Android SDK/build/device work is stopped at the
> user's request.** See the follow-up section below; earlier results are retained
> as a dated baseline, not overwritten as if rerun.

Updated: **4 October 2026, Asia/Kolkata**. Base: `main`, `9d4ac0b3`.
Changes are local and uncommitted. No deployment, native release, publication,
live-account mutation or key rotation was performed. The unrelated `.DS_Store`
modification was preserved.

## Result

The audited source defects have substantial repairs and automated coverage.
**Not yet ready to publish:** native/device verification, production provisioning,
exposed-key rotation, publisher/legal details and unresolved dependency advisories
remain open. Passing mocks, emulators and a Hermes export does not certify Play
readiness. Do not distribute the unconfigured test export.

## Implemented changes

- **Account/session flows:** auth-dependent personal/company navigation, wrong-type
  sign-out/blocking, idempotent missing-profile recovery, stale-session guards,
  real password reauthentication/update, and callback-safe queued messages.
  Shared implementation is in `components/account/`, `contexts/AuthContext.js`,
  `services/authService.js`, `navigation/AppNavigator.js` and the message hooks.
- **Finance:** complete account snapshots separate from paginated history;
  integer-paise arithmetic, local date-only periods, strict field validation,
  honest load/error/empty states, awaited refreshes and account-race protection.
  Canonical budget transactions synchronize all three periods and preserve legacy
  records behind archive markers. Salary generation uses deterministic IDs and
  reports created/skipped/failed outcomes. See `utils/finance*.js`, finance hooks,
  services and `components/finance/`.
- **Security/backend:** provider credentials/direct requests removed from the
  client; a restricted public-environment compiler prevents secret imports and
  `process.env` bypasses. Authenticated HTTP APIs enforce App Check, strict schemas,
  per-user/global transactional quotas, deadlines and safe error handling. Owner
  context is derived server-side; paid requests are never automatically retried.
- **Deletion/data isolation:** versioned Firestore/Storage rules/indexes, immutable
  ownership and roles, server-owned deletion jobs with write locks, resumable
  batches, Storage cleanup and Auth removal last. Scheduled retries survive app
  closure. Profile photos now upload to one owner Storage object; local temporary
  images and account-scoped preferences/AI consent are cleaned up.
- **AI/privacy:** consent and withdrawal, bounded recent-chat excerpts, server-local
  timezone context, real response reporting and retention workers. In-app privacy
  text and website drafts now match cloud photos, native attestation and report
  expiry. Client/server legacy rounding is regression-tested together.
- **Truthful UI:** simulated backup/billing/security controls, fabricated metrics
  and the nonexistent scanner entry are removed from protected navigation or
  replaced with honest unavailable screens. Real profile editors and shared
  finance/account screens replace the broken prototypes. Accessibility roles,
  labels, safe areas, dark-mode flags and paise formatting were added; physical
  device/contrast checks still matter.
- **Build/reproducibility:** Expo 57 / RN 0.86.3 / React 19.2.3; API 36 configuration;
  Node 22.23.3/npm 11.11.0; native Google sign-in and on-demand RNFirebase App Check.
  Missing provisioned native identity fails closed. Android is generated; iOS is
  tracked with explicit sync/native initialization and static Firebase linking.
  CI, isolated tests, source checks, release validators and `README.md` are added.

## Fresh checks

Commands ran from the repository root under Node **22.23.3**, npm **11.11.0**,
using `npx --yes --package=node@22.23.3 --package=npm@11.11.0 -c '…'` to avoid
changing the host's global Node 25 installation. Emulator Java was 25.0.2; CI
uses Java 21. Every test below is local/synthetic, not a production smoke test.

- `npm test`: **78 passed**, none failed/skipped. Includes auth/message/image
  tests, App Check installed-SDK patch tests, complete-ledger/race/idempotency
  tests, and actual client/server AI-schema/rounding compatibility tests.
- Finance/client integration subset repeated with `TZ=Asia/Kolkata` and
  `TZ=America/Los_Angeles`: **35 passed in each zone**. Complete-ledger cases cover
  0, 1, 20, 21, 45, 100 and 1,000 entries; these are mocked service tests.
- `npm run test:backend`: **28 passed**, none failed/skipped. Includes authentication,
  quotas, provider failures/output validation, retention and 6,001-record deletion
  resumability using isolated doubles.
- `npm run test:rules`: **12 passed**, none failed/skipped, only `demo-expenzo`
  Firestore/Storage emulators. Includes cross-account denials, deletion locks,
  real transactional quota concurrency and 805-record/Storage deletion. Java 25
  emitted a deprecated Unsafe warning; the suite exited successfully.
- `npm run lint`: **104 files checked, zero errors** (syntax, imports, unbound
  JSX identifiers, hook rules and environment usage). No whole-app typecheck is
  claimed; this is predominantly JavaScript.
- `EXPO_NO_DOTENV=1 APP_VARIANT=test CI=1 npm run check:expo`: **passed**.
- Same environment, `npm run doctor`: **20/21 passed**, one non-CNG iOS config-sync
  warning remains. It was not hidden or described as a full pass.
- Same environment, `npm run export:android -- --clear`: **passed**, 1,182 modules,
  approximately **4.6 MB** Hermes bundle in `.expo/release-export`. This is not an
  APK/AAB, and no native library/signing/16 KB conclusion follows from it.
- Generated-output scan: **39 files**, zero matches for a synthetic provider-secret
  sentinel, direct NVIDIA completion URL or NVIDIA/Hugging Face environment names.
  The build disabled local dotenv. This is not a scan of a signed production
  artifact or proof that an earlier exposed key has been revoked.
- `EAS_BUILD_PLATFORM=android npm run check:release` with no provisioned environment:
  **correctly blocked**, listing missing public/native/legal configuration.
- `node website/validate-config.cjs`: **correctly blocked** on missing publisher,
  contact, hosted URLs, effective date and operational/provider retention details.
- `git diff --check`: **passed**. No commit/push/deploy was run.
- `ruby -c ios/Podfile`, plist/entitlement/Xcode-project `plutil -lint`, and website
  JavaScript syntax checks: **passed**. These do not compile or run native code.

## Dependency risk: reduced, not eliminated

Fresh `npm audit --json` results are affected package-tree entries, not distinct
exploitable app vulnerabilities:

- App: **19 high**, zero critical/moderate/low.
- Functions including tooling: **9** (7 high, 2 moderate), zero critical.
- Functions `npm audit --omit=dev --json`: **zero** reported advisories.

The remaining app paths include Expo/Metro tooling around `node-forge <=1.4.0`
([GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)) and
`braces <=3.0.3` ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)).
No compatible patched npm release was found for those underlying packages during
this work. Functions tooling also includes `basic-ftp` and OpenTelemetry core
paths whose available fixes require dependency-major overrides. Unsafe forced
downgrades/overrides were not applied just to make the audit green. Scope and
exploitability must be assessed before release; tooling issues are not irrelevant
merely because they are not runtime UI code.

Compatible scoped gRPC fixes, existing Busboy/UUID overrides and an in-range RE2
update were applied. The dependency worker verified a Functions clean install,
root lockfile dry run, native RE2 and gaxios/Firestore/Busboy import smoke checks
under Node 22. No safe fix is claimed for the remaining advisories.

## Audit finding disposition

The original 46-item audit remains the baseline. "Implemented" below means
source/local-test remediation, not production verification:

- **01:** client exposure path removed and synthetic export checked; revocation
  of the already exposed key is still required.
- **02, 37:** coherent runtime/API upgrade and Expo alignment implemented;
  signed-AAB, native-module and 16 KB compatibility verification remains.
- **03, 04, 20, 46:** rules/indexes, auth/App Check/quotas, durable deletion and
  strict schemas implemented/tested; deployment/IAM/real-device behaviour remains.
- **05–08:** privacy entry, external email-request draft, AI disclosure/consent
  and report API/UI implemented. Real legal details, hosting, provider terms and
  staffed report/deletion handling remain production requirements; AI defaults off.
- **09–19, 21–23, 26–33:** callback, auth/navigation, hooks, financial completeness,
  currency/dates, input, budget/salary atomicity, refresh and empty/error behaviour
  repaired. Simulated security/backup/scanning and fabricated metrics removed.
- **24–25:** cloud profile upload and real editors/settings implemented; fake
  billing/security/backup claims removed. Cross-device photo and release sign-in
  still need physical-device testing.
- **34–35:** native Google flow and raw production log removal implemented;
  Play certificate/OAuth validation and platform log-retention setup remain.
- **36:** substantially reduced, with the unresolved advisories above.
- **38–40:** tracked non-secret configuration, setup/CI/regressions/error boundary,
  public-env guards and permission minimisation implemented. Release-manifest
  inspection, device tests and operational crash/ANR monitoring remain.
- **41–43:** tracked iOS sync, tab/control accessibility/safe-area improvements,
  consistent dark-mode and paise presentation implemented. Doctor's native-config
  warning, native compilation, TalkBack/font scaling/contrast remain open checks.
- **44:** EAS exclusions improved. The pre-existing unmapped `Project-diploma`
  gitlink and tracked `.DS_Store` were **not removed** without confirming repository
  intent. They are excluded from build uploads. No index cleanup was performed.
- **45:** obsolete integration/example/helper files removed; GlassCard now has
  explicit platform behaviour. No native visual acceptance test is claimed.

## Before any public release

1. **Revoke the exposed provider key now** in the provider account and examine
   usage. Provision only a replacement server secret; never copy it into the app.
2. Supply the actual publisher name, monitored support email, public policy and
   deletion URLs, retention/processor terms and native Firebase configuration
   through the appropriate private/build settings. Follow `README.md`; do not
   paste secrets into chat. Validate/host the website drafts and test mail handling.
3. Compare and deploy reviewed rules/indexes/functions to the intended Firebase
   project with explicit authorisation. Verify App Check registration/attestation,
   function IAM, schedulers, quotas, deletion retry/retention monitoring and report
   review. Keep AI disabled until these operations and disclosures are in place.
4. Resolve or formally assess the remaining dependency advisories. Retire old
   clients writing random salary IDs/duplicate budgets before introducing the
   stricter schema. Large-ledger snapshot costs and malformed legacy-data repair
   need real staging evidence; no destructive migration was run here.
5. Build/install the actual signed AAB on the Play internal track. Neither `adb`
   nor `sdkmanager` is available on this host. Verify API target, permissions,
   backup/extraction behaviour, native 64-bit/16 KB alignment, OAuth/App Check,
   fresh/revoked sessions, account switching, deletion after network loss,
   photo replacement and all accessibility/layout flows. Reinstall updated iOS
   pods and test its signed build separately.
6. Complete the original audit's Play Console checklist: identity/testing access,
   listing/screenshots, Data safety, financial features, content rating/audience,
   app access/reviewer accounts and staged rollout/ANR/crash monitoring.

**Next action:** supply/verify production public/native/legal configuration in a
staging environment and rerun `EAS_BUILD_PLATFORM=android npm run check:release`.
Do not treat this handoff or the historical visual audit summary as a release
approval. No delegated implementation is still running.

## Follow-up: confirmed release resources and remaining access gates

Date: **5 October 2026**, Asia/Kolkata. The user confirmed the existing Firebase
and EAS projects and supplied publisher **Expenzo** and public support contact
**pratikchittroda@gmail.com**. They then excluded Android SDK work.

### Completed and verified

- Saved the supplied publisher/contact in `website/public-config.js` and
  `.env.example`. Created plaintext project-scoped `LEGAL_ENTITY_NAME` and
  `SUPPORT_EMAIL` in the **production** environment of **@pratik2467/Expenzo**.
  A separate `eas env:list production --format short --scope project` read
  confirmed both names and their expected public values. No private environment
  values were printed or copied into repository files.
- Firebase CLI is signed in. Hosting metadata confirms the existing default
  site **project1-7a465**, live channel URL `https://project1-7a465.web.app`.
  The root URL returned HTTP 404; the channel had no release object in the
  returned metadata. No hosting content was overwritten or published.
- Applied published patched dependencies through tested scoped overrides:
  `@google-cloud/pubsub@5.3.1` → `@opentelemetry/core@2.8.0`, and
  `get-uri@6.0.5` → `basic-ftp@6.2.2`. Files: `functions/package.json` and lockfile.
  These are real dependency replacements, not advisory suppression.
- Added `functions/test/dependency-compatibility.test.cjs` with six reproducible
  regressions for actual PubSub trace propagation, bounded baggage handling,
  malformed FTP listing parsing, and loopback FTP/PAC retrieval/cache/errors.
  `npm --prefix functions test` under Node 22.23.3: **34/34 passed**.
- Dependency worker verified Firebase CLI operation and Firestore/Storage/PubSub
  emulator integration using an isolated demo environment; existing rules suite
  passed **12/12**. No production records/provider requests were used.
- Fresh Functions audit: **3 high**, no other severities; `--omit=dev`: **0**.
  Root audit remains **19 high** per the dependency worker. The remaining
  node-forge/braces advisories have no accepted compatible published patch;
  an open contributor PR was not treated as a verified upstream fix. Chokidar 4
  cannot simply replace the Firebase CLI's glob-based watcher dependency.

### Explicitly not completed

- `firebase functions:secrets:get NVIDIA_API_KEY --project project1-7a465 --json
  --non-interactive` returned: **Blaze (pay-as-you-go) plan required** to enable
  `secretmanager.googleapis.com`. No secret value was requested. Billing was
  not upgraded. Functions listing also failed with a generic list error; this
  is not evidence that no functions are deployed.
- The exposed NVIDIA key is **not verified revoked**. Source containment is not
  rotation. The owner must revoke it at the issuer and supply the replacement
  directly to Secret Manager once available. Never put it into client/EAS public
  variables or this report. No paid NVIDIA requests were made.
- Legal validation still correctly blocks missing provider/log retention terms,
  deletion-response timeframe, effective date and hosted policy/deletion URLs.
  The name/email alone are not a completed privacy policy. No terms, deadlines,
  live URLs or operational review guarantees were invented.
- Production rules/indexes/functions have not been changed. Deploying strict
  rules without comparing current policy and staging compatibility could disrupt
  existing clients; billing also blocks the backend/secrets path.
- Android SDK installation, native builds and device testing are **out of scope
  by user instruction**. Before that instruction, a worker prepared dormant
  `scripts/verify-android-release.cjs`, `tests/android-release.test.cjs` and
  `docs/android-release-verification.md` (20 static fixture tests passed). Those
  files did not install an SDK, build a signed artifact or test a device. No
  further Android work was performed, and no Play-ready claim is made.

**Final user decision:** keep the Firebase free plan. Do not upgrade billing,
provision Blaze-only services or launch a paid build. No alternative server stack
was selected, and secure account deletion/AI backend readiness is not established
for this free-plan deployment. Existing auth/App Check and deletion safeguards
were not removed to bypass the restriction.

**Next required action:** revoke the exposed key at NVIDIA regardless of whether
AI remains disabled; a replacement can wait until an approved server is available.
The publisher must also confirm actual provider/log retention and support-deletion
response timeframe before completing/hosting the legal documents. A future
backend arrangement and native validation require a separate authorised next step.
No Play release readiness or deployment success is claimed.
