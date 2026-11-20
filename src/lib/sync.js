// Hàng đợi ghi lên máy chủ: mọi thay đổi hiện ngay trên máy, rồi được gửi lần lượt theo thứ tự.
// Mất mạng thì giữ lại và tự gửi lại khi có mạng (cứ 10 giây thử một lần, hoặc khi bấm "Thử lại").
// Hàng đợi được LƯU BỀN trên máy (IndexedDB, kho 'sync' của lib/listCache): tắt hẳn app khi đang mất mạng
// mở lại vẫn còn nguyên, tự gửi tiếp khi có mạng. Mỗi thao tác kèm một "spec" (mô tả dạng dữ liệu thuần)
// để dựng lại lệnh gửi sau khi mở lại app — các hàm write trong hooks/use* đều gắn spec khi tạo thao tác.
// Thao tác bị máy chủ từ chối (không phải lỗi mạng) được giữ lại trong danh sách lỗi đã lưu bền:
// bấm "Thử lại" (retrySync) để gửi lại, bấm bỏ qua (clearError) là chấp nhận bỏ hẳn.
import { isNetworkError, supabase } from './supabase';
import { syncCacheGet, syncCacheSet } from './listCache';

const QUEUE_KEY = 'queue';
const FAILED_KEY = 'failed';

// Dựng lệnh gửi từ spec đã lưu. Mọi lệnh đều an toàn khi gửi lại (upsert / vá từng trường / xoá theo id),
// nên thao tác đang gửi dở lúc app tắt cứ gửi lại từ đầu khi mở lại app.
export function runSpec(spec) {
  switch (spec?.kind) {
    case 'upsert': {
      const q = supabase.from(spec.table).upsert(spec.rows);
      return spec.select ? q.select() : q;
    }
    case 'delete':
      return supabase.from(spec.table).delete().eq('id', spec.rowId);
    case 'update':
      return supabase.from(spec.table).update(spec.values).eq('id', spec.rowId);
    case 'rpc':
      return supabase.rpc(spec.name, spec.args);
    default:
      return Promise.resolve({ error: { message: `Không rõ loại thao tác: ${spec?.kind ?? 'trống'}` } });
  }
}

export const runFromSpec = (spec) => () => runSpec(spec);

const queue = []; // { table, rowId, spec?, run: () => Promise<{ data, error }>, onDone }
let failedOps = []; // { table, rowId, spec, error, at } — bị từ chối, giữ lại chờ người dùng quyết định
let running = false;
let offlineError = null; // lỗi mạng đang chặn hàng đợi
let lastError = null; // lỗi không thử lại được (sai quyền...), hiện cho người dùng
let refetchAfterDrain = false; // có thao tác khôi phục từ lần chạy trước: gửi xong thì báo tải lại cho khớp máy chủ
const listeners = new Set();
const drainListeners = new Set();

const emit = () => listeners.forEach((fn) => fn());

// --- Lưu bền hàng đợi ---
let restored = false;
const serialize = ({ table, rowId, spec }) => ({ table, rowId, spec });
const persistQueue = () => {
  if (!restored) return; // chưa đọc xong bản đã lưu: đừng ghi đè mất
  syncCacheSet(QUEUE_KEY, queue.filter((op) => op.spec).map(serialize));
};
const persistFailed = () => {
  if (!restored) return;
  syncCacheSet(FAILED_KEY, failedOps);
};

// Đọc lại hàng đợi + danh sách lỗi đã lưu từ lần chạy trước, chèn lên đầu hàng đợi rồi gửi tiếp.
// Chạy ngay khi module được nạp; useCloudList chờ syncReady() trước lần tải dữ liệu đầu tiên
// để hasPending() nói đúng (tránh tải toàn bộ đè mất dòng đang chờ gửi).
const restorePromise = (async () => {
  try {
    const [savedQueue, savedFailed] = await Promise.all([syncCacheGet(QUEUE_KEY), syncCacheGet(FAILED_KEY)]);
    if (Array.isArray(savedFailed)) {
      failedOps = savedFailed.filter((f) => f?.spec);
      if (failedOps.length) lastError = failedOps[failedOps.length - 1].error;
    }
    if (Array.isArray(savedQueue)) {
      const ops = savedQueue
        .filter((o) => o?.spec)
        .map((o) => ({ table: o.table, rowId: o.rowId, spec: o.spec, run: runFromSpec(o.spec) }));
      if (ops.length) {
        queue.unshift(...ops);
        refetchAfterDrain = true;
      }
    }
  } catch {
    // Không đọc được bản lưu (IndexedDB bị chặn...): chạy như hàng đợi trong bộ nhớ như trước
  }
  restored = true;
  persistQueue();
  persistFailed();
  emit();
  pump();
})();

export const syncReady = () => restorePromise;

export function syncState() {
  return { pending: queue.length, offline: Boolean(offlineError), error: lastError, failed: failedOps.length };
}

export function subscribeSync(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Gọi khi hàng đợi gửi hết sau một lần bị lỗi, để tải lại dữ liệu cho khớp máy chủ
export function onDrained(fn) {
  drainListeners.add(fn);
  return () => drainListeners.delete(fn);
}

export const hasPending = (table, rowId) =>
  queue.some((op) => op.table === table && (rowId === undefined || op.rowId === rowId));

export function enqueue(op) {
  queue.push(op);
  persistQueue();
  emit();
  pump();
}

// Người dùng bấm bỏ qua lỗi: chấp nhận bỏ các thao tác đã bị từ chối (đã lưu bền) + tắt thông báo
export const clearError = () => {
  lastError = null;
  if (failedOps.length) {
    failedOps = [];
    persistFailed();
  }
  emit();
};

async function pump() {
  if (running || !restored) return;
  running = true;
  let hadTrouble = Boolean(offlineError);
  while (queue.length) {
    const op = queue[0];
    let result;
    try {
      result = await op.run();
    } catch (err) {
      result = { error: { message: err?.message ?? String(err) } };
    }
    if (result?.error && isNetworkError(result.error)) {
      offlineError = result.error;
      running = false;
      emit();
      return;
    }
    // Gỡ đúng thao tác vừa gửi (không dùng shift(): retrySync có thể đã chèn thao tác cũ lên đầu trong lúc chờ)
    const doneAt = queue.indexOf(op);
    if (doneAt >= 0) queue.splice(doneAt, 1);
    persistQueue();
    offlineError = null;
    if (result?.error) {
      hadTrouble = true;
      lastError = result.error.message;
      // Giữ lại thao tác bị từ chối (nếu có spec) thay vì vứt mất: mở lại app vẫn còn, chờ Thử lại / bỏ qua
      if (op.spec) {
        failedOps.push({ table: op.table, rowId: op.rowId, spec: op.spec, error: result.error.message, at: new Date().toISOString() });
        persistFailed();
      }
    } else {
      op.onDone?.(result.data);
    }
    emit();
  }
  running = false;
  emit();
  if (hadTrouble || refetchAfterDrain) {
    refetchAfterDrain = false;
    drainListeners.forEach((fn) => fn());
  }
}

// "Thử lại": gửi tiếp hàng đợi + gửi lại cả các thao tác từng bị từ chối (đưa lên đầu, giữ thứ tự cũ)
export const retrySync = () => {
  if (failedOps.length) {
    const ops = failedOps.map((f) => ({ table: f.table, rowId: f.rowId, spec: f.spec, run: runFromSpec(f.spec) }));
    failedOps = [];
    lastError = null;
    queue.unshift(...ops);
    persistQueue();
    persistFailed();
    emit();
  }
  pump();
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', pump);
  setInterval(() => queue.length && pump(), 10000);
  // Đóng / tải lại trang khi còn thay đổi chưa gửi: trình duyệt hỏi lại
  window.addEventListener('beforeunload', (e) => {
    if (queue.length) e.preventDefault();
  });
}
