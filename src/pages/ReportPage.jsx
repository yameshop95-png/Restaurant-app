import { Fragment, Suspense, lazy, useMemo, useState } from 'react';

// Tab Đợt này và biểu đồ tuần giao dùng Recharts — nạp lười (lazy) để thư viện
// biểu đồ chỉ tải khi mở Báo cáo, không vào chunk chính và không vào trang chủ.
const CurrentRunSection = lazy(() => import('../components/CurrentRunSection'));
const WeeklyRevenueChart = lazy(() => import('../components/WeeklyRevenueChart'));
const CHART_FALLBACK = (
  <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-400">
    <Loader2 size={17} className="animate-spin" /> Đang tải biểu đồ…
  </div>
);
import {
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Loader2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import AnalyticsExportCard from '../components/AnalyticsExportCard';
import { DebtCard, DeliveryOpsCard, RegionCard, WebOpsCard } from '../components/OpsCards';
import CustomerStatsCard from '../components/CustomerStatsCard';
import LanguageCard from '../components/LanguageCard';
import PairsCard from '../components/PairsCard';
import WeekRhythmCard, { WeekRhythmBars } from '../components/WeekRhythmCard';
import WeeklyPerformanceCard from '../components/WeeklyPerformanceCard';
import { buildReport, PERIODS, reportForAI, shiftPeriod } from '../lib/report';
import { periodInsights, weekOfMonthRhythm } from '../lib/reportInsights';
import CountUp, { formatCount } from '../components/CountUp';
import { formatMoney } from '../lib/stats';
import useSwipe from '../hooks/useSwipe';

// 3 tab con của Báo cáo (PR #81 theo docs/bao-cao-plan.md): realtime đợt này,
// số liệu theo kỳ, và khách & món. Tab không mở thì không render thẻ của tab đó.
const REPORT_TABS = [
  ['dot-nay', 'Đợt này'],
  ['theo-ky', 'Theo kỳ'],
  ['khach-mon', 'Khách & món'],
];

const ACCESS_CODE_KEY = 'restaurant-app.ai-code';
// Tỉ lệ 0–1 → % với tối đa 1 chữ số thập phân, dấu phẩy kiểu Việt (VD 0,222 → "22,2%")
const fmtRate = (r) => (r == null ? '—' : `${Math.round(r * 1000) / 10}%`.replace('.', ','));
const SERIES = 'var(--chart-series)'; // màu chuỗi dữ liệu duy nhất của biểu đồ (cam chính của quán)

function Card({ title, right, children }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
      {title && (
        <div className="flex items-center justify-between gap-2 px-5 pt-4">
          <h2 className="font-bold text-slate-900">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}


// Tiền rút gọn cho nhãn trên đầu cột (VD $5,7k) — nhãn đầy đủ vẫn ở bảng chú thích dưới chart.
const fmtShortMoney = (v) => (v >= 1000 ? `$${(v / 1000).toFixed(1).replace('.', ',')}k` : formatMoney(v));


// DEMO v4 (Paul chọn 24/11): BẢN ĐỒ NHIỆT món × tuần — hàng là top 8 món của kỳ đang
// xem, cột là 8 tuần gần nhất, ô càng đậm thì món đó tuần đó bán càng mạnh (doanh thu).
// Một hình trả lời cả hai câu "tuần nào như nào" và "món nào đang lên/xuống": hàng đậm
// đều = món gánh quán, hàng nhạt dần = món đang đuối, cột đậm = tuần nóng.
// Thay cho chart xếp chồng ở v2/v3 (Paul nhận xét chỉ "tạm được").
const HEAT_STEPS = ['#f8fafc', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c'];
function DishHeatmap({ orders, menu, anchor }) {
  const data = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const r = buildReport(orders, 'week', shiftPeriod('week', anchor, -i), menu);
      const byName = new Map(r.dishes.map((d) => [d.name, d.revenue]));
      weeks.push({ start: r.range.start, total: r.dishes.reduce((sum, d) => sum + d.revenue, 0), byName });
    }
    // Hàng của bản đồ nhiệt = top 8 theo TỔNG doanh thu của đúng 8 tuần đang hiện,
    // tự xếp lại mỗi khi có dữ liệu mới: món ngoài top tăng mạnh sẽ tự vào, món trong
    // top đuối dần sẽ tự rớt — không phải danh sách cố định (Paul hỏi 24/11).
    const totals = new Map();
    for (const w of weeks) for (const [name, rev] of w.byName) totals.set(name, (totals.get(name) ?? 0) + rev);
    const dishNames = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name);
    const matrix = dishNames.map((name) => weeks.map((w) => w.byName.get(name) ?? 0));
    const max = Math.max(...matrix.flat(), 0);
    const hottest = weeks.reduce((best, w, i) => (w.total > (weeks[best]?.total ?? -1) ? i : best), 0);
    return { weeks, matrix, max, hottest, dishNames };
  }, [orders, menu, anchor]);

  const fmtDay = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const cellStyle = (v) => {
    if (!v || !data.max) return { background: HEAT_STEPS[0], color: '#cbd5e1' };
    const idx = Math.min(1 + Math.floor((v / data.max) * (HEAT_STEPS.length - 1)), HEAT_STEPS.length - 1);
    return { background: HEAT_STEPS[idx], color: idx >= 5 ? '#fff' : '#334155' };
  };

  return (
    <div className="mt-3">
      <div className="overflow-x-auto" data-no-swipe>
        <div className="grid min-w-[560px] gap-1" style={{ gridTemplateColumns: 'minmax(92px,1.15fr) repeat(8, minmax(0,1fr))' }}>
          <div className="sticky left-0 z-10 bg-card" />
          {data.weeks.map((w, i) => (
            <div key={i} className={`pb-0.5 text-center text-[11px] font-semibold ${i === data.hottest ? 'text-orange-600' : 'text-slate-500'}`}>
              {fmtDay(w.start)}
            </div>
          ))}
          {data.dishNames.map((name, r) => (
            <Fragment key={name}>
              <div className="sticky left-0 z-10 flex items-center truncate bg-card pr-2 text-xs font-medium text-slate-700 shadow-[6px_0_8px_-6px_rgba(15,23,42,0.35)]" title={name}>{name}</div>
              {data.matrix[r].map((v, c) => (
                <div key={`${name}-${c}`} className="flex h-9 items-center justify-center rounded-md text-[11px] font-semibold" style={cellStyle(v)}>
                  {v ? fmtShortMoney(v) : '—'}
                </div>
              ))}
            </Fragment>
          ))}
          <div className="sticky left-0 z-10 bg-card pt-1 text-xs font-semibold text-slate-500">Tổng tuần</div>
          {data.weeks.map((w, i) => (
            <div key={i} className={`pt-1 text-center text-[11px] font-bold ${i === data.hottest ? 'text-orange-600' : 'text-slate-700'}`}>
              {fmtShortMoney(w.total)}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span>Ít</span>
        <span className="h-2.5 flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${HEAT_STEPS.join(',')})` }} />
        <span>Nhiều</span>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Ô càng đậm = món đó tuần đó doanh thu càng cao. Tuần bán mạnh nhất trong 8 tuần: bắt đầu {fmtDay(data.weeks[data.hottest].start)} ({formatMoney(data.weeks[data.hottest].total)}). 8 hàng là 8 món doanh thu cao nhất của đúng 8 tuần này — tự cập nhật khi có đơn mới, món tăng mạnh tự vào, món đuối tự rớt.
      </p>
    </div>
  );
}


// DEMO v3 (Paul gợi ý 24/11): gộp mọi thứ về tuần vào MỘT thẻ "Nhịp tuần" với 2 chế độ
// xem — "Theo tuần": 8 tuần gần nhất xếp chồng theo món; "Trong tháng": nhịp tuần 1–5
// trong tháng (chart của WeekRhythmCard cũ). Gộp kiểu chuyển chế độ thì không rối vì
// mỗi chế độ chỉ hiện một ý; card món trở về Pareto thuần như v1.
function WeekSection({ report, orders, menu, anchor }) {
  const [mode, setMode] = useState('mon-tuan');
  const rhythm = useMemo(() => weekOfMonthRhythm(orders, new Date()), [orders]);
  return (
    <div className="px-5 pb-4">
      <div className="mt-3 flex items-center gap-2">
        {[
          ['mon-tuan', 'Món × tuần'],
          ['trong-thang', 'Trong tháng'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${mode === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {label}
          </button>
        ))}
        {mode === 'trong-thang' && rhythm.enough && (
          <span className="ml-auto text-sm text-slate-500">{rhythm.weeksConsidered} tuần đã qua</span>
        )}
      </div>
      {mode === 'mon-tuan' ? (
        <DishHeatmap orders={orders} menu={menu} anchor={anchor} />
      ) : (
        <WeekRhythmBars rhythm={rhythm} />
      )}
    </div>
  );
}

// DEMO v2: card "Thời điểm" thành chart cột — cột = doanh thu từng đoạn (đầu/giữa/cuối
// tháng, hoặc ngày trong tuần, hoặc quý), nhãn trên cột là tiền + số đơn, dưới cột giữ
// dòng món bán chạy của đoạn đó như bản chữ cũ.
function SegmentBars({ segments }) {
  const maxRevenue = Math.max(...segments.map((s) => s.revenue), 0);
  return (
    <div className="px-5 pb-4">
      <div className="mt-4 flex items-end gap-3">
        {segments.map((s) => (
          <div key={s.label} className="flex h-40 min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <div className="text-center leading-tight">
              <div className="text-sm font-bold text-slate-900">{formatMoney(s.revenue)}</div>
              <div className="text-xs text-slate-500">{s.orders} đơn</div>
            </div>
            <div
              className="w-full max-w-16 rounded-t-lg"
              style={{
                height: `${maxRevenue ? Math.max((s.revenue / maxRevenue) * 100, s.revenue > 0 ? 3 : 0) : 0}%`,
                background: 'var(--chart-series)',
                opacity: s.revenue === maxRevenue && maxRevenue > 0 ? 1 : 0.5,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 border-t border-slate-100 pt-2">
        {segments.map((s) => (
          <div key={s.label} className="min-w-0 flex-1 text-center">
            <div className="text-sm font-semibold leading-snug text-slate-900">{s.label}</div>
            <div className="mt-0.5 text-xs leading-snug text-slate-500">
              {s.top.length ? s.top.map((t) => `${t.name} (${t.qty})`).join(' · ') : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// DEMO (Paul xem thử 24/11): combo chart Pareto cho top 10 món theo doanh thu —
// cột = doanh thu từng món, đường = % doanh thu cộng dồn (trục phải). Dưới chart là
// chú thích 1 dòng/món cho đúng 10 món đó. Món ngoài top 10 chỉ tính vào dòng tổng kết.
function DishComboChart({ dishes }) {
  const top = [...dishes].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const topShare = top.reduce((sum, d) => sum + d.revenueShare, 0);
  const restCount = dishes.length - top.length;

  const W = 760;
  const H = 350;
  const M = { top: 26, right: 46, bottom: 96, left: 10 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const maxRevenue = Math.max(...top.map((d) => d.revenue), 0);
  const slot = plotW / Math.max(top.length, 1);
  const barW = Math.min(slot * 0.62, 52);
  let running = 0;
  const bars = top.map((d, i) => {
    running += d.revenueShare;
    const h = maxRevenue ? (d.revenue / maxRevenue) * plotH : 0;
    return {
      ...d,
      x: M.left + slot * i + (slot - barW) / 2,
      cx: M.left + slot * i + slot / 2,
      y: M.top + plotH - h,
      h,
      cumShare: running,
    };
  });
  const linePts = bars.map((b) => `${b.cx},${M.top + plotH - b.cumShare * plotH}`).join(' ');

  return (
    <div className="px-5 pb-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Biểu đồ doanh thu top 10 món">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={M.left} x2={W - M.right} y1={M.top + plotH - f * plotH} y2={M.top + plotH - f * plotH} stroke="#e2e8f0" strokeDasharray={f === 0 ? '' : '3 4'} />
            <text x={W - M.right + 8} y={M.top + plotH - f * plotH + 4} fontSize="11" fill="#64748b">{Math.round(f * 100)}%</text>
          </g>
        ))}
        {bars.map((b) => (
          <g key={b.name}>
            <rect x={b.x} y={b.y} width={barW} height={b.h} rx="5" style={{ fill: 'var(--chart-series)' }} />
            <text x={b.cx} y={b.y - 7} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#334155">{fmtShortMoney(b.revenue)}</text>
            <text x={b.cx} y={M.top + plotH + 14} fontSize="11.5" fill="#334155" textAnchor="end" transform={`rotate(-28 ${b.cx} ${M.top + plotH + 14})`}>{b.name}</text>
          </g>
        ))}
        <polyline points={linePts} fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {bars.map((b) => (
          <circle key={b.name} cx={b.cx} cy={M.top + plotH - b.cumShare * plotH} r="3.5" fill="#0f766e" stroke="#fff" strokeWidth="1.5" />
        ))}
        {bars.length > 0 && (
          <text x={bars[bars.length - 1].cx} y={M.top + plotH - bars[bars.length - 1].cumShare * plotH - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f766e">
            {Math.round(bars[bars.length - 1].cumShare * 100)}%
          </text>
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--chart-series)' }} /> Cột: doanh thu</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 bg-teal-700" /> Đường: % doanh thu cộng dồn</span>
      </div>
      <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
        {top.map((d, i) => {
          const change = d.prevQty ? (d.qty - d.prevQty) / d.prevQty : null;
          return (
            <li key={d.name} className="py-1.5 text-sm">
              {/* Hàng chính: từ sm trở lên là 1 hàng như cũ; dưới sm chỉ còn hạng + tên
                  món (không cắt chữ, cho xuống dòng) — bản cũ ép tên món còn ~2px ở 390px */}
              <div className="flex items-baseline gap-3">
                <span className="w-5 shrink-0 text-right font-semibold text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1 font-medium text-slate-800 sm:truncate">{d.name}</span>
                <span className="hidden shrink-0 text-slate-500 sm:block">{d.qty} phần</span>
                <span className="hidden w-20 shrink-0 text-right font-semibold text-slate-900 sm:block">{formatMoney(d.revenue)}</span>
                <span className="hidden w-11 shrink-0 text-right text-slate-500 sm:block">{Math.round(d.revenueShare * 100)}%</span>
                <span className={`hidden w-14 shrink-0 text-right text-xs font-semibold sm:block ${change == null ? 'text-slate-300' : change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {change == null ? '—' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(change * 100))}%`}
                </span>
              </div>
              {/* Hàng phụ chỉ ở dưới sm: phần · tiền · % · thay đổi, căn phải, chữ nhỏ */}
              <div className="mt-0.5 flex items-baseline justify-end gap-3 text-xs text-slate-500 sm:hidden">
                <span>{d.qty} phần</span>
                <span className="font-semibold text-slate-900">{formatMoney(d.revenue)}</span>
                <span>{Math.round(d.revenueShare * 100)}%</span>
                <span className={`font-semibold ${change == null ? 'text-slate-300' : change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {change == null ? '—' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(change * 100))}%`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-slate-400">
        Top {top.length} món chiếm {Math.round(topShare * 100)}% doanh thu{restCount > 0 ? ` — còn ${restCount} món khác ngoài top 10` : ''}.
      </p>
    </div>
  );
}

function Change({ now, before, toDate }) {
  if (!before) return <span className="text-sm text-slate-400">kỳ trước: chưa có</span>;
  const g = (now - before) / before;
  const up = g >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-1 text-sm font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      <Icon size={15} /> {up ? '+' : ''}
      {Math.round(g * 100)}% so với {toDate ? 'cùng thời điểm kỳ trước' : 'kỳ trước'}
    </span>
  );
}

// Biểu đồ cột doanh thu: một chuỗi, chạm/rê vào cột để xem số liệu
function RevenueChart({ buckets, kind }) {
  const [active, setActive] = useState(null);
  const max = Math.max(...buckets.map((b) => b.revenue), 0);
  const niceMax = max ? Math.ceil(max / 10 ** Math.floor(Math.log10(max))) * 10 ** Math.floor(Math.log10(max)) : 1;
  const ticks = [niceMax, niceMax / 2, 0];
  const showLabel = (i) => kind !== 'month' || i === 0 || (i + 1) % 5 === 0;
  const shown = active != null ? buckets[active] : null;

  return (
    <div className="px-5 pb-4 pt-2">
      <p className="mb-2 h-5 text-sm text-slate-600">
        {shown ? (
          <>
            <b className="text-slate-900">{shown.long}</b>: {formatMoney(shown.revenue)} · {shown.orders} đơn
          </>
        ) : (
          <span className="text-slate-400">Chạm vào cột để xem chi tiết</span>
        )}
      </p>
      <div className="flex gap-2">
        <div className="relative w-10 shrink-0 text-right text-[11px] text-slate-400" style={{ height: 160 }}>
          {ticks.map((t, i) => (
            <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / 2) * 100}%` }}>
              {t >= 1000 ? `${Math.round(t / 100) / 10}k` : Math.round(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: 160 }} onMouseLeave={() => setActive(null)}>
            {[0, 50, 100].map((p) => (
              <div key={p} className="absolute inset-x-0 border-t border-slate-200" style={{ top: `${p}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {buckets.map((b, i) => (
                <button
                  key={b.key}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  aria-label={`${b.long}: ${formatMoney(b.revenue)}, ${b.orders} đơn`}
                  className="flex h-full min-w-0 flex-1 items-end justify-center"
                >
                  <span
                    className="block w-full max-w-6 rounded-t transition-opacity"
                    style={{
                      height: `${(b.revenue / niceMax) * 100}%`,
                      minHeight: b.revenue ? 2 : 0,
                      background: SERIES,
                      opacity: active == null || active === i ? 1 : 0.35,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1 flex gap-[2px] text-[11px] text-slate-500">
            {buckets.map((b, i) => (
              <span key={b.key} className="min-w-0 flex-1 text-center">
                {showLabel(i) ? b.label : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-slate-500">Xem dạng bảng</summary>
        <table className="mt-2 w-full">
          <tbody>
            {buckets
              .filter((b) => b.orders)
              .map((b) => (
                <tr key={b.key} className="border-t border-slate-100">
                  <td className="py-1 text-slate-600">{b.long}</td>
                  <td className="py-1 text-right text-slate-500">{b.orders} đơn</td>
                  <td className="py-1 text-right font-semibold text-slate-900">{formatMoney(b.revenue)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

const AI_SECTIONS = [
  ['tong_quan', 'Tổng quan'],
  ['mon_ban_chay', 'Món bán chạy'],
  ['gia_ban', 'Giá bán'],
  ['thoi_diem', 'Thời điểm bán'],
  ['du_bao', 'Dự báo'],
];

function AIAnalysis({ report }) {
  const [state, setState] = useState({ status: 'idle' });
  const [code, setCode] = useState(() => {
    try {
      return localStorage.getItem(ACCESS_CODE_KEY) ?? '';
    } catch {
      return '';
    }
  });

  const run = async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Access-Code': code },
        body: JSON.stringify({ report: reportForAI(report) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fallback = res.status === 404 ? 'Chưa có máy chủ AI ở địa chỉ này (chỉ chạy trên bản deploy Vercel).' : `Lỗi ${res.status}`;
        setState({ status: 'error', error: data.error ?? fallback, needsCode: data.needsCode });
        return;
      }
      try {
        localStorage.setItem(ACCESS_CODE_KEY, code);
      } catch {
        // không lưu được mã: lần sau nhập lại
      }
      setState({ status: 'done', analysis: data.analysis, label: report.range.label });
    } catch {
      setState({ status: 'error', error: 'Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.' });
    }
  };

  const stale = state.status === 'done' && state.label !== report.range.label;

  return (
    <Card
      title="Phân tích bằng AI"
    >
      <div className="space-y-3 px-5 pb-5 pt-2">
        <p className="text-base leading-relaxed text-slate-600">
          Claude đọc số liệu của {report.range.label.toLowerCase()} và nhận xét món bán chạy, giá bán, thời điểm bán và
          dự báo kỳ tới. Chỉ gửi số liệu tổng hợp, không gửi tên, SĐT hay địa chỉ khách.
        </p>

        {state.needsCode && (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Nhập mã truy cập AI"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        )}

        <button
          onClick={run}
          disabled={state.status === 'loading' || !report.orderCount}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3 font-semibold text-white active:bg-blue-600 disabled:bg-slate-300 disabled:text-slate-500"
        >
          {state.status === 'loading' ? (
            <>
              <Loader2 size={19} className="animate-spin" /> AI đang phân tích…
            </>
          ) : (
            <>
              {state.status === 'done' ? 'Phân tích lại' : 'Phân tích'} {report.range.label.toLowerCase()}
            </>
          )}
        </button>

        {state.status === 'error' && (
          <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{state.error}</p>
        )}

        {state.status === 'done' && (
          <div className={`space-y-3 ${stale ? 'opacity-50' : ''}`}>
            {stale && <p className="text-sm font-semibold text-amber-700">Kết quả dưới đây là của {state.label}.</p>}
            {AI_SECTIONS.map(([key, title]) => (
              <div key={key}>
                <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                <p className="text-base leading-relaxed text-slate-700">{state.analysis[key]}</p>
              </div>
            ))}
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Nên làm ngay</h3>
              <ul className="list-disc space-y-1 pl-5 text-base text-slate-700">
                {state.analysis.de_xuat.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

const INSIGHT_ICON = {
  good: <TrendingUp size={16} className="mt-0.5 shrink-0 text-emerald-600" />,
  bad: <TrendingDown size={16} className="mt-0.5 shrink-0 text-red-600" />,
  neutral: <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-600" />,
};

export default function ReportPage({ orders, menu, settings, onUpdateSettings, onNavigate, onSetPaid, onSetPaidMany, initialTab = 'dot-nay' }) {
  const [kind, setKind] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date());
  // Mặc định mở Đợt này (đổi ở PR #82; PR #81 mặc định Theo kỳ). Không nhớ tab.
  // initialTab chỉ để test SSR mở từng tab — app không truyền prop này.
  const [tab, setTab] = useState(initialTab);
  const report = useMemo(() => buildReport(orders, kind, anchor, menu), [orders, kind, anchor, menu]);
  // Tỉ lệ đơn huỷ của đúng kỳ đang chọn (định nghĩa ở lib/reportInsights)
  const cancel = useMemo(() => periodInsights(orders, report.range).cancellation, [orders, report.range]);
  const atCurrent = report.range.end > new Date();
  const { forecast } = report;
  const nextLabel = { week: 'tuần sau', month: 'tháng sau', year: 'năm sau' }[kind];
  const tabIndex = REPORT_TABS.findIndex(([k]) => k === tab);
  const swipe = useSwipe({
    onNext: () => setTab(REPORT_TABS[Math.min(tabIndex + 1, REPORT_TABS.length - 1)][0]),
    onPrev: () => setTab(REPORT_TABS[Math.max(tabIndex - 1, 0)][0]),
  });

  return (
    <div className="report-page staff-stagger mx-auto max-w-2xl space-y-5 pb-8" {...swipe}>
      {/* Thanh 3 tab con — cùng kiểu nút chuyển chế độ của RoutePlanner */}
      <div className="flex rounded-2xl bg-slate-100 p-1 text-sm font-semibold">
        {REPORT_TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex-1 rounded-xl py-2 ${tab === k ? 'bg-card text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dot-nay' && (
        <Suspense fallback={CHART_FALLBACK}>
          <CurrentRunSection orders={orders} menu={menu} settings={settings} onNavigate={onNavigate} />
        </Suspense>
      )}

      {tab === 'theo-ky' && (
        <>
      {/* Chọn kỳ */}
      <div className="flex rounded-2xl bg-card p-1 shadow-sm">
        {Object.entries(PERIODS).map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              setAnchor(new Date());
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold ${kind === k ? 'bg-slate-900 text-slate-50' : 'text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setAnchor((a) => shiftPeriod(kind, a, -1))}
          className="rounded-full bg-card p-2 text-slate-600 shadow-sm active:bg-slate-100"
          aria-label="Kỳ trước"
        >
          <ChevronLeft size={20} />
        </button>
        <p className="text-center font-bold text-slate-900">
          {report.range.label}
          {forecast.isCurrent && <span className="block text-xs font-semibold text-blue-600">đang diễn ra</span>}
        </p>
        <button
          onClick={() => setAnchor((a) => shiftPeriod(kind, a, 1))}
          disabled={atCurrent}
          className="rounded-full bg-card p-2 text-slate-600 shadow-sm active:bg-slate-100 disabled:opacity-30"
          aria-label="Kỳ sau"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Tổng quan */}
      <Card>
        <div className="px-5 py-4">
          <p className="text-[15px] text-slate-500">Doanh thu</p>
          <p className="text-4xl font-bold tracking-tight text-slate-900">
            <CountUp value={report.revenue} format={formatMoney} />
          </p>
          <Change now={report.revenue} before={report.prevRevenue} toDate={report.comparedToDate} />
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
            <div>
              <p className="text-xl font-bold text-slate-900">
                <CountUp value={report.orderCount} format={formatCount} />
              </p>
              <p className="text-xs text-slate-500">đơn</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">
                <CountUp value={report.totalQty} format={formatCount} />
              </p>
              <p className="text-xs text-slate-500">phần</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">
                <CountUp value={report.avgOrder} format={formatMoney} />
              </p>
              <p className="text-xs text-slate-500">TB / đơn</p>
            </div>
          </div>
          {/* Đơn huỷ của kỳ: tổng đơn ở đây GỒM cả đơn huỷ (khác các số phía trên vốn đã loại đơn huỷ) */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-500">Đơn huỷ</span>
            <span className="font-semibold text-slate-900">
              {cancel.cancelledOrders} / {cancel.totalOrders} đơn · tỉ lệ huỷ {fmtRate(cancel.cancelRate)}
            </span>
          </div>
        </div>
      </Card>

      {/* Hiệu suất theo tuần: lãi theo kênh, số đơn và doanh thu trên cùng trục tuần */}
      <WeeklyPerformanceCard orders={orders} menu={menu} />

      {/* Kỳ Tuần ẩn thẻ doanh thu này; kỳ Tháng dùng cột theo tuần giao (quán chỉ
          bán thứ Bảy); kỳ Năm giữ cột theo tháng như cũ (PR #82) */}
      {kind === 'year' ? (
        <Card title="Doanh thu theo tháng">
          <RevenueChart buckets={report.buckets} kind={kind} />
        </Card>
      ) : kind === 'month' ? (
        <Card title="Doanh thu theo tuần giao">
          <Suspense fallback={CHART_FALLBACK}>
            <WeeklyRevenueChart orders={orders} anchor={anchor} />
          </Suspense>
        </Card>
      ) : null}

      {/* Món */}
      <Card title="Tổng món đã bán" right={<span className="text-sm text-slate-500">{report.dishes.length} món</span>}>
        {report.dishes.length === 0 ? (
          <p className="px-5 py-8 text-center text-slate-400">Chưa có đơn trong kỳ này</p>
        ) : (
          <DishComboChart dishes={report.dishes} />
        )}
      </Card>

      {/* Đơn theo vùng (PR #83) */}
      <RegionCard orders={orders} range={report.range} settings={settings} />

      {/* Dự báo */}
      <Card title="Dự báo doanh thu">
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 pt-2">
          {forecast.isCurrent && (
            <div className="rounded-2xl bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-700">Đã thực thu</p>
              <p className="text-xl font-bold text-blue-900">{formatMoney(forecast.collected)}</p>
              <p className="text-xs text-blue-700">
                còn phải thu {formatMoney(forecast.uncollected)} · đã qua {Math.round(forecast.elapsed * 100)}% kỳ
              </p>
            </div>
          )}
          <div className="rounded-2xl bg-slate-100 p-3">
            <p className="text-xs font-semibold text-slate-600">Dự báo {nextLabel}</p>
            <p className="text-xl font-bold text-slate-900">{formatMoney(forecast.nextForecast)}</p>
            <p className="text-xs text-slate-500">theo 3 kỳ gần nhất + xu hướng</p>
          </div>
          {!forecast.isCurrent && (
            <div className="rounded-2xl bg-slate-100 p-3">
              <p className="text-xs font-semibold text-slate-600">TB 3 kỳ trước</p>
              <p className="text-xl font-bold text-slate-900">{formatMoney(forecast.historyAvg)}</p>
            </div>
          )}
        </div>
        <p className="px-5 pb-4 text-xs text-slate-400">
          Dự báo tính đơn giản từ dữ liệu trong app; càng nhiều tuần/tháng dữ liệu thì càng sát.
        </p>
      </Card>

      {/* Giao hàng · Công nợ · Xử lý đơn web (PR #83) */}
      <DeliveryOpsCard orders={orders} range={report.range} settings={settings} />
      <DebtCard orders={orders} onSetPaid={onSetPaid} onSetPaidMany={onSetPaidMany} />
      <WebOpsCard orders={orders} range={report.range} />

      {/* DEMO v3: thẻ gộp "Nhịp tuần" — theo tuần (xếp chồng theo món) + nhịp trong tháng */}
      <Card title="Nhịp tuần">
        <WeekSection report={report} orders={orders} menu={menu} anchor={anchor} />
      </Card>

      {/* Thời điểm */}
      <Card title={kind === 'week' ? 'Theo ngày trong tuần' : kind === 'month' ? 'Thời điểm trong tháng' : 'Theo quý'}>
        <SegmentBars segments={report.segments} />
      </Card>

      {/* Nhận xét tự động */}
      <Card title="Nhận xét nhanh">
        <ul className="space-y-2 px-5 pb-4 pt-2">
          {report.insights.map((ins, i) => (
            <li key={i} className="flex gap-2 text-[15px] text-slate-700">
              {INSIGHT_ICON[ins.tone]} <span>{ins.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Xuất dữ liệu: cuối tab Theo kỳ */}
      <AnalyticsExportCard orders={orders} menu={menu} settings={settings ?? {}} />
        </>
      )}

      {tab === 'khach-mon' && (
        <>
          <p className="text-xs font-medium text-slate-400">Kỳ: {report.range.label}</p>
      <CustomerStatsCard orders={orders} range={report.range} />
          <LanguageCard orders={orders} range={report.range} />
          <PairsCard orders={orders} menu={menu} settings={settings ?? {}} onUpdateSettings={onUpdateSettings} />
          <AIAnalysis report={report} />
        </>
      )}
    </div>
  );
}
