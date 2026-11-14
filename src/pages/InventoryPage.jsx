import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import ExpensesTab from '../components/inventory/ExpensesTab';
import PurchasesTab from '../components/inventory/PurchasesTab';
import RecipesTab from '../components/inventory/RecipesTab';
import StockTab from '../components/inventory/StockTab';
import { Card, money, qtyText } from '../components/inventory/ui';
import useInventory from '../hooks/useInventory';
import { ingredientCosts, profitReport, stockLevels } from '../lib/inventory';
import { PERIODS, periodRange, shiftPeriod } from '../lib/report';

const TABS = [
  ['overview', 'Lãi lỗ'],
  ['stock', 'Kho'],
  ['purchases', 'Nhập hàng'],
  ['recipes', 'Công thức'],
  ['expenses', 'Chi phí'],
];

function Overview({ report, levels, onGo }) {
  const [kind, setKind] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const range = useMemo(() => periodRange(kind, anchor), [kind, anchor]);
  const r = useMemo(() => report(range), [report, range]);
  const atCurrent = range.end > new Date();
  const low = levels.filter((l) => l.low || l.negative);
  const warnings = [];
  if (r.noRecipe.length) warnings.push(`Chưa có công thức: ${r.noRecipe.join(', ')}. Giá vốn các món này đang tính là 0.`);
  if (r.noPrice.length) warnings.push(`Chưa có giá nhập: ${r.noPrice.join(', ')}.`);

  return (
    <div className="space-y-4">
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
        <p className="font-bold text-slate-900">{range.label}</p>
        <button
          onClick={() => setAnchor((a) => shiftPeriod(kind, a, 1))}
          disabled={atCurrent}
          className="rounded-full bg-card p-2 text-slate-600 shadow-sm active:bg-slate-100 disabled:opacity-30"
          aria-label="Kỳ sau"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <Card>
        <div className="px-5 py-4">
          <p className="text-[15px] text-slate-500">Lãi (sau giá vốn và chi phí)</p>
          <p data-testid="profit" className={`mt-1 text-4xl font-extrabold tabular-nums ${r.profit < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {money(r.profit)}
          </p>
          <p className="text-sm text-slate-500">
            {r.margin != null ? `Biên lãi ${Math.round(r.margin * 100)}% · ` : ''}
            {r.orders} đơn
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-px border-t border-slate-200 bg-slate-200 text-center">
          {[
            ['Doanh thu', r.revenue],
            ['Giá vốn', r.cogs],
            ['Chi phí khác', r.otherCosts],
          ].map(([label, value]) => (
            <div key={label} className="bg-card px-2 py-3">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="font-bold tabular-nums text-slate-900">{money(value)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Dòng tiền (tiền vào − tiền ra)">
        <div className="px-5 pb-4 pt-2">
          <p className={`text-2xl font-extrabold tabular-nums ${r.cashNet < 0 ? 'text-red-500' : 'text-slate-900'}`}>{money(r.cashNet)}</p>
          <p className="text-sm text-slate-500">
            Bán {money(r.cashIn)} − mua hàng {money(r.bought)} − chi phí {money(r.otherCosts)}
          </p>
        </div>
      </Card>

      {warnings.length > 0 && (
        <div className="space-y-1 rounded-3xl border border-amber-400/60 bg-card px-5 py-4 text-sm text-slate-700">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle size={16} className="text-amber-500" /> Số liệu chưa đủ chính xác
          </p>
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <button onClick={() => onGo('recipes')} className="font-semibold text-blue-600">
            Nhập công thức
          </button>
        </div>
      )}

      {low.length > 0 && (
        <Card title="Sắp hết hàng">
          <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-200">
            {low.map((l) => (
              <li key={l.ingredient.id} className="flex justify-between px-5 py-2.5">
                <span className="font-semibold text-slate-900">{l.ingredient.name}</span>
                <span className="font-bold text-red-500">
                  {qtyText(l.stock)} {l.ingredient.unit}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {r.dishes.length > 0 && (
        <Card title="Lãi theo món">
          <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-200">
            {r.dishes.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{d.name}</p>
                  <p className="text-xs text-slate-500">
                    Bán {qtyText(d.qty)} · doanh thu {money(d.revenue)}
                    {d.hasRecipe ? ` · giá vốn ${money(d.cost)}` : ' · chưa có công thức'}
                  </p>
                </div>
                <p className={`shrink-0 font-bold tabular-nums ${d.profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{money(d.profit)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {r.byCategory.length > 0 && (
        <Card title="Chi phí khác theo loại">
          <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-200">
            {r.byCategory.map(([name, amount]) => (
              <li key={name} className="flex justify-between px-5 py-2.5">
                <span className="text-slate-700">{name}</span>
                <span className="font-bold tabular-nums text-slate-900">{money(amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="px-1 text-xs text-slate-500">
        Lãi = doanh thu (đơn không huỷ, gồm phí ship) − giá vốn món đã bán (theo công thức và giá nhập hiện tại) − chi phí khác.
        Dòng tiền tính theo tiền thực chi mua hàng trong kỳ nên có thể khác lãi.
      </p>
    </div>
  );
}

// Inventory Management (chỉ chủ quán): lãi lỗ, kho, nhập hàng, công thức món, chi phí
export default function InventoryPage({ isOwner, orders, menu }) {
  const [tab, setTab] = useState('overview');
  if (!isOwner) {
    return <p className="mx-auto max-w-md rounded-3xl bg-card px-5 py-10 text-center text-slate-500">Chỉ chủ quán xem được mục này</p>;
  }
  return <InventoryOwner tab={tab} setTab={setTab} orders={orders} menu={menu} />;
}

function InventoryOwner({ tab, setTab, orders, menu }) {
  const inventory = useInventory();
  const ingredients = inventory.ingredients.list;
  const purchases = inventory.purchases.list;
  const adjustments = inventory.adjustments.list;
  const expenses = inventory.expenses.list;
  const recipes = inventory.recipes.list;

  const costs = useMemo(() => ingredientCosts(ingredients, purchases), [ingredients, purchases]);
  const levels = useMemo(
    () => stockLevels({ ingredients, purchases, adjustments, orders, menu, recipes }),
    [ingredients, purchases, adjustments, orders, menu, recipes],
  );
  const report = useMemo(
    () => (range) => profitReport({ range, orders, menu, recipes, ingredients, purchases, expenses }),
    [orders, menu, recipes, ingredients, purchases, expenses],
  );

  if (inventory.missingTables) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-card p-6">
        <h2 className="text-lg font-bold text-slate-900">Chưa bật Inventory Management</h2>
        <p className="mt-2 text-slate-600">
          Máy chủ chưa có các bảng kho. Mở file <b>sql/inventory.sql</b> trong repo, dán vào SQL Editor của project quán và bấm
          Run một lần, rồi tải lại trang này.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <div data-no-swipe className="flex gap-2 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-slate-900 text-slate-50' : 'bg-card text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {!inventory.ready && (
        <p className="rounded-2xl bg-card px-4 py-3 text-center text-sm text-slate-500">
          {inventory.loadError ? `Chưa tải được: ${inventory.loadError}. Đang thử lại…` : 'Đang tải dữ liệu…'}
        </p>
      )}
      {inventory.ready && tab === 'overview' && <Overview report={report} levels={levels} onGo={setTab} />}
      {inventory.ready && tab === 'stock' && <StockTab levels={levels} inventory={inventory} />}
      {inventory.ready && tab === 'purchases' && <PurchasesTab inventory={inventory} />}
      {inventory.ready && tab === 'recipes' && <RecipesTab menu={menu} inventory={inventory} costs={costs} />}
      {inventory.ready && tab === 'expenses' && <ExpensesTab inventory={inventory} />}
    </div>
  );
}
