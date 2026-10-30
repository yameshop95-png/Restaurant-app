import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

export const UNDO_SECONDS = 8;

// Thanh "Hoàn tác" hiện ở cuối màn hình vài giây sau khi đổi trạng thái / thanh toán của đơn
export default function UndoToast({ toast, onUndo, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDismiss, UNDO_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className="fixed inset-x-0 bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))] z-40 flex justify-center px-4 lg:pl-72">
      <div
        role="status"
        className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 py-2 pl-4 pr-2 text-white shadow-xl"
      >
        <span className="min-w-0 flex-1 text-sm">{toast.label}</span>
        <button
          onClick={onUndo}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-bold text-amber-300 active:bg-white/25"
        >
          <RotateCcw size={16} /> Hoàn tác
        </button>
      </div>
    </div>
  );
}
