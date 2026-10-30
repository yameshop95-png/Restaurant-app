# Restaurant App

Web dashboard nhận order đồ ăn cho nhân viên nhà hàng (React + Tailwind CSS + lucide-react).

## Chạy thử

```bash
npm install
npm run dev
```

## Cấu trúc

- `src/App.jsx` – layout gốc, state tab đang mở và số đơn chờ
- `src/components/navigation.js` – cấu hình các tab
- `src/components/Sidebar.jsx` – logo, trạng thái nhân viên, thông báo đơn mới, menu
- `src/components/TopBar.jsx` – header cố định với chuông thông báo
- `src/pages/index.jsx` – component placeholder cho từng tab

## Dữ liệu dùng chung & đăng nhập (Supabase)

Đơn hàng, khách, thực đơn và thông tin quán lưu trên Supabase (project `restaurant-app`, Sydney),
mọi máy đăng nhập thấy cùng dữ liệu và cập nhật ngay (realtime).

- Đăng nhập bằng mã PIN 4 số, không cần email. Mỗi máy dùng một phiên ẩn danh của Supabase
  (cần bật **Authentication → Sign In / Providers → Allow anonymous sign-ins**), nhập đúng PIN thì
  máy chủ gắn phiên đó với tài khoản (`pin_login`).
- Quyền kiểm tra trong database (RLS): chủ quán làm được tất cả; nhân viên tạo / xử lý đơn, sửa khách,
  báo Còn / Hết món, không sửa giá, thông tin quán, mã PIN, không xoá. Báo cáo và doanh thu chỉ ẩn trên
  giao diện nhân viên (giá từng đơn vẫn đọc được qua API).
- Chủ quán quản lý mã PIN ở **Cài đặt app → Nhân viên & mã PIN**. Đổi mã / đổi quyền / xoá thì các máy
  đang dùng mã cũ bị đăng xuất. Sai 5 lần trên một máy: khoá máy đó 5 phút.
- URL và khoá publishable để sẵn trong `src/lib/supabase.js` (đổi bằng `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`). Không bao giờ đưa khoá `service_role` vào app.
- Ghi dữ liệu đi qua hàng đợi `src/lib/sync.js`: mất mạng thì giữ lại và tự gửi khi có mạng.

## Website cho khách (/order)

`src/site/`: trang chủ, thực đơn có ảnh, trang từng món, blog (tiếng Anh, để lên Google), đặt món.
App nhân viên (/) giữ nguyên, không có ảnh / blog.

- **Nội dung** nằm trong code (sửa rồi deploy là cập nhật; trang quản lý nội dung sẽ làm sau):
  - `src/site/data/dishes.js`: ảnh, mô tả, định lượng, danh mục, món nổi bật. Ghép với thực đơn trong app theo tên món.
  - `src/site/data/posts.js`: bài blog (Markdown đơn giản).
  - Ảnh món: đặt vào `public/site/photos/` rồi ghi đường dẫn (vd `/site/photos/banh-cuon.webp`) vào `photo`.
- **Giá, còn / hết, thông tin quán** lấy từ máy chủ: lúc build (để Google thấy) và mỗi lần khách mở trang (để luôn mới).
- **Dựng sẵn HTML** (`npm run build`): `vite build` → build SSR `src/site/entry-server.jsx` → `scripts/prerender.mjs`
  ghi `dist/order/**/index.html`, `sitemap.xml`, `robots.txt` (chặn Google đọc app nhân viên ở /).
- **Đặt món** (`/order/checkout`): gọi `place_web_order` trên Supabase. Máy chủ lấy giá từ thực đơn, tính phí ship
  (`match_zone`, cùng quy tắc với `src/lib/shippingZones.js`), kiểm tra giờ (đến lấy: đặt trước N phút; giao: buổi giao
  hằng tuần, mặc định sáng thứ 7, hạn chót hôm trước), chặn spam, tạo đơn `source: 'web'`, lưu khách vào danh bạ.
- Chủ quán bật / tắt và chỉnh giờ ở **Cài đặt app → Website đặt món**.
- Trang website không có service worker / manifest của app (`order-page-without-pwa` và `globIgnores` trong vite.config.js).

## Phân tích bằng AI (tab Báo cáo)

Nút "Phân tích bằng AI" gọi `api/analyze.js` (Vercel Serverless Function), dùng Claude để nhận xét số liệu.
Chỉ gửi số liệu tổng hợp (doanh thu, món, thời điểm), không gửi tên / SĐT / địa chỉ khách.

Cài trên Vercel → Project → Settings → Environment Variables:

- `ANTHROPIC_API_KEY` (bắt buộc): API key tạo tại https://console.anthropic.com
- `AI_ACCESS_CODE` (nên có): mã tuỳ chọn; nếu đặt, app sẽ hỏi mã này trước khi phân tích, để người lạ có link không dùng được AI bằng tiền của bạn

Đổi biến xong cần deploy lại.
