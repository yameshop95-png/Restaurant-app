# Nhật ký bàn giao của James → Claude

> File này do **James** (trợ lý của Paul trên Muse) duy trì trong repo để **Claude** nắm được
> những gì James đã làm, quyết định nào đã chốt, và việc gì còn mở — tránh làm trùng hoặc mâu thuẫn nhau.
> Cập nhật lần cuối: **2026-11-21** (PR #51 đã merge; PR #52 nháp — quy trình giao hàng GĐ1 — đang chờ Paul duyệt; main ở `bbc8d74`).
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
| #47 | **Nới rộng bố cục + sửa tooltip biểu đồ** (xem mục 3): Báo cáo/Customer Active/Kho trải hết bề ngang ở màn ≥1024px; tooltip biểu đồ chuyển sang component chung `ChartTip` — tách theo từng tầng, bỏ tooltip native của trình duyệt | `41460ff` |
| #48 | Thẻ **Chốt ca hôm nay** ở Home thành **donut vòng liền mạch** (số liệu `dailyCollection` giữ nguyên) + **dời thẻ lên trên cùng Home**; toán lát ở `src/lib/donut.js` | `cb37b57` |
| #50 | Thẻ **Tiền tuần này** ở Home thành **donut lát bo tròn + khe hở** theo hình mẫu của Paul (tâm = tổng tuần; vòng: Đã thanh toán / Chưa thanh toán từ `summarize()`) + mở rộng `donut.js` thêm `drawLength`/`drawOffset`. **Đây là bản dựng lại của PR #49** trên main sau #48 (xem mục 2) — nội dung y hệt | `62d51d0` |
| #51 | Bỏ 2 ô riêng **Đã/Chưa thanh toán** ở mục Tổng tuần này (Home) vì trùng số liệu với chú thích của donut Tiền tuần này (PR #50) — chỉ bỏ hiển thị, không đụng `stats` | `96892da` |

## 2. PR đã đóng KHÔNG merge

- **PR #42** (đường số đơn + đường doanh thu trên biểu đồ Home): đóng ngày 2026-11-20 kèm comment giải thích —
  Paul quyết định bỏ hẳn biểu đồ Home (việc xoá gộp vào PR #43) nên toàn bộ PR này hết ý nghĩa. Đừng mở lại.
- **PR #49** (donut Tiền tuần này): đóng ngày 2026-11-21 KHÔNG merge vì xung đột add/add với main
  ở `src/lib/donut.js` + `tests/donut/run.mjs` sau khi PR #48 merge (cả hai PR cùng tạo mới hai file này).
  Nội dung đã hoà, kiểm chứng (build + test:donut 23/23 + mọi suite) và merge qua **PR #50**. Đừng mở lại PR #49.

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
- **Bề rộng trang + tooltip biểu đồ** (PR #47): wrapper gốc của ReportPage/CustomerActivityPage/InventoryPage
  có class riêng (`report-page`/`activity-page`/`inventory-page`) và quy tắc ở cuối `src/index.css`:
  `@media ≥1024px` thì `max-width: none` (trải hết vùng main); dưới 1024px giữ max-width cũ.
  Các trang còn lại giữ nguyên bề rộng (Home/Đơn hàng/Chuẩn bị đã tự nới theo bậc; Khách hàng/Món ăn là danh sách 1 cột; Cài đặt là form).
  Tooltip biểu đồ dùng component chung **`src/components/ChartTip.jsx`**: mỗi tầng biểu đồ một hộp riêng,
  hiện khi rê chuột/chạm ô tuần, ẩn khi rê ra hoặc chạm chỗ khác (thuộc tính `data-chart-tip-zone`),
  bề rộng cố định và kẹp trong vùng vẽ bằng `clamp()`. **Đừng dùng lại tooltip native `title`** cho chấm biểu đồ —
  nó không hiện khi chạm trên mobile và tự ẩn sau vài giây (đây là lỗi Paul bắt gặp).
- **Hai donut ở Home — hai mẫu KHÁC nhau theo ý Paul** (đừng đồng bộ style):
  thẻ **Chốt ca hôm nay** (đứng trên cùng Home, chỉ quản lý/chủ thấy) là vòng liền mạch —
  lát theo cách trả (tiền mặt emerald / chuyển khoản xanh dương / PayID tím / chưa ghi cách trả xám) + Còn phải thu đỏ nhạt,
  mẫu số = đã thu + còn phải thu hôm nay, tâm = đã thu hôm nay.
  Thẻ **Tiền tuần này** là lát **bo tròn hai đầu + khe hở** — tâm = tổng tiền tuần + số đơn;
  vòng chỉ 2 lát: Đã thanh toán `#3b82f6` / Chưa thanh toán `#f87171`.
  Cả hai dùng chung `src/lib/donut.js` (`donutSegments(values, circumference, {gap, strokeWidth})` —
  không truyền options thì ra các trường cũ cho Chốt ca; có gap thì thêm `drawLength`/`drawOffset`).
  Định nghĩa tiền tuần lấy từ `summarize()` (`src/lib/stats.js`): đơn chưa huỷ, `createdAt` từ 00:00 thứ Hai;
  đã thanh toán = đơn có `paid = true` (`weekPaid`), chưa thanh toán = `weekRevenue − weekPaid` (`weekUnpaid`).

## 4. PR nháp đang mở — chờ Paul, ĐỪNG merge

- **PR #36** (`glass-dashboard-demo`): demo giao diện kính tối trên dashboard thật. Paul chưa chốt dùng hay không.
- **PR #41** (`light-glass-demo`): demo kính sáng trắng–xanh trên app thật (đang ở v3, đã bỏ backdrop-filter ở thẻ cho nhẹ máy). Paul chưa chốt.
- **PR #52** (`delivery-phase1`, base `bbc8d74`): **quy trình giao hàng GĐ1** theo bản Paul đã chốt
  (tài liệu `quy-trinh-giao-hang-de-xuat-2026-11-21.md` ở workspace của James): trạng thái mới
  `delivering` "Đang giao" cho đơn giao (Hoàn thành → Đang giao → Đã ship; đơn đến lấy không đổi);
  thẻ đơn có nút "Đã mang đi"/"Đã giao xong" + chip cảnh báo "Thiếu địa chỉ giao"/"Thiếu giờ giao";
  `RoutePlanner` chỉ hiện đơn `delivering` của hôm nay (thiếu `deliverAt` vẫn hiện ở nhóm cuối,
  không giấu đơn đang trên xe); chỉ đường **từng chặng**; **Apple Maps mặc định, Google Maps phụ**
  (ý Paul); badge tab Đơn ship đếm cả đơn đang giao. Build + mọi suite pass (donut 23, classify 39,
  insights 35, dishprofit 18, performance 54, sync 7/7, cache 10/10). Chờ Paul bấm thử bản xem trước.
  Lưu ý: đơn `delivering` có `deliverAt` thuộc **ngày hôm qua** (mang đi mà chưa giao xong) hiện
  KHÔNG hiện trong lộ trình hôm nay — đúng quy tắc Paul đã duyệt, chờ anh quyết có nới hay không.

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
- **Lộ trình giao** (audit của James 21/11, báo cáo `restaurant-app-route-audit-2026-11-21.md`): tab Đơn ship
  và mục Giao hàng của tab Đơn hàng là **cùng một `OrdersPage` + `RoutePlanner`** (Đơn ship = `fixedType="delivery"`)
  — đừng xây tính năng lộ trình ở hai nơi. Lỗ hổng đã biết: lộ trình **không lọc theo ngày** (đơn tuần trước lẫn vào
  khung "Đã trễ giờ"); đơn thiếu địa chỉ/giờ giao **bị loại âm thầm** khỏi lộ trình; link Maps tối đa 10 điểm
  (`MAX_ROUTE_STOPS`); đơn `pending` (bếp chưa xong) vẫn bấm "Đã ship" được. **Cập nhật 21/11: Paul đã
  chốt quy trình của anh + góp ý của James** (xác nhận & nhắn khách → hàng chờ nấu CHUNG đơn giao +
  đến lấy, code tự sắp đợt theo giờ giao → địa chỉ tiện; đơn trễ sáng thứ Bảy có mục riêng "nhận luôn
  giao luôn"; thu tiền giữ nút "Đã thu tiền" riêng, không hỏi ép lúc giao xong) và đã duyệt làm
  **Giai đoạn 1 = PR #52** (mục 4). Còn **Giai đoạn 2 chưa làm**: gợi ý gom đợt 10–15 ở hàng chờ nấu +
  thanh tiến độ/đối soát đóng đợt + mục đơn trễ riêng — chờ Paul duyệt tiếp sau khi thử GĐ1.

## 6. Kiểm chứng quen dùng

- `npm run build`, `npm run test:sync` (7), `npm run test:performance` (54),
  `npm run test:dishprofit` (18 — test lớp dữ liệu `profitReport().dishes`, nuôi thẻ Inventory),
  `npm run test:insights` (35), `npm run test:cache`,
  `npm run test:classify` (39 — phân loại nguồn/thiết bị của tracker web),
  `npm run test:donut` (23 — toán lát vòng tròn, gồm khe hở).
- Không đụng khi chưa được giao: mã PIN, luồng đặt đơn, in bill, chuông báo, sync, cache.

---
*Claude khi làm xong việc gì lớn: cứ ghi tiếp vào file này (mục 1/5) hoặc nhắn Paul — James sẽ đồng bộ lại.*
