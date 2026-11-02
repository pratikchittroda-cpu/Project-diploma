'use strict';
const express = require('express');
const { randomUUID } = require('node:crypto');
const { HttpError, validateRequest, validateOutput } = require('./validation');
const { fetchFinanceContext, buildMessages } = require('./finance');
const { reserveQuota } = require('./quota');
const { callProvider } = require('./provider');
const { startDeletion, runDeletion } = require('./deletion');
const { RETENTION } = require('./retention');

function createApp({ db, auth, appCheck, bucket, apiKey, enforceAppCheck = true, aiEnabled = false, allowedOrigins = [], provider = callProvider, clock = Date.now }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    const origin = req.get('origin');
    if (origin && !allowedOrigins.includes(origin)) return res.status(403).json({ code: 'request/origin', error: 'Origin not allowed.' });
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin); res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '24kb', strict: true }));
  app.use(async (req, res, next) => {
    try {
      const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(req.get('authorization') || '');
      if (!match) throw new HttpError(401, 'auth/unauthenticated', 'Sign in to use this service.');
      try { req.identity = await auth.verifyIdToken(match[1], true); }
      catch { throw new HttpError(401, 'auth/unauthenticated', 'Your session expired. Please sign in again.'); }
      if (!req.identity.uid) throw new HttpError(401, 'auth/unauthenticated', 'Invalid session.');
      if (enforceAppCheck) {
        try { await appCheck.verifyToken(req.get('X-Firebase-AppCheck') || ''); }
        catch { throw new HttpError(403, 'app-check/required', 'App verification is required.'); }
      }
      next();
    } catch (error) { next(error); }
  });
  const activeWrite = async (uid, ref, value) => db.runTransaction(async tx => {
    const job = await tx.get(db.collection('deletionJobs').doc(uid));
    if (job.exists) throw new HttpError(409, 'account/deleting', 'Account deletion is in progress.');
    tx.set(ref, value);
  });
  for (const route of ['/financial-chat', '/categorize', '/parse-receipt']) {
    app.post(route, async (req, res, next) => {
      try {
        const input = validateRequest(route, req.body);
        if (!aiEnabled) throw new HttpError(503, 'ai/disabled', 'AI is unavailable while service configuration is being completed.');
        const uid = req.identity.uid;
        const profile = await db.collection('users').doc(uid).get();
        if (!profile.exists) throw new HttpError(409, 'account/incomplete', 'Complete your account setup first.');
        await reserveQuota(db, uid, false, clock());
        const context = route === '/financial-chat' ? await fetchFinanceContext(db, uid, new Date(clock()), input.timeZone) : null;
        const answer = await provider({ apiKey: apiKey(), messages: buildMessages(route, input, context), maxTokens: route === '/categorize' ? 120 : 900 });
        const result = validateOutput(route, answer);
        if (route === '/financial-chat') {
          const responseId = randomUUID();
          await activeWrite(uid, db.collection('aiResponses').doc(responseId), {
            userId: uid, question: input.question, answer: result.answer, createdAt: clock(), expiresAt: clock() + RETENTION.responseMs,
          });
          return res.json({ ...result, responseId, context: { period: context.period, complete: context.complete, transactionCount: context.transactionCount, completenessNote: context.completenessNote } });
        }
        return res.json(result);
      } catch (error) { next(error); }
    });
  }
  app.post('/report', async (req, res, next) => {
    try {
      const input = validateRequest('/report', req.body), uid = req.identity.uid;
      await reserveQuota(db, uid, true, clock());
      const receipt = await db.collection('aiResponses').doc(input.responseId).get();
      const data = receipt.data();
      if (!data || data.userId !== uid || !Number.isFinite(data.expiresAt) || data.expiresAt <= clock()) throw new HttpError(404, 'report/not-found', 'This response is no longer available to report.');
      // Deterministic per response: retries replace, never multiply reports.
      await activeWrite(uid, db.collection('aiReports').doc(input.responseId), { userId: uid, ...input, question: data.question, answer: data.answer, status: 'open', createdAt: clock(), expiresAt: clock() + RETENTION.reportMs });
      res.json({ success: true });
    } catch (error) { next(error); }
  });
  app.post('/account/delete', async (req, res, next) => {
    try {
      validateRequest('/account/delete', req.body);
      await startDeletion(db, req.identity, clock());
      const complete = await runDeletion({ db, auth, bucket, uid: req.identity.uid, now: clock });
      if (!complete) throw new HttpError(409, 'deletion/in-progress', 'Deletion has started and will resume automatically. Sign in again and retry to check completion.');
      res.json({ success: true });
    } catch (error) { next(error); }
  });
  app.use((req, res) => res.status(404).json({ code: 'request/not-found', error: 'Route not found.' }));
  app.use((error, req, res, next) => {
    if (error instanceof HttpError) return res.status(error.status).json({ code: error.code, error: error.message });
    if (error.type === 'entity.too.large' || error.type === 'entity.parse.failed') return res.status(400).json({ code: 'request/invalid', error: 'Invalid or oversized JSON request.' });
    // No raw provider, Auth, Firestore or request data in application logs/responses.
    res.status(503).json({ code: 'backend/unavailable', error: 'Service unavailable. Please try later.' });
  });
  return app;
}
module.exports = { createApp };
