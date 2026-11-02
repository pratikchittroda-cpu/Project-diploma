# Expenzo hosted AI API

This is a separate Expo Router **API-only** project for EAS Hosting. It does not
replace the native app entrypoint, navigation or dependencies. It links the
existing `@pratik2467/Expenzo` EAS project and keeps Firebase on Spark.

Public API base: `https://expenzo-ai-pratik2467.expo.app/api`.

## Routes and access

- `GET /api/health`: only enabled/configured flags; no secret values.
- `POST /api/financial-chat`: question, bounded recent history, `consent: true`,
  device IANA `timeZone`; server-owned current month-to-date finance context.
- `POST /api/categorize`: description and `consent: true`; categories match the
  authenticated personal/company profile.
- `POST /api/parse-receipt`: receipt text and `consent: true`; reviewed line items
  contain name, integer quantity and INR **unit** price. Nothing is saved for you.

POST routes require a Firebase ID token in Authorization. Google verifies that
exact token; project/issuer/expiry/revocation/profile and ownership are checked.
Firestore REST uses the same caller token and existing owner-isolating rules.
Chat sends only verified aggregates, not raw ledger descriptions or employee IDs.
No account deletion, upload, payment or report endpoint is implemented here.

## Server configuration

Server-only EAS production variables:

- `NVIDIA_API_KEY`: **sensitive**, never `EXPO_PUBLIC_`, never imported by clients.
- `AI_ENABLED`: `true` after provider access is verified.
- `FIREBASE_PROJECT_ID` and `FIREBASE_API_KEY`: existing public Firebase identity.
- `ALLOWED_WEB_ORIGINS`: optional comma-separated explicit browser origins.

EAS Hosting currently supports plain/sensitive variables, **not secret-visibility
variables**. Runtime bindings stay in server routes. Sensitive values must be
entered privately or provisioned from the ignored local configuration without
printing them. Do not commit keys, tokens, raw chat or account content.

The endpoint's own origin is allowed because EAS also adds it to native requests.
Other origins require the explicit allowlist; CORS never substitutes for Auth.

## Checks and deployment

Use Node 22.23.3/npm 11.11.0. From this directory:

```sh
npm ci
npm run check:expo
npm run export
npx eas-cli@24.11.0 deploy --environment production --prod --non-interactive --no-source-maps
```

The first deployment additionally needs an available `--dev-domain` name.
Environment changes require a new immutable deployment. Deploy only after root
unit/API tests and the Firestore emulator rules suite pass. The API imports shared
pure finance/validation/provider modules from the parent repository.

Set only the returned public base URL (including `/api`) as `AI_API_BASE_URL` in
native build environments. EAS Build makes APKs; EAS Hosting runs this API after
the Mac is off. A previously installed APK still needs a new build to contain the
changed AI client and URL.

## Usage and storage

Each attempt reserves paired rule-enforced daily counters: 20 per account and
200 service-wide, on UTC days. Failed/cancelled provider attempts consume their
reservation; no provider request is automatically retried. Only proven Firestore
atomic version/existence-precondition conflicts can retry before the provider
call. Firestore user tokens use optimistic atomic commits, not the unsupported
server `beginTransaction` RPC. Counters cannot be
decreased, reset or deleted by clients.

Questions, answers, receipt text, chat history and consent are not persisted by
the API. Counters remain until publisher cleanup; there is no scheduled cleanup
job here. Provider and infrastructure retention follow their own policies.
