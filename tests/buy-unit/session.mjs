// Test: đơn vị mua + quy đổi cho mục Nhập hàng (Paul, 28/11/2026).
// Bối cảnh: Paul mua bột gạo theo thùng (12 gói × 500g), nấm mèo theo gói
// 1000 g, nước mắm theo chai 700 ml — nhưng app chỉ cho nhập theo đơn vị
// dùng (kg/g) nên anh phải nhập số gói vào ô gam: giá vốn nấm mèo thành
// $17,24/gam và mẻ Bánh cuốn 15 phần bị tính ~$3.490 (~$233/phần, bán $16).
import fs from 'node:fs';
import path from 'node:path';
import { buyBreakdown, buyToBase, buyUnitOf, batchCost, dateKey, ingredientCosts } from '../../src/lib/inventory.js';

let passed = 0;
let failed = 0;
function check(label, ok) {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ TRƯỢT: ${label}`); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// --- buyUnitOf / buyToBase ---
check('Chưa đặt đơn vị mua → null', buyUnitOf({ name: 'Thịt heo', unit: 'kg' }) === null);
check('Đặt thiếu số quy đổi → null', buyUnitOf({ buyUnit: 'thùng', buySize: 0 }) === null);
check('Đặt thiếu tên đơn vị → null', buyUnitOf({ buyUnit: '  ', buySize: 6 }) === null);
const thung = buyUnitOf({ buyUnit: 'thùng', buySize: 6 });
check('Đặt đủ → {unit, size}', thung?.unit === 'thùng' && thung?.size === 6);
check('7 thùng bột gạo × 6 kg = 42 kg', buyToBase(7, 6) === 42);
check('3 chai mắm × 700 ml = 2100 ml', buyToBase(3, 700) === 2100);
check('1 gói nấm mèo × 1000 g = 1000 g', buyToBase(1, 1000) === 1000);

// --- buyBreakdown: khai quy cách như trên bao bì, app tự nhân ra tổng ---
const bdThung = buyBreakdown({ name: 'Bột gạo', unit: 'kg', buyUnit: 'thùng', buyPacks: 12, buyPackUnit: 'gói', buyPackSize: 500, buyPackMeasure: 'g' });
check('1 thùng = 12 gói × 500 g → tổng 6 kg', bdThung?.size === 6 && bdThung?.packs === 12 && bdThung?.packUnit === 'gói');
check('buyUnitOf đọc qua quy cách chi tiết', buyUnitOf({ unit: 'kg', buyUnit: 'thùng', buyPacks: 12, buyPackSize: 500, buyPackMeasure: 'g' })?.size === 6);
const bdChai = buyBreakdown({ name: 'Nước mắm', unit: 'ml', buyUnit: 'chai', buyPacks: 1, buyPackUnit: 'chai', buyPackSize: 700, buyPackMeasure: 'ml' });
check('1 chai = 1 × 700 ml → tổng 700 ml', bdChai?.size === 700);
const bdGoi = buyBreakdown({ name: 'Hạt nêm', unit: 'g', buyUnit: 'gói', buyPacks: 1, buyPackSize: 800, buyPackMeasure: 'g' });
check('1 gói hạt nêm = 800 g', bdGoi?.size === 800);
check('Kiểu cũ chỉ có buySize vẫn chạy (dự phòng)', buyBreakdown({ unit: 'kg', buyUnit: 'thùng', buySize: 6 })?.size === 6);
check('Đơn vị con không quy đổi được (gói → kg) và không có buySize → null',
  buyBreakdown({ unit: 'kg', buyUnit: 'thùng', buyPacks: 12, buyPackSize: 500, buyPackMeasure: 'gói' }) === null);
check('Giá 1 thùng $17 → giá mỗi gram bột gạo = 17/6000 ≈ $0,0028', near(17 / (bdThung.size * 1000), 0.002833, 0.0001));

// --- Đầu-cuối với số thật của Paul sau khi sửa dữ liệu (28/11/2026) ---
const today = dateKey();
const ING = [
  { id: 'bg', name: 'Bột gạo', unit: 'kg', buyUnit: 'thùng', buySize: 6 },
  { id: 'bn', name: 'Bột năng', unit: 'kg' },
  { id: 'th', name: 'Thịt heo', unit: 'kg' },
  { id: 'nm', name: 'Nấm mèo', unit: 'g', buyUnit: 'gói', buySize: 1000 },
];
const byId = new Map(ING.map((i) => [i.id, i]));
const PUR = [
  { ingredientId: 'bg', qty: 42, total: 119, date: today }, // 7 thùng × $17
  { ingredientId: 'bn', qty: 30, total: 90, date: today },
  { ingredientId: 'th', qty: 45, total: 405, date: today },
  { ingredientId: 'nm', qty: 1000, total: 15, date: today }, // 1 gói $15 = 1000 g
  { ingredientId: 'nm', qty: 3000, total: 53.97, date: today }, // 3 gói × $17,99
];
const costs = ingredientCosts(ING, PUR);
check('Giá vốn nấm mèo ≈ $0,0172/g (không còn $17,24/g)', near(costs.get('nm'), 0.0172425, 0.001));
// Mẻ trong ảnh Paul gửi: Bánh cuốn 15 phần — 6 kg bột gạo, 3 kg bột năng, 1,8 kg thịt heo, 200 g nấm mèo
const batch = {
  extraCost: 0,
  lines: [
    { ingredientId: 'bg', qty: 6, unit: 'kg' },
    { ingredientId: 'bn', qty: 3, unit: 'kg' },
    { ingredientId: 'th', qty: 1.8, unit: 'kg' },
    { ingredientId: 'nm', qty: 200, unit: 'g' },
  ],
};
const good = batchCost(batch, costs, byId);
check('Mẻ Bánh cuốn: tổng giá vốn ≈ $45,65', near(good.cost, 45.65, 0.1));
check('Mẻ Bánh cuốn: ≈ $3,04/phần (giá bán $16)', near(good.cost / 15, 3.04, 0.05));
check('Không thiếu giá nguyên liệu nào', good.missing.length === 0);

// Hồi quy: dữ liệu cũ (nhập số gói vào ô gam) cho giá đội lên trời — khoá lại để không quay lại
const brokenCosts = ingredientCosts(ING, [
  ...PUR.slice(0, 3),
  { ingredientId: 'nm', qty: 1, total: 15, date: today },
  { ingredientId: 'nm', qty: 3, total: 53.97, date: today },
]);
check('Dữ liệu cũ cho mẻ > $3.000 (đúng lỗi Paul gặp)', batchCost(batch, brokenCosts, byId).cost > 3000);

// --- Khoá nguồn: hai form dùng đúng cơ chế ---
const purSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/inventory/PurchasesTab.jsx'), 'utf8');
check('Form nhập hàng có chế độ theo đơn vị mua + hiện quy cách bao bì', purSrc.includes('buyUnitOf') && purSrc.includes('Theo {buy.unit}') && purSrc.includes('buyBreakdown'));
check('Form nhập hàng quy đổi về đơn vị dùng khi lưu + lưu cách nhập gốc', purSrc.includes('buyToBase') && purSrc.includes('buy: { count: cNum'));
check('Lịch sử nhập hiện cách nhập gốc', purSrc.includes('p.buy'));
const stockSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/inventory/StockTab.jsx'), 'utf8');
check('Form nguyên liệu có các mục quy cách mua', stockSrc.includes('Đơn vị mua') && stockSrc.includes('buyPackSize') && stockSrc.includes('gồm mấy đơn vị con'));

console.log(`\nbuy-unit: ${passed} đạt, ${failed} trượt`);
if (failed) { console.log('KẾT QUẢ: TEST THẤT BẠI'); process.exit(1); }
console.log('TẤT CẢ PASS');
