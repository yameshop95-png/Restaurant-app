# Test bản lưu tạm theo từng dòng (lib/listCache, DB v3)

Chạy: `npm run test:cache`

Bối cảnh: trước bản sửa này, mỗi lần lưu tạm ghi lại TOÀN BỘ danh sách xuống IndexedDB
(~250 ms ở 30.000 đơn, lặp lại ~630 lần/giờ/máy trong giờ bận — nút thắt số 1 của backtest
10 máy, xem `~/workspace/backtest-30k/RESULTS.md`). Nay mỗi dòng là 1 bản ghi riêng trong
kho `rows`, mỗi lần lưu chỉ ghi các dòng thay đổi.

Cách test giống `tests/sync-queue`: mỗi kịch bản gồm nhiều "phiên app" (process Node riêng)
dùng chung một thư mục trạng thái chứa IndexedDB giả (file JSON). IndexedDB giả đếm số thao
tác ghi (`idbOps`) để khẳng định được "chỉ ghi dòng thay đổi" thay vì chỉ kiểm tra kết quả cuối.

Kịch bản:
- a: lưu lần đầu ghi toàn bộ; sửa 1 dòng → chỉ ghi lại đúng dòng đó; phiên mới tải lại khớp.
- b: xoá dòng → đúng 1 delete trong kho; tải lại không còn dòng đó.
- c: di trú từ bản ghi kiểu cũ (DB v2, cả danh sách trong 1 bản ghi): vẫn đọc được ngay,
  lần lưu đầu sau nâng cấp tự chuyển sang dạng từng dòng.
- d: tải toàn bộ đối chiếu: dòng đang chờ gửi (còn trong danh sách theo hợp đồng của
  useCloudList) sống sót; dòng bị máy chủ xoá thì bị xoá khỏi kho, không sống lại.
- e: `cacheClear` (đăng xuất) dọn kho `lists` + `rows` nhưng giữ nguyên kho `sync`
  (hàng đợi ghi chưa gửi của PR #38); đăng nhập lại trong cùng phiên vẫn ghi đúng.
