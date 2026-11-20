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

// 7) Không truyền options gap: drawLength/drawOffset = length/offset (tương thích bản cũ)
{
  const segs = donutSegments([100, 50], CIRC);
  check(
    'không gap: draw = cung gốc',
    segs.every((s) => Math.abs(s.drawLength - s.length) < 1e-9 && Math.abs(s.drawOffset - s.offset) < 1e-9),
  );
}

// 8) Có gap: mỗi lát thu ngắn hai đầu, khe NHÌN THẤY giữa hai lát đúng bằng gap
//    (đầu bo tròn nhô ra strokeWidth/2 mỗi phía nên phải trừ cả phần đó)
{
  const C2 = 2 * Math.PI * 55;
  const GAP = 8;
  const SW = 24;
  const segs = donutSegments([100, 100], C2, { gap: GAP, strokeWidth: SW });
  const shrink = (GAP + SW) / 2;
  check('gap: drawLength = length − 2×shrink', Math.abs(segs[0].drawLength - (segs[0].length - 2 * shrink)) < 1e-9);
  check('gap: drawOffset = offset + shrink', Math.abs(segs[0].drawOffset - shrink) < 1e-9 && Math.abs(segs[1].drawOffset - (segs[1].offset + shrink)) < 1e-9);
  const paintedGap = segs[1].drawOffset - SW / 2 - (segs[0].drawOffset + segs[0].drawLength + SW / 2);
  check('gap: khe nhìn thấy đúng = gap', Math.abs(paintedGap - GAP) < 1e-9);
}

// 9) Có gap nhưng chỉ một lát có giá trị (100%): vẽ vòng đầy, không thu ngắn, không khe
{
  const C2 = 2 * Math.PI * 55;
  const segs = donutSegments([0, 50], C2, { gap: 8, strokeWidth: 24 });
  check('gap + một lát 100%: drawLength = trọn chu vi', Math.abs(segs[1].drawLength - C2) < 1e-9);
  check('gap + một lát 100%: drawOffset = 0', segs[1].drawOffset === 0);
}

// 10) Có gap + lát quá nhỏ so với khe: rút thành chấm ở tâm lát, không số âm/NaN
{
  const C2 = 2 * Math.PI * 55;
  const segs = donutSegments([1000, 1], C2, { gap: 8, strokeWidth: 24 });
  check('gap + lát nhỏ: drawLength = 0 (chấm)', segs[1].drawLength === 0);
  check(
    'gap + lát nhỏ: chấm ở tâm lát, hữu hạn',
    Number.isFinite(segs[1].drawOffset) && Math.abs(segs[1].drawOffset - (segs[1].offset + segs[1].length / 2)) < 1e-9,
  );
  check('gap + lát nhỏ: lát lớn vẫn vẽ được', segs[0].drawLength > 0 && Number.isFinite(segs[0].drawLength));
}

// 11) Có gap + toàn 0: mọi trường đều 0, không NaN
{
  const segs = donutSegments([0, 0], CIRC, { gap: 8, strokeWidth: 24 });
  check(
    'gap + toàn 0: draw đều 0, không NaN',
    segs.every((s) => s.drawLength === 0 && s.drawOffset === 0 && Number.isFinite(s.fraction)),
  );
}

console.log(`\nKẾT QUẢ: ${passed} đạt, ${failed} trượt`);
if (failed > 0) process.exit(1);
