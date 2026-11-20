# Test: Tỉ lệ đơn huỷ + Khách mới/quay lại + Mục tiêu lãi tự động + Nhịp tuần trong tháng (Báo cáo)

Chạy: `npm run test:insights`

Đóng gói `session.mjs` bằng esbuild rồi chạy trong process riêng, giống mẫu
`tests/dish-profit` (thay `hooks/useCustomers` bằng bản rút gọn trong
`stub-useCustomers.mjs` để không kéo theo hooks + supabase; các lib còn lại dùng
nguyên bản).

`session.mjs` khẳng định trên dữ liệu giả (now cố định Thứ Tư 18/11/2026):

- **Tỉ lệ đơn huỷ** — `periodInsights(orders, range).cancellation`: tổng đơn trong kỳ
  gồm cả đơn huỷ, số đơn huỷ, tỉ lệ đúng; kỳ trống cho tỉ lệ `null` (không chia 0).
- **Khách mới / quay lại** — `periodInsights(...).customers` với khoá định danh
  `customerKey` của app (SĐT chỉ lấy chữ số nên viết khác định dạng vẫn là một khách;
  không SĐT thì theo tên): khách có đơn trước kỳ là quay lại, lần đầu trong kỳ là
  mới, đơn huỷ không tạo lịch sử và không tính là khách, đơn không định danh bị loại.
- **Mục tiêu lãi tự động** — `weeklyAutoTarget` / `attachAutoTargets` (lib/autoTarget):
  ba ví dụ đã chốt ($500 → $500, tuần gần nhất $600 → $600, $400 → $400), kẹp hệ số
  [0,8 – 1,2], làm tròn $10, ít hơn 4 tuần lịch sử, không có lịch sử / baseline ≤ 0
  cho `null`, walk-forward (mục tiêu của một tuần không dùng lãi của chính tuần đó),
  và tích hợp với chuỗi lãi ròng thật từ `profitReport`.
- **Nhịp tuần trong tháng** — `weekOfMonthRhythm`: fixture 15 tuần đã kết thúc trải
  8–11/2026 chứng minh vị trí tuần (theo `weekOfMonth` của lib/forecast) được tính
  đúng, tuần đang chạy và đơn huỷ bị loại, đơn TB mỗi vị trí và % chênh so với TB
  một tuần thường đúng, đông nhất / vắng nhất đúng; lịch sử chỉ 3 tuần cho trạng
  thái "chưa đủ dữ liệu".
