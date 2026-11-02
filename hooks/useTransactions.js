import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import transactionService from '../services/transactionService';
import { useFinanceData } from './financeData';
import { periodRange, summarize, daysBetween } from '../utils/finance';
import { subscribeFinance } from '../utils/financeEvents';

export const useTransactions = () => {
  const data = useFinanceData('transactions');
  const { uid, refresh } = data;
  const mutate = useCallback(async (method, ...args) => {
    if (!uid || auth?.currentUser?.uid !== uid) return { success: false, error: 'Please sign in again' };
    const session = auth.currentUser;
    const result = await transactionService[method](...args);
    if (auth.currentUser !== session) return { ...result, stale: true, error: 'Account changed' };
    // A saved write remains successful if its refresh fails; consumers can show
    // refreshError without encouraging the user to duplicate the write.
    if (result.success) {
      const reloaded = await refresh();
      if (auth.currentUser !== session) return { ...result, stale: true, error: 'Account changed' };
      if (!reloaded.success) return { ...result, refreshError: reloaded.error };
    }
    return result;
  }, [uid, refresh]);
  const addTransaction = useCallback(fields => mutate('addTransaction', uid, fields), [mutate, uid]);
  const updateTransaction = useCallback((id, fields) => mutate('updateTransaction', id, fields), [mutate]);
  const deleteTransaction = useCallback(id => mutate('deleteTransaction', id), [mutate]);
  const getTransactionStats = useCallback(async () => {
    if (!data.complete || data.error) return { success: false, error: data.error || 'Ledger is still loading' };
    const stats = summarize(data.rows, periodRange('Monthly'));
    return { success: true, data: { totalBalance: stats.netAmount, monthlyIncome: stats.totalIncome, monthlyExpenses: stats.totalExpenses } };
  }, [data.complete, data.error, data.rows]);
  return { transactions: data.rows, loading: data.loading, refreshing: data.refreshing, error: data.error,
    complete: data.complete, refresh, addTransaction, updateTransaction, deleteTransaction, getTransactionStats,
    hasMore: false, loadMore: async () => ({ success: true, complete: data.complete }) };
};

// History is a separate bounded query; never use these pages for ledger totals.
export function useTransactionHistory(pageSize = 20) {
  const { user } = useAuth();
  const uid = user?.uid;
  const generation = useRef(0);
  const currentUid = useRef(uid);
  currentUid.current = uid;
  const cursor = useRef(null);
  const pending = useRef(null);
  const [state, setState] = useState({ user, uid, rows: [], loading: true, error: null, hasMore: true });
  const load = useCallback((reset = false) => {
    if (!uid || auth?.currentUser !== user) return Promise.resolve({ success: false, error: 'Please sign in again' });
    if (pending.current && !reset) return pending.current;
    const revision = ++generation.current;
    const active = () => generation.current === revision && currentUid.current === uid && auth.currentUser === user;
    if (reset) cursor.current = null;
    const lastDoc = cursor.current;
    setState(previous => ({ ...previous, user, uid, loading: true, error: null, ...(reset ? { rows: [], hasMore: true } : {}) }));
    const promise = Promise.resolve().then(() => transactionService.getUserTransactions(uid, pageSize, lastDoc)).then(result => {
      if (!active()) return { success: false, stale: true };
      if (!result.success) throw new Error(result.error);
      cursor.current = result.lastDoc;
      setState(previous => {
        const ids = new Set(reset ? [] : previous.rows.map(t => t.id));
        return { user, uid, rows: [...(reset ? [] : previous.rows), ...result.transactions.filter(t => { if (ids.has(t.id)) return false; ids.add(t.id); return true; })], loading: false, error: null, hasMore: result.hasMore };
      });
      return result;
    }).catch(error => {
      if (!active()) return { success: false, stale: true, error: 'Account changed' };
      setState(previous => ({ ...previous, loading: false, error: error.message }));
      return { success: false, error: error.message };
    }).finally(() => { if (active()) pending.current = null; });
    pending.current = promise;
    return promise;
  }, [uid, user, pageSize]);
  useEffect(() => {
    cursor.current = null;
    pending.current = null;
    setState({ user, uid, rows: [], loading: !!uid, error: null, hasMore: true });
    if (uid) load(true);
    const unsubscribe = auth ? onAuthStateChanged(auth, session => {
      if (session === user) return;
      generation.current++; pending.current = null; cursor.current = null;
      setState({ user: null, uid: null, rows: [], loading: false, error: null, hasMore: true });
    }) : () => {};
    return () => { unsubscribe(); generation.current++; pending.current = null; };
  }, [uid, user, load]);
  useEffect(() => subscribeFinance((changedUid, resource) => {
    if (changedUid === uid && resource === 'transactions') return load(true);
  }), [uid, load]);
  const refresh = useCallback(() => load(true), [load]);
  const loadMore = useCallback(() => state.hasMore ? load(false) : Promise.resolve({ success: true }), [load, state.hasMore]);
  return { ...(state.user === user && auth?.currentUser === user ? state : { rows: [], loading: !!uid, error: null, hasMore: true }), refresh, loadMore };
}

export const useTransactionStats = (startDate, endDate) => {
  const ledger = useTransactions();
  let stats = null;
  let error = ledger.error;
  if (ledger.complete && !error && startDate && endDate) {
    try { stats = summarize(ledger.transactions, { start: startDate, end: endDate, days: Math.max(1, daysBetween(startDate, endDate)) }); }
    catch (caught) { error = caught.message; }
  }
  return { stats, loading: ledger.loading, error, refresh: ledger.refresh };
};
