import { CLASSES, menuEngineering } from '../../lib/menuEngineering';
import { Card, money } from './ui';

// Phân loại món theo lãi và độ phổ biến trong kỳ đang xem (menu engineering, Kasavana & Smith 1982)
export default function MenuEngineeringCard({ dishes }) {
  const me = menuEngineering(dishes);
  if (!me.rows.length && !me.unknown.length) return null;
  const groups = Object.keys(CLASSES).map((id) => ({ id, ...CLASSES[id], rows: me.rows.filter((r) => r.cls === id) }));

  return (
    <Card title="Phân loại món (lãi × độ phổ biến)">
      {me.rows.length > 0 ? (
        <div className="space-y-3 px-5 pb-4 pt-2">
          <p className="text-xs text-slate-500">
            Món phổ biến khi chiếm ≥ {(me.popularityLine * 100).toFixed(1)}% số phần bán. Lãi trung bình mỗi phần:{' '}
            {money(me.avgMargin)}.
          </p>
          {groups
            .filter((g) => g.rows.length)
            .map((g) => (
              <div key={g.id}>
                <p className={`text-sm font-bold ${g.tone}`}>{g.label}</p>
                <p className="text-xs text-slate-500">{g.hint}</p>
                <ul className="mt-1.5 divide-y divide-slate-100 rounded-2xl bg-slate-100/60">
                  {g.rows.map((r) => (
                    <li key={r.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate font-semibold text-slate-900">{r.name}</span>
                      <span className="shrink-0 text-right text-xs text-slate-500">
                        lãi {money(r.margin)}/phần · {(r.mix * 100).toFixed(0)}% số phần
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      ) : (
        <p className="px-5 pb-4 pt-2 text-sm text-slate-500">Cần công thức món để biết giá vốn rồi mới phân loại được.</p>
      )}
      {me.unknown.length > 0 && (
        <p className="px-5 pb-4 text-xs text-amber-500">
          Chưa phân loại vì chưa có công thức: {me.unknown.slice(0, 6).join(', ')}
          {me.unknown.length > 6 ? '…' : ''}
        </p>
      )}
    </Card>
  );
}
