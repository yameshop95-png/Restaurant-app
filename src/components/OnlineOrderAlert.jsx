import { useEffect } from 'react';
import { Globe, X } from 'lucide-react';
import { ORDER_TYPES } from '../lib/orderStatus';

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

// Thông báo nổi ở đầu màn hình khi khách vừa đặt đơn qua website
export default function OnlineOrderAlert({ alerts, onOpen, onDismiss }) {
  useEffect(() => {
    if (!alerts.length) return undefined;
    const timer = setTimeout(() => onDismiss(alerts[0].id), 60000);
    return () => clearTimeout(timer);
  }, [alerts, onDismiss]);

  if (!alerts.length) return null;
  return (
    <div className="fixed inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 flex flex-col items-center gap-2 px-4 lg:pl-72">
      {alerts.slice(0, 3).map((o) => (
        <div
          key={o.id}
          role="alert"
          className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-blue-500 bg-card py-2.5 pl-4 pr-2 shadow-xl shadow-black/50"
        >
          <Globe size={20} className="shrink-0 text-blue-500" />
          <button onClick={() => onOpen(o)} className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-bold text-slate-900">
              Đơn online mới #{o.number} · {o.customer?.name}
            </span>
            <span className="block text-xs text-slate-500">
              {ORDER_TYPES[o.type === 'delivery' ? 'delivery' : 'pickup'].label} {o.deliverAt ? hhmm(o.deliverAt) : ''} · bấm để xem
            </span>
          </button>
          <button onClick={() => onDismiss(o.id)} className="shrink-0 rounded-lg p-2 text-slate-500 active:bg-slate-100" aria-label="Đóng thông báo">
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}
