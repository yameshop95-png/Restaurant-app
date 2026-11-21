// Test toạ độ lưu trên đơn (src/lib/orderGeo.js) + tính ổn định của nhãn đợt:
// đợt phải tính từ toạ độ TRÊN ĐƠN (dữ liệu chung) nên máy nào cũng ra cùng kết
// quả, không còn phụ thuộc cache địa chỉ riêng của từng máy như trước.
// Chạy qua run.mjs (npm run test:ordergeo).
import { BATCH_MAX, computeBatches } from '../../src/lib/batches.js';
import { geoRecordFor, storedGeoOf } from '../../src/lib/orderGeo.js';

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}`);
  }
}

const ADDR = '12 High Street, Wodonga VIC 3690';
const order = (extra = {}) => ({
  id: 'o1',
  type: 'delivery',
  status: 'pending',
  customer: { name: 'Khách', address: ADDR },
  ...extra,
});

// ---------- storedGeoOf / geoRecordFor ----------
{
  const hit = { lat: -36.121, lng: 146.888, zone: 'Wodonga 3690' };
  const rec = geoRecordFor(ADDR, hit);
  check('geoRecordFor đóng gói đúng lat/lng/zone/for', rec.lat === hit.lat && rec.lng === hit.lng && rec.zone === hit.zone && rec.for === ADDR);
  check('geoRecordFor: thiếu zone → zone null', geoRecordFor(ADDR, { lat: 1, lng: 2 }).zone === null);

  const withGeo = order({ geo: rec });
  const got = storedGeoOf(withGeo);
  check('storedGeoOf: bản ghi hợp lệ → trả toạ độ', got && got.lat === hit.lat && got.lng === hit.lng && got.zone === hit.zone);
  check('storedGeoOf: đơn không có geo → null', storedGeoOf(order()) === null);
  check(
    'storedGeoOf: địa chỉ đã sửa khác `for` → null (toạ độ cũ hết hiệu lực)',
    storedGeoOf(order({ geo: rec, customer: { name: 'Khách', address: '99 Dean Street, Albury NSW 2640' } })) === null,
  );
  check('storedGeoOf: lat không phải số → null', storedGeoOf(order({ geo: { lat: '-36.1', lng: 146.8, for: ADDR } })) === null);
  check('storedGeoOf: thiếu địa chỉ → null', storedGeoOf({ id: 'x', geo: rec, customer: { name: 'K' } }) === null);
  check('storedGeoOf: geo null → null', storedGeoOf(order({ geo: null })) === null);
}

// ---------- Nhãn đợt chỉ từ toạ độ trên đơn: ổn định giữa các "máy" ----------
// Dựng 20 đơn giao sáng thứ Bảy ở 4 vùng; toạ độ MỘT điểm mỗi vùng như harness
// mô phỏng. "Máy" ở đây = cách dựng bản đồ toạ độ cho computeBatches:
// - Cách MỚI (OrdersPage sau sửa): chỉ storedGeoOf — không tham số cache nào cả.
// - Cách CŨ trên máy cache lạnh: mọi toạ độ null → đợt chỉ theo giờ.
const GEO = {
  Wodonga: { lat: -36.121, lng: 146.888, zone: 'Wodonga 3690' },
  Albury: { lat: -36.081, lng: 146.916, zone: 'Albury 2640' },
  Lavington: { lat: -36.045, lng: 146.935, zone: 'Lavington 2640' },
  Thurgoona: { lat: -36.045, lng: 146.985, zone: 'Thurgoona 2640' },
};
const SUBURBS = Object.keys(GEO);
const at = (h, min) => new Date(2026, 10, 28, h, min).toISOString(); // T7 28/11/2026 theo giờ máy
const created = new Date(2026, 10, 25, 10, 0).toISOString();
const orders = [];
for (let i = 0; i < 20; i++) {
  const suburb = SUBURBS[i % SUBURBS.length];
  const address = `${10 + i} Example Street, ${suburb}`;
  orders.push({
    id: `s${i}`,
    type: 'delivery',
    status: 'pending',
    source: 'web',
    confirmedAt: created,
    createdAt: created,
    deliverAt: at(7 + Math.floor(i / 4), (i % 4) * 12),
    customer: { name: `Khách ${i}`, address },
    geo: geoRecordFor(address, GEO[suburb]),
    items: [],
  });
}
const mapFromOrders = (list) => {
  const map = new Map();
  for (const o of list) map.set(o.id, storedGeoOf(o));
  return map;
};
const signature = (plan) =>
  JSON.stringify([...plan.byOrder.entries()].sort(([a], [b]) => a.localeCompare(b))) +
  '|' +
  plan.batches.map((b) => `${b.batchIndex}:${b.count}`).join(',');

{
  const planA = computeBatches(orders, mapFromOrders(orders));
  const planB = computeBatches(orders, mapFromOrders(orders));
  check('mọi đơn có toạ độ trên đơn đều vào đợt', planA.byOrder.size === orders.length);
  check('không đợt nào vượt trần BATCH_MAX', planA.batches.every((b) => b.count <= BATCH_MAX));
  check(
    'hai "máy" dựng map từ đơn → nhãn đợt giống hệt nhau',
    signature(planA) === signature(planB),
  );
  // Máy cache lạnh theo CÁCH CŨ (map toàn null) cho kết quả khác — chính là lệch
  // đã đo ở mô phỏng 150 đơn; cách mới không còn đường nào dẫn tới map đó vì
  // OrdersPage không đọc cache nữa.
  const coldMap = new Map(orders.map((o) => [o.id, null]));
  const planCold = computeBatches(orders, coldMap);
  check('đối chứng: map toàn null (cách cũ, máy lạnh) cho nhãn đợt KHÁC', signature(planCold) !== signature(planA));
  // Đơn bị sửa địa chỉ: toạ độ cũ bị loại khỏi map → đơn vẫn vào đợt (theo giờ),
  // không dùng toạ độ sai.
  const edited = orders.map((o) => (o.id === 's0' ? { ...o, customer: { ...o.customer, address: '1 New Road, Wodonga' } } : o));
  const planEdited = computeBatches(edited, mapFromOrders(edited));
  check('đơn sửa địa chỉ: vẫn vào đợt, không dùng toạ độ cũ', planEdited.byOrder.has('s0') && mapFromOrders(edited).get('s0') === null);
}

console.log(`\nKẾT QUẢ: ${passed} đạt, ${failed} trượt`);
if (failed > 0) process.exit(1);
