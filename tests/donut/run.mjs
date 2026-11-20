// Test hàm toán biểu đồ tròn (src/lib/donut.js) — hàm thuần không import gì
// nên chạy thẳng bằng Node, không cần đóng gói.
// Chạy: npm run test:donut
import { donutSegments } from '../../src/lib/donut.js';

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
const sum = (arr) => arr.reduce((s, x) => s + x, 0);
const CIRC = 2 * Math.PI * 60;

// 1) Nhiều lát: tổng % đúng 100, tổng độ dài cung đúng chu vi
{
  const segs = donutSegments([154, 230, 96, 20], CIRC);
  check('4 lát: tổng percent = 100', sum(segs.map((s) => s.percent)) === 100);
  check('4 lát: tổng length ≈ chu vi', Math.abs(sum(segs.map((s) => s.length)) - CIRC) < 1e-9);
  check('4 lát: offset nối tiếp nhau', Math.abs(segs[1].offset - segs[0].length) < 1e-9);
}

// 2) Ba lát bằng nhau: 34/33/33 — tổng vẫn 100 (largest remainder)
{
  const segs = donutSegments([1, 1, 1], CIRC);
  check('3 lát bằng nhau: percent là 34/33/33', segs.map((s) => s.percent).join('/') === '34/33/33');
  check('3 lát bằng nhau: tổng percent = 100', sum(segs.map((s) => s.percent)) === 100);
}

// 3) Toàn 0: không NaN, mọi lát 0
{
  const segs = donutSegments([0, 0, 0, 0], CIRC);
  check('toàn 0: mọi percent = 0', segs.every((s) => s.percent === 0));
  check('toàn 0: mọi length = 0, không NaN', segs.every((s) => s.length === 0 && Number.isFinite(s.fraction)));
}

// 4) Một lát chiếm hết: 100%, cung = trọn chu vi, các lát còn lại 0
{
  const segs = donutSegments([0, 154, 0, 0], CIRC);
  check('một lát 100%: percent = 100', segs[1].percent === 100 && segs[0].percent === 0);
  check('một lát 100%: length = chu vi', Math.abs(segs[1].length - CIRC) < 1e-9);
  check('một lát 100%: fraction = 1', segs[1].fraction === 1);
}

// 5) Lát giá trị 0 vẫn có mặt trong kết quả (để hiện ở chú thích), cung 0
{
  const segs = donutSegments([100, 0, 50], CIRC);
  check('lát 0: vẫn có trong mảng, length = 0', segs.length === 3 && segs[1].length === 0 && segs[1].percent === 0);
  check('lát 0: hai lát còn lại tổng 100%', segs[0].percent + segs[2].percent === 100);
}

// 6) Giá trị bậy (âm, NaN, chuỗi) coi như 0, không văng lỗi
{
  const segs = donutSegments([-5, NaN, 'abc', 100], CIRC);
  check('giá trị bậy: chỉ lát hợp lệ có cung', segs[3].percent === 100 && segs[0].length === 0 && segs[1].length === 0);
}

console.log(`\nKẾT QUẢ: ${passed} đạt, ${failed} trượt`);
if (failed > 0) process.exit(1);
