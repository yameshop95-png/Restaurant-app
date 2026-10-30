import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { buildReport, PERIODS, reportForAI, shiftPeriod } from '../lib/report';
import { formatMoney } from '../lib/stats';

const ACCESS_CODE_KEY = 'restaurant-app.ai-code';
const SERIES = '#ff5722'; // màu chuỗi dữ liệu duy nhất của biểu đồ (cam chính của quán)

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
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={18} className="text-violet-500" /> Phân tích bằng AI
        </span>
      }
    >
      <div className="space-y-3 px-5 pb-5 pt-2">
        <p className="text-sm text-slate-500">
          Claude đọc số liệu của {report.range.label.toLowerCase()} và nhận xét món bán chạy, giá bán, thời điểm bán và
          dự báo kỳ tới. Chỉ gửi số liệu tổng hợp, không gửi tên, SĐT hay địa chỉ khách.
        </p>

        {state.needsCode && (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Nhập mã truy cập AI"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          />
        )}

        <button
          onClick={run}
          disabled={state.status === 'loading' || !report.orderCount}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3.5 font-semibold text-white active:bg-violet-700 disabled:bg-slate-300"
        >
          {state.status === 'loading' ? (
            <>
              <Loader2 size={19} className="animate-spin" /> AI đang phân tích…
            </>
          ) : (
            <>
              <Sparkles size={19} /> {state.status === 'done' ? 'Phân tích lại' : 'Phân tích'} {report.range.label.toLowerCase()}
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
                <h3 className="text-sm font-bold text-violet-700">{title}</h3>
                <p className="text-[15px] leading-relaxed text-slate-700">{state.analysis[key]}</p>
              </div>
            ))}
            <div>
              <h3 className="text-sm font-bold text-violet-700">Nên làm ngay</h3>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-slate-700">
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

export default function ReportPage({ orders, menu }) {
  const [kind, setKind] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const report = useMemo(() => buildReport(orders, kind, anchor, menu), [orders, kind, anchor, menu]);
  const atCurrent = report.range.end > new Date();
  const { forecast } = report;
  const maxQty = report.dishes[0]?.qty ?? 0;
  const projectedQty = Object.fromEntries(forecast.dishes.map((d) => [d.name, d.projectedQty]));
  const nextLabel = { week: 'tuần sau', month: 'tháng sau', year: 'năm sau' }[kind];

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
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
          <p className="text-4xl font-bold tracking-tight text-slate-900">{formatMoney(report.revenue)}</p>
          <Change now={report.revenue} before={report.prevRevenue} toDate={report.comparedToDate} />
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
            <div>
              <p className="text-xl font-bold text-slate-900">{report.orderCount}</p>
              <p className="text-xs text-slate-500">đơn</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{report.totalQty}</p>
              <p className="text-xs text-slate-500">phần</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{formatMoney(report.avgOrder)}</p>
              <p className="text-xs text-slate-500">TB / đơn</p>
            </div>
          </div>
        </div>
      </Card>

      <Card title={kind === 'year' ? 'Doanh thu theo tháng' : 'Doanh thu theo ngày'}>
        <RevenueChart buckets={report.buckets} kind={kind} />
      </Card>

      {/* Dự báo */}
      <Card title="Dự báo">
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 pt-2">
          {forecast.isCurrent && (
            <div className="rounded-2xl bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-700">Dự kiến cả kỳ này</p>
              <p className="text-xl font-bold text-blue-900">{formatMoney(forecast.projected)}</p>
              <p className="text-xs text-blue-700">
                đã qua {Math.round(forecast.elapsed * 100)}% thời gian
                {forecast.sinceFirstOrder && ' · tính từ đơn đầu tiên'}
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

      {/* Món */}
      <Card title="Tổng món đã bán" right={<span className="text-sm text-slate-500">{report.dishes.length} món</span>}>
        {report.dishes.length === 0 ? (
          <p className="px-5 py-8 text-center text-slate-400">Chưa có đơn trong kỳ này</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
            {report.dishes.map((d) => {
              const change = d.prevQty ? (d.qty - d.prevQty) / d.prevQty : null;
              return (
                <li key={d.name} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-slate-900">{d.name}</span>
                    <span className="shrink-0 font-semibold text-slate-900">{formatMoney(d.revenue)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                      <div className="h-full rounded-full" style={{ width: `${(d.qty / maxQty) * 100}%`, background: SERIES }} />
                    </div>
                    <span className="w-16 shrink-0 text-right text-sm font-semibold text-slate-700">{d.qty} phần</span>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                    <span>{Math.round(d.revenueShare * 100)}% doanh thu</span>
                    <span>giá TB {formatMoney(d.avgPrice)}</span>
                    {change != null && (
                      <span className={change >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {change >= 0 ? '▲' : '▼'} {Math.abs(Math.round(change * 100))}% (kỳ trước {d.prevQty})
                      </span>
                    )}
                    {projectedQty[d.name] != null && <span className="text-blue-600">dự kiến ~{projectedQty[d.name]} phần</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Thời điểm */}
      <Card title={kind === 'week' ? 'Theo ngày trong tuần' : kind === 'month' ? 'Thời điểm trong tháng' : 'Theo quý'}>
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          {report.segments.map((s) => (
            <li key={s.label} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-slate-900">{s.label}</span>
                <span className="shrink-0 text-sm text-slate-500">
                  {s.orders} đơn · <b className="text-slate-900">{formatMoney(s.revenue)}</b>
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">
                {s.top.length ? s.top.map((t) => `${t.name} (${t.qty})`).join(' · ') : <span className="text-slate-400">—</span>}
              </p>
            </li>
          ))}
        </ul>
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

      <AIAnalysis report={report} />
    </div>
  );
}
