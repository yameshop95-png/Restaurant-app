# Test đường số đơn và đường doanh thu theo tuần

Kiểm chứng số đơn và doanh thu mà biểu đồ "Lợi nhuận theo tuần" (`src/components/WeeklyProfitChart.jsx`) vẽ thành hai đường: cả hai đến từ `profitReport` (`src/lib/inventory.js`) chạy trên các mốc tuần của `periodRange('week', …)` (`src/lib/report.js`) — tuần Thứ Hai 00:00 → Thứ Hai tuần sau.

Test khẳng định trên dữ liệu giả: mốc tuần đúng quy ước và nối tiếp nhau; số đơn đếm đúng quy tắc "đơn chưa huỷ, tạo trong tuần" (kể cả ca biên 00:00 Thứ Hai và đơn huỷ), khớp với đếm tay theo cùng quy tắc; doanh thu (`revenue`) bằng tổng tiền của đúng tập đơn đó (món + phí ship − giảm giá), kể cả đơn giá khác nhau và đơn huỷ giá cao — tức hai đường và cột lợi nhuận luôn cùng một tập đơn, so sánh được với nhau.

Chạy: `npm run test:weekly`. `build.mjs` thay `hooks/useCustomers` bằng bản rút gọn (`stub-useCustomers.mjs`) vì `report.js` chỉ cần `normalizeText` từ module đó.
