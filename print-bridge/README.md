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

## Tự chạy khi bật máy tính (Windows)

1. Mở `start-bridge.bat` bằng Notepad, sửa dòng `set STAFF_PIN=` thành mã PIN của "Máy in quán" (và `PRINTER_NAME` nếu tên máy in trong Windows khác). Lưu lại.
2. Bấm đúp `start-bridge.bat` để thử. Thấy "Đang chờ lệnh in" là được. Cầu nối tự chạy lại nếu bị lỗi mạng; nếu PIN sai thì dừng hẳn để khỏi bị khoá.
3. Bấm đúp `install-autostart.bat` một lần: từ nay bật máy tính là cầu nối tự chạy (cửa sổ thu nhỏ ở thanh taskbar, đừng tắt).
4. Đặt máy tính không tự ngủ: Settings → System → Power → Sleep = Never.

## Kiểm tra

- In thử bằng cách bấm **In ở quán** trên một đơn. Bill phải ra máy trong vài giây.
- Nếu máy in không ra giấy, xem dòng báo lỗi trong cửa sổ Node và kiểm tra máy in có bật, có cùng mạng không.
- Bill không có dấu tiếng Việt (máy nhiệt không hỗ trợ), ví dụ "DEN LAY", "TONG".

## Lưu ý

- Bill có tên và địa chỉ khách, nên chỉ chạy cầu nối trên máy của quán.
- Đơn in xong được đánh dấu `printed`. Bảng này sẽ dài dần theo thời gian, bạn có thể xoá các dòng cũ định kỳ.
