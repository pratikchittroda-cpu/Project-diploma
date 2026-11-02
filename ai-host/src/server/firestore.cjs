'use strict';

const { HttpError, MAX_TRANSACTIONS, MAX_BUDGETS } = require('./lib/shared.cjs');
const { discardBody, readJSON } = require('./runtime.cjs');

const invalidData = () => new HttpError(422, 'finance/invalid-data', 'Stored finance data needs correction. No partial totals were sent.');
const unavailable = () => new HttpError(503, 'data/unavailable', 'Account data is temporarily unavailable. Please try later.');
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (value, allowed) => plain(value) && Object.keys(value).every(key => allowed.includes(key));

function timestamp(value, invalid = invalidData) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,9}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match) throw invalid();
  const [, y, m, d] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = month === 2 ? (leap ? 29 : 28) : ([4, 6, 9, 11].includes(month) ? 30 : 31);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days) throw invalid();
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) throw invalid();
  const normalized = instant.toISOString();
  if (!/^\d{4}-/.test(normalized)) throw invalid();
  return normalized;
}

function decodeFields(fields = {}, invalid = invalidData) {
  let remaining = 10000;
  const decodeMap = (values, depth) => {
    if (!plain(values)) throw invalid();
    const result = Object.create(null);
    for (const [key, value] of Object.entries(values)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw invalid();
      result[key] = decode(value, depth + 1);
    }
    return result;
  };
  const decode = (value, depth) => {
    if (!plain(value) || Object.keys(value).length !== 1 || depth > 20 || --remaining < 0) throw invalid();
    const [kind] = Object.keys(value);
    const item = value[kind];
    switch (kind) {
      case 'stringValue':
        if (typeof item !== 'string') throw invalid();
        return item;
      case 'booleanValue':
        if (typeof item !== 'boolean') throw invalid();
        return item;
      case 'nullValue':
        if (item !== null && item !== 'NULL_VALUE') throw invalid();
        return null;
      case 'integerValue': {
        if (typeof item !== 'string' || !/^-?(?:0|[1-9]\d*)$/.test(item) || !Number.isSafeInteger(Number(item))) throw invalid();
        return Number(item);
      }
      case 'doubleValue':
        if (typeof item !== 'number' || !Number.isFinite(item)) throw invalid();
        return item;
      case 'timestampValue':
        // The pure finance module accepts explicit ISO instants, not SDK Timestamp objects.
        return timestamp(item, invalid);
      case 'mapValue':
        if (!onlyKeys(item, ['fields']) || (item.fields !== undefined && !plain(item.fields))) throw invalid();
        return decodeMap(item.fields === undefined ? {} : item.fields, depth);
      case 'arrayValue':
        if (!onlyKeys(item, ['values']) || (item.values !== undefined && !Array.isArray(item.values))) throw invalid();
        return (item.values ?? []).map(child => decode(child, depth + 1));
      case 'bytesValue': {
        if (typeof item !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item)) throw invalid();
        try { return Uint8Array.from(atob(item), character => character.charCodeAt(0)); } catch { throw invalid(); }
      }
      case 'referenceValue':
        if (typeof item !== 'string' || !/^projects\/[^/]+\/databases\/[^/]+\/documents\/.+/.test(item)) throw invalid();
        return item;
      case 'geoPointValue':
        if (!onlyKeys(item, ['latitude', 'longitude']) || !Number.isFinite(item.latitude) || !Number.isFinite(item.longitude) ||
            item.latitude < -90 || item.latitude > 90 || item.longitude < -180 || item.longitude > 180) throw invalid();
        return { latitude: item.latitude, longitude: item.longitude };
      default: throw invalid();
    }
  };
  return decodeMap(fields, 0);
}

function recordDates(record) {
  for (const key of ['createdAt', 'updatedAt']) {
    if (record[key] === undefined) continue;
    const value = record[key];
    if (typeof value !== 'string') throw invalidData();
    // Preserve legacy date-only and minute-precision strings accepted by the
    // shared finance code. Validate without changing budget recency tie-breaks.
    const candidate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z`
      : value.replace(/(T\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})$/, '$1:00$2');
    timestamp(candidate);
  }
  return record;
}

class FirestoreConflict extends HttpError {
  constructor() { super(409, 'quota/conflict', 'Usage reservation is busy. Please try later.'); }
}

function createFirestoreClient({ projectId, token, uid, fetchImpl, scope }) {
  const name = `projects/${projectId}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${name}`;

  async function request(suffix, { method = 'POST', body, maxBytes = 65536, missing = false, tooLarge = unavailable, preconditionConflict = false } = {}) {
    let response;
    try {
      response = await scope.fetch(fetchImpl, `${base}${suffix}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw unavailable();
    }
    if (!response.ok) {
      if (response.status === 404 && missing) { discardBody(response); return null; }
      // Atomic commits with version/existence preconditions cannot partially
      // apply. Only canonical conflict/precondition errors prove no write took
      // place. Timeouts, malformed replies and other errors are never retried.
      if (response.status === 409 || (preconditionConflict && response.status === 400)) {
        const failure = await readJSON(response, 4096, scope, unavailable);
        if (failure?.error?.status === 'ABORTED' && failure.error.code === 409) throw new FirestoreConflict();
        if (preconditionConflict && ((response.status === 400 && failure?.error?.status === 'FAILED_PRECONDITION' && failure.error.code === 400) ||
            (response.status === 409 && failure?.error?.status === 'ALREADY_EXISTS' && failure.error.code === 409))) throw new FirestoreConflict();
        throw unavailable();
      }
      discardBody(response);
      if (response.status === 401) throw new HttpError(401, 'auth/unauthenticated', 'Your session expired. Please sign in again.');
      if (response.status === 403) throw new HttpError(403, 'data/permission-denied', 'This account cannot access the AI service. Complete setup or sign in again.');
      throw unavailable();
    }
    return readJSON(response, maxBytes, scope, unavailable, tooLarge);
  }

  async function profile() {
    const document = await request(`/users/${encodeURIComponent(uid)}`, { method: 'GET', missing: true, maxBytes: 2097152 });
    if (document === null) return null;
    if (!plain(document) || document.name !== `${name}/users/${uid}`) throw invalidData();
    if (document.createTime !== undefined) timestamp(document.createTime);
    if (document.updateTime !== undefined) timestamp(document.updateTime);
    return recordDates(decodeFields(document.fields));
  }

  function collection(collectionId) {
    if (!['transactions', 'budgets'].includes(collectionId)) throw invalidData();
    const maximum = collectionId === 'transactions' ? MAX_TRANSACTIONS + 1 : MAX_BUDGETS + 1;
    return {
      where(field, operator, ownerId) {
        if (field !== 'userId' || operator !== '==' || ownerId !== uid) throw invalidData();
        return {
          limit(limit) {
            if (!Number.isInteger(limit) || limit < 1 || limit > maximum) throw invalidData();
            return {
              async get() {
                const results = await request(':runQuery', {
                  body: { structuredQuery: {
                    from: [{ collectionId }],
                    where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } },
                    limit,
                  } },
                  maxBytes: 33554432,
                  tooLarge: () => new HttpError(422, 'finance/too-large', 'This account exceeds the assistant data limit. No partial totals were sent.'),
                });
                if (!Array.isArray(results) || results.length > limit + 1) throw invalidData();
                const docs = [];
                const seen = new Set();
                const prefix = `${name}/${collectionId}/`;
                for (const result of results) {
                  if (!plain(result) || (result.skippedResults !== undefined && result.skippedResults !== 0)) throw invalidData();
                  if (result.readTime !== undefined) timestamp(result.readTime);
                  if (!result.document) {
                    if (result.document !== undefined || typeof result.readTime !== 'string') throw invalidData();
                    timestamp(result.readTime);
                    continue;
                  }
                  const document = result.document;
                  if (!plain(document) || typeof document.name !== 'string' || !document.name.startsWith(prefix)) throw invalidData();
                  if (document.createTime !== undefined) timestamp(document.createTime);
                  if (document.updateTime !== undefined) timestamp(document.updateTime);
                  const id = document.name.slice(prefix.length);
                  if (!id || id.includes('/') || seen.has(id)) throw invalidData();
                  seen.add(id);
                  const record = recordDates(decodeFields(document.fields));
                  if (record.userId !== uid) throw invalidData();
                  docs.push({ id, data: () => record });
                  if (docs.length > limit) throw invalidData();
                }
                return { docs, size: docs.length };
              },
            };
          },
        };
      },
    };
  }

  return { name, request, profile, collection };
}

module.exports = { createFirestoreClient, decodeFields, timestamp, FirestoreConflict };
