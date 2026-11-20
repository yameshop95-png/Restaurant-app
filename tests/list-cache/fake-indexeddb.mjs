// IndexedDB giả, lưu xuống file JSON — đủ cho lib/listCache dùng:
// nhiều kho, transaction nhiều kho, get / put / delete / clear / getAllKeys / openCursor + IDBKeyRange.bound.
// Mỗi "phiên app" trong test là một process riêng; file JSON là thứ tồn tại giữa các phiên,
// đúng vai trò của IndexedDB thật trên máy. Chỉ dùng cho test (tests/list-cache), không vào app.
// idbOps đếm số thao tác để test khẳng định được "chỉ ghi các dòng thay đổi" thay vì ghi lại tất cả.
import fs from 'node:fs';
import path from 'node:path';

export const idbOps = { get: 0, put: 0, delete: 0, clear: 0 };
export const resetIdbOps = () => Object.keys(idbOps).forEach((k) => (idbOps[k] = 0));

export function installFakeIndexedDB(dir) {
  const file = path.join(dir, 'idb.json');
  const load = () => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return { version: 0, stores: {} };
    }
  };
  const save = (state) => fs.writeFileSync(file, JSON.stringify(state));
  const later = (fn) => setTimeout(fn, 0);
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

  globalThis.IDBKeyRange = { bound: (lower, upper) => ({ lower, upper }) };
  const inRange = (key, range) => !range || (key >= range.lower && key <= range.upper);

  function makeTx() {
    const tx = { pending: 0, finished: false };
    tx.enqueue = (job) => {
      tx.pending += 1;
      later(() => {
        job();
        tx.pending -= 1;
        if (tx.pending === 0 && !tx.finished) {
          tx.finished = true;
          later(() => tx.oncomplete?.());
        }
      });
    };
    tx.objectStore = (storeName) => ({
      get: (key) => {
        const r = {};
        tx.enqueue(() => {
          idbOps.get += 1;
          r.result = clone(load().stores[storeName]?.[key]);
          r.onsuccess?.();
        });
        return r;
      },
      put: (value, key) => {
        const r = {};
        tx.enqueue(() => {
          idbOps.put += 1;
          const st = load();
          (st.stores[storeName] ??= {})[key] = clone(value);
          save(st);
          r.result = key;
          r.onsuccess?.();
        });
        return r;
      },
      delete: (key) => {
        const r = {};
        tx.enqueue(() => {
          idbOps.delete += 1;
          const st = load();
          if (st.stores[storeName]) delete st.stores[storeName][key];
          save(st);
          r.onsuccess?.();
        });
        return r;
      },
      clear: () => {
        const r = {};
        tx.enqueue(() => {
          idbOps.clear += 1;
          const st = load();
          st.stores[storeName] = {};
          save(st);
          r.onsuccess?.();
        });
        return r;
      },
      getAllKeys: (range) => {
        const r = {};
        tx.enqueue(() => {
          r.result = Object.keys(load().stores[storeName] ?? {})
            .filter((k) => inRange(k, range))
            .sort();
          r.onsuccess?.();
        });
        return r;
      },
      openCursor: (range) => {
        const r = {};
        tx.enqueue(() => {
          const keys = Object.keys(load().stores[storeName] ?? {})
            .filter((k) => inRange(k, range))
            .sort();
          let i = 0;
          const step = () => {
            if (i >= keys.length) {
              r.result = null;
              r.onsuccess?.();
              return;
            }
            const key = keys[i];
            i += 1;
            r.result = {
              key,
              value: clone(load().stores[storeName]?.[key]),
              continue: () => tx.enqueue(step),
            };
            r.onsuccess?.();
          };
          step();
        });
        return r;
      },
    });
    return tx;
  }

  const db = {
    objectStoreNames: { contains: (s) => s in load().stores },
    createObjectStore: (s) => {
      const st = load();
      st.stores[s] ??= {};
      save(st);
    },
    transaction: () => makeTx(),
  };

  globalThis.indexedDB = {
    open(_name, version = 1) {
      const req = {};
      later(() => {
        const state = load();
        req.result = db;
        if (version > (state.version ?? 0)) {
          state.version = version;
          save(state);
          req.onupgradeneeded?.();
        }
        req.onsuccess?.();
      });
      return req;
    },
  };
  return file;
}
