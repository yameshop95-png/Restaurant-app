import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { aggregateMet, applyPlan, mergeDaily, orderMelbourneDates, parsePower, readArgs } from './weather-daily.mjs';
import { formatWeatherPlan } from '../src/lib/weather.js';

test('MET aggregation sums the shortest precip interval and uses the Melbourne date', () => {
  const rows = aggregateMet({
    properties: {
      timeseries: [
        {
          time: '2026-11-17T04:00:00Z',
          data: {
            instant: { details: { air_temperature: 16 } },
            next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0.2 } },
            next_6_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 9 } },
          },
        },
        {
          time: '2026-11-17T05:00:00Z',
          data: {
            instant: { details: { air_temperature: 22.26 } },
            next_1_hours: { summary: { symbol_code: 'fair_day' }, details: { precipitation_amount: 0 } },
          },
        },
        {
          time: '2026-11-20T00:00:00Z',
          data: {
            instant: { details: { air_temperature: 18 } },
            next_6_hours: { summary: { symbol_code: 'heavyrain' }, details: { precipitation_amount: 13.2 } },
          },
        },
        {
          time: '2026-11-18T03:00:00Z',
          data: {
            instant: { details: { air_temperature: 24 } },
            next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0.6 } },
          },
        },
        {
          time: '2026-11-18T04:00:00Z',
          data: {
            instant: { details: { air_temperature: 25 } },
            next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0.6 } },
          },
        },
      ],
    },
  });
  assert.equal(rows[0].date, '2026-11-17');
  assert.equal(rows[0].temp_max, 22.3);
  assert.equal(rows[0].temp_min, 16);
  assert.equal(rows[0].precipitation_mm, 0.2);
  assert.equal(rows[0].condition, 'Nắng');
  const drizzle = rows.find((row) => row.date === '2026-11-18');
  assert.equal(drizzle.precipitation_mm, 1.2);
  assert.equal(drizzle.condition, 'Mưa nhỏ');
  assert.equal(drizzle.weather_code, 61);
  const heavy = rows.find((row) => row.date === '2026-11-20');
  assert.equal(heavy.precipitation_mm, 13.2);
  assert.equal(heavy.condition, 'Mưa to');
  assert.equal(heavy.weather_code, 65);
});

test('NASA POWER skips the fill value and formats the date', () => {
  const rows = parsePower({
    header: { fill_value: -999 },
    properties: {
      parameter: {
        T2M_MAX: { '20261101': 23.94, '20261102': -999 },
        T2M_MIN: { '20261101': 11.43, '20261102': 10 },
        PRECTOTCORR: { '20261101': 0.01, '20261102': 4 },
      },
    },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, '2026-11-01');
  assert.equal(rows[0].temp_max, 23.9);
  assert.equal(rows[0].precipitation_mm, 0);
  assert.equal(rows[0].condition, 'Không mưa');
  assert.equal(rows[0].weather_code, null);
});

test('archive rows overwrite forecast rows for the same date', () => {
  const merged = mergeDaily(
    [{ date: '2026-11-16', temp_max: 20, condition: 'Nắng' }, { date: '2026-11-17', temp_max: 31, condition: 'Nắng' }],
    [{ date: '2026-11-16', temp_max: 18.2, condition: 'Không mưa' }],
  );
  assert.deepEqual(
    merged.map((row) => [row.date, row.source, row.temp_max]),
    [
      ['2026-11-16', 'archive', 18.2],
      ['2026-11-17', 'forecast', 31],
    ],
  );
});

test('cancelled orders do not mark a week, and createdAt wins over created_at', () => {
  const dates = orderMelbourneDates([
    { status: 'done', createdAt: '2026-11-03T02:00:00Z', created_at: '2026-11-01T02:00:00Z' },
    { status: 'cancelled', createdAt: '2026-11-10T02:00:00Z' },
    { status: 'done', createdAt: null, created_at: '2026-11-18T02:00:00Z' },
  ]);
  assert.deepEqual(dates, ['2026-11-03', '2026-11-18']);
});

test('backfill start date must be an ISO date', () => {
  assert.equal(readArgs(['--from=2026-01-01']).from, '2026-01-01');
  assert.equal(readArgs(['--dry-run']).dryRun, true);
  assert.equal(readArgs([]).from, null);
  assert.throws(() => readArgs(['--from=yesterday']), /YYYY-MM-DD/);
});

test('legacy weather strings and auto entries produce the same forecast', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'forecast-weather-'));
  const outfile = join(dir, 'forecast.mjs');
  await build({
    absWorkingDir: new URL('..', import.meta.url).pathname,
    entryPoints: ['src/lib/forecast.js'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    banner: {
      js: 'import.meta.env ??= { MODE: "test", DEV: false, PROD: false, VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" };',
    },
  });
  const { weekKey, weeklyForecast } = await import(pathToFileURL(outfile).href);
  const now = new Date(2026, 10, 18, 15, 0, 0);
  const key = weekKey(now);
  const prevKey = weekKey(new Date(2026, 10, 11, 15, 0, 0));
  const at = (weekStart, daysAfter) => {
    const [y, m, d] = weekStart.split('-').map(Number);
    return new Date(y, m - 1, d + daysAfter, 12, 0, 0).toISOString();
  };
  const orders = [-4, -3, -2, -1].map((w, i) => ({
    id: `o${i}`,
    status: 'done',
    createdAt: at(key, w * 7 + 1),
    items: [{ name: 'Bánh cuốn', price: 12, qty: 10 + (i % 2) * 6 }],
  }));
  const legacy = { [key]: 'hot', [prevKey]: 'cold' };
  const mixed = { [key]: { value: 'hot', source: 'auto' }, [prevKey]: 'cold' };
  const plain = weeklyForecast({ orders, now, weatherLog: legacy });
  const auto = weeklyForecast({ orders, now, weatherLog: mixed });
  assert.equal(plain.weather, 'hot');
  assert.equal(auto.weather, 'hot');
  assert.equal(typeof plain.weather, 'string');
  assert.deepEqual(plain.families, auto.families);
  assert.deepEqual(plain.weeksUsed, auto.weeksUsed);
  assert.deepEqual(
    plain.items.map((it) => [it.key, it.expected, it.method]),
    auto.items.map((it) => [it.key, it.expected, it.method]),
  );
  await rm(dir, { recursive: true, force: true });
});

test('dry-run prints the weatherLog plan and does not write', async () => {
  let writes = 0;
  const rows = [{ date: '2026-11-16', source: 'forecast' }];
  const updates = { '2026-11-16': { value: 'hot', source: 'auto' } };
  const result = await applyPlan({
    dryRun: true,
    rows,
    updates,
    writeDaily: async () => { writes += 1; },
    writeLog: async () => { writes += 1; return ['2026-11-16']; },
  });
  assert.equal(result.written, false);
  assert.equal(writes, 0);
  const text = formatWeatherPlan({ rows, updates, skipped: [{ key: '2026-11-09', reason: 'manual' }], dryRun: true });
  assert.match(text, /dry-run: không ghi/);
  assert.match(text, /weatherLog 2026-11-16: auto hot/);
  assert.match(text, /2026-11-09: bỏ qua manual/);
});
