# Cầu nối in bill ra máy Uniwell UP-A1

App nhân viên bấm **In ở quán** → bill được xếp vào bảng `print_jobs` → máy tính ở quán đọc và gửi xuống máy in qua mạng (IP, cổng 9100).

## Chuẩn bị (một lần)

1. **Database:** trong SQL Editor của project restaurant-app, chạy file `print-bridge/print_jobs.sql`.
2. **Tạo tài khoản máy in trong app:** Cài đặt → Nhân viên & mã PIN → Thêm người, đặt tên "Máy in quán" và một mã 4 số (ví dụ mã riêng, không trùng mã nhân viên).
3. **Máy tính ở quán:** cài Node.js (bản LTS, nodejs.org) và copy thư mục `print-bridge/` vào máy.
4. Trong thư mục `print-bridge/`, chạy `npm install` một lần.

## Máy in USB (không có mạng)

Nếu máy in chỉ kết nối USB, cài máy trong Windows trước (tên **Uniwell**, driver Generic / Text Only, cổng USB001). Khi chạy cầu nối, đặt thêm `PRINTER_NAME=Uniwell` và bỏ `PRINTER_IP`.

## Chạy

Windows (PowerShell):
```
$env:SUPABASE_URL="https://hgkqcswzggsbpusrhpue.supabase.co"
$env:SUPABASE_KEY="sb_publishable_qm7OXVxaPuwAhAB2zjOXow_7zBFNnON"
$env:STAFF_PIN="mã-máy-in"
$env:PRINTER_IP="192.168.1.100"
node bridge.mjs
```

Mac / Linux: đặt các biến tương tự rồi chạy `node bridge.mjs`.

Khi thấy dòng "Đang chờ lệnh in", máy đã sẵn sàng. Để máy tính này luôn bật và cùng mạng với máy in.

## Kiểm tra

- In thử bằng cách bấm **In ở quán** trên một đơn. Bill phải ra máy trong vài giây.
- Nếu máy in không ra giấy, xem dòng báo lỗi trong cửa sổ Node và kiểm tra máy in có bật, có cùng mạng không.
- Bill không có dấu tiếng Việt (máy nhiệt không hỗ trợ), ví dụ "DEN LAY", "TONG".

## Lưu ý

- Bill có tên và địa chỉ khách, nên chỉ chạy cầu nối trên máy của quán.
- Đơn in xong được đánh dấu `printed`. Bảng này sẽ dài dần theo thời gian, bạn có thể xoá các dòng cũ định kỳ.
