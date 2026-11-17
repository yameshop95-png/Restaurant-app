// Lấy thời tiết Wodonga một lần mỗi ngày, upsert weather_daily, rồi tự chọn chip tuần
// vào shop_settings.data.weatherLog. Ngưỡng chip nằm ở src/lib/weather.js, không viết lại ở đây.
// Chuỗi 'hot'|'mild'|'cold'|'rain' và { source: 'manual' } là lựa chọn tay, không bị ghi đè.
// Job ghi { value, source: 'auto' } và cập nhật mỗi ngày. Tuần đã qua chỉ chốt bằng dòng archive.
//
//   node scripts/weather-daily.mjs
//   node scripts/weather-daily.mjs --from=YYYY-MM-DD
//   node scripts/weather-daily.mjs --from=YYYY-MM-DD --dry-run
//
// --from điền các tuần đã qua có đơn (bỏ tuần đã chọn tay). --dry-run in kế hoạch, không ghi.
// Không chạy khi import (test gọi các hàm thuần). Không đọc file .env trong repo.
//
// Nguồn đang dùng (được phép dùng cho quán, có ghi nguồn):
//   forecast → MET Norway Locationforecast 2.0 (NLOD 2.0 và CC BY 4.0)
//   archive  → NASA POWER daily, time-standard=LST (CC BY 4.0)
// Open-Meteo không được gọi. API miễn phí của họ chỉ cho việc phi thương mại.
// Gói Standard USD 29/tháng cho phép dùng thương mại nhưng không gồm API lịch sử.
// Muốn vừa dự báo vừa archive trên Open-Meteo thì cần gói Professional USD 99/tháng.
// BOM: bản anonymous ghi rõ không dùng cho việc thương mại.
//
// Toạ độ chỉ lấy tâm thành phố Wodonga, làm tròn 2 số lẻ. Không dùng địa chỉ nhà.
// Ngày là lịch Australia/Melbourne. Dòng archive ghi đè dòng forecast cùng ngày.

import { pathToFileURL } from 'node:url';
import {
  addIsoDays,
  conditionFromObservation,
  describeSymbol,
  formatWeatherPlan,
  isRainCode,
  melbourneDate,
  melbourneToday,
  nextShopData,
  planWeatherLogUpdates,
  weeksToLabel,
} from '../src/lib/weather.js';

export const WODONGA = { latitude: -36.12, longitude: 146.89 };
const TIMEZONE = 'Australia/Melbourne';
const FORECAST_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const ARCHIVE_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const ARCHIVE_CHUNK_DAYS = 120;
const DEFAULT_ARCHIVE_LOOKBACK = 16;

const round1 = (n) => Math.round(n * 10) / 10;

function userAgent() {
  return process.env.WEATHER_USER_AGENT || 'restaurant-dashboard/0.1 (Wodonga VIC daily weather log)';
}

export async function getJson(url, { attempts = 3, timeoutMs = 20000, headers = {} } = {}) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return await res.json();
      const err = new Error(`HTTP ${res.status}`);
      if (res.status !== 429 && res.status < 500) throw Object.assign(err, { permanent: true });
      last = err;
    } catch (err) {
      if (err?.permanent) throw err;
      last = err;
    }
    if (i + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** i));
  }
  throw last instanceof Error ? last : new Error('fetch failed');
}

function shortestPeriod(data) {
  if (!data) return null;
  if (data.next_1_hours) return data.next_1_hours;
  if (data.next_6_hours) return data.next_6_hours;
  if (data.next_12_hours) return data.next_12_hours;
  return null;
}

function melbourneHour(iso) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
}

// Gom chuỗi giờ của MET Norway thành từng ngày Melbourne.
// Lượng mưa lấy khoảng ngắn nhất của mỗi mốc (next_1 nếu có, nếu không thì next_6, rồi next_12)
// để không cộng trùng giờ và 6 giờ trên cùng một mốc.
export function aggregateMet(payload) {
  const series = Array.isArray(payload) ? payload : payload?.properties?.timeseries;
  if (!Array.isArray(series)) throw new Error('MET Norway response has no timeseries');
  const byDate = new Map();
  for (const step of series) {
    if (!step?.time) continue;
    const date = melbourneDate(step.time, TIMEZONE);
    const temp = Number(step.data?.instant?.details?.air_temperature);
    const period = shortestPeriod(step.data);
    const precip = Number(period?.details?.precipitation_amount);
    const symbol = period?.summary?.symbol_code ?? null;
    const bucket = byDate.get(date) ?? { temps: [], precip: 0, wettest: -1, wetSymbol: null, afternoon: null };
    if (Number.isFinite(temp)) bucket.temps.push(temp);
    if (Number.isFinite(precip) && precip > 0) {
      bucket.precip += precip;
      if (precip > bucket.wettest) {
        bucket.wettest = precip;
        bucket.wetSymbol = symbol;
      }
    }
    const hour = melbourneHour(step.time);
    if (symbol && (bucket.afternoon == null || Math.abs(hour - 15) < Math.abs(bucket.afternoon.hour - 15))) {
      bucket.afternoon = { hour, symbol };
    }
    byDate.set(date, bucket);
  }

  const rows = [];
  for (const [date, bucket] of byDate) {
    if (!bucket.temps.length) continue;
    const tempMax = Math.max(...bucket.temps);
    const tempMin = Math.min(...bucket.temps);
    const precipMm = round1(bucket.precip);
    const sky = describeSymbol(bucket.afternoon?.symbol);
    const wet = describeSymbol(bucket.wetSymbol);
    const described = precipMm >= 1 ? (wet ?? sky) : sky;
    let weatherCode = described?.weatherCode ?? null;
    let condition = described?.condition ?? conditionFromObservation({ precipMm, tempMax });
    // Nhiều cơn nhỏ cộng lại thành ngày mưa dù từng giờ không gắn symbol mưa.
    if (precipMm >= 1 && !isRainCode(weatherCode)) {
      condition = conditionFromObservation({ precipMm, tempMax });
      weatherCode = precipMm >= 5 ? 63 : 61;
    }
    rows.push({
      date,
      temp_max: round1(tempMax),
      temp_min: round1(tempMin),
      precipitation_mm: precipMm,
      weather_code: weatherCode,
      condition,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function parsePower(payload) {
  const parameter = payload?.properties?.parameter;
  const fill = Number(payload?.header?.fill_value ?? -999);
  const max = parameter?.T2M_MAX;
  const min = parameter?.T2M_MIN;
  const precip = parameter?.PRECTOTCORR;
  if (!max || !min || !precip) throw new Error('NASA POWER response is missing daily parameters');
  const rows = [];
  for (const key of Object.keys(max)) {
    if (!/^\d{8}$/.test(key)) continue;
    const tempMax = Number(max[key]);
    const tempMin = Number(min[key]);
    const precipMm = Number(precip[key]);
    if (![tempMax, tempMin, precipMm].every((n) => Number.isFinite(n) && n !== fill && n > -100)) continue;
    const date = `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
    rows.push({
      date,
      temp_max: round1(tempMax),
      temp_min: round1(tempMin),
      precipitation_mm: round1(Math.max(0, precipMm)),
      weather_code: null,
      condition: conditionFromObservation({ precipMm, tempMax }),
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeDaily(forecastRows, archiveRows) {
  const byDate = new Map();
  for (const row of forecastRows ?? []) byDate.set(row.date, { ...row, source: 'forecast' });
  for (const row of archiveRows ?? []) byDate.set(row.date, { ...row, source: 'archive' });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function readArgs(argv) {
  const from = argv.find((arg) => arg.startsWith('--from='))?.slice('--from='.length) ?? null;
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error('--from must be YYYY-MM-DD');
  return { from, dryRun: argv.includes('--dry-run') };
}

function forecastUrl() {
  const url = new URL(FORECAST_URL);
  url.searchParams.set('lat', String(WODONGA.latitude));
  url.searchParams.set('lon', String(WODONGA.longitude));
  return url;
}

function archiveUrl(startIso, endIso) {
  const url = new URL(ARCHIVE_URL);
  url.searchParams.set('parameters', 'T2M_MAX,T2M_MIN,PRECTOTCORR');
  url.searchParams.set('community', 'RE');
  url.searchParams.set('longitude', String(WODONGA.longitude));
  url.searchParams.set('latitude', String(WODONGA.latitude));
  url.searchParams.set('start', startIso.replaceAll('-', ''));
  url.searchParams.set('end', endIso.replaceAll('-', ''));
  url.searchParams.set('format', 'JSON');
  url.searchParams.set('time-standard', 'LST');
  return url;
}

async function fetchForecast(today) {
  const payload = await getJson(forecastUrl(), {
    headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
  });
  return aggregateMet(payload).filter((row) => row.date >= today);
}

async function fetchArchive(startIso, endIso) {
  const rows = [];
  for (let cursor = startIso; cursor <= endIso; ) {
    const chunkEnd = addIsoDays(cursor, ARCHIVE_CHUNK_DAYS - 1);
    const end = chunkEnd < endIso ? chunkEnd : endIso;
    const payload = await getJson(archiveUrl(cursor, end), { headers: { Accept: 'application/json', 'User-Agent': userAgent() } });
    rows.push(...parsePower(payload).filter((row) => row.date >= startIso && row.date <= endIso));
    cursor = addIsoDays(end, 1);
  }
  return rows;
}

function supabaseConfig() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Refusing to run.');
  if (!base.startsWith('https://')) throw new Error('SUPABASE_URL must be https');
  return { base, key };
}

async function supabaseFetch(url, options = {}) {
  const { key } = supabaseConfig();
  let last;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          ...options.headers,
        },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        if (res.status === 204) return null;
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      }
      const text = await res.text();
      const err = new Error(`Supabase HTTP ${res.status}: ${text.slice(0, 180)}`);
      if (res.status !== 429 && res.status < 500) throw Object.assign(err, { permanent: true });
      last = err;
    } catch (err) {
      if (err?.permanent) throw err;
      last = err;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw last instanceof Error ? last : new Error('Supabase request failed');
}

async function upsert(rows) {
  const { base } = supabaseConfig();
  const fetchedAt = new Date().toISOString();
  const url = `${base}/rest/v1/weather_daily?on_conflict=date`;
  for (let i = 0; i < rows.length; i += 500) {
    const body = rows.slice(i, i + 500).map((row) => ({ ...row, fetched_at: fetchedAt }));
    await supabaseFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body),
    });
  }
}

async function readShopSettings() {
  const { base } = supabaseConfig();
  const rows = await supabaseFetch(`${base}/rest/v1/shop_settings?id=eq.1&select=id,data`);
  const row = rows?.[0];
  if (!row) throw new Error('shop_settings id 1 was not found');
  return row;
}

export function orderMelbourneDates(rows) {
  const dates = [];
  for (const row of rows ?? []) {
    if (row.status === 'cancelled') continue;
    const raw = row.createdAt;
    const instant = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(raw) ? raw : row.created_at;
    if (instant) dates.push(melbourneDate(instant));
  }
  return dates;
}

async function readOrderDates() {
  const { base } = supabaseConfig();
  const dates = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await supabaseFetch(
      `${base}/rest/v1/orders?select=created_at,createdAt:data->>createdAt,status:data->>status&order=created_at.asc&limit=1000&offset=${offset}`,
    );
    dates.push(...orderMelbourneDates(page));
    if (!page || page.length < 1000) break;
  }
  return dates;
}

// Đọc lại ngay trước khi ghi. Chỉ ghép các khoá weatherLog của job; field khác giữ nguyên.
async function writeWeatherLog(updates) {
  if (!Object.keys(updates).length) return [];
  const row = await readShopSettings();
  const { data, written } = nextShopData(row.data, updates);
  if (!written.length) return [];
  const { base } = supabaseConfig();
  await supabaseFetch(`${base}/rest/v1/shop_settings?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ data }),
  });
  return written;
}

export async function main(argv = process.argv.slice(2)) {
  const { from, dryRun } = readArgs(argv);
  supabaseConfig();
  const today = melbourneToday();
  const archiveStart = from ?? addIsoDays(today, -DEFAULT_ARCHIVE_LOOKBACK);
  const errors = [];
  let forecastRows = [];
  let archiveRows = [];
  try {
    forecastRows = await fetchForecast(today);
  } catch (err) {
    errors.push(`forecast: ${err.message}`);
  }
  try {
    archiveRows = await fetchArchive(archiveStart, today);
  } catch (err) {
    errors.push(`archive: ${err.message}`);
  }
  const rows = mergeDaily(forecastRows, archiveRows);
  const shop = await readShopSettings();
  const orderDates = from ? await readOrderDates() : null;
  const weeks = weeksToLabel({ today, from, orderDates });
  const plan = planWeatherLogUpdates({ log: shop.data?.weatherLog, rows, weeks });
  console.log(formatWeatherPlan({ rows, ...plan, dryRun }));
  const applied = await applyPlan({
    dryRun,
    rows,
    updates: plan.updates,
    writeDaily: upsert,
    writeLog: writeWeatherLog,
  });
  if (!dryRun) console.log(`weatherLog đã ghi ${applied.keys.length} tuần`);
  if (errors.length) throw new Error(errors.join('; '));
}

export async function applyPlan({ dryRun, rows, updates, writeDaily, writeLog }) {
  if (dryRun) return { written: false, keys: [] };
  if (rows?.length) await writeDaily(rows);
  const keys = updates && Object.keys(updates).length ? await writeLog(updates) : [];
  return { written: true, keys };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
