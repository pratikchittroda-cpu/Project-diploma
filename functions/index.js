'use strict';
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAppCheck } = require('firebase-admin/app-check');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret, defineBoolean, defineString } = require('firebase-functions/params');
const { createApp } = require('./lib/app');
const { runDeletion } = require('./lib/deletion');
const { cleanExpiredData } = require('./lib/retention');

initializeApp();
const db = getFirestore(), auth = getAuth();
const apiKey = defineSecret('NVIDIA_API_KEY');
const enforceAppCheck = defineBoolean('ENFORCE_APP_CHECK', { default: true });
// Explicit opt-in after privacy/provider/report handling configuration is verified.
const aiEnabled = defineBoolean('AI_ENABLED', { default: false });
const corsOrigins = defineString('ALLOWED_WEB_ORIGINS', { default: '' });
let app;
exports.ai = onRequest({
  region: 'asia-south1', timeoutSeconds: 60, memory: '256MiB', maxInstances: 2, concurrency: 8,
  secrets: [apiKey],
}, (req, res) => {
  app ||= createApp({ db, auth, bucket: getStorage().bucket(), appCheck: getAppCheck(), apiKey: () => apiKey.value(), enforceAppCheck: enforceAppCheck.value(), aiEnabled: aiEnabled.value(), allowedOrigins: corsOrigins.value().split(',').map(s => s.trim()).filter(Boolean) });
  return app(req, res);
});

// Service-owned retries continue after app closure, network loss or Auth removal.
// No worker needs to reuse a stale user ID token; each new user request still needs recent auth.
exports.resumeAccountDeletions = onSchedule({ schedule: 'every 30 minutes', region: 'asia-south1', timeoutSeconds: 540, memory: '256MiB', maxInstances: 1, retryCount: 2 }, async () => {
  const jobs = await db.collection('deletionJobs').where('status', 'in', ['pending', 'running']).orderBy('updatedAt', 'asc').limit(20).get();
  for (const job of jobs.docs) await runDeletion({ db, auth, bucket: getStorage().bucket(), uid: job.id });
});
exports.cleanExpiredAiData = onSchedule({ schedule: 'every 24 hours', region: 'asia-south1', timeoutSeconds: 300, memory: '256MiB', maxInstances: 1 }, async () => {
  await cleanExpiredData(db);
});
