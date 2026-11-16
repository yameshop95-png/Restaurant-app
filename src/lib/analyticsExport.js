// File Excel "dữ liệu phân tích", gộp theo tháng, để chủ quán lưu về máy tính hoặc OneDrive.
// Dùng để: xem lại báo cáo, và sau này cải tiến cách dự báo (xem docs/du-bao.md). Không lưu thêm gì lên máy chủ.
import { boldHeader, writeSheets } from './excelFile';
import { FAMILY_LABEL, weeklyForecast, weeklySeries } from './forecast';
import { readForecastLog } from './forecastLog';
import { LANG_GROUPS, languageByMonth } from './languageReport';
import { CLASSES, menuEngineering } from './menuEngineering';
import { profitReport } from './inventory';

const SEASON = { summer: 'Hè', autumn: 'Thu', winter: 'Đông', spring: 'Xuân' };
const WEATHER = { hot: 'Nóng', mild: 'Mát', cold: 'Lạnh', rain: 'Mưa' };
const r2 = (n) => Math.round(n * 100) / 100;
const monthRange = (mk) => {
  const [y, m] = mk.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
};

export function analyticsSheets({ orders, now, weatherLog = {}, inventory = null, menu = [] }) {
  const sheets = [];

  // 1. Khách theo ngôn ngữ, từng tháng
  const months = languageByMonth(orders);
  sheets.push({
    sheet: 'Ngôn ngữ theo tháng',
    columns: [{ width: 10 }, ...LANG_GROUPS.flatMap(() => [{ width: 14 }, { width: 14 }]), { width: 18 }],
    data: [
      boldHeader(['Tháng', ...LANG_GROUPS.flatMap((g) => [`${g.label}: đơn`, `${g.label}: doanh thu`]), '% tiếng Anh trong đơn web']),
      ...months.map((m) => {
        const web = m.groups.vi.orders + m.groups.en.orders;
        return [
          m.month,
          ...LANG_GROUPS.flatMap((g) => [m.groups[g.id].orders, r2(m.groups[g.id].revenue)]),
          web ? r2((m.groups.en.orders / web) * 100) : null,
        ];
      }),
    ],
  });

  // 2. Món theo tháng và theo nhóm ngôn ngữ
  const dishRows = [];
  for (const m of months) {
    const names = new Map();
    for (const g of LANG_GROUPS) for (const [k, d] of m.groups[g.id].dishes) names.set(k, d.name);
    for (const [k, name] of names) {
      const q = (id) => m.groups[id].dishes.get(k)?.qty ?? 0;
      dishRows.push([m.month, name, q('vi') + q('en') + q('app'), q('vi'), q('en'), q('app')]);
    }
  }
  sheets.push({
    sheet: 'Món theo tháng',
    columns: [{ width: 10 }, { width: 26 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }],
    data: [boldHeader(['Tháng', 'Món', 'Tổng phần', 'Web tiếng Việt', 'Web tiếng Anh', 'Tạo trong app']), ...dishRows],
  });

  // 3. Dữ liệu học dự báo: mỗi tuần × món, kèm điều kiện của tuần
  const { weeks, names } = weeklySeries(orders, now, weatherLog);
  const weekRows = [];
  for (const w of weeks) {
    for (const [k, name] of names) {
      weekRows.push([
        w.key,
        name,
        w.qty.get(k) ?? 0,
        w.current ? 'đang diễn ra' : 'đã xong',
        w.cond.wom,
        SEASON[w.cond.season],
        w.cond.payday,
        w.cond.holiday ?? '',
        WEATHER[w.cond.weather] ?? '',
      ]);
    }
  }
  sheets.push({
    sheet: 'Món theo tuần',
    columns: [{ width: 12 }, { width: 26 }, { width: 8 }, { width: 13 }, { width: 10 }, { width: 8 }, { width: 10 }, { width: 12 }, { width: 10 }],
    data: [
      boldHeader(['Tuần (thứ Hai)', 'Món', 'Phần', 'Trạng thái', 'Tuần trong tháng', 'Mùa', 'Nhóm tuần lương', 'Dịp lễ', 'Thời tiết']),
      ...weekRows,
    ],
  });

  // 4. Kiểm tra dự báo: dự báo lại các tuần đã qua và so với thực tế
  const f = weeklyForecast({ orders, now, weatherLog });
  const check = [boldHeader(['Tuần', 'Dự báo (tổng phần)', 'Thực tế', 'Lệch tuyệt đối', 'Lệch %'])];
  for (const r of f.accuracy?.rows ?? []) {
    check.push([r.key, r2(r.predicted), r.actual, r2(r.absErr), r.actual ? r2((r.absErr / r.actual) * 100) : null]);
  }
  check.push([]);
  check.push(['Sai số WAPE', f.accuracy ? `${r2(f.accuracy.wape * 100)}%` : 'chưa đủ dữ liệu']);
  check.push(['Yếu tố đang dùng', f.families?.length ? f.families.map((x) => FAMILY_LABEL[x]).join(', ') : 'chỉ mức gần đây']);
  sheets.push({ sheet: 'Kiểm tra dự báo', columns: [{ width: 16 }, { width: 18 }, { width: 10 }, { width: 14 }, { width: 10 }], data: check });

  // 5. Dự báo đã lưu trên máy này (dự báo thật, trước khi biết kết quả) để so với "Món theo tuần"
  const log = readForecastLog();
  const logRows = [];
  for (const [wk, entry] of Object.entries(log).sort()) {
    for (const it of entry.items) logRows.push([wk, it.name, it.expected, it.method, WEATHER[entry.weather] ?? '', (entry.families ?? []).join(', ')]);
  }
  sheets.push({
    sheet: 'Dự báo đã lưu',
    columns: [{ width: 12 }, { width: 26 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 24 }],
    data: [boldHeader(['Tuần', 'Món', 'Dự báo (phần)', 'Cách tính', 'Thời tiết', 'Yếu tố']), ...logRows],
  });

  // 6. Phân loại món theo lãi và độ phổ biến, từng tháng (cần dữ liệu Inventory: công thức và giá nhập)
  if (inventory) {
    const meRows = [];
    for (const m of months) {
      const r = profitReport({ range: monthRange(m.month), orders, menu, ...inventory });
      const me = menuEngineering(r.dishes);
      for (const row of me.rows) {
        meRows.push([m.month, row.name, row.qty, r2(row.price), r2(row.cost), r2(row.margin), r2(row.mix * 100), CLASSES[row.cls].label]);
      }
      for (const name of me.unknown) meRows.push([m.month, name, null, null, null, null, null, 'Chưa có công thức']);
    }
    sheets.push({
      sheet: 'Phân loại món',
      columns: [{ width: 10 }, { width: 26 }, { width: 8 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 22 }],
      data: [boldHeader(['Tháng', 'Món', 'Phần', 'Giá TB', 'Giá vốn', 'Lãi mỗi phần', '% số phần', 'Nhóm']), ...meRows],
    });
  }
  return sheets;
}

export async function downloadAnalytics(args, shopName) {
  const slug = (shopName || 'quan').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const d = args.now ?? new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  await writeSheets(analyticsSheets(args), `phan-tich-${slug}-${stamp}.xlsx`);
}
