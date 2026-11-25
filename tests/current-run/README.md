# Test currentRun (PR #82)

Kiểm lib/currentRun trên bộ đơn dựng sẵn quanh đợt giao thứ Bảy 28/11/2026:
thuộc đợt theo ngày giao, đơn huỷ loại; nhịp nhận đơn so với 4 đợt trước ở cùng
khoảng cách tới ngày giao (chênh < 3 đơn thì ẩn %); 6 ô Tiến độ đợt là một phân
hoạch (tổng = số đơn của đợt, khớp isInboxOrder/isCookingOrder); tiền đợt; cơ cấu
Wodonga / Albury – Lavington / chưa rõ; thẻ B gộp món bằng dishKey và "còn dự kiến"
không âm; quy tắc Chủ nhật chuyển đợt; weeklyRevenue 8 cột tuần giao.

Chạy: `npm run test:currentrun`.
