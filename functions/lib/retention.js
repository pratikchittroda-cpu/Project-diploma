'use strict';
// Application-owned policy. Platform/provider log retention is a separate deployment gate.
const DAY = 86400000;
const RETENTION = Object.freeze({ responseMs: 7 * DAY, reportMs: 30 * DAY, deletionMs: 7 * DAY, quotaMs: 2 * DAY });
async function cleanExpiredData(db, now = Date.now()) {
  const policies = [
    ['aiResponses', 'expiresAt', now],
    ['aiReports', 'expiresAt', now],
    // Legacy reports were written without expiresAt; their creation time remains authoritative.
    ['aiReports', 'createdAt', now - RETENTION.reportMs],
    ['deletionJobs', 'expiresAt', now],
    ['aiQuota', 'expiresAt', now],
    ['serviceQuota', 'expiresAt', now],
  ];
  let deleted = 0;
  for (const [collection, field, cutoff] of policies) {
    // At most 8000 rows per policy per sweep; monitor backlog before promising a deadline.
    for (let page = 0; page < 20; page++) {
      const expired = await db.collection(collection).where(field, '<=', cutoff).limit(400).get();
      if (expired.empty) break;
      // Recheck under a transaction: a renewed quota/report must not be deleted
      // from a stale sweep snapshot, which could otherwise reset a cost ceiling.
      deleted += await db.runTransaction(async tx => {
        const current = await Promise.all(expired.docs.map(doc => tx.get(doc.ref)));
        let count = 0;
        for (const doc of current) {
          const value = doc.data()?.[field];
          if (typeof value === 'number' && value <= cutoff) { tx.delete(doc.ref); count++; }
        }
        return count;
      });
    }
  }
  return deleted;
}
module.exports = { RETENTION, cleanExpiredData };
