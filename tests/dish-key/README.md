# Test dishKey + ngày bán (PR #80)

Kiểm: khoá gộp món dùng chung `dishKey` (bỏ đuôi trọng lượng, bí danh thực đơn),
`dishLabel`, và quy ước doanh thu theo NGÀY GIAO (`saleDate`) — đơn tạo thứ Hai hay
tối thứ Sáu giao thứ Bảy đều thuộc tuần giao đó; ba nơi tính món trong tuần
(`summarize` của Màn hình chính, `buildReport('week')` của Báo cáo, `weeklySeries`
của dự báo) phải cho cùng tổng số lượng từng món trên cùng một bộ đơn.

Chạy: `npm run test:dishkey` (TZ Australia/Melbourne được set trong session).
