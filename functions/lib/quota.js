'use strict';
const { HttpError } = require('./validation');
const { RETENTION } = require('./retention');

// Fixed cost ceilings. Failed provider attempts consume quota too; never retry paid calls automatically.
const LIMITS = Object.freeze({ aiDaily: 20, aiMinute: 3, reportDaily: 10, reportMinute: 3, globalDaily: 500, globalMinute: 30 });
async function reserveQuota(db, uid, reporting = false, now = Date.now()) {
  const userRef = db.collection('aiQuota').doc(uid);
  const globalRef = db.collection('serviceQuota').doc('ai');
  const deletionRef = db.collection('deletionJobs').doc(uid);
  const day = new Date(now).toISOString().slice(0, 10), minute = Math.floor(now / 60000);
  const key = reporting ? 'report' : 'ai';
  await db.runTransaction(async tx => {
    const [user, global, deletion] = await Promise.all([tx.get(userRef), tx.get(globalRef), tx.get(deletionRef)]);
    if (deletion.exists) throw new HttpError(409, 'account/deleting', 'Account deletion is in progress.');
    const current = user.data()?.[key] || {};
    const counts = { day, minute, daily: current.day === day ? current.daily : 0, perMinute: current.minute === minute ? current.perMinute : 0 };
    if (counts.daily >= LIMITS[`${key}Daily`] || counts.perMinute >= LIMITS[`${key}Minute`]) throw new HttpError(429, 'quota/exceeded', 'Request limit reached. Please try later.');
    if (!reporting) {
      const g = global.data() || {};
      const daily = g.day === day ? g.daily : 0, perMinute = g.minute === minute ? g.perMinute : 0;
      if (daily >= LIMITS.globalDaily || perMinute >= LIMITS.globalMinute) throw new HttpError(429, 'quota/service-limit', 'The daily or short-term service limit has been reached.');
      tx.set(globalRef, { day, minute, daily: daily + 1, perMinute: perMinute + 1, expiresAt: now + RETENTION.quotaMs });
    }
    tx.set(userRef, { userId: uid, expiresAt: now + RETENTION.quotaMs, [key]: { ...counts, daily: counts.daily + 1, perMinute: counts.perMinute + 1 } }, { merge: true });
  });
}
module.exports = { reserveQuota, LIMITS };
