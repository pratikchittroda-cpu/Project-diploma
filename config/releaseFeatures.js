// Firebase Functions-dependent services stay disabled on Spark. A configured
// URL alone cannot enable deletion, reporting or uploads.
export const SERVER_FEATURES_ENABLED = false;

// Hosted AI is independent of Firebase Functions, uploads and account deletion.
// It still requires an authenticated HTTPS endpoint and explicit sharing consent.
export const AI_FEATURES_ENABLED = true;
