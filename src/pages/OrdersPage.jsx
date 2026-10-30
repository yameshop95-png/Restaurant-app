import { useState } from 'react';
import {
  AlarmClock,
  Armchair,
  Banknote,
  Check,
  Clock,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  StickyNote,
  Truck,
  X,
} from 'lucide-react';
import NewOrderSheet from '../components/NewOrderSheet';
import { normalizeText } from '../hooks/useCustomers';
import { dueInfo, formatDue } from '../lib/due';
import { mapsUrl, shareOrder } from '../lib/shareOrder';
import { formatMoney, itemsTotal, orderTotal } from '../lib/stats';

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
  // Tự định dạng: toLocaleDateString('vi-VN') chỉ có ngày + tháng ra "20-10" trên một số trình duyệt
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (dayDiff === 0) return withDay ? `${time} hôm nay` : time;
  if (withDay && dayDiff === 1) return `${time} ngày mai (${date})`;
  return `${time} · ${date}`;
}

const DUE_STYLE = {
  overdue: { card: 'ring-2 ring-red-500', banner: 'bg-red-500 text-white' },
  soon: { card: 'ring-2 ring-orange-400', banner: 'bg-orange-100 text-orange-800' },
};

function OrderCard({ order, now, shopName, onEdit, onSetStatus, onSetPaid }) {
  const status = STATUS[order.status];
  const cancelled = order.status === 'cancelled';
  const due = dueInfo(order, now);
  const [shareMsg, setShareMsg] = useState(null);

  const share = async () => {
    try {
      const result = await shareOrder(order, shopName);
      if (result === 'copied') setShareMsg('Đã copy nội dung đơn, dán vào Zalo / Messenger cho shipper');
    } catch {
      setShareMsg('Không copy được, hãy thử lại');
    }
    setTimeout(() => setShareMsg(null), 4000);
  };

  return (
    <li className={`rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm ${due ? DUE_STYLE[due.level].card : ''}`}>
      {due && (
        <p className={`-mx-1 -mt-1 mb-3 flex items-center gap-2 rounded-2xl px-3 py-2 font-bold ${DUE_STYLE[due.level].banner}`}>
          <AlarmClock size={18} className="shrink-0" /> {formatDue(due)}
        </p>
      )}
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
          {!cancelled && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                onClick={() => onEdit(order)}
                className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-600 active:bg-slate-200"
              >
                <Pencil size={14} /> Sửa đơn
              </button>
              {order.customer?.address && (
                <button
                  onClick={share}
                  className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-700 active:bg-blue-100"
                >
                  <Send size={14} /> Gửi cho shipper
                </button>
              )}
            </div>
          )}
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
          {order.table && (
            <p className="flex items-center gap-2 font-semibold text-blue-700">
              <Armchair size={16} className="shrink-0" /> Bàn {order.table}
            </p>
          )}
          {order.customer.phone && (
            <a
              href={`tel:${order.customer.phone}`}
              className="flex items-center gap-2 text-slate-700 underline-offset-2 active:underline"
            >
              <Phone size={16} className="shrink-0 text-slate-400" /> {order.customer.phone}
            </a>
          )}
          {order.customer.address && (
            <a
              href={mapsUrl(order.customer.address)}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2 text-blue-700 underline decoration-blue-200 underline-offset-2"
            >
              <MapPin size={16} className="mt-0.5 shrink-0" /> {order.customer.address}
            </a>
          )}
        </div>
      )}

      {shareMsg && <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">{shareMsg}</p>}

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

      {(order.shippingFee > 0 || order.discount > 0) && (
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-500">
          <p className="flex justify-between">
            <span>Tiền món</span> <span>{formatMoney(itemsTotal(order))}</span>
          </p>
          {order.shippingFee > 0 && (
            <p className="flex justify-between">
              <span>Phí ship</span> <span>+ {formatMoney(order.shippingFee)}</span>
            </p>
          )}
          {order.discount > 0 && (
            <p className="flex justify-between text-emerald-600">
              <span>Giảm giá</span> <span>− {formatMoney(order.discount)}</span>
            </p>
          )}
        </div>
      )}

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

// Tìm theo số đơn ("12" hoặc "#12"), tên / SĐT / địa chỉ khách, số bàn, ghi chú, tên món (không dấu cũng được)
function matchesQuery(order, query) {
  const q = normalizeText(query.replace(/^#/, ''));
  if (!q) return true;
  if (/^\d+$/.test(q) && String(order.number) === q) return true;
  const digits = query.replace(/\D/g, '');
  if (digits.length >= 3 && (order.customer?.phone ?? '').replace(/\D/g, '').includes(digits)) return true;
  const text = [order.customer?.name, order.customer?.address, order.table && `ban ${order.table}`, order.note, ...order.items.map((i) => i.name)]
    .filter(Boolean)
    .join(' | ');
  return normalizeText(text).includes(q);
}

// Lọc theo ngày (YYYY-MM-DD): đơn tạo hoặc giao trong ngày đó, theo giờ máy
function matchesDate(order, date) {
  if (!date) return true;
  const local = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return local(order.createdAt) === date || (order.deliverAt && local(order.deliverAt) === date);
}

// Dùng chung cho tab "Đơn hàng" (type = dine-in) và "Đơn ship" (type = delivery).
export default function OrdersPage({
  type = 'dine-in',
  orders,
  customers,
  menu,
  onAddOrder,
  onUpdateOrder,
  onSetStatus,
  onSetPaid,
  now,
  settings,
}) {
  const [filter, setFilter] = useState('pending');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');

  const ofType = orders.filter((o) => o.type === type);
  // Đang tìm kiếm: tìm trong mọi trạng thái, mới tạo lên trước
  const searching = query.trim() !== '' || date !== '';
  const visible = searching
    ? ofType.filter((o) => matchesQuery(o, query) && matchesDate(o, date))
    : ofType.filter(FILTERS.find((f) => f.id === filter).match);
  // Đơn chờ: giờ giao sớm nhất lên trước. Các mục khác: mới tạo lên trước.
  if (filter === 'pending' && !searching) {
    const due = (o) => new Date(o.deliverAt ?? o.createdAt).getTime();
    visible.sort((a, b) => due(a) - due(b));
  }

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <div className="mb-3 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tên, SĐT, số đơn, món…"
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Lọc theo ngày"
          className={`w-36 shrink-0 rounded-2xl border bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 ${
            date ? 'border-blue-500 text-slate-900' : 'border-slate-200 text-slate-400'
          }`}
        />
      </div>
      {searching && (
        <div className="mb-3 flex items-center justify-between px-1 text-sm">
          <span className="text-slate-600">
            Tìm thấy <b>{visible.length}</b> đơn{date && ` ngày ${date.split('-').reverse().join('/')}`}
          </span>
          <button
            onClick={() => {
              setQuery('');
              setDate('');
            }}
            className="font-semibold text-blue-600"
          >
            Xoá tìm kiếm
          </button>
        </div>
      )}

      <div className={`mb-4 flex gap-2 overflow-x-auto ${searching ? 'hidden' : ''}`}>
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
          {searching ? 'Không tìm thấy đơn nào' : filter === 'pending' ? 'Không có đơn nào đang chờ' : 'Chưa có đơn'}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              shopName={settings.shopName}
              onEdit={setEditing}
              onSetStatus={onSetStatus}
              onSetPaid={onSetPaid}
            />
          ))}
        </ul>
      )}

      <button
        onClick={() => setCreating(true)}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 z-20 flex items-center gap-2 rounded-full bg-blue-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/30 active:bg-blue-600"
      >
        <Plus size={20} /> Tạo đơn
      </button>

      {creating && <NewOrderSheet type={type} menu={menu} customers={customers} onSubmit={onAddOrder} onClose={() => setCreating(false)} />}
      {editing && (
        <NewOrderSheet
          type={type}
          order={editing}
          menu={menu}
          customers={customers}
          onSubmit={(data) => onUpdateOrder(editing.id, data)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
