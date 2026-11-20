import { useMemo } from 'react';
import { money } from './inventory/ui';
import useInventory from '../hooks/useInventory';
import { profitReport } from '../lib/inventory';

// Thẻ "Top món theo lãi gộp" trong tab Báo cáo: xếp hạng món theo LÃI GỘP trong đúng kỳ đang
// chọn của trang Báo cáo (tuần / tháng / năm — trang truyền `range` của buildReport xuống).
// Mọi số lấy từ profitReport (lib/inventory): nó đã tổng hợp sẵn theo từng món (dishes) bằng
// đúng công thức giá vốn theo từng dòng đơn mà thẻ Hiệu suất Tuần và tab Inventory dùng —
// thẻ này không tự tính lại theo cách khác.
// Lãi theo món là LÃI GỘP (doanh thu dòng − giá vốn dòng): chi phí chung của kỳ (điện nước,
// bao bì…) không gán cho món nào, giống cách lãi theo kênh ở thẻ Hiệu suất Tuần. Doanh thu
// dòng = giá bán × số phần (không gồm phí ship / giảm giá của cả đơn).
const TOP_N = 8;

export default function DishProfitCard({ orders, menu, range }) {
  const inventory = useInventory();
  const ingredients = inventory.ingredients.list;
  const purchases = inventory.purchases.list;
  const expenses = inventory.expenses.list;
  const recipes = inventory.recipes.list;
  const batches = inventory.batches.list;

  const report = useMemo(
    () =>
      range
        ? profitReport({ range, orders, menu: menu ?? [], recipes, ingredients, purchases, expenses, batches })
        : null,
    [range, orders, menu, recipes, ingredients, purchases, expenses, batches],
  );

  // dishes của profitReport đã xếp giảm dần theo lãi gộp; tỉ lệ lãi % tính ngay tại đây.
  const top = (report?.dishes ?? [])
    .slice(0, TOP_N)
    .map((d) => ({ ...d, margin: d.revenue > 0 ? d.profit / d.revenue : null }));
  const totalDishes = report?.dishes.length ?? 0;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <h2 className="font-bold text-slate-900">Top món theo lãi gộp</h2>
        {totalDishes > TOP_N && <span className="text-sm text-slate-500">Top {TOP_N} trong {totalDishes} món</span>}
      </div>

      {!inventory.ready ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">Đang tải số liệu chi phí…</p>
      ) : inventory.missingTables ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          Chưa cài mục Inventory trên máy chủ nên chưa tính được giá vốn và tiền lãi theo món.
        </p>
      ) : !report || totalDishes === 0 ? (
        <p className="px-5 py-8 text-center text-slate-400">Chưa có đơn trong kỳ này</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto border-t border-slate-100">
            <table className="w-full min-w-[540px] text-sm">
              <thead>
                <tr className="text-xs text-slate-400">
                  <th scope="col" className="px-5 py-2 text-left font-semibold">Món</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">Phần</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">Doanh thu</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">Giá vốn</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">Lãi gộp</th>
                  <th scope="col" className="px-5 py-2 text-right font-semibold">Lãi %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {top.map((d, i) => (
                  <tr key={d.name}>
                    <td className="px-5 py-2.5 font-semibold text-slate-900">
                      <span className="mr-1.5 text-slate-400">{i + 1}.</span>
                      {d.name}
                    </td>
                    <td className="px-2 py-2.5 text-right text-slate-600">{d.qty}</td>
                    <td className="px-2 py-2.5 text-right text-slate-600">{money(d.revenue)}</td>
                    <td className="px-2 py-2.5 text-right text-slate-600">{money(d.cost)}</td>
                    <td className={`px-2 py-2.5 text-right font-semibold ${d.profit < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                      {money(d.profit)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-slate-600">
                      {d.margin == null ? '—' : `${Math.round(d.margin * 100)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-1.5 px-5 pb-4 pt-3">
            <p className="text-xs leading-relaxed text-slate-400">
              Lãi gộp = doanh thu của món − giá vốn của món, chưa trừ chi phí chung của kỳ. Xếp theo kỳ đang chọn ở
              đầu trang Báo cáo.
            </p>
            {report.noRecipe.length > 0 && (
              <p className="text-xs text-amber-500">
                Chưa có công thức cho {report.noRecipe.length} món ({report.noRecipe.slice(0, 3).join(', ')}
                {report.noRecipe.length > 3 ? '…' : ''}): giá vốn món đó tính là 0, tiền lãi có thể cao hơn thực tế.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
