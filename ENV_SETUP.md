# Environment Variables Setup

## 📋 Quick Start

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Add your API keys to `.env`:**
   ```
   HUGGINGFACE_API_KEY=your_actual_key_here
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

## 🔑 Getting API Keys

### Hugging Face API Key
1. Go to https://huggingface.co/
2. Sign up / Log in
3. Go to Settings → Access Tokens
4. Create a new token with "Read" permission
5. Copy the token (starts with `hf_`)

### Firebase Configuration
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (if not already done)
3. Add a Web App to your project
4. Copy the `firebaseConfig` object values into your `.env` file


## 🔒 Security

- ✅ `.env` is in `.gitignore` - never committed
- ✅ Config files are in `.gitignore` - never committed
- ✅ Example files are safe to commit
- ✅ API keys are loaded from environment variables

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

### "API_KEY is undefined"
- Check `.env` file exists
- Check API keys are set correctly
- Restart the app

### Changes not reflecting
- Clear cache: `npx expo start --clear`
- Restart the app completely
