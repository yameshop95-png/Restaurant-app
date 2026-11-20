# Nhật ký bàn giao của James → Claude

> File này do **James** (trợ lý của Paul trên Muse) duy trì trong repo để **Claude** nắm được
> những gì James đã làm, quyết định nào đã chốt, và việc gì còn mở — tránh làm trùng hoặc mâu thuẫn nhau.
> Cập nhật lần cuối: **2026-11-20** (sau khi PR #46 merge, main ở `253add7`).
> Quy ước chung: kiểm tra main mới nhất trước khi làm (hai bên làm song song);
> thay đổi của James luôn qua PR để Paul duyệt, chỉ merge khi Paul nói rõ cho từng PR.

---

## 1. Đã merge vào main

| PR | Nội dung | Merge commit |
|----|----------|--------------|
| #23 | Chuông đơn web: mẫu chuông thật (Freesound, CC0), lặp mỗi 3,5 giây tới khi nhân viên bấm Nhận/X; synth 4 tiếng chỉ còn là dự phòng | `5a0ffc9` |
| #38 | Hàng đợi đồng bộ offline lưu bền trong IndexedDB (store `sync`), sống sót khi đóng app/đăng xuất; op bị server từ chối được giữ lại kèm nút thử lại/bỏ qua ở TopBar | `a892988` |
| #39 | Gộp sự kiện realtime trong cửa sổ 400 ms; memo hoá tổng hợp ở Home | `234dbaf` |
| #40 | Cache danh sách chuyển sang lưu từng dòng (IndexedDB v3, store `rows`): sửa 1 dòng chỉ ghi 1 dòng (~286 ms → ~20 ms ở 30k dòng) | `4bea0f1` |
| #43 | Thẻ **Báo cáo Hiệu suất Tuần** ở mục Báo cáo (lãi gộp theo kênh web/tại quán, tổng đơn, đơn ≥ $50, doanh thu) + **xoá hẳn biểu đồ "Lợi nhuận theo tuần" khỏi Màn hình chính** (xoá cả file `WeeklyProfitChart.jsx`) | `099f41d` |
| #44 | (A) Thẻ lãi theo món ở Báo cáo — **đã bị PR #45 gỡ** (xem mục 3); (B) mục tiêu lãi tuần trong thẻ Hiệu suất — **đã bị PR #45 thay bằng mục tiêu tự động** | `caf1ee6` |
| #45 | 6 mục: tỉ lệ đơn huỷ; thẻ khách mới/quay lại; **mục tiêu lãi tự động theo dữ liệu**; thẻ nhịp tuần trong tháng; gỡ thẻ lãi theo món trùng ở Báo cáo; thêm biên lãi % ở Inventory | `79ced7e` |
| #46 | Thẻ **Hoạt Động Khách Hàng Website** ở tab Customer Active (xem mục 3) + tracker web thu thêm: mã khách bền, nguồn truy cập, thiết bị, múi giờ, lượt xem theo trang + `sql/customer_activity.sql` mở rộng (cột mới + khoá `insights`; **Paul đã chạy SQL trên Supabase ngày 2026-11-20**) + gỡ khối thống kê tỉ lệ theo kỳ cũ ở giữa trang (số hôm nay/7 ngày đã gộp vào thẻ mới) | `253add7` |

## 2. PR đã đóng KHÔNG merge

- **PR #42** (đường số đơn + đường doanh thu trên biểu đồ Home): đóng ngày 2026-11-20 kèm comment giải thích —
  Paul quyết định bỏ hẳn biểu đồ Home (việc xoá gộp vào PR #43) nên toàn bộ PR này hết ý nghĩa. Đừng mở lại.

## 3. Quyết định thiết kế hiện hành (đừng làm ngược lại)

- **Màn hình chính không còn biểu đồ lợi nhuận.** Số liệu tuần xem ở mục Báo cáo (thẻ Hiệu suất Tuần).
  Thiết lập `profitTarget` trong settings **không còn được dùng để vẽ** (giá trị lưu trên máy vẫn còn, vô hại).
- **Mục tiêu lãi tuần = TỰ ĐỘNG theo dữ liệu** (`src/lib/autoTarget.js`), Paul chốt công thức:
  mục tiêu của một tuần chỉ tính từ các tuần **đã kết thúc trước nó** (walk-forward):
  baseline = trung bình lãi ròng (trường `profit` của `profitReport`) của tối đa 4 tuần gần nhất;
  hệ số = lãi tuần gần nhất / baseline, kẹp trong **[0,8 – 1,2]**; mục tiêu = baseline × hệ số, làm tròn **$10**;
  không có lịch sử hoặc baseline ≤ 0 → không có mục tiêu.
  Ví dụ chuẩn: quanh $500 → mục tiêu $500; tuần gần nhất $600 → $600; $400 → $400.
- **Lãi theo món chỉ có MỘT chỗ: trang Inventory → tab "Lãi lỗ" → thẻ "Lãi theo món"**
  (dữ liệu `profitReport().dishes`, có bộ chọn kỳ riêng + thẻ Menu Engineering).
  Đừng thêm lại bản sao ở Báo cáo — PR #44 từng thêm và PR #45 đã gỡ vì trùng.
  Biên lãi % theo món hiển thị trong cùng thẻ đó (món chưa có công thức thì ẩn % để tránh con số 100% gây hiểu lầm).
- **Lãi theo kênh trong thẻ Hiệu suất là LÃI GỘP** (doanh thu kênh − giá vốn kênh).
  Chi phí chung của tuần (điện, bao bì…) không tách theo kênh được — lãi ròng tuần nằm trong tooltip của thẻ.
  Ngưỡng "đơn cao giá" = tổng đơn ≥ **$50**, hằng số `HIGH_VALUE_ORDER_MIN` ở đầu `profitReport` (`src/lib/inventory.js`).
- **Nhịp tuần trong tháng** (`WeekRhythmCard`): dùng đúng hàm `weekOfMonth` của `src/lib/forecast*`,
  chỉ tính tuần đã kết thúc, tối đa 6 tháng, cần ≥ 12 tuần dữ liệu mới kết luận (ít hơn thì hiện "chưa đủ dữ liệu").
- **Khách mới/quay lại** (`CustomerStatsCard`): định danh bằng `customerKey` của app
  (SĐT chỉ lấy chữ số; không có SĐT thì tên chuẩn hoá). Đơn huỷ không tạo lịch sử khách;
  đơn thiếu cả tên lẫn SĐT bị loại khỏi thống kê và được đếm công khai ở cuối thẻ.
- **Tab Customer Active — thẻ "Hoạt Động Khách Hàng Website"** (PR #46): đọc khoá `insights`
  của RPC `customer_activity()` (30 ngày + xu hướng 8 tuần; các khoá cũ `live`/`periods`/`abandoned`
  giữ nguyên; thẻ tự ẩn nếu phản hồi thiếu `insights`).
  **"Tương tác sâu" = thời lượng phiên ≥ 60 giây HOẶC `max_stage ≥ 1`.**
  Phễu 4 bước thật: Vào website → Có món trong giỏ → Vào trang đặt → Đã đặt xong (từ `periods.days30`) —
  KHÔNG có bước "xem chi tiết sản phẩm" vì web là menu một trang, không đo được.
  Nguồn truy cập phân loại ở `src/site/trackClassify.js`: google/facebook/instagram/zalo/direct/other
  (UTM ưu tiên hơn referrer, first-touch theo phiên). Khách quay lại tính theo `vid` bền
  (localStorage `site.vid`). Vị trí khách chỉ ở mức múi giờ — web không lấy được vị trí chính xác.
  Khối thống kê tỉ lệ theo kỳ cũ ở giữa trang đã gỡ; thẻ đang-online trực tiếp và danh sách khách bỏ dở giữ nguyên.

## 4. PR nháp đang mở — chờ Paul, ĐỪNG merge

- **PR #36** (`glass-dashboard-demo`): demo giao diện kính tối trên dashboard thật. Paul chưa chốt dùng hay không.
- **PR #41** (`light-glass-demo`): demo kính sáng trắng–xanh trên app thật (đang ở v3, đã bỏ backdrop-filter ở thẻ cho nhẹ máy). Paul chưa chốt.

## 5. Việc còn mở / cảnh báo đã biết (chưa ai làm)

- ⚠️ **`matchZone` (JS) và `match_zone` (SQL) đã lệch nhau** về dấu tiếng Việt (JS bỏ dấu, SQL chỉ hạ chữ thường)
  → phí ship đơn web có thể khác giữa client và server. Cần hợp nhất.
- **Dự báo (forecast)**: hệ số Tết học từ đúng 1 tuần Tết lịch sử và có thể bị tính trùng với nhóm ngày lễ;
  độ chính xác hiển thị có thể dựa trên chỉ 1 tuần backtest (lạc quan giả); `forecastLog` lưu 104 tuần nhưng
  chưa có code so với thực tế; danh sách chuẩn bị món chưa dùng kết quả dự báo.
- `esbuild` được `build:bridge` dùng nhưng chưa khai báo trong `package.json`.
- Bài toán hiệu năng dài hạn: khi dữ liệu tiệm tới ~40–50k đơn, nên cân nhắc chỉ tải 6–12 tháng gần nhất
  + bảng tổng hợp tháng (backtest 50k: app chậm rõ ở Home; 100k: Home gãy).
- Chuông đơn web **chưa khử trùng giữa các máy**: 1 đơn web kêu trên mọi máy mỗi 3,5 giây tới khi có người bấm Nhận
  (chưa chốt có chỉ định 1 máy kêu hay không).

## 6. Kiểm chứng quen dùng

- `npm run build`, `npm run test:sync` (7), `npm run test:performance` (54),
  `npm run test:dishprofit` (18 — test lớp dữ liệu `profitReport().dishes`, nuôi thẻ Inventory),
  `npm run test:insights` (35), `npm run test:cache`,
  `npm run test:classify` (39 — phân loại nguồn/thiết bị của tracker web).
- Không đụng khi chưa được giao: mã PIN, luồng đặt đơn, in bill, chuông báo, sync, cache.

---
*Claude khi làm xong việc gì lớn: cứ ghi tiếp vào file này (mục 1/5) hoặc nhắn Paul — James sẽ đồng bộ lại.*
