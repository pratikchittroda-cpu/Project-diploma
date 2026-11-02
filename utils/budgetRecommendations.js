import { AI_CONFIG } from '../config/aiConfig';
import { MAX_MONEY, PERIODS, toMinor, fromMinor, localDate, parseDateOnly, ledgerDate, addDays, periodRange, normalizeCategory, resolveBudgets, sumMoney, subtractMoney, formatMoney } from './finance';

const KEYWORD_LABELS = {
  coffee: 'Coffee', diningOut: 'Dining out', snacks: 'Snacks', coldDrinks: 'Cold drinks',
  alcohol: 'Alcohol', shopping: 'Shopping', electronics: 'Electronics', entertainment: 'Entertainment',
  subscriptions: 'Subscriptions', personalCare: 'Personal care', travel: 'Travel',
};
const categoryLabel = category => category.replace(/-/g, ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase());
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const categoryFor = value => {
  if (typeof value !== 'string' || !value.trim()) throw new Error('An insight category needs correction.');
  return normalizeCategory(value);
};
const storedAmount = (value, allowZero = false) => {
  const minor = toMinor(value);
  if (value < 0 || value > MAX_MONEY || minor < 0 || (!allowZero && minor === 0)) throw new Error('An insight amount needs correction.');
  return fromMinor(minor);
};

function spendingByCategory(transactions, range) {
  const groups = new Map();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || transaction.date < range.start || transaction.date >= range.end) continue;
    if (!groups.has(transaction.category)) groups.set(transaction.category, []);
    groups.get(transaction.category).push(transaction);
  }
  return new Map([...groups].map(([category, rows]) => [category, { amount: sumMoney(rows, row => row.amount), count: rows.length }]));
}

function keywordMatchers() {
  if (!record(AI_CONFIG.NON_ESSENTIAL_KEYWORDS)) throw new Error('Local insight keywords are unavailable.');
  return Object.entries(AI_CONFIG.NON_ESSENTIAL_KEYWORDS).map(([type, keywords]) => {
    if (!Array.isArray(keywords) || keywords.some(keyword => typeof keyword !== 'string' || !keyword.trim())) throw new Error('Invalid local insight keywords.');
    const patterns = keywords.map(keyword => {
      const escaped = keyword.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match words/phrases, rather than treating "workshop" as "shop" spending.
      return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i');
    });
    return { type, patterns };
  });
}

/**
 * Local, deterministic insights for complete owner-scoped ledger/budget arrays.
 * Supply the device's current Date as { now }; no provider or profile defaults
 * are consulted. Invalid inputs throw, so callers never show partial tips.
 * Returns { id, title, message, type, icon, suggestions }[] (at most MAX_SUGGESTIONS).
 * Types: exceeded (>=100%), critical (>=90%), warning (>=70%), and tip.
 */
export function getBudgetRecommendations(transactions, budgets, { now } = {}) {
  if (!Array.isArray(transactions) || !Array.isArray(budgets)) throw new Error('Complete ledger and budget arrays are required for insights.');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('A valid local date is required for insights.');
  const today = localDate(now);
  const currentMonth = periodRange('Monthly', now);
  const previousMonth = periodRange('Monthly', parseDateOnly(addDays(currentMonth.start, -1)), { toDate: false });
  const { MIN_SAVINGS_AMOUNT: minimum, LOOKBACK_DAYS: lookbackDays, MAX_SUGGESTIONS: maximum } = AI_CONFIG.RECOMMENDATIONS;
  const thresholds = AI_CONFIG.BUDGET_THRESHOLDS;
  if (!Number.isSafeInteger(lookbackDays) || lookbackDays < 1 || lookbackDays > 365 || !Number.isSafeInteger(maximum) || maximum < 0 || minimum < 0) throw new Error('Invalid local insight limits.');
  const minimumMinor = toMinor(minimum);
  if (![thresholds?.WARNING, thresholds?.CRITICAL, thresholds?.EXCEEDED].every(Number.isFinite)
    || thresholds.WARNING <= 0 || thresholds.CRITICAL <= thresholds.WARNING || thresholds.EXCEEDED <= thresholds.CRITICAL) throw new Error('Invalid local budget thresholds.');
  const rolling = { start: addDays(today, 1 - lookbackDays), end: addDays(today, 1) };

  // Validate the entire input, including rows outside the displayed ranges.
  const rows = transactions.map(transaction => {
    if (!record(transaction) || !['income', 'expense'].includes(transaction.type)) throw new Error('An insight transaction needs correction.');
    if (transaction.description != null && typeof transaction.description !== 'string') throw new Error('An insight description needs correction.');
    return { type: transaction.type, category: categoryFor(transaction.category), amount: storedAmount(transaction.amount),
      date: ledgerDate(transaction.date || transaction.createdAt), description: transaction.description || '' };
  });
  const records = budgets.map(budget => {
    if (!record(budget) || !PERIODS.includes(budget.period) || (budget.archived !== undefined && typeof budget.archived !== 'boolean')) throw new Error('An insight budget needs correction.');
    return { ...budget, category: categoryFor(budget.category), amount: storedAmount(budget.amount, true) };
  });
  // Recurring saved Monthly records apply each month; canonical records and
  // archive tombstones shadow legacy duplicates exactly as in the budget store.
  const monthlyBudgets = resolveBudgets(records).filter(budget => budget.period === 'Monthly' && toMinor(budget.amount) > 0);
  if (new Set(monthlyBudgets.map(budget => budget.category)).size !== monthlyBudgets.length) throw new Error('Insight budgets must belong to one account.');
  const currentSpending = spendingByCategory(rows, currentMonth);
  const previousSpending = spendingByCategory(rows, previousMonth);
  const matchers = keywordMatchers();
  const matched = new Map();
  for (const transaction of rows) {
    if (transaction.type !== 'expense' || transaction.date < rolling.start || transaction.date >= rolling.end) continue;
    const match = matchers.find(group => group.patterns.some(pattern => pattern.test(transaction.description)));
    // A whole recorded transaction is counted once, never invented line items.
    if (!match) continue;
    if (!matched.has(match.type)) matched.set(match.type, []);
    matched.get(match.type).push(transaction);
  }
  const keywordSpending = [...matched].map(([type, entries]) => ({ type, amount: sumMoney(entries, entry => entry.amount), count: entries.length }));
  const budgetUsage = monthlyBudgets.map(budget => {
    const spent = currentSpending.get(budget.category)?.amount || 0;
    return { budget, spent, remaining: subtractMoney(budget.amount, spent), usage: toMinor(spent) / toMinor(budget.amount) };
  });

  // All validation and money arithmetic above must succeed before creating tips.
  const candidates = [];
  const add = (priority, amount, recommendation) => candidates.push({ priority, amount: toMinor(amount), recommendation });
  for (const { budget, spent, remaining, usage } of budgetUsage) {
    const type = usage >= thresholds.EXCEEDED ? 'exceeded' : usage >= thresholds.CRITICAL ? 'critical' : usage >= thresholds.WARNING ? 'warning' : null;
    if (!type) continue;
    const label = categoryLabel(budget.category);
    const status = type === 'exceeded' ? remaining < 0 ? 'exceeded' : 'fully used' : type === 'critical' ? 'near its limit' : `at ${thresholds.WARNING * 100}% or more`;
    add({ exceeded: 4, critical: 3, warning: 2 }[type], spent, {
      id: `budget:${currentMonth.start.slice(0, 7)}:${encodeURIComponent(budget.category)}`,
      title: `${label} budget ${status}`,
      message: `${formatMoney(spent)} of the saved ${formatMoney(budget.amount)} monthly limit used (${(usage * 100).toFixed(1)}%) from ${currentMonth.start} through ${today}.`,
      type, icon: type === 'exceeded' ? '🚨' : type === 'critical' ? '⚠️' : '💡',
      suggestions: [remaining < 0 ? `${formatMoney(subtractMoney(spent, budget.amount))} above the saved limit.` : `${formatMoney(remaining)} remains within the saved limit.`,
        `Review recorded ${label.toLowerCase()} entries before adding more spending this month.`],
    });
  }

  for (const { type, amount, count } of keywordSpending) {
    if (toMinor(amount) < minimumMinor || toMinor(amount) === 0) continue;
    const label = KEYWORD_LABELS[type] || categoryLabel(type);
    add(1, amount, {
      id: `savings:${type}:${rolling.start}:${today}`, title: `${label} spending review`,
      message: `${count} recorded expense ${count === 1 ? 'description matches' : 'descriptions match'} ${label.toLowerCase()} keywords, totaling ${formatMoney(amount)} from ${rolling.start} through ${today} (${lookbackDays} local days).`,
      type: 'tip', icon: '💰',
      suggestions: ['Review the matched entries to decide which purchases are optional.', `Use this recorded ${formatMoney(amount)} total to choose your own future spending reduction.`],
    });
  }

  const previousTop = [...previousSpending].sort(([a, left], [b, right]) => toMinor(right.amount) - toMinor(left.amount) || a.localeCompare(b))[0];
  if (previousTop && toMinor(previousTop[1].amount) > 0) {
    const [category, previous] = previousTop;
    const current = currentSpending.get(category)?.amount || 0;
    const label = categoryLabel(category);
    add(0, previous.amount, {
      id: `comparison:${previousMonth.start.slice(0, 7)}:${encodeURIComponent(category)}`, title: 'Previous-month spending pattern',
      message: `${label} was the largest expense category in ${previousMonth.start.slice(0, 7)} (full month): ${formatMoney(previous.amount)}. This month to date (${currentMonth.start} through ${today}): ${formatMoney(current)}.`,
      type: 'tip', icon: '📊',
      suggestions: [`Review ${label.toLowerCase()} entries in both periods.`, 'A full previous month and the current month to date cover different lengths of time.'],
    });
  }

  return candidates.sort((a, b) => b.priority - a.priority || b.amount - a.amount || a.recommendation.id.localeCompare(b.recommendation.id))
    .slice(0, maximum).map(candidate => candidate.recommendation);
}
