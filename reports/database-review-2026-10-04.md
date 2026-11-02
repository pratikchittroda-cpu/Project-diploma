# Firestore database review — 4 October 2026

## Verdict

Good foundation, but not ready for a production sign-off. Two correctness/security gaps were reproduced locally. No production database connection, data inspection or deployment was performed; this is a review of the current working-tree rules and application code, not a certification of deployed Firebase configuration.

Scope: Firestore/Storage rules, indexes, finance services, backend finance context, quota/deletion/retention code, and relevant local tests. The working tree has extensive existing changes; the baseline commit is `9d4ac0b3`, but this review includes uncommitted/untracked source. Application code was not edited.

## 1. High: another account can reserve an owner's deterministic document IDs

- Sources: `firestore.rules:67`, `firestore.rules:74`, `utils/finance.js:174-178`, `services/budgetService.js:55-61`, `services/teamService.js:133-140`.
- Create rules validate the document's `userId`, but do not bind the path's document ID to that owner. Budget and salary services depend on predictable IDs in shared top-level collections.
- Reproduced in a dedicated demo emulator: synthetic account Alice creates `budgets/budget_bob_food_Monthly` with `userId: alice`. Creation succeeds. Bob's canonical budget transaction then fails permission checks when reading that occupied slot. Alice can similarly occupy `transactions/salary_bob_m1_2026-10` using an ordinary expense document.
- Trigger: an authenticated account knows a target UID (and member ID for the salary case) and writes before the legitimate record exists. Existing victim records are not overwritten by this reproduction.
- Impact: cross-account denial of budget creation/edit flows and salary generation. This does not demonstrate disclosure of the victim's record contents.
- Correction: enforce ownership of reserved canonical ID namespaces in rules, or place deterministic documents under owner-scoped paths with equivalent rules. Validate reserved IDs against their associated fields, account for existing records during rollout, and add tests rejecting other-owner ID reservation. Server-only creation is another option.

## 2. Medium: legacy amount rounding disagrees between app and backend

- Sources: `functions/lib/finance.js:8-12` versus `utils/finance.js:22-29`.
- Backend uses `Math.round((amount + Number.EPSILON) * 100)`; the app uses decimal shifting to handle binary floating-point edge cases.
- Reproduced by calling both actual summarizers with the same synthetic legacy expense of INR 10.075: app total **10.08**, backend AI-context total **10.07**.
- Impact: dashboard figures and financial-assistant context can disagree for legacy fractional-paise data. New validated two-decimal writes do not need a fractional-paise input to be accepted for this legacy case to matter.
- Correction: use the same tested minor-unit conversion on both sides; add parity tests including 10.075 and other half-paise cases. No production legacy records were inspected, so prevalence is unknown.

## Growth concern — not a measured performance failure

`services/transactionService.js:29-35` downloads every owned transaction and sorts locally. Date/category helpers reuse the full read (`:56-78`), and `hooks/financeData.js:10-14` reloads it after mutations. Reads and memory therefore grow with lifetime history. The backend separately refuses financial-chat context beyond 5,000 transactions or 200 raw budget rows (`functions/lib/finance.js:3-4,91-99`).

Plan a legacy-date migration plus indexed date-range queries and/or maintained aggregates. Preserve complete totals; adding an arbitrary query limit would silently corrupt statistics. History already has bounded cursor pagination. No latency or billing benchmark was run.

## What is good

- Default-deny rules, owner-filtered reads, immutable ownership, strict field allowlists, money/date validation and company restrictions.
- Atomic multi-period budget writes and idempotent salary transactions for normal cooperative clients.
- Durable deletion locks, bounded resumable deletion, retention cleanup and transactional quotas.
- Positive and negative rules tests, including cross-owner isolation and actual emulator transactions.

## Checks actually run

- `npm --prefix functions test`: **28 passed**.
- `node --test tests/finance-regression.test.cjs`: **27 passed**.
- `npm run test:rules`: **12 passed** using Firestore and Storage emulators in `demo-expenzo`.
- Dedicated reproduction: **2 assertions-based tests confirmed the ID-reservation gap**, using only the `demo-expenzo-db-review` Firestore emulator. These are demonstrations of the vulnerability, not tests showing it has been fixed.
- Direct in-memory invocation of client/backend summarizers confirmed the 10.08 versus 10.07 discrepancy.

Existing suite total: **67 passed, 0 failed**. Existing tests do not cover the two gaps above. The two additional reproduction tests are outside that total.

Dedicated reproduction command (temporary script, not application source):

```sh
# From functions/
./node_modules/.bin/firebase emulators:exec --config ../firebase.json --project demo-expenzo-db-review --only firestore 'node --test /private/var/folders/lz/fl1lj6rn7d15zl8b6j_3pmzc0000gn/T/opencode/database-review-ef80c7d1.cjs'
```

Runtime: Node **25.8.1**, Java **25.0.2**. All above checks passed on that local runtime; the project's deployment-aligned Node 22/Java 21 setup was not tested. Storage emulator emitted Java deprecation warnings but completed its tests.

## Still unverified in production

Deployed rules/index readiness, actual record quality and duplicates, database region, IAM, Firestore/Storage App Check enforcement, backup/PITR configuration and restore tests, deletion/retention worker deployment and monitoring, usage/cost/latency, and platform log retention. Emulator success does not prove composite indexes are deployed or these operational controls are enabled. The in-app backup screen explicitly says backup/restore is unavailable; that does not establish whether infrastructure backups exist.

Before release: fix the ID-reservation gap, unify legacy money rounding, rerun tests on Node 22, then verify the live Firebase configuration and recovery process through authorised access.
