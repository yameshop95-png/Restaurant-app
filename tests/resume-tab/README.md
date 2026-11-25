# Test: nhớ tab khi app tự tải lại + khung đỡ lỗi trang

Paul báo (25/11/2026): vào app bấm Báo cáo thì bị văng về màn hình chính, bấm
lại mới vào được. Nguyên nhân: các trang phụ tải lười (lazy); sau mỗi lần
deploy, tệp của bản cũ bị thay, lần bấm đầu xin phải tệp cũ → sự kiện
`vite:preloadError` → `main.jsx` tải lại trang → app khởi động lại ở tab
`home`. Lần bấm thứ hai đã có bản mới nên vào được.

Bản sửa gồm 3 phần và test này khoá cả 3:

1. `src/lib/resumeTab.js` — lưu tab đang xem vào `sessionStorage`;
   `App.jsx` khởi tạo `activeTab` từ đó và lưu lại mỗi lần chuyển tab, nên
   sau khi app tự tải lại nó mở lại đúng tab đang xem.
2. `src/components/PageErrorBoundary.jsx` — khung đỡ lỗi quanh khu vực
   trang: trang nào lỗi thì chỉ khu vực đó hiện thẻ "Chưa mở được mục này"
   + nút "Tải lại app", không sập cả app.
3. `main.jsx` — chống vòng lặp: nếu vừa tải lại vì `preloadError` trong
   30 giây mà vẫn lỗi thì không tự tải lại nữa, để khung đỡ lỗi xử lý.

Chạy: `npm run test:resumetab`
