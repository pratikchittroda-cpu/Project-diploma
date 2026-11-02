# Backend checks and deployment gates

Run from the repository root:

```sh
npm --prefix functions test
npm --prefix functions run test:rules
```

The isolated Node tests use injected Auth, database, Storage and provider doubles.
The rules suite starts only the Firestore and Storage emulators for
`demo-expenzo`, refuses non-loopback hosts/non-demo project configuration, and
also exercises real Firestore quota transactions and paginated deletion. It
never calls Firebase Auth or the external AI provider. Node 22 and Java 21+ are
the deployment-aligned prerequisites (the emulator CLI may download binaries).

## Financial chat contract

`POST /financial-chat` accepts `question`, optional `conversationHistory`,
`consent: true`, and required `timeZone` from
`Intl.DateTimeFormat().resolvedOptions().timeZone`. No owner ID, period, clock or
client financial summary is accepted. The current month-to-date is computed
using server time in this validated IANA zone. Date-only ledger values stay
date-only; legacy offset-bearing ISO instants and `createdAt` fallbacks use that
zone. Ambiguous/invalid dates fail closed. Legacy numeric amounts use the same
nearest-paise rounding as the client.

The full owner ledger is bounded to 5,000 rows and saved budgets to 200 raw rows.
Over-limit or invalid relevant data fails before any provider request, rather
than sending incomplete totals. Canonical monthly budgets and archive
tombstones match the client's duplicate resolution. Only aggregate amounts,
categories, period/completeness metadata, and the consented question/history go
to the provider; raw ledger descriptions, member details and identifiers do not.

## Retention policy

- Reportable AI question/answer receipts: 7 days.
- Submitted AI reports (question, answer, reason, optional details): 30 days from
  the latest submission; re-submission is possible only within the receipt's
  original 7-day reporting window. Account deletion removes these immediately
  as part of its resumable workflow. Legacy reports use their `createdAt` cutoff.
- Minimal completed deletion jobs: 7 days; unfinished jobs never expire.
- Application quota metadata: 2 days after activity (only after all enforced
  quota windows have elapsed).

The daily worker applies these cutoffs, including legacy report cleanup. It
uses bounded pages and rechecks expiry transactionally so concurrent renewals
cannot reset active cost ceilings. Actual removal includes scheduling/backlog
delay; monitor failures and backlog. This app creates no generic request/error
log documents and never logs raw provider/Auth errors, questions or finance
content. Cloud Functions/platform logs are external to this Firestore worker.

Before release, explicitly configure and verify **30-day retention** on every
application/platform log bucket receiving this service's entries, document any
non-configurable audit-log exceptions, configure minimal IAM access, and verify
the provider's separate retention/training/location terms. Never describe the
Firestore worker as deleting Cloud Logging or provider logs.

## Remaining deployment validation

1. Keep `ENFORCE_APP_CHECK=true` (the default). The app now registers the native
   adapter in `utils/appCheck.js`. Provision the native Firebase files and verify
   Play Integrity/App Attest/DeviceCheck on signed physical devices. Tokens are
   fetched on demand with automatic background refresh disabled. No debug
   provider or token is supported. Firestore/Storage use the JS Firebase SDK;
   this adapter protects the HTTP backend, not direct JS Firestore/Storage calls.
2. Supply the real approved HTTPS backend origin and allowlisted web origins;
   set server-only `NVIDIA_API_KEY`. Keep `AI_ENABLED=false` until consent,
   privacy, report handling and provider configuration are verified.
3. Deploy/verify rules and required indexes, Storage-to-Firestore rules access,
   scheduler IAM, deletion-worker retry monitoring and retention backlog alarms.
4. Configure report review/abuse handling and publish the actual 30-day report
   and configured log-retention policy. Production App Check, revocation,
   identity-provider reauthentication and end-to-end real-device deletion remain
   release checks; local emulators do not prove those deployment properties.

These checks do not deploy anything or certify a production environment.
