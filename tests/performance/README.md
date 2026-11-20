# Test thẻ Báo cáo Hiệu suất Tuần

Kiểm chứng phần dữ liệu của thẻ "Báo cáo Hiệu suất Tuần" (`src/components/WeeklyPerformanceCard.jsx`): thẻ lấy mọi số từ `profitReport` (`src/lib/inventory.js`) chạy trên các mốc tuần của `periodRange('week', …)` (`src/lib/report.js`) — tuần Thứ Hai 00:00 → Thứ Hai tuần sau.

Lượt mở rộng của `profitReport` cho thẻ này thêm `channels` (doanh thu / giá vốn / lãi gộp tách theo kênh bán) và `highValueOrders` (số đơn cao giá). Kênh đọc từ trường `source` của đơn: đơn khách đặt qua website do `place_web_order` ghi `source: 'web'`; đơn nhân viên tạo trong app không có `source` → kênh tại quán. Lãi gộp kênh = doanh thu kênh − giá vốn kênh (giá vốn tính được cho từng đơn); chi phí khác là chi phí chung của kỳ nên không gán cho kênh nào. Đơn cao giá: tổng tiền đơn (món + phí ship − giảm giá) từ `HIGH_VALUE_ORDER_MIN` ($50) trở lên.

Test khẳng định trên dữ liệu giả: mốc tuần đúng quy ước và nối tiếp nhau; các trường cũ của `profitReport` (revenue / cogs / otherCosts / profit / orders) giữ đúng giá trị như trước; cộng hai kênh từng tuần bằng tổng toàn tuần và khớp tách tay theo `source`; đơn cao giá đếm đúng các ca biên của ngưỡng $50 (đơn đúng $50 được tính, đơn $49,99 không, đơn huỷ bị loại).

Chạy: `npm run test:performance`. `build.mjs` thay `hooks/useCustomers` bằng bản rút gọn (`stub-useCustomers.mjs`) vì `report.js` chỉ cần `normalizeText` từ module đó.
