'use strict';
const { randomUUID } = require('node:crypto');
const { HttpError, requireRecentAuth } = require('./validation');
const { RETENTION } = require('./retention');

// Jobs are intentionally outside users/: they survive profile/Auth removal.
// Existence locks client writes. Multi-product deletion is resumable, not atomic.
const COLLECTIONS = ['transactions', 'budgets', 'members', 'teams', 'reports', 'aiReports', 'aiResponses', 'aiQuota'];
const STAGES = [...COLLECTIONS, 'storage', 'profile', 'auth', 'complete'];
const LEASE_MS = 90000;
async function startDeletion(db, token, now = Date.now()) {
  requireRecentAuth(token, now);
  const ref = db.collection('deletionJobs').doc(token.uid);
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) tx.set(ref, { status: 'pending', stage: 0, createdAt: now, updatedAt: now, leaseUntil: 0, attempts: 0 });
  });
  return ref;
}
async function runDeletion({ db, auth, bucket, uid, now = Date.now, budgetMs = 20000 }) {
  const ref = db.collection('deletionJobs').doc(uid), lease = randomUUID(), started = now();
  const acquired = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), job = snapshot.data();
    if (!job || job.status === 'complete') return job?.status === 'complete' ? 'complete' : null;
    if (job.leaseUntil > now()) return null;
    tx.update(ref, { lease, leaseUntil: now() + LEASE_MS, status: 'running', updatedAt: now(), attempts: (job.attempts || 0) + 1 });
    return job.stage;
  });
  if (acquired === 'complete') return true;
  if (acquired === null) return false;
  let stage = acquired;
  const save = async (changes) => db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (snapshot.data()?.lease !== lease) throw new HttpError(409, 'deletion/in-progress', 'Another deletion worker is running.');
    tx.update(ref, { ...changes, updatedAt: now() });
  });
  try {
    let batches = 0;
    while (stage < STAGES.length - 1 && now() - started < budgetMs && batches < 15) {
      const name = STAGES[stage];
      if (COLLECTIONS.includes(name)) {
        const snapshot = await db.collection(name).where('userId', '==', uid).limit(400).get();
        if (!snapshot.empty) {
          const batch = db.batch();
          snapshot.docs.forEach(document => batch.delete(document.ref));
          await batch.commit();
          batches++;
          // Stay at this stage until a subsequent query proves it is drained.
          continue;
        }
      } else if (name === 'storage') {
        // Rules permit uploads only under users/{uid}/. Other prefixes cover legacy objects.
        // Delete bounded pages; a bucket error leaves the job retryable, never skipped.
        let remaining = false;
        for (const prefix of [`users/${uid}/`, `profiles/${uid}/`, `profileImages/${uid}/`]) {
          const [files] = await bucket.getFiles({ prefix, maxResults: 100, autoPaginate: false });
          if (files.length) {
            await Promise.all(files.map(file => file.delete({ ignoreNotFound: true })));
            remaining = true;
          }
        }
        batches++;
        if (remaining) continue;
      } else if (name === 'profile') {
        // No client subcollections are allowed by the rules.
        await db.collection('users').doc(uid).delete();
      } else if (name === 'auth') {
        try { await auth.deleteUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      }
      stage++;
      await save({ stage });
    }
    const complete = stage === STAGES.length - 1;
    await save({ status: complete ? 'complete' : 'pending', leaseUntil: 0, ...(complete ? { completedAt: now(), expiresAt: now() + RETENTION.deletionMs } : {}) });
    return complete;
  } catch {
    // Retain only a generic error marker, not storage paths, profiles or SDK error text.
    await save({ status: 'pending', leaseUntil: 0, lastError: 'retry-required' });
    return false;
  }
}
module.exports = { startDeletion, runDeletion, COLLECTIONS, STAGES };
