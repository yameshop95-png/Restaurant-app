// Mục tiêu lãi ròng TỰ ĐỘNG theo tuần cho thẻ "Báo cáo Hiệu suất Tuần" (tab Báo cáo),
// thay cơ chế đặt tay `profitTarget` trước đây: mỗi tuần có một mức mục tiêu riêng, tính
// walk-forward — chỉ từ lãi ròng (trường `profit` của profitReport) của các tuần ĐÃ KẾT
// THÚC trước tuần đó, nên nhìn lại lịch sử không bị "biết trước tương lai".
//
// Công thức (đã chốt với chủ quán):
//   prev     = lãi ròng của tối đa 4 tuần đã kết thúc gần nhất trước tuần đang xét.
//   baseline = trung bình(prev). prev rỗng hoặc baseline ≤ 0 → không có mục tiêu (null).
//   hệ số    = lãi tuần đã kết thúc gần nhất ÷ baseline, kẹp trong [0,8 – 1,2]:
//              tuần gần nhất tốt hơn mặt bằng thì kỳ vọng nhích lên, yếu hơn thì hạ xuống,
//              nhưng không bao giờ lệch quá ±20% quanh mặt bằng để một tuần đột biến
//              (lễ, sự kiện) không kéo mục tiêu đi quá xa.
//   mục tiêu = baseline × hệ số, làm tròn đến $10 gần nhất.
// Hệ quả dễ kiểm chứng: khi hệ số không bị kẹp, mục tiêu ≈ lãi của tuần gần nhất
// (VD các tuần trước đều ~$500 và tuần gần nhất $500 → mục tiêu $500; tuần gần nhất
// tăng lên $600 → mục tiêu $600; giảm còn $400 → mục tiêu $400).

export const AUTO_TARGET_MAX_WEEKS = 4;
export const AUTO_TARGET_MIN_FACTOR = 0.8;
export const AUTO_TARGET_MAX_FACTOR = 1.2;

// prevProfits: lãi ròng các tuần đã kết thúc trước tuần đang xét, xếp cũ → mới.
// Trả về mục tiêu (A$, đã làm tròn $10) hoặc null khi không đủ cơ sở để đặt mục tiêu.
export function weeklyAutoTarget(prevProfits) {
  const prev = (prevProfits ?? []).slice(-AUTO_TARGET_MAX_WEEKS);
  if (!prev.length) return null;
  const baseline = prev.reduce((s, v) => s + v, 0) / prev.length;
  if (!(baseline > 0)) return null;
  const last = prev[prev.length - 1];
  const factor = Math.min(AUTO_TARGET_MAX_FACTOR, Math.max(AUTO_TARGET_MIN_FACTOR, last / baseline));
  const target = Math.round((baseline * factor) / 10) * 10;
  return target > 0 ? target : null;
}

// weeks: chuỗi tuần liên tiếp xếp cũ → mới, mỗi tuần có trường `profit` (lãi ròng);
// tuần cuối thường là tuần đang diễn ra. Trả về mảng mục tiêu cùng thứ tự: mục tiêu của
// tuần i chỉ dùng lãi của các tuần trước i (mọi tuần trước i đều đã kết thúc khi tuần i
// bắt đầu vì các tuần nối tiếp nhau) — đúng walk-forward.
export function attachAutoTargets(weeks) {
  return weeks.map((_, i) =>
    weeklyAutoTarget(weeks.slice(Math.max(0, i - AUTO_TARGET_MAX_WEEKS), i).map((w) => w.profit)),
  );
}
