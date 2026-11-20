# Test đường số đơn theo tuần

Kiểm chứng số đơn mà biểu đồ "Lợi nhuận theo tuần" (`src/components/WeeklyProfitChart.jsx`) vẽ thành đường: số đó đến từ `profitReport` (`src/lib/inventory.js`) chạy trên các mốc tuần của `periodRange('week', …)` (`src/lib/report.js`) — tuần Thứ Hai 00:00 → Thứ Hai tuần sau.

Test khẳng định trên dữ liệu giả: mốc tuần đúng quy ước và nối tiếp nhau; số đơn đếm đúng quy tắc "đơn chưa huỷ, tạo trong tuần" (kể cả ca biên 00:00 Thứ Hai và đơn huỷ), khớp với đếm tay theo cùng quy tắc — tức đường số đơn và cột lợi nhuận luôn cùng một tập đơn.

Chạy: `npm run test:weekly`. `build.mjs` thay `hooks/useCustomers` bằng bản rút gọn (`stub-useCustomers.mjs`) vì `report.js` chỉ cần `normalizeText` từ module đó.
