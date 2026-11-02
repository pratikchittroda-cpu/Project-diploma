'use strict';

const { HttpError } = require('./lib/shared.cjs');
const { discardBody, readJSON } = require('./runtime.cjs');

const unauthenticated = () => new HttpError(401, 'auth/unauthenticated', 'Your session is invalid or expired. Please sign in again.');
const unavailable = () => new HttpError(503, 'auth/unavailable', 'Sign-in verification is temporarily unavailable.');

function transportFailure(error) {
  // Classify runtime incompatibility without returning an exception message,
  // stack, URL, token or key. This also makes hosted setup failures actionable.
  const message = typeof error?.message === 'string' ? error.message : '';
  const kinds = [['receiver', /illegal invocation|incompatible receiver/i],
    ['context', /global scope|request context|outside.*request/i],
    ['redirect', /redirect/i], ['signal', /AbortSignal|signal/i],
    ['headers', /headers|immutable/i], ['url', /url|protocol|hostname/i],
    ['network', /network|fetch failed|dns|socket|connection|ssl/i]];
  const kind = kinds.find(([, pattern]) => pattern.test(message))?.[0] ||
    (error?.name === 'TypeError' ? 'type' : 'unavailable');
  return new HttpError(503, `auth/transport-${kind}`, 'Sign-in verification could not reach its service.');
}

function decodePart(value) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw unauthenticated();
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    const bytes = Uint8Array.from(atob(padded), character => character.charCodeAt(0));
    const result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw unauthenticated();
    return result;
  } catch { throw unauthenticated(); }
}

function tokenFromRequest(request, projectId, now) {
  const authorization = request.headers.get('authorization') || '';
  if (authorization.length > 8192) throw unauthenticated();
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization);
  if (!match) throw unauthenticated();
  const token = match[1];
  const [headerPart, payloadPart] = token.split('.');
  const header = decodePart(headerPart);
  const claims = decodePart(payloadPart);
  const seconds = Math.floor(now / 1000);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.kid.length > 256 ||
      claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` ||
      typeof claims.sub !== 'string' || !claims.sub || [...claims.sub].length > 128 || /[\u0000-\u001f\u007f/]/.test(claims.sub) || ['.', '..'].includes(claims.sub) ||
      (claims.user_id !== undefined && claims.user_id !== claims.sub) ||
      !Number.isSafeInteger(claims.exp) || claims.exp <= seconds ||
      !Number.isSafeInteger(claims.iat) || claims.iat <= 0 || claims.iat > seconds + 60 || claims.iat >= claims.exp ||
      !Number.isSafeInteger(claims.auth_time) || claims.auth_time <= 0 || claims.auth_time > claims.iat) {
    throw unauthenticated();
  }
  // These decoded claims are constraints, not proof of identity. No UID is
  // accepted until Google has validated this exact token and returned its user.
  return { token, claims };
}

async function verifyIdentity(request, { projectId, apiKey, fetchImpl, scope, now }) {
  const { token, claims } = tokenFromRequest(request, projectId, now);
  let response;
  try {
    response = await scope.fetch(fetchImpl, `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }),
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw transportFailure(error);
  }
  if (!response.ok) {
    discardBody(response);
    if ([400, 401].includes(response.status)) throw unauthenticated();
    throw new HttpError(503, `auth/upstream-${response.status}`, 'Sign-in verification is temporarily unavailable.');
  }
  const result = await readJSON(response, 65536, scope, () => new HttpError(503, 'auth/invalid-upstream', 'Sign-in verification returned an invalid response.'));
  if (!Array.isArray(result?.users) || result.users.length !== 1) throw unauthenticated();
  const user = result.users[0];
  // Google omits an unset revocation cutoff (the same semantics as Firebase
  // Auth's revoked-token check). A supplied malformed cutoff is never ignored.
  const validSince = user?.validSince === undefined ? '0' : user.validSince;
  if (!user || typeof user !== 'object' || Array.isArray(user) || user.localId !== claims.sub ||
      (user.disabled !== undefined && typeof user.disabled !== 'boolean') ||
      typeof validSince !== 'string' || !/^\d{1,16}$/.test(validSince) || !Number.isSafeInteger(Number(validSince))) {
    throw unauthenticated();
  }
  if (user.disabled === true) throw new HttpError(403, 'auth/account-disabled', 'This sign-in account is unavailable.');
  if (claims.auth_time < Number(validSince)) {
    throw new HttpError(401, 'auth/session-revoked', 'Your session was revoked. Please sign in again.');
  }
  // The handler rechecks expiry after the authoritative network verification.
  return { uid: user.localId, token, expiresAt: claims.exp * 1000 };
}

module.exports = { verifyIdentity };
