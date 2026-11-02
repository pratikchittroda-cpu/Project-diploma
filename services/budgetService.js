import { collection, getDocsFromServer, doc, query, where, getDocFromServer, runTransaction } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import transactionService from './transactionService';
import { MAX_MONEY, PERIODS, PERSONAL_EXPENSES, COMPANY_EXPENSES, normalizeCategory, parseMoney, toMinor, fromMinor, requireText, budgetId, budgetAmounts, resolveBudgets, periodRange, summarize, subtractMoney } from '../utils/finance';
import { invalidateFinance, requireFinanceOwner } from '../utils/financeEvents';

const failure = error => ({ success: false, error: error.message || 'Unable to load budgets' });
const owner = userId => requireFinanceOwner(auth, userId);
const changed = () => new Error('Budget changed. Refresh and try again.');
const storedAmount = value => {
  if (value > MAX_MONEY || toMinor(value) <= 0) throw new Error('A stored budget needs correction before totals can be shown');
  return parseMoney(fromMinor(toMinor(value)));
};
// Reading both the selected record and its canonical slot makes concurrent
// edits/renames/deletes conflict, including legacy-to-canonical promotion.
async function verifySource(transaction, previous, canonical) {
  if (!previous) return;
  const snapshot = await transaction.get(doc(db, 'budgets', previous.id));
  if (!snapshot.exists() || previous.archived || ['userId', 'category', 'period', 'amount', 'updatedAt', 'archived', 'type', 'name', 'categoryName', 'createdAt'].some(key => snapshot.data()[key] !== previous[key])) throw changed();
  if (canonical?.exists() && previous.id !== canonical.id) throw changed();
}
const recordType = (saved, exists, fallback) => exists ? (saved.type === undefined ? {} : { type: saved.type }) : { type: fallback };

class BudgetService {
  async getUserBudgets(userId) {
    try {
      const active = owner(userId);
      const snapshot = await getDocsFromServer(query(collection(db, 'budgets'), where('userId', '==', userId)));
      active();
      const records = snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
      const budgets = resolveBudgets(records);
      for (const row of budgets) {
        if (!PERIODS.includes(row.period)) throw new Error('A stored budget needs correction before totals can be shown');
        row.amount = storedAmount(row.amount);
      }
      return { success: true, budgets, complete: true, duplicateCount: records.filter(r => !r.archived).length - budgets.length };
    } catch (error) { return failure(error); }
  }

  // All three periods are one atomic write. Historical duplicates are retained
  // and shadowed by the canonical document, rather than destructively migrated.
  async saveBudget(userId, data, previous = null) {
    try {
      const active = owner(userId);
      if (!data || typeof data !== 'object' || typeof data.category !== 'string') throw new Error('Choose a valid category');
      const category = normalizeCategory(data.category);
      if (![...PERSONAL_EXPENSES, ...COMPANY_EXPENSES].includes(category)) throw new Error('Choose a valid category');
      const amounts = budgetAmounts(data.amount, data.period);
      const type = data.type ?? 'personal';
      if (!['personal', 'company'].includes(type)) throw new Error('Choose a valid budget type');
      const categoryName = requireText(data.categoryName ?? category, 'Category name', 120);
      const name = requireText(data.name ?? categoryName, 'Budget name', 120);
      const oldCategory = previous ? normalizeCategory(previous.category) : category;
      if (previous?.userId && previous.userId !== userId) throw new Error('Budget ownership cannot change');
      const targets = PERIODS.map(period => ({ category, period, ref: doc(db, 'budgets', budgetId(userId, category, period)), archived: false }));
      if (oldCategory !== category) targets.push(...PERIODS.map(period => ({ category: oldCategory, period, ref: doc(db, 'budgets', budgetId(userId, oldCategory, period)), archived: true })));
      await runTransaction(db, async transaction => {
        active();
        const existing = await Promise.all(targets.map(target => transaction.get(target.ref)));
        const sourceIndex = previous ? targets.findIndex(target => target.category === oldCategory && target.period === previous.period) : -1;
        await verifySource(transaction, previous, existing[sourceIndex]);
        active();
        const timestamp = new Date().toISOString();
        targets.forEach((target, index) => {
          const saved = existing[index].exists() ? existing[index].data() : {};
          if (saved.userId && saved.userId !== userId) throw new Error('Budget ownership cannot change');
          if (!target.archived && saved.type !== undefined && saved.type !== type) throw new Error('Budget type cannot change');
          transaction.set(target.ref, {
            userId, category: target.category, period: target.period,
            amount: target.archived ? storedAmount(saved.amount ?? previous.amount) : amounts[target.period],
            categoryName: target.archived ? oldCategory : categoryName,
            name: target.archived ? oldCategory : name,
            ...recordType(saved, existing[index].exists(), target.archived ? (previous.type || type) : type), archived: target.archived,
            createdAt: saved.createdAt || timestamp, updatedAt: timestamp,
          });
        });
      });
      invalidateFinance(userId, 'budgets');
      return { success: true, budgetId: budgetId(userId, category, data.period), updatedPeriods: PERIODS };
    } catch (error) { return failure(error); }
  }
  createBudget(userId, data) { return this.saveBudget(userId, data); }
  async updateBudget(id, data) {
    try {
      const active = owner();
      const current = await this.getBudget(id);
      if (!current.success) return current;
      active();
      if ('userId' in data && data.userId !== current.budget.userId) throw new Error('Budget ownership cannot change');
      return this.saveBudget(current.budget.userId, { ...current.budget, ...data }, current.budget);
    } catch (error) { return failure(error); }
  }
  async getBudget(id) {
    try {
      const active = owner();
      const snapshot = await getDocFromServer(doc(db, 'budgets', id));
      active();
      if (!snapshot.exists()) throw new Error('Budget not found');
      owner(snapshot.data().userId);
      return { success: true, budget: { ...snapshot.data(), id: snapshot.id } };
    } catch (error) { return failure(error); }
  }
  async getBudgetByCategory(userId, category) {
    try {
      const active = owner(userId);
      const result = await this.getUserBudgets(userId);
      active();
      return result.success ? { success: true, budget: result.budgets.find(b => b.category === normalizeCategory(category) && b.period === 'Monthly') || null } : result;
    } catch (error) { return failure(error); }
  }
  // Remove from active budgets in all periods atomically. Tombstones deliberately
  // preserve old records and prevent legacy duplicates reappearing on reload.
  async deleteBudget(id) {
    try {
      const active = owner();
      const result = await this.getBudget(id);
      if (!result.success) return result;
      active();
      const budget = result.budget;
      owner(budget.userId);
      const refs = PERIODS.map(period => doc(db, 'budgets', budgetId(budget.userId, budget.category, period)));
      await runTransaction(db, async transaction => {
        active();
        const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
        await verifySource(transaction, budget, snapshots[PERIODS.indexOf(budget.period)]);
        active();
        const timestamp = new Date().toISOString();
        refs.forEach((ref, index) => {
          const existing = snapshots[index].exists() ? snapshots[index].data() : budget;
          if (existing.userId !== budget.userId) throw new Error('Budget ownership cannot change');
          transaction.set(ref, { userId: budget.userId, category: normalizeCategory(budget.category), period: PERIODS[index], amount: storedAmount(existing.amount),
            ...recordType(existing, snapshots[index].exists(), budget.type || 'personal'), archived: true, createdAt: existing.createdAt || timestamp, updatedAt: timestamp });
        });
      });
      invalidateFinance(budget.userId, 'budgets');
      return { success: true, archived: true, removedPeriods: PERIODS };
    } catch (error) { return failure(error); }
  }
  async getBudgetSummary(userId, month, year) {
    try {
      const active = owner(userId);
      if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 1900 || year > 9998) throw new Error('Invalid month/year');
      const range = periodRange('Monthly', new Date(year, month - 1, 1, 12), { toDate: false });
      const [budgetResult, transactionResult] = await Promise.all([this.getUserBudgets(userId), transactionService.getTransactionsByDateRange(userId, range.start, range.end)]);
      active();
      if (!budgetResult.success) return budgetResult;
      if (!transactionResult.success) return transactionResult;
      const spending = new Map(summarize(transactionResult.transactions).categoryBreakdown.map(c => [c.name, c.amount]));
      return { success: true, budgetSummary: budgetResult.budgets.filter(b => b.period === 'Monthly').map(b => {
        const spent = spending.get(b.category) || 0;
        return { ...b, spent, remaining: subtractMoney(b.amount, spent), percentage: spent / b.amount * 100 };
      }) };
    } catch (error) { return failure(error); }
  }
}
export default new BudgetService();
