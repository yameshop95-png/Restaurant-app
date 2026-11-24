import { Bell, Check, CloudOff, Loader2, Menu, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import useSyncStatus from '../hooks/useSyncStatus';
import { requestResync } from '../lib/resync';
import { clearError, retrySync } from '../lib/sync';
import { NAV_ITEMS } from './navigation';

// Trạng thái lưu lên máy chủ: chỉ hiện khi đang gửi, mất mạng hoặc bị từ chối
function SyncBadge() {
  const { pending, offline, error } = useSyncStatus();
  if (offline) {
    return (
      <button
        onClick={retrySync}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800"
      >
        <CloudOff size={15} className="shrink-0" /> Mất mạng · {pending} chưa lưu · Thử lại
      </button>
    );
  }
  if (error) {
    return (
      <button
        onClick={clearError}
        className="flex max-w-[60vw] items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-left text-xs font-semibold text-red-700"
      >
        <TriangleAlert size={15} className="shrink-0" />
        <span className="truncate">Không lưu được: {error}</span>
        <X size={14} className="shrink-0" />
      </button>
    );
  }
  if (pending) {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Đang lưu
      </span>
    );
  }
  return null;
}

// Nút đồng bộ tay (ý Paul 25/11): lúc app mở chậm hoặc số liệu chưa cập nhật, bấm để
// đẩy nốt thay đổi chưa gửi lên máy chủ rồi tải lại toàn bộ dữ liệu mới nhất xuống.
// Đang chạy thì icon quay; xong thì hiện dấu tick xanh 2 giây.
function ResyncButton() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setDone(false);
    try {
      retrySync();
      await requestResync();
    } finally {
      setBusy(false);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-70"
      aria-label="Đồng bộ lại dữ liệu"
      title="Đồng bộ lại dữ liệu"
    >
      {done && !busy ? (
        <Check size={22} className="text-emerald-500" />
      ) : (
        <RefreshCw size={22} className={busy ? 'animate-spin' : ''} />
      )}
    </button>
  );
}

// Header cố định phía trên vùng nội dung: tiêu đề tab + chuông thông báo.
export default function TopBar({ activeTab, pendingTotal, onMenuClick, onBellClick }) {
  const current = NAV_ITEMS.find((item) => item.id === activeTab);

  return (
    <header className="staff-chrome sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-card px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Mở menu"
      >
        <Menu size={22} />
      </button>

      <h1 className="truncate text-lg font-semibold text-slate-800">{current?.label}</h1>

      <div className="ml-auto">
        <SyncBadge />
      </div>

      <ResyncButton />

      <button
        onClick={onBellClick}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
        aria-label={`${pendingTotal} đơn chờ xử lý`}
      >
        <Bell size={22} />
        {pendingTotal > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 text-[13px] font-bold leading-none text-white ring-2 ring-card">
            {pendingTotal > 99 ? '99+' : pendingTotal}
          </span>
        )}
      </button>
    </header>
  );
}
