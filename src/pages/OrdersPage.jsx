import { useState } from 'react';
import { Banknote, Check, Clock, MapPin, Phone, Plus, StickyNote, Truck, X } from 'lucide-react';
import NewOrderSheet from '../components/NewOrderSheet';
import { formatMoney, orderTotal } from '../lib/stats';

// Trạng thái xử lý đơn: Chờ xử lý → Hoàn thành (nấu xong) → Đã ship. Thanh toán là cờ riêng (`paid`).
const STATUS = {
  pending: { label: 'Chờ xử lý', badge: 'bg-amber-100 text-amber-700' },
  done: { label: 'Hoàn thành', badge: 'bg-emerald-100 text-emerald-700' },
  shipped: { label: 'Đã ship', badge: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Đã huỷ', badge: 'bg-slate-200 text-slate-500' },
};

const FILTERS = [
  { id: 'pending', label: 'Chờ xử lý', match: (o) => o.status === 'pending' },
  { id: 'done', label: 'Hoàn thành', match: (o) => o.status === 'done' },
  { id: 'shipped', label: 'Đã ship', match: (o) => o.status === 'shipped' },
  { id: 'paid', label: 'Đã thanh toán', match: (o) => o.paid && o.status !== 'cancelled' },
  { id: 'cancelled', label: 'Đã huỷ', match: (o) => o.status === 'cancelled' },
];

function formatTime(iso, withDay = false) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dayDiff = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  if (dayDiff === 0) return withDay ? `${time} hôm nay` : time;
  if (withDay && dayDiff === 1) return `${time} ngày mai (${date})`;
  return `${time} · ${date}`;
}

function OrderCard({ order, onSetStatus, onSetPaid }) {
  const status = STATUS[order.status];
  const cancelled = order.status === 'cancelled';
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
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.badge}`}>{status.label}</span>
          {!cancelled && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                order.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-500 text-white'
              }`}
            >
              {order.paid ? 'Đã thanh toán' : 'Chưa thanh toán'}
            </span>
          )}
        </div>
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

      {order.status === 'done' && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onSetStatus(order.id, 'shipped')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 py-3 font-semibold text-white active:bg-blue-600"
          >
            <Truck size={18} /> Đã ship
          </button>
          {!order.paid && (
            <button
              onClick={() => onSetPaid(order.id, true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 font-semibold text-white active:bg-emerald-600"
            >
              <Banknote size={18} /> Đã thanh toán
            </button>
          )}
        </div>
      )}

      {/* Ở bước "Hoàn thành", nút thanh toán đã nằm cạnh nút "Đã ship" phía trên */}
      {!cancelled &&
        (order.paid ? (
          <button
            onClick={() => window.confirm(`Đánh dấu đơn #${order.number} là chưa thanh toán?`) && onSetPaid(order.id, false)}
            className="mt-2 w-full py-1 text-sm text-slate-400 underline-offset-2 active:underline"
          >
            Bỏ đánh dấu đã thanh toán
          </button>
        ) : (
          order.status !== 'done' && (
            <button
              onClick={() => onSetPaid(order.id, true)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-emerald-500 py-2.5 font-semibold text-emerald-600 active:bg-emerald-50"
            >
              <Banknote size={18} /> Đã thanh toán
            </button>
          )
        ))}

      {order.status === 'pending' && (
        <div className="mt-2 flex gap-2">
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
export default function OrdersPage({ type = 'dine-in', orders, customers, onAddOrder, onSetStatus, onSetPaid }) {
  const [filter, setFilter] = useState('pending');
  const [creating, setCreating] = useState(false);

  const ofType = orders.filter((o) => o.type === type);
  const visible = ofType.filter(FILTERS.find((f) => f.id === filter).match);
  // Đơn chờ: giờ giao sớm nhất lên trước. Các mục khác: mới tạo lên trước.
  if (filter === 'pending') {
    const due = (o) => new Date(o.deliverAt ?? o.createdAt).getTime();
    visible.sort((a, b) => due(a) - due(b));
  }

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => {
          const n = ofType.filter(f.match).length;
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
            <OrderCard key={order.id} order={order} onSetStatus={onSetStatus} onSetPaid={onSetPaid} />
          ))}
        </ul>
      )}

      <button
        onClick={() => setCreating(true)}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 z-20 flex items-center gap-2 rounded-full bg-blue-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/30 active:bg-blue-600"
      >
        <Plus size={20} /> Tạo đơn
      </button>

      {creating && <NewOrderSheet type={type} customers={customers} onSubmit={onAddOrder} onClose={() => setCreating(false)} />}
    </div>
  );
}
