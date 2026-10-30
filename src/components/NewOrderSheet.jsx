import { useRef, useState } from 'react';
import { MapPin, Minus, Phone, Plus, UserRound, X } from 'lucide-react';
import { searchCustomers } from '../hooks/useCustomers';
import { formatMoney } from '../lib/stats';

const TITLE = { 'dine-in': 'Tạo đơn tại quán', delivery: 'Tạo đơn ship' };

// "YYYY-MM-DDTHH:mm" theo giờ máy, dùng cho ô ngày/giờ
const localDateTime = (date = new Date()) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function initialForm(order) {
  if (!order) return { name: '', phone: '', address: '', date: localDateTime().slice(0, 10), time: '', note: '' };
  const due = order.deliverAt ? localDateTime(order.deliverAt) : '';
  return {
    name: order.customer?.name ?? '',
    phone: order.customer?.phone ?? '',
    address: order.customer?.address ?? '',
    date: due.slice(0, 10),
    time: due.slice(11, 16),
    note: order.note ?? '',
  };
}

const initialQty = (order, menu) =>
  Object.fromEntries(
    (order?.items ?? []).flatMap((i) => {
      const m = menu.find((m) => m.name === i.name);
      return m ? [[m.id, i.qty]] : [];
    })
  );

function validate(form, items) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Nhập tên khách hàng';
  if (form.phone.replace(/\D/g, '').length < 8) errors.phone = 'Số điện thoại chưa đúng';
  if (!form.address.trim()) errors.address = 'Nhập địa chỉ';
  if (!form.date) errors.date = 'Chọn ngày giao';
  if (!form.time) errors.time = 'Chọn giờ giao';
  if (!items.length) errors.items = 'Chọn ít nhất 1 món';
  return errors;
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label} <span className="text-red-500">*</span>
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
export default function NewOrderSheet({ type, order, menu, customers = [], onSubmit, onClose }) {
  const [form, setForm] = useState(() => initialForm(order));
  const [qty, setQty] = useState(() => initialQty(order, menu));
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

  const suggestions = showSuggest ? searchCustomers(customers, form.name) : [];
  const pickCustomer = (c) => {
    setForm((f) => ({ ...f, name: c.name, phone: c.phone, address: c.address }));
    setShowSuggest(false);
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const change = (id, delta) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));

  const items = [
    ...menu.filter((m) => qty[m.id] > 0).map((m) => ({ name: m.name, price: priceOf(m), qty: qty[m.id] })),
    ...extraItems,
  ];
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);

  // Chỉ hiện lỗi sau lần bấm "Tạo đơn" đầu tiên, rồi cập nhật theo từng lần gõ.
  const errors = submitted ? validate(form, items) : {};

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(validate(form, items)).length) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    onSubmit({
      type,
      customer: { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() },
      deliverAt: new Date(`${form.date}T${form.time}`).toISOString(),
      note: form.note,
      items,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full flex-col rounded-t-3xl bg-white sm:max-w-lg sm:rounded-3xl">
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
                <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
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

          <Field label="Số điện thoại" error={errors.phone}>
            <input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={set('phone')}
              className={inputClass(errors.phone)}
            />
          </Field>

          <Field label="Địa chỉ" error={errors.address}>
            <textarea rows={2} value={form.address} onChange={set('address')} className={inputClass(errors.address)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày giao" error={errors.date}>
              <input type="date" value={form.date} onChange={set('date')} className={inputClass(errors.date)} />
            </Field>
            <Field label="Giờ giao" error={errors.time}>
              <input type="time" value={form.time} onChange={set('time')} className={inputClass(errors.time)} />
            </Field>
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">
              Chọn món <span className="text-red-500">*</span>
            </p>
            {errors.items && <p className="text-sm text-red-600">{errors.items}</p>}
            <ul className="divide-y divide-slate-100">
              {choices.length === 0 && (
                <li className="py-4 text-center text-sm text-slate-400">
                  Chưa có món nào. Thêm món ở tab "Quản lý món ăn".
                </li>
              )}
              {choices.map((m) => {
                const n = qty[m.id] ?? 0;
                return (
                  <li key={m.id} className="flex items-center gap-3 py-3">
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
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white active:bg-blue-600"
                      aria-label={`Thêm ${m.name}`}
                    >
                      <Plus size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
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
