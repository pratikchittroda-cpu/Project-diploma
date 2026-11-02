const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const compiled = new Map();
function load(file, mocks = {}) {
  if (!compiled.has(file)) compiled.set(file, babel.transformSync(fs.readFileSync(path.join(root, file), 'utf8'), {
    filename: file, babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  }).code);
  const module = { exports: {} };
  vm.runInNewContext(compiled.get(file), { module, exports: module.exports, Date, Intl, setTimeout, clearTimeout,
    require: name => { if (name in mocks) return mocks[name]; throw new Error(`Unmocked import ${name} in ${file}`); },
  }, { filename: file });
  return module.exports;
}
const finance = load('utils/finance.js');
const plain = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const date = finance.localDate();
const month = date.slice(0, 7);
const stamp = `${date}T12:00:00.000Z`;
const transaction = (extra = {}) => ({ userId: 'owner', type: 'expense', amount: 1.01, category: 'food', description: 'Lunch', date, createdAt: stamp, updatedAt: stamp, ...extra });
const member = (extra = {}) => ({ userId: 'owner', name: 'Ada', role: 'Engineer', salary: 1200, status: 'active', department: 'General', email: '', joinDate: date, createdAt: stamp, updatedAt: stamp, ...extra });
const budget = (extra = {}) => ({ userId: 'owner', category: 'food', period: 'Monthly', amount: 100, type: 'personal', createdAt: stamp, updatedAt: stamp, ...extra });

// Local optimistic transaction simulator: reads track versions, writes stage
// until commit, conflicts retry the callback, and injected failures roll back.
// No Firebase SDK/configuration is loaded by these tests.
function harness(seed = {}) {
  const records = new Map(Object.entries(seed));
  const versions = new Map();
  const calls = [];
  const auth = { currentUser: { uid: 'owner' } };
  const controls = { queryWait: null, docWait: null, transactionRead: null, beforeCommit: null, failCommit: false };
  const ref = (collection, id) => ({ collection, id, path: `${collection}/${id}` });
  const write = (key, value) => { records.set(key, structuredClone(value)); versions.set(key, (versions.get(key) || 0) + 1); };
  const snapshot = reference => {
    const value = records.get(reference.path);
    return { id: reference.id, ref: reference, exists: () => value !== undefined, data: () => value === undefined ? undefined : structuredClone(value) };
  };
  let nextId = 0;
  const api = {
    collection: (_, name) => ({ name }), doc: (_, collection, id) => ref(collection, id),
    where: (field, op, value) => ({ kind: 'where', field, op, value }),
    orderBy: (field, direction) => ({ kind: 'order', field, direction }), documentId: () => '__name__',
    startAfter: cursor => ({ kind: 'cursor', cursor }), limit: count => ({ kind: 'limit', count }),
    query: (collection, ...constraints) => ({ collection: collection.name, constraints }),
    getDocsFromServer: async query => {
      calls.push({ kind: 'query', query });
      if (controls.queryWait) await controls.queryWait(query);
      let docs = [...records].filter(([key]) => key.split('/')[0] === query.collection).map(([key]) => snapshot(ref(...key.split('/'))));
      for (const c of query.constraints.filter(c => c.kind === 'where')) docs = docs.filter(s => s.data()[c.field] === c.value);
      const orders = query.constraints.filter(c => c.kind === 'order');
      const value = (s, field) => field === '__name__' ? s.id : s.data()[field];
      const compare = (a, b) => {
        for (const order of orders) { const av = value(a, order.field), bv = value(b, order.field); const diff = av < bv ? -1 : av > bv ? 1 : 0; if (diff) return diff * (order.direction === 'desc' ? -1 : 1); }
        return 0;
      };
      docs = docs.filter(s => orders.every(o => value(s, o.field) !== undefined)).sort(compare);
      const cursor = query.constraints.find(c => c.kind === 'cursor');
      if (cursor) docs = docs.filter(s => compare(s, cursor.cursor) > 0);
      const limit = query.constraints.find(c => c.kind === 'limit');
      if (limit) docs = docs.slice(0, limit.count);
      return { docs };
    },
    getDocFromServer: async reference => { calls.push({ kind: 'get', reference }); if (controls.docWait) await controls.docWait(reference); return snapshot(reference); },
    addDoc: async (collection, fields) => { const reference = ref(collection.name, `new-${++nextId}`); calls.push({ kind: 'add', reference }); write(reference.path, fields); return reference; },
    updateDoc: async (reference, fields) => { if (!records.has(reference.path)) throw new Error('not found'); calls.push({ kind: 'update', reference }); write(reference.path, { ...records.get(reference.path), ...fields }); },
    deleteDoc: async reference => { calls.push({ kind: 'delete', reference }); records.delete(reference.path); versions.set(reference.path, (versions.get(reference.path) || 0) + 1); },
    runTransaction: async (_, body) => {
      for (let attempt = 0; attempt < 8; attempt++) {
        const reads = new Map(), writes = new Map();
        const result = await body({
          get: async reference => {
            assert.equal(writes.size, 0, 'all reads must precede writes');
            const result = snapshot(reference);
            reads.set(reference.path, versions.get(reference.path) || 0);
            if (controls.transactionRead) await controls.transactionRead(reference);
            return result;
          },
          set: (reference, fields) => writes.set(reference.path, structuredClone(fields)),
        });
        if (controls.beforeCommit) await controls.beforeCommit({ attempt, reads, writes });
        if ([...reads].some(([key, version]) => (versions.get(key) || 0) !== version)) { calls.push({ kind: 'conflict' }); continue; }
        if (controls.failCommit) throw new Error('commit unavailable');
        for (const [key, fields] of writes) write(key, fields);
        calls.push({ kind: 'commit', paths: [...writes.keys()] });
        return result;
      }
      throw new Error('too many conflicts');
    },
  };
  const events = load('utils/financeEvents.js');
  const mocks = { 'firebase/firestore': api, '../config/firebase': { auth, db: {} }, '../utils/finance': finance, '../utils/financeEvents': events };
  const transactions = load('services/transactionService.js', mocks).default;
  const budgets = load('services/budgetService.js', { ...mocks, './transactionService': transactions }).default;
  const teams = load('services/teamService.js', { ...mocks, './transactionService': transactions }).default;
  return { records, calls, auth, controls, write, api, events, transactions, budgets, teams };
}

test('all finance components and hooks parse, including heading JSX', () => {
  const files = fs.readdirSync(path.join(root, 'components/finance')).map(file => `components/finance/${file}`);
  files.push('hooks/financeData.js', 'hooks/useTransactions.js', 'hooks/useBudgets.js');
  for (const file of files) assert.doesNotThrow(() => parser.parse(fs.readFileSync(path.join(root, file), 'utf8'), { sourceType: 'module', plugins: ['jsx'] }), file);
});

test('money input is strict while legacy read rounding is nearest paise, including 10.075', () => {
  for (const value of ['', '1e3', '0x10', '1,000', '-1', '.5', '1.', '1.005', '12abc', NaN, Infinity, null, {}, 0, -1, 1e-7, 1000000000.01]) assert.throws(() => finance.parseMoney(value), String(value));
  assert.equal(finance.parseMoney(' 12.30 '), 12.3);
  assert.equal(finance.parseMoney(0, { allowZero: true }), 0);
  assert.equal(finance.parseMoney(1000000000), 1000000000);
  for (const [value, expected] of [[10.075, 1008], [-10.075, -1008], [1.005, 101], [0.1, 10], [1e-7, 0]]) assert.equal(finance.toMinor(value), expected);
  assert.equal(finance.sumMoney([0.1, 0.2, 10.075]), 10.38);
  assert.equal(finance.subtractMoney(10.075, 0.1), 9.98);
  assert.equal(finance.divideMoney(100, 12), 8.33);
  assert.throws(() => finance.toMinor(Number.MAX_SAFE_INTEGER), /range/);
});

test('aggregates can exceed the per-record limit without floating-point drift', () => {
  const rows = [transaction({ amount: 1000000000 }), transaction({ amount: 1000000000 }), transaction({ type: 'income', amount: 0.01 })];
  const stats = finance.summarize(rows, finance.periodRange('Monthly'));
  assert.equal(stats.totalExpenses, 2000000000);
  assert.equal(stats.netAmount, -1999999999.99);
  assert.equal(finance.sumMoney(stats.categoryBreakdown, row => row.amount), 2000000000);
});

test('calendar ranges are Monday-based, half-open, leap-safe and use local date-only input', () => {
  const sunday = new Date(2024, 2, 10, 23, 30);
  assert.deepEqual(plain(finance.periodRange('Weekly', sunday)), { start: '2024-03-04', end: '2024-03-11', periodEnd: '2024-03-11', days: 7 });
  assert.equal(finance.periodRange('Monthly', new Date(2024, 1, 29, 12), { toDate: false }).end, '2024-03-01');
  assert.equal(finance.periodRange('Past Year', new Date(2024, 1, 29, 12)).start, '2023-02-28');
  assert.equal(finance.daysBetween('2024-03-09', '2024-03-12'), 3);
  assert.equal(finance.ledgerDate('2024-02-29'), '2024-02-29');
  for (const invalid of ['2023-02-29', '2024-04-31', '0099-01-01', '2024-2-01', '2024-02-30T00:00:00Z']) assert.throws(() => finance.ledgerDate(invalid));
  assert.equal(finance.inRange('2024-03-11', { start: '2024-03-04', end: '2024-03-11' }), false);
  assert.throws(() => finance.validateTransaction(transaction({ date: finance.addDays(date, 1) })), /Future/);
});

test('complete server snapshots and statistics include more than twenty transactions', async () => {
  for (const count of [0, 1, 20, 21, 45, 100, 1000]) {
    const seed = Object.fromEntries(Array.from({ length: count }, (_, i) => [`transactions/t${String(i).padStart(4, '0')}`, transaction()]));
    seed['transactions/other'] = transaction({ userId: 'other', amount: 900 });
    const h = harness(seed);
    const all = await h.transactions.getAllTransactions('owner');
    assert.equal(all.complete, true);
    assert.equal(all.transactions.length, count);
    const range = finance.periodRange('Monthly');
    const stats = await h.transactions.getTransactionStats('owner', range.start, range.end);
    assert.equal(stats.stats.totalExpenses, count * 101 / 100);
    assert.equal(stats.stats.count, count);
    assert.ok(h.calls.filter(c => c.kind === 'query').every(c => !c.query.constraints.some(k => k.kind === 'limit')));
  }
});

test('history pagination has stable equal-timestamp ordering, lookahead, and exact final hasMore', async () => {
  const h = harness(Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`transactions/t${String(i).padStart(3, '0')}`, transaction()])));
  const first = await h.transactions.getUserTransactions('owner');
  assert.equal(first.transactions.length, 20);
  assert.equal(first.transactions[0].id, 't039');
  assert.equal(first.hasMore, true);
  assert.equal(first.lastDoc.id, 't020');
  // A deleted boundary document is still a valid snapshot cursor.
  h.records.delete('transactions/t020');
  const second = await h.transactions.getUserTransactions('owner', 20, first.lastDoc);
  assert.equal(second.transactions.length, 20);
  assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.transactions, ...second.transactions].map(t => t.id)).size, 40);
  assert.equal(h.calls.filter(c => c.kind === 'query')[0].query.constraints.find(c => c.kind === 'limit').count, 21);
  assert.equal((await h.transactions.getUserTransactions('owner', 0)).success, false);
  assert.equal((await h.transactions.getUserTransactions('owner', 20, { data: () => ({ userId: 'other' }) })).success, false);
});

test('invalid stored records fail the whole snapshot instead of producing partial totals', async () => {
  for (const amount of ['10', NaN, -2, 1000000000.01]) {
    const h = harness({ 'transactions/good': transaction(), 'transactions/bad': transaction({ amount }) });
    const result = await h.transactions.getAllTransactions('owner');
    assert.equal(result.success, false);
    assert.equal(result.complete, undefined);
    assert.equal(result.transactions, undefined);
  }
  const h = harness({ 'transactions/legacy': transaction({ amount: 10.075, category: 'Food & Dining' }) });
  const result = await h.transactions.getAllTransactions('owner');
  assert.equal(result.transactions[0].amount, 10.08);
  assert.equal(result.transactions[0].category, 'food');
});

test('transaction writes whitelist fields, validate optional fields, and preserve immutable ownership/type', async () => {
  const h = harness();
  const result = await h.transactions.addTransaction('owner', transaction({ id: 'evil', userId: 'other', createdAt: 'evil', random: 'unsupported' }));
  assert.equal(result.success, true);
  const saved = h.records.get(`transactions/${result.transactionId}`);
  assert.equal(saved.userId, 'owner');
  assert.equal(saved.random, undefined);
  assert.equal(saved.id, undefined);
  assert.notEqual(saved.createdAt, 'evil');
  for (const data of [{ amount: '10.001' }, { department: 12 }, { paymentMethod: 'x'.repeat(41) }, { salaryMonth: '2026-13' }, { autoGenerated: 'true' }, { companyId: 'other' }]) assert.equal((await h.transactions.addTransaction('owner', transaction(data))).success, false);
  for (const changes of [{ userId: 'other' }, { type: 'income' }, { date: '' }, { amount: '1e3' }, { memberId: 'new-member' }]) assert.equal((await h.transactions.updateTransaction(result.transactionId, changes)).success, false);
  assert.equal((await h.transactions.updateTransaction(result.transactionId, { description: 'Corrected', amount: '2.30' })).success, true);
  assert.equal(h.records.get(`transactions/${result.transactionId}`).amount, 2.3);
});

test('server reads refuse stale sessions, including a new login to the same UID', async () => {
  for (const resource of ['transactions', 'budgets', 'members']) {
    const h = harness({ 'transactions/a': transaction(), 'budgets/a': budget(), 'members/a': member() });
    const gate = deferred();
    h.controls.queryWait = () => gate.promise;
    const pending = resource === 'transactions' ? h.transactions.getAllTransactions('owner') : resource === 'budgets' ? h.budgets.getUserBudgets('owner') : h.teams.getMembers('owner');
    h.auth.currentUser = { uid: 'owner' };
    gate.resolve();
    assert.equal((await pending).success, false, resource);
  }
  const h = harness({ 'transactions/a': transaction() });
  const gate = deferred();
  h.controls.docWait = () => gate.promise;
  const pending = h.transactions.deleteTransaction('a');
  h.auth.currentUser = { uid: 'other' };
  gate.resolve();
  assert.equal((await pending).success, false);
  assert.ok(h.records.has('transactions/a'));
});

test('derived summaries recheck auth after their constituent reads finish', async () => {
  const h = harness();
  h.transactions.getAllTransactions = async () => {
    h.auth.currentUser = { uid: 'other' };
    return { success: true, complete: true, transactions: [transaction()] };
  };
  assert.equal((await h.transactions.getTransactionsByCategory('owner', 'food')).success, false);
  h.auth.currentUser = { uid: 'owner' };
  h.budgets.getUserBudgets = async () => ({ success: true, complete: true, budgets: [] });
  h.transactions.getTransactionsByDateRange = async () => {
    h.auth.currentUser = { uid: 'other' };
    return { success: true, complete: true, transactions: [transaction()] };
  };
  const today = new Date();
  assert.equal((await h.budgets.getBudgetSummary('owner', today.getMonth() + 1, today.getFullYear())).success, false);
});

test('legacy budget duplicates resolve deterministically; canonical records and tombstones win per owner', () => {
  const records = [budget({ id: 'a', updatedAt: '2024-01-01' }), budget({ id: 'b', category: 'Food & Dining', updatedAt: '2024-02-01' })];
  assert.equal(finance.resolveBudgets(records)[0].id, 'b');
  const id = finance.budgetId('owner', 'food', 'Monthly');
  records.push(budget({ id, updatedAt: '2023-01-01' }));
  assert.equal(finance.resolveBudgets(records)[0].id, id);
  records[2].archived = true;
  records.push(budget({ id: 'other', userId: 'other' }));
  assert.equal(finance.resolveBudgets(records).length, 1);
  assert.equal(finance.resolveBudgets(records)[0].userId, 'other');
});

test('concurrent budget creation commits coherent three-period groups and failures are atomic', async () => {
  const h = harness();
  const results = await Promise.all([100, 200].map(amount => h.budgets.createBudget('owner', { category: 'food', period: 'Monthly', amount })));
  assert.ok(results.every(r => r.success));
  assert.equal(h.records.size, 3);
  const monthly = h.records.get(`budgets/${finance.budgetId('owner', 'food', 'Monthly')}`).amount;
  const expected = finance.budgetAmounts(monthly, 'Monthly');
  for (const period of finance.PERIODS) assert.equal(h.records.get(`budgets/${finance.budgetId('owner', 'food', period)}`).amount, expected[period]);
  assert.ok(h.calls.some(c => c.kind === 'conflict'));
  const before = plain([...h.records]);
  h.controls.failCommit = true;
  assert.equal((await h.budgets.createBudget('owner', { category: 'transport', period: 'Monthly', amount: 50 })).success, false);
  assert.deepEqual(plain([...h.records]), before);
});

test('deleting a fractional legacy budget writes rounded tombstones without deleting originals; recreation is explicit', async () => {
  const h = harness({ 'budgets/old': budget({ amount: 10.075 }), 'budgets/older': budget({ updatedAt: '2020-01-01T00:00:00.000Z' }) });
  assert.equal((await h.budgets.getUserBudgets('owner')).budgets[0].amount, 10.08);
  assert.equal((await h.budgets.deleteBudget('old')).success, true);
  assert.equal(h.records.get('budgets/old').amount, 10.075);
  assert.ok(h.records.has('budgets/older'));
  assert.equal((await h.budgets.getUserBudgets('owner')).budgets.length, 0);
  for (const period of finance.PERIODS) {
    const row = h.records.get(`budgets/${finance.budgetId('owner', 'food', period)}`);
    assert.equal(row.archived, true);
    assert.equal(row.amount, 10.08);
  }
  assert.equal((await h.budgets.updateBudget('old', { amount: 90 })).success, false);
  assert.equal((await h.budgets.deleteBudget('older')).success, false);
  assert.equal((await h.budgets.createBudget('owner', { category: 'food', period: 'Monthly', amount: 90 })).success, true);
  assert.equal((await h.budgets.getUserBudgets('owner')).budgets.length, 3);
});

test('competing legacy budget renames cannot fork a category into two live groups', async () => {
  const h = harness({ 'budgets/old': budget() });
  const results = await Promise.all(['transport', 'shopping'].map(category => h.budgets.updateBudget('old', { category, amount: 150 })));
  assert.equal(results.filter(r => r.success).length, 1);
  assert.match(results.find(r => !r.success).error, /changed/i);
  const rows = (await h.budgets.getUserBudgets('owner')).budgets;
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map(r => r.category)).size, 1);
  assert.notEqual(rows[0].category, 'food');
  assert.ok(h.records.has('budgets/old'));
});

test('budget updates preserve immutable optional type and invalid input never stages writes', async () => {
  const id = finance.budgetId('owner', 'food', 'Monthly');
  const legacy = budget(); delete legacy.type;
  const h = harness({ [`budgets/${id}`]: legacy });
  assert.equal((await h.budgets.updateBudget(id, { amount: 120 })).success, true);
  assert.equal(h.records.get(`budgets/${id}`).type, undefined);
  const count = h.calls.length;
  for (const data of [{ amount: '2x' }, { period: 'Daily' }, { category: 'invalid' }, { type: 'admin' }, { name: 'x'.repeat(121) }, { amount: 0.01, period: 'Yearly' }]) assert.equal((await h.budgets.createBudget('owner', { category: 'food', amount: 100, period: 'Monthly', ...data })).success, false);
  assert.equal(h.calls.length, count);
});

test('account switch during transaction reads prevents both budget and salary staging', async () => {
  for (const kind of ['budget', 'salary']) {
    const h = harness({ 'members/m1': member() });
    h.controls.transactionRead = async () => { h.auth.currentUser = { uid: 'other' }; };
    const result = kind === 'budget' ? await h.budgets.createBudget('owner', { category: 'food', amount: 100, period: 'Monthly' }) : await h.teams.createMonthlySalaryExpense('owner', { id: 'm1' });
    assert.equal(result.success, false);
    assert.equal(h.records.size, 1);
  }
});

test('concurrent salary generation uses one member/month record and fresh server salary values', async () => {
  const h = harness({ 'members/m1': member({ salary: 100 }) });
  const results = await Promise.all([1, 2].map(() => h.teams.createMonthlySalaryExpense('owner', { id: 'm1', salary: 99999 })));
  assert.equal(results.filter(r => r.success && !r.skipped).length, 1);
  assert.equal(results.filter(r => r.success && r.skipped).length, 1);
  const id = finance.salaryId('owner', 'm1', month);
  assert.equal(h.records.get(`transactions/${id}`).amount, 8.33);
  assert.equal(h.records.get(`transactions/${id}`).salaryMonth, month);
  assert.equal(h.records.get(`transactions/${id}`).date, date);
  assert.ok(h.calls.some(c => c.kind === 'conflict'));
});

test('salary transaction retries observe a member becoming inactive rather than posting stale salary', async () => {
  const h = harness({ 'members/m1': member() });
  let changed = false;
  h.controls.beforeCommit = async () => { if (!changed) { changed = true; h.write('members/m1', member({ status: 'inactive' })); } };
  const result = await h.teams.createMonthlySalaryExpense('owner', { id: 'm1' });
  assert.equal(result.success, true);
  assert.equal(result.reason, 'inactive_member');
  assert.equal([...h.records.keys()].filter(key => key.startsWith('transactions/')).length, 0);
});

test('salary batches honor over twenty legacy entries with one complete lookup and report retryable partial failures', async () => {
  const seed = {};
  for (let i = 0; i < 25; i++) {
    seed[`members/m${i}`] = member();
    seed[`transactions/legacy${i}`] = transaction({ category: i === 24 ? 'Salaries' : 'salaries', type: 'expense', memberId: `m${i}`, autoGenerated: true, salaryMonth: month, amount: 100 / 12 });
  }
  seed['members/new'] = member({ salary: 100 });
  seed['members/tiny'] = member({ salary: 0.01 });
  seed['members/inactive'] = member({ status: 'inactive' });
  const h = harness(seed);
  const result = await h.teams.checkAndCreateMonthlySalaries('owner');
  assert.equal(result.success, false);
  assert.equal(result.createdCount, 1);
  assert.equal(result.skippedCount, 25);
  assert.equal(result.failedCount, 1);
  assert.equal(result.results.length, 27);
  assert.equal(h.calls.filter(c => c.kind === 'query' && c.query.collection === 'transactions').length, 1);
  h.write('members/tiny', member({ salary: 0.12 }));
  const retry = await h.teams.checkAndCreateMonthlySalaries('owner');
  assert.equal(retry.success, true);
  assert.equal(retry.createdCount, 1);
  assert.equal(retry.skippedCount, 26);
  assert.equal(retry.failedCount, 0);
});

test('unverified salary lookup and malformed member/team input perform no writes', async () => {
  const h = harness({ 'members/m1': member() });
  for (const extra of [{ email: 12 }, { email: 'bad-address' }, { salary: '1e3' }, { status: 'unknown' }, { department: '' }, { color: {} }, { joinDate: '2024-02-30' }]) assert.equal((await h.teams.addMember('owner', member(extra))).success, false);
  assert.equal((await h.teams.addTeam('owner', { name: 'Team', budget: 1, icon: {} })).success, false);
  assert.equal((await h.teams.list('users', 'owner')).success, false);
  h.controls.queryWait = async () => { throw new Error('offline'); };
  assert.equal((await h.teams.createMonthlySalaryExpense('owner', { id: 'm1' })).success, false);
  assert.equal(h.records.size, 1);
});

test('finance invalidation listener failures cannot turn a committed write into a save failure', async () => {
  const h = harness();
  h.events.subscribeFinance(() => { throw new Error('broken view'); });
  h.events.subscribeFinance(async () => { throw new Error('failed refresh'); });
  const result = await h.transactions.addTransaction('owner', transaction());
  assert.equal(result.success, true);
  assert.equal(h.records.size, 1);
  await flush();
});

test('shared store requires complete arrays, deduplicates loads and preserves failed refresh evidence', async () => {
  const gate = deferred(); let calls = 0;
  const { createFinanceStore } = load('utils/financeStore.js');
  const loaders = { transactions: async () => { calls++; return gate.promise; }, budgets: async () => ({ success: true, complete: true, budgets: [] }) };
  const store = createFinanceStore(loaders); store.setAccount('owner');
  const first = store.load('owner', 'transactions');
  assert.equal(store.load('owner', 'transactions'), first);
  gate.resolve({ success: true, complete: true, transactions: Array.from({ length: 45 }, (_, id) => ({ id })) });
  await first;
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().transactions.rows.length, 45);
  loaders.transactions = async () => ({ success: true, transactions: [] });
  assert.equal((await store.load('owner', 'transactions')).success, false);
  assert.equal(store.getSnapshot().transactions.rows.length, 45);
  assert.match(store.getSnapshot().transactions.error, /complete/);
  loaders.transactions = async () => ({ success: true, complete: true });
  assert.equal((await store.load('owner', 'transactions')).success, false);
});

test('forced refresh and logout/login races cannot publish superseded financial data', async () => {
  const { createFinanceStore } = load('utils/financeStore.js');
  const gates = [deferred(), deferred(), deferred()]; let next = 0;
  const store = createFinanceStore({ transactions: () => gates[next++].promise });
  store.setAccount('owner');
  const old = store.load('owner', 'transactions'); await flush();
  const newer = store.load('owner', 'transactions', { force: true }); await flush();
  gates[1].resolve({ success: true, complete: true, transactions: [{ id: 'new' }] }); await newer;
  gates[0].resolve({ success: true, complete: true, transactions: [{ id: 'old' }] });
  assert.equal((await old).stale, true);
  assert.equal(store.getSnapshot().transactions.rows[0].id, 'new');
  const pending = store.load('owner', 'transactions'); await flush();
  store.setAccount(null); store.setAccount('owner');
  gates[2].reject(new Error('old-session failure'));
  assert.equal((await pending).stale, true);
  assert.equal(store.getSnapshot().transactions.rows.length, 0);
  assert.equal(store.getSnapshot().transactions.error, null);
});

function hookRuntime() {
  const slots = []; let index = 0; const effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  const react = {
    useState: initial => { const at = index++; if (!(at in slots)) slots[at] = typeof initial === 'function' ? initial() : initial; return [slots[at], value => { slots[at] = typeof value === 'function' ? value(slots[at]) : value; }]; },
    useRef: initial => { const at = index++; if (!(at in slots)) slots[at] = { current: initial }; return slots[at]; },
    useCallback: (callback, deps) => { const at = index++; if (!same(slots[at]?.deps, deps)) slots[at] = { deps, callback }; return slots[at].callback; },
    useEffect: (effect, deps) => { const at = index++; if (!same(slots[at]?.deps, deps)) { const old = slots[at]; slots[at] = { deps }; effects.push(() => { old?.cleanup?.(); slots[at].cleanup = effect(); }); } },
    useSyncExternalStore: (_, get) => get(),
  };
  return { react, render: component => { index = 0; const result = component(); while (effects.length) effects.shift()(); return result; }, unmount: () => { for (const slot of slots) slot?.cleanup?.(); } };
}

function historyHarness() {
  const runtime = hookRuntime(); const auth = { currentUser: { uid: 'owner' } }; let user = auth.currentUser;
  const observers = new Set(), requests = [];
  const events = load('utils/financeEvents.js');
  const service = { getUserTransactions: (uid, size, cursor) => { const gate = deferred(); requests.push({ uid, size, cursor, ...gate }); return gate.promise; } };
  const hooks = load('hooks/useTransactions.js', { react: runtime.react, 'firebase/auth': { onAuthStateChanged: (_, listener) => { observers.add(listener); return () => observers.delete(listener); } },
    '../config/firebase': { auth }, '../contexts/AuthContext': { useAuth: () => ({ user }) }, '../services/transactionService': service,
    './financeData': { useFinanceData: () => ({}) }, '../utils/finance': finance, '../utils/financeEvents': events });
  const render = () => runtime.render(() => hooks.useTransactionHistory(20));
  return { auth, requests, events, render, runtime, changeAuth: next => { auth.currentUser = next; for (const observer of observers) observer(next); }, changeContext: next => { user = next; } };
}
const page = (ids, hasMore = true) => ({ success: true, transactions: ids.map(id => ({ id })), lastDoc: { id: ids.at(-1) }, hasMore });

test('history hook deduplicates in-flight pages and refresh supersedes an older load-more response', async () => {
  const h = historyHarness(); h.render(); await flush();
  h.requests[0].resolve(page(['a', 'b'])); await flush();
  const loaded = h.render();
  assert.deepEqual(plain(loaded.rows.map(r => r.id)), ['a', 'b']);
  const more = loaded.loadMore();
  assert.equal(loaded.loadMore(), more);
  await flush();
  assert.equal(h.requests[1].cursor.id, 'b');
  const refresh = h.render().refresh(); await flush();
  h.requests[2].resolve(page(['new'], false)); await refresh;
  h.requests[1].resolve(page(['old'])); assert.equal((await more).stale, true);
  assert.deepEqual(plain(h.render().rows.map(r => r.id)), ['new']);
  await h.render().loadMore(); assert.equal(h.requests.length, 3);
  h.runtime.unmount();
});

test('history clears immediately on logout and discards responses from a previous same-UID login', async () => {
  const h = historyHarness(); h.render(); await flush();
  h.requests[0].resolve(page(['old'])); await flush();
  const pending = h.render().loadMore(); await flush();
  h.changeAuth(null);
  assert.equal(h.render().rows.length, 0);
  const nextUser = { uid: 'owner' }; h.changeAuth(nextUser); h.changeContext(nextUser); h.render(); await flush();
  h.requests[2].resolve(page(['new'])); await flush();
  h.requests[1].resolve(page(['leaked'])); assert.equal((await pending).stale, true);
  assert.deepEqual(plain(h.render().rows.map(r => r.id)), ['new']);
  h.events.invalidateFinance('other', 'transactions'); await flush(); assert.equal(h.requests.length, 3);
  h.events.invalidateFinance('owner', 'transactions'); await flush(); assert.equal(h.requests.length, 4);
  h.requests[3].resolve(page(['newest'])); await flush();
  h.runtime.unmount();
});

test('history refresh failure retries from the first page and repeated page IDs never duplicate rows', async () => {
  const h = historyHarness(); h.render(); await flush();
  h.requests[0].resolve(page(['a', 'b'])); await flush();
  const more = h.render().loadMore(); await flush();
  h.requests[1].resolve(page(['b', 'b', 'c'])); await more;
  assert.deepEqual(plain(h.render().rows.map(r => r.id)), ['a', 'b', 'c']);
  const refresh = h.render().refresh(); await flush();
  h.requests[2].resolve({ success: false, error: 'offline' }); await refresh;
  assert.equal(h.render().error, 'offline');
  const retry = h.render().loadMore(); await flush();
  assert.equal(h.requests[3].cursor, null);
  h.requests[3].resolve(page(['a', 'b'])); await retry;
  assert.deepEqual(plain(h.render().rows.map(r => r.id)), ['a', 'b']);
  h.runtime.unmount();
});

test('a committed mutation stays successful when its complete-ledger refresh fails', async () => {
  const runtime = hookRuntime(); const auth = { currentUser: { uid: 'owner' } };
  const data = { uid: 'owner', rows: [], complete: true, refresh: async () => ({ success: false, error: 'offline' }) };
  const hooks = load('hooks/useTransactions.js', { react: runtime.react, 'firebase/auth': {}, '../config/firebase': { auth }, '../contexts/AuthContext': {},
    '../services/transactionService': { addTransaction: async () => ({ success: true, transactionId: 'saved' }) },
    './financeData': { useFinanceData: () => data }, '../utils/finance': finance, '../utils/financeEvents': {} });
  const result = await runtime.render(hooks.useTransactions).addTransaction(transaction());
  assert.equal(result.success, true);
  assert.equal(result.transactionId, 'saved');
  assert.equal(result.refreshError, 'offline');
});
