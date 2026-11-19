// Lưu tạm dữ liệu các bảng trên máy (IndexedDB) để mở app là thấy ngay, rồi mới hỏi máy chủ phần thay đổi.
// Lỗi gì (trình duyệt chặn, chế độ ẩn danh...) thì coi như không có bản lưu tạm, app vẫn tải từ máy chủ như thường.
const DB = 'restaurant-app-cache';
const STORE = 'lists';

let dbPromise = null;
function open() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run(mode, fn) {
  return open().then(
    (db) =>
      db &&
      new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(req?.result ?? null);
          tx.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export const cacheGet = (key) => run('readonly', (s) => s.get(key)).catch(() => null);
export const cacheSet = (key, value) => run('readwrite', (s) => s.put(value, key)).catch(() => null);
// Đăng xuất: xoá hết bản lưu tạm (trên máy có tên, SĐT khách)
export const cacheClear = () => run('readwrite', (s) => s.clear()).catch(() => null);
