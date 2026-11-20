// Toán học vẽ biểu đồ tròn (donut) — hàm thuần, không đụng DOM.
// Nhận danh sách giá trị + chu vi vòng tròn, trả về từng lát:
//   fraction — tỉ lệ 0..1 của lát
//   percent  — phần trăm nguyên; làm tròn theo phần dư lớn nhất (largest
//              remainder) nên tổng luôn đúng 100 khi tổng giá trị > 0
//   length   — độ dài cung của lát (cùng đơn vị với chu vi truyền vào)
//   offset   — điểm bắt đầu của lát tính từ đầu vòng tròn
//   drawLength / drawOffset — đoạn cung THỰC VẼ khi có khe hở giữa các lát
//              (options { gap, strokeWidth }, xem dưới); không có gap thì
//              bằng đúng length / offset.
// Giá trị âm / NaN / không phải số coi như 0. Tổng = 0 thì mọi lát đều 0
// (không chia cho 0, không NaN). Test: tests/donut (npm run test:donut).
//
// Khe hở (style lát bo tròn theo hình mẫu): gap là khe hở NHÌN THẤY giữa
// hai lát kề nhau, strokeWidth là bề dày của lát. Đầu bo tròn
// (stroke-linecap="round") nhô ra strokeWidth/2 ở mỗi đầu nét vẽ, nên mỗi
// lát phải thu ngắn (gap + strokeWidth)/2 ở mỗi đầu thì khe nhìn thấy mới
// đúng bằng gap. Lát quá nhỏ so với phần thu ngắn sẽ rút thành một chấm
// tròn ở tâm lát (drawLength = 0, drawOffset = tâm lát). Chỉ một lát có
// giá trị (chiếm trọn vòng) thì không thu ngắn — vẽ vòng đầy, không khe.

export function donutSegments(values, circumference, options = {}) {
  const nums = values.map((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const total = nums.reduce((s, n) => s + n, 0);
  if (total <= 0) {
    return nums.map(() => ({ fraction: 0, percent: 0, length: 0, offset: 0, drawLength: 0, drawOffset: 0 }));
  }

  const exact = nums.map((n) => (n / total) * 100);
  const percents = exact.map((p) => Math.floor(p));
  let missing = 100 - percents.reduce((s, p) => s + p, 0);
  const byRemainder = exact
    .map((p, i) => ({ i, r: p - Math.floor(p) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of byRemainder) {
    if (missing <= 0) break;
    percents[i] += 1;
    missing -= 1;
  }

  const gapOpt = Number(options?.gap);
  const swOpt = Number(options?.strokeWidth);
  const gap = Number.isFinite(gapOpt) && gapOpt > 0 ? gapOpt : 0;
  const strokeWidth = Number.isFinite(swOpt) && swOpt > 0 ? swOpt : 0;
  const nonZero = nums.filter((n) => n > 0).length;
  const shrink = gap > 0 && nonZero > 1 ? (gap + strokeWidth) / 2 : 0;

  let acc = 0;
  return nums.map((n, i) => {
    const fraction = n / total;
    const length = fraction * circumference;
    const offset = acc;
    acc += length;
    let drawLength = length;
    let drawOffset = offset;
    if (shrink > 0 && n > 0) {
      if (length - 2 * shrink >= 1) {
        drawLength = length - 2 * shrink;
        drawOffset = offset + shrink;
      } else {
        // Lát quá nhỏ so với khe: rút thành chấm tròn ở tâm lát
        drawLength = 0;
        drawOffset = offset + length / 2;
      }
    }
    const seg = { fraction, percent: percents[i], length, offset, drawLength, drawOffset };
    return seg;
  });
}
