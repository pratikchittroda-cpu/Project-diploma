# Expenzo — hosted AI activation

Date: **6 October 2026, Asia/Kolkata**. This supersedes the previous core/UI-only
disabled-AI state. Source changes remain uncommitted; unrelated workspace changes
were preserved. No signed APK/AAB or native device test was performed.

## Result

- **Financial chat:** interactive in both ready account types, explicit
  conversation consent, bounded recent history, full answer, retry/cancel/clear.
  Hosted responses use server-verified complete month-to-date owner aggregates.
- **Budget/spending recommendations:** restored on personal Home and personal/
  company Budget screens. These are the original kind of local recommendations,
  not LLM replies: paise arithmetic, saved recurring limits, future exclusion,
  local-day keyword reviews and full previous-month comparisons.
- **Category suggestions:** Add Transaction → AI assistance → sharing consent →
  Suggest category → review → Use suggested category. Account-specific expense
  categories are validated. Local fallback is labelled local, never AI.
- **Receipt-text parsing:** paste receipt text, choose sharing consent, parse,
  select/review a line item and apply it to the **unsaved** draft. INR unit prices
  multiply integer quantities using paise; normal Save is the only ledger write.
  This is text parsing, not photo scanning/OCR.

## Deployed configuration

Public base URL: **https://expenzo-ai-pratik2467.expo.app/api**.
Verified immutable deployment: **https://expenzo-ai-pratik2467--e5xwgf1vvz.expo.app**.

The separate `ai-host/` Expo SDK 57 API-only project uses the existing
`@pratik2467/Expenzo` EAS project. EAS Hosting runs the API; EAS Build remains the
APK builder. The hosted service does not depend on the Mac staying on.

`AI_FEATURES_ENABLED = true` is separate from the still-false
`SERVER_FEATURES_ENABLED`: uploads, AI reporting, automated deletion, payments
and other unimplemented extras were not enabled. Firebase remains on Spark;
Functions/Blaze/admin service-account credentials were not introduced.

The old NVIDIA value returned HTTP 403 for inference. The publisher updated the
ignored local key, and a synthetic inference request then returned HTTP 200.
The replacement is a **sensitive server runtime EAS variable**, not an
`EXPO_PUBLIC_` value or client import. No key was printed or copied into source.
Hugging Face was not activated because these features use NVIDIA.

The public URL and public Firebase/build configuration are present in EAS
development, preview and production; the provider key was not copied into the
development/preview environments. Already-installed binaries still need a new
build for the changed client and URL.

## Verified access and runtime fixes

- Firebase checks use Google's authoritative lookup of the exact incoming ID
  token, plus issuer/project/expiry/revocation and owner profile checks.
- Firestore REST carries that same user token; it does not bypass owner rules.
  Raw ledger descriptions and employee/account identifiers do not enter chat
  provider context. Submitted category/receipt text is sent only with consent.
- Daily request counters are capped at **20/account and 200/service**, on UTC
  days. Atomic commits pair both counters with snapshot version/existence
  preconditions and server timestamps; rules deny resets/deletes/extra fields.
  Failed/cancelled provider attempts consume a reservation. No automatic provider
  retry occurs; only proven atomic precondition conflicts can retry before it.
- Actual cloud testing exposed EAS origin handling, unsupported `redirect:'error'`
  in its fetch adapter, and Firestore's rejected server `beginTransaction` RPC
  for user tokens. Same-origin access remains authenticated; manual redirect mode
  explicitly rejects redirects without following them; optimistic atomic commits
  replace the server transaction RPC without loosening finance rules.
- No question, answer, receipt text, history or consent is persisted by the API.
  Daily counters remain until publisher cleanup; no automatic retention job is
  claimed. Infrastructure and provider policies also apply.

## Actual verification

Checks used **Node 22.23.3 / npm 11.11.0**:

- `npm test`: **318 passed**, no failures/skips. Covers chat consent, stale
  sessions, duplicate locks/cancellation, category/receipt review, exact-paise
  draft application, complete finance context and local recommendations.
- `npm run check:source`: **142 files, zero errors**.
- `npm run test:backend`: **34 passed**; existing Functions remain undeployed.
- `npm run test:rules`: **15 passed** on loopback `demo-expenzo` Firestore/Storage
  emulators, including the actual hosted REST adapter, paired counter caps,
  no-reset/delete protections and existing ownership/finance regressions.
- `ai-host`: Expo SDK compatibility and API-only web export passed. Four API
  routes were exported; the final hosted API deployment succeeded.
- `eas env:exec production 'node scripts/validate-release-config.cjs --production'`:
  passed. Independent EAS environment reads confirmed the public URL and Firebase
  identity in all three build environments, without printing credential values.
- Production-configured iOS Expo/Hermes export: **1,193 modules / 38 assets**.
  A byte scan of the bundle/metadata found the public hosted URL and **neither
  local NVIDIA nor Hugging Face key**. The separate host and local/debug inputs
  are excluded from the native EAS archive. This is not a signed native build.
- Scoped whitespace and public legal configuration checks passed.

### Real cloud verification

After the runtime/atomic-commit fixes, running
`node scripts/smoke-hosted-ai.cjs --live-synthetic-account` verified the complete
**EAS → Firebase Auth/Firestore → NVIDIA** path:

- Chat: **HTTP 200**, nonempty full answer and verified complete empty-ledger context.
- Category suggestion: **HTTP 200**, valid personal `food` classification.
- Receipt parsing: **HTTP 200**, one reviewed item, quantity 3 and INR unit price
  12.35, preserving the intended 37.05 line total.
- Missing consent was rejected before inference; an invalid token returned 401.
- The temporary synthetic profile, account-owned usage documents and Firebase
  Auth account were removed after every test. No existing account's finance data
  was read or changed. The aggregate global request count was preserved.

Live tests used a personal synthetic account and no populated ledger. Company
category/profile scoping and nonempty/large ledgers are covered by automated
fixtures, not claimed as live company/device verification.

The deployed Firestore rules were independently read back and matched the local
file: SHA-256 `e5c79cdd9a129de4d07c27cf185f3e50e6d0c81b3611f00113948b2ce19c6197`.
Only `privacy.html` and `public-config.js` were updated on Firebase Hosting to
describe the optional AI transfers/retention. All **21 published file bytes**
were verified; the other **19 files stayed unchanged**, preserving unrelated
website work. The failed preliminary legal deployment never replaced the live
version; its API-header/CLI-config format mismatch was corrected before release.

## Try it and remaining work

1. Reload the current native development client. Sign in with email/password.
2. Home → Ask Financial AI → choose sharing consent → ask/send. Test cancel,
   retry, clear and back/privacy navigation.
3. Add Transaction → AI assistance → consent → category or pasted receipt text.
   Review before applying; manually check the unsaved draft before Save.
4. Home/Budget → local insights with a complete ledger and saved budgets. No
   provider consent is needed for on-device calculations.

For a standalone Android app, build the existing **preview APK** profile after
approval and install/test that new binary. Old installed APKs do not acquire this
new client code automatically. Android work remains paused; **no build was
started**. Native tap-through, small-screen/large-font checks, provider/hosting
load/usage monitoring, and store/legal compliance remain unverified.

The support deletion procedure must include account-owned `aiUsage/<uid>/days`
documents as well as finance records/profile/Auth; aggregate usage can remain.
No real user deletion or inbox handling was exercised. No automatic backup,
payment, upload, AI reporting or account-deletion feature is implied by activation.
