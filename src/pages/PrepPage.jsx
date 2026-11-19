import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { sendPrepSheet } from '../lib/printQueue';
import { prepDays, prepSheet, timeOf } from '../lib/prep';

// Phiếu làm hàng: chọn ngày lấy / giao, xem tổng phần mỗi món phải làm và in ra máy ở quán
export default function PrepPage({ orders, now, settings }) {
  const days = useMemo(() => prepDays(orders, now), [orders, now]);
  const [chosen, setChosen] = useState(null);
  const key = days.some((d) => d.key === chosen) ? chosen : days[0]?.key;
  const sheet = useMemo(() => (key ? prepSheet(orders, key, now) : null), [orders, key, now]);
  const label = days.find((d) => d.key === key)?.label ?? '';
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const print = async () => {
    setBusy(true);
    try {
      await sendPrepSheet(sheet, label, settings.shopName);
      setMsg('Đã gửi phiếu ra máy in ở quán');
    } catch {
      setMsg('Chưa gửi được lệnh in, kiểm tra mạng rồi thử lại');
    }
    setBusy(false);
    setTimeout(() => setMsg(null), 4000);
  };

  if (!days.length) {
    return (
      <p className="staff-stagger mx-auto max-w-2xl rounded-3xl bg-card px-5 py-12 text-center text-slate-400">
        Không có đơn nào chờ làm. Đơn mới sẽ tự hiện ở đây theo ngày lấy / giao.
      </p>
    );
  }

  return (
    <div className="staff-stagger mx-auto max-w-2xl space-y-5 pb-24 md:max-w-5xl">
      <div data-no-swipe className="flex gap-2 overflow-x-auto">
        {days.map((d) => (
          <button
            key={d.key}
            onClick={() => setChosen(d.key)}
            aria-pressed={d.key === key}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
              d.key === key ? 'bg-slate-900 text-slate-50' : 'bg-card text-slate-600'
            }`}
          >
            {d.label} <span className={d.key === key ? 'text-slate-300' : 'text-slate-400'}>{d.pending}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm" aria-label="Món cần làm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Cần làm · {label}</h2>
              <p className="text-sm text-slate-500">
                {sheet.pendingCount} đơn chờ · {sheet.pickup} đến lấy · {sheet.delivery} giao · {sheet.portions} phần
              </p>
            </div>
            <button
              onClick={print}
              disabled={busy}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white active:bg-blue-600 disabled:opacity-50"
            >
              <Printer size={16} /> In phiếu
            </button>
          </div>
          {sheet.items.length === 0 ? (
            <p className="px-5 py-8 text-center text-slate-400">Đơn ngày này đã làm xong hết</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sheet.items.map((it) => (
                <li key={it.name} className="px-5 py-3">
                  <p className="flex items-baseline gap-3">
                    <span className="w-14 shrink-0 text-right text-3xl font-extrabold tabular-nums text-blue-500">{it.qty}</span>
                    <span className="text-xl font-bold text-slate-900">{it.name}</span>
                  </p>
                  {it.notes.map((n) => (
                    <p key={n.note} className="ml-[4.25rem] text-sm italic text-slate-500">
                      {n.qty} phần: {n.note}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {msg && <p className="border-t border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">{msg}</p>}
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm" aria-label="Đơn theo giờ">
          <h2 className="border-b border-slate-200 px-5 py-4 font-bold text-slate-900">Đơn theo giờ</h2>
          <ul className="divide-y divide-slate-100">
            {sheet.orders.map((o) => (
              <li key={o.id} className={`px-5 py-3 ${o.status === 'pending' ? '' : 'opacity-50'}`}>
                <p className="flex flex-wrap items-baseline gap-x-2 font-semibold text-slate-900">
                  <span className="tabular-nums">{timeOf(o)}</span>
                  <span>
                    #{o.number} {o.customer?.name}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {o.type === 'delivery' ? 'Giao' : 'Đến lấy'}
                    {o.status === 'pending' ? '' : ' · đã xong'}
                  </span>
                </p>
                <p className="text-sm text-slate-600">{(o.items ?? []).map((i) => `${i.qty} ${i.name}`).join(', ')}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
