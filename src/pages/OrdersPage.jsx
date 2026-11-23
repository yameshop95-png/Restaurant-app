import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlarmClock,
  Armchair,
  Banknote,
  Check,
  Clock,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShoppingBag,
  FileSpreadsheet,
  Globe,
  MoreHorizontal,
  Send,
  StickyNote,
  Truck,
  X,
} from 'lucide-react';
import MessageCustomerSheet from '../components/MessageCustomerSheet';
import NewOrderSheet from '../components/NewOrderSheet';
import RoutePlanner from '../components/RoutePlanner';
import { normalizeText } from '../hooks/useCustomers';
import useSwipe from '../hooks/useSwipe';
import useWide from '../hooks/useWide';
import { computeBatches, isCookingOrder, isInboxOrder } from '../lib/batches';
import { dishThumb } from '../lib/dishPhotos';
import { dueInfo, formatDue } from '../lib/due';
import { cachedGeocode, geocode } from '../lib/geo';
import { geoRecordFor, storedGeoOf } from '../lib/orderGeo';
import { exportOrderList } from '../lib/orderListExcel';
import { needsCustomerMessage, ORDER_TYPES, PAYMENT_METHODS, paymentLabel, PREVIOUS_STATUS, statusLabel } from '../lib/orderStatus';
import { sendManyToShopPrinter, sendToShopPrinter } from '../lib/printQueue';
import { DEFAULT_ZONES } from '../lib/shippingZones';
import { mapsUrl, shareOrder } from '../lib/shareOrder';
import { formatMoney, itemsTotal, orderTotal } from '../lib/stats';
import { duplicateNumbers } from '../lib/duplicates';

// Trạng thái xử lý đơn: Chờ xử lý → Hoàn thành (nấu xong) → Đang giao (chỉ đơn giao hàng) → Đã ship / Đã lấy. Thanh toán là cờ riêng (`paid`).
const STATUS = {
  // Trạng thái chỉ là nhãn xám; màu dành cho thanh toán và cảnh báo
  pending: { label: 'Chờ xử lý', badge: 'bg-slate-100 text-slate-800' },
  done: { label: 'Hoàn thành', badge: 'bg-slate-100 text-slate-800' },
  delivering: { label: 'Đang giao', badge: 'bg-slate-100 text-slate-800' },
  shipped: { label: 'Đã ship', badge: 'bg-slate-100 text-slate-800' },
  cancelled: { label: 'Đã huỷ', badge: 'bg-slate-50 text-slate-500' },
  failed: { label: 'Giao không được', badge: 'bg-red-100 text-red-700' },
};

const PAGE = 30;

const FILTERS = [
  // Hai trạm đầu tách hẳn nhau (xem isInboxOrder / isCookingOrder ở lib/batches):
  // "Chờ xử lý" chỉ còn đơn web chưa xác nhận; xác nhận xong đơn sang hẳn "Chờ nấu".
  { id: 'pending', label: 'Chờ xử lý', match: isInboxOrder },
  // Hàng chờ nấu: đơn chờ xử lý đã xác nhận, GỘP cả đơn giao và đơn đến lấy (xem isCookingOrder)
  { id: 'cooking', label: 'Chờ nấu', match: isCookingOrder },
  { id: 'done', label: 'Hoàn thành', match: (o) => o.status === 'done' },
  { id: 'delivering', label: 'Đang giao', match: (o) => o.status === 'delivering' },
  // Đơn giao không được (khách vắng nhà…): tab đỏ riêng ở Đơn ship, chờ giao lại hoặc huỷ
  { id: 'failed', label: 'Giao không được', match: (o) => o.status === 'failed' },
  { id: 'shipped', label: 'Đã ship', match: (o) => o.status === 'shipped' },
  { id: 'paid', label: 'Đã thanh toán', match: (o) => o.paid && o.status !== 'cancelled' },
  { id: 'cancelled', label: 'Đã huỷ', match: (o) => o.status === 'cancelled' },
];

// toLocaleTimeString tạo bộ định dạng mới mỗi lần gọi (chậm trên iPhone); dùng chung một bộ
const TIME_FMT = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

function formatTime(iso, withDay = false) {
  const d = new Date(iso);
  const time = TIME_FMT.format(d);
  const dayDiff = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  // Tự định dạng: toLocaleDateString('vi-VN') chỉ có ngày + tháng ra "20-10" trên một số trình duyệt
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (dayDiff === 0) return withDay ? `${time} hôm nay` : time;
  if (withDay && dayDiff === 1) return `${time} ngày mai (${date})`;
  return `${time} · ${date}`;
}

const DUE_STYLE = {
  overdue: { card: 'ring-1 ring-red-500', banner: 'bg-red-50 text-red-600' },
  soon: { card: 'ring-1 ring-slate-500', banner: 'bg-slate-100 text-slate-900' },
};

const BACK_LABEL = {
  done: 'Chuyển về Chờ xử lý',
  delivering: 'Chưa mang đi – chuyển về Hoàn thành',
  shipped: 'Chưa ship – chuyển về Hoàn thành',
  cancelled: 'Khôi phục đơn (về Chờ xử lý)',
};
// Bước quay lại theo loại đơn: đơn giao hàng đi qua "Đang giao" trước "Đã ship", đơn đến lấy thì không
const previousStatus = (order) =>
  order.status === 'shipped' && order.type === 'delivery' ? 'delivering' : PREVIOUS_STATUS[order.status];
const backLabel = (order) => {
  if (order.type === 'pickup' && order.status === 'shipped') return 'Khách chưa lấy – chuyển về Hoàn thành';
  if (order.type === 'delivery' && order.status === 'shipped') return 'Chưa giao – chuyển về Đang giao';
  return BACK_LABEL[order.status];
};

// Đơn online chờ xử lý đi qua 3 bước: chưa nhận → đã nhận → đã xác nhận
const stageOf = (order) =>
  order.source === 'web' && order.status === 'pending'
    ? order.confirmedAt
      ? 'confirmed'
      : order.receivedAt
        ? 'received'
        : 'new'
    : null;

const STAGE_LABEL = { new: 'Chưa nhận đơn', received: 'Đã nhận · chưa xác nhận', confirmed: 'Đã xác nhận' };
const DOT = { pending: 'bg-amber-500', done: 'bg-emerald-500', delivering: 'bg-blue-500', shipped: 'bg-slate-500', cancelled: 'bg-red-500' };

// Nhãn trạng thái nhỏ có chấm màu
function StatusPill({ order }) {
  const stage = stageOf(order);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
      <i className={`h-2 w-2 rounded-full ${DOT[order.status] ?? 'bg-slate-500'}`} />
      {stage ? STAGE_LABEL[stage] : statusLabel(order.status, order.type)}
    </span>
  );
}

const hhmm = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Dòng gọn trong danh sách bên trái (màn rộng): số đơn + tên, giờ và loại đơn, tiền và trạng thái
function OrderRow({ order, selected, onSelect, batchLabel }) {
  const delivery = order.type === 'delivery';
  return (
    <li>
      <button
        onClick={() => onSelect(order.id)}
        aria-current={selected ? 'true' : undefined}
        className={`flex w-full items-start justify-between gap-3 border-l-4 px-4 py-3 text-left ${
          selected ? 'border-blue-500 bg-slate-50' : 'border-transparent hover:bg-slate-50'
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold text-slate-900">
            #{order.number}
            {order.customer?.name ? ` · ${order.customer.name}` : ''}
          </span>
          <span className="block text-sm text-slate-500">
            {delivery ? 'Giao hàng' : 'Đến lấy'}
            {order.deliverAt ? ` · ${formatTime(order.deliverAt)}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">{formatMoney(orderTotal(order))}</span>
          <StatusPill order={order} />
          {batchLabel && (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{batchLabel}</span>
          )}
        </span>
      </button>
    </li>
  );
}

// Ảnh nhỏ của món (ảnh trên website), món chưa có ảnh thì không hiện gì
function DishThumb({ name }) {
  const photo = dishThumb(name);
  if (!photo) return null;
  return <img src={photo} alt="" width="40" height="40" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />;
}

function OrderCard({ order, now, shopName, shopAddress, mapsApp, onEdit, onSetStatus, onSetPaid, onMarkStep, batchLabel, duplicateOf }) {
  const status = STATUS[order.status];
  const cancelled = order.status === 'cancelled';
  const due = dueInfo(order, now);
  const [shareMsg, setShareMsg] = useState(null);
  // Bấm "Đã thanh toán" thì hỏi khách trả bằng gì
  const [choosingPay, setChoosingPay] = useState(false);
  const [messaging, setMessaging] = useState(false);
  // Tick "Không cần nhắn tin" khi xác nhận đơn web (khách đã gọi / đã biết đơn được nhận)
  const [skipMessage, setSkipMessage] = useState(false);
  // Đơn online chờ xử lý đi qua 3 bước: nhận đơn → nhắn xác nhận cho khách → hoàn thành
  const stage = stageOf(order);
  const [more, setMore] = useState(false);
  const askPayment = () => setChoosingPay(true);

  const share = async () => {
    try {
      const result = await shareOrder(order, shopName, mapsApp);
      if (result === 'copied') setShareMsg('Đã copy nội dung đơn, dán vào Zalo / Messenger cho shipper');
    } catch {
      setShareMsg('Không copy được, hãy thử lại');
    }
    setTimeout(() => setShareMsg(null), 4000);
  };

  return (
    <li className={`staff-row rounded-3xl border border-slate-200 bg-card p-4 shadow-sm ${due ? DUE_STYLE[due.level].card : ''}`}>
      {due && (
        <p
          className={`-mx-1 -mt-1 mb-3 flex items-center gap-2 rounded-2xl px-3 py-2 font-bold ${DUE_STYLE[due.level].banner}`}
        >
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
            {order.createdBy && ` · ${order.createdBy}`}
            {order.source === 'web' && (
              <span className="ml-1 inline-flex items-center gap-1 font-semibold text-blue-600">
                <Globe size={12} /> Online
              </span>
            )}
          </p>
          {!cancelled && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                onClick={() => setMore((v) => !v)}
                aria-expanded={more}
                className="flex min-h-11 items-center gap-1 rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 active:bg-slate-200"
              >
                <MoreHorizontal size={14} /> {more ? 'Thu gọn' : 'Thêm'}
              </button>
              {more && (
                <>

              <button
                onClick={() => onEdit(order)}
                className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-600 active:bg-slate-200"
              >
                <Pencil size={14} /> Sửa đơn
              </button>
              <button
                onClick={async () => {
                  try {
                    const mode = await sendToShopPrinter(order, shopName);
                    setShareMsg(
                      `Đã gửi lệnh in ra máy ở quán (${mode === 'image' ? 'bill ảnh có dấu' : 'bill chữ không dấu'})`,
                    );
                  } catch {
                    setShareMsg('Chưa gửi được lệnh in, kiểm tra mạng rồi thử lại');
                  }
                  setTimeout(() => setShareMsg(null), 4000);
                }}
                className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-600 active:bg-slate-200"
              >
                <Printer size={14} /> In bill
              </button>
              {order.customer?.phone && order.status === 'pending' && (
                <button
                  onClick={() => setMessaging(true)}
                  className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-600 active:bg-slate-200"
                >
                  <MessageSquare size={14} /> Nhắn khách
                </button>
              )}
              {order.customer?.address && (
                <button
                  onClick={share}
                  className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-600 active:bg-slate-200"
                >
                  <Send size={14} /> Gửi cho shipper
                </button>
              )}
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.badge}`}>
            {stage === 'new' && 'Chưa nhận đơn'}
            {stage === 'received' && 'Đã nhận · chưa xác nhận'}
            {stage === 'confirmed' && 'Đã xác nhận'}
            {!stage && statusLabel(order.status, order.type)}
          </span>
          {!cancelled && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                order.paid ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}
            >
              {order.paid
                ? `Đã thanh toán${order.paymentMethod ? ` · ${paymentLabel(order.paymentMethod)}` : ''}`
                : 'Chưa thanh toán'}
            </span>
          )}
          {batchLabel && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{batchLabel}</span>
          )}
        </div>
      </div>

      {order.customer && (
        <div className="mt-3 space-y-1.5 text-[15px] text-slate-700">
          {order.deliverAt && (
            <p className="flex items-center gap-2 font-semibold text-slate-900">
              {order.type === 'delivery' ? (
                <>
                  <Truck size={16} className="shrink-0" /> Giao {formatTime(order.deliverAt, true)}
                </>
              ) : (
                <>
                  <ShoppingBag size={16} className="shrink-0" /> Đến lấy {formatTime(order.deliverAt, true)}
                </>
              )}
            </p>
          )}
          {order.table && (
            <p className="flex items-center gap-2 font-semibold text-slate-900">
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
              href={mapsUrl(order.customer.address, mapsApp)}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2 text-slate-700 underline decoration-slate-300 underline-offset-2"
            >
              <MapPin size={16} className="mt-0.5 shrink-0" /> {order.customer.address}
            </a>
          )}
        </div>
      )}

      {/* Đơn giao hàng còn chờ xử lý mà thiếu địa chỉ / giờ giao: báo ngay từ bước xác nhận,
          kẻo tới lúc đi giao mới phát hiện và bị loại khỏi lộ trình */}
      {order.type === 'delivery' && order.status === 'pending' && (!order.customer?.address || !order.deliverAt) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {!order.customer?.address && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Thiếu địa chỉ giao</span>
          )}
          {!order.deliverAt && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Thiếu giờ giao</span>
          )}
        </div>
      )}

      {/* Đã xác nhận trên máy không có SMS (vd PC) mà chưa máy nào nhắn cho khách:
          nhắc để điện thoại nhắn bù, tránh xác nhận xong rồi quên nhắn */}
      {(needsCustomerMessage(order) || duplicateOf?.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {needsCustomerMessage(order) && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Chưa nhắn khách</span>
          )}
          {duplicateOf?.length > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
              Có thể trùng đơn {duplicateOf.map((n) => `#${n}`).join(', ')}
            </span>
          )}
        </div>
      )}

      {shareMsg && (
        <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">{shareMsg}</p>
      )}

      {order.customer && order.note && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 font-semibold text-red-600">
          <StickyNote size={16} className="mt-0.5 shrink-0" /> {order.note}
        </p>
      )}

      <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[15px]">
        {order.items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3 text-slate-800">
              <DishThumb name={item.name} />
              <span className="min-w-0">
              <span className="font-semibold">{item.qty} ×</span> {item.name}
              {item.note && <span className="block text-sm font-semibold text-red-600">↳ {item.note}</span>}
              </span>
            </span>
            <span className="shrink-0 font-mono tabular-nums text-slate-500">{formatMoney(item.qty * item.price)}</span>
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
            <p className="flex justify-between">
              <span>Giảm giá</span> <span>− {formatMoney(order.discount)}</span>
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="font-semibold text-slate-500">Tổng</span>
        <span className="text-xl font-bold text-slate-900">{formatMoney(orderTotal(order))}</span>
      </div>

      {order.status === 'delivering' && (
        <button
          onClick={() => window.confirm(`Đơn #${order.number} giao không được (khách vắng, sai địa chỉ…)?`) && onSetStatus(order.id, 'failed')}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 py-2 text-sm font-semibold text-red-700 active:bg-red-100"
        >
          <X size={16} /> Giao không được
        </button>
      )}

      {order.status === 'failed' && (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            Giao không được. Gọi khách hẹn lại rồi bấm Giao lại, hoặc huỷ đơn.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => window.confirm(`Huỷ đơn #${order.number}?`) && onSetStatus(order.id, 'cancelled')}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-600 active:bg-slate-200"
            >
              <X size={18} /> Huỷ
            </button>
            <button
              onClick={() => onSetStatus(order.id, 'delivering')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 py-3 font-semibold text-white active:bg-blue-600"
            >
              <Truck size={18} /> Giao lại
            </button>
          </div>
        </div>
      )}

      {(order.status === 'done' || order.status === 'delivering') && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() =>
              onSetStatus(order.id, order.status === 'done' && order.type === 'delivery' ? 'delivering' : 'shipped')
            }
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 py-3 font-semibold text-white active:bg-blue-600"
          >
            {order.status === 'delivering' ? (
              <>
                <Truck size={18} /> Đã giao xong
              </>
            ) : order.type === 'delivery' ? (
              <>
                <Truck size={18} /> Đã mang đi
              </>
            ) : (
              <>
                <ShoppingBag size={18} /> Khách đã lấy
              </>
            )}
          </button>
          {!order.paid && !choosingPay && (
            <button
              onClick={askPayment}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-3 font-semibold text-slate-800 active:bg-slate-100"
            >
              <Banknote size={18} /> Đã thanh toán
            </button>
          )}
        </div>
      )}

      {choosingPay && !order.paid && (
        <div className="mt-3 rounded-2xl bg-slate-50 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">Khách trả bằng:</p>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setChoosingPay(false);
                  onSetPaid(order.id, true, m.id);
                }}
                className="rounded-xl border border-slate-300 bg-slate-100 py-2.5 text-sm font-semibold text-slate-900 active:bg-slate-200"
              >
                {m.label}
              </button>
            ))}
          </div>
          <button onClick={() => setChoosingPay(false)} className="mt-2 w-full text-sm text-slate-500">
            Huỷ
          </button>
        </div>
      )}

      {/* Ở bước "Hoàn thành" / "Đang giao", nút thanh toán đã nằm cạnh nút trạng thái phía trên */}
      {!cancelled &&
        (order.paid ? (
          <button
            onClick={() =>
              window.confirm(`Đánh dấu đơn #${order.number} là chưa thanh toán?`) && onSetPaid(order.id, false)
            }
            className="mt-2 w-full py-1 text-sm text-slate-400 underline-offset-2 active:underline"
          >
            Bỏ đánh dấu đã thanh toán
          </button>
        ) : (
          order.status !== 'done' &&
          order.status !== 'delivering' &&
          !choosingPay && (
            <button
              onClick={askPayment}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2.5 font-semibold text-slate-800 active:bg-slate-100"
            >
              <Banknote size={18} /> Đã thanh toán
            </button>
          )
        ))}

      {order.status === 'pending' && (
        <div className="mt-2 space-y-2">
          {stage === 'received' && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Kiểm tra làm được và đủ món rồi bấm Xác nhận đơn. Nhắn khách làm lúc nào cũng được, máy nào cũng được.
            </p>
          )}
          {stage === 'received' && (
            <label className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={skipMessage}
                onChange={(e) => setSkipMessage(e.target.checked)}
                className="h-5 w-5 accent-blue-500"
              />
              Nhận đơn, không cần nhắn tin cho khách
            </label>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => window.confirm(`Huỷ đơn #${order.number}?`) && onSetStatus(order.id, 'cancelled')}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-600 active:bg-slate-200"
            >
              <X size={18} /> Huỷ
            </button>
            {stage === 'new' && (
              <button
                onClick={() => onMarkStep(order.id, { receivedAt: new Date().toISOString() }, 'đã nhận đơn')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 py-3 font-semibold text-white active:bg-blue-600"
              >
                <Check size={18} /> Đã nhận đơn
              </button>
            )}
            {stage === 'received' && (
              <>
                <button
                  onClick={() => setMessaging(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 active:bg-slate-100"
                >
                  <MessageSquare size={18} /> Nhắn khách
                </button>
                <button
                  onClick={() => {
                    const at = new Date().toISOString();
                    onMarkStep(
                      order.id,
                      { receivedAt: order.receivedAt ?? at, confirmedAt: at, ...(skipMessage ? { messageSkippedAt: at } : {}) },
                      skipMessage ? 'đã xác nhận đơn, không cần nhắn tin' : 'đã xác nhận đơn',
                    );
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 py-3 font-semibold text-white active:bg-blue-600"
                >
                  <Check size={18} /> Xác nhận đơn
                </button>
              </>
            )}
            {(!stage || stage === 'confirmed') && (
              <button
                onClick={() => onSetStatus(order.id, 'done')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 py-3 font-semibold text-white active:bg-blue-600"
              >
                <Check size={18} /> Hoàn thành
              </button>
            )}
          </div>
        </div>
      )}

      {previousStatus(order) && (
        <button
          onClick={() => onSetStatus(order.id, previousStatus(order))}
          className="mt-2 flex w-full items-center justify-center gap-1 py-1 text-sm text-slate-400 active:text-slate-600"
        >
          <RotateCcw size={13} /> {backLabel(order)}
        </button>
      )}
      {messaging && (
        <MessageCustomerSheet
          order={order}
          shopName={shopName}
          shopAddress={shopAddress}
          onClose={() => setMessaging(false)}
          onSent={(kind) => {
            // Gửi/copy tin XÁC NHẬN từ bất cứ đường nào (nút Nhắn khách, "Thêm → Nhắn khách", Copy):
            // ghi messagedAt để chip "Chưa nhắn khách" biến mất. Đơn chưa xác nhận thì nhắn cũng
            // tính là đã nhận + đã xác nhận như trước; đơn đã xác nhận sẵn (vd xác nhận trên PC
            // không có SMS) thì chỉ ghi thêm messagedAt, không đổi mốc xác nhận.
            if (kind !== 'confirm' || order.source !== 'web' || order.status !== 'pending') return;
            const at = new Date().toISOString();
            const patch = {};
            if (!order.messagedAt) patch.messagedAt = at;
            if (!order.confirmedAt) {
              patch.receivedAt = order.receivedAt ?? at;
              patch.confirmedAt = at;
            }
            if (Object.keys(patch).length) onMarkStep(order.id, patch, 'đã nhắn xác nhận cho khách');
          }}
        />
      )}
    </li>
  );
}

// Tìm theo số đơn ("12" hoặc "#12"), tên / SĐT / địa chỉ khách, số bàn, ghi chú, tên món (không dấu cũng được)
// Chữ tìm kiếm đã bỏ dấu của từng đơn, tính 1 lần cho mỗi phiên bản đơn (đơn đổi là object mới)
const searchCache = new WeakMap();
function searchTextOf(order) {
  let hit = searchCache.get(order);
  if (!hit) {
    const text = [
      order.customer?.name,
      order.customer?.address,
      order.table && `ban ${order.table}`,
      order.note,
      ...(order.items ?? []).flatMap((i) => [i.name, i.note]),
    ]
      .filter(Boolean)
      .join(' | ');
    hit = { text: normalizeText(text), phone: (order.customer?.phone ?? '').replace(/\D/g, '') };
    searchCache.set(order, hit);
  }
  return hit;
}
// Mốc giờ dùng để sắp xếp, tính 1 lần cho mỗi đơn
const dueCache = new WeakMap();
function dueTime(o) {
  let t = dueCache.get(o);
  if (t === undefined) {
    t = new Date(o.deliverAt ?? o.createdAt).getTime();
    dueCache.set(o, t);
  }
  return t;
}

function matchesQuery(order, query) {
  const q = normalizeText(query.replace(/^#/, ''));
  if (!q) return true;
  if (/^\d+$/.test(q) && String(order.number) === q) return true;
  const { text, phone } = searchTextOf(order);
  const digits = query.replace(/\D/g, '');
  if (digits.length >= 3 && phone.includes(digits)) return true;
  return text.includes(q);
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

// Tab "Đơn hàng": 2 tab con Đến lấy / Giao hàng. Tab "Đơn ship": chỉ đơn giao hàng (fixedType = 'delivery').
// Mục "Chờ nấu": khoá cứng vào trạm chờ nấu (fixedFilter = 'cooking'), ẩn cả tab loại đơn lẫn hàng chip lọc.
// "Lộ trình giao" chỉ có ở tab "Đơn ship": bên "Đơn hàng" (kể cả tab con Giao hàng) chỉ xem danh sách,
// tránh hai nơi cùng một lộ trình / cùng nút "Đã giao xong" gây nhầm — muốn xem lộ trình thì qua Đơn ship.
export default function OrdersPage({
  fixedType,
  fixedFilter,
  orders,
  customers,
  menu,
  onAddOrder,
  onUpdateOrder,
  onSetStatus,
  onSetPaid,
  onMarkStep,
  onPatchOrder,
  now,
  settings,
}) {
  const [chosenType, setChosenType] = useState('pickup');
  const zones = settings.shippingZones ?? DEFAULT_ZONES;
  const type = fixedType ?? chosenType;
  // Chỉ trang "Đơn ship" (fixedType = 'delivery') mới có chế độ xem lộ trình; các trang dùng chung
  // OrdersPage khác (Đơn hàng, Chờ nấu) luôn ở chế độ danh sách dù đơn đang xem là đơn giao hàng.
  const routeAllowed = fixedType === 'delivery';
  const [filter, setFilterState] = useState(fixedFilter ?? 'pending');
  const [slide, setSlide] = useState(null); // hướng chuyển trang để chạy hiệu ứng trượt
  const tabsRef = useRef(null);
  const setFilter = (id) => {
    const from = FILTERS.findIndex((f) => f.id === filter);
    const to = FILTERS.findIndex((f) => f.id === id);
    if (from === to) return;
    setSlide(to > from ? 'next' : 'prev');
    setFilterState(id);
  };
  // Vuốt ngang để sang trạng thái kế bên: Chờ xử lý ⇄ Hoàn thành ⇄ Đã ship ⇄ Đã thanh toán ⇄ Đã huỷ
  const step = (delta) => {
    const i = FILTERS.findIndex((f) => f.id === filter) + delta;
    if (i >= 0 && i < FILTERS.length) setFilter(FILTERS[i].id);
  };
  const swipe = useSwipe({ onNext: () => step(1), onPrev: () => step(-1) });
  // Giữ nút trạng thái đang chọn luôn nhìn thấy: chỉ cuộn thanh nút, không dùng scrollIntoView
  // (trên iPhone lệnh đó kéo lệch cả màn hình theo)
  useEffect(() => {
    const bar = tabsRef.current;
    const chip = bar?.querySelector('[aria-pressed="true"]');
    if (!bar || !chip) return;
    const left = chip.offsetLeft - bar.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [filter]);
  const [exportMsg, setExportMsg] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState('list'); // tab Đơn ship: 'list' | 'route'
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const wide = useWide();
  const [selectedId, setSelectedId] = useState(null);
  // Tab đơn đã xong / đã huỷ / kết quả tìm kiếm có thể có hàng trăm đơn: chỉ vẽ 30 đơn đầu, bấm để xem thêm
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [filter, type, query, date]);

  // Gõ tìm kiếm: chờ ngừng gõ 180 ms mới lọc, để gõ không bị khựng khi có nhiều đơn
  const [searchQ, setSearchQ] = useState('');
  useEffect(() => {
    if (!query.trim()) return setSearchQ('');
    const t = setTimeout(() => setSearchQ(query), 180);
    return () => clearTimeout(t);
  }, [query]);
  const ofType = useMemo(
    () => orders.filter((o) => (type === 'delivery' ? o.type === 'delivery' : o.type !== 'delivery')),
    [orders, type],
  );
  // Đang tìm kiếm: tìm trong mọi trạng thái, mới tạo lên trước
  const searching = query.trim() !== '' || date !== '';
  // Lọc + sắp xếp chỉ chạy lại khi đơn / bộ lọc đổi, không chạy lại mỗi lần đồng hồ nhảy
  const visible = useMemo(() => {
    // Hàng "Chờ nấu" là hàng chung của bếp: gộp cả đơn giao và đơn đến lấy, không chia theo tab loại đơn.
    // Ở mục "Chờ nấu" riêng (fixedFilter), tìm kiếm cũng quét toàn bộ đơn như hàng nấu gộp.
    const pool = searching ? (fixedFilter ? orders : ofType) : filter === 'cooking' ? orders : ofType;
    const list = searching
      ? pool.filter((o) => matchesQuery(o, searchQ) && matchesDate(o, date))
      : pool.filter(FILTERS.find((f) => f.id === filter).match);
    // Đơn chưa xong (Chờ xử lý / Chờ nấu / Hoàn thành): giờ lấy / giờ giao sớm nhất lên trước.
    // Đơn đã xong, đã huỷ và kết quả tìm kiếm: mới nhất lên trước.
    if (!searching && (filter === 'pending' || filter === 'cooking' || filter === 'done' || filter === 'delivering'))
      list.sort((a, b) => dueTime(a) - dueTime(b));
    else list.sort((a, b) => dueTime(b) - dueTime(a));
    return list;
  }, [orders, ofType, searching, searchQ, date, filter, fixedFilter]);
  // Đơn có thể trùng (cùng khách, cùng ngày, món giống hệt): gắn chip đỏ trên thẻ
  const dups = useMemo(() => duplicateNumbers(orders), [orders]);
  const tabCounts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.id, (f.id === 'cooking' ? orders : ofType).filter(f.match).length]),
      ),
    [orders, ofType],
  );
  const capped = searching || filter !== 'pending';
  const shown = capped ? visible.slice(0, limit) : visible;

  // --- Giai đoạn 2: gom đợt giao tự động + nhóm đơn trễ trong hàng Chờ nấu ---
  const cookingView = !searching && filter === 'cooking';
  // Toạ độ lấy từ CHÍNH ĐƠN (trường geo đã đồng bộ, xem lib/orderGeo.js) — KHÔNG đọc
  // cache riêng của máy, để nhãn đợt mọi máy tính ra giống hệt nhau. Đơn chưa có
  // toạ độ vẫn được xếp theo khung giờ như điểm chưa định vị trong lộ trình; effect
  // bên dưới tự tra và lưu toạ độ lên các đơn đó.
  const batchPlan = useMemo(() => {
    if (!cookingView) return null;
    const geo = new Map();
    for (const o of visible) {
      if (o.type !== 'delivery' || !o.customer?.address) continue;
      geo.set(o.id, storedGeoOf(o));
    }
    return computeBatches(visible, geo);
  }, [cookingView, visible]);

  // Tự tra toạ độ cho các đơn giao đang hoạt động (chờ xử lý / chờ nấu / đang giao)
  // chưa có toạ độ lưu trên đơn, rồi LƯU LÊN ĐƠN để mọi máy dùng chung: máy nào tra
  // trước thì các máy khác khỏi tra lại, và nhãn đợt hết phụ thuộc cache từng máy.
  // Cache sẵn trên máy có kết quả thì ghi lên đơn ngay (không gọi mạng); chưa có thì
  // tra qua geocode() (đã có giãn cách 1,1 giây/địa chỉ). Mỗi cặp đơn+địa chỉ chỉ
  // thử một lần trong phiên; địa chỉ tra không ra thì bỏ qua, phiên sau thử lại.
  const geoFillTried = useRef(new Set());
  useEffect(() => {
    if (!onPatchOrder) return;
    let cancelled = false;
    const fill = async () => {
      for (const o of orders) {
        if (cancelled) return;
        if (o.type !== 'delivery' || (o.status !== 'pending' && o.status !== 'delivering')) continue;
        const address = o.customer?.address;
        if (!address || storedGeoOf(o)) continue;
        const key = `${o.id}|${address}`;
        if (geoFillTried.current.has(key)) continue;
        geoFillTried.current.add(key);
        try {
          const hit = cachedGeocode(address);
          const found = hit && !hit.notFound ? hit : await geocode(address);
          if (!cancelled && found) onPatchOrder(o.id, { geo: geoRecordFor(address, found) });
        } catch {
          // Tra lỗi (mạng/bản đồ): bỏ qua đơn này, không chặn các đơn sau
        }
      }
    };
    fill();
    return () => {
      cancelled = true;
    };
  }, [orders, onPatchOrder]);
  const batchLabelOf = (order) => {
    const b = batchPlan?.byOrder.get(order.id);
    return b ? `Đợt ${b.batchIndex} · #${b.positionInBatch}` : null;
  };
  // Đơn trễ tách nhóm riêng lên đầu hàng chờ nấu; phần còn lại giữ nguyên thứ tự giờ cần xong
  const lateList = cookingView ? visible.filter((o) => batchPlan.lateIds.has(o.id)) : [];
  const restList = cookingView ? visible.filter((o) => !batchPlan.lateIds.has(o.id)) : visible;
  const restShown = capped ? restList.slice(0, limit) : restList;
  const sections = cookingView
    ? [
        ...(lateList.length ? [{ key: 'late', title: 'Đơn trễ — nhận luôn giao luôn', list: lateList }] : []),
        { key: 'main', title: null, list: restShown },
      ]
    : [{ key: 'main', title: null, list: shown }];
  const displayList = sections.flatMap((s) => s.list);
  const selected = displayList.find((o) => o.id === selectedId) ?? displayList[0];
  const hasMore = cookingView ? restShown.length < restList.length : shown.length < visible.length;
  const moreCount = cookingView ? restList.length - restShown.length : visible.length - shown.length;
  const multiDay = batchPlan ? new Set(batchPlan.batches.map((b) => b.dayKey)).size > 1 : false;

  const filterLabel = (f) => (f.id === 'shipped' ? statusLabel('shipped', type) : f.label);
  const exportExcel = async () => {
    const viewLabel = searching ? 'kết quả tìm kiếm' : filterLabel(FILTERS.find((f) => f.id === filter));
    try {
      await exportOrderList(visible, type, viewLabel);
      setExportMsg(`Đã tải file Excel gồm ${visible.length} đơn (${viewLabel})`);
    } catch (err) {
      setExportMsg(err.message || 'Không tải được file, thử lại nhé');
    }
    setTimeout(() => setExportMsg(null), 4000);
  };

  // In lần lượt tất cả bill đang hiện trong danh sách (theo đúng thứ tự trên màn hình)
  const [printing, setPrinting] = useState(false);
  const printAll = async () => {
    const label = searching ? 'kết quả tìm kiếm' : filterLabel(FILTERS.find((f) => f.id === filter));
    if (!window.confirm(`In ${visible.length} bill (${ORDER_TYPES[type].label} · ${label}) lần lượt ra máy in ở quán?`)) return;
    setPrinting(true);
    try {
      const n = await sendManyToShopPrinter(visible, settings.shopName, (done, total) =>
        setExportMsg(`Đang gửi lệnh in ${done}/${total}…`),
      );
      setExportMsg(`Đã gửi ${n} bill ra máy in ở quán, máy sẽ in lần lượt`);
    } catch {
      setExportMsg('Gửi lệnh in bị gián đoạn, kiểm tra mạng rồi thử lại (bill đã gửi vẫn sẽ in)');
    }
    setPrinting(false);
    setTimeout(() => setExportMsg(null), 6000);
  };

  return (
    <div className="staff-stagger mx-auto max-w-2xl pb-24 md:max-w-5xl xl:max-w-7xl">
      {!fixedType && !fixedFilter && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {Object.entries(ORDER_TYPES).map(([id, info]) => {
            const active = type === id;
            const waiting = orders.filter(
              (o) => o.status === 'pending' && (id === 'delivery' ? o.type === 'delivery' : o.type !== 'delivery'),
            ).length;
            return (
              <button
                key={id}
                onClick={() => {
                  setChosenType(id);
                  setView('list');
                }}
                className={`flex items-center justify-center gap-2 rounded-2xl py-3 font-bold shadow-sm ${
                  active ? 'bg-orange-500 text-white' : 'bg-card text-slate-700'
                }`}
              >
                {id === 'delivery' ? <Truck size={18} /> : <ShoppingBag size={18} />} {info.label}
                {waiting > 0 && (
                  <span
                    className={`rounded-full px-2 text-xs ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-800'}`}
                  >
                    {waiting}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {routeAllowed && type === 'delivery' && (
        <div className="mb-3 flex rounded-2xl bg-card p-1 shadow-sm">
          {[
            ['list', 'Danh sách'],
            ['route', 'Lộ trình giao'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${view === id ? 'bg-slate-900 text-slate-50' : 'text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {routeAllowed && view === 'route' ? (
        <RoutePlanner
          orders={ofType}
          now={now}
          settings={settings}
          onSetStatus={onSetStatus}
          onStoreGeo={onPatchOrder ? (id, geo) => onPatchOrder(id, { geo }) : undefined}
        />
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tên, SĐT, số đơn, món…"
                className="w-full rounded-2xl border border-slate-200 bg-card py-2.5 pl-10 pr-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Lọc theo ngày"
              className={`w-36 shrink-0 rounded-2xl border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 ${
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

          {!fixedFilter && (
          <div ref={tabsRef} data-no-swipe className={`mb-4 flex gap-2 overflow-x-auto ${searching ? 'hidden' : ''}`}>
            {FILTERS.filter((f) => f.id !== 'failed' || fixedType === 'delivery' || tabCounts.failed > 0).map((f) => {
              const n = tabCounts[f.id];
              const active = filter === f.id;
              const red = f.id === 'failed';
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={active}
                  className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    red
                      ? active
                        ? 'bg-red-600 text-white'
                        : 'border border-red-200 bg-red-50 text-red-700'
                      : active
                        ? 'bg-slate-900 text-slate-50'
                        : 'bg-card text-slate-600'
                  }`}
                >
                  {filterLabel(f)} <span className={red ? (active ? 'text-red-100' : 'text-red-400') : active ? 'text-slate-300' : 'text-slate-400'}>{n}</span>
                </button>
              );
            })}
          </div>
          )}

          <div className="overflow-x-clip">
            <div
              {...(searching || fixedFilter ? {} : swipe)}
              key={searching ? 'search' : filter}
              className={`min-h-[60vh] touch-pan-y ${!searching && slide ? (slide === 'next' ? 'animate-slide-next' : 'animate-slide-prev') : ''}`}
            >
              {visible.length > 0 && (
                <div className="mb-3 px-1">
                  <p className="mb-2 text-sm text-slate-500">
                    {cookingView
                      ? 'Xếp theo giờ cần xong sớm nhất (giờ giao / giờ lấy)'
                      : !searching && (filter === 'pending' || filter === 'done' || filter === 'delivering')
                        ? `Xếp theo ${ORDER_TYPES[type].timeLabel.toLowerCase()} sớm nhất`
                        : 'Mới nhất lên trước'}
                  </p>
                  <div className="flex gap-2">
                  <button
                    onClick={printAll}
                    disabled={printing}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 active:bg-slate-100 disabled:opacity-50"
                  >
                    <Printer size={16} /> In tất cả ({visible.length})
                  </button>
                  <button
                    onClick={exportExcel}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 active:bg-slate-100"
                  >
                    <FileSpreadsheet size={16} /> Xuất Excel
                  </button>
                  </div>
                </div>
              )}
              {exportMsg && (
                <p className="mb-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">
                  {exportMsg}
                </p>
              )}

              {cookingView && batchPlan && (batchPlan.batches.length > 0 || batchPlan.lateCount > 0) && (
                <section className="mb-3 rounded-3xl border border-slate-200 bg-card p-4 shadow-sm">
                  <p className="mb-1.5 font-bold text-slate-900">Gom đợt giao tự động</p>
                  <ul className="space-y-1 text-sm text-slate-600">
                    {batchPlan.batches.map((b) => (
                      <li key={`${b.dayKey}-${b.batchIndex}`}>
                        {multiDay && (
                          <>
                            Ngày {b.dayKey.slice(8, 10)}/{b.dayKey.slice(5, 7)} ·{' '}
                          </>
                        )}
                        <b>Đợt {b.batchIndex}</b> · {b.count} đơn · giao {hhmm(b.firstTime)}–{hhmm(b.lastTime)}
                      </li>
                    ))}
                  </ul>
                  {batchPlan.lateCount > 0 && (
                    <p className="mt-2 text-sm font-semibold text-amber-700">
                      Có {batchPlan.lateCount} đơn trễ — nhận luôn giao luôn, xem ở nhóm đầu danh sách
                    </p>
                  )}
                </section>
              )}

              {visible.length === 0 ? (
                <p className="rounded-3xl bg-card px-5 py-12 text-center text-slate-400">
                  {searching
                    ? 'Không tìm thấy đơn nào'
                    : filter === 'pending'
                      ? 'Không có đơn nào đang chờ'
                      : filter === 'cooking'
                        ? 'Không có đơn nào đang chờ nấu'
                        : 'Chưa có đơn'}
                </p>
              ) : (
                wide ? (
                  // Màn rất rộng (iPad ngang, máy tính): trái là danh sách gọn, phải là đơn đang chọn
                  <div className="grid grid-cols-[minmax(320px,400px)_minmax(0,1fr)] items-start gap-4">
                    <div className="space-y-4">
                      {sections.map((sec) => (
                        <div key={sec.key}>
                          {sec.title && (
                            <h3 className="mb-2 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 font-bold text-amber-800">
                              <AlarmClock size={17} /> {sec.title}
                            </h3>
                          )}
                          <ul className="divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-card">
                            {sec.list.map((order) => (
                              <OrderRow
                                key={order.id}
                                order={order}
                                selected={order.id === selected.id}
                                onSelect={setSelectedId}
                                batchLabel={cookingView ? batchLabelOf(order) : null}
                              />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <ul className="sticky top-20">
                      <OrderCard
                        key={selected.id}
                        order={selected}
                      now={now}
                      shopName={settings.shopName}
                      shopAddress={settings.shopAddress}
                      mapsApp={settings.mapsApp}
                      onEdit={setEditing}
                      onSetStatus={onSetStatus}
                      onSetPaid={onSetPaid}
                      onMarkStep={onMarkStep}
                      batchLabel={cookingView ? batchLabelOf(selected) : null}
                      duplicateOf={dups.get(selected.id)}
                      />
                    </ul>
                  </div>
                ) : (
                  // Màn vừa (iPad dọc): 2 cột đơn để nhìn được nhiều đơn cùng lúc
                  <div className="space-y-3">
                    {sections.map((sec) => (
                      <div key={sec.key}>
                        {sec.title && (
                          <h3 className="mb-2 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 font-bold text-amber-800">
                            <AlarmClock size={17} /> {sec.title}
                          </h3>
                        )}
                        <ul className="space-y-3 md:grid md:grid-cols-2 md:items-start md:gap-3 md:space-y-0">
                          {sec.list.map((order) => (
                            <OrderCard
                              key={order.id}
                              order={order}
                            now={now}
                            shopName={settings.shopName}
                            shopAddress={settings.shopAddress}
                            mapsApp={settings.mapsApp}
                            onEdit={setEditing}
                            onSetStatus={onSetStatus}
                            onSetPaid={onSetPaid}
                            onMarkStep={onMarkStep}
                            batchLabel={cookingView ? batchLabelOf(order) : null}
                            duplicateOf={dups.get(order.id)}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )
              )}
              {hasMore && (
                <button
                  onClick={() => setLimit((n) => n + PAGE)}
                  className="mt-4 w-full rounded-2xl border border-slate-300 py-3 font-semibold text-slate-700 active:bg-slate-100"
                >
                  Xem thêm ({moreCount} đơn nữa)
                </button>
              )}
              {!searching && !fixedFilter && (
                <p className="mt-4 text-center text-xs text-slate-400 lg:hidden">
                  Vuốt trái / phải để chuyển trạng thái
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => setCreating(true)}
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-5 lg:bottom-6 z-20 flex items-center gap-2 rounded-full bg-blue-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-black/40 active:bg-blue-600"
      >
        <Plus size={20} /> Tạo đơn
      </button>

      {creating && (
        <NewOrderSheet
          type={type}
          menu={menu}
          customers={customers}
          orders={orders}
          zones={zones}
          onSubmit={onAddOrder}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <NewOrderSheet
          type={type}
          order={editing}
          menu={menu}
          customers={customers}
          orders={orders}
          zones={zones}
          onSubmit={(data) => onUpdateOrder(editing.id, data)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
