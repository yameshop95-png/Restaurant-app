# Test mô hình lãi theo dòng tiền (không cần công thức)

Chạy: `npm run test:cashview`

Ngữ cảnh (Paul, 28/11/2026): anh chốt mô hình đơn giản — nhập hàng ghi
tổng chi phí, cứ làm, bán thu vô, trừ ra. Không bắt buộc công thức/mẻ.
profitReport đã có sẵn `bought` (tổng tiền mua hàng trong kỳ) và
`cashNet = doanh thu − bought − chi phí khác`; PR này đưa thẻ Dòng tiền
lên làm số chính ở tab Kho → Lãi lỗ, thẻ "Lãi theo giá vốn công thức"
xuống thành tham khảo. Suite khoá: số dòng tiền đúng khi không có công
thức nào, và thứ tự/nhãn hai thẻ trong InventoryPage.
