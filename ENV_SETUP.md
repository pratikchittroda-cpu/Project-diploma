# Environment Variables Setup

## 📋 Quick Start

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Add your API keys to `.env`:**
   ```
   AI_PROXY_BASE_URL=https://your-secure-backend.example.com
   FIREBASE_API_KEY=your_firebase_api_key
   FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   FIREBASE_APP_ID=your_app_id
   FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

3. **Copy config templates:**
   ```bash
   cp config/aiConfig.example.js config/aiConfig.js
   ```

4. **Restart the development server:**
   ```bash
   npx expo start --clear
   ```

## 🔑 Getting Credentials

### AI Proxy URL
1. Deploy a secure backend endpoint (for example Cloud Functions, your API server, or serverless route).
2. Keep provider API keys (Hugging Face/OpenAI/etc.) on the backend only.
3. Expose only your backend base URL to the app via `AI_PROXY_BASE_URL`.

### Firebase Configuration
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (if not already done)
3. Add a Web App to your project
4. Copy the `firebaseConfig` object values into your `.env` file


## 🔒 Security

- ✅ `.env` is in `.gitignore` - never committed
- ✅ Config files are in `.gitignore` - never committed
- ✅ Example files are safe to commit
- ✅ Provider API keys stay server-side and are never shipped in the mobile app

## ⚠️ Important

**Never commit these files:**
- `.env`
- `config/aiConfig.js`

**Safe to commit:**
- `.env.example`
- `config/aiConfig.example.js`

## 🐛 Troubleshooting

### "Cannot find module '@env'"
- Make sure you ran `npm install`
- Restart Metro bundler: `npx expo start --clear`

### "AI proxy is not configured"
- Check `.env` file exists
- Check `AI_PROXY_BASE_URL` is set correctly
- Restart the app

### Changes not reflecting
- Clear cache: `npx expo start --clear`
- Restart the app completely
