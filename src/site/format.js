// Định dạng giờ, định lượng, điện thoại cho website (tiếng Anh kiểu Úc). Không đổi dữ liệu trong máy chủ.

export function formatClock(hhmm, lang = 'en') {
  const raw = String(hhmm ?? '').trim();
  if (lang !== 'en') return raw;
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return raw;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return raw;
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return min === 0 ? `${h12} ${suffix}` : `${h12}:${m[2]} ${suffix}`;
}

export function formatLead(minutes, lang = 'en') {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n < 0) return lang === 'vi' ? '0 phút' : '0 minutes';
  if (n % 60 === 0) {
    const h = n / 60;
    if (lang === 'vi') return h === 1 ? '1 giờ' : `${h} giờ`;
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  return lang === 'vi' ? `${n} phút` : `${n} minutes`;
}

// "500g" / "1kg" → "500 g" / "1 kg". Trên trang tiếng Anh, "1 cái" thành "1 piece".
export function formatPortion(raw, lang = 'en') {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (lang === 'en' && /^1\s*cái$/i.test(s)) return '1 piece';
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)$/i);
  if (m) return `${m[1]} ${m[2].toLowerCase()}`;
  return s;
}

export function formatPhoneDisplay(phone) {
  const d = String(phone ?? '').replace(/\D/g, '');
  const local = d.startsWith('61') ? `0${d.slice(2)}` : d;
  if (/^04\d{8}$/.test(local)) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return String(phone ?? '');
}

export function formatPhoneTel(phone) {
  const d = String(phone ?? '').replace(/\D/g, '');
  if (d.startsWith('0')) return `+61${d.slice(1)}`;
  if (d.startsWith('61')) return `+${d}`;
  return d ? `+${d}` : '';
}

export function formatAddressDisplay(address) {
  const raw = String(address ?? '').trim();
  const plain = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
  if (plain === 'west wodonga') return 'West Wodonga';
  return raw;
}

export function zoneDisplayName(name) {
  return String(name ?? '').replace(/\s[–—-]\s/g, ' & ');
}

// Giờ đến lấy: 6:00–21:00, thứ 7 và cả những ngày khác theo yêu cầu.
export const PICKUP_OPEN = '06:00';
export const PICKUP_CLOSE = '21:00';
const SLOT_MINUTES = 30;

function minsOf(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const pad = (n) => String(n).padStart(2, '0');

export function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function timeKey(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function timeSlots() {
  const out = [];
  for (let mins = minsOf(PICKUP_OPEN); mins <= minsOf(PICKUP_CLOSE); mins += SLOT_MINUTES) {
    out.push(`${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`);
  }
  return out;
}

function atTime(day, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
}

function roundUpToSlot(date) {
  const d = new Date(date);
  const partial = d.getSeconds() !== 0 || d.getMilliseconds() !== 0;
  d.setSeconds(0, 0);
  let mins = d.getHours() * 60 + d.getMinutes();
  if (partial) mins += 1;
  const snapped = Math.ceil(mins / SLOT_MINUTES) * SLOT_MINUTES;
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + Math.floor(snapped / (24 * 60)),
    0,
    snapped % (24 * 60),
    0,
    0,
  );
}

export function earliestReady(now, leadMinutes) {
  const lead = Number(leadMinutes);
  const mins = Number.isFinite(lead) ? lead : 0;
  return roundUpToSlot(new Date(now.getTime() + mins * 60000));
}

export function slotsForDay(day, earliest) {
  return timeSlots().filter((t) => atTime(day, t).getTime() >= earliest.getTime());
}

// Mặc định: thứ 7 từ 6:00 (hoặc muộn hơn trong thứ 7 đó nếu chưa đủ giờ đặt trước).
export function defaultPickup(now, leadMinutes) {
  const earliest = earliestReady(now, leadMinutes);
  for (let i = 0; i < 21; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (day.getDay() !== 6) continue;
    const slots = slotsForDay(day, earliest);
    if (slots.length) return atTime(day, slots[0]);
  }
  const fallback = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const add = (6 - fallback.getDay() + 7) % 7 || 7;
  fallback.setDate(fallback.getDate() + add);
  return atTime(fallback, PICKUP_OPEN);
}

export function pickupDays(now, leadMinutes, span = 14) {
  const earliest = earliestReady(now, leadMinutes);
  const days = [];
  for (let i = 0; i < span; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (slotsForDay(day, earliest).length) days.push(day);
  }
  return days;
}

export function parseDateKey(key) {
  const [y, m, d] = String(key ?? '').split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isSaturdayKey(key) {
  return parseDateKey(key).getDay() === 6;
}
