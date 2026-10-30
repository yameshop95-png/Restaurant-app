import { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, Check, Loader2, Minus, Phone, Plus, ShoppingBag, Truck } from 'lucide-react';
import { DEFAULT_ZONES, matchZone } from '../../lib/shippingZones';
import { formatMoney } from '../../lib/stats';
import { TEXT } from '../../order/i18n';
import { siteClient, store } from '../client';
import { useSite } from '../ui';

// Trang đặt món: chỉ đặt trước, trả tiền khi nhận. Máy chủ (place_web_order) tự tính lại giá món và phí ship;
// đơn hiện ngay trong app nhận order với nhãn "Online".
const SAVED_KEY = 'order-site.customer';
const DAYS_AHEAD = 7;

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeKey = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
// Giờ sớm nhất được đặt, làm tròn lên mốc 5 phút
function earliestTime(leadMinutes) {
  const d = new Date(Date.now() + leadMinutes * 60000);
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);
  return d;
}

function Stepper({ qty, name, t, onChange, disabled }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {qty > 0 && (
        <>
          <button
            onClick={() => onChange(qty - 1)}
            aria-label={t.remove(name)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-800 active:bg-slate-200"
          >
            <Minus size={18} />
          </button>
          <span className="w-6 text-center text-lg font-bold tabular-nums">{qty}</span>
        </>
      )}
      <button
        onClick={() => onChange(qty + 1)}
        disabled={disabled}
        aria-label={t.add(name)}
        className={`flex h-10 w-10 items-center justify-center rounded-full ${
          qty > 0
            ? 'bg-blue-500 text-white active:bg-blue-600'
            : 'border border-slate-300 text-slate-900 active:bg-slate-100'
        } disabled:opacity-30`}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

function Field({ label, error, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-sm text-red-600">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  );
}

const inputClass = (error) =>
  `w-full rounded-xl border bg-transparent px-4 py-3 text-base outline-none focus:ring-2 ${
    error ? 'border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
  }`;

export default function Checkout() {
  const { lang, data, loadError, reload: load, cart: qty, setQty: setCartQty, clearCart, mounted } = useSite();
  const t = TEXT[lang];
  const [form, setForm] = useState(() => ({
    type: 'pickup',
    date: '',
    time: '',
    name: '',
    phone: '',
    address: '',
    note: '',
    deliveryDate: '',
    website: '', // ô bẫy chống máy tự gửi, người thật không thấy
  }));
  // Tên / SĐT / địa chỉ lần đặt trước (lưu trên máy khách)
  useEffect(() => {
    if (!mounted) return;
    const s = store.get(SAVED_KEY, {});
    setForm((f) => ({ ...f, name: f.name || s.name || '', phone: f.phone || s.phone || '', address: f.address || s.address || '' }));
  }, [mounted]);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [done, setDone] = useState(null);
  const checkoutRef = useRef(null);
  // Thanh giỏ hàng dưới đáy chỉ hiện khi nút "Đặt món" chưa nằm trên màn hình
  const submitRef = useRef(null);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  useEffect(() => {
    const el = submitRef.current;
    if (!el || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setCheckoutVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  });

  const shop = data?.shop ?? {};
  const menu = data?.menu ?? [];
  const web = shop.webOrdering ?? {};
  const lead = Number.isFinite(Number(web.leadMinutes)) ? Number(web.leadMinutes) : 30;
  // Giao hàng chỉ một buổi mỗi tuần (mặc định sáng thứ 7), hạn chót hôm trước lúc deliveryCutoff
  const dDay = Number.isInteger(Number(web.deliveryDay)) ? Number(web.deliveryDay) : 6;
  const dStart = web.deliveryStart || '08:00';
  const dEnd = web.deliveryEnd || '12:00';
  const dCut = web.deliveryCutoff || '20:00';
  const zones = shop.shippingZones ?? DEFAULT_ZONES;
  const closed = web.enabled === false;


  // Ngày giờ mặc định: giờ sớm nhất được đặt
  const earliest = useMemo(() => earliestTime(lead), [lead, data]);
  useEffect(() => {
    if (!data) return;
    setForm((f) => (f.date ? f : { ...f, date: dateKey(earliest), time: timeKey(earliest) }));
  }, [data, earliest]);

  // 2 ngày giao gần nhất còn trước hạn chót
  const deliveryDays = useMemo(() => {
    const out = [];
    const now = new Date();
    const [ch, cm] = dCut.split(':').map(Number);
    for (let i = 0; i < 22 && out.length < 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (d.getDay() !== dDay) continue;
      const cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, ch, cm);
      if (now < cutoff)
        out.push({ key: dateKey(d), label: `${t.weekdays[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}` });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dDay, dCut, t, data]);
  useEffect(() => {
    if (deliveryDays.length && !deliveryDays.some((d) => d.key === form.deliveryDate)) {
      setForm((f) => ({ ...f, deliveryDate: deliveryDays[0].key }));
    }
  }, [deliveryDays, form.deliveryDate]);

  const days = useMemo(() => {
    const out = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const label =
        i === 0
          ? t.today
          : i === 1
            ? t.tomorrow
            : d.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-AU', { weekday: 'short' }) +
              ` ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
      out.push({ key: dateKey(d), label });
    }
    return out;
  }, [lang, t]);

  const items = menu.filter((m) => qty[m.id] > 0).map((m) => ({ ...m, price: Number(m.price), qty: qty[m.id] }));
  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const isDelivery = form.type === 'delivery';
  const zone = isDelivery ? matchZone(form.address, zones) : null;
  const fee = zone ? Number(zone.fee) || 0 : 0;
  const total = subtotal + fee;
  const due = isDelivery
    ? form.deliveryDate
      ? new Date(`${form.deliveryDate}T${dStart}`)
      : null
    : form.date && form.time
      ? new Date(`${form.date}T${form.time}`)
      : null;

  const errors = {};
  if (!form.name.trim()) errors.name = t.errName;
  if (form.phone.replace(/\D/g, '').length < 8) errors.phone = t.errPhone;
  if (isDelivery && form.address.trim().length < 5) errors.address = t.errAddress;
  else if (isDelivery && !zone) errors.address = t.zoneUnknown;
  if (isDelivery ? !due : !due || due.getTime() < Date.now() + lead * 60000 - 60000)
    errors.time = isDelivery ? t.errors.cutoff : t.errTime(lead);
  if (!count) errors.items = t.errItems;
  const shown = submitted ? errors : {};

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setItem = (id, n) => setCartQty(id, n);

  const submit = async () => {
    setSubmitted(true);
    setServerError(null);
    if (Object.keys(errors).length) {
      checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (form.website) return; // bẫy chống spam
    setSending(true);
    const payload = {
      type: form.type,
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: isDelivery ? form.address.trim() : '',
      note: form.note.trim(),
      deliverAt: due.toISOString(),
      items: items.map((i) => ({ id: i.id, qty: i.qty })),
    };
    const { data: res, error } = await siteClient().rpc('place_web_order', { payload });
    setSending(false);
    if (error) return setServerError(t.errors.network);
    if (res?.error) {
      const msg = t.errors[res.error];
      if (res.error === 'time') return setServerError(t.errTime(res.leadMinutes ?? lead));
      if (res.error === 'cutoff' || res.error === 'delivery_day') load();
      if (res.error === 'unavailable') {
        load();
        return setServerError(t.errors.unavailable(res.item));
      }
      return setServerError(typeof msg === 'string' ? msg : t.errors.other);
    }
    store.set(SAVED_KEY, { name: payload.name, phone: payload.phone, address: form.address.trim() });
    setDone({ ...res, type: form.type, items, when: due });
    clearCart();
    window.scrollTo({ top: 0 });
  };

  const page = 'px-4 pb-32 pt-6 sm:px-6 lg:pb-12';

  if (loadError) {
    return (
      <div className={`${page} flex flex-col items-center justify-center gap-3 text-center`}>
        <p className="text-slate-700">{t.loadError}</p>
        <button onClick={load} className="rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white">
          {t.retry}
        </button>
      </div>
    );
  }
  if (!data || !mounted) {
    return (
      <div className={`${page} flex items-center justify-center`}>
        <Loader2 className="animate-spin text-slate-500" />
      </div>
    );
  }

  if (done) {
    const dm = `${pad(done.when.getDate())}/${pad(done.when.getMonth() + 1)}`;
    const when =
      done.type === 'delivery'
        ? `${t.weekdays[done.when.getDay()]} ${dm} (${dStart}–${dEnd})`
        : `${lang === 'vi' ? 'lúc' : 'at'} ${timeKey(done.when)} ${dm}`;
    return (
      <div className={page}>
        <div className="mx-auto max-w-xl space-y-5">
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-card p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check size={30} />
            </div>
            <h2 className="font-serif text-3xl font-bold text-ink">{t.doneTitle}</h2>
            <p className="text-3xl font-bold text-gold">{t.doneNumber(done.number)}</p>
            <p className="font-semibold text-slate-800">{t.doneWhen(done.type, when)}</p>
            <ul className="space-y-1 border-y border-slate-200 py-3 text-left text-[15px]">
              {done.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    <b>{i.qty} ×</b> {i.name}
                  </span>
                  <span className="text-slate-500">{formatMoney(i.qty * i.price)}</span>
                </li>
              ))}
              {done.type === 'delivery' && (
                <li className="flex justify-between gap-3 text-slate-500">
                  <span>{t.shipping}</span>
                  <span>{formatMoney(Number(done.fee))}</span>
                </li>
              )}
              <li className="flex justify-between gap-3 pt-1 text-lg font-bold">
                <span>{t.total}</span>
                <span>{formatMoney(Number(done.total))}</span>
              </li>
            </ul>
            <p className="text-slate-700">{t.donePay(formatMoney(Number(done.total)))}</p>
            <p className="text-sm text-slate-500">{t.doneCall}</p>
            <button
              onClick={() => {
                setDone(null);
                setSubmitted(false);
                setForm((f) => ({ ...f, date: '', time: '', note: '' }));
                load();
              }}
              className="w-full rounded-xl border border-slate-300 py-3 font-semibold text-slate-800 active:bg-slate-100"
            >
              {t.newOrder}
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={page}>
      <div className="mx-auto max-w-6xl space-y-5">
        <h1 className="font-serif text-4xl font-bold text-ink">{t.title}</h1>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-slate-800">
            <ShoppingBag size={15} className="shrink-0" /> {t.pickupRule(lead)}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-slate-800">
            <Truck size={15} className="shrink-0" />{' '}
            {t.deliveryRule(t.weekdays[dDay], dStart, dEnd, t.weekdays[(dDay + 6) % 7], dCut)}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-slate-800">
            <Banknote size={15} /> {t.payOnPickup}
          </span>
        </div>

        {closed ? (
          <section className="rounded-3xl border border-slate-200 bg-card p-6 text-center">
            <h2 className="text-xl font-bold text-slate-900">{t.closedTitle}</h2>
            <p className="mt-2 text-slate-600">{t.errors.closed}</p>
            {shop.shopPhone && (
              <a
                href={`tel:${shop.shopPhone}`}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white"
              >
                <Phone size={18} /> {t.callUs} {shop.shopPhone}
              </a>
            )}
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            {/* Thực đơn */}
            <section className="min-w-0">
              <h2 className="mb-3 text-lg font-bold text-slate-900">{t.menu}</h2>
              {menu.length === 0 ? (
                <p className="rounded-3xl border border-slate-200 bg-card px-5 py-10 text-center text-slate-500">
                  {t.emptyMenu}
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-card">
                  {menu.map((m) => {
                    const out = m.available === false;
                    return (
                      <li key={m.id} className={`flex items-center gap-3 px-4 py-3.5 ${out ? 'opacity-50' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900">{m.name}</p>
                          <p className="text-sm text-slate-500">{out ? t.soldOut : formatMoney(Number(m.price))}</p>
                        </div>
                        {!out && (
                          <Stepper qty={qty[m.id] ?? 0} name={m.name} t={t} onChange={(n) => setItem(m.id, n)} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {shown.items && <p className="mt-2 text-sm text-red-600">{shown.items}</p>}
            </section>

            {/* Thông tin nhận món + tổng tiền */}
            <section
              ref={checkoutRef}
              className="min-w-0 scroll-mt-4 space-y-4 rounded-3xl border border-slate-200 bg-card p-5 lg:sticky lg:top-4"
            >
              <h2 className="text-lg font-bold text-slate-900">{t.yourOrder}</h2>

              <div className="grid grid-cols-2 gap-2">
                {[
                  ['pickup', t.pickup, ShoppingBag],
                  ['delivery', t.delivery, Truck],
                ].map(([id, label, Icon]) => (
                  <button
                    key={id}
                    onClick={() => setForm((f) => ({ ...f, type: id }))}
                    aria-pressed={form.type === id}
                    className={`flex items-center justify-center gap-2 rounded-xl py-3 font-semibold ${
                      form.type === id ? 'bg-blue-500 text-white' : 'border border-slate-300 text-slate-800'
                    }`}
                  >
                    <Icon size={18} /> {label}
                  </button>
                ))}
              </div>

              {isDelivery ? (
                <Field label={t.deliveryDay} error={shown.time} hint={t.deliveryWindow(dStart, dEnd)}>
                  <select
                    id="order-delivery-date"
                    value={form.deliveryDate}
                    onChange={set('deliveryDate')}
                    className={inputClass(shown.time)}
                  >
                    {deliveryDays.map((d) => (
                      <option key={d.key} value={d.key} className="bg-card">
                        {d.label}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t.date}>
                    <select id="order-date" value={form.date} onChange={set('date')} className={inputClass(false)}>
                      {days.map((d) => (
                        <option key={d.key} value={d.key} className="bg-card">
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={isDelivery ? t.deliveryTime : t.pickupTime}
                    error={shown.time}
                    hint={t.earliest(
                      `${timeKey(earliest)}${dateKey(earliest) !== dateKey(new Date()) ? ` ${pad(earliest.getDate())}/${pad(earliest.getMonth() + 1)}` : ''}`,
                    )}
                  >
                    <input
                      id="order-time"
                      type="time"
                      step="300"
                      value={form.time}
                      onChange={set('time')}
                      className={inputClass(shown.time)}
                    />
                  </Field>
                </div>
              )}

              <Field label={t.name} error={shown.name}>
                <input
                  id="order-name"
                  autoComplete="name"
                  value={form.name}
                  onChange={set('name')}
                  className={inputClass(shown.name)}
                />
              </Field>
              <Field label={t.phone} error={shown.phone}>
                <input
                  id="order-phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={set('phone')}
                  className={inputClass(shown.phone)}
                />
              </Field>
              {isDelivery && (
                <Field
                  label={t.address}
                  error={shown.address}
                  hint={
                    zone
                      ? `${t.zoneFee(zone.name)}: ${t.shipping} ${formatMoney(fee)}`
                      : form.address.trim().length >= 5
                        ? t.zoneUnknown
                        : t.zoneTyping
                  }
                >
                  <textarea
                    id="order-address"
                    rows={2}
                    autoComplete="street-address"
                    value={form.address}
                    onChange={set('address')}
                    placeholder={t.addressHint}
                    className={inputClass(shown.address)}
                  />
                </Field>
              )}
              {isDelivery && (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer">{t.zones}</summary>
                  <ul className="mt-1 space-y-0.5">
                    {zones.map((z) => (
                      <li key={z.id}>
                        {z.name}: {formatMoney(Number(z.fee) || 0)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <Field label={t.note}>
                <textarea
                  id="order-note"
                  rows={2}
                  maxLength={300}
                  value={form.note}
                  onChange={set('note')}
                  placeholder={t.notePlaceholder}
                  className={inputClass(false)}
                />
              </Field>
              {/* Ô bẫy: ẩn với người dùng */}
              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={form.website}
                onChange={set('website')}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                name="website"
              />

              <div className="space-y-1 border-t border-slate-200 pt-3 text-[15px]">
                {items.length === 0 ? (
                  <p className="text-slate-500">{t.noItems}</p>
                ) : (
                  items.map((i) => (
                    <p key={i.id} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        <b>{i.qty} ×</b> {i.name}
                      </span>
                      <span className="shrink-0 text-slate-500">{formatMoney(i.qty * i.price)}</span>
                    </p>
                  ))
                )}
                {isDelivery && (
                  <p className="flex justify-between gap-3 text-slate-500">
                    <span>{t.shipping}</span>
                    <span>{zone ? formatMoney(fee) : '—'}</span>
                  </p>
                )}
                <p className="flex justify-between gap-3 pt-1 text-xl font-bold text-slate-900">
                  <span>{t.total}</span>
                  <span>{formatMoney(total)}</span>
                </p>
                <p className="text-xs text-slate-500">{t.payOnPickup}</p>
              </div>

              {serverError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{serverError}</p>
              )}
              <button
                ref={submitRef}
                onClick={submit}
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-4 text-base font-bold text-white active:bg-blue-600 disabled:opacity-60"
              >
                {sending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> {t.sending}
                  </>
                ) : (
                  t.submit(formatMoney(total))
                )}
              </button>
            </section>
          </div>
        )}
      </div>

      {/* Điện thoại: thanh giỏ hàng dưới đáy, bấm để xuống phần đặt */}
      {!closed && count > 0 && !checkoutVisible && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <button
            onClick={() => checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex w-full items-center justify-between rounded-xl bg-blue-500 px-5 py-3.5 font-bold text-white active:bg-blue-600"
          >
            <span>{t.items(count)}</span>
            <span>
              {t.viewOrder} · {formatMoney(total)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
