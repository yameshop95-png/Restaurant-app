import { useEffect, useMemo, useState } from 'react';
import { CloudRain, Snowflake, Sun, TrendingDown, TrendingUp, Wind } from 'lucide-react';
import { FAMILY_LABEL, WEATHER, weekKey, weeklyForecast } from '../lib/forecast';
import { saveForecastOnce } from '../lib/forecastLog';
import { nowcast, SERVICE_LEVELS } from '../lib/nowcast';

const LEVEL_KEY = 'restaurant-app.service-level';
const readLevel = () => {
  try {
    const v = Number(localStorage.getItem(LEVEL_KEY));
    return SERVICE_LEVELS.some((l) => l.id === v) ? v : 0.75;
  } catch {
    return 0.75;
  }
};

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
  const [level, setLevel] = useState(readLevel);
  const chooseLevel = (v) => {
    setLevel(v);
    try {
      localStorage.setItem(LEVEL_KEY, String(v));
    } catch {
      // không lưu được: vẫn dùng trong lần mở này
    }
  };
  // Tính lại mỗi phút (`now`) vì tỉ lệ đơn đã nhận thay đổi theo giờ trong tuần
  const nc = useMemo(() => nowcast({ forecast: f, orders, now, level }), [f, orders, now, level]);
  const rows = nc.items.filter((it) => it.total != null);
  const chosen = weatherLog[thisKey] ?? null;
  // Ghi lại dự báo đầu tiên của tuần trên máy này, để sau so với số bán thật (xem docs/du-bao.md)
  useEffect(() => saveForecastOnce(f), [f]);

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
        <TrendingUp size={18} className="text-slate-500" aria-hidden="true" />
        <h2 className="text-[13px] font-medium text-slate-500">Dự báo món tuần này</h2>
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

      {rows.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
          {f.ready
            ? 'Chưa có món nào bán trong 4 tuần gần đây.'
            : `Cần ít nhất ${f.minWeeks} tuần bán hàng để dự báo (hiện có ${f.weeksUsed}). Trong lúc chờ, xem số đã đặt ở mục Phiếu làm hàng.`}
        </p>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-xs text-slate-500">Mức đủ hàng khi gợi ý số nên làm</p>
            <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Mức đủ hàng">
              {SERVICE_LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={level === l.id}
                  onClick={() => chooseLevel(l.id)}
                  title={l.hint}
                  className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${
                    level === l.id ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-200 text-slate-700'
                  }`}
                >
                  {l.label} {Math.round(l.id * 100)}%
                </button>
              ))}
            </div>
          </div>
          <ol className="mt-3 divide-y divide-slate-200 border-t border-slate-200">
            {rows.slice(0, SHOW).map((it, i) => {
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
                        Đã đặt {round(it.soldSoFar)} · dự kiến ~{round(it.total)} phần (80%: {it.p10}–{it.p90})
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="flex items-center justify-end gap-1 font-bold text-slate-900">
                        {up && <TrendingUp size={15} className="text-emerald-600" aria-label="tăng" />}
                        {down && <TrendingDown size={15} className="text-red-600" aria-label="giảm" />}
                        Làm {it.make}
                      </span>
                      <span className="block text-[13px] text-slate-500">phần cả tuần</span>
                    </span>
                  </button>
                  {open === it.key && (
                    <ul className="mt-2 space-y-0.5 pl-8 text-xs text-slate-500">
                      {it.reasons.map((r) => (
                        <li key={r}>• {r}</li>
                      ))}
                      {it.expected != null && <li>• Theo mô hình (chưa tính đơn tuần này): ~{round(it.expected)} phần</li>}
                      <li>
                        • Làm {it.make} phần thì khoảng {Math.round(level * 100)}% khả năng đủ hàng cho cả tuần
                      </li>
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
          {nc.curve.f != null && (
            <p className="mt-2 text-xs text-slate-500">
              Tới giờ này trong tuần, {nc.curve.weeks} tuần trước thường đã có khoảng{' '}
              <span className="font-semibold">{Math.round(nc.curve.f * 100)}%</span> số phần của cả tuần. Càng gần cuối tuần, số dự
              kiến càng dựa vào đơn thật.
            </p>
          )}
        </>
      )}

      {f.notes.map((n) => (
        <p key={n} className="mt-3 rounded-2xl bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-500">
          {n}
        </p>
      ))}

      {f.ready && (
        <div className="mt-3 space-y-1 text-xs leading-relaxed text-slate-400">
          {f.accuracy ? (
            <p>
              <span className="font-semibold text-slate-500">Độ chính xác:</span> thử dự báo lại {f.accuracy.weeks} tuần đã qua,
              trung bình lệch khoảng <span className="font-semibold text-slate-500">{Math.round(f.accuracy.wape * 100)}%</span>.
            </p>
          ) : (
            <p>Chưa đủ tuần để đo độ chính xác.</p>
          )}
          <p>
            Đang dùng: mức bán gần đây
            {f.families.length ? ` + ${f.families.map((x) => FAMILY_LABEL[x]).join(', ')}` : ''} (app tự chọn yếu tố nào làm dự báo
            chính xác hơn). Dựa trên {f.weeksUsed} tuần bán hàng. Bấm vào món để xem lý do; chọn thời tiết đều đặn để app học.
          </p>
        </div>
      )}
    </section>
  );
}
