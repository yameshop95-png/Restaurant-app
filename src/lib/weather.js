// Gợi ý chip thời tiết (Nóng / Mát / Lạnh / Mưa) từ các dòng weather_daily của đúng tuần
// mà chip đang lưu (weekKey, thứ Hai → Chủ nhật). Không gọi API thời tiết từ trình duyệt.
//
// Ngưỡng (Wodonga, nhiệt độ là °C của temp_max):
// - Cần ít nhất 3 ngày có temp_max. Thiếu hơn thì không gợi ý — ô dự báo giữ như khi chưa có thời tiết.
// - Mưa trước, vì bốn chip chỉ chọn một: tổng precipitation_mm ≥ 10, hoặc ≥ 2 ngày có mưa
//   (precipitation_mm ≥ 1, hoặc weather_code thuộc nhóm mưa/mưa phùn/giông).
// - Không mưa: trung bình temp_max của các ngày đó, làm tròn số nguyên.
//   ≥ 30 → Nóng, ≥ 18 → Mát, còn lại → Lạnh.
//   30°C và 18°C chia gần với ngày hè / ngày mát của Wodonga (hè thường ~30–32°C, đông ~12–15°C).

export const WEATHER_THRESHOLDS = {
  minDays: 3,
  rainTotalMm: 10,
  rainDayMm: 1,
  rainDays: 2,
  hotMin: 30,
  mildMin: 18,
};

const PHRASE = { hot: 'nắng nóng', mild: 'mát', cold: 'lạnh', rain: 'có mưa' };
const LABEL = { hot: 'Nóng', mild: 'Mát', cold: 'Lạnh', rain: 'Mưa' };
const CREDIT = { forecast: 'MET Norway', archive: 'NASA POWER' };

const SYMBOLS = [
  ['heavyrainshowersandthunder', 95, 'Giông'],
  ['heavyrainandthunder', 95, 'Giông'],
  ['heavysleetandthunder', 95, 'Giông'],
  ['rainshowersandthunder', 95, 'Giông'],
  ['lightrainandthunder', 95, 'Giông'],
  ['lightrainshowers', 61, 'Mưa nhỏ'],
  ['heavyrainshowers', 65, 'Mưa to'],
  ['heavysnowshowers', 86, 'Tuyết'],
  ['lightsnowshowers', 85, 'Tuyết'],
  ['rainshowers', 80, 'Mưa rào'],
  ['snowshowers', 85, 'Tuyết'],
  ['partlycloudy', 2, 'Có mây'],
  ['heavyrain', 65, 'Mưa to'],
  ['lightrain', 61, 'Mưa nhỏ'],
  ['heavysnow', 75, 'Tuyết'],
  ['lightsnow', 71, 'Tuyết'],
  ['clearsky', 0, 'Nắng'],
  ['cloudy', 3, 'Nhiều mây'],
  ['sleet', 71, 'Tuyết'],
  ['snow', 73, 'Tuyết'],
  ['fair', 1, 'Nắng'],
  ['rain', 63, 'Mưa'],
  ['fog', 45, 'Sương mù'],
];

export function addIsoDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function melbourneDate(instant, timeZone = 'Australia/Melbourne') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function melbourneToday(now = new Date()) {
  return melbourneDate(now);
}

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > -100 ? n : null;
}

export function isRainCode(code) {
  const n = Number(code);
  if (!Number.isInteger(n)) return false;
  return (n >= 51 && n <= 67) || (n >= 80 && n <= 82) || (n >= 95 && n <= 99);
}

// Mã WMO (Open-Meteo và symbol MET Norway quy về cùng các mã này) → nhãn tiếng Việt ngắn.
export function conditionFromWmo(code) {
  const n = Number(code);
  if (!Number.isInteger(n)) return null;
  if (n === 0 || n === 1) return 'Nắng';
  if (n === 2) return 'Có mây';
  if (n === 3) return 'Nhiều mây';
  if (n === 45 || n === 48) return 'Sương mù';
  if (n >= 51 && n <= 57) return 'Mưa phùn';
  if (n === 61 || n === 80) return 'Mưa nhỏ';
  if (n === 63 || n === 81) return 'Mưa';
  if (n === 65 || n === 82) return 'Mưa to';
  if (n === 66 || n === 67) return 'Mưa băng';
  if ((n >= 71 && n <= 77) || n === 85 || n === 86) return 'Tuyết';
  if (n === 95 || n === 96 || n === 99) return 'Giông';
  return null;
}

export function describeSymbol(symbolCode) {
  if (!symbolCode) return null;
  const base = String(symbolCode).replace(/_(day|night|polartwilight)$/, '');
  const hit = SYMBOLS.find(([name]) => name === base);
  if (!hit) return null;
  return { weatherCode: hit[1], condition: hit[2] };
}

export function conditionFromObservation({ precipMm, tempMax }) {
  if (precipMm >= 5) return 'Mưa';
  if (precipMm >= 1) return 'Mưa nhỏ';
  if (tempMax >= 30) return 'Nắng';
  return 'Không mưa';
}

function bandOf(meanMax) {
  const rounded = Math.round(meanMax);
  if (rounded >= WEATHER_THRESHOLDS.hotMin) return 'hot';
  if (rounded >= WEATHER_THRESHOLDS.mildMin) return 'mild';
  return 'cold';
}

export function suggestWeekWeather(rows, weekStart) {
  if (!weekStart || !Array.isArray(rows)) return null;
  const end = addIsoDays(weekStart, 6);
  const days = [];
  for (const row of rows) {
    const date = String(row?.date ?? '').slice(0, 10);
    if (date < weekStart || date > end) continue;
    const tempMax = num(row.temp_max);
    if (tempMax == null) continue;
    const precip = num(row.precipitation_mm) ?? 0;
    days.push({
      tempMax,
      precip,
      wet: precip >= WEATHER_THRESHOLDS.rainDayMm || isRainCode(row.weather_code),
      source: row.source,
    });
  }
  if (days.length < WEATHER_THRESHOLDS.minDays) return null;

  const meanMax = days.reduce((sum, d) => sum + d.tempMax, 0) / days.length;
  const precipMm = days.reduce((sum, d) => sum + d.precip, 0);
  const wetDays = days.filter((d) => d.wet).length;
  const rainy = precipMm >= WEATHER_THRESHOLDS.rainTotalMm || wetDays >= WEATHER_THRESHOLDS.rainDays;
  const id = rainy ? 'rain' : bandOf(meanMax);
  const credits = [];
  if (days.some((d) => d.source === 'forecast')) credits.push(CREDIT.forecast);
  if (days.some((d) => d.source === 'archive')) credits.push(CREDIT.archive);

  return { id, meanMax, precipMm, days: days.length, credits };
}

export function describeSuggestion(suggestion, { stored = null, canEdit = false } = {}) {
  if (!suggestion || !PHRASE[suggestion.id]) return null;
  const temp = Math.round(suggestion.meanMax);
  const extra = suggestion.id === 'rain' ? `, ${Math.round(suggestion.precipMm)} mm` : '';
  let line = `Tuần này ${PHRASE[suggestion.id]} (~${temp}°C${extra}).`;
  if (stored && stored !== suggestion.id && LABEL[stored]) line += ` Đang chọn ${LABEL[stored]}.`;
  else if (!stored) line += canEdit ? ' Gợi ý — bấm để đổi.' : ' Gợi ý.';
  if (suggestion.credits?.length) line += ` Nguồn: ${suggestion.credits.join(', ')}.`;
  return line;
}
