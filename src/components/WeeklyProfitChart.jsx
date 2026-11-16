import { useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { money, parseNum } from './inventory/ui';
import useInventory from '../hooks/useInventory';
import { profitReport } from '../lib/inventory';
import { periodRange, shiftPeriod } from '../lib/report';

// Lợi nhuận từng tuần (doanh thu − giá vốn − chi phí khác), tính giống tab Inventory Management.
// Màu cột: tím = lãi vượt mục tiêu, xanh = lãi, đỏ = lỗ. Mục tiêu lưu riêng trên máy này (chỉ chủ quán thấy biểu đồ).
const WEEKS = 12;
const COLOR = { over: '#8b5cf6', profit: '#10b981', loss: '#ef4444' };
const ddmm = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const dm = (d) => `${d.getDate()}/${d.getMonth() + 1}`; // nhãn ngắn dưới cột
const whole = (n) => `A$${Math.round(n).toLocaleString('en-AU')}`;

export default function WeeklyProfitChart({ orders, menu, now, target, onTargetChange }) {
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
  const hasTarget = Number.isFinite(target) && target > 0;
  const tone = (p) => (hasTarget && p >= target ? 'over' : p >= 0 ? 'profit' : 'loss');

  // Thang đo: luôn có số 0, và mục tiêu nếu đã đặt
  const values = weeks.map((w) => w.profit);
  const top = Math.max(0, ...values, hasTarget ? target : 0) || 1;
  const bottom = Math.min(0, ...values);
  const span = top - bottom || 1;
  const H = 160;
  const y = (v) => ((top - v) / span) * H;
  const zeroY = y(0);
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
        <h2 className="text-[15px] text-slate-500">Lợi nhuận theo tuần</h2>
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
              aria-label="Mục tiêu lợi nhuận mỗi tuần (A$)"
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
      <p className="mt-0.5 text-xs text-slate-400">{WEEKS} tuần gần nhất · doanh thu − giá vốn − chi phí</p>

      {!inventory.ready ? (
        <p className="py-10 text-center text-sm text-slate-400">Đang tải số liệu chi phí…</p>
      ) : inventory.missingTables ? (
        <p className="py-6 text-center text-sm text-slate-500">Chưa cài mục Inventory trên máy chủ nên chưa tính được lợi nhuận.</p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Lợi nhuận ${WEEKS} tuần: ${weeks.map((w) => `tuần ${ddmm(w.start)} ${money(w.profit)}`).join(', ')}`}
            className="relative mt-4"
            style={{ height: H }}
          >
            {hasTarget && (
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-violet-400/70"
                style={{ top: y(target) }}
              >
                <span className="absolute -top-2 left-0 z-10 rounded bg-card pr-1 text-[10px] font-semibold leading-none text-violet-400">
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
                      style={{ top: t, height: h, background: COLOR[tone(w.profit)], opacity: w.current ? 0.55 : 1 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          {/* Nhãn ngày đầu tuần: mỗi 3 tuần một nhãn, tuần cuối ghi "Nay"; nhãn được tràn sang hai bên cột */}
          <div className="mt-1.5 flex gap-1.5 text-center text-[10px] text-slate-400" aria-hidden="true">
            {weeks.map((w, i) => (
              <span key={w.start.getTime()} className="flex flex-1 justify-center whitespace-nowrap">
                {w.current ? 'Nay' : (WEEKS - 1 - i) % 3 === 0 ? dm(w.start) : ''}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR.over }} /> Vượt mục tiêu
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR.profit }} /> Lãi
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR.loss }} /> Lỗ
            </span>
            {hasTarget && <span>{overCount} tuần vượt mục tiêu</span>}
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
