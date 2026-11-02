// Ledger amounts remain numeric major units in Firestore. Arithmetic uses paise.
export const MAX_MONEY = 1000000000;
export const PERIODS = ['Weekly', 'Monthly', 'Yearly'];
export const PERSONAL_EXPENSES = ['food', 'transport', 'shopping', 'entertainment', 'bills', 'health', 'education', 'other'];
export const COMPANY_EXPENSES = ['office-supplies', 'marketing', 'transport', 'travel', 'utilities', 'rent', 'equipment', 'software', 'salaries', 'professional-services', 'insurance', 'other'];
export const PERSONAL_INCOME = ['salary', 'freelance', 'business', 'investment', 'gift', 'other'];
export const COMPANY_INCOME = ['sales', 'services', 'investment', 'consulting', 'other'];

export function parseMoney(value, { allowZero = false } = {}) {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Enter a valid amount');
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Use a decimal amount with at most two decimal places');
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount > MAX_MONEY || amount < 0 || (!allowZero && amount === 0)) {
    throw new Error(`Amount must be ${allowZero ? 'at least zero' : 'greater than zero'} and at most ${MAX_MONEY}`);
  }
  return Math.round(amount * 100) / 100;
}

// Legacy generated salaries/budgets can contain fractional paise. Read them with
// explicit nearest-paise rounding; new writes must pass parseMoney.
export function toMinor(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid stored amount');
  // Decimal shifting avoids binary multiplication turning 10.075 into 1007.499…
  // This also supports aggregate totals above the per-record MAX_MONEY limit.
  const [digits, exponent = '0'] = String(Math.abs(value)).split('e');
  const minor = Math.sign(value) * Math.round(Number(`${digits}e${Number(exponent) + 2}`));
  if (!Number.isSafeInteger(minor)) throw new Error('Amount total is outside the supported range');
  return minor;
}
export function fromMinor(value) {
  if (!Number.isSafeInteger(value)) throw new Error('Amount total is outside the supported range');
  return value / 100;
}
export function sumMoney(items, select = item => item) {
  return fromMinor(items.reduce((sum, item) => {
    const next = sum + toMinor(select(item));
    if (!Number.isSafeInteger(next)) throw new Error('Amount total is outside the supported range');
    return next;
  }, 0));
}
export function subtractMoney(a, b) { return fromMinor(toMinor(a) - toMinor(b)); }
export function divideMoney(value, divisor) {
  if (!Number.isFinite(divisor) || divisor <= 0) throw new Error('Invalid divisor');
  return fromMinor(Math.round(toMinor(value) / divisor));
}
export function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function localDate(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('Invalid date');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use a date in YYYY-MM-DD format');
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 9999) throw new Error('Date year must be between 1900 and 9999');
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error('Enter a real calendar date');
  return date;
}
export function ledgerDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    parseDateOnly(value);
    return value;
  }
  // Legacy ISO timestamps represent an instant; date-only strings never pass
  // through UTC parsing. The ledger's calendar is the device's local calendar.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) throw new Error('Invalid ledger date');
  parseDateOnly(value.slice(0, 10));
  return localDate(new Date(value));
}
export function addDays(value, count) {
  const date = parseDateOnly(value);
  date.setDate(date.getDate() + count);
  return localDate(date);
}
export function daysBetween(start, end) {
  const utcDay = value => {
    parseDateOnly(value);
    const [y, m, d] = value.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  };
  return utcDay(end) - utcDay(start);
}
export function periodRange(period = 'Monthly', now = new Date(), { toDate = true } = {}) {
  const today = localDate(now);
  const date = parseDateOnly(today);
  let start, end;
  if (['Weekly', 'This Week', 'week'].includes(period)) {
    // All finance screens use Monday-based calendar weeks.
    start = addDays(today, -((date.getDay() + 6) % 7));
    end = addDays(start, 7);
  } else if (['Yearly', 'This Year', 'year'].includes(period)) {
    start = `${date.getFullYear()}-01-01`;
    end = `${date.getFullYear() + 1}-01-01`;
  } else if (period === 'Past Year') {
    const year = date.getFullYear() - 1;
    const day = Math.min(date.getDate(), new Date(year, date.getMonth() + 1, 0).getDate());
    start = localDate(new Date(year, date.getMonth(), day, 12));
    end = addDays(today, 1);
  } else if (period === 'All Time') {
    start = '1900-01-01';
    end = addDays(today, 1);
  } else {
    start = localDate(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    end = localDate(new Date(date.getFullYear(), date.getMonth() + 1, 1, 12));
  }
  const periodEnd = end;
  if (toDate && end > addDays(today, 1)) end = addDays(today, 1);
  return { start, end, periodEnd, days: Math.max(1, daysBetween(start, end)) };
}
export function inRange(value, { start, end }) {
  const date = ledgerDate(value);
  return date >= start && date < end;
}
export function summarize(transactions, range) {
  const rows = range ? transactions.filter(t => inRange(t.date || t.createdAt, range)) : transactions;
  const totalIncome = sumMoney(rows.filter(t => t.type === 'income'), t => t.amount);
  const totalExpenses = sumMoney(rows.filter(t => t.type === 'expense'), t => t.amount);
  const groups = new Map();
  for (const row of rows.filter(t => t.type === 'expense')) {
    const key = normalizeCategory(row.category);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return { totalIncome, totalExpenses, netAmount: subtractMoney(totalIncome, totalExpenses), count: rows.length,
    avgDailySpending: range ? fromMinor(Math.round(toMinor(totalExpenses) / range.days)) : null,
    categoryBreakdown: [...groups].map(([name, entries]) => ({ name, amount: sumMoney(entries, t => t.amount), count: entries.length, type: 'expense' })) };
}
export function normalizeCategory(value) {
  const text = String(value || '').trim().toLowerCase();
  const aliases = { 'food & dining': 'food', 'food and dining': 'food', transportation: 'transport', 'bills & utilities': 'bills', 'bills and utilities': 'bills', healthcare: 'health', medical: 'health', others: 'other', 'office supplies': 'office-supplies', 'travel & expenses': 'travel', 'software & subscriptions': 'software', 'professional services': 'professional-services' };
  return aliases[text] || text;
}
export function requireText(value, label, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${label} is required (maximum ${max} characters)`);
  return value.trim();
}
export function optionalText(value, label, max) {
  if (typeof value !== 'string' || value.trim().length > max) throw new Error(`${label} must be text (maximum ${max} characters)`);
  return value.trim();
}
export function validateTransaction(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Enter transaction details');
  if (!['income', 'expense'].includes(data.type)) throw new Error('Choose income or expense');
  if (typeof data.category !== 'string') throw new Error('Choose a valid category');
  const category = normalizeCategory(data.category);
  const allowed = data.type === 'expense' ? [...PERSONAL_EXPENSES, ...COMPANY_EXPENSES] : [...PERSONAL_INCOME, ...COMPANY_INCOME];
  if (!allowed.includes(category)) throw new Error('Choose a valid category');
  const date = ledgerDate(data.date);
  if (date > localDate()) throw new Error('Future transactions are not supported');
  const clean = { type: data.type, amount: parseMoney(data.amount), category, date, description: requireText(data.description, 'Description', 500) };
  for (const [field, max] of [['department', 120], ['note', 1000], ['paymentMethod', 40]]) {
    if (field in data) clean[field] = optionalText(data[field], field, max);
  }
  if ('userType' in data) {
    if (!['personal', 'company'].includes(data.userType)) throw new Error('Invalid account type');
    clean.userType = data.userType;
  }
  if ('companyId' in data) clean.companyId = requireText(data.companyId, 'Company ID', 128);
  if ('autoGenerated' in data) {
    if (typeof data.autoGenerated !== 'boolean') throw new Error('Invalid salary generation flag');
    clean.autoGenerated = data.autoGenerated;
  }
  if ('memberId' in data) clean.memberId = requireText(data.memberId, 'Member ID', 128);
  if ('salaryMonth' in data) {
    if (typeof data.salaryMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(data.salaryMonth)) throw new Error('Invalid salary month');
    clean.salaryMonth = data.salaryMonth;
  }
  return clean;
}
export function budgetId(userId, category, period) {
  return `budget_${encodeURIComponent(userId)}_${encodeURIComponent(normalizeCategory(category))}_${period}`;
}
export function salaryId(userId, memberId, month) {
  return `salary_${encodeURIComponent(userId)}_${encodeURIComponent(memberId)}_${month}`;
}
export function budgetAmounts(amount, period) {
  const minor = toMinor(parseMoney(amount));
  const periodsPerYear = { Weekly: 52, Monthly: 12, Yearly: 1 };
  if (!PERIODS.includes(period)) throw new Error('Choose a valid budget period');
  return Object.fromEntries(PERIODS.map(target => [target, parseMoney(fromMinor(Math.round(minor * periodsPerYear[period] / periodsPerYear[target])))]));
}

// One visible budget per category/period. Canonical records win; otherwise the
// latest legacy record wins deterministically. Raw duplicates are kept in DB.
export function resolveBudgets(records) {
  const groups = new Map();
  const keyFor = r => `${r.userId}|${normalizeCategory(r.category)}|${r.period}`;
  const hiddenCategories = new Set(records.filter(r => r.archived === true && r.id === budgetId(r.userId, r.category, r.period)).map(keyFor));
  for (const record of records) {
    const category = normalizeCategory(record.category);
    const key = keyFor(record);
    if (record.archived || hiddenCategories.has(key)) continue;
    const current = groups.get(key);
    const canonical = record.id === budgetId(record.userId, category, record.period);
    const currentCanonical = current?.id === budgetId(record.userId, category, record.period);
    if (!current || (canonical && !currentCanonical) || (canonical === currentCanonical && `${record.updatedAt || record.createdAt || ''}|${record.id}` > `${current.updatedAt || current.createdAt || ''}|${current.id}`)) groups.set(key, { ...record, category });
  }
  return [...groups.values()];
}
