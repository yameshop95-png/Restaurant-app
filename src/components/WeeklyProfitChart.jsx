import { useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { money, parseNum } from './inventory/ui';
import useInventory from '../hooks/useInventory';
import { profitReport } from '../lib/inventory';
import { periodRange, shiftPeriod } from '../lib/report';

// Lợi nhuận từng tuần (doanh thu − giá vốn − chi phí khác), tính giống tab Inventory Management.
// Màu cột: vàng = lãi vượt mục tiêu, xanh = lãi, đỏ = lỗ. Mục tiêu lưu riêng trên máy này (chỉ chủ quán thấy biểu đồ).
// Đường tím: số đơn mỗi tuần (thang đo riêng ở trục phải) — đếm cùng tập đơn với lợi nhuận:
// profitReport đếm đơn chưa huỷ tạo trong tuần, đúng những đơn làm ra doanh thu của cột lãi.
const WEEKS = 12;
const DEFAULT_TARGET = 500; // lãi trên A$500/tuần mới tô vàng, đổi được bằng nút Mục tiêu
const COLOR = { over: 'var(--chart-over)', profit: 'var(--chart-profit)', loss: 'var(--chart-loss)' };
const LINE_COLOR = 'var(--chart-orders)';
const ddmm = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const dm = (d) => `${d.getDate()}/${d.getMonth() + 1}`; // nhãn ngắn dưới cột
const whole = (n) => `$${Math.round(n).toLocaleString('en-AU')}`;

export default function WeeklyProfitChart({ orders, menu, now, target: savedTarget, onTargetChange }) {
  const inventory = useInventory();
  const ingredients = inventory.ingredients.list;
  const purchases = inventory.purchases.list;
  const expenses = inventory.expenses.list;
  const recipes = inventory.recipes.list;
  const batches = inventory.batches.list;

  const weeks = useMemo(() => {
    const out = [];
    for (let i = WEEKS - 1; i >= 0; i -= 1) {
      const range = periodRange('week', shiftPeriod('week', now, -i));
      const r = profitReport({ range, orders, menu: menu ?? [], recipes, ingredients, purchases, expenses, batches });
      out.push({ start: range.start, current: i === 0, profit: r.profit, revenue: r.revenue, orders: r.orders, noRecipe: r.noRecipe });
    }
    return out;
    // `now` đổi mỗi phút; chỉ tính lại khi sang tuần mới hoặc dữ liệu đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, menu, recipes, ingredients, purchases, expenses, batches, periodRange('week', now).start.getTime()]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const target = Number.isFinite(savedTarget) && savedTarget > 0 ? savedTarget : DEFAULT_TARGET;
  const hasTarget = true;
  const tone = (p) => (p > target ? 'over' : p >= 0 ? 'profit' : 'loss');

  // Thang đo: luôn có số 0, và mục tiêu nếu đã đặt
  const values = weeks.map((w) => w.profit);
  const top = Math.max(0, ...values, hasTarget ? target : 0) || 1;
  const bottom = Math.min(0, ...values);
  const span = top - bottom || 1;
  const H = 160;
  const y = (v) => ((top - v) / span) * H;
  const zeroY = y(0);
  // Thang đo riêng (trục phải) cho đường số đơn: 0 ở đáy biểu đồ, tuần đông đơn nhất gần đỉnh
  // (chừa 12px trên / 4px dưới để chấm và nét không bị cắt). x của điểm = tâm cột của tuần đó.
  const maxOrders = Math.max(0, ...weeks.map((w) => w.orders));
  const yOrders = (v) => H - 4 - (v / (maxOrders || 1)) * (H - 16);
  const lineXY = weeks.map((w, i) => ({ x: ((i + 0.5) / WEEKS) * 1200, y: yOrders(w.orders) }));
  // Bo cong đường số đơn: Catmull-Rom chuyển sang Bézier bậc 3 — đường cong đi qua đúng từng
  // điểm tuần nhưng không gãy góc. Điểm điều khiển được kẹp (clamp) trong [đỉnh, đáy] của thang
  // số đơn, nên khi số đơn nhảy mạnh giữa hai tuần kề nhau, cong không lún xuống dưới mức 0 đơn
  // (đáy thang) cũng không vọt quá tuần đông đơn nhất (đỉnh thang) — chống overshoot.
  const clampLineY = (v) => Math.min(yOrders(0), Math.max(yOrders(maxOrders), v));
  const linePath = (() => {
    if (lineXY.length < 2) return '';
    let d = `M ${lineXY[0].x.toFixed(1)} ${lineXY[0].y.toFixed(1)}`;
    for (let i = 0; i < lineXY.length - 1; i += 1) {
      const p0 = lineXY[Math.max(0, i - 1)];
      const p1 = lineXY[i];
      const p2 = lineXY[i + 1];
      const p3 = lineXY[Math.min(lineXY.length - 1, i + 2)];
      const c1 = `${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${clampLineY(p1.y + (p2.y - p0.y) / 6).toFixed(1)}`;
      const c2 = `${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${clampLineY(p2.y - (p3.y - p1.y) / 6).toFixed(1)}`;
      d += ` C ${c1}, ${c2}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  })();
  const missingRecipes = [...new Set(weeks.flatMap((w) => w.noRecipe))];
  const overCount = weeks.filter((w) => !w.current && tone(w.profit) === 'over').length;

  const saveTarget = () => {
    const n = parseNum(draft);
    onTargetChange(Number.isFinite(n) && n > 0 ? n : null);
    setEditing(false);
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-card px-5 pb-4 pt-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-[13px] font-medium text-slate-500">Lợi nhuận theo tuần</h2>
        {editing ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveTarget();
            }}
          >
            <input
              autoFocus
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="VD 500"
              aria-label="Mục tiêu lợi nhuận mỗi tuần ($)"
              className="w-24 rounded-xl border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
            />
            <button type="submit" className="rounded-xl bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white">
              Lưu
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(hasTarget ? String(target) : '');
              setEditing(true);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700"
          >
            <Target size={15} aria-hidden="true" />
            {hasTarget ? `Mục tiêu ${whole(target)}` : 'Đặt mục tiêu'}
          </button>
        )}
      </div>
      <p className="mt-0.5 text-xs text-slate-400">{WEEKS} tuần gần nhất · doanh thu − giá vốn − chi phí · đường tím: số đơn</p>

      {!inventory.ready ? (
        <p className="py-10 text-center text-sm text-slate-400">Đang tải số liệu chi phí…</p>
      ) : inventory.missingTables ? (
        <p className="py-6 text-center text-sm text-slate-500">Chưa cài mục Inventory trên máy chủ nên chưa tính được lợi nhuận.</p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Lợi nhuận ${WEEKS} tuần: ${weeks.map((w) => `tuần ${ddmm(w.start)} lãi ${money(w.profit)}, ${w.orders} đơn`).join(', ')}`}
            className="relative mt-4"
            style={{ height: H }}
          >
            {hasTarget && (
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gold/70"
                style={{ top: y(target) }}
              >
                <span className="absolute -top-2 left-0 z-10 rounded bg-card pr-1 text-[13px] font-medium leading-none text-gold">
                  {whole(target)}
                </span>
              </div>
            )}
            <div className="absolute inset-x-0 border-t border-slate-300" style={{ top: zeroY }} />
            <div className="absolute inset-0 flex items-stretch gap-1.5">
              {weeks.map((w) => {
                const t = Math.min(zeroY, y(w.profit));
                const h = Math.max(2, Math.abs(y(w.profit) - zeroY));
                return (
                  <div key={w.start.getTime()} className="relative flex-1">
                    <div
                      title={`Tuần ${ddmm(w.start)}${w.current ? ' (đang diễn ra)' : ''}: ${money(w.profit)} · doanh thu ${money(w.revenue)} · ${w.orders} đơn`}
                      className="absolute inset-x-0 rounded-md"
                      style={{ top: t, height: h, background: COLOR[tone(w.profit)], opacity: w.current ? 0.75 : 1 }}
                    />
                  </div>
                );
              })}
            </div>
            {/* Đường cong số đơn (trục phải): phủ lên trên cột, không bắt sự kiện để tooltip cột vẫn dùng được */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 1200 ${H}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d={linePath}
                fill="none"
                stroke={LINE_COLOR}
                strokeWidth={2.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {weeks.map((w, i) => (
              <span
                key={`orders-dot-${w.start.getTime()}`}
                title={`${w.orders} đơn · tuần ${ddmm(w.start)}`}
                className="pointer-events-none absolute h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${(((i + 0.5) / WEEKS) * 100).toFixed(2)}%`,
                  top: yOrders(w.orders),
                  background: LINE_COLOR,
                  border: '2px solid rgba(255, 255, 255, 0.9)',
                }}
              />
            ))}
            <span
              className="pointer-events-none absolute right-0 rounded bg-card/80 px-1 text-[11px] font-semibold leading-tight"
              style={{ top: Math.max(0, yOrders(maxOrders) - 7), color: LINE_COLOR }}
            >
              {maxOrders} đơn
            </span>
            <span className="pointer-events-none absolute bottom-0 right-0 rounded bg-card/80 px-1 text-[11px] leading-tight text-slate-400">
              0
            </span>
          </div>
          {/* Nhãn ngày đầu tuần: mỗi 3 tuần một nhãn, tuần cuối ghi "Nay"; nhãn được tràn sang hai bên cột */}
          <div className="mt-1.5 flex gap-1.5 text-center text-[13px] text-slate-500" aria-hidden="true">
            {weeks.map((w, i) => (
              <span key={w.start.getTime()} className="flex flex-1 justify-center whitespace-nowrap">
                {w.current ? 'Nay' : (WEEKS - 1 - i) % 3 === 0 ? dm(w.start) : ''}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR.over }} /> Trên {whole(target)}
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR.profit }} /> Lãi
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR.loss }} /> Lỗ
            </span>
            <span className="flex items-center gap-1.5">
              <span className="relative block h-[2.5px] w-6 rounded-full" style={{ background: LINE_COLOR }}>
                <span
                  className="absolute left-1/2 top-1/2 block h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ background: LINE_COLOR }}
                />
              </span>
              Số đơn (trục phải)
            </span>
            <span>{overCount} tuần trên {whole(target)}</span>
          </div>
          {missingRecipes.length > 0 && (
            <p className="mt-2 text-xs text-amber-500">
              Chưa có công thức cho {missingRecipes.length} món ({missingRecipes.slice(0, 3).join(', ')}
              {missingRecipes.length > 3 ? '…' : ''}): giá vốn món đó tính là 0, lợi nhuận có thể cao hơn thực tế.
            </p>
          )}
        </>
      )}
    </section>
  );
}
