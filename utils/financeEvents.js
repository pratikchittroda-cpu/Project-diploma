// Services invalidate only their owner's shared data, including salary writes.
const listeners = new Set();
export const subscribeFinance = callback => { listeners.add(callback); return () => listeners.delete(callback); };
export const invalidateFinance = (userId, resource) => {
  // A failed view refresh must never turn an already committed write into a
  // reported save failure (which would encourage duplicate submissions).
  for (const listener of listeners) {
    try { Promise.resolve(listener(userId, resource)).catch(() => {}); } catch (_) { /* listener owns refresh errors */ }
  }
};

// Capture the Firebase User as well as its UID. A logout/login to the same UID
// must not allow a previous session's asynchronous work to publish or write.
export function requireFinanceOwner(auth, userId = auth?.currentUser?.uid) {
  const user = auth?.currentUser;
  if (!userId || user?.uid !== userId) throw new Error('Please sign in again');
  return () => {
    if (auth?.currentUser !== user || auth?.currentUser?.uid !== userId) throw new Error('Account changed');
  };
}
