import { useEffect, useMemo, useState } from 'react';
import { formatDate, formatDay, formatMoney, summarize } from '../lib/stats';

function Card({ title, children, className = '' }) {
  return (
    <section
      className={`overflow-hidden rounded-3xl border border-white/80 bg-white/70 shadow-sm backdrop-blur ${className}`}
    >
      {title && <h2 className="px-5 pt-4 text-[15px] text-slate-500">{title}</h2>}
      {children}
    </section>
  );
}

export default function HomePage({ orders }) {
  // Cập nhật "bây giờ" mỗi phút để số liệu tuần tự reset khi sang sáng thứ Hai.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => summarize(orders, now), [orders, now]);
  const maxQty = stats.weekItems[0]?.qty ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Tổng tuần này</h1>
          <p className="mt-1 text-sm text-slate-500">Từ thứ Hai {formatDate(stats.weekStart)}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold capitalize text-slate-800">{formatDay(now)}</p>
          <p className="text-slate-500">{formatDate(now)}</p>
        </div>
      </div>

      <Card title="Tiền tuần này">
        <div className="flex items-end justify-between px-5 pb-5 pt-1">
          <p className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {formatMoney(stats.weekRevenue)}
          </p>
          <span className="rounded-full bg-blue-100 px-4 py-1.5 font-semibold text-blue-600">
            {stats.weekOrderCount} đơn
          </span>
        </div>
      </Card>

      <Card title="Tổng cộng dồn">
        <div className="flex items-end justify-between px-5 pb-5 pt-1">
          <p className="text-3xl font-bold tracking-tight text-slate-900">{formatMoney(stats.allTimeRevenue)}</p>
          <span className="text-sm text-slate-500">{stats.allTimeOrderCount} đơn từ trước tới nay</span>
        </div>
      </Card>

      <Card title="Món bán trong tuần">
        {stats.weekItems.length === 0 ? (
          <p className="px-5 py-6 text-center text-slate-400">Chưa có đơn nào trong tuần này</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 border-t border-slate-200">
            {stats.weekItems.map((item) => (
              <li key={item.name} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-slate-900">{item.name}</span>
                  <span className="shrink-0 font-semibold text-slate-900">{formatMoney(item.revenue)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${(item.qty / maxQty) * 100}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-sm text-slate-500">{item.qty} phần</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
