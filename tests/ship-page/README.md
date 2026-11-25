# Test Đơn ship (issue #79)

Kiểm: (a) badge Đơn ship dùng `deliveryAction` = done + delivering + failed, không
còn đếm đơn pending — khoá bằng cả source của App.jsx/BottomNav.jsx lẫn render thật
của BottomNav; (b) `planRouteByArea` xếp đơn Wodonga trước Albury dù đơn Albury hẹn
sớm hơn (cơ chế mà khối "Nấu xong, chờ mang đi" dùng để sắp thứ tự); (c) nút nổi
"Tạo đơn" trong OrdersPage.jsx được bọc điều kiện `!routeAllowed`.

Chạy: `npm run test:shippage`.
