import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import transactionService from '../services/transactionService';
import budgetService from '../services/budgetService';
import { createFinanceStore } from '../utils/financeStore';
import { subscribeFinance } from '../utils/financeEvents';

const store = createFinanceStore({ transactions: uid => transactionService.getAllTransactions(uid), budgets: uid => budgetService.getUserBudgets(uid) });
// Clears protected data even if every finance screen has unmounted at logout.
if (auth) onAuthStateChanged(auth, user => store.setAccount(user?.uid || null));
subscribeFinance((uid, resource) => {
  if (uid === auth?.currentUser?.uid && store.getSnapshot().uid === uid) store.load(uid, resource, { force: true });
});
const EMPTY = { rows: [], complete: false, loading: true, refreshing: false, error: null };

export function useFinanceData(resource) {
  const { user } = useAuth();
  const uid = user && auth?.currentUser === user ? user.uid : null;
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const refresh = useCallback(() => {
    if (!uid || auth?.currentUser !== user) return Promise.resolve({ success: false, error: 'Please sign in again' });
    store.setAccount(uid);
    return store.load(uid, resource);
  }, [uid, user, resource]);
  useEffect(() => {
    if (!uid || auth?.currentUser !== user) return;
    store.setAccount(uid);
    if (!store.getSnapshot()[resource].complete) store.load(uid, resource);
  }, [uid, user, resource]);
  const data = snapshot.uid === uid && uid ? snapshot[resource] : EMPTY;
  return { ...data, uid, refresh, loading: !!uid && (!data.complete && !data.error || data.loading) };
}
