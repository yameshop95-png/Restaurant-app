// Dự báo tuần này khách sẽ mua món nào nhiều, chỉ từ dữ liệu bán của chính quán (không gọi dịch vụ ngoài).
// Cách làm và hướng cải tiến: xem docs/du-bao.md.
//
// 1. Mức nền mỗi món
//    - Món bán đều: san bằng mũ (simple exponential smoothing) F = α·Y + (1 − α)·F, α = 0,3.
//    - Món bán thưa (≥ 30% số tuần không bán): Croston, bản hiệu chỉnh SBA:
//      F = (1 − β/2) · z / p, z = số phần mỗi lần có bán (làm mượt), p = số tuần giữa hai lần bán (làm mượt), β = 0,2.
// 2. Hệ số nhân theo điều kiện của tuần: tuần trong tháng, mùa, tuần lương (2 tuần một lần), dịp lễ, thời tiết,
//    mùng 1 / Rằm âm lịch, ngày nghỉ lễ của NSW / VIC (Albury và Wodonga khác bang).
//    Hệ số = bán TB trong các tuần cùng điều kiện ÷ bán TB mọi tuần, co rút về 1: (n·hệ số + K) ÷ (n + K).
// 3. Tự chọn hệ số: thử dự báo lại các tuần đã qua (chỉ dùng dữ liệu trước tuần đó), đo sai số
//    WAPE = Σ|thực − dự báo| ÷ Σ thực, và chỉ giữ nhóm hệ số nào làm WAPE giảm rõ.
import { normalizeText } from './text';
import { periodRange } from './report';
import { lunarEventsOfYear, moonDays } from './lunar';

export const WEATHER = [
  { id: 'hot', label: 'Nóng' },
  { id: 'mild', label: 'Mát' },
  { id: 'cold', label: 'Lạnh' },
  { id: 'rain', label: 'Mưa' },
];
const SEASON_LABEL = { summer: 'mùa hè', autumn: 'mùa thu', winter: 'mùa đông', spring: 'mùa xuân' };
export const FAMILY_LABEL = {
  wom: 'tuần trong tháng',
  season: 'mùa',
  payday: 'tuần lương',
  holiday: 'dịp lễ',
  weather: 'thời tiết',
  moon: 'mùng 1 / Rằm',
  publicHol: 'nghỉ lễ NSW / VIC',
};
const FAMILIES = ['wom', 'season', 'payday', 'holiday', 'weather', 'moon', 'publicHol'];

export const PARAMS = {
  alpha: 0.3, // san bằng mũ
  beta: 0.2, // Croston
  intermittent: 0.3, // tỉ lệ tuần không bán để coi là món bán thưa
  shrink: 4, // K: độ co rút hệ số về 1
  minWeeks: 3, // ít nhất 3 tuần đã xong mới dự báo
  backtestWeeks: 16, // số tuần gần nhất dùng để chấm điểm
  minTrain: 4, // tuần cần có trước một tuần mới chấm được tuần đó
  keepIfBetter: 0.02, // giữ nhóm hệ số nếu WAPE giảm ít nhất 2 điểm % (chặt để tránh học nhầm từ nhiễu)
};

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const weekKey = (d) => ymd(periodRange('week', d).start);
const keyDate = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// ---------- Điều kiện của một tuần ----------
// Tuần thứ mấy trong tháng, theo ngày thứ Năm của tuần (tuần thuộc tháng có nhiều ngày hơn)
export const weekOfMonth = (start) => Math.min(5, Math.ceil(addDays(start, 3).getDate() / 7));
export const season = (start) => {
  const m = addDays(start, 3).getMonth();
  return m === 11 || m <= 1 ? 'summer' : m <= 4 ? 'autumn' : m <= 7 ? 'winter' : 'spring';
};
// Lương ở Úc thường trả 2 tuần một lần: chia tuần thành 2 nhóm xen kẽ A / B; app tự học nhóm nào khách mua nhiều hơn.
const EPOCH = new Date(2024, 0, 1); // thứ Hai
export const payWeek = (start) => (Math.round((start - EPOCH) / (7 * DAY)) % 2 === 0 ? 'A' : 'B');

function easterSunday(y) {
  // Thuật toán Gregory (Anonymous Gregorian algorithm)
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const nthSunday = (y, month, n) => {
  const first = new Date(y, month, 1);
  return addDays(first, ((7 - first.getDay()) % 7) + 7 * (n - 1));
};
// Các dịp trong năm (ngày chính). Tuần chứa ngày đó và tuần ngay trước (khách đặt trước) tính là "tuần dịp lễ".
export function eventsOfYear(y) {
  const list = [
    { id: 'newyear', label: 'Năm mới', date: new Date(y, 0, 1) },
    { id: 'ausday', label: 'Ngày Quốc khánh Úc', date: new Date(y, 0, 26) },
    { id: 'easter', label: 'Lễ Phục Sinh', date: easterSunday(y) },
    { id: 'mother', label: 'Ngày của Mẹ', date: nthSunday(y, 4, 2) },
    { id: 'father', label: 'Ngày của Cha', date: nthSunday(y, 8, 1) },
    { id: 'christmas', label: 'Giáng sinh', date: new Date(y, 11, 25) },
  ];
  // Tết, Rằm tháng 7 (Vu Lan), Trung thu: tính theo âm lịch Việt Nam (giờ UTC+7), không cần cập nhật tay
  list.push(...lunarEventsOfYear(y));
  return list;
}

// ---------- Âm lịch: mùng 1 và Rằm ----------
// Nhiều gia đình Việt mua giò chả để cúng mùng 1 / Rằm. Quán bán đặt trước và giao thứ 7, nên tính cả mùng 1 / Rằm
// rơi vào thứ Hai, thứ Ba ngay sau tuần (khách mua từ thứ 7 trước đó).
export function moonWeek(start) {
  return moonDays(start, addDays(start, 9)).length ? 'yes' : 'no';
}

// ---------- Ngày nghỉ lễ NSW / VIC ----------
// Albury (NSW) và Wodonga (VIC) nghỉ lễ khác nhau. Lễ rơi vào cuối tuần thì nghỉ bù thứ Hai (gần đúng).
const nthWeekday = (y, month, weekday, n) => {
  const first = new Date(y, month, 1);
  return addDays(first, ((weekday - first.getDay() + 7) % 7) + 7 * (n - 1));
};
const lastWeekday = (y, month, weekday) => {
  const last = new Date(y, month + 1, 0);
  return addDays(last, -((last.getDay() - weekday + 7) % 7));
};
const observed = (d) => (d.getDay() === 6 ? addDays(d, 2) : d.getDay() === 0 ? addDays(d, 1) : d);
// Giáng sinh / Boxing Day rơi vào cuối tuần thì nghỉ bù thứ Hai, thứ Ba
function christmasDays(y) {
  const day = new Date(y, 11, 25).getDay();
  if (day === 6) return [new Date(y, 11, 27), new Date(y, 11, 28)]; // thứ 7 → nghỉ bù thứ 2, thứ 3
  if (day === 0) return [new Date(y, 11, 27), new Date(y, 11, 26)]; // Chủ nhật → Giáng sinh bù thứ 3, Boxing thứ 2
  if (day === 5) return [new Date(y, 11, 25), new Date(y, 11, 28)]; // Boxing Day thứ 7 → bù thứ 2
  return [new Date(y, 11, 25), new Date(y, 11, 26)];
}
export function publicHolidays(y) {
  const easter = easterSunday(y);
  const [xmas, boxing] = christmasDays(y);
  return [
    { label: 'Năm mới', date: observed(new Date(y, 0, 1)), state: 'both' },
    { label: 'Quốc khánh Úc', date: observed(new Date(y, 0, 26)), state: 'both' },
    { label: 'Labour Day VIC', date: nthWeekday(y, 2, 1, 2), state: 'vic' },
    { label: 'Thứ Sáu Tuần Thánh', date: addDays(easter, -2), state: 'both' },
    { label: 'Thứ Hai Phục Sinh', date: addDays(easter, 1), state: 'both' },
    { label: 'Anzac Day', date: new Date(y, 3, 25), state: 'both' },
    { label: "King's Birthday", date: nthWeekday(y, 5, 1, 2), state: 'both' },
    { label: 'AFL Grand Final (VIC)', date: addDays(lastWeekday(y, 8, 6), -1), state: 'vic' },
    { label: 'Labour Day NSW', date: nthWeekday(y, 9, 1, 1), state: 'nsw' },
    { label: 'Melbourne Cup (VIC)', date: nthWeekday(y, 10, 2, 1), state: 'vic' },
    { label: 'Giáng sinh', date: xmas, state: 'both' },
    { label: 'Boxing Day', date: boxing, state: 'both' },
  ];
}
// Tuần (thứ Hai → Chủ nhật) có ngày nghỉ lễ của NSW hoặc VIC rơi vào ngày thường
export function publicHolidayWeek(start) {
  const end = addDays(start, 7);
  const hit = publicHolidays(start.getFullYear()).find((h) => h.date >= start && h.date < end && h.date.getDay() % 6 !== 0);
  return hit ? 'yes' : 'no';
}
// Dịp lễ của tuần (bắt đầu `start`): ngày lễ rơi vào tuần này hoặc tuần sau
export function holidayOf(start) {
  const end = addDays(start, 14);
  for (const y of [start.getFullYear(), start.getFullYear() + 1]) {
    // Tết không tính ở đây: đã có hệ số riêng tetPeak (tuần sát Tết), tránh nhân đôi
    for (const e of eventsOfYear(y)) if (e.id !== 'tet' && e.date >= start && e.date < end) return e;
  }
  return null;
}

function conditions(start, weatherLog) {
  const key = ymd(start);
  const h = holidayOf(start);
  return {
    wom: weekOfMonth(start),
    season: season(start),
    payday: payWeek(start),
    holiday: h ? h.id : null,
    weather: weatherLog[key] ?? null,
    moon: moonWeek(start),
    publicHol: publicHolidayWeek(start),
    tetPeak: tetPeakWeek(start),
  };
}

// Tuần cao điểm Tết: tuần có thứ 7 giao hàng cuối cùng trước (hoặc đúng) mùng 1 Tết
export function tetPeakWeek(start) {
  for (const y of [start.getFullYear(), start.getFullYear() + 1]) {
    const tet = lunarEventsOfYear(y).find((e) => e.id === 'tet')?.date;
    if (!tet) continue;
    const days = Math.round((tet - start) / DAY);
    if (days >= 5 && days < 12) return 'yes';
  }
  return 'no';
}

// ---------- Dữ liệu theo tuần ----------
// Trả về các tuần từ tuần có đơn đầu tiên tới tuần chứa `now` (tuần không có đơn tính là 0)
export function weeklySeries(orders, now, weatherLog = {}) {
  const byWeek = new Map();
  const names = new Map();
  for (const o of orders) {
    if (o.status === 'cancelled' || !o.createdAt) continue;
    const created = new Date(o.createdAt);
    if (created > now) continue;
    const wk = weekKey(created);
    const row = byWeek.get(wk) ?? new Map();
    for (const it of o.items ?? []) {
      const k = normalizeText(it.name ?? '');
      if (!k) continue;
      row.set(k, (row.get(k) ?? 0) + (Number(it.qty) || 0));
      names.set(k, it.name);
    }
    byWeek.set(wk, row);
  }
  const thisKey = weekKey(now);
  const keys = [...byWeek.keys()].sort();
  const weeks = [];
  if (keys.length) {
    for (let d = keyDate(keys[0]); ymd(d) <= thisKey; d = addDays(d, 7)) {
      const k = ymd(d);
      weeks.push({ key: k, start: d, qty: byWeek.get(k) ?? new Map(), cond: conditions(d, weatherLog), current: k === thisKey });
    }
  }
  return { weeks, names, thisKey };
}

// ---------- Mức nền ----------
function baseLevel(values, p = PARAMS) {
  if (!values.length) return { level: 0, method: 'ses' };
  const zeros = values.filter((v) => v <= 0).length / values.length;
  if (zeros >= p.intermittent && values.some((v) => v > 0)) {
    // Croston SBA
    let z = null;
    let q = null;
    let gap = 1;
    for (const v of values) {
      if (v > 0) {
        z = z == null ? v : p.beta * v + (1 - p.beta) * z;
        q = q == null ? gap : p.beta * gap + (1 - p.beta) * q;
        gap = 1;
      } else gap += 1;
    }
    return { level: z == null ? 0 : (1 - p.beta / 2) * (z / q), method: 'croston' };
  }
  let f = values[0];
  for (let i = 1; i < values.length; i += 1) f = p.alpha * values[i] + (1 - p.alpha) * f;
  return { level: f, method: 'ses' };
}

// Hệ số của một nhóm cho một món, học từ các tuần `train`
function familyFactor(dishKey, family, value, train, p = PARAMS) {
  if (value == null) return { f: 1, n: 0 };
  const same = train.filter((w) => w.cond[family] === value);
  if (!same.length) return { f: 1, n: 0 };
  const all = train.reduce((s, w) => s + (w.qty.get(dishKey) ?? 0), 0) / train.length;
  if (all <= 0) return { f: 1, n: same.length };
  const raw = same.reduce((s, w) => s + (w.qty.get(dishKey) ?? 0), 0) / same.length / all;
  return { f: (same.length * raw + p.shrink) / (same.length + p.shrink), n: same.length };
}

// Dự báo cho tuần `target` chỉ từ các tuần `train` (đã xong, trước target)
function predictWeek(train, target, dishKeys, families, p = PARAMS) {
  const out = new Map();
  for (const k of dishKeys) {
    const base = baseLevel(train.map((w) => w.qty.get(k) ?? 0), p);
    let mult = 1;
    const parts = [];
    for (const fam of families) {
      const ff = familyFactor(k, fam, target.cond[fam], train, p);
      mult *= ff.f;
      parts.push({ family: fam, value: target.cond[fam], ...ff });
    }
    out.set(k, { base: base.level, method: base.method, expected: base.level * mult, parts });
  }
  return out;
}

// Chấm điểm một bộ hệ số trên các tuần gần nhất: WAPE theo tổng phần của mọi món
function backtest(done, dishKeys, families, p = PARAMS) {
  const rows = [];
  const from = Math.max(p.minTrain, done.length - p.backtestWeeks);
  for (let i = from; i < done.length; i += 1) {
    const pred = predictWeek(done.slice(0, i), done[i], dishKeys, families, p);
    let predicted = 0;
    let actual = 0;
    let absErr = 0;
    for (const k of dishKeys) {
      const e = pred.get(k).expected;
      const a = done[i].qty.get(k) ?? 0;
      predicted += e;
      actual += a;
      absErr += Math.abs(a - e);
    }
    rows.push({ key: done[i].key, predicted, actual, absErr });
  }
  const sumA = rows.reduce((s, r) => s + r.actual, 0);
  const wape = sumA > 0 ? rows.reduce((s, r) => s + r.absErr, 0) / sumA : null;
  return { wape, rows };
}

// Chọn dần từng nhóm hệ số (forward selection): chỉ giữ nhóm làm WAPE giảm ít nhất keepIfBetter
function selectFamilies(done, dishKeys, p = PARAMS) {
  let chosen = [];
  let best = backtest(done, dishKeys, chosen, p);
  if (best.wape == null) return { chosen, best, tried: [] };
  const tried = [];
  let improved = true;
  while (improved) {
    improved = false;
    let pick = null;
    for (const fam of FAMILIES.filter((f) => !chosen.includes(f))) {
      const r = backtest(done, dishKeys, [...chosen, fam], p);
      tried.push({ family: fam, wape: r.wape, with: [...chosen] });
      if (r.wape != null && r.wape < best.wape - p.keepIfBetter && (!pick || r.wape < pick.r.wape)) pick = { fam, r };
    }
    if (pick) {
      chosen = [...chosen, pick.fam];
      best = pick.r;
      improved = true;
    }
  }
  return { chosen, best, tried };
}

const pct = (f) => `${f >= 1 ? '+' : '−'}${Math.round(Math.abs(f - 1) * 100)}%`;
const WEATHER_TEXT = { hot: 'nóng', mild: 'mát', cold: 'lạnh', rain: 'mưa' };
function reasonOf(part, label) {
  if (!part.n || Math.abs(part.f - 1) < 0.08) return null;
  switch (part.family) {
    case 'wom':
      return `Tuần ${part.value} trong tháng thường bán ${pct(part.f)}`;
    case 'season':
      return `${SEASON_LABEL[part.value]} thường bán ${pct(part.f)}`;
    case 'payday':
      return `Tuần nhóm ${part.value} (tuần lương xen kẽ) thường bán ${pct(part.f)}`;
    case 'holiday':
      return `Dịp ${label ?? 'lễ'} thường bán ${pct(part.f)} (${part.n} lần)`;
    case 'weather':
      return `Khi trời ${WEATHER_TEXT[part.value]} thường bán ${pct(part.f)} (${part.n} tuần)`;
    case 'moon':
      return part.value === 'yes'
        ? `Tuần có mùng 1 / Rằm âm lịch thường bán ${pct(part.f)} (${part.n} tuần)`
        : `Tuần không có mùng 1 / Rằm thường bán ${pct(part.f)}`;
    case 'publicHol':
      return part.value === 'yes'
        ? `Tuần có ngày nghỉ lễ NSW / VIC thường bán ${pct(part.f)} (${part.n} tuần)`
        : null;
    case 'tetPeak':
      return `Tuần sát Tết năm trước bán ${part.f >= 1 ? `gấp ${part.f.toFixed(1)} lần` : pct(part.f)} tuần thường`;
    default:
      return null;
  }
}

export function weeklyForecast({ orders, now, weatherLog = {} }) {
  const { weeks, names, thisKey } = weeklySeries(orders, now, weatherLog);
  const target = weeks.find((w) => w.current) ?? {
    key: thisKey,
    start: keyDate(thisKey),
    qty: new Map(),
    cond: conditions(keyDate(thisKey), weatherLog),
    current: true,
  };
  // Tuần cả quán không có đơn nào = quán nghỉ (VD tháng 6–11/2026): bỏ qua, không tính là bán 0 phần
  const done = weeks.filter((w) => !w.current && w.qty.size > 0);
  const notes = [];
  const tet = [target.start.getFullYear(), target.start.getFullYear() + 1]
    .flatMap((y) => lunarEventsOfYear(y))
    .filter((e) => e.id === 'tet')
    .map((e) => e.date)
    .find((t) => t >= target.start && t - target.start <= 28 * DAY);
  const moon = moonDays(target.start, addDays(target.start, 9));
  if (moon.length) {
    notes.push(
      `${moon.map((m) => `${m.kind === 'ram' ? 'Rằm' : 'Mùng 1'} tháng ${m.lunarMonth} âm lịch là ${['Chủ nhật', 'thứ 2', 'thứ 3', 'thứ 4', 'thứ 5', 'thứ 6', 'thứ 7'][m.date.getDay()]} ${m.date.getDate()}/${m.date.getMonth() + 1}`).join('; ')}: khách Việt hay mua giò chả để cúng.`,
    );
  }
  const ph = publicHolidays(target.start.getFullYear()).filter((h) => h.date >= target.start && h.date < addDays(target.start, 7));
  if (ph.length) notes.push(`Tuần này có ngày nghỉ: ${ph.map((h) => `${h.label} ${h.date.getDate()}/${h.date.getMonth() + 1}`).join(', ')}.`);
  if (tet) notes.push(`Còn ${Math.max(0, Math.round((tet - now) / DAY))} ngày nữa là Tết (${tet.getDate()}/${tet.getMonth() + 1}): nhớ chuẩn bị bánh chưng, bánh tét.`);
  const holiday = holidayOf(target.start);
  if (holiday && holiday.id !== 'tet') notes.push(`Tuần này hoặc tuần sau có ${holiday.label} (${holiday.date.getDate()}/${holiday.date.getMonth() + 1}).`);

  const base = { weekStart: target.start, weekKey: thisKey, conditions: target.cond, notes };
  if (done.length < PARAMS.minWeeks) {
    return { ...base, ready: false, weeksUsed: done.length, minWeeks: PARAMS.minWeeks, items: [], accuracy: null, families: [] };
  }

  const dishKeys = [...names.keys()];
  const sel = selectFamilies(done, dishKeys);
  const pred = predictWeek(done, target, dishKeys, sel.chosen);
  // Tết mỗi năm chỉ 1 tuần nên backtest không kịp học: có tuần Tết năm trước thì áp thẳng tỉ lệ bán của tuần đó
  const tetWeeks = done.filter((w) => w.cond.tetPeak === 'yes');
  if (target.cond.tetPeak === 'yes' && tetWeeks.length) {
    let before = 0;
    let after = 0;
    for (const k of dishKeys) {
      const r = pred.get(k);
      const normal = done.filter((w) => w.cond.tetPeak !== 'yes');
      const avg = normal.reduce((a, w) => a + (w.qty.get(k) ?? 0), 0) / Math.max(1, normal.length);
      const tet = tetWeeks.reduce((a, w) => a + (w.qty.get(k) ?? 0), 0) / tetWeeks.length;
      // Kẹp hệ số tối đa 5 lần: món ít bán quanh năm không được phóng đại vì vài đơn Tết
      const f = avg > 0 ? (tetWeeks.length * (tet / avg) + 1) / (tetWeeks.length + 1) : 1;
      before += r.expected;
      if (avg >= 0.5) {
        // Món bán đều quanh năm: nhân hệ số Tết (kẹp tối đa 5 lần cho chắc)
        r.expected *= Math.min(5, f);
        r.parts.push({ family: 'tetPeak', value: 'yes', f: Math.min(5, f), n: tetWeeks.length });
      } else if (tet > 0) {
        // Món gần như chỉ bán dịp Tết (bánh chưng, bánh tét...): lấy đúng số đã bán tuần Tết năm trước
        r.expected = tet;
        r.parts.push({ family: 'tetOnly', value: 'yes', f: 1, n: 0 });
      }
      after += r.expected;
    }
    if (before > 0) notes.push(`Tuần sát Tết: năm trước tuần này bán gấp khoảng ${(after / before).toFixed(1)} lần tuần thường, số dự báo đã tính thêm.`);
  }
  const items = [];
  for (const k of dishKeys) {
    const r = pred.get(k);
    const sold = target.qty.get(k) ?? 0;
    if (r.expected <= 0.05 && sold <= 0) continue;
    const last8 = done.slice(-8).map((w) => w.qty.get(k) ?? 0);
    const mean = last8.reduce((a, b) => a + b, 0) / last8.length;
    const sd = Math.sqrt(last8.reduce((s, x) => s + (x - mean) ** 2, 0) / last8.length);
    const reasons = [
      r.method === 'croston'
        ? `Món bán không đều: trung bình khoảng ${Math.round(r.base * 10) / 10} phần/tuần (Croston)`
        : `Mức gần đây: khoảng ${Math.round(r.base * 10) / 10} phần/tuần`,
      ...r.parts.map((part) => reasonOf(part, part.family === 'holiday' ? holiday?.label : null)).filter(Boolean),
    ];
    items.push({
      key: k,
      name: names.get(k),
      expected: r.expected,
      low: Math.max(0, r.expected - sd),
      high: r.expected + sd,
      base: r.base,
      method: r.method,
      change: r.base > 0 ? r.expected / r.base : null,
      soldSoFar: sold,
      reasons,
    });
  }
  items.sort((a, b) => b.expected - a.expected);
  return {
    ...base,
    ready: true,
    weeksUsed: done.length,
    weekOfMonth: target.cond.wom,
    season: SEASON_LABEL[target.cond.season],
    weather: target.cond.weather,
    families: sel.chosen,
    accuracy: sel.best.wape == null ? null : { wape: sel.best.wape, weeks: sel.best.rows.length, rows: sel.best.rows },
    tried: sel.tried,
    items,
  };
}
