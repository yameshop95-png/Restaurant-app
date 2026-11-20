// Lưu tạm dữ liệu các bảng trên máy (IndexedDB) để mở app là thấy ngay, rồi mới hỏi máy chủ phần thay đổi.
// Lỗi gì (trình duyệt chặn, chế độ ẩn danh...) thì coi như không có bản lưu tạm, app vẫn tải từ máy chủ như thường.
// Kho 'sync' riêng trong cùng database: giữ hàng đợi ghi chưa gửi được (lib/sync) — dữ liệu CHƯA lên máy chủ
// nên không xoá theo bản lưu tạm khi đăng xuất (cacheClear chỉ dọn kho 'lists').
const DB = 'restaurant-app-cache';
const STORE = 'lists';
const SYNC_STORE = 'sync';

let dbPromise = null;
function open() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(SYNC_STORE)) db.createObjectStore(SYNC_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function runIn(store, mode, fn) {
  return open().then(
    (db) =>
      db &&
      new Promise((resolve) => {
        try {
          const tx = db.transaction(store, mode);
          const req = fn(tx.objectStore(store));
          tx.oncomplete = () => resolve(req?.result ?? null);
          tx.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

const run = (mode, fn) => runIn(STORE, mode, fn);

export const cacheGet = (key) => run('readonly', (s) => s.get(key)).catch(() => null);
export const cacheSet = (key, value) => run('readwrite', (s) => s.put(value, key)).catch(() => null);
// Đăng xuất: xoá hết bản lưu tạm (trên máy có tên, SĐT khách) — kho 'sync' giữ nguyên (thay đổi chưa gửi)
export const cacheClear = () => run('readwrite', (s) => s.clear()).catch(() => null);

// Hàng đợi ghi chưa gửi (lib/sync): lưu bền trên máy để tắt app mở lại vẫn còn
export const syncCacheGet = (key) => runIn(SYNC_STORE, 'readonly', (s) => s.get(key)).catch(() => null);
export const syncCacheSet = (key, value) => runIn(SYNC_STORE, 'readwrite', (s) => s.put(value, key)).catch(() => null);
