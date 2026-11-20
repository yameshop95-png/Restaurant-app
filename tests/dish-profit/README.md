# Test: Top món theo lãi gộp + mục tiêu lãi tuần (Báo cáo)

Chạy: `npm run test:dishprofit`

Đóng gói `session.mjs` bằng esbuild rồi chạy trong process riêng, giống mẫu
`tests/performance` (thay `hooks/useCustomers` bằng bản rút gọn từ `src/lib/text.js`
để không kéo theo hooks + supabase; `inventory.js` / `report.js` dùng nguyên bản).

`session.mjs` khẳng định trên dữ liệu giả (now cố định Thứ Tư 18/11/2026):

- **Tính năng A** — mảng `dishes` của `profitReport` (dữ liệu nuôi thẻ "Lãi theo món"
  ở tab "Lãi lỗ" của trang Inventory; thẻ `DishProfitCard` ở tab Báo cáo từng dùng
  cùng mảng này đã được gỡ vì trùng lặp với Inventory):
  từng món đúng số phần / doanh thu / giá vốn / lãi gộp, xếp giảm dần theo lãi gộp,
  tỉ lệ lãi % = lãi gộp ÷ doanh thu món, cộng các món = lãi gộp toàn kỳ
  (doanh thu − giá vốn), đơn huỷ bị loại, và đổi sang kỳ tháng thì số đổi theo.
- **Tính năng B** — đường mục tiêu + dấu ◆ của `WeeklyPerformanceCard` dùng chuỗi
  lãi ròng theo tuần (`profit` của `profitReport` trên các mốc tuần
  `periodRange('week', shiftPeriod('week', now, -i))`): khớp số tính tay
  (doanh thu − giá vốn − chi phí khác) và phép so với mục tiêu cho kết quả
  đạt / còn thiếu đúng.
