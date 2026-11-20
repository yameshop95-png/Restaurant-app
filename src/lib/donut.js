// Toán học vẽ biểu đồ tròn (donut) — hàm thuần, không đụng DOM.
// Nhận danh sách giá trị + chu vi vòng tròn, trả về từng lát:
//   fraction — tỉ lệ 0..1 của lát
//   percent  — phần trăm nguyên; làm tròn theo phần dư lớn nhất (largest
//              remainder) nên tổng luôn đúng 100 khi tổng giá trị > 0
//   length   — độ dài cung của lát (cùng đơn vị với chu vi truyền vào)
//   offset   — điểm bắt đầu của lát tính từ đầu vòng tròn
// Giá trị âm / NaN / không phải số coi như 0. Tổng = 0 thì mọi lát đều 0
// (không chia cho 0, không NaN). Test: tests/donut (npm run test:donut).

export function donutSegments(values, circumference) {
  const nums = values.map((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const total = nums.reduce((s, n) => s + n, 0);
  if (total <= 0) {
    return nums.map(() => ({ fraction: 0, percent: 0, length: 0, offset: 0 }));
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

  let acc = 0;
  return nums.map((n, i) => {
    const fraction = n / total;
    const seg = { fraction, percent: percents[i], length: fraction * circumference, offset: acc };
    acc += seg.length;
    return seg;
  });
}
