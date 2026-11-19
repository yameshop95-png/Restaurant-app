import { useState } from 'react';
import { CloudRain, Snowflake, Sparkles, Sun, TrendingDown, TrendingUp, Wind } from 'lucide-react';

// Bản xem giao diện của thẻ "Dự báo món tuần này". Số liệu cố định, không gọi thời tiết,
// Supabase, hay đơn thật. Tên món lấy từ nội dung website hiện có; không có giá.
const WEATHER = [
  { id: 'hot', label: 'Nóng', Icon: Sun },
  { id: 'mild', label: 'Mát', Icon: Wind },
  { id: 'cold', label: 'Lạnh', Icon: Snowflake },
  { id: 'rain', label: 'Mưa', Icon: CloudRain },
];

const LEVELS = [
  { id: 0.6, label: 'Ít dư' },
  { id: 0.75, label: 'Cân bằng' },
  { id: 0.9, label: 'Ít hết hàng' },
];

const ROWS = [
  { key: 'banh-cuon', name: 'Bánh cuốn', sold: 18, total: 42, low: 34, high: 51, make: 46, change: 'up' },
  { key: 'gio-lua', name: 'Giò lụa', sold: 14, total: 36, low: 29, high: 44, make: 39, change: 'up' },
  { key: 'cha-bi', name: 'Chả bì', sold: 9, total: 22, low: 16, high: 28, make: 24, change: 'flat' },
  { key: 'lap-xuong', name: 'Lạp xưởng', sold: 11, total: 20, low: 14, high: 27, make: 18, change: 'down' },
  { key: 'bo-vien', name: 'Bò viên', sold: 8, total: 19, low: 13, high: 25, make: 21, change: 'up' },
  { key: 'xoi-khuc', name: 'Xôi khúc', sold: 6, total: 15, low: 10, high: 20, make: 16, change: 'flat' },
];

export default function WeekForecastDemo() {
  const [weather, setWeather] = useState('mild');
  const [level, setLevel] = useState(0.75);
  const [open, setOpen] = useState(null);

  return (
    <section className="font-ui soft-shadow rise-in rounded-[28px] border border-slate-200/80 bg-white/90 px-5 pb-5 pt-5 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-blue-500" aria-hidden="true" />
          <h2 className="text-[15px] text-slate-500">Dự báo món tuần này</h2>
        </div>
        <span className="shrink-0 rounded-full bg-mist px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Minh hoạ
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Số minh hoạ để xem chuyển động. Không lấy từ đơn thật.
      </p>

      <div className="mt-4">
        <p className="text-xs text-slate-500">Thời tiết tuần này</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Thời tiết tuần này">
          {WEATHER.map((w) => {
            const on = weather === w.id;
            const Icon = w.Icon;
            return (
              <button
                key={w.id}
                type="button"
                aria-pressed={on}
                onClick={() => setWeather(w.id)}
                className={`press flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-sm font-semibold ${
                  on ? 'border-blue-500 bg-blue-500 text-white shadow-[0_10px_20px_-12px_rgba(234,109,39,0.9)]' : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <Icon size={15} aria-hidden="true" /> {w.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs text-slate-500">Mức đủ hàng khi gợi ý số nên làm</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Mức đủ hàng">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={level === l.id}
              onClick={() => setLevel(l.id)}
              className={`press rounded-2xl border px-3.5 py-2 text-sm font-semibold ${
                level === l.id ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {l.label} {Math.round(l.id * 100)}%
            </button>
          ))}
        </div>
      </div>

      <ol className="stagger mt-4 divide-y divide-slate-200/80 border-t border-slate-200/80">
        {ROWS.map((it, i) => (
          <li key={it.key} className="rise-in py-3">
            <button
              type="button"
              onClick={() => setOpen(open === it.key ? null : it.key)}
              aria-expanded={open === it.key}
              className="press flex w-full items-center gap-3 text-left"
            >
              <span className="w-5 shrink-0 text-sm font-bold text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{it.name}</span>
                <span className="block text-xs text-slate-500">
                  Đã đặt {it.sold} · dự kiến ~{it.total} phần (80%: {it.low}–{it.high})
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="flex items-center justify-end gap-1 font-bold text-ink">
                  {it.change === 'up' && <TrendingUp size={15} className="text-emerald-600" aria-label="tăng" />}
                  {it.change === 'down' && <TrendingDown size={15} className="text-red-600" aria-label="giảm" />}
                  Làm {it.make}
                </span>
                <span className="block text-[11px] text-slate-500">phần cả tuần</span>
              </span>
            </button>
            {open === it.key && (
              <ul className="forecast-pop mt-2 space-y-0.5 pl-8 text-xs text-slate-500">
                <li>• Đang dùng: mức bán gần đây</li>
                <li>• Theo mô hình (chưa tính đơn tuần này): ~{it.total} phần</li>
                <li>• Làm {it.make} phần thì khoảng {Math.round(level * 100)}% khả năng đủ hàng cho cả tuần</li>
              </ul>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Tới giờ này trong tuần, 4 tuần trước thường đã có khoảng <span className="font-semibold">60%</span> số phần của cả
        tuần. Càng gần cuối tuần, số dự kiến càng dựa vào đơn thật.
      </p>
    </section>
  );
}
