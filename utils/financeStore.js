// Framework-free account-scoped resource owner, also exercised by race tests.
export function createFinanceStore(loaders) {
  const empty = () => ({ rows: [], complete: false, loading: false, refreshing: false, error: null });
  let state = { uid: null, transactions: empty(), budgets: empty() };
  let accountGeneration = 0;
  const revisions = { transactions: 0, budgets: 0 };
  const pending = {};
  const listeners = new Set();
  const emit = () => { for (const listener of listeners) listener(); };
  const setAccount = uid => {
    if (state.uid === uid) return;
    accountGeneration++;
    state = { uid, transactions: empty(), budgets: empty() };
    delete pending.transactions; delete pending.budgets;
    emit();
  };
  const load = (uid, resource, { force = false } = {}) => {
    if (!(resource in revisions)) return Promise.resolve({ success: false, error: 'Invalid finance resource' });
    if (!uid || uid !== state.uid) return Promise.resolve({ success: false, error: 'Account changed', stale: true });
    if (pending[resource] && !force) return pending[resource];
    const account = accountGeneration;
    const revision = ++revisions[resource];
    const active = () => state.uid === uid && accountGeneration === account && revisions[resource] === revision;
    state = { ...state, [resource]: { ...state[resource], loading: !state[resource].complete, refreshing: state[resource].complete, error: null } };
    emit();
    const promise = Promise.resolve().then(() => loaders[resource](uid)).then(result => {
      if (!active()) return { success: false, stale: true, error: 'Request superseded' };
      if (!result?.success || result.complete !== true || !Array.isArray(result[resource])) throw new Error(result?.error || 'The complete ledger could not be verified');
      state = { ...state, [resource]: { rows: result[resource], complete: true, loading: false, refreshing: false, error: null } };
      emit();
      return result;
    }).catch(error => {
      if (!active()) return { success: false, stale: true, error: 'Request superseded' };
      state = { ...state, [resource]: { ...state[resource], loading: false, refreshing: false, error: error.message } };
      emit();
      return { success: false, error: error.message };
    }).finally(() => { if (active()) delete pending[resource]; });
    pending[resource] = promise;
    return promise;
  };
  return { getSnapshot: () => state, setAccount, load, subscribe: callback => { listeners.add(callback); return () => listeners.delete(callback); } };
}
