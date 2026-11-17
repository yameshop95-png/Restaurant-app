import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateMet, mergeDaily, parsePower, readArgs } from './weather-daily.mjs';

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

test('backfill start date must be an ISO date', () => {
  assert.equal(readArgs(['--from=2026-01-01']).from, '2026-01-01');
  assert.equal(readArgs([]).from, null);
  assert.throws(() => readArgs(['--from=yesterday']), /YYYY-MM-DD/);
});
