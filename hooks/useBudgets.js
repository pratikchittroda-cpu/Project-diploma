import { useCallback } from 'react';
import { auth } from '../config/firebase';
import budgetService from '../services/budgetService';
import { useFinanceData } from './financeData';
import { useTransactions } from './useTransactions';
import { periodRange, summarize, subtractMoney } from '../utils/finance';

export const useBudgets = () => {
  const data = useFinanceData('budgets');
  const { uid, refresh } = data;
  const mutate = useCallback(async (method, ...args) => {
    if (!uid || auth?.currentUser?.uid !== uid) return { success: false, error: 'Please sign in again' };
    const session = auth.currentUser;
    const result = await budgetService[method](...args);
    if (auth.currentUser !== session) return { ...result, stale: true, error: 'Account changed' };
    if (result.success) {
      const loaded = await refresh();
      if (auth.currentUser !== session) return { ...result, stale: true, error: 'Account changed' };
      if (!loaded.success) return { ...result, refreshError: loaded.error };
    }
    return result;
  }, [uid, refresh]);
  const createBudget = useCallback(fields => mutate('createBudget', uid, fields), [mutate, uid]);
  const updateBudget = useCallback((id, fields) => mutate('updateBudget', id, fields), [mutate]);
  const deleteBudget = useCallback(id => mutate('deleteBudget', id), [mutate]);
  return { budgets: data.rows, loading: data.loading, refreshing: data.refreshing, complete: data.complete, error: data.error, refresh, createBudget, updateBudget, deleteBudget };
};

export const useBudgetSummary = (month, year) => {
  const budgets = useBudgets();
  const ledger = useTransactions();
  let budgetSummary = [];
  let error = budgets.error || ledger.error;
  if (budgets.complete && ledger.complete && !error) {
    try {
      if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 1900 || year > 9998) throw new Error('Invalid month/year');
      const range = periodRange('Monthly', new Date(year, month - 1, 1, 12), { toDate: false });
      const spending = new Map(summarize(ledger.transactions, range).categoryBreakdown.map(c => [c.name, c.amount]));
      budgetSummary = budgets.budgets.filter(b => b.period === 'Monthly').map(b => {
        const spent = spending.get(b.category) || 0;
        return { ...b, spent, remaining: subtractMoney(b.amount, spent), percentage: spent / b.amount * 100 };
      });
    } catch (caught) { error = caught.message; }
  }
  const refresh = useCallback(() => Promise.all([budgets.refresh(), ledger.refresh()]), [budgets.refresh, ledger.refresh]);
  return { budgetSummary, error, loading: budgets.loading || ledger.loading, refresh };
};
