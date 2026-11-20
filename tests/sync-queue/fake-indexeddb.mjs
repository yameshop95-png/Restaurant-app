// IndexedDB giả, lưu xuống file JSON — đủ cho lib/listCache dùng (open / transaction / get / put / clear).
// Mỗi "phiên app" trong test là một process riêng; file JSON là thứ tồn tại giữa các phiên,
// đúng vai trò của IndexedDB thật trên máy. Chỉ dùng cho test (tests/sync-queue), không vào app.
import fs from 'node:fs';
import path from 'node:path';

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

  globalThis.indexedDB = {
    open(_name, version = 1) {
      const req = {};
      later(() => {
        const state = load();
        const db = {
          objectStoreNames: { contains: (s) => s in state.stores },
          createObjectStore: (s) => {
            state.stores[s] ??= {};
            save(state);
          },
          transaction: (storeName) => {
            const tx = {};
            tx.objectStore = () => ({
              get: (key) => {
                const r = {};
                later(() => {
                  r.result = load().stores[storeName]?.[key];
                  if (r.result !== undefined) r.result = JSON.parse(JSON.stringify(r.result));
                  req0(r);
                });
                return r;
              },
              put: (value, key) => {
                const r = {};
                later(() => {
                  const st = load();
                  (st.stores[storeName] ??= {})[key] = JSON.parse(JSON.stringify(value));
                  save(st);
                  r.result = key;
                  req0(r);
                });
                return r;
              },
              clear: () => {
                const r = {};
                later(() => {
                  const st = load();
                  st.stores[storeName] = {};
                  save(st);
                  req0(r);
                });
                return r;
              },
            });
            function req0(r) {
              r.onsuccess?.();
              tx.oncomplete?.();
            }
            return tx;
          },
        };
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
