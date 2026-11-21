// Test gom đợt giao tự động (src/lib/batches.js) — Giai đoạn 2 quy trình giao hàng.
// Dữ liệu giả quanh ngày giao Thứ Bảy 21/11/2026, giờ chốt 22:00 tối thứ Sáu 20/11.
// Chạy qua run.mjs (npm run test:batches).
import { BATCH_MAX, computeBatches, isCookingOrder, isInboxOrder, isLateOrder } from '../../src/lib/batches.js';

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

// Ngày/giờ theo giờ máy rồi mới đổi sang ISO, để test ổn định ở mọi múi giờ
const at = (y, m, d, h = 0, min = 0) => new Date(y, m, d, h, min).toISOString();
const delivery = (id, deliverAt, createdAt, extra = {}) => ({
  id,
  type: 'delivery',
  status: 'pending',
  source: 'web',
  confirmedAt: createdAt,
  deliverAt,
  createdAt,
  items: [],
  customer: { name: `Khách ${id}` },
  ...extra,
});

// 1) Hàng chờ nấu: đơn web chưa xác nhận chưa vào; đã xác nhận hoặc đơn tại quán thì vào
{
  check('hàng nấu: web chưa xác nhận → chưa vào', !isCookingOrder({ status: 'pending', source: 'web' }));
  check(
    'hàng nấu: web đã xác nhận → vào',
    isCookingOrder({ status: 'pending', source: 'web', confirmedAt: at(2026, 10, 20, 10) }),
  );
  check('hàng nấu: đơn tại quán chờ xử lý → vào', isCookingOrder({ status: 'pending', source: 'staff' }));
  check('hàng nấu: đơn đã Hoàn thành → không vào', !isCookingOrder({ status: 'done', source: 'staff' }));
  check('hàng nấu: đơn đã huỷ → không vào', !isCookingOrder({ status: 'cancelled', source: 'staff' }));
}

// 2) Gộp theo ngày: mỗi ngày giao một dãy đợt riêng, số đợt đánh lại từ 1
{
  const orders = [
    delivery('sat1', at(2026, 10, 21, 8, 0), at(2026, 10, 19, 9)),
    delivery('sat2', at(2026, 10, 21, 9, 0), at(2026, 10, 19, 10)),
    delivery('sun1', at(2026, 10, 22, 8, 0), at(2026, 10, 19, 11)),
  ];
  const { byOrder, batches } = computeBatches(orders);
  check('theo ngày: 2 ngày → 2 đợt', batches.length === 2);
  check('theo ngày: đợt thứ Bảy có 2 đơn', batches[0].count === 2 && batches[0].dayKey === '2026-11-21');
  check('theo ngày: đợt Chủ Nhật đánh số lại từ 1', batches[1].batchIndex === 1 && batches[1].dayKey === '2026-11-22');
  check('theo ngày: byOrder ghi đúng dayKey', byOrder.get('sun1').dayKey === '2026-11-22');
}

// 3) Trần mỗi đợt = BATCH_MAX (15): 17 đơn cùng ngày → đợt 1 có 15, đợt 2 có 2
{
  check('BATCH_MAX = 15', BATCH_MAX === 15);
  // giờ giao tăng dần 07:00, 07:10, 07:20, ... cách nhau 10 phút
  const orders = Array.from({ length: 17 }, (_, i) =>
    delivery(`o${i}`, at(2026, 10, 21, 7 + Math.floor((i * 10) / 60), (i * 10) % 60), at(2026, 10, 19, 9)),
  );
  const { byOrder, batches } = computeBatches(orders);
  check('trần 15: 17 đơn → 2 đợt', batches.length === 2);
  check('trần 15: đợt 1 = 15 đơn, đợt 2 = 2 đơn', batches[0].count === 15 && batches[1].count === 2);
  check('trần 15: vị trí trong đợt 1 chạy 1..15', byOrder.get('o14').positionInBatch === 15 && byOrder.get('o0').positionInBatch === 1);
  check('trần 15: đợt 2 vị trí chạy lại 1..2', byOrder.get('o15').positionInBatch === 1 && byOrder.get('o16').positionInBatch === 2);
  check('trần 15: đủ 17 đơn có đợt', byOrder.size === 17);
}

// 4) Thứ tự trong đợt theo giờ giao sớm trước, dù đầu vào xáo trộn
{
  const orders = [
    delivery('muon', at(2026, 10, 21, 9, 0), at(2026, 10, 19, 9)),
    delivery('som', at(2026, 10, 21, 7, 30), at(2026, 10, 19, 9)),
    delivery('giua', at(2026, 10, 21, 8, 15), at(2026, 10, 19, 9)),
  ];
  const { batches, byOrder } = computeBatches(orders);
  check('thứ tự giờ: orderIds = sớm → giữa → muộn', batches[0].orderIds.join(',') === 'som,giua,muon');
  check('thứ tự giờ: vị trí khớp thứ tự', byOrder.get('som').positionInBatch === 1 && byOrder.get('muon').positionInBatch === 3);
  check(
    'thứ tự giờ: firstTime/lastTime của đợt',
    batches[0].firstTime === orders[1].deliverAt && batches[0].lastTime === orders[0].deliverAt,
  );
}

// 5) Đơn trễ: tạo sau 22:00 tối hôm trước ngày giao → loại khỏi đợt, vào nhóm trễ
{
  const sat8 = at(2026, 10, 21, 8, 0); // giao Thứ Bảy 21/11 08:00, chốt 22:00 thứ Sáu 20/11
  const truoc = delivery('truoc', sat8, at(2026, 10, 20, 21, 59));
  const dung22 = delivery('dung22', sat8, at(2026, 10, 20, 22, 0));
  const sau = delivery('sau', sat8, at(2026, 10, 20, 22, 30));
  const sangT7 = delivery('sangT7', sat8, at(2026, 10, 21, 6, 30));
  check('trễ: tạo 21:59 hôm trước → không trễ', !isLateOrder(truoc));
  check('trễ: tạo đúng 22:00 → không trễ (chỉ sau 22:00 mới trễ)', !isLateOrder(dung22));
  check('trễ: tạo 22:30 hôm trước → trễ', isLateOrder(sau));
  check('trễ: tạo sáng ngày giao → trễ', isLateOrder(sangT7));
  const { byOrder, batches, lateIds, lateCount } = computeBatches([truoc, dung22, sau, sangT7]);
  check('trễ: lateCount = 2', lateCount === 2);
  check('trễ: đơn trễ không có đợt', !byOrder.has('sau') && !byOrder.has('sangT7') && lateIds.has('sau') && lateIds.has('sangT7'));
  check('trễ: đơn đúng hạn vẫn vào đợt', batches.length === 1 && batches[0].count === 2);
}

// 6) Đơn thiếu giờ giao: không vào đợt, không tính trễ
{
  const noTime = delivery('noTime', undefined, at(2026, 10, 21, 7, 0));
  check('thiếu giờ giao: isLateOrder = false', !isLateOrder(noTime));
  const { byOrder, lateIds } = computeBatches([noTime]);
  check('thiếu giờ giao: không có đợt, không ở nhóm trễ', !byOrder.has('noTime') && !lateIds.has('noTime'));
}

// 7) Đơn đến lấy: không bao giờ vào đợt, không tính trễ dù tạo sau giờ chốt
{
  const pickup = delivery('pickup1', at(2026, 10, 21, 8, 0), at(2026, 10, 21, 7, 0), { type: 'pickup' });
  check('đến lấy: isLateOrder = false', !isLateOrder(pickup));
  const { byOrder, batches, lateIds } = computeBatches([pickup]);
  check('đến lấy: không có đợt nào', batches.length === 0 && !byOrder.has('pickup1') && !lateIds.has('pickup1'));
}

// 8) Hai trạm tách hẳn nhau: một đơn chờ chỉ thuộc đúng một trong Chờ xử lý / Chờ nấu
{
  const t = at(2026, 10, 20, 10);
  const shapes = [
    ['web mới chưa nhận', { status: 'pending', source: 'web' }, 'inbox'],
    ['web đã nhận chưa xác nhận', { status: 'pending', source: 'web', receivedAt: t }, 'inbox'],
    ['web đã xác nhận', { status: 'pending', source: 'web', receivedAt: t, confirmedAt: t }, 'cooking'],
    ['tại quán (nhân viên nhập)', { status: 'pending', source: 'staff' }, 'cooking'],
    ['đã Hoàn thành', { status: 'done', source: 'web', confirmedAt: t }, 'none'],
    ['đang giao', { status: 'delivering', source: 'web', confirmedAt: t }, 'none'],
    ['đã ship', { status: 'shipped', source: 'web', confirmedAt: t }, 'none'],
    ['đã huỷ', { status: 'cancelled', source: 'web' }, 'none'],
  ];
  for (const [name, order, want] of shapes) {
    const inbox = isInboxOrder(order);
    const cooking = isCookingOrder(order);
    check(`trạm: ${name} → ${want}`, inbox === (want === 'inbox') && cooking === (want === 'cooking'));
    check(`trạm: ${name} → không thuộc cả hai trạm`, !(inbox && cooking));
  }
}

console.log(`\nKẾT QUẢ: ${passed} đạt, ${failed} trượt`);
if (failed > 0) process.exit(1);
