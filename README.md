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
