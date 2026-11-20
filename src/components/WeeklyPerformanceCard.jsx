import { useId, useMemo, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { money } from './inventory/ui';
import useInventory from '../hooks/useInventory';
import useNow from '../hooks/useNow';
import { profitReport } from '../lib/inventory';
import { periodRange, shiftPeriod } from '../lib/report';

// Thẻ "Báo cáo Hiệu suất Tuần" trong tab Báo cáo (theo ảnh mẫu của chủ quán): một thẻ lớn
// bo góc, bóng mềm, ba tầng biểu đồ theo tuần dùng chung trục tuần —
//   Tầng 1 "Tiền Lãi": cột nhóm 3 cột mỗi tuần — lãi gộp Đơn web (gradient chàm), lãi gộp Đơn tại quán
//   (gradient xanh ngọc đậm, phân biệt rõ với chàm) và Tổng doanh thu tuần (gradient cam, cùng họ
//   màu với vùng doanh thu ở tầng 3). Cả ba dùng chung một thang tiền; đỉnh thang mở rộng tới
//   doanh thu tuần cao nhất vì doanh thu thường lớn hơn lãi.
//   Tầng 2 "Số lượng Order": hai đường cong mượt — Tổng Order (hồng magenta) và Order Cao Giá (tím violet).
//   Tầng 3 "Tổng Tiền": vùng doanh thu phủ gradient cam ấm.
// Mọi số liệu lấy từ profitReport (lib/inventory) chạy trên các mốc tuần periodRange('week', …)
// (Thứ Hai 00:00 → Thứ Hai tuần sau) — cùng nguồn và cùng quy ước với biểu đồ "Lợi nhuận theo tuần"
// ở Màn hình chính, không tự tính lại theo cách khác.
// Lãi theo kênh là LÃI GỘP (doanh thu kênh − giá vốn kênh): giá vốn tính được cho từng đơn nên
// tách được thật; chi phí khác là chi phí chung của cả tuần, không gán cho kênh nào — lãi ròng
// của tuần (= lãi gộp − chi phí chung) hiện trong tooltip của tầng 1.
const WEEK_OPTIONS = [4, 8, 12];
const GRAD = {
  web: 'linear-gradient(180deg, var(--chart-chan-web-1), var(--chart-chan-web-2))',
  shop: 'linear-gradient(180deg, var(--chart-chan-shop-1), var(--chart-chan-shop-2))',
  barRev: 'linear-gradient(180deg, var(--perf-bar-revenue-1), var(--perf-bar-revenue-2))',
  rev: 'linear-gradient(180deg, var(--chart-rev-1), var(--chart-rev-2))',
};
const ORD_ALL = 'var(--chart-ord-all)';
const ORD_HIGH = 'var(--chart-ord-high)';
const REV_LINE = 'var(--chart-rev-2)';

const ddmm = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const dm = (d) => `${d.getDate()}/${d.getMonth() + 1}`; // nhãn ngắn dưới cột, giống WeeklyProfitChart
// Làm tròn lên 1 chữ số có nghĩa (500, 2000…) cho đỉnh thang đo, giống biểu đồ doanh thu của tab Báo cáo
const niceCeil = (x) => (x <= 0 ? 0 : Math.ceil(x / 10 ** Math.floor(Math.log10(x))) * 10 ** Math.floor(Math.log10(x)));
const tickMoney = (v) => (Math.abs(v) >= 1000 ? `$${Math.round(v / 100) / 10}k` : `$${Math.round(v)}`);

// Bo cong Catmull-Rom → Bézier bậc 3 (cùng kỹ thuật với biểu đồ Lợi nhuận theo tuần ở Màn hình
// chính): đường đi qua đúng từng điểm tuần nhưng không gãy góc. Điểm điều khiển được kẹp trong
// [minY, maxY] nên khi số liệu nhảy mạnh giữa hai tuần kề nhau, cong không vọt khỏi vùng vẽ
// (chống overshoot). points: [{x, y}] trong hệ toạ độ của viewBox SVG.
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

// Nhãn ngày đầu tuần dưới mỗi tầng: tuần hiện tại ghi "Nay"; khoảng càng nhiều tuần càng thưa nhãn.
function WeekLabels({ weeks, axis }) {
  const n = weeks.length;
  const step = n <= 4 ? 1 : n <= 8 ? 2 : 3;
  return (
    <div className="mt-1.5 flex gap-2" aria-hidden="true">
      {axis === 'left' && <div className="w-11 shrink-0" />}
      <div className="flex min-w-0 flex-1 gap-1">
        {weeks.map((w, i) => (
          <span key={w.start.getTime()} className="flex-1 whitespace-nowrap text-center text-[11px] text-slate-500">
            {i === n - 1 || (n - 1 - i) % step === 0 ? (w.current ? 'Nay' : dm(w.start)) : ''}
          </span>
        ))}
      </div>
      {axis === 'right' && <div className="w-9 shrink-0" />}
    </div>
  );
}

function TierTitle({ title, right }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <h3 className="font-bold text-slate-900">{title}</h3>
      {right}
    </div>
  );
}

export default function WeeklyPerformanceCard({ orders, menu }) {
  const inventory = useInventory();
  const ingredients = inventory.ingredients.list;
  const purchases = inventory.purchases.list;
  const expenses = inventory.expenses.list;
  const recipes = inventory.recipes.list;
  const batches = inventory.batches.list;
  const now = useNow(60000);
  const [weekCount, setWeekCount] = useState(8);
  const [picked, setPicked] = useState(null); // tuần đang chọn ở tầng 1; null = tuần mới nhất
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');

  const weeks = useMemo(() => {
    const out = [];
    for (let i = weekCount - 1; i >= 0; i -= 1) {
      const range = periodRange('week', shiftPeriod('week', now, -i));
      const r = profitReport({ range, orders, menu: menu ?? [], recipes, ingredients, purchases, expenses, batches });
      const web = r.channels.find((c) => c.key === 'web');
      const shop = r.channels.find((c) => c.key === 'shop');
      out.push({
        start: range.start,
        end: range.end,
        current: i === 0,
        profit: r.profit, // lãi ròng của tuần (đã trừ chi phí chung)
        gross: web.profit + shop.profit, // lãi gộp = tổng hai kênh
        otherCosts: r.otherCosts,
        revenue: r.revenue,
        orders: r.orders,
        highValueOrders: r.highValueOrders,
        web,
        shop,
        noRecipe: r.noRecipe,
      });
    }
    return out;
    // `now` đổi mỗi phút; chỉ tính lại khi sang tuần mới, đổi số tuần hoặc dữ liệu đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, menu, recipes, ingredients, purchases, expenses, batches, weekCount, periodRange('week', now).start.getTime()]);

  const n = weeks.length;
  const active = picked == null ? n - 1 : Math.min(picked, n - 1);
  const activeWeek = weeks[active];
  const prevWeek = active > 0 ? weeks[active - 1] : null;
  const firstDay = weeks[0]?.start;
  const lastDay = weeks[n - 1] ? new Date(weeks[n - 1].end.getTime() - 86400000) : null;
  const updatedAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const totalOrders = weeks.reduce((s, w) => s + w.orders, 0);
  const missingRecipes = [...new Set(weeks.flatMap((w) => w.noRecipe))];

  // ---- Tầng 1: thang tiền chung cho cột lãi gộp theo kênh (có thể âm) và cột doanh thu ----
  // Doanh thu tuần thường lớn hơn lãi nên đỉnh thang mở rộng tới doanh thu tuần cao nhất
  // (cùng cách biểu đồ Màn hình chính đã làm); giá trị số liệu không đổi, chỉ đỉnh thang đổi.
  const chanValues = weeks.flatMap((w) => [w.web.profit, w.shop.profit]);
  const barTop = niceCeil(Math.max(0, ...chanValues, ...weeks.map((w) => w.revenue))) || 1;
  const barBottom = -niceCeil(Math.abs(Math.min(0, ...chanValues)));
  const barSpan = barTop - barBottom || 1;
  const PAD1 = 52; // chừa chỗ cho tooltip nổi ở phía trên vùng vẽ
  const PLOT1 = 128;
  const H1 = PAD1 + PLOT1;
  const y1 = (v) => PAD1 + ((barTop - v) / barSpan) * PLOT1;
  const zeroY1 = y1(0);
  const ticks1 = barBottom < 0 ? [barTop, 0, barBottom] : [barTop, barTop / 2, 0];

  // ---- Tầng 2: thang số đơn (trục phải) ----
  const W = 1200;
  const H2 = 132;
  const maxOrders = Math.max(0, ...weeks.map((w) => w.orders));
  const y2 = (v) => H2 - 4 - (v / (maxOrders || 1)) * (H2 - 16);
  const ptsAll = weeks.map((w, i) => ({ x: ((i + 0.5) / n) * W, y: y2(w.orders) }));
  const ptsHigh = weeks.map((w, i) => ({ x: ((i + 0.5) / n) * W, y: y2(w.highValueOrders) }));
  const clamp2 = (v) => Math.min(y2(0), Math.max(y2(maxOrders), v));
  const pathAll = smoothPath(ptsAll, y2(maxOrders), y2(0));
  const pathHigh = smoothPath(ptsHigh, y2(maxOrders), y2(0));
  const areaAll = pathAll ? `${pathAll} L ${ptsAll[n - 1].x.toFixed(1)} ${H2} L ${ptsAll[0].x.toFixed(1)} ${H2} Z` : '';
  const ticks2 = [maxOrders, Math.round(maxOrders / 2), 0];

  // ---- Tầng 3: thang doanh thu ----
  const H3 = 132;
  const revTop = niceCeil(Math.max(0, ...weeks.map((w) => w.revenue))) || 1;
  const y3 = (v) => H3 - 2 - (Math.max(0, v) / revTop) * (H3 - 14);
  const ptsRev = weeks.map((w, i) => ({ x: ((i + 0.5) / n) * W, y: y3(w.revenue) }));
  const pathRev = smoothPath(ptsRev, y3(revTop), y3(0));
  const areaRev = pathRev ? `${pathRev} L ${ptsRev[n - 1].x.toFixed(1)} ${H3} L ${ptsRev[0].x.toFixed(1)} ${H3} Z` : '';
  const ticks3 = [revTop, revTop / 2, 0];

  // % thay đổi lãi gộp của tuần đang chọn so với tuần trước (trong khoảng đang xem)
  let changeNote = null;
  if (prevWeek) {
    if (prevWeek.gross > 0) {
      const g = (activeWeek.gross - prevWeek.gross) / prevWeek.gross;
      changeNote = (
        <span className={g >= 0 ? 'text-emerald-300' : 'text-red-300'}>
          {g >= 0 ? '▲ tăng' : '▼ giảm'} {Math.abs(Math.round(g * 100))}% so tuần trước
        </span>
      );
    } else if (activeWeek.gross !== prevWeek.gross) {
      changeNote = (
        <span className="text-slate-300">
          {activeWeek.gross - prevWeek.gross >= 0 ? '+' : ''}
          {money(activeWeek.gross - prevWeek.gross)} so tuần trước
        </span>
      );
    }
  }

  // Một cột trong nhóm 3 cột của tầng 1 (lãi Đơn web · lãi Đơn tại quán · doanh thu tuần).
  // left là % bề ngang của ô tuần: 3 cột rộng 28%, cách đều nhau (4% / 36% / 68%).
  // Cột âm (tuần lỗ theo kênh) vẽ xuống dưới đường 0 như trước.
  const bar = (v, grad, left) => {
    const pos =
      v >= 0
        ? { top: Math.min(y1(v), zeroY1 - 3), height: Math.max(3, zeroY1 - y1(v)) }
        : { top: zeroY1, height: Math.max(3, y1(v) - zeroY1) };
    return (
      <div
        className={`absolute w-[28%] transition-opacity duration-300 ${v >= 0 ? 'rounded-t-[7px]' : 'rounded-b-[7px]'}`}
        style={{
          ...pos,
          left,
          background: grad,
          boxShadow: '0 6px 14px -8px rgba(15, 23, 42, 0.45)',
          opacity: 1,
        }}
      />
    );
  };

  return (
    <section className="overflow-hidden rounded-[28px] bg-card shadow-[0_24px_60px_-24px_rgba(15,23,42,0.30),0_8px_24px_-12px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/5">
      {/* Đầu thẻ: tiêu đề, giờ cập nhật, chọn khoảng tuần */}
      <div className="px-5 pt-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Báo cáo Hiệu suất Tuần</h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
              <RefreshCw size={11} aria-hidden="true" /> Cập nhật lúc {updatedAt}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <label className="relative inline-flex items-center">
              <span className="sr-only">Số tuần hiển thị</span>
              <select
                value={weekCount}
                onChange={(e) => {
                  setWeekCount(Number(e.target.value));
                  setPicked(null);
                }}
                className="appearance-none rounded-full bg-slate-100 py-1.5 pl-3.5 pr-9 text-sm font-semibold text-slate-700 shadow-inner outline-none transition-colors hover:bg-slate-200/70 focus:ring-2 focus:ring-blue-500/40"
              >
                {WEEK_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c} tuần
                  </option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3 text-slate-500" />
            </label>
            {firstDay && lastDay && (
              <span className="text-xs text-slate-400">
                {ddmm(firstDay)} – {ddmm(lastDay)}/{lastDay.getFullYear()}
              </span>
            )}
          </div>
        </div>

        {/* Chú thích chung cho cả ba tầng */}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3.5 text-xs text-slate-500">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className="font-semibold text-slate-700">Tiền Lãi</b>
            <i className="h-2.5 w-2.5 rounded-[4px]" style={{ background: GRAD.web }} /> Đơn web
            <i className="ml-1.5 h-2.5 w-2.5 rounded-[4px]" style={{ background: GRAD.shop }} /> Đơn tại quán
            <i className="ml-1.5 h-2.5 w-2.5 rounded-[4px]" style={{ background: GRAD.barRev }} /> Tổng doanh thu
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className="font-semibold text-slate-700">Số lượng Order</b>
            <i className="h-[3px] w-5 rounded-full" style={{ background: ORD_ALL }} /> Tổng Order
            <i className="ml-1.5 h-[3px] w-5 rounded-full" style={{ background: ORD_HIGH }} /> Order Cao Giá
          </span>
          <span className="flex items-center gap-2">
            <b className="font-semibold text-slate-700">Tổng Tiền</b>
            <i className="h-2.5 w-2.5 rounded-[4px]" style={{ background: GRAD.rev }} /> Doanh thu
          </span>
        </div>
      </div>

      {!inventory.ready ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400 sm:px-6">Đang tải số liệu chi phí…</p>
      ) : inventory.missingTables ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500 sm:px-6">
          Chưa cài mục Inventory trên máy chủ nên chưa tính được tiền lãi cho thẻ này.
        </p>
      ) : totalOrders === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400 sm:px-6">Chưa có đơn nào trong {weekCount} tuần gần nhất.</p>
      ) : (
        <>
          {/* ===== Tầng 1: Tiền Lãi — cột nhóm theo kênh + cột doanh thu tuần ===== */}
          <div className="px-5 pt-5 sm:px-6">
            <TierTitle
              title="Tiền Lãi"
              right={<span className="text-xs text-slate-400">Lãi gộp theo kênh + doanh thu tuần · trục trái: AUD</span>}
            />
            <div className="relative mt-1">
              {/* Tooltip nổi của tuần đang chọn (chạm / rê chuột vào nhóm cột để đổi tuần) */}
              {activeWeek && (
                <div
                  className="pointer-events-none absolute top-0 z-10 max-w-[94%] -translate-x-1/2 rounded-2xl bg-slate-900 px-3.5 py-2 text-center shadow-[0_16px_32px_-12px_rgba(15,23,42,0.5)]"
                  style={{ left: `${Math.min(84, Math.max(16, ((active + 0.5) / n) * 100))}%` }}
                >
                  <p className="text-[13px] font-semibold leading-snug text-white">
                    Tuần {ddmm(activeWeek.start)}
                    {activeWeek.current ? ' (đang diễn ra)' : ''}: Lãi gộp {money(activeWeek.gross)}
                    {changeNote ? <> · {changeNote}</> : null}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-300">
                    Đơn web {money(activeWeek.web.profit)} · Tại quán {money(activeWeek.shop.profit)} · Doanh thu{' '}
                    {money(activeWeek.revenue)} · Lãi ròng {money(activeWeek.profit)}
                    {activeWeek.otherCosts > 0 ? ` (chi phí chung ${money(activeWeek.otherCosts)})` : ''}
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <div className="relative w-11 shrink-0" style={{ height: H1 }} aria-hidden="true">
                  {ticks1.map((t) => (
                    <span
                      key={t}
                      className="absolute right-0 -translate-y-1/2 text-right text-[11px] text-slate-400"
                      style={{ top: y1(t) }}
                    >
                      {tickMoney(t)}
                    </span>
                  ))}
                </div>
                <div
                  role="img"
                  aria-label={`Lãi gộp theo kênh và doanh thu ${n} tuần: ${weeks
                    .map(
                      (w) =>
                        `tuần ${ddmm(w.start)} đơn web ${money(w.web.profit)}, đơn tại quán ${money(w.shop.profit)}, doanh thu ${money(w.revenue)}`,
                    )
                    .join('; ')}`}
                  className="relative min-w-0 flex-1"
                  style={{ height: H1 }}
                >
                  {ticks1.map((t) => (
                    <div
                      key={t}
                      className={`absolute inset-x-0 ${t === 0 ? 'border-t border-slate-300' : 'border-t border-slate-100'}`}
                      style={{ top: y1(t) }}
                    />
                  ))}
                  <div className="absolute inset-0 flex gap-1">
                    {weeks.map((w, i) => (
                      <div
                        key={w.start.getTime()}
                        role="button"
                        tabIndex={0}
                        aria-label={`Tuần ${ddmm(w.start)}: lãi gộp ${money(w.gross)}`}
                        title={`Tuần ${ddmm(w.start)}: lãi gộp ${money(w.gross)} · doanh thu ${money(w.revenue)} · lãi ròng ${money(w.profit)}`}
                        onMouseEnter={() => setPicked(i)}
                        onClick={() => setPicked(i)}
                        onFocus={() => setPicked(i)}
                        className="relative h-full flex-1 cursor-pointer outline-none"
                      >
                        <div
                          className="absolute inset-0 transition-opacity duration-300"
                          style={{ opacity: active === i ? 1 : 0.38 }}
                        >
                          {bar(w.web.profit, GRAD.web, '4%')}
                          {bar(w.shop.profit, GRAD.shop, '36%')}
                          {bar(w.revenue, GRAD.barRev, '68%')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <WeekLabels weeks={weeks} axis="left" />
            </div>
          </div>

          <div className="mx-5 mt-5 border-t border-slate-100 sm:mx-6" />

          {/* ===== Tầng 2: Số lượng Order — hai đường cong ===== */}
          <div className="px-5 pt-4 sm:px-6">
            <TierTitle
              title="Số lượng Order"
              right={<span className="text-xs text-slate-400">trục phải: Số lượng Đơn</span>}
            />
            <div className="mt-2 flex gap-2">
              <div
                role="img"
                aria-label={`Số đơn ${n} tuần: ${weeks
                  .map((w) => `tuần ${ddmm(w.start)} ${w.orders} đơn, trong đó ${w.highValueOrders} đơn cao giá`)
                  .join('; ')}`}
                className="relative min-w-0 flex-1"
                style={{ height: H2 }}
              >
                {[0, 50, 100].map((p) => (
                  <div key={p} className="absolute inset-x-0 border-t border-slate-100" style={{ top: `${p}%` }} />
                ))}
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox={`0 0 ${W} ${H2}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {areaAll && <path d={areaAll} fill={ORD_ALL} opacity={0.07} stroke="none" />}
                  <path d={pathHigh} fill="none" stroke={ORD_HIGH} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  <path d={pathAll} fill="none" stroke={ORD_ALL} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
                {weeks.map((w, i) => (
                  <span
                    key={`all-${w.start.getTime()}`}
                    title={`Tổng ${w.orders} đơn · tuần ${ddmm(w.start)}`}
                    className="pointer-events-none absolute h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${(((i + 0.5) / n) * 100).toFixed(2)}%`, top: y2(w.orders), background: ORD_ALL, border: '2px solid rgba(255, 255, 255, 0.9)' }}
                  />
                ))}
                {weeks.map((w, i) => (
                  <span
                    key={`high-${w.start.getTime()}`}
                    title={`${w.highValueOrders} đơn cao giá · tuần ${ddmm(w.start)}`}
                    className="pointer-events-none absolute h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${(((i + 0.5) / n) * 100).toFixed(2)}%`, top: y2(w.highValueOrders), background: ORD_HIGH, border: '2px solid rgba(255, 255, 255, 0.9)' }}
                  />
                ))}
              </div>
              <div className="relative w-9 shrink-0" style={{ height: H2 }} aria-hidden="true">
                {ticks2.map((t) => (
                  <span key={t} className="absolute left-0 -translate-y-1/2 text-[11px] text-slate-400" style={{ top: y2(t) }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <WeekLabels weeks={weeks} axis="right" />
          </div>

          <div className="mx-5 mt-5 border-t border-slate-100 sm:mx-6" />

          {/* ===== Tầng 3: Tổng Tiền — vùng doanh thu ===== */}
          <div className="px-5 pt-4 sm:px-6">
            <TierTitle
              title="Tổng Tiền"
              right={<span className="text-xs text-slate-400">Tổng Doanh Thu · trục trái: AUD</span>}
            />
            <div className="mt-2 flex gap-2">
              <div className="relative w-11 shrink-0" style={{ height: H3 }} aria-hidden="true">
                {ticks3.map((t) => (
                  <span key={t} className="absolute right-0 -translate-y-1/2 text-right text-[11px] text-slate-400" style={{ top: y3(t) }}>
                    {tickMoney(t)}
                  </span>
                ))}
              </div>
              <div
                role="img"
                aria-label={`Doanh thu ${n} tuần: ${weeks.map((w) => `tuần ${ddmm(w.start)} ${money(w.revenue)}`).join('; ')}`}
                className="relative min-w-0 flex-1"
                style={{ height: H3 }}
              >
                {[0, 50, 100].map((p) => (
                  <div key={p} className="absolute inset-x-0 border-t border-slate-100" style={{ top: `${p}%` }} />
                ))}
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox={`0 0 ${W} ${H3}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id={`revfill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" style={{ stopColor: 'var(--chart-rev-1)', stopOpacity: 0.55 }} />
                      <stop offset="100%" style={{ stopColor: 'var(--chart-rev-2)', stopOpacity: 0.04 }} />
                    </linearGradient>
                  </defs>
                  {areaRev && <path d={areaRev} fill={`url(#revfill-${gradientId})`} stroke="none" />}
                  <path d={pathRev} fill="none" stroke={REV_LINE} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
                {weeks.map((w, i) => (
                  <span
                    key={`rev-${w.start.getTime()}`}
                    title={`Doanh thu ${money(w.revenue)} · tuần ${ddmm(w.start)}`}
                    className="pointer-events-none absolute h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${(((i + 0.5) / n) * 100).toFixed(2)}%`, top: y3(w.revenue), background: REV_LINE, border: '2px solid rgba(255, 255, 255, 0.9)' }}
                  />
                ))}
              </div>
            </div>
            <WeekLabels weeks={weeks} axis="left" />
          </div>

          {/* Chú thích cách đọc số */}
          <div className="space-y-1.5 px-5 pb-5 pt-4 sm:px-6">
            <p className="text-xs leading-relaxed text-slate-400">
              Lãi theo kênh là lãi gộp (doanh thu − giá vốn món của kênh đó); chi phí chung của tuần không chia theo kênh —
              lãi ròng của tuần = lãi gộp − chi phí chung, hiện trong tooltip ở tầng Tiền Lãi. Cột cam ở tầng Tiền Lãi là
              tổng doanh thu của tuần — cùng con số vẽ ở tầng Tổng Tiền bên dưới. Đơn cao giá: đơn có tổng tiền
              từ $50 trở lên. Đơn web: khách đặt qua website; Đơn tại quán: nhân viên nhập trong app.
            </p>
            {missingRecipes.length > 0 && (
              <p className="text-xs text-amber-500">
                Chưa có công thức cho {missingRecipes.length} món ({missingRecipes.slice(0, 3).join(', ')}
                {missingRecipes.length > 3 ? '…' : ''}): giá vốn món đó tính là 0, tiền lãi có thể cao hơn thực tế.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
