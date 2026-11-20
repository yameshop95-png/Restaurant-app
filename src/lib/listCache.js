// Lưu tạm dữ liệu các bảng trên máy (IndexedDB) để mở app là thấy ngay, rồi mới hỏi máy chủ phần thay đổi.
// Lỗi gì (trình duyệt chặn, chế độ ẩn danh...) thì coi như không có bản lưu tạm, app vẫn tải từ máy chủ như thường.
// Kho 'sync' riêng trong cùng database: giữ hàng đợi ghi chưa gửi được (lib/sync) — dữ liệu CHƯA lên máy chủ
// nên không xoá theo bản lưu tạm khi đăng xuất (cacheClear chỉ dọn kho 'lists' + 'rows', giữ nguyên kho 'sync').
//
// Từ DB v3: mỗi dòng lưu thành 1 bản ghi riêng trong kho 'rows' (khoá "row:<bảng>:<id>"), kho 'lists'
// chỉ còn giữ thông tin phụ của bảng (maxUpdated, hasUpdated, lastFull, thứ tự dòng). Nhờ vậy mỗi lần
// lưu chỉ ghi các dòng THAY ĐỔI kể từ lần lưu trước, thay vì ghi lại toàn bộ danh sách: ở 30.000 đơn,
// ghi toàn bộ tốn ~250 ms (đo trên VM) và lặp lại sau gần như mỗi thao tác trong giờ bận (~630 lần/giờ/máy).
// Bản ghi kiểu cũ (cả danh sách trong 1 bản ghi ở kho 'lists') vẫn đọc được: mở app vẫn hiện ngay như trước,
// lần lưu đầu tiên sau khi nâng cấp sẽ tự chuyển sang dạng từng dòng bằng 1 lần ghi toàn bộ nguyên tử.
const DB = 'restaurant-app-cache';
const STORE = 'lists';
const ROWS_STORE = 'rows';
const SYNC_STORE = 'sync';

let dbPromise = null;
function open() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 3);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(ROWS_STORE)) db.createObjectStore(ROWS_STORE);
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

// Đăng xuất: xoá hết bản lưu tạm (trên máy có tên, SĐT khách) — kho 'sync' giữ nguyên (thay đổi chưa gửi)
export const cacheClear = () =>
  open()
    .then(
      (db) =>
        db &&
        new Promise((resolve) => {
          try {
            const tx = db.transaction([STORE, ROWS_STORE], 'readwrite');
            tx.objectStore(STORE).clear();
            tx.objectStore(ROWS_STORE).clear();
            tx.oncomplete = () => resolve(null);
            tx.onerror = () => resolve(null);
            tx.onabort = () => resolve(null);
          } catch {
            resolve(null);
          }
        }),
    )
    .then(() => {
      savedLists.clear(); // kho đã trống: lần lưu sau phải ghi toàn bộ lại từ đầu
      return null;
    })
    .catch(() => null);

// Hàng đợi ghi chưa gửi (lib/sync): lưu bền trên máy để tắt app mở lại vẫn còn
export const syncCacheGet = (key) => runIn(SYNC_STORE, 'readonly', (s) => s.get(key)).catch(() => null);
export const syncCacheSet = (key, value) => runIn(SYNC_STORE, 'readwrite', (s) => s.put(value, key)).catch(() => null);

// ---- Bản lưu tạm theo từng dòng (dùng bởi hooks/useCloudList) ----

const rowPrefix = (table) => `row:${table}:`;
const rowKey = (table, id) => `${rowPrefix(table)}${id}`;
const rowRange = (table) =>
  typeof IDBKeyRange !== 'undefined' ? IDBKeyRange.bound(rowPrefix(table), `${rowPrefix(table)}\uffff`) : null;

// Ảnh chụp những gì kho 'rows' đang giữ, theo từng bảng: { byId: Map<id, item>, stored }.
// stored = false nghĩa là byId lấy từ bản ghi kiểu cũ (chưa hề nằm trong kho 'rows'):
// lần lưu kế tiếp phải ghi toàn bộ, không được ghi kiểu chênh lệch kẻo thiếu dòng.
// Ảnh chụp chỉ tiến lên khi transaction ghi thành công; ghi hỏng thì lần sau tính lại từ ảnh cũ.
const savedLists = new Map();
// Các lần lưu của cùng 1 bảng phải xếp hàng nối tiếp: 2 lần lưu chạy song song có thể ghi đè thứ tự
// và làm ảnh chụp đi lùi so với kho thật.
const saveChains = new Map();

// Đọc bản lưu tạm của 1 bảng: { items, maxUpdated, hasUpdated, lastFull } hoặc null nếu chưa có.
export function cacheLoadList(table) {
  return open()
    .then((db) => {
      if (!db) return null;
      return new Promise((resolve) => {
        let out = null;
        let assemble = null;
        try {
          const tx = db.transaction([STORE, ROWS_STORE], 'readonly');
          const metaReq = tx.objectStore(STORE).get(`list:${table}`);
          metaReq.onsuccess = () => {
            const meta = metaReq.result;
            if (!meta) return;
            const info = {
              maxUpdated: meta.maxUpdated ?? null,
              hasUpdated: Boolean(meta.hasUpdated),
              lastFull: meta.lastFull ?? 0,
            };
            if (Array.isArray(meta.items)) {
              // Bản ghi kiểu cũ: trả nguyên vẹn để app hiện ngay; ghi dấu stored=false để lần lưu
              // đầu tiên sau nâng cấp tự di trú sang dạng từng dòng (xem cacheSaveList).
              savedLists.set(table, { byId: new Map(meta.items.map((x) => [x.id, x])), stored: false });
              out = { items: meta.items, ...info };
              return;
            }
            const byId = new Map();
            const range = rowRange(table);
            const curReq = tx.objectStore(ROWS_STORE).openCursor(range ?? undefined);
            curReq.onsuccess = () => {
              const cur = curReq.result;
              if (!cur) return;
              if (range || String(cur.key).startsWith(rowPrefix(table))) byId.set(cur.value.id, cur.value);
              cur.continue();
            };
            assemble = () => {
              // Ghép lại đúng thứ tự đã lưu; dòng nào không có trong thứ tự (chỉ xảy ra nếu kho bị
              // can thiệp ngoài ý muốn) thì thêm ở cuối chứ không bỏ mất.
              const items = [];
              const seen = new Set();
              for (const id of Array.isArray(meta.order) ? meta.order : []) {
                const item = byId.get(id);
                if (item !== undefined) {
                  items.push(item);
                  seen.add(id);
                }
              }
              for (const [id, item] of byId) if (!seen.has(id)) items.push(item);
              savedLists.set(table, { byId, stored: true });
              return { items, ...info };
            };
          };
          tx.oncomplete = () => resolve(assemble ? assemble() : out);
          tx.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    })
    .catch(() => null);
}

// Lưu bản lưu tạm của 1 bảng. Chỉ ghi các dòng khác với ảnh chụp lần lưu trước (so theo tham chiếu:
// app luôn tạo object mới cho dòng thay đổi — cùng giả định mà đường ghi lên máy chủ trong
// useCloudList đang dựa vào khi tính phần khác biệt). Toàn bộ thay đổi + thông tin phụ nằm trong
// 1 transaction: hoặc ghi hết, hoặc không ghi gì — không có trạng thái dở dang.
export function cacheSaveList(table, items, info) {
  const task = (saveChains.get(table) ?? Promise.resolve()).then(() => saveListNow(table, items, info));
  saveChains.set(table, task);
  return task;
}

async function saveListNow(table, items, info) {
  const db = await open().catch(() => null);
  if (!db) return;
  const next = new Map(items.map((x) => [x.id, x]));
  const base = savedLists.get(table);
  const full = !base?.stored;
  const meta = {
    maxUpdated: info?.maxUpdated ?? null,
    hasUpdated: Boolean(info?.hasUpdated),
    lastFull: info?.lastFull ?? 0,
    perRow: 1,
    order: items.map((x) => x.id),
  };
  const ok = await new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE, ROWS_STORE], 'readwrite');
      const rows = tx.objectStore(ROWS_STORE);
      if (full) {
        // Ghi toàn bộ (lần đầu, sau đăng xuất, hoặc di trú từ bản ghi kiểu cũ): xoá sạch các dòng cũ
        // của bảng rồi ghi lại toàn bộ danh sách hiện tại — dòng đã bị máy chủ xoá không sống lại được.
        const keysReq = rows.getAllKeys(rowRange(table) ?? undefined);
        keysReq.onsuccess = () => {
          const prefix = rowPrefix(table);
          for (const key of keysReq.result ?? []) {
            if (typeof key === 'string' && key.startsWith(prefix)) rows.delete(key);
          }
          for (const item of items) rows.put(item, rowKey(table, item.id));
        };
      } else {
        for (const item of items) if (base.byId.get(item.id) !== item) rows.put(item, rowKey(table, item.id));
        for (const id of base.byId.keys()) if (!next.has(id)) rows.delete(rowKey(table, id));
      }
      tx.objectStore(STORE).put(meta, `list:${table}`);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
  if (ok) savedLists.set(table, { byId: next, stored: true });
}
