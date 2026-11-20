import { useId } from 'react';
import { Check, Mail, MessageSquare, Phone, RefreshCw, Trash2 } from 'lucide-react';
import useCustomerActivity from '../hooks/useCustomerActivity';
import { smsLink } from '../lib/customerMessage';
import CountUp, { formatCount } from '../components/CountUp';
import { formatMoney } from '../lib/stats';

const pct = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

function ago(iso, now = Date.now()) {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} phút trước`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}

function LiveCard({ label, value, hint, tone = '' }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-card p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-4xl font-extrabold tabular-nums ${tone || 'text-slate-900'}`}>
        <CountUp value={value ?? 0} format={formatCount} />
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function followUpMessage(a, shopName) {
  const shop = shopName?.trim() || 'Bánh Cuốn & Giò Chả';
  const name = a.name?.trim() || '';
  return a.lang === 'en'
    ? `${shop}: Hi ${name}, we saw you were putting an order together on our website. Can we help you finish it?`
    : `${shop}: Chào ${name}, quán thấy bạn đã chọn món trên website nhưng chưa đặt xong. Quán có thể giúp bạn hoàn tất đơn không ạ?`;
}

const fmtDuration = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const dmFromIso = (iso) => {
  const [, m, d] = String(iso ?? '').split('-').map(Number);
  return d && m ? `${d}/${m}` : '';
};

// Bo cong Catmull-Rom → Bézier bậc 3 (cùng kỹ thuật với thẻ Báo cáo Hiệu suất Tuần):
// đường đi qua đúng từng điểm nhưng không gãy góc; điểm điều khiển kẹp trong [minY, maxY]
// nên không vọt khỏi vùng vẽ khi số liệu nhảy mạnh giữa hai tuần kề nhau.
function smoothPath(points, minY, maxY) {
  if (points.length < 2) return '';
  const clamp = (v) => Math.min(maxY, Math.max(minY, v));
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = `${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${clamp(p1.y + (p2.y - p0.y) / 6).toFixed(1)}`;
    const c2 = `${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${clamp(p2.y - (p3.y - p1.y) / 6).toFixed(1)}`;
    d += ` C ${c1}, ${c2}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const SOURCE_LABELS = {
  google: 'Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  zalo: 'Zalo',
  direct: 'Trực tiếp (Direct)',
  other: 'Khác',
  unknown: 'Chưa rõ (phiên cũ)',
};
const DEVICE_LABELS = { mobile: 'Điện thoại', desktop: 'Máy tính', tablet: 'Máy tính bảng', unknown: 'Chưa rõ' };
const DEVICE_COLORS = { mobile: '#0d9488', desktop: '#6366f1', tablet: '#f59e0b', unknown: '#cbd5e1' };
const FUNNEL_COLORS = ['#0f766e', '#14b8a6', '#38bdf8', '#f59e0b'];
const TREND_VISITS = '#059669';
const TREND_ENGAGED = '#6366f1';

// Thẻ phân tích "Hoạt Động Khách Hàng Website": số liệu 30 ngày + xu hướng 8 tuần do
// máy chủ tính sẵn trong khoá `insights` của customer_activity (sql/customer_activity.sql).
// KPI và phễu dùng lại periods.days30 / periods.today có sẵn — không tính trùng.
// Máy chủ chưa chạy bản SQL mới (chưa có `insights`) thì thẻ tự ẩn, trang không vỡ.
function WebsiteInsightsCard({ insights, periods, updatedAt }) {
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const d30 = periods?.days30 ?? {};
  const d7 = periods?.days7 ?? {};
  const today = periods?.today ?? {};
  const returning = insights.returning ?? {};
  const buckets = insights.duration_buckets ?? {};
  const weekly = Array.isArray(insights.weekly) ? insights.weekly : [];
  const sources = Object.entries(insights.sources ?? {}).sort((a, b) => b[1] - a[1]);
  const sourceTotal = sources.reduce((s, [, c]) => s + c, 0);
  const devices = ['mobile', 'desktop', 'tablet', 'unknown']
    .map((k) => [k, Number(insights.devices?.[k] ?? 0)])
    .filter(([, c]) => c > 0);
  const deviceTotal = devices.reduce((s, [, c]) => s + c, 0);
  const topPages = Array.isArray(insights.top_pages) ? insights.top_pages : [];
  const timezones = Array.isArray(insights.timezones) ? insights.timezones : [];

  // ---- Xu hướng 8 tuần: hai đường cong trên cùng một thang ----
  const W = 1200;
  const H = 132;
  const n = weekly.length;
  const maxTrend = Math.max(0, ...weekly.map((w) => Math.max(w.visits ?? 0, w.engaged ?? 0)));
  const yT = (v) => H - 4 - (v / (maxTrend || 1)) * (H - 16);
  const ptsVisits = weekly.map((w, i) => ({ x: ((i + 0.5) / Math.max(1, n)) * W, y: yT(w.visits ?? 0) }));
  const ptsEngaged = weekly.map((w, i) => ({ x: ((i + 0.5) / Math.max(1, n)) * W, y: yT(w.engaged ?? 0) }));
  const pathVisits = smoothPath(ptsVisits, yT(maxTrend), yT(0));
  const pathEngaged = smoothPath(ptsEngaged, yT(maxTrend), yT(0));
  const areaVisits =
    pathVisits && n > 1 ? `${pathVisits} L ${ptsVisits[n - 1].x.toFixed(1)} ${H} L ${ptsVisits[0].x.toFixed(1)} ${H} Z` : '';
  const ticksT = [maxTrend, Math.round(maxTrend / 2), 0];

  // ---- Phễu 4 bước thật từ periods.days30 ----
  const funnel = [
    ['Vào website', d30.visits ?? 0],
    ['Có món trong giỏ', d30.with_cart ?? 0],
    ['Vào trang đặt', d30.checkout ?? 0],
    ['Đã đặt xong', d30.ordered ?? 0],
  ];

  // ---- Donut thiết bị ----
  const CIRC = 2 * Math.PI * 52;
  let acc = 0;
  const donutSegs = devices.map(([k, c]) => {
    const frac = deviceTotal > 0 ? c / deviceTotal : 0;
    const seg = { key: k, len: frac * CIRC, offset: acc };
    acc += frac * CIRC;
    return seg;
  });

  const kpis = [
    {
      label: 'Tổng khách truy cập',
      value: formatCount(d30.visits ?? 0),
      hint: 'lượt vào website · 30 ngày',
    },
    {
      label: 'Khách quay lại',
      value: returning.pct != null ? `${returning.pct}%` : '—',
      hint:
        (returning.with_vid ?? 0) > 0
          ? `${formatCount(returning.returning ?? 0)} / ${formatCount(returning.with_vid ?? 0)} phiên nhận diện được khách`
          : 'chưa có dữ liệu khách quay lại',
    },
    {
      label: 'Tỉ lệ thêm giỏ hàng',
      value: pct(d30.with_cart, d30.visits),
      hint: `${formatCount(d30.with_cart ?? 0)} phiên đã chọn món`,
    },
    {
      label: 'Thời gian xem TB',
      value: fmtDuration(insights.avg_duration_sec),
      hint: 'trung bình mỗi lượt vào · 30 ngày',
    },
  ];

  return (
    <section
      aria-label="Hoạt động khách hàng website"
      className="overflow-hidden rounded-[28px] bg-card shadow-[0_24px_60px_-24px_rgba(15,23,42,0.30),0_8px_24px_-12px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/5"
    >
      <div className="px-5 pt-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Hoạt Động Khách Hàng Website</h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
              <RefreshCw size={11} aria-hidden="true" /> Cập nhật lúc{' '}
              {updatedAt ? updatedAt.toLocaleTimeString('vi-VN') : '—'}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-inner">
            30 ngày gần nhất
          </span>
        </div>

        {/* Số hôm nay + 7 ngày (gọn, lấy từ periods sẵn có) */}
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
          <span>
            Hôm nay: <b className="tabular-nums text-slate-900">{today.visits ?? 0}</b> lượt vào · tỉ lệ đặt{' '}
            <b className="tabular-nums text-slate-900">{pct(today.ordered, today.visits)}</b> · bỏ giỏ{' '}
            <b className="tabular-nums text-slate-900">{pct(today.abandoned, today.with_cart)}</b>
          </span>
          <span>
            7 ngày: tỉ lệ đặt <b className="tabular-nums text-slate-900">{pct(d7.ordered, d7.visits)}</b>
          </span>
          <span>
            Đơn web hôm nay trong danh sách đơn: <b className="tabular-nums text-slate-900">{today.web_orders ?? 0}</b>
          </span>
        </p>

        {/* Hàng KPI */}
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-100 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="bg-card px-4 py-3.5">
              <p className="text-xs font-semibold text-slate-500">{k.label}</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{k.value}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-slate-400">{k.hint}</p>
            </div>
          ))}
        </div>

        {/* Phân bố thời lượng phiên */}
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>
            Ở dưới 1 phút: <b className="tabular-nums text-slate-700">{buckets.lt60 ?? 0}</b>
          </span>
          <span>
            1–5 phút: <b className="tabular-nums text-slate-700">{buckets.s60_300 ?? 0}</b>
          </span>
          <span>
            5–15 phút: <b className="tabular-nums text-slate-700">{buckets.s300_900 ?? 0}</b>
          </span>
          <span>
            Trên 15 phút: <b className="tabular-nums text-slate-700">{buckets.gte900 ?? 0}</b>
          </span>
        </p>
      </div>

      <div className="mx-5 mt-5 border-t border-slate-100 sm:mx-6" />

      {/* ===== Xu hướng hoạt động: 8 tuần ===== */}
      <div className="px-5 pt-4 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="font-bold text-slate-900">Xu Hướng Hoạt Động</h3>
          <p className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <i className="h-[3px] w-5 rounded-full" style={{ background: TREND_VISITS }} /> Tổng khách truy cập
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-[3px] w-5 rounded-full" style={{ background: TREND_ENGAGED }} /> Khách tương tác sâu
            </span>
          </p>
        </div>
        {n === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Chưa có dữ liệu theo tuần.</p>
        ) : (
          <>
            <div className="mt-2 flex gap-2">
              <div
                role="img"
                aria-label={`Khách truy cập 8 tuần: ${weekly
                  .map((w) => `tuần ${dmFromIso(w.start)} ${w.visits ?? 0} lượt, ${w.engaged ?? 0} tương tác sâu`)
                  .join('; ')}`}
                className="relative min-w-0 flex-1"
                style={{ height: H }}
              >
                {[0, 50, 100].map((p) => (
                  <div key={p} className="absolute inset-x-0 border-t border-slate-100" style={{ top: `${p}%` }} />
                ))}
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox={`0 0 ${W} ${H}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id={`webtrend-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" style={{ stopColor: TREND_VISITS, stopOpacity: 0.28 }} />
                      <stop offset="100%" style={{ stopColor: TREND_VISITS, stopOpacity: 0.03 }} />
                    </linearGradient>
                  </defs>
                  {areaVisits && <path d={areaVisits} fill={`url(#webtrend-${gradientId})`} stroke="none" />}
                  <path d={pathEngaged} fill="none" stroke={TREND_ENGAGED} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  <path d={pathVisits} fill="none" stroke={TREND_VISITS} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
                {weekly.map((w, i) => (
                  <span
                    key={`v-${w.start}`}
                    title={`Tuần ${dmFromIso(w.start)}: ${w.visits ?? 0} lượt vào`}
                    className="pointer-events-none absolute h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${(((i + 0.5) / n) * 100).toFixed(2)}%`, top: yT(w.visits ?? 0), background: TREND_VISITS, border: '2px solid rgba(255, 255, 255, 0.9)' }}
                  />
                ))}
                {weekly.map((w, i) => (
                  <span
                    key={`e-${w.start}`}
                    title={`Tuần ${dmFromIso(w.start)}: ${w.engaged ?? 0} khách tương tác sâu`}
                    className="pointer-events-none absolute h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${(((i + 0.5) / n) * 100).toFixed(2)}%`, top: yT(w.engaged ?? 0), background: TREND_ENGAGED, border: '2px solid rgba(255, 255, 255, 0.9)' }}
                  />
                ))}
              </div>
              <div className="relative w-9 shrink-0" style={{ height: H }} aria-hidden="true">
                {ticksT.map((t) => (
                  <span key={t} className="absolute left-0 -translate-y-1/2 text-[11px] text-slate-400" style={{ top: yT(t) }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-1.5 flex gap-2" aria-hidden="true">
              <div className="flex min-w-0 flex-1 gap-1">
                {weekly.map((w) => (
                  <span key={w.start} className="flex-1 whitespace-nowrap text-center text-[11px] text-slate-500">
                    {dmFromIso(w.start)}
                  </span>
                ))}
              </div>
              <div className="w-9 shrink-0" />
            </div>
          </>
        )}
      </div>

      <div className="mx-5 mt-5 border-t border-slate-100 sm:mx-6" />

      {/* ===== Phễu chuyển đổi web (30 ngày) ===== */}
      <div className="px-5 pt-4 sm:px-6">
        <h3 className="font-bold text-slate-900">Phễu Chuyển Đổi Web</h3>
        {(d30.visits ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Chưa có lượt vào nào trong 30 ngày gần nhất.</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {funnel.map(([label, value], i) => (
              <div key={label} className="flex flex-col items-center">
                <div
                  className="flex h-9 min-w-[110px] items-center justify-center rounded-lg px-3 text-sm font-bold tabular-nums text-white shadow-sm transition-all duration-300"
                  style={{
                    width: `${Math.max(14, ((value / (d30.visits || 1)) * 100).toFixed(1))}%`,
                    background: `linear-gradient(180deg, ${FUNNEL_COLORS[i]}, ${FUNNEL_COLORS[i]}dd)`,
                  }}
                  role="img"
                  aria-label={`${label}: ${value} phiên, ${pct(value, d30.visits)}`}
                >
                  {formatCount(value)}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {label} ({pct(value, d30.visits)})
                </p>
              </div>
            ))}
            <p className="pt-1 text-center text-xs text-slate-500">
              Bỏ giỏ: <b className="tabular-nums">{pct(d30.abandoned, d30.with_cart)}</b> — khách đã chọn món nhưng
              im lặng quá 10 phút mà không đặt, trên số khách đã chọn món (30 ngày).
            </p>
          </div>
        )}
      </div>

      <div className="mx-5 mt-5 border-t border-slate-100 sm:mx-6" />

      {/* ===== Nguồn truy cập + thiết bị + trang xem nhiều ===== */}
      <div className="grid gap-6 px-5 pt-4 sm:px-6 lg:grid-cols-2">
        <div>
          <h3 className="font-bold text-slate-900">Nguồn Khách Hàng Đầu (Top Traffic Sources)</h3>
          {sourceTotal === 0 ? (
            <p className="py-4 text-sm text-slate-400">Chưa có dữ liệu nguồn truy cập.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {sources.map(([key, count]) => (
                <li key={key} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 truncate text-slate-600">{SOURCE_LABELS[key] ?? key}</span>
                  <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-teal-600 transition-all duration-300"
                      style={{ width: `${Math.max(2, (count / sourceTotal) * 100).toFixed(1)}%` }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right tabular-nums text-slate-500">
                    {formatCount(count)} · {Math.round((count / sourceTotal) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
          {topPages.length > 0 && (
            <>
              <h3 className="mt-6 font-bold text-slate-900">Trang Được Xem Nhiều</h3>
              <ul className="mt-2 divide-y divide-slate-100">
                {topPages.map((p) => (
                  <li key={p.path} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="min-w-0 truncate text-slate-600">{p.path}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">{formatCount(p.views ?? 0)} lượt</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Thiết Bị Truy Cập</h3>
          {deviceTotal === 0 ? (
            <p className="py-4 text-sm text-slate-400">Chưa có dữ liệu thiết bị.</p>
          ) : (
            <div className="mt-3 flex items-center gap-5">
              <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`Thiết bị: ${devices.map(([k, c]) => `${DEVICE_LABELS[k]} ${Math.round((c / deviceTotal) * 100)}%`).join(', ')}`}>
                <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="14" />
                {donutSegs.map((s) => (
                  <circle
                    key={s.key}
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={DEVICE_COLORS[s.key]}
                    strokeWidth="14"
                    strokeDasharray={`${Math.max(0, s.len - 2).toFixed(1)} ${(CIRC - s.len + 2).toFixed(1)}`}
                    strokeDashoffset={(-s.offset).toFixed(1)}
                    transform="rotate(-90 60 60)"
                  />
                ))}
                <text x="60" y="57" textAnchor="middle" className="fill-slate-900 text-lg font-extrabold tabular-nums">
                  {formatCount(deviceTotal)}
                </text>
                <text x="60" y="74" textAnchor="middle" className="fill-slate-400 text-[10px]">
                  phiên
                </text>
              </svg>
              <ul className="min-w-0 flex-1 space-y-2 text-sm">
                {devices.map(([k, c]) => (
                  <li key={k} className="flex items-center gap-2">
                    <i className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: DEVICE_COLORS[k] }} />
                    <span className="min-w-0 flex-1 truncate text-slate-600">{DEVICE_LABELS[k]}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {formatCount(c)} · {Math.round((c / deviceTotal) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {timezones.length > 0 && (
            <p className="mt-5 text-sm text-slate-600">
              <b className="font-semibold text-slate-900">Múi giờ phổ biến:</b>{' '}
              {timezones.map((t) => `${t.tz} (${formatCount(t.sessions ?? 0)} phiên)`).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Cách đọc số */}
      <div className="space-y-1.5 px-5 pb-5 pt-5 sm:px-6">
        <p className="text-xs leading-relaxed text-slate-400">
          <b>Tương tác sâu</b> = phiên ở lại từ 60 giây trở lên hoặc đã chọn món trở lên. <b>Tỉ lệ đặt</b> = đã đặt /
          lượt vào; <b>bỏ giỏ</b> = khách đã chọn món nhưng im lặng quá 10 phút mà không đặt, chia cho số khách đã
          chọn món. <b>Khách quay lại</b> tính theo mã khách lưu trên trình duyệt của khách — khách xoá dữ liệu
          trình duyệt hoặc đổi máy/điện thoại thì tính là khách mới. Nguồn, thiết bị, múi giờ và trang xem nhiều
          chỉ có ở các phiên từ khi nâng cấp theo dõi; phiên cũ hơn hiện là “Chưa rõ”. Khách chặn theo dõi có thể
          không được đếm.
        </p>
      </div>
    </section>
  );
}

// Khách trên website: đang online, đang đặt, bỏ dở, tỉ lệ đặt món
export default function CustomerActivityPage({ settings }) {
  const { data, error, updatedAt, handleSession } = useCustomerActivity();
  const live = data?.live ?? {};
  const periods = data?.periods ?? {};
  const insights = data?.insights ?? null;
  const abandoned = data?.abandoned ?? [];
  const today = periods.today ?? {};
  const now = data?.now ? new Date(data.now).getTime() : Date.now();

  if (error?.missing && !data) {
    return (
      <div className="staff-stagger mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-card p-6">
        <h2 className="text-lg font-bold text-slate-900">Chưa bật theo dõi khách</h2>
        <p className="mt-2 text-slate-600">
          Máy chủ chưa có phần theo dõi. Mở file <b>sql/customer_activity.sql</b> trong repo, dán vào SQL Editor của
          project quán và bấm Run một lần, rồi tải lại trang này.
        </p>
      </div>
    );
  }

  return (
    <div className="staff-stagger mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <span className={`h-2.5 w-2.5 rounded-full ${error ? 'bg-red-500' : 'animate-pulse bg-emerald-500'}`} />
          {error
            ? `Chưa tải được: ${error.message}`
            : updatedAt
              ? `Cập nhật ${updatedAt.toLocaleTimeString('vi-VN')}, tự làm mới mỗi 10 giây`
              : 'Đang tải…'}
        </p>
      </div>

      <section aria-label="Khách đang trên website">
        <div className="staff-stagger grid grid-cols-2 gap-4 lg:grid-cols-5">
          <LiveCard label="Đang online" value={live.online} hint="đang mở website" tone="text-emerald-600" />
          <LiveCard label="Đang xem menu" value={live.browsing} hint="chưa chọn món" />
          <LiveCard label="Đã chọn món" value={live.cart} hint="có món trong giỏ" />
          <LiveCard
            label="Đang đặt món"
            value={live.checkout}
            hint="ở trang đặt, chưa bấm Place order"
            tone="text-blue-500"
          />
          <LiveCard
            label="Bỏ dở hôm nay"
            value={today.abandoned}
            hint="chọn món nhưng không đặt"
            tone={today.abandoned > 0 ? 'text-red-500' : ''}
          />
        </div>
      </section>

      {/* Thẻ phân tích 30 ngày + 8 tuần; chỉ hiện khi máy chủ đã chạy bản SQL mới
          (có khoá insights). Số hôm nay / 7 ngày và định nghĩa tỉ lệ đã đưa gọn vào thẻ. */}
      {insights && <WebsiteInsightsCard insights={insights} periods={periods} updatedAt={updatedAt} />}

      <section aria-label="Khách bỏ dở">
        <h2 className="mb-1 font-bold text-slate-900">Khách để lại thông tin nhưng chưa đặt</h2>
        <p className="mb-3 text-sm text-slate-500">
          Khách đã gõ số điện thoại hoặc email rồi bỏ đi. Gọi hoặc nhắn hỏi xem cần giúp gì. Quá 10 phút không hoạt động
          mới hiện ở đây.
        </p>
        {abandoned.length === 0 ? (
          <p className="rounded-3xl bg-card px-5 py-10 text-center text-slate-400">Chưa có khách nào bỏ dở</p>
        ) : (
          <ul className="space-y-3">
            {abandoned.map((a) => (
              <li key={a.sid} className="rounded-3xl border border-slate-200 bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{a.name || 'Khách chưa để tên'}</p>
                    <p className="text-xs text-slate-500">
                      {ago(a.last_seen, now)}
                      {a.lang === 'en' && ' · tiếng Anh'}
                    </p>
                  </div>
                  {a.cart_total > 0 && (
                    <p className="shrink-0 font-bold text-gold">{formatMoney(Number(a.cart_total))}</p>
                  )}
                </div>
                {a.items && <p className="mt-2 text-sm text-slate-700">{a.items}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {a.phone && (
                    <a
                      href={`tel:${a.phone}`}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-500 px-3 py-2 font-semibold text-white active:bg-blue-600"
                    >
                      <Phone size={15} /> {a.phone}
                    </a>
                  )}
                  {a.phone && (
                    <a
                      href={smsLink(a.phone, followUpMessage(a, settings?.shopName))}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-700 active:bg-slate-200"
                    >
                      <MessageSquare size={15} /> Nhắn
                    </a>
                  )}
                  {a.email && (
                    <a
                      href={`mailto:${a.email}`}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-700 active:bg-slate-200"
                    >
                      <Mail size={15} /> {a.email}
                    </a>
                  )}
                  <span className="ml-auto flex gap-2">
                    <button
                      onClick={() => handleSession(a.sid, 'handled')}
                      className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 active:bg-slate-50"
                    >
                      <Check size={15} /> Đã xử lý
                    </button>
                    <button
                      onClick={() => window.confirm('Xoá thông tin khách này?') && handleSession(a.sid, 'delete')}
                      aria-label="Xoá thông tin khách"
                      className="rounded-xl bg-red-50 p-2 text-red-600 active:bg-red-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
