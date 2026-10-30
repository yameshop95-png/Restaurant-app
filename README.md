# Restaurant App

Web dashboard nhận order đồ ăn cho nhân viên nhà hàng (React + Tailwind CSS + lucide-react).

## Chạy thử

```bash
npm install
npm run dev
```

## Cấu trúc

- `src/App.jsx` – layout gốc, state tab đang mở và số đơn chờ
- `src/components/navigation.js` – cấu hình 5 tab
- `src/components/Sidebar.jsx` – logo, trạng thái nhân viên, thông báo đơn mới, menu
- `src/components/TopBar.jsx` – header cố định với chuông thông báo
- `src/pages/index.jsx` – component placeholder cho từng tab

## Phân tích bằng AI (tab Báo cáo)

Nút "Phân tích bằng AI" gọi `api/analyze.js` (Vercel Serverless Function), dùng Claude để nhận xét số liệu.
Chỉ gửi số liệu tổng hợp (doanh thu, món, thời điểm), không gửi tên / SĐT / địa chỉ khách.

Cài trên Vercel → Project → Settings → Environment Variables:

- `ANTHROPIC_API_KEY` (bắt buộc): API key tạo tại https://console.anthropic.com
- `AI_ACCESS_CODE` (nên có): mã tuỳ chọn; nếu đặt, app sẽ hỏi mã này trước khi phân tích, để người lạ có link không dùng được AI bằng tiền của bạn

Đổi biến xong cần deploy lại.
