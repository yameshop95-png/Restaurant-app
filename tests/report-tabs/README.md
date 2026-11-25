# Test chia tab Báo cáo (PR #81)

Render SSR ReportPage ở từng tab (qua prop `initialTab` chỉ dùng cho test) và kiểm:
tab Theo kỳ đủ các thẻ theo plan (chọn kỳ, Tổng quan, Hiệu suất tuần, Doanh thu,
Dự báo doanh thu, Tổng món đã bán, Nhịp tuần, Thời điểm, Nhận xét nhanh, Xuất dữ
liệu ở cuối); tab Khách & món đủ 4 thẻ + dòng "Kỳ: …"; tab Đợt này hiện thẻ giữ
chỗ; thẻ của tab khác không lọt sang; hàng món có cấu trúc 2 hàng cho dưới sm.

Chạy: `npm run test:reporttabs`.
