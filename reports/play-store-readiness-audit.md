# Expenzo: project audit and Google Play readiness

> **Historical baseline, before remediation.** Source changes and fresh check
> results are recorded in [play-store-remediation.md](play-store-remediation.md).
> The findings below retain their original evidence/line references; they do not
> describe every file's current state. Public release is still blocked by the
> production requirements in the remediation report.

**Verdict: NOT READY for a public Google Play release.**

Audit date: 4 October 2026 (Asia/Kolkata). Project: `com.nustudent.expenzo`, version 1.0.0, Expo SDK 53 / React Native 0.79.6.

The app has a working JavaScript build and real Firebase transaction, budget, authentication, and account-deletion code. However, it currently exposes an AI provider credential in the Android bundle, miscalculates financial information once more than 20 transactions exist, contains misleading simulated features, and lacks essential release/compliance evidence.

## Scope and limitations

- Inventoried 114 tracked entries, including 71 JavaScript files and 28 screens. Reviewed application entry points, navigation, authentication, services, hooks, screen logic, shared UI, Firebase Functions, Android/Expo/EAS configuration, tracked iOS configuration, dependencies, and website.
- Parsed all 71 tracked JavaScript files; checked unbound identifiers, imports, navigation targets, conditional hooks, and selected sensitive-data paths.
- Ran an Android production JavaScript/Hermes export, Expo Doctor, Expo dependency compatibility checks, npm audits for app and backend, and isolated mocked reproductions of selected bugs.
- **No source code was changed.** This report is an added deliverable. The existing `.DS_Store` modification was left untouched. The audit-generated Android export was removed after checking it for a credential. No secret values are included here.
- Did not deploy, publish, create/delete real accounts, call paid AI APIs, run the destructive Firebase connection example, or access production user records.
- No Android SDK/device was available. No signed AAB/APK was built or installed. Google Play Console, deployed Firestore rules/indexes, function IAM, EAS credentials, OAuth console configuration, and production behaviour were not inspected.
- This is a broad source/configuration audit, not a guarantee that every possible defect has been found. Findings labelled **verification gate** require external evidence; missing repository configuration does not prove a production service is insecure.

## Immediate priorities

1. Rotate the NVIDIA credential, remove all provider secrets from the client, and secure the AI backend.
2. Repair authentication/navigation, fake security/backup operations, and financial totals/date handling.
3. Upgrade to a tested Android API 36-capable Expo/React Native release and resolve dependency risks.
4. Add privacy/AI disclosures, an external deletion resource, and AI reporting safeguards.
5. Verify backend isolation and build/test the actual signed Play release before submission.

## Check results

- **JavaScript syntax:** 71/71 files parsed successfully. Syntax success does not detect missing runtime identifiers or incorrect behaviour.
- **Android JS export:** passed using `CI=1 npx --no-install expo export --platform android --output-dir .expo/audit-android-export`; 1,141 modules, approximately 5.04 MB Hermes bundle. This was **not an AAB/native build**.
- **Credential check:** the local NVIDIA key's exact bytes were present in that generated bundle. Values were not printed. A checked Hugging Face key was not found in that bundle.
- **Expo Doctor:** 15/18 checks passed; failures concerned native-config synchronisation, React Native Directory metadata/New Architecture assurance, and package compatibility.
- **Expo compatibility:** AsyncStorage 1.24.0 versus expected 2.1.2; Expo 53.0.26 versus expected `~53.0.27` for the installed SDK line. These patch fixes alone will not satisfy the API 36 upgrade.
- **App npm audit:** 55 affected package entries: 4 critical, 31 high, 19 moderate, 1 low.
- **Functions npm audit:** 20 affected package entries: 2 critical, 6 high, 10 moderate, 2 low.
- **Mocked screen renders:** BillingSubscription, CompanySettings, and EditCompanyProfile each threw `ReferenceError: BlurView is not defined`.
- **Message callback reproduction:** configured caller `onDismiss` ran 0 times; provider hide callback ran once.
- **Mocked backend:** an unauthenticated `/financial-chat` request reached a stubbed provider and returned HTTP 200. No real service was contacted.
- **Mocked salary concurrency:** two simultaneous requests produced two writes for one member/month.
- **Timezone reproduction:** October 2026 statistics boundaries became 30 September–30 October in Asia/Kolkata; a new transaction at 01:00 on 4 October was dated 3 October.
- **Automated suite:** no project test/lint/typecheck scripts or CI were found. Backend `node --check functions/index.js` passed.

## Findings

Severity: **P0** immediate security containment; **P1** resolve before release; **P2** correctness/quality fixes or remove affected feature; **P3** maintenance. A severity is a release recommendation, not a prediction of Google's review outcome.

### 01 — P0: NVIDIA API key is embedded in the Android bundle

**Evidence:** `config/aiConfig.example.js:1-9`, `services/aiService.js:50-77`, `babel.config.js:8-11`, `.easignore:21-22`. The ignored local AI config follows the same client-side import pattern; the generated bundle contained the configured key.

Anyone with a distributed build could extract it and consume the provider account's quota. `.env` and `.gitignore` do not protect values compiled into an app. **Fix:** rotate the key, remove the direct-provider client path and secret import entirely, store the replacement only server-side, authenticate/limit requests, and scan the rebuilt bundle. Treat previously distributed builds containing this key as exposed. Firebase public client identifiers are not equivalent to this provider secret.

### 02 — P1: default Android target is below the current submission requirement

**Evidence:** `package.json:20,35`, `app.json:24-42`; installed `node_modules/react-native/gradle/libs.versions.toml:4-5` sets target/compile SDK 35. No target override or Android native project is present.

Google's current rule requires **API 36 for new mobile apps and updates from 31 August 2026** [S1]. **Fix:** upgrade to a supported, compatible Expo/RN stack targeting at least API 36, then inspect the final AAB. An extension must be confirmed in Play Console; none was verified here.

### 03 — P1 verification gate: database access controls and indexes cannot be audited or reproduced

**Evidence:** `firebase.json:1-5` configures only Functions. No Firestore/Storage rules, Firestore index definitions, or rules tests are tracked. Client services write user-supplied fields and update/delete document IDs directly (`services/transactionService.js:19-26,127-148`, `services/budgetService.js:17-24,84-105`).

Client `userId` filtering is not an authorisation boundary. This is **not proof of open deployed rules**. **Fix:** obtain and version deployed rules/indexes; enforce authenticated ownership, immutable owner IDs, allowed fields/types and account-role restrictions; test cross-user reads/writes/deletes and anonymous requests with emulators. Verify indexes for `userId + createdAt` and date/stat queries.

### 04 — P1: AI backend has no application authentication or abuse controls

**Evidence:** `functions/index.js:8-10,64-208`, `services/aiService.js:29-41`. No ID-token verification, App Check, per-user quota, rate limiting or owner-derived context; browser CORS allows arbitrary origins. Mocked unauthenticated request succeeded.

If deployed publicly, callers can spend the server's AI quota and submit arbitrary context. Deployment/IAM was not checked. **Fix:** verify Firebase ID tokens, add appropriate App Check and rate/cost controls, derive/validate context for that identity, and set bounded provider timeouts/concurrency. CORS is not authentication.

### 05 — P1: no privacy policy or in-app privacy entry point

**Evidence:** source inventory and `website/index.html:1-336`; no privacy policy text/link or privacy screen found.

Accounts, financial entries, names/emails/phone numbers, employee records and AI requests need accurate disclosures. Google requires a public policy URL and in-app policy access [S2]. **Fix:** publish a policy identifying Expenzo/developer/contact, purposes, processors, retention/deletion and security practices, then link it in-app and in Play Console. Actual console declarations are unverified.

### 06 — P1: account deletion lacks the required external web resource

**Evidence:** there are real in-app deletion entry points (`screens/personal/ProfileScreen.js:246-275`, company equivalent `:261-290`) and a deletion service, but `website/index.html` has no external deletion request resource.

Google requires deletion initiation both inside and outside the app [S2,S3]. **Fix:** publish a usable web deletion request process, identify the app and retained-data exceptions/timescales, and enter its URL in Play Console. Do not describe this project as having no deletion implementation at all.

### 07 — P1: financial information is sent to AI without a clear data-sharing disclosure

**Evidence:** `services/aiService.js:195-247,261-317` includes UID, name, email, transaction descriptions, amounts and dates in external AI requests. `screens/personal/AIChatScreen.js:94-125,175-193` does not explain this transfer or offer a consent step.

**Fix:** minimise unnecessary identifiers, disclose provider and transmitted data before first use, obtain affirmative consent where required, document retention/processor terms, and accurately complete Data safety [S2,S4]. Tapping “Ask” is not a substitute for explaining an unexpected transfer of sensitive data.

### 08 — P1: advertised AI chat has no reporting mechanism or adequate safety workflow

**Evidence:** `screens/personal/AIChatScreen.js:204-221` renders answers without report/flag controls; `functions/index.js:52-61` relies on a finance-only prompt, not a moderation/reporting system.

Google’s generative-AI policy covers central conversational AI features and requires in-app reporting for covered apps [S5]. Expenzo advertises AI prominently. **Fix:** provide response reporting, moderation handling and safety tests, or remove AI from this release. Clearly communicate that generated guidance can be wrong; avoid implying verified professional financial advice.

### 09 — P1: global message provider discards completion callbacks

**Evidence:** `components/MessageBoxProvider.js:19-22` spreads the supplied configuration, then replaces its `onDismiss` with `hideMessage`. A mocked reproduction confirmed the caller callback never executes.

Signup navigation (`screens/personal/SignUpScreen.js:167-170`, company `:172-175`), profile-save navigation, transaction-save navigation and deletion redirects rely on that callback. **Fix:** preserve and invoke the caller's callback while dismissing safely; regression-test every completion flow.

### 10 — P1: only the latest 20 transactions are used as the complete ledger

**Evidence:** `hooks/useTransactions.js:5,40-44`; `services/transactionService.js:35-43`. No screen consumes `loadMore` or `hasMore`. Dashboard, Stats, Reports, Budget, transaction lists, CompanyProfile and AIChat all use this hook.

Older entries become invisible and financial totals become incomplete after entry 20. Filtering this partial page by month/year does not produce monthly/yearly totals. **Fix:** use complete, date-bounded queries/aggregations for calculations and actual pagination for history. Test at least 21, 100 and 1,000 transactions across periods.

### 11 — P1: security controls are simulated, including password change

**Evidence:** `screens/personal/SecuritySettingsScreen.js:23-28,82-84,106-111`. Biometrics, 2FA, login alerts and auto-lock only update component state. “Change Password” shows success without calling Firebase, despite a real password-change method existing in `services/authService.js:137-148`.

**Fix:** implement and verify these protections, or remove the claims and controls. A user must never be told their password changed when it did not. Password recovery from the login screen is a separate, real implementation.

### 12 — P1: backup/restore falsely claims data protection

**Evidence:** `screens/personal/BackupRestoreScreen.js:23-27,84-136`. Backup metadata is hardcoded; backup/restore use timers and success messages, with no cloud operation. Provider selection is local state only.

Additionally, Restore supplies custom buttons with no handlers; these override the real callback in `MessageService.showConfirm` (`services/MessageService.js:56-73`). **Fix:** implement a verified export/import/backup process with recovery tests, or remove this screen and associated website claims before release.

### 13 — P1: three registered company screens throw when rendered

**Evidence:** missing `BlurView` and `Platform` imports in `screens/company/BillingSubscriptionScreen.js:175-176`, `CompanySettingsScreen.js:139-140`, and `EditCompanyProfileScreen.js:117-118`. All are registered in `navigation/AppNavigator.js:233-250`; mocked renders reproduced the ReferenceErrors.

The current company profile menu does not visibly link to all these routes, so normal user reachability is not established for each. **Fix:** repair and test them, or remove unused prototype routes/imports. A successful Metro build does not detect these errors.

### 14 — P1: conditional returns violate hook ordering in 10 screens

**Evidence:** hooks appear after loading returns in personal UserType, Login, SignUp, Dashboard, Budget and company Login, SignUp, AddTransaction, Reports, TeamManagement. Examples: `screens/personal/BudgetScreen.js:71-101`, `LoginScreen.js:78-91`, `screens/company/CompanyLoginScreen.js:128,226`.

If a mounted screen transitions from loading to ready, it executes a different number of hooks and can crash. Parent tab guards reduce exposure for some screens but do not make the code valid. **Fix:** run every hook unconditionally before returns, and test slow theme initialisation.

### 15 — P1: logout/session transitions do not clear protected navigation reliably

**Evidence:** `navigation/AppNavigator.js:59-255` always registers protected screens; `components/UserTypeGuard.js:11-66` disables its checks. Personal logout uses `navigate('UserType')` (`ProfileScreen.js:203-239`), leaving prior screens on the stack; company logout replaces only the current screen. Returned sign-out failure objects are ignored. Login rejects the wrong account type *after* signing in without signing back out (`LoginScreen.js:141-150`, company `:146-156`).

**Fix:** use auth-dependent navigator groups/reset the protected stack, handle failed sign-out results, and clear account-scoped caches. Test Android Back, revoked sessions, switching accounts and wrong-type logins. UI guards still do not replace server rules.

### 16 — P1: signup/profile loading races can leave an incomplete account

**Evidence:** `services/authService.js:73-94` creates Auth identity before the Firestore profile; `contexts/AuthContext.js:23-32,48-55` reads the profile on the early Auth event and never explicitly loads it on successful signup. Creation failure has no repair/rollback. Old async profile requests are not checked against the current UID.

**Fix:** make onboarding completion explicit/idempotent, update `userData` after creation, recover incomplete profiles, and ignore obsolete account requests. Test delayed/failed Firestore writes and rapid account switches.

### 17 — P1: UTC/local-date mixing corrupts period boundaries

**Evidence:** `screens/personal/StatsScreen.js:155-166,209,226-227`, `hooks/useTransactions.js:136-140`, `screens/personal/AddTransactionScreen.js:137`, `screens/company/CompanyReportsScreen.js:143-153,219-225`.

In Asia/Kolkata, local midnight converted with `toISOString()` shifts to the preceding date. October statistics include 30 September and omit 31 October. Company reports use a last-day midnight inclusive endpoint, also excluding date-only entries on the final day in this zone. Early-morning new entries use the previous UTC date. **Fix:** define a ledger timezone, preserve date-only values consistently, and use half-open period ranges. Test local midnight, month/year boundaries and DST zones.

### 18 — P1: financial input validation accepts invalid numbers and dates

**Evidence:** `components/budget/AddBudgetModal.js:73-83`, `screens/company/CompanyBudgetScreen.js:264-277`, `TeamManagementScreen.js:146-164,186-200,223-228`, both AddTransaction submit handlers. Company dates are arbitrary text.

`parseFloat('abc') <= 0` is false, so budget validation accepts NaN; Infinity and partially numeric strings can pass other checks. Team salary/budget changes have no finite/positive guard. **Fix:** use strict bounded decimal validation, `Number.isFinite`, defined currency precision, enum validation and real calendar-date validation at the authoritative write boundary, not only in text inputs.

### 19 — P1: concurrent salary generation can double-record expenses

**Evidence:** `services/teamService.js:247-283` checks existing transactions and then uses an unrelated `addDoc`. Two mocked simultaneous calls produced two salary expenses for the same member/month.

**Fix:** use a deterministic owner/member/month document ID and an atomic transaction or server-side idempotency guarantee. Test simultaneous taps, devices and retried requests.

### 20 — P1: account deletion can partially erase data and leave local personal files

**Evidence:** `services/authService.js:193-207,222-249` deletes Firestore data in batches before deleting Auth; there is no resumable server deletion job or final verification. Local profile files from `utils/profileImage.js:43-47` and local preferences/activity keys are not cleaned up. A recent-login failure only displays an error (`ProfileScreen.js:262-265`).

**Fix:** offer provider-appropriate reauthentication, use a retryable deletion workflow, remove account-local files/cache, verify all owned data is removed, and disclose any lawful retention. Test >450 records, failed later batches and Auth deletion failure. An atomic deletion across Firebase products is not assumed possible; recovery is required.

### 21 — P2: duplicate budgets persist and change totals after reload

**Evidence:** `services/budgetService.js:17-24` always adds a new document. Personal `BudgetScreen.js:369-377` does not prevent duplicate category/period budgets. Company `CompanyBudgetScreen.js:294-300` removes an older matching budget from local state only, not the database.

**Fix:** define a unique owner/category/period budget identity and upsert atomically; migrate existing duplicates. Disable repeat submissions while saving. Verify that totals remain identical after reopening the app.

### 22 — P2: synchronised budgets can become inconsistent or hide failed deletions

**Evidence:** personal `BudgetScreen.js:393-612` and company `CompanyBudgetScreen.js:313-481` update periods through independent operations and swallow partial failures. Personal deletion removes *all attempted IDs* from local state when only some deletes succeed (`BudgetScreen.js:633-650,679-697`). Changing category during editing leaves old-category sibling periods behind.

**Fix:** use atomic batches/transactions where suitable, track individual success, reconcile failures, and define category-change semantics. Never report full success for partially applied changes.

### 23 — P2: salary creation failures are reported as successful

**Evidence:** `TeamManagementScreen.js:167-180` ignores the salary-creation result and says “salary recorded”; `services/teamService.js:308-319` returns overall success even if individual members failed. Each salary check refetches all salary transactions, amplifying reads as the team grows.

**Fix:** return/display created, skipped and failed counts separately; preserve a retry path and use bounded/idempotent server operations. Adding an employee should not silently imply a verified salary payment.

### 24 — P2: cloud profile images are actually device-local file paths

**Evidence:** `utils/profileImage.js:38-51` copies an image to `documentDirectory`; `EditProfileScreen.js:103` and `CompanyProfileScreen.js:213-216` save that `file://` URI into the cloud profile.

Other devices/reinstalls cannot load that path, and old copies accumulate. **Fix:** upload to appropriately protected storage and store a stable object reference, or explicitly make the image local-only; delete replaced and account-deleted files.

### 25 — P2: multiple settings/billing/profile routes are prototypes, not real features

**Evidence:** personal `SettingsScreen.js:22-29,52-54`; company `CompanySettingsScreen.js:21-30,83-85`; `EditCompanyProfileScreen.js:20-30,84-89`; `BillingSubscriptionScreen.js:19-25,108-154`.

Notification/report/backup/approval/retention/audit-log settings do not implement their advertised behaviour. The separate company editor uses a hardcoded company and fake save; the main CompanyProfile editor is real. Billing shows a fake active plan/card/date and fake upgrades/payment changes/cancellation; currency switches between ₹ and $. Some routes currently lack menu entry points.

**Fix:** remove unfinished routes and website claims or implement persistence and actual services. If selling digital app features, implement Play Billing or a specifically eligible regional/program exception, with verified entitlements and restore/cancel behaviour. No actual charging integration was found.

### 26 — P2: company reports present fabricated business metrics

**Evidence:** `CompanyReportsScreen.js:180` calculates department budget as `spent * 1.3`; `:267` hardcodes growth to 12.5.

**Fix:** calculate these from real budgets and a defined comparison period, or omit them. Do not present synthetic figures as the user's financial performance.

### 27 — P2: receipt scanner button points to a nonexistent screen

**Evidence:** `AddCompanyTransactionScreen.js:203-208` navigates to `ReceiptScanner`; no such registered screen or implementation exists. Receipt parsing methods do not constitute a working camera/OCR flow.

**Fix:** implement and test the scanner, or remove the button and unused camera/OCR packages. The current button cannot fulfil its promise.

### 28 — P2: budget advice is disconnected from actual budget records

**Evidence:** `DashboardScreen.js:181-198` uses `userData.budgets` or hardcoded defaults, not the `budgets` collection edited by the budget screen. Its memo depends on transaction count, so edits at unchanged count can leave advice stale. `aiService.js:223-246` supplies no category-budget records to chat.

**Fix:** use the same authoritative budget/period calculation as the UI, declare the data period/completeness to the model, and refresh on changed contents. Do not answer “within budget” from absent budget data. Chat also sends the current question twice via history and the final message (`AIChatScreen.js:106-125`, `aiService.js:304-314`).

### 29 — P2: AI calls can hang and have no cancellation lifecycle

**Evidence:** `services/aiService.js:35-41,56-69`, `functions/index.js:27-41`; fetch has no AbortController/deadline. Client submission remains active until a response; the Cloud Function's 120-second cap is not a provider/client timeout.

**Fix:** add timeouts, cancellation on unmount/session change, bounded retry/backoff and clear recoverable errors. Do not retry paid or non-idempotent operations blindly.

### 30 — P2: refresh completion and overlapping requests are incorrect

**Evidence:** `hooks/useTransactions.js:126-128` does not return the load promise, so `await refresh()` in screens returns immediately. `:25` allows overlapping refreshes without a request-generation check; older responses can overwrite newer ones. `hooks/useBudgets.js:12-15,83-87` does not clear budgets on logout.

**Fix:** return promises, cancel/ignore stale requests, reset account-scoped state on UID changes, and consolidate data ownership. Add switch-account and slow-network race tests.

### 31 — P2: failed loads are indistinguishable from zero financial data

**Evidence:** transaction hook returns `error` (`hooks/useTransactions.js:173-184`) but screens generally discard it; personal `BudgetScreen.js:156-166` ignores failed result objects; team loading (`TeamManagementScreen.js:95-101`) turns failed service responses into empty arrays.

**Fix:** separate loading/error/empty/data states, expose retry, and avoid presenting zero balances when the query failed. This is especially important for missing Firestore indexes, permission errors and offline starts.

### 32 — P2: some company totals remain stale after deleting the last transaction

**Evidence:** `CompanyReportsScreen.js:128-129` and `CompanyProfileScreen.js:141-144` return for empty transactions without resetting previously calculated state.

**Fix:** explicitly reset all aggregates/charts for an empty successful result and distinguish that from a failed load.

### 33 — P2: period labels and spending calculations disagree

**Evidence:** `StatsScreen.js:147-166,204-265`: weekly overview is calendar-week-to-date while chart is rolling seven days; yearly overview and rolling-month chart differ; average daily spend always divides by current day-of-month, even in Weekly/Yearly modes. Company budget uses Monday weeks (`CompanyBudgetScreen.js:163-169`) while reports/transactions use Sunday. “This Month/Year” transaction filters lack an upper boundary (`TransactionsScreen.js:88-110`, company equivalent).

**Fix:** define consistent period semantics, calculate the correct denominator, label rolling charts explicitly, and exclude future periods unless intentionally supported. Company budget labels 96% use as “exceeded” (`CompanyBudgetScreen.js:228-236`); use >100% for that claim.

### 34 — P1 verification gate: Android Google sign-in requires release-device validation

**Evidence:** `utils/googleAuth.js:49-65` uses a custom-scheme browser redirect with an Android OAuth client. The local Android client ID's scheme matches `app.json`, which is positive, but Google documents restrictions on Android custom URI schemes [S9]. OAuth console settings and Play signing-certificate registration were not inspected.

**Fix:** prefer a supported native Google sign-in integration and verify SHA fingerprints for the Play App Signing certificate, package, OAuth audience/consent configuration and cancellation/error paths on a Play-installed release. Do not assume success in a development environment proves release login works.

### 35 — P2: production logs can contain profile and authentication-flow data

**Evidence:** `CompanyLoginScreen.js:153,159` logs entire `userData`; all four login/signup screens log Google request URLs outside `__DEV__` guards. `functions/index.js:44-45,100` can log raw provider error content.

**Fix:** remove or redact production logs, avoid logging profiles/OAuth request state, and define retention/access controls for backend logs. The tracked-file literal-secret scan found no matches for its limited NVIDIA/private-key/GitHub/AWS patterns; that is not a complete git-history secret audit.

### 36 — P1: both dependency trees have outstanding security advisories

**Evidence:** npm audit results in “Check results” and package appendix below. These are affected-package counts, **not 75 distinct exploitable application vulnerabilities**. Some findings concern CLI/build-time, Node-only paths or inherited dependencies.

**Fix:** upgrade the Expo/RN stack coherently, update backend dependencies, remove unused packages, and triage runtime reachability with current advisories. Re-run audit and native tests; do not apply `npm audit fix --force` blindly. Critical package names in both trees include protobufjs and websocket-driver; app tooling also includes shell-quote and tar.

### 37 — P2: Expo package compatibility and New Architecture assurance are incomplete

**Evidence:** Expo Doctor failed 3/18 checks; AsyncStorage and Expo patch versions are mismatched. `app.json:9` enables New Architecture; Doctor identifies react-native-chart-kit as untested there and lacks metadata for firebase/tesseract.js.

**Fix:** align packages with the chosen upgraded SDK using Expo's compatibility checks; test charts and all native modules in release. “No metadata” and “untested” are warnings, not proof a package is broken.

### 38 — P1: a clean checkout cannot reproduce the current configured app

**Evidence:** `services/aiService.js:1` requires `config/aiConfig.js`, but `.gitignore:22` excludes it and no setup/bootstrap instructions exist. `.env.example` omits Google OAuth keys and encourages a client NVIDIA key. `App.js:3` and `utils/googleAuth.js:8` import expo-web-browser/expo-constants transitively rather than declaring them directly.

**Fix:** track a non-secret AI config, document public environment inputs, validate them at startup/build, pin a supported Node/package-manager setup and declare directly imported packages. Separate development/staging/production configuration. A missing `android/` folder alone is normal for Expo managed builds; a missing local `versionCode` is not automatically wrong because EAS uses remote auto-increment.

### 39 — P2 verification gate: generated Android permissions are broader than the visible features

**Evidence:** Expo introspection reports CAMERA, RECORD_AUDIO, READ/WRITE_EXTERNAL_STORAGE, INTERNET, SYSTEM_ALERT_WINDOW and VIBRATE. Installed camera/image-picker manifests also contribute camera/audio/legacy-storage permissions. Current receipt capture is not implemented; profile selection requests library access (`utils/profileImage.js:8-17`). Introspection is **not the final merged release manifest**.

**Fix:** remove unused native packages/permissions, use the system photo picker for occasional image selection, and inspect release-manifest contributions and Play permission warnings. Verify whether SYSTEM_ALERT_WINDOW remains in release before claiming it does. Review Android backup/data-extraction rules because introspected `allowBackup` is true and auth persistence uses AsyncStorage. No broad READ_MEDIA_IMAGES/VIDEO permission was proven in the inspected manifests.

### 40 — P1: no automated release-quality safety net

**Evidence:** `package.json:6-10` has only start commands; no test/lint/typecheck scripts, CI workflow, release checklist or crash-reporting integration found. `TEST_FIREBASE_CONNECTION.js:17-43` creates a real user and writes to configured Firebase; it is not an isolated regression suite. No app error boundary was found.

**Fix:** add syntax/lint/hooks checks, unit tests for money/date logic, emulator rules/service tests and Android end-to-end smoke tests; isolate test projects and seed data. Add an error boundary and privacy-conscious crash monitoring. The existing connection example should not be run against production casually.

### 41 — P2: tracked iOS native config has diverged from app.json

**Evidence:** Expo Doctor's non-CNG warning; `ios/Expenzo/Info.plist:25-34` lacks the Google scheme listed in `app.json:36-39`, and photo-purpose text differs (`Info.plist:52-53`). Native iOS files are tracked.

**Fix:** choose/document a generated-native versus manually maintained workflow and synchronise configuration deliberately. This is an iOS/cross-platform maintenance issue, **not proof Android prebuild is skipped**: this repository has iOS native files but no Android native directory.

### 42 — P2: accessibility and Android layout need work

**Evidence:** source scan found no `accessibilityLabel` or `accessibilityRole`; custom tab buttons are icon-only (`navigation/SharedTabBar.js:20-123,174-187`). Many screens use React Native core SafeAreaView rather than safe-area-context; `app.json:29` enables edge-to-edge. Light pastel themes coexist with hardcoded white text.

**Fix:** label icon actions/tabs, expose roles/selected states, verify TalkBack, contrast, font scaling, small screens, keyboard forms, gesture and three-button navigation. Not every text button needs an explicit label, but icon-only controls do. Device clipping/contrast was not visually tested during this audit.

### 43 — P2: dark-mode detection and currency presentation are inconsistent

**Evidence:** `App.js:25` and `navigation/AppNavigator.js:45` compare background to `#121212`, while the actual dark theme is `#0F0F0F` (`contexts/ThemeContext.js:90`). Multiple financial views force zero currency decimals (`TransactionsScreen.js:283-289`, `StatsScreen.js:278-284`); company dashboard uses two.

**Fix:** use the provided `isDarkMode` flag and consistent currency formatting. Preserve paise where needed and use integer minor units or a decimal-safe calculation strategy; annualised budget/salary division currently creates fractional currency amounts.

### 44 — P3: repository/build-upload hygiene is incomplete

**Evidence:** `git submodule status` fails: `Project-diploma` is a gitlink without a `.gitmodules` mapping. `.DS_Store` is tracked despite ignore rules. `.easignore` is a separate list that omits `.claude/` (unlike `.gitignore`) and intentionally includes local config/env files.

**Fix:** correct/remove the accidental gitlink after confirming intent, untrack OS metadata, inspect the EAS upload archive, and exclude local assistant state/unneeded files. Upload exclusions and secret management are different protections; public build-time Firebase/OAuth config need not be treated as a server secret.

### 45 — P3: unused example/UI utilities contain misleading or broken behaviour

**Evidence:** `App_Integration_Example.js:5` imports undeclared `@react-navigation/stack`. `components/EnhancedCard.js:35-44,136` leaves opacity at zero when `animation=false`; `:55,62,69` supplies colour strings as numeric `shadowOpacity`. `GlassCard.js:13,23` ignores its intensity prop; Android glass components explicitly disable blur. These helpers were not found used by current screen imports, except GlassCard.

**Fix:** remove obsolete examples/helpers or repair and test their documented API. Avoid confusing disabled blur with a working Android blur effect. These are not all release blockers by themselves.

### 46 — P2: AI request/output schemas are weak and silently accept failures

**Evidence:** `functions/index.js:73-89,108-149,188-192` validates only a few shallow types. Category labels/maps are caller-controlled; confidence is not clamped; receipt objects are not field-validated; invalid model JSON silently returns a fallback category or empty items. Client `aiService.js:120-144` hides categorisation failures behind keyword matching.

**Fix:** validate bounded input schemas and allowlisted categories, cap context/message sizes, validate all model outputs, distinguish fallback from success, and require confirmation before any AI-derived financial write. Finance context placed in system-message text also needs untrusted-data separation and prompt-injection tests; this is not an authorisation mechanism.

## Google Play release gates still requiring evidence

These are required checks, not assertions that everything is absent from your external accounts.

- [ ] **Signed production AAB:** build with the production profile, inspect application ID, versionCode, versionName, target SDK and signing. `eas.json` has a production profile with remote auto-increment; it is a useful starting point, not proof of a successful release. Preview APK is not the production deliverable.
- [ ] **API 36+:** inspect the actual submitted bundle and policy status [S1]. Do not rely only on app.json or a granted extension that has not been verified.
- [ ] **Native compatibility:** verify 64-bit native libraries, zip/ELF alignment and run on a 16 KB device/emulator [S6]. No incompatibility was proven here because no native binary was built. The current Android guidance references a 1 February 2027 update-enforcement date; use the applicable current Play Console notice, not an assumed historical deadline.
- [ ] **Play App Signing:** confirm enrolment, upload-key custody/recovery and the production certificate's Firebase/Google OAuth registration. Do not put signing keys or credentials in git.
- [ ] **Developer account:** identity/contact/device verification, payments profile where applicable, correct account type and production access. These cannot be established from source.
- [ ] **Closed testing, if applicable:** personal developer accounts created after 13 November 2023 require at least 12 testers continuously opted in for 14 days before applying for production access [S7]. Account type/date and testing status were not checked.
- [ ] **Store listing:** real screenshots, 512×512 store icon, 1024×500 feature graphic, short/full descriptions, app category, support contact, countries, pricing and truthful feature claims. Do not advertise unimplemented backups/billing/scanning or protections.
- [ ] **App content:** accurate Data safety, privacy-policy URL, external deletion URL, target audience, content rating, ads declaration, and any requested permission declarations [S2-S4]. Decide whether children are excluded based on the actual audience, not convenience.
- [ ] **Financial features declaration:** complete it accurately for this budget/finance/AI product [S8]. A budgeting app is not automatically a lending or stock-trading service; do not select unrelated regulated features or claim licences not held.
- [ ] **App access for reviewers:** supply working, maintained personal/company review accounts and instructions through Play Console, with access to all submitted features [S10]. Never publish those passwords in the repository.
- [ ] **Production backend:** verify rules/index deployment, data isolation, billing/quotas, alerts, AI secret configuration, deletion recovery and provider retention terms. Verify that startup/network failures have user-visible recovery.
- [ ] **Release testing:** complete the matrix below, Play pre-launch report, crash/ANR review and staged rollout/rollback planning. A bundle export alone does not test any of these.

## Minimum regression/device matrix before reconsidering the verdict

1. Fresh install, slow theme load, offline start, relaunch with existing session and expired/revoked session.
2. Personal/company signup, failed profile write and recovery; email login, wrong account type, reset password, real password change; Google login from the Play-signed build.
3. Logout and Android Back; rapid A→B account switch; account deletion with fresh/stale login, >450 records, network loss mid-deletion and local image cleanup.
4. Transaction create/delete/search and pagination with 0, 1, 20, 21, 100 and 1,000 records; verify totals against an independently calculated ledger.
5. Dates around 00:00–05:30 IST, month/year ends, leap day and a DST-observing zone; future/backdated company transactions and malformed dates.
6. Numeric inputs: empty/whitespace, pasted junk, NaN, Infinity, negative/zero, very large values, fractions and rounding.
7. Duplicate/repeated budget saves, category changes, period synchronisation, partial write/delete failure and reload consistency.
8. Employee creation with failed salary write, same-month concurrent salary generation, changed salary and inactive members.
9. AI unavailable/timeout, question before data load, malformed output, prompt injection, inappropriate output/reporting and consent withdrawal. Confirm no secrets in the production bundle.
10. Profile image selection/cancellation/denial, low storage, cross-device loading, replacement cleanup and reinstall.
11. TalkBack, large fonts, bright/dark/pastel themes, small phones/tablets, keyboard overlap, gesture/three-button navigation and API 36 edge-to-edge.
12. Release native startup/charts/image picker on representative Android versions, low-memory devices and a 16 KB environment; no crash/ANR regressions.

## Suggested repair order

**Phase A — contain exposure:** rotate/remove client AI secrets; authenticate/limit the backend; verify Firestore isolation and stop distributing affected builds.

**Phase B — make the core app truthful and correct:** fix message callbacks, onboarding/auth navigation, pagination/aggregates, dates/numbers, salary idempotency and deletion recovery. Remove fake/unfinished features rather than shipping them as working.

**Phase C — make the release reproducible and policy-complete:** upgrade the native stack, align dependencies, remove unnecessary permissions, document safe configuration, publish privacy/deletion resources and implement AI disclosures/reporting.

**Phase D — prove readiness:** automated tests plus real-device testing, signed AAB inspection, Play internal/closed tests as applicable, console declarations/reviewer access and pre-launch results. Then reassess. No reliable release date can be estimated from source inspection alone.

## Dependency appendix: affected packages returned by npm audit

Snapshot from this audit; counts can change with advisory updates. Inherited advisories cause parent package entries, and the two projects overlap. Do not add the counts as unique CVEs or treat every tooling issue as an Android runtime exploit.

### App lockfile — 55 affected package entries

- **Critical (4):** protobufjs; shell-quote; tar; websocket-driver.
- **High (31):** @grpc/grpc-js; @jest/environment; @jest/fake-timers; @jest/transform; @react-native/community-cli-plugin; @xmldom/xmldom; axios; babel-jest; brace-expansion; braces; browserslist; form-data; image-size; jest-environment-node; jest-haste-map; jest-message-util; js-yaml; lodash; metro; metro-config; metro-file-map; metro-transform-worker; micromatch; minimatch; nanoid; node-forge; picomatch; postcss; react-native; undici; ws.
- **Moderate (19):** @expo/cli; @expo/config; @expo/config-plugins; @expo/metro-config; @expo/prebuild-config; @protobufjs/utf8; @react-navigation/core; baseline-browser-mapping; decode-uri-component; expo; expo-asset; expo-auth-session; expo-constants; expo-linking; expo-splash-screen; follow-redirects; query-string; uuid; xcode.
- **Low (1):** @babel/core.

### Functions lockfile — 20 affected package entries

- **Critical (2):** protobufjs; websocket-driver.
- **High (6):** @fastify/busboy; @grpc/grpc-js; fast-xml-builder; firebase-admin; form-data; node-forge.
- **Moderate (10):** @google-cloud/firestore; @google-cloud/storage; @protobufjs/utf8; fast-xml-parser; gaxios; google-gax; qs; retry-request; teeny-request; uuid.
- **Low (2):** @tootallnate/once; body-parser.

## Things that are not automatically wrong

- Firebase public client configuration/OAuth client IDs are not provider secrets by themselves; server-side rules and key restrictions still need verification.
- `react-native-vector-icons` imports currently resolve through Expo Metro's explicit alias to the installed `@expo/vector-icons`; they are **not a confirmed missing-package build failure**.
- No `android/` directory is acceptable for an Expo generated-native Android build.
- EAS remote auto-increment can supply versionCode; its absence from app.json alone is not a blocker.
- Real Firebase CRUD, password-reset and in-app account-deletion code exists. The report distinguishes those from fake UI flows.
- Missing rules in git do not establish the deployed rules' contents. npm audit severities do not establish exploitability. Expo Doctor metadata warnings do not establish native incompatibility.

## Official references checked for this audit

- **S1:** [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).
- **S2:** [User Data policy: privacy, disclosure, consent and deletion](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).
- **S3:** [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) — linked from Google's User Data policy.
- **S4:** [Data safety declarations](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).
- **S5:** [AI-generated content policy](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en) and [scope/guidance](https://support.google.com/googleplay/android-developer/answer/14094294?hl=en).
- **S6:** [Android 16 KB page-size compatibility](https://developer.android.com/guide/practices/page-sizes), page updated 16 September 2026 when fetched.
- **S7:** [Testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB).
- **S8:** [Financial features declaration](https://support.google.com/googleplay/android-developer/answer/13849271?hl=en).
- **S9:** [Google OAuth native-app guidance and custom-scheme restrictions](https://developers.google.com/identity/protocols/oauth2/native-app).
- **S10:** [Reviewer sign-in requirements](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en).

**Bottom line:** keep this as a development build until the P0/P1 items and verification gates are resolved. Do not publish the current build to production.
