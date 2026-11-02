'use strict';

const { HttpError } = require('./lib/shared.cjs');
const { decodeFields, timestamp, FirestoreConflict } = require('./firestore.cjs');

const USER_DAILY_LIMIT = 20;
const GLOBAL_DAILY_LIMIT = 200;
const invalid = () => new HttpError(422, 'quota/invalid-data', 'Stored AI usage data needs correction. Please try later.');
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function usageSnapshot(result, expected) {
  if (!plain(result)) throw invalid();
  if (result.readTime !== undefined) timestamp(result.readTime, invalid);
  if (typeof result.missing === 'string' && result.missing === expected && result.found === undefined) {
    return { name: expected, count: 0, exists: false };
  }
  if (result.missing !== undefined || !plain(result.found) || result.found.name !== expected) throw invalid();
  const document = result.found;
  if (document.createTime !== undefined) timestamp(document.createTime, invalid);
  const data = decodeFields(document.fields, invalid);
  if (Object.keys(data).sort().join(',') !== 'count,updatedAt' || !Number.isInteger(data.count) || data.count < 1 ||
      document.fields?.count?.integerValue === undefined || typeof data.updatedAt !== 'string' ||
      !document.fields?.updatedAt?.timestampValue || typeof document.updateTime !== 'string') throw invalid();
  timestamp(data.updatedAt, invalid);
  timestamp(document.updateTime, invalid);
  return { name: expected, count: data.count, exists: true, updateTime: document.updateTime };
}

function usageWrite(snapshot) {
  return {
    update: { name: snapshot.name, fields: { count: { integerValue: String(snapshot.count + 1) } } },
    updateMask: { fieldPaths: ['count'] },
    updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
    currentDocument: snapshot.exists ? { updateTime: snapshot.updateTime } : { exists: false },
  };
}

// Firebase user tokens can read/commit documents but cannot begin the server
// transaction RPC. Use an optimistic atomic commit: both snapshot versions (or
// absence) are preconditions, so any intervening write refuses the whole pair.
// Failed/cancelled provider attempts retain reservations; nothing resets them.
async function reserveUsage(db, uid, clock, scope) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    scope.check();
    const now = new Date(clock());
    if (!Number.isFinite(now.getTime())) throw new HttpError(503, 'backend/unavailable', 'Service unavailable.');
    const day = now.toISOString().slice(0, 10);
    const userName = `${db.name}/aiUsage/${uid}/days/${day}`;
    const globalName = `${db.name}/globalAIUsage/${day}`;
    let committed = false;
    try {
      const snapshots = await db.request(':batchGet', {
        body: { documents: [userName, globalName] }, maxBytes: 32768,
      });
      if (!Array.isArray(snapshots) || snapshots.length !== 2) throw invalid();
      const byName = new Map();
      for (const result of snapshots) {
        const name = result?.found?.name ?? result?.missing;
        if (![userName, globalName].includes(name) || byName.has(name)) throw invalid();
        byName.set(name, usageSnapshot(result, name));
      }
      const user = byName.get(userName), global = byName.get(globalName);
      if (!user || !global || user.count > USER_DAILY_LIMIT || global.count > GLOBAL_DAILY_LIMIT) throw invalid();
      if (user.count >= USER_DAILY_LIMIT) throw new HttpError(429, 'quota/exceeded', 'Your daily AI request limit has been reached. Please try tomorrow.');
      if (global.count >= GLOBAL_DAILY_LIMIT) throw new HttpError(429, 'quota/service-limit', 'The daily AI service limit has been reached. Please try tomorrow.');
      const receipt = await db.request(':commit', {
        body: { writes: [usageWrite(user), usageWrite(global)] }, maxBytes: 32768, preconditionConflict: true,
      });
      // A successful commit is irreversible even when its receipt is malformed.
      // Never retry an uncertain acknowledgement or call the provider without it.
      committed = true;
      if (!plain(receipt) || typeof receipt.commitTime !== 'string' || !Array.isArray(receipt.writeResults) || receipt.writeResults.length !== 2) throw invalid();
      timestamp(receipt.commitTime, invalid);
      for (const result of receipt.writeResults) {
        if (!plain(result) || typeof result.updateTime !== 'string') throw invalid();
        timestamp(result.updateTime, invalid);
      }
      return;
    } catch (error) {
      if (error instanceof FirestoreConflict && attempt < 2 && !committed) continue;
      throw error;
    }
  }
}

module.exports = { reserveUsage, USER_DAILY_LIMIT, GLOBAL_DAILY_LIMIT };
