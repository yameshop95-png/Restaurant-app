# Test opsReport (PR #83)

Kiểm lib/opsReport theo đúng các ca ở plan: xác định vùng theo thứ tự địa chỉ →
geo → chưa rõ; tổng các hàng vùng = tổng đơn giao; ngưỡng cảnh báo 20%; đúng giờ
ở biên ±30 phút; gộp công nợ theo SĐT viết khác nhau vẫn là một khách và danh
sách orderIds của nút "Đã thu" gồm đúng các đơn của khách đó; thời gian xác nhận
bỏ qua đơn thiếu mốc; tách phí ship/chi phí xăng theo vùng phí.

Chạy: `npm run test:opsreport`.
