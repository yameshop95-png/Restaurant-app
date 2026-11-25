// Tab "Đợt này" của Báo cáo (PR #82): thẻ A "Đợt thứ Bảy này" + thẻ B "Đặt hàng so
// với dự báo". File này (và biểu đồ tuần giao) là nơi DUY NHẤT import recharts —
// ReportPage nạp nó bằng React.lazy nên chunk chính và trang chủ không nặng thêm.
// Số liệu tính bằng lib/currentRun thuần; component chỉ hiển thị.
import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import useNow from '../hooks/useNow';
import { currentRun } from '../lib/currentRun';
import { weeklyForecast } from '../lib/forecast';
import { sideOf } from '../lib/route';
import { formatMoney } from '../lib/stats';

const NO_WEATHER = {};
const fmtDay = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

const FULL_DAY = { T2: 'Thứ 2', T3: 'Thứ 3', T4: 'Thứ 4', T5: 'Thứ 5', T6: 'Thứ 6', T7: 'Thứ 7', CN: 'Chủ nhật' };
// Màn hình cảm ứng: chạm mới hiện tooltip (hover không có trên điện thoại — B1, issue #89)
const COARSE = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

// Tooltip của biểu đồ tích luỹ: "Thứ 5 · Đợt này 18 đơn · TB 4 tuần trước 15 đơn"
function PaceTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const cur = payload.find((p) => p.dataKey === 'current')?.value;
  const avg = payload.find((p) => p.dataKey === 'avg')?.value;
  return (
    <div className="rounded-xl border border-slate-200 bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">
        {FULL_DAY[label] ?? label} · Đợt này {cur} đơn
        {avg != null && <> · TB 4 tuần trước {Math.round(avg)} đơn</>}
      </p>
    </div>
  );
}

const PROGRESS_CELLS = [
  ['inbox', 'Chờ xử lý', 'orders'],
  ['cooking', 'Chờ nấu', 'cooking'],
  ['done', 'Nấu xong', 'cooking'],
  ['delivering', 'Đang giao', 'delivery'],
  ['shipped', 'Đã giao', 'delivery'],
  ['failed', 'Giao không được', 'delivery'],
];

export default function CurrentRunSection({ orders, menu, settings, onNavigate }) {
  const now = useNow(30000);
  const weatherLog = settings?.weatherLog ?? NO_WEATHER;
  const homeSide = sideOf(settings?.shopAddress) ?? 'vic';
  // Dự báo gọi đúng cách ForecastCard gọi weeklyForecast (kèm weatherLog của quán)
  const forecast = useMemo(
    () => weeklyForecast({ orders, now, weatherLog }),
    [orders, now, weatherLog],
  );
  const data = useMemo(
    () => currentRun(orders, now, { forecast, homeSide, menu }),
    [orders, now, forecast, homeSide, menu],
  );
  const { pace } = data;
  const maxMix = Math.max(data.mix.pickup, data.mix.delivery, 1);

  return (
    <>
      {/* Thẻ A — Đợt thứ Bảy này */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
        <div className="px-5 pt-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Trực tiếp · Đợt giao Thứ Bảy {fmtDay(data.saturday)}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Đã nhận {data.received} đơn</p>
          {pace && (
            <p className="mt-1 text-sm text-slate-500">
              TB 4 tuần trước cùng thời điểm: ≈{Math.round(pace.avg)} đơn
              {pace.pct == null ? (
                <> — tương đương mọi tuần</>
              ) : (
                <span className={`font-semibold ${pace.pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {' '}({pace.pct >= 0 ? '+' : ''}{Math.round(pace.pct * 100)}%)
                </span>
              )}
            </p>
          )}
        </div>

        <div className="px-2 pb-1 pt-3" style={{ height: 170 }} data-no-swipe>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.cumulative} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis width={28} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<PaceTip />} cursor={{ fill: '#f1f5f9' }} trigger={COARSE ? 'click' : 'hover'} />
              <Bar dataKey="current" fill="#f97316" radius={[5, 5, 0, 0]} maxBarSize={38} />
              <Line type="monotone" dataKey="avg" stroke="#64748b" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="px-5 pb-3 text-xs text-slate-400">
          Cột: đơn tích luỹ của đợt này theo ngày đặt · Đường đứt: trung bình 4 tuần trước ở cùng thời điểm.
        </p>

        <div className="border-t border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-900">Tiến độ đợt</h3>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PROGRESS_CELLS.map(([key, label, tab]) => (
              <button
                key={key}
                type="button"
                onClick={() => onNavigate?.(tab)}
                className="rounded-2xl bg-slate-50 px-2 py-2.5 text-center active:bg-slate-100"
              >
                <span className="block text-xl font-bold text-slate-900">{data.progress[key]}</span>
                <span className="block text-[11px] font-medium leading-tight text-slate-500">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 px-5 py-4 text-center">
          <div>
            <p className="text-base font-bold text-slate-900">{formatMoney(data.money.expected)}</p>
            <p className="text-[11px] text-slate-500">Dự kiến thu</p>
          </div>
          <div>
            <p className="text-base font-bold text-emerald-600">{formatMoney(data.money.collected)}</p>
            <p className="text-[11px] text-slate-500">Đã thu</p>
          </div>
          <div>
            <p className={`text-base font-bold ${data.money.outstanding > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {formatMoney(data.money.outstanding)}
            </p>
            <p className="text-[11px] text-slate-500">Còn phải thu</p>
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-100 px-5 py-4">
          {[
            ['Đến lấy', data.mix.pickup, '#0ea5e9'],
            ['Giao hàng', data.mix.delivery, '#f97316'],
          ].map(([label, value, color]) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <span className="w-20 shrink-0 text-slate-600">{label}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full" style={{ width: `${(value / maxMix) * 100}%`, background: color }} />
              </span>
              <span className="w-8 shrink-0 text-right font-semibold text-slate-900">{value}</span>
            </div>
          ))}
          <p className="text-xs text-slate-400">
            Trong đơn giao: Wodonga {data.mix.wodonga} · Albury – Lavington {data.mix.albury}
            {data.mix.unknown > 0 && <> · Chưa rõ {data.mix.unknown}</>}
          </p>
        </div>
      </section>

      {/* Thẻ B — Đặt hàng so với dự báo */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
        <div className="px-5 pt-4">
          <h2 className="font-bold text-slate-900">Đặt hàng so với dự báo</h2>
          <p className="mt-0.5 text-xs text-slate-400">Số phần của đợt thứ Bảy này so với dự báo cả đợt</p>
        </div>
        {!data.forecastReady ? (
          <div className="px-5 pb-5 pt-2">
            <ul className="divide-y divide-slate-100">
              {data.dishRows.map((d) => (
                <li key={d.key} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 font-medium text-slate-800">{d.name}</span>
                  <span className="shrink-0 text-slate-600">Đã đặt <b className="text-slate-900">{d.ordered}</b></span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              {data.forecastPending
                ? 'Dự báo đợt mới có từ Thứ Hai.'
                : 'Chưa đủ dữ liệu các tuần trước để dự báo — khi có thêm vài tuần bán, thẻ này sẽ hiện thêm cột dự báo và phần còn dự kiến.'}
            </p>
          </div>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100 px-5 pb-2">
            {data.dishRows.map((d) => {
              const ratio = d.forecast ? d.ordered / d.forecast : null;
              const over = ratio != null && ratio > 1;
              const near = ratio != null && ratio >= 0.9 && ratio <= 1;
              return (
                <li key={d.key} className={`py-2 ${over ? '-mx-2 rounded-lg bg-red-50 px-2' : near ? '-mx-2 rounded-lg bg-amber-50 px-2' : ''}`}>
                  <p className="text-sm font-medium text-slate-800">{d.name}</p>
                  <p className="mt-0.5 text-right text-xs text-slate-500">
                    Đã đặt <b className="text-slate-900">{d.ordered}</b>
                    {' · '}Dự báo <b className="text-slate-900">{d.forecast ?? '—'}</b>
                    {' · '}Còn <b className="text-slate-900">{d.remaining ?? '—'}</b>
                  </p>
                  {(over || near) && (
                    <p className={`mt-0.5 text-xs font-semibold ${over ? 'text-red-600' : 'text-amber-600'}`}>
                      {over ? 'Vượt dự báo' : 'Sắp vượt dự báo'}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          onClick={() => onNavigate?.('prep')}
          className="block w-full border-t border-slate-100 px-5 py-3 text-left text-sm font-semibold text-blue-600 active:bg-slate-50"
        >
          Chuẩn bị chi tiết ở trang Chuẩn bị →
        </button>
      </section>
    </>
  );
}
