# Firebase AI Proxy Setup

This project now includes a Firebase Functions proxy for:

- `POST /ai/financial-chat`
- `POST /ai/categorize`
- `POST /ai/parse-receipt`

## 1. Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

## 2. Install function dependencies

```bash
cd functions
npm install
cd ..
```

## 3. Set the NVIDIA API key as a Firebase secret

Do not put the NVIDIA key in the mobile app `.env`.

```bash
firebase functions:secrets:set NVIDIA_API_KEY
```

When prompted, paste your NVIDIA API key.

## 4. Deploy the function

```bash
firebase deploy --only functions
```

## 5. Set the app proxy URL

After deploy, Firebase will give you a function URL similar to:

```text
https://asia-south1-project1-7a465.cloudfunctions.net/ai
```

Set that in the app `.env`:

```env
AI_PROXY_BASE_URL=https://asia-south1-project1-7a465.cloudfunctions.net/ai
```

Then restart Expo:

```bash
npx expo start -c
```

## Notes

- The mobile app sends only the signed-in user finance context to the proxy.
- The NVIDIA key stays only in Firebase Functions.
- `financial-chat` is restricted by prompt to finance-related answers only.
