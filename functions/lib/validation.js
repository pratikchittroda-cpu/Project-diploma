'use strict';

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const CATEGORIES = ['food', 'transport', 'shopping', 'entertainment', 'bills', 'health', 'education', 'other', 'salaries', 'marketing', 'office-supplies', 'professional-services', 'insurance', 'travel', 'utilities', 'equipment', 'software', 'rent', 'sales', 'services', 'consulting', 'investment', 'salary', 'freelance', 'business', 'gift'];
const EXPENSE_CATEGORIES = CATEGORIES.filter(category => !['sales', 'services', 'consulting', 'investment', 'salary', 'freelance', 'business', 'gift'].includes(category));
const bad = () => { throw new HttpError(400, 'request/invalid', 'Invalid or oversized request.'); };
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) bad();
  return value;
}
function text(value, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) bad();
  return value.trim();
}
function money(n) { return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 1000000000 && n === Math.round(n * 100) / 100; }
function validateTimeZone(value) {
  if (typeof value !== 'string' || value.length > 100 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(value)) bad();
  try { return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone; }
  catch { bad(); }
}
function validateRequest(route, body) {
  if (route === '/account/delete') return object(body, []);
  if (route === '/report') {
    object(body, ['responseId', 'reason', 'details']);
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.responseId || '') || !['harmful', 'inaccurate', 'privacy', 'other'].includes(body.reason)) bad();
    return { responseId: body.responseId, reason: body.reason, details: text(body.details ?? '', 0, 1000) };
  }
  const keys = route === '/financial-chat' ? ['question', 'conversationHistory', 'consent', 'timeZone'] : route === '/categorize' ? ['description', 'consent'] : ['receiptText', 'consent'];
  object(body, keys);
  if (body.consent !== true) throw new HttpError(400, 'ai/consent-required', 'Affirmative AI data-sharing consent is required.');
  if (route === '/categorize') return { description: text(body.description, 2, 500) };
  if (route === '/parse-receipt') return { receiptText: text(body.receiptText, 2, 6000) };
  const history = body.conversationHistory ?? [];
  if (!Array.isArray(history) || history.length > 8) bad();
  const conversationHistory = history.map(message => {
    object(message, ['role', 'content']);
    if (!['user', 'assistant'].includes(message.role)) bad();
    return { role: message.role, content: text(message.content, 1, 2000) };
  });
  if (conversationHistory.reduce((n, m) => n + m.content.length, 0) > 8000) bad();
  return { question: text(body.question, 2, 2000), conversationHistory, timeZone: validateTimeZone(body.timeZone) };
}
function validateOutput(route, answer) {
  const invalid = () => { throw new HttpError(502, 'ai/invalid-output', 'The assistant returned an invalid result. Please try later.'); };
  if (typeof answer !== 'string' || !answer.trim() || answer.length > 12000) invalid();
  if (route === '/financial-chat') return { answer: answer.trim() };
  let value;
  try { value = JSON.parse(answer); } catch { invalid(); }
  if (route === '/categorize') {
    if (!value || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'category,confidence' || !EXPENSE_CATEGORIES.includes(value.category) || typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) invalid();
    return value;
  }
  if (!Array.isArray(value) || value.length > 50 || value.length === 0) invalid();
  for (const item of value) {
    if (!item || Object.keys(item).sort().join(',') !== 'name,price,quantity' || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 120 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000 || !money(item.price)) invalid();
  }
  return { items: value, requiresConfirmation: true };
}
function requireRecentAuth(token, now = Date.now()) {
  const age = now / 1000 - token.auth_time;
  if (typeof token.auth_time !== 'number' || !Number.isFinite(age) || age < -60 || age > 300) throw new HttpError(401, 'auth/requires-recent-login', 'Sign in again to confirm account deletion.');
}
module.exports = { HttpError, CATEGORIES, EXPENSE_CATEGORIES, validateRequest, validateOutput, requireRecentAuth, money, validateTimeZone };
