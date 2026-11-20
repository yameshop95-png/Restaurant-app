import { useMemo } from 'react';
import { Languages } from 'lucide-react';
import { LANG_GROUPS, languageSummary } from '../lib/languageReport';
import { formatMoney } from '../lib/stats';

const COLOR = { vi: 'var(--chart-vi)', en: 'var(--chart-en)', app: 'var(--chart-app)' };

// Khách theo ngôn ngữ trong kỳ đang xem: đơn web tiếng Việt / tiếng Anh, và đơn nhân viên tạo trong app
export default function LanguageCard({ orders, range }) {
  const s = useMemo(() => languageSummary(orders, range), [orders, range]);
  if (!s.total) return null;
  return (
    <section className="rounded-3xl border border-slate-200 bg-card px-5 pb-4 pt-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Languages size={18} className="text-blue-500" aria-hidden="true" />
        <h2 className="text-[15px] text-slate-500">Khách theo ngôn ngữ</h2>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={LANG_GROUPS.map((g) => `${g.label} ${s.groups[g.id].orders} đơn`).join(', ')}>
        {LANG_GROUPS.map((g) => (
          <div key={g.id} style={{ width: `${(s.groups[g.id].orders / s.total) * 100}%`, background: COLOR[g.id] }} />
        ))}
      </div>
      <ul className="mt-3 space-y-2.5">
        {LANG_GROUPS.map((g) => {
          const x = s.groups[g.id];
          return (
            <li key={g.id} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold text-slate-900">
                  <i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[g.id] }} /> {g.label}
                </span>
                <span className="shrink-0 text-slate-500">
                  {x.orders} đơn · {formatMoney(x.revenue)}
                </span>
              </div>
              {x.top.length > 0 && (
                <p className="mt-0.5 pl-[18px] text-xs text-slate-500">Bán nhiều: {x.top.map((d) => `${d.name} (${d.qty})`).join(', ')}</p>
              )}
            </li>
          );
        })}
      </ul>
      {s.enShareOfWeb != null && (
        <p className="mt-3 text-xs text-slate-500">
          {Math.round(s.enShareOfWeb * 100)}% đơn trên website là khách dùng tiếng Anh. Đơn tạo trong app không ghi ngôn ngữ.
        </p>
      )}
    </section>
  );
}
