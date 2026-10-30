import { useState } from 'react';
import { Check, Clock, MapPin, Phone, Plus, StickyNote, Truck, X } from 'lucide-react';
import NewOrderSheet from '../components/NewOrderSheet';
import { formatMoney, orderTotal } from '../lib/stats';

const FILTERS = [
  { id: 'pending', label: 'Chờ xử lý' },
  { id: 'done', label: 'Hoàn thành' },
  { id: 'cancelled', label: 'Đã huỷ' },
];

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700',
  done: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-200 text-slate-500',
};

function formatTime(iso, withDay = false) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dayDiff = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  if (dayDiff === 0) return withDay ? `${time} hôm nay` : time;
  if (withDay && dayDiff === 1) return `${time} ngày mai (${date})`;
  return `${time} · ${date}`;
}

function OrderCard({ order, onSetStatus }) {
  const label = FILTERS.find((f) => f.id === order.status).label;
  return (
    <li className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-900">
            #{order.number}
            {order.customer && <span> · {order.customer.name}</span>}
            {/* Đơn tạo trước khi có form khách hàng chỉ có ghi chú ngắn */}
            {!order.customer && order.note && <span className="font-semibold text-slate-600"> · {order.note}</span>}
          </p>
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <Clock size={12} /> Tạo lúc {formatTime(order.createdAt)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[order.status]}`}>
          {label}
        </span>
      </div>

      {order.customer && (
        <div className="mt-3 space-y-1.5 text-[15px] text-slate-700">
          {order.deliverAt && (
            <p className="flex items-center gap-2 font-semibold text-blue-700">
              <Truck size={16} className="shrink-0" /> Giao {formatTime(order.deliverAt, true)}
            </p>
          )}
          <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 text-slate-700 underline-offset-2 active:underline">
            <Phone size={16} className="shrink-0 text-slate-400" /> {order.customer.phone}
          </a>
          <p className="flex items-start gap-2">
            <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" /> {order.customer.address}
          </p>
        </div>
      )}

      {order.customer && order.note && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 font-semibold text-red-600">
          <StickyNote size={16} className="mt-0.5 shrink-0" /> {order.note}
        </p>
      )}

      <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[15px]">
        {order.items.map((item) => (
          <li key={item.name} className="flex justify-between gap-3">
            <span className="text-slate-800">
              <span className="font-semibold">{item.qty} ×</span> {item.name}
            </span>
            <span className="text-slate-500">{formatMoney(item.qty * item.price)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="font-semibold text-slate-500">Tổng</span>
        <span className="text-xl font-bold text-slate-900">{formatMoney(orderTotal(order))}</span>
      </div>

      {order.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => window.confirm(`Huỷ đơn #${order.number}?`) && onSetStatus(order.id, 'cancelled')}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-600 active:bg-slate-200"
          >
            <X size={18} /> Huỷ
          </button>
          <button
            onClick={() => onSetStatus(order.id, 'done')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 font-semibold text-white active:bg-emerald-600"
          >
            <Check size={18} /> Hoàn thành
          </button>
        </div>
      )}
    </li>
  );
}

// Dùng chung cho tab "Đơn hàng" (type = dine-in) và "Đơn ship" (type = delivery).
export default function OrdersPage({ type = 'dine-in', orders, onAddOrder, onSetStatus }) {
  const [filter, setFilter] = useState('pending');
  const [creating, setCreating] = useState(false);

  const ofType = orders.filter((o) => o.type === type);
  const visible = ofType.filter((o) => o.status === filter);
  // Đơn chờ: giờ giao sớm nhất lên trước. Các mục khác: mới tạo lên trước.
  if (filter === 'pending') {
    const due = (o) => new Date(o.deliverAt ?? o.createdAt).getTime();
    visible.sort((a, b) => due(a) - due(b));
  }

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => {
          const n = ofType.filter((o) => o.status === f.id).length;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'
              }`}
            >
              {f.label} <span className={active ? 'text-slate-300' : 'text-slate-400'}>{n}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-3xl bg-white/60 px-5 py-12 text-center text-slate-400">
          {filter === 'pending' ? 'Không có đơn nào đang chờ' : 'Chưa có đơn'}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} onSetStatus={onSetStatus} />
          ))}
        </ul>
      )}

      <button
        onClick={() => setCreating(true)}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 z-20 flex items-center gap-2 rounded-full bg-blue-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/30 active:bg-blue-600"
      >
        <Plus size={20} /> Tạo đơn
      </button>

      {creating && <NewOrderSheet type={type} onSubmit={onAddOrder} onClose={() => setCreating(false)} />}
    </div>
  );
}
