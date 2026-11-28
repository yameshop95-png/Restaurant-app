# Test: đơn vị mua + quy đổi (Nhập hàng)

Paul (28/11/2026): mua bột gạo theo thùng (12 gói × 500 g = 6 kg), nấm mèo
theo gói 1000 g, nước mắm theo chai 700 ml — app cũ chỉ cho nhập theo đơn
vị dùng nên giá vốn sai (nấm mèo $17,24/gam) và giá mẻ đội lên ~$233/phần.

Thiết kế: nguyên liệu có thêm `buyUnit` (tên đơn vị mua) + `buySize` (số
đơn vị dùng trong 1 đơn vị mua), đặt ở mục Kho. Form nhập hàng có chế độ
"Theo {đơn vị mua}": nhập số lượng + giá 1 đơn vị mua (hoặc tổng tiền, hai
ô tự suy nhau), app quy đổi về đơn vị dùng khi lưu (`qty` luôn là đơn vị
dùng nên máy tính giá vốn/tồn kho không đổi) và lưu cách nhập gốc trong
`buy` để hiện ở lịch sử. Test khoá: hàm quy đổi, kịch bản mẻ Bánh cuốn
bằng số thật của Paul (sau sửa dữ liệu: mẻ ≈ $45,65 ≈ $3,04/phần), hồi
quy dữ liệu cũ, và khoá nguồn hai form.

Chạy: `npm run test:buyunit`
