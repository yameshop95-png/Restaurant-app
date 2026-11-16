import { useMemo, useState } from 'react';
import { CloudRain, Snowflake, Sparkles, Sun, TrendingDown, TrendingUp, Wind } from 'lucide-react';
import { WEATHER, weekKey, weeklyForecast } from '../lib/forecast';

const WEATHER_ICON = { hot: Sun, mild: Wind, cold: Snowflake, rain: CloudRain };
const SHOW = 6;
const round = (n) => Math.round(n);

// Ô "Dự báo tuần này": món nào khách sẽ mua nhiều, dựa trên dữ liệu bán của quán.
// Chủ quán chọn thời tiết của tuần (lưu chung trong thông tin quán) để app học món nào bán khác đi khi nóng / lạnh / mưa.
export default function ForecastCard({ orders, now, settings, isOwner, onUpdateSettings }) {
  const weatherLog = settings.weatherLog ?? {};
  const thisKey = weekKey(now);
  const f = useMemo(
    () => weeklyForecast({ orders, now, weatherLog }),
    // `now` đổi mỗi phút; chỉ cần tính lại khi đơn, thời tiết hoặc tuần thay đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, weatherLog, thisKey],
  );
  const [open, setOpen] = useState(null);
  const chosen = weatherLog[thisKey] ?? null;

  const setWeather = (id) => {
    if (!isOwner || !onUpdateSettings) return;
    const next = { ...weatherLog };
    if (chosen === id) delete next[thisKey];
    else next[thisKey] = id;
    onUpdateSettings({ weatherLog: next });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-card px-5 pb-4 pt-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-blue-500" aria-hidden="true" />
        <h2 className="text-[15px] text-slate-500">Dự báo món tuần này</h2>
      </div>

      <div className="mt-3">
        <p className="text-xs text-slate-500">
          Thời tiết tuần này{isOwner ? ' (chọn để app học dần món nào bán chạy theo thời tiết)' : ''}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Thời tiết tuần này">
          {WEATHER.map((w) => {
            const Icon = WEATHER_ICON[w.id];
            const on = chosen === w.id;
            return (
              <button
                key={w.id}
                type="button"
                disabled={!isOwner}
                aria-pressed={on}
                onClick={() => setWeather(w.id)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
                  on ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-200 text-slate-700'
                } ${isOwner ? '' : 'cursor-default opacity-80'}`}
              >
                <Icon size={15} aria-hidden="true" /> {w.label}
              </button>
            );
          })}
        </div>
      </div>

      {!f.ready ? (
        <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
          Cần ít nhất {f.minWeeks} tuần bán hàng để dự báo (hiện có {f.weeksUsed}).
        </p>
      ) : f.items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Chưa có món nào bán trong 4 tuần gần đây.</p>
      ) : (
        <ol className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
          {f.items.slice(0, SHOW).map((it, i) => {
            const up = it.change != null && it.change >= 1.1;
            const down = it.change != null && it.change <= 0.9;
            return (
              <li key={it.key} className="py-2.5">
                <button
                  type="button"
                  onClick={() => setOpen(open === it.key ? null : it.key)}
                  aria-expanded={open === it.key}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span className="w-5 shrink-0 text-sm font-bold text-slate-400">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">{it.name}</span>
                    <span className="block text-xs text-slate-500">
                      Đã bán {round(it.soldSoFar)} phần tuần này
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="flex items-center justify-end gap-1 font-bold text-slate-900">
                      {up && <TrendingUp size={15} className="text-emerald-600" aria-label="tăng" />}
                      {down && <TrendingDown size={15} className="text-red-600" aria-label="giảm" />}~{round(it.expected)} phần
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      khoảng {round(it.low)}–{round(it.high)}
                    </span>
                  </span>
                </button>
                {open === it.key && (
                  <ul className="mt-2 space-y-0.5 pl-8 text-xs text-slate-500">
                    {it.reasons.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {f.notes.map((n) => (
        <p key={n} className="mt-3 rounded-2xl bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-500">
          {n}
        </p>
      ))}

      {f.ready && (
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Dựa trên {f.weeksUsed} tuần bán hàng của quán, tuần {f.weekOfMonth} trong tháng, {f.season}
          {f.weather ? `, ${f.weatherWeeks} tuần từng có thời tiết này` : ''}. Bấm vào món để xem lý do. Càng nhiều tuần dữ
          liệu và càng chọn thời tiết đều đặn, dự báo càng sát.
        </p>
      )}
    </section>
  );
}
