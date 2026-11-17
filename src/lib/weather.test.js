import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addIsoDays,
  conditionFromWmo,
  describeSuggestion,
  describeSymbol,
  isRainCode,
  melbourneDate,
  mergeAutoUpdates,
  mondayOf,
  nextShopData,
  planWeatherLogUpdates,
  suggestWeekWeather,
  weeksToLabel,
} from './weather.js';

const week = '2026-11-16';

function days(specs) {
  return specs.map((spec, i) => ({
    date: addIsoDays(week, i),
    temp_max: spec.temp,
    temp_min: 10,
    precipitation_mm: spec.precip ?? 0,
    weather_code: spec.code ?? 0,
    source: spec.source ?? 'forecast',
  }));
}

test('melbourne date rolls over at 00:00 AEDT (UTC+11)', () => {
  assert.equal(melbourneDate('2026-11-17T12:00:00Z'), '2026-11-17');
  assert.equal(melbourneDate('2026-11-17T13:00:00Z'), '2026-11-18');
});

test('hot week from mean daily max, rounded', () => {
  const suggestion = suggestWeekWeather(days([{ temp: 31 }, { temp: 32 }, { temp: 33 }, { temp: 31 }]), week);
  assert.equal(suggestion.id, 'hot');
  assert.match(describeSuggestion(suggestion, { canEdit: true }), /Tuần này nắng nóng \(~32°C\)/);
});

test('29.4 rounds to mild and 29.6 rounds to hot', () => {
  assert.equal(suggestWeekWeather(days([{ temp: 29.4 }, { temp: 29.4 }, { temp: 29.4 }]), week).id, 'mild');
  assert.equal(suggestWeekWeather(days([{ temp: 29.6 }, { temp: 29.6 }, { temp: 29.6 }]), week).id, 'hot');
});

test('18 is mild and 17 is cold', () => {
  assert.equal(suggestWeekWeather(days([{ temp: 18 }, { temp: 18 }, { temp: 18 }]), week).id, 'mild');
  assert.equal(suggestWeekWeather(days([{ temp: 17.4 }, { temp: 17.4 }, { temp: 17.4 }]), week).id, 'cold');
});

test('rain wins over a hot week when the weekly total reaches 10 mm', () => {
  const suggestion = suggestWeekWeather(
    days([{ temp: 32, precip: 6 }, { temp: 33, precip: 5 }, { temp: 31, precip: 0 }]),
    week,
  );
  assert.equal(suggestion.id, 'rain');
  assert.match(describeSuggestion(suggestion), /có mưa \(~32°C, 11 mm\)/);
});

test('two wet days count as rain even when the total is under 10 mm', () => {
  const suggestion = suggestWeekWeather(
    days([{ temp: 22, precip: 1 }, { temp: 22, precip: 1 }, { temp: 22, precip: 0 }]),
    week,
  );
  assert.equal(suggestion.id, 'rain');
});

test('a single light shower stays on the temperature chip', () => {
  const suggestion = suggestWeekWeather(
    days([{ temp: 31, precip: 5 }, { temp: 32, precip: 0 }, { temp: 33, precip: 0 }]),
    week,
  );
  assert.equal(suggestion.id, 'hot');
});

test('fewer than three days does not suggest', () => {
  assert.equal(suggestWeekWeather(days([{ temp: 32 }, { temp: 33 }]), week), null);
  assert.equal(suggestWeekWeather(null, week), null);
});

test('numeric strings from Postgres and days outside the week are handled', () => {
  const rows = days([{ temp: '31.2' }, { temp: '32.4' }, { temp: '30.8' }]);
  rows.push({ date: '2026-11-01', temp_max: 5, precipitation_mm: 40, weather_code: 65, source: 'archive' });
  const suggestion = suggestWeekWeather(rows, week);
  assert.equal(suggestion.id, 'hot');
  assert.equal(suggestion.days, 3);
});

test('rain weather codes count as wet days', () => {
  assert.equal(isRainCode(63), true);
  assert.equal(isRainCode(0), false);
  const suggestion = suggestWeekWeather(
    days([
      { temp: 20, precip: 0, code: 63 },
      { temp: 20, precip: 0, code: 95 },
      { temp: 20, precip: 0, code: 1 },
    ]),
    week,
  );
  assert.equal(suggestion.id, 'rain');
});

test('a stored chip wins in the sentence', () => {
  const suggestion = suggestWeekWeather(days([{ temp: 32 }, { temp: 32 }, { temp: 32 }]), week);
  assert.match(describeSuggestion(suggestion, { stored: 'cold', canEdit: true }), /Đang chọn Lạnh/);
  assert.equal(describeSuggestion(suggestion, { stored: 'hot', canEdit: true }), null);
});

test('an automatic entry says tự chọn even when the daily rows are missing', () => {
  const stored = { value: 'hot', source: 'auto' };
  const suggestion = suggestWeekWeather(days([{ temp: 32 }, { temp: 32 }, { temp: 32 }]), week);
  assert.match(describeSuggestion(suggestion, { stored }), /Tuần này nắng nóng \(~32°C\) \(tự chọn\)/);
  assert.equal(describeSuggestion(null, { stored }), 'Tuần này nắng nóng (tự chọn).');
});

test('manual entries are never overwritten, including a cleared week and a legacy string', () => {
  const hot = ['2026-11-16', '2026-11-17', '2026-11-18'].map((date) => ({
    date, temp_max: 33, temp_min: 16, precipitation_mm: 0, weather_code: 0, source: 'archive',
  }));
  const log = {
    '2026-11-16': 'cold',
    '2026-11-09': { value: null, source: 'manual' },
    '2026-11-02': { value: 'mild', source: 'auto' },
  };
  const weeks = [
    { key: '2026-11-16', mode: 'current' },
    { key: '2026-11-09', mode: 'archive' },
    { key: '2026-11-02', mode: 'archive' },
  ];
  const cold = ['2026-11-02', '2026-11-03', '2026-11-04'].map((date) => ({
    date, temp_max: 12, temp_min: 4, precipitation_mm: 0, weather_code: 0, source: 'archive',
  }));
  const { updates, skipped } = planWeatherLogUpdates({ log, rows: [...hot, ...cold], weeks });
  assert.deepEqual(updates, { '2026-11-02': { value: 'cold', source: 'auto' } });
  assert.deepEqual(skipped.map((item) => item.reason), ['manual', 'manual']);
});

test('a past week is finalised from archive rows only', () => {
  const rows = [
    ...['2026-11-09', '2026-11-10', '2026-11-11'].map((date) => ({
      date, temp_max: 33, temp_min: 18, precipitation_mm: 0, weather_code: 0, source: 'forecast',
    })),
    ...['2026-11-09', '2026-11-10', '2026-11-11'].map((date) => ({
      date, temp_max: 12, temp_min: 5, precipitation_mm: 0, weather_code: 3, source: 'archive',
    })),
  ];
  const { updates } = planWeatherLogUpdates({
    log: {},
    rows,
    weeks: [{ key: '2026-11-09', mode: 'archive' }],
  });
  assert.equal(updates['2026-11-09'].value, 'cold');
});

test('backfill weeks follow orders, and the fresh shop row keeps every other field', () => {
  assert.equal(mondayOf('2026-11-17'), '2026-11-16');
  assert.equal(mondayOf('2026-11-22'), '2026-11-16');
  const weeks = weeksToLabel({
    today: '2026-11-17',
    from: '2026-11-01',
    orderDates: ['2026-11-03', '2026-11-18'],
  });
  assert.deepEqual(weeks, [
    { key: '2026-11-16', mode: 'current' },
    { key: '2026-11-02', mode: 'archive' },
  ]);
  const data = {
    shopName: 'Quán',
    shippingZones: [{ name: 'nội ô' }],
    weatherLog: { '2026-10-26': 'rain', '2026-11-16': { value: 'mild', source: 'auto' } },
  };
  const { data: next, written } = nextShopData(data, {
    '2026-11-16': { value: 'hot', source: 'auto' },
    '2026-10-26': { value: 'cold', source: 'auto' },
  });
  assert.deepEqual(written, ['2026-11-16']);
  assert.equal(next.shopName, 'Quán');
  assert.deepEqual(next.shippingZones, [{ name: 'nội ô' }]);
  assert.equal(next.weatherLog['2026-10-26'], 'rain');
  assert.deepEqual(next.weatherLog['2026-11-16'], { value: 'hot', source: 'auto' });
  const merged = mergeAutoUpdates({ '2026-11-16': 'hot' }, { '2026-11-16': { value: 'rain', source: 'auto' } });
  assert.deepEqual(merged.written, []);
  assert.equal(merged.log['2026-11-16'], 'hot');
});


test('WMO codes and MET symbols share the short Vietnamese labels', () => {
  assert.equal(conditionFromWmo(0), 'Nắng');
  assert.equal(conditionFromWmo(3), 'Nhiều mây');
  assert.equal(conditionFromWmo(61), 'Mưa nhỏ');
  assert.equal(conditionFromWmo(95), 'Giông');
  assert.equal(conditionFromWmo(45), 'Sương mù');
  assert.deepEqual(describeSymbol('partlycloudy_day'), { weatherCode: 2, condition: 'Có mây' });
  assert.deepEqual(describeSymbol('heavyrain'), { weatherCode: 65, condition: 'Mưa to' });
  assert.equal(describeSymbol('not-a-symbol'), null);
});
