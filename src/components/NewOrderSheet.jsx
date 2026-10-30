import { useEffect, useRef, useState } from 'react';
import { History, MapPin, Minus, Phone, Plus, UserRound, X } from 'lucide-react';
import { sameCustomer, searchCustomers } from '../hooks/useCustomers';
import { ORDER_TYPES } from '../lib/orderStatus';
import { DEFAULT_ZONES, matchZone } from '../lib/shippingZones';
import { formatMoney } from '../lib/stats';

const TITLE = { pickup: 'Tạo đơn đến lấy', delivery: 'Tạo đơn giao hàng' };

// "YYYY-MM-DDTHH:mm" theo giờ máy, dùng cho ô ngày/giờ
const localDateTime = (date = new Date()) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const moneyText = (n) => (n ? String(n) : '');

function initialForm(order) {
  if (!order) {
    return {
      name: '',
      phone: '',
      address: '',
      date: localDateTime().slice(0, 10),
      time: '',
      table: '',
      note: '',
      shippingFee: '',
      discount: '',
    };
  }
  const due = order.deliverAt ? localDateTime(order.deliverAt) : '';
  return {
    name: order.customer?.name ?? '',
    phone: order.customer?.phone ?? '',
    address: order.customer?.address ?? '',
    date: due.slice(0, 10),
    time: due.slice(11, 16),
    table: order.table ?? '',
    note: order.note ?? '',
    shippingFee: moneyText(order.shippingFee),
    discount: moneyText(order.discount),
  };
}

// "" -> 0, "4,50" -> 4.5, chữ linh tinh -> NaN
const parseMoney = (text) => (text.trim() ? Number(text.replace(',', '.')) : 0);

const initialQty = (order, menu) =>
  Object.fromEntries(
    (order?.items ?? []).flatMap((i) => {
      const m = menu.find((m) => m.name === i.name);
      return m ? [[m.id, i.qty]] : [];
    })
  );

// Đơn giao hàng: bắt buộc tên, SĐT, địa chỉ, ngày giờ giao. Đơn đến lấy: bắt buộc tên, ngày giờ đến lấy.
function validate(form, items, isDelivery, subtotal) {
  const when = isDelivery ? 'giao' : 'đến lấy';
  const errors = {};
  const phoneDigits = form.phone.replace(/\D/g, '').length;
  if (!form.name.trim()) errors.name = 'Nhập tên khách hàng';
  if (isDelivery ? phoneDigits < 8 : phoneDigits > 0 && phoneDigits < 8) errors.phone = 'Số điện thoại chưa đúng';
  if (isDelivery && !form.address.trim()) errors.address = 'Nhập địa chỉ';
  if (!form.date) errors.date = `Chọn ngày ${when}`;
  if (!form.time) errors.time = `Chọn giờ ${when}`;
  if (!items.length) errors.items = 'Chọn ít nhất 1 món';
  const fee = parseMoney(form.shippingFee);
  const discount = parseMoney(form.discount);
  if (!Number.isFinite(fee) || fee < 0) errors.shippingFee = 'Phí ship chưa đúng';
  if (!Number.isFinite(discount) || discount < 0) errors.discount = 'Giảm giá chưa đúng';
  else if (discount > subtotal + (Number.isFinite(fee) ? fee : 0)) errors.discount = 'Giảm nhiều hơn tổng tiền';
  return errors;
}

function Field({ label, error, required = true, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

const inputClass = (error) =>
  `w-full rounded-xl border px-4 py-3 text-base outline-none focus:ring-2 ${
    error ? 'border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
  }`;

// Truyền `order` để sửa đơn đã tạo; không truyền là tạo đơn mới.
export default function NewOrderSheet({ type, order, menu, customers = [], orders = [], zones = DEFAULT_ZONES, onSubmit, onClose }) {
  const isDelivery = type === 'delivery';
  const typeInfo = ORDER_TYPES[isDelivery ? 'delivery' : 'pickup'];
  const [form, setForm] = useState(() => initialForm(order));
  const [qty, setQty] = useState(() => initialQty(order, menu));
  // Ghi chú riêng từng món, theo id món trong thực đơn
  const [itemNotes, setItemNotes] = useState(() =>
    Object.fromEntries(
      (order?.items ?? []).flatMap((i) => {
        const m = menu.find((m) => m.name === i.name);
        return m && i.note ? [[m.id, i.note]] : [];
      })
    )
  );
  // Đơn gần nhất của khách vừa chọn, để "Đặt lại như lần trước"
  const [lastOrder, setLastOrder] = useState(null);
  const [reorderMsg, setReorderMsg] = useState(null);
  // Món không còn trong thực đơn hiện tại: giữ nguyên khi sửa đơn
  const [extraItems] = useState(() => (order?.items ?? []).filter((i) => !menu.some((m) => m.name === i.name)));
  // Khi sửa đơn, món đã có trong đơn giữ giá lúc đặt dù thực đơn đã đổi giá
  const [orderedPrice] = useState(() => Object.fromEntries((order?.items ?? []).map((i) => [i.name, i.price])));
  const priceOf = (m) => orderedPrice[m.name] ?? m.price;
  // Món hết chỉ hiện nếu đơn đang sửa đã có món đó
  const choices = menu.filter((m) => m.available !== false || qty[m.id] > 0);
  const [submitted, setSubmitted] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const scrollRef = useRef(null);

  // Phí ship tự tính theo vùng của địa chỉ, cho tới khi người dùng tự gõ phí khác.
  // Sửa đơn cũ: giữ phí đã lưu, chỉ tính lại khi đổi địa chỉ.
  const zone = isDelivery ? matchZone(form.address, zones) : null;
  const [feeAuto, setFeeAuto] = useState(() => !order || !order.shippingFee);
  const firstZone = useRef(zone?.id);
  useEffect(() => {
    if (!isDelivery || !feeAuto) return;
    if (order && zone?.id === firstZone.current) return;
    setForm((f) => ({ ...f, shippingFee: zone ? String(zone.fee) : '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id, zone?.fee, feeAuto]);

  const suggestions = showSuggest ? searchCustomers(customers, form.name) : [];
  const pickCustomer = (c) => {
    setForm((f) => ({ ...f, name: c.name, phone: c.phone, address: c.address }));
    setShowSuggest(false);
    if (!order) {
      const previous = orders
        .filter((o) => o.customer && o.status !== 'cancelled' && sameCustomer(o.customer, c))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      setLastOrder(previous ?? null);
      setReorderMsg(null);
    }
  };

  // Chép món (và ghi chú món, phí ship) của đơn gần nhất. Món đã hết hoặc không còn trong thực đơn thì bỏ qua và báo lại.
  const reorder = () => {
    const nextQty = {};
    const nextNotes = {};
    const skipped = [];
    for (const i of lastOrder.items) {
      const m = menu.find((m) => m.name === i.name);
      if (!m || m.available === false) {
        skipped.push(i.name);
        continue;
      }
      nextQty[m.id] = i.qty;
      if (i.note) nextNotes[m.id] = i.note;
    }
    setQty(nextQty);
    setItemNotes(nextNotes);
    // Phí ship lấy theo vùng nếu nhận ra địa chỉ, không thì lấy phí lần trước
    if (isDelivery && lastOrder.shippingFee && !zone) setForm((f) => ({ ...f, shippingFee: String(lastOrder.shippingFee) }));
    setReorderMsg(skipped.length ? `Không thêm được (đã hết hoặc bỏ khỏi thực đơn): ${skipped.join(', ')}` : 'Đã chọn lại các món của lần trước');
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const change = (id, delta) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));

  const items = [
    ...menu
      .filter((m) => qty[m.id] > 0)
      .map((m) => {
        const note = itemNotes[m.id]?.trim();
        return { name: m.name, price: priceOf(m), qty: qty[m.id], ...(note && { note }) };
      }),
    ...extraItems,
  ];
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const fee = isDelivery ? parseMoney(form.shippingFee) || 0 : 0;
  const discount = parseMoney(form.discount) || 0;
  const total = Math.max(0, subtotal + fee - discount);

  // Chỉ hiện lỗi sau lần bấm "Tạo đơn" đầu tiên, rồi cập nhật theo từng lần gõ.
  const errors = submitted ? validate(form, items, isDelivery, subtotal) : {};

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(validate(form, items, isDelivery, subtotal)).length) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const round = (n) => Math.round(n * 100) / 100;
    onSubmit({
      type,
      customer: {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: isDelivery ? form.address.trim() : '',
      },
      deliverAt: new Date(`${form.date}T${form.time}`).toISOString(),
      // Số bàn chỉ còn ở đơn tại quán của bản cũ: giữ nguyên khi sửa
      table: isDelivery ? '' : form.table.trim(),
      note: form.note,
      items,
      shippingFee: round(fee),
      discount: round(discount),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full flex-col rounded-t-3xl bg-card sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{order ? `Sửa đơn #${order.number}` : TITLE[type]}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
            <X size={22} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Field label="Tên khách hàng" error={errors.name}>
            <div className="relative">
              <input
                value={form.name}
                onChange={(e) => {
                  set('name')(e);
                  setShowSuggest(true);
                }}
                onFocus={() => setShowSuggest(true)}
                // Trễ một chút để kịp nhận cú chạm vào gợi ý
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                placeholder="Gõ tên hoặc SĐT để tìm khách cũ"
                autoComplete="off"
                className={inputClass(errors.name)}
              />
              {suggestions.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-card shadow-lg">
                  {suggestions.map((c) => (
                    <li key={`${c.phone}|${c.name}`}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickCustomer(c)}
                        className="w-full border-b border-slate-100 px-4 py-2.5 text-left last:border-0 active:bg-blue-50"
                      >
                        <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                          <UserRound size={15} className="text-blue-500" /> {c.name}
                        </p>
                        {c.phone && (
                          <p className="flex items-center gap-1.5 text-sm text-slate-500">
                            <Phone size={13} /> {c.phone}
                          </p>
                        )}
                        {c.address && (
                          <p className="flex items-center gap-1.5 truncate text-sm text-slate-500">
                            <MapPin size={13} className="shrink-0" /> <span className="truncate">{c.address}</span>
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>

          <Field label="Số điện thoại" error={errors.phone} required={isDelivery}>
            <input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={set('phone')}
              className={inputClass(errors.phone)}
            />
          </Field>

          {isDelivery && (
            <Field label="Địa chỉ" error={errors.address}>
              <textarea rows={2} value={form.address} onChange={set('address')} className={inputClass(errors.address)} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={typeInfo.dateLabel} error={errors.date}>
              <input type="date" value={form.date} onChange={set('date')} className={inputClass(errors.date)} />
            </Field>
            <Field label={typeInfo.timeLabel} error={errors.time}>
              <input type="time" value={form.time} onChange={set('time')} className={inputClass(errors.time)} />
            </Field>
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">
              Chọn món <span className="text-red-500">*</span>
            </p>
            {errors.items && <p className="text-sm text-red-600">{errors.items}</p>}
            {lastOrder && (
              <div className="my-2 rounded-2xl bg-blue-50 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-800">
                  <History size={15} /> Lần trước ({new Date(lastOrder.createdAt).toLocaleDateString('vi-VN')}):
                </p>
                <p className="text-sm text-blue-900">
                  {lastOrder.items.map((i) => `${i.qty}× ${i.name}${i.note ? ` (${i.note})` : ''}`).join(', ')}
                </p>
                <button
                  type="button"
                  onClick={reorder}
                  className="mt-2 w-full rounded-xl bg-blue-500 py-2 text-sm font-semibold text-white active:bg-blue-600"
                >
                  Đặt lại các món này
                </button>
                {reorderMsg && <p className="mt-1.5 text-xs font-semibold text-blue-800">{reorderMsg}</p>}
              </div>
            )}
            <ul className="divide-y divide-slate-100">
              {choices.length === 0 && (
                <li className="py-4 text-center text-sm text-slate-400">
                  Chưa có món nào. Thêm món ở tab "Quản lý món ăn".
                </li>
              )}
              {choices.map((m) => {
                const n = qty[m.id] ?? 0;
                return (
                  <li key={m.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{m.name}</p>
                        <p className="text-sm text-slate-500">{formatMoney(priceOf(m))}</p>
                      </div>
                      {n > 0 && (
                        <>
                          <button
                            onClick={() => change(m.id, -1)}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:bg-slate-200"
                            aria-label={`Bớt ${m.name}`}
                          >
                            <Minus size={18} />
                          </button>
                          <span className="w-6 text-center text-lg font-bold">{n}</span>
                        </>
                      )}
                      <button
                        onClick={() => change(m.id, 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-900 active:bg-slate-100"
                        aria-label={`Thêm ${m.name}`}
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    {n > 0 && (
                      <input
                        value={itemNotes[m.id] ?? ''}
                        onChange={(e) => setItemNotes((notes) => ({ ...notes, [m.id]: e.target.value }))}
                        placeholder={`Ghi chú cho ${m.name} (VD: 1 tô không hành)`}
                        aria-label={`Ghi chú ${m.name}`}
                        className="mt-2 w-full rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-sm font-medium text-red-600 outline-none placeholder:text-red-300 focus:ring-2 focus:ring-red-100"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {isDelivery && (
              <Field label="Phí ship (A$)" error={errors.shippingFee} required={false}>
                <input
                  inputMode="decimal"
                  value={form.shippingFee}
                  onChange={(e) => {
                    setFeeAuto(false);
                    set('shippingFee')(e);
                  }}
                  placeholder="0"
                  className={inputClass(errors.shippingFee)}
                />
                <span className="mt-1 block text-xs text-slate-500">
                  {zone
                    ? parseMoney(form.shippingFee) === zone.fee
                      ? `Vùng ${zone.name}${feeAuto ? ': tự tính' : ''}`
                      : `Vùng ${zone.name} là ${formatMoney(zone.fee)}`
                    : form.address.trim()
                      ? 'Không nhận ra vùng, nhập phí tay'
                      : 'Tự tính khi nhập địa chỉ'}
                </span>
                {zone && parseMoney(form.shippingFee) !== zone.fee && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setFeeAuto(true);
                      setForm((f) => ({ ...f, shippingFee: String(zone.fee) }));
                    }}
                    className="text-xs font-semibold text-blue-600"
                  >
                    Dùng phí vùng
                  </button>
                )}
              </Field>
            )}
            <Field label="Giảm giá (A$)" error={errors.discount} required={false}>
              <input
                inputMode="decimal"
                value={form.discount}
                onChange={set('discount')}
                placeholder="0"
                className={inputClass(errors.discount)}
              />
            </Field>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-red-600">Ghi chú</span>
            <textarea
              rows={2}
              value={form.note}
              onChange={set('note')}
              placeholder="VD: không hành, ít cay…"
              className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-600 outline-none placeholder:text-red-300 focus:ring-2 focus:ring-red-100"
            />
          </label>
        </div>

        <div className="border-t border-slate-200 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {(fee > 0 || discount > 0) && (
            <p className="mb-2 text-center text-sm text-slate-500">
              Tiền món {formatMoney(subtotal)}
              {fee > 0 && ` + ship ${formatMoney(fee)}`}
              {discount > 0 && ` − giảm ${formatMoney(discount)}`}
            </p>
          )}
          <button
            onClick={submit}
            className="flex w-full items-center justify-between rounded-2xl bg-blue-500 px-5 py-4 text-base font-semibold text-white active:bg-blue-600"
          >
            <span>
              {order ? 'Lưu thay đổi' : 'Tạo đơn'}
              {count ? ` · ${count} món` : ''}
            </span>
            <span>{formatMoney(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
