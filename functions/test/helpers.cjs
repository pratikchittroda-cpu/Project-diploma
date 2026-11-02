'use strict';
const clone = value => value === undefined ? undefined : structuredClone(value);
class MemoryDb {
  constructor(seed = {}) { this.data = new Map(Object.entries(clone(seed))); this.queue = Promise.resolve(); this.batchSizes = []; this.failCommit = null; }
  collection(name) { return this.query(name); }
  ref(path) {
    const db = this;
    return { path, id: path.split('/').at(-1), get: async () => db.snapshot(path), delete: async () => db.data.delete(path), set: async (value, options) => db.set(path, value, options) };
  }
  snapshot(path) { return { id: path.split('/').at(-1), ref: this.ref(path), exists: this.data.has(path), data: () => clone(this.data.get(path)) }; }
  set(path, value, options) { this.data.set(path, options?.merge ? { ...this.data.get(path), ...clone(value) } : clone(value)); }
  query(name, filters = [], max = Infinity, order = null) {
    const db = this;
    return {
      doc: id => db.ref(`${name}/${id}`),
      where: (field, op, value) => db.query(name, [...filters, [field, op, value]], max, order),
      limit: n => db.query(name, filters, n, order),
      orderBy: (field, direction = 'asc') => db.query(name, filters, max, [field, direction]),
      get: async () => {
        let entries = [...db.data].filter(([path, row]) => path.split('/').length === 2 && path.startsWith(`${name}/`) && filters.every(([field, op, value]) => {
          const actual = row[field];
          if (actual === undefined) return false;
          return op === '==' ? actual === value : op === '>=' ? actual >= value : op === '<' ? actual < value : op === '<=' ? actual <= value : op === 'in' ? value.includes(actual) : false;
        }));
        if (order) entries.sort((a, b) => (a[1][order[0]] > b[1][order[0]] ? 1 : -1) * (order[1] === 'desc' ? -1 : 1));
        const docs = entries.slice(0, max).map(([path]) => db.snapshot(path));
        return { docs, size: docs.length, empty: !docs.length };
      },
    };
  }
  batch() {
    const writes = [], db = this;
    return { delete: ref => writes.push(ref.path), commit: async () => {
      db.batchSizes.push(writes.length);
      if (writes.length > 500) throw new Error('Batch limit');
      if (db.failCommit) await db.failCommit();
      writes.forEach(path => db.data.delete(path));
    } };
  }
  runTransaction(callback) {
    const run = this.queue.then(async () => {
      const writes = [];
      const tx = { get: async ref => this.snapshot(ref.path),
        set: (ref, value, options) => writes.push(() => this.set(ref.path, value, options)),
        update: (ref, value) => writes.push(() => this.set(ref.path, value, { merge: true })),
        delete: ref => writes.push(() => this.data.delete(ref.path)),
      };
      const result = await callback(tx);
      writes.forEach(write => write());
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}
function fakeBucket(names = []) {
  const files = new Set(names), calls = [];
  const bucket = { files, calls, failName: null, getFiles: async options => {
    calls.push(options);
    return [[...files].filter(name => name.startsWith(options.prefix)).slice(0, options.maxResults).map(name => ({ name, delete: async () => {
      if (name === bucket.failName) throw new Error('PRIVATE storage failure');
      files.delete(name);
    } }))];
  } };
  return bucket;
}
module.exports = { MemoryDb, fakeBucket };
