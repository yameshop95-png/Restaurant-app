// Hàng đợi ghi lên máy chủ: mọi thay đổi hiện ngay trên máy, rồi được gửi lần lượt theo thứ tự.
// Mất mạng thì giữ lại và tự gửi lại khi có mạng (cứ 10 giây thử một lần, hoặc khi bấm "Thử lại").
// Hàng đợi chỉ nằm trong bộ nhớ: tắt hẳn app khi đang mất mạng thì các thay đổi chưa gửi sẽ mất.
import { isNetworkError } from './supabase';

const queue = []; // { table, rowId, run: () => Promise<{ data, error }>, onDone }
let running = false;
let offlineError = null; // lỗi mạng đang chặn hàng đợi
let lastError = null; // lỗi không thử lại được (sai quyền...), hiện cho người dùng
const listeners = new Set();
const drainListeners = new Set();

const emit = () => listeners.forEach((fn) => fn());

export function syncState() {
  return { pending: queue.length, offline: Boolean(offlineError), error: lastError };
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
  emit();
  pump();
}

export const clearError = () => {
  lastError = null;
  emit();
};

async function pump() {
  if (running) return;
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
    queue.shift();
    offlineError = null;
    if (result?.error) {
      hadTrouble = true;
      lastError = result.error.message;
    } else {
      op.onDone?.(result.data);
    }
    emit();
  }
  running = false;
  emit();
  if (hadTrouble) drainListeners.forEach((fn) => fn());
}

export const retrySync = () => pump();

if (typeof window !== 'undefined') {
  window.addEventListener('online', pump);
  setInterval(() => queue.length && pump(), 10000);
  // Đóng / tải lại trang khi còn thay đổi chưa gửi: trình duyệt hỏi lại
  window.addEventListener('beforeunload', (e) => {
    if (queue.length) e.preventDefault();
  });
}
