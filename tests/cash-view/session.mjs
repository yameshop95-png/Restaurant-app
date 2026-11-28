// Test mô hình lãi đơn giản theo dòng tiền — Paul, 28/11/2026:
// "chỉ cần nhập hàng tổng chi phí, rồi cứ làm, bán thu vô, trừ ra" —
// không cần công thức/mẻ. profitReport đã có sẵn bought/cashNet; suite này
// khoá: (1) số dòng tiền đúng khi KHÔNG có công thức nào, (2) tab Lãi lỗ
// đưa Dòng tiền lên làm số chính, thẻ giá vốn công thức chỉ còn tham khảo.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { profitReport } from '../../src/lib/inventory.js';

let pass = 0;
let fail = 0;
const check = (name, ok) => {
  if (ok) { pass += 1; console.log(`  ✓ ${name}`); }
  else { fail += 1; console.log(`  ✗ ${name}`); }
};
const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;

const range = { start: new Date('2026-01-01T00:00:00'), end: new Date('2027-01-01T00:00:00') };
const r = profitReport({
  range,
  orders: [
    {
      id: 'o1',
      status: 'shipped',
      createdAt: '2026-11-24T01:00:00Z',
      deliverAt: '2026-11-28T00:00:00Z',
      items: [{ name: 'Bánh cuốn', price: 16, qty: 10 }],
      shippingFee: 0,
      discount: 0,
    },
  ],
  menu: [{ id: 'd1', name: 'Bánh cuốn', price: 16 }],
  recipes: [], // không có công thức nào — đúng mô hình Paul chọn
  ingredients: [{ id: 'flour', name: 'Bột gạo', unit: 'kg' }],
  purchases: [{ date: '2026-11-23', ingredientId: 'flour', qty: 42, total: 119 }],
  expenses: [{ date: '2026-11-24', amount: 30, category: 'Điện' }],
  batches: [],
});

check('Doanh thu = $160', near(r.revenue, 160));
check('Tiền mua hàng (tổng nhập) = $119', near(r.bought, 119));
check('Chi phí khác = $30', near(r.otherCosts, 30));
check('Lãi dòng tiền = 160 − 119 − 30 = $11, không cần công thức', near(r.cashNet, 11));
check('Tiền ra = mua hàng + chi phí = $149', near(r.cashOut, 149));

// --- Khoá nguồn: thứ tự thẻ ở tab Lãi lỗ ---
const pageSrc = readFileSync(path.join(process.cwd(), 'src/pages/InventoryPage.jsx'), 'utf8');
const iCash = pageSrc.indexOf('Lãi theo dòng tiền');
const iRecipe = pageSrc.indexOf('Lãi theo giá vốn công thức (tham khảo)');
check('Thẻ Dòng tiền đứng trước thẻ công thức', iCash > 0 && iRecipe > iCash);
const headline = pageSrc.slice(iCash, pageSrc.indexOf('</Card>', iCash));
check('Số chính của thẻ đầu là r.cashNet (data-testid profit)', headline.includes('data-testid="profit"') && headline.includes('r.cashNet'));
check('Lưới 3 ô của thẻ đầu: Doanh thu / Tiền mua hàng / Chi phí khác', headline.includes('Tiền mua hàng') && headline.includes('r.bought'));
check('Thẻ công thức ghi rõ chỉ tham khảo', pageSrc.slice(iRecipe, iRecipe + 900).includes('không dùng công thức thì xem số dòng tiền ở trên'));

console.log(`\ncash-view: ${pass} đạt, ${fail} trượt`);
console.log(fail ? 'CÓ TEST TRƯỢT' : 'TẤT CẢ PASS');
process.exit(fail ? 1 : 0);
