# Test hàng đợi đồng bộ (lib/sync)

Kiểm tra vấn đề audit #2: trước đây hàng đợi ghi chỉ nằm trong RAM — tắt app lúc mất mạng là mất hết thay đổi chưa gửi, và có thể để lại "đơn ma" trong bản lưu tạm.

Chạy:

```
npm run test:sync
```

Cách test: mỗi "phiên app" là một process Node riêng (mở app = chạy `session.mjs`, đóng app = process thoát). Các phiên trong một kịch bản dùng chung một thư mục trạng thái chứa:

- `idb.json` — IndexedDB giả (`fake-indexeddb.mjs`), đóng vai trò bộ nhớ bền trên máy;
- `server.json` + `net.json` — Supabase giả (`fake-supabase.mjs`): máy chủ lưu xuống file, mạng bật/tắt và lỗi từ chối được điều khiển bằng `net.json`. Khi đóng gói test, esbuild thay `src/lib/supabase` bằng bản giả nên test **không bao giờ đụng máy chủ thật**.

Kịch bản (trong `session.mjs`):

1. Tạo đơn + thêm khách + sửa đơn lúc mất mạng → đóng app → mở lại có mạng: hàng đợi khôi phục đủ, gửi đúng thứ tự, đơn không trùng.
2. Sửa cùng một đơn 2 lần lúc mất mạng → đóng app → mở lại: bản sửa cuối thắng.
3. Máy chủ từ chối (không phải lỗi mạng): thao tác được giữ lại bền qua lần đóng app; "Thử lại" (retrySync) gửi được khi hết lỗi; "bỏ qua" (clearError) xoá hẳn có chủ đích.
4. Có mạng: hành vi như cũ — gửi ngay, không để lại gì trong bản lưu bền.

Giới hạn: IndexedDB và Supabase ở đây là bản giả chạy trên file, không phải trình duyệt/máy chủ thật; mục đích là kiểm tra logic hàng đợi (lưu bền, khôi phục, thứ tự, xử lý lỗi) của `src/lib/sync.js` + `src/lib/listCache.js`.
