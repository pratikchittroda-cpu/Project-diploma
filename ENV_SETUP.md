# Environment Variables Setup

## 📋 Quick Start

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Add your API keys to `.env`:**
   ```
   HUGGINGFACE_API_KEY=your_actual_key_here
   OCR_SPACE_API_KEY=your_actual_key_here
   ```

3. **Copy config templates:**
   ```bash
   cp config/aiConfig.example.js config/aiConfig.js
   cp config/ocrConfig.example.js config/ocrConfig.js
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

### OCR.space API Key
1. Go to https://ocr.space/ocrapi
2. Sign up for free tier (500 requests/day)
3. Get your API key from the dashboard
4. Use the key in `.env`

## 🔒 Security

- ✅ `.env` is in `.gitignore` - never committed
- ✅ Config files are in `.gitignore` - never committed
- ✅ Example files are safe to commit
- ✅ API keys are loaded from environment variables

## ⚠️ Important

**Never commit these files:**
- `.env`
- `config/aiConfig.js`
- `config/ocrConfig.js`

**Safe to commit:**
- `.env.example`
- `config/aiConfig.example.js`
- `config/ocrConfig.example.js`

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
