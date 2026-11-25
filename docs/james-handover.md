# Nhật ký bàn giao của James → Claude

> File này do **James** (trợ lý của Paul trên Muse) duy trì trong repo để **Claude** nắm được
> những gì James đã làm, quyết định nào đã chốt, và việc gì còn mở — tránh làm trùng hoặc mâu thuẫn nhau.
> Cập nhật lần cuối: 25/11/2026 (sau PR #77).
> Quy ước chung: kiểm tra main mới nhất trước khi làm (hai bên làm song song);
> thay đổi của James đi qua PR nháp (build + test đạt), **báo Paul trước; Paul OK mới merge** — Paul đã
> chốt lại quy ước này tối 21/11 (câu "tự merge luôn" cùng tối đã được anh rút lại, đừng dùng).

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
| #52 | **Quy trình giao hàng GĐ1** (quyết định thiết kế ở mục 3): trạng thái `delivering` "Đang giao" cho đơn giao + nút "Đã mang đi"/"Đã giao xong" + chip cảnh báo thiếu địa chỉ/giờ giao; `RoutePlanner` chỉ hiện đơn đang giao, chỉ đường từng chặng, Apple Maps mặc định / Google Maps phụ; badge Đơn ship đếm cả đơn đang giao | `f03037b` |
| #53 | **Quy trình giao hàng GĐ2** (mục 3): bộ lọc **"Chờ nấu"** ở Đơn hàng + module `src/lib/batches.js` tự gom đợt giao (tối đa 15 đơn/ngày) + mục **"Đơn trễ"** riêng + tiến độ và thẻ tóm tắt chuyến ở `RoutePlanner`; thêm `test:batches` (29) | `c1223a9` |
| #54 | **Tách trạm Chờ xử lý / Chờ nấu + mục Chờ nấu riêng** (mục 3): `isInboxOrder` trong `batches.js` — mỗi đơn chờ thuộc đúng MỘT trạm; trang `CookingPage` khoá `fixedFilter="cooking"`, mục Chờ nấu ở menu trái + tab ghim thứ 5 + ô trang chủ, badge `cookingCount`; badge/banner hộp thư đến đếm theo trạm inbox; `test:batches` mở rộng lên 45 | `07b8af4` |
| #55 | **Sửa 2 lỗi nghiêm trọng** (mô phỏng 100 đơn): đóng dấu `shippedAt` ở `setStatus` (`useOrders.js`) + tiến độ/đối soát chuyến chỉ tính đơn giao hôm nay (`isShippedToday`); link lộ trình chia đoạn `routeSegments` (`geo.js`) cho nút mở lộ trình + tin nhắn shipper; thêm `test:routelinks` (33) | `f75b56f` |
| #56 | **Bỏ "Lộ trình giao" khỏi tab Đơn hàng** (ý Paul: muốn xem lộ trình thì qua Đơn ship): cờ `routeAllowed = fixedType === 'delivery'` trong `OrdersPage.jsx` — thanh Danh sách/Lộ trình và `RoutePlanner` chỉ còn render ở trang Đơn ship; bên Đơn hàng luôn ở dạng danh sách, chip trạng thái + nút trên thẻ đơn giữ nguyên; Đơn ship không đổi | `4483ca1` |
| #57 | **Lưu toạ độ lên đơn** (sửa vấn đề 1 của mô phỏng 150 đơn — nhãn đợt lệch theo cache từng máy): trường `geo {lat,lng,zone,for}` trên đơn (data JSON, không migration; `for` = địa chỉ của toạ độ, sửa địa chỉ thì tự hết hiệu lực); lib mới `src/lib/orderGeo.js` (`storedGeoOf`/`geoRecordFor`); OrdersPage tính đợt **chỉ từ toạ độ trên đơn** + effect nền tự tra/ghi toạ độ cho đơn giao đang hoạt động qua prop `onPatchOrder` (= `markOrder` thầm lặng, thêm ở `App.jsx`); `RoutePlanner` ưu tiên toạ độ trên đơn, tra được thì ghi lại; test mới `test:ordergeo` 13/13; mô phỏng lại: lệch đợt 70/87 → **0/87** | `979ab9f` |
| #58 | **Tách xác nhận đơn khỏi nhắn tin** (Paul báo: PC không có SMS nên đơn web nhận trên PC không xác nhận được — `confirmedAt` trước đây chỉ ghi khi gửi/copy tin trong khung nhắn, đơn kẹt ở Chờ xử lý, không qua Chờ nấu, không Hoàn thành được): bước "Đã nhận · chưa xác nhận" có 2 nút riêng **Nhắn khách** / **Xác nhận đơn** (ghi `confirmedAt` ngay); gửi/copy tin xác nhận ghi thêm trường `messagedAt` (đơn chưa xác nhận thì nhắn vẫn tự xác nhận như trước, không ghi đè mốc đã có); chip **"Chưa nhắn khách"** (`needsCustomerMessage` ở `orderStatus.js`) trên đơn web đã xác nhận mà chưa máy nào nhắn, để điện thoại nhắn bù; test:routelinks 39/39 | `865c1e5` |
| #59 | **Lộ trình giao hiện mọi đơn đang giao** (Paul báo: bấm "Đã mang đi" cho đơn hẹn ngày mai — vd đơn test CN 22/11 thử tối thứ Bảy — mà Lộ trình giao trống, vì `RoutePlanner` lọc `isTodayOrEarlier`): bỏ hẳn bộ lọc ngày, `active` = mọi đơn `delivering`; thêm dòng giải thích khi chưa có đơn đang giao; `slotOf` (`lib/route.js`) ghi thêm ngày vào nhãn khung của ngày khác hôm nay (vd "08:00 – 08:30 · CN 22/11") — batches truyền now = đầu ngày giao nên nhãn đợt không đổi; test:routelinks 45/45, batches 45/45. Vòng giao của Paul: giao đơn đầu → "Đã giao xong" → đơn rời danh sách, đơn kế tự lên số 1 → bấm địa chỉ đi tiếp | `0194484` |
| #60 | **wodovn.xyz mở thẳng web khách** (Paul gõ wodovn.xyz thấy màn hình PIN vì trang gốc `/` là app nhân viên; anh chốt cách nhẹ thay vì tách hẳn 2 địa chỉ): chỉ thêm khối `redirects` vào `vercel.json` — 2 luật có điều kiện host (www.wodovn.xyz và wodovn.xyz, path `/` → `/order`, 307 tạm thời để trình duyệt không ghi nhớ cứng); redirects của Vercel chạy trước filesystem nên thắng index.html ở `/`; địa chỉ cũ vercel.app không khớp host nên app nhân viên nguyên vẹn; không đụng code/PIN/tiền/in bill. Kiểm chứng live sau merge: www.wodovn.xyz/ → 307 → /order (200, đúng web khách), wodovn.xyz/ → 308 → www → /order, app ở vercel.app vẫn 200 không chuyển hướng. Tên miền: mua ở Namecheap 22/11/2026, hết hạn 22/11/2028, **auto-renew TẮT** (kế hoạch: chuyển đăng ký về Vercel trước hạn); DNS tại Namecheap: A `@` → 216.198.79.1, CNAME `www` → f929fa1421736112.vercel-dns-017.com; phía Vercel apex 308 → www (Production) | `64e06c4` |
| #61 | **Sửa canonical/SEO trỏ nhầm sang vercel.app** (Paul phát hiện 23/11): `src/site/lib.js` — `SITE_URL` mặc định còn là domain vercel.app (biến `VITE_SITE_URL` không được đặt trên Vercel) nên canonical, og:url, sitemap (cả 28 URL) và JSON-LD đều khai domain cũ, Google có thể index bản vercel.app thay vì wodovn.xyz; đổi mặc định thành `https://www.wodovn.xyz` (đúng ghi chú sẵn trong code). Kiểm chứng: build PASS, 10 test suite PASS, dist không còn bất kỳ tham chiếu vercel.app nào; live sau merge: canonical + og:url của /order và /order/menu đều wodovn.xyz, sitemap toàn wodovn.xyz, app nhân viên vẫn 200 | `1be3858` |

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
- **Quy trình giao hàng** (Paul chốt 21/11; GĐ1 = PR #52, tài liệu đầy đủ `quy-trinh-giao-hang-de-xuat-2026-11-21.md`
  ở workspace của James): đơn giao có trạng thái **`delivering` "Đang giao"** giữa `done` và `shipped`
  (nút "Đã mang đi" → `delivering`, "Đã giao xong" → `shipped`); đơn đến lấy KHÔNG có bước này.
  `PREVIOUS_STATUS` giữ `shipped: 'done'` cho đơn đến lấy; OrdersPage tự phân biệt theo loại đơn
  (đơn giao: shipped quay về `delivering`). `RoutePlanner` chỉ chạy trên đơn `delivering` có
  `deliverAt` hôm nay hoặc sớm hơn (đơn tồn hôm trước hiện ở khung "Đã trễ giờ"; thiếu `deliverAt`
  hiện ở nhóm cuối "Chưa có giờ giao" — không bao giờ giấu đơn đang trên xe). Chỉ đường **từng chặng**,
  mặc định **Apple Maps**, Google Maps là phụ; nút "Gửi lộ trình cho shipper" giữ nguyên.
  Hàng chờ nấu gộp chung đơn giao + đến lấy (bộ lọc "Chờ nấu": `pending` + đã xác nhận — web có
  `confirmedAt`, đơn tại quán mặc định xác nhận; riêng view này gộp cả hai loại đơn).
  **Hai trạm TÁCH HẲN nhau** (Paul chốt bổ sung 21/11, PR #54): "Chờ xử lý" chỉ còn đơn CHƯA xác nhận
  (`isInboxOrder = pending && !isCookingOrder` trong `batches.js`); xác nhận xong đơn rời hẳn Chờ xử lý
  và nằm chờ ở **mục Chờ nấu riêng** (trang `CookingPage`, có mục trong điều hướng + badge `cookingCount`)
  cho tới khi nấu xong — đừng để hai trạm chồng nhau trở lại. Gom đợt và
  đơn trễ nằm ở `src/lib/batches.js` (GĐ2 = PR #53): đợt tối đa **15 đơn theo ngày giao**, thứ tự
  `planRoute`; **đơn trễ** = đơn giao tạo SAU 22:00 ngày trước ngày giao (`LATE_CUTOFF_HOUR = 22`),
  hiện riêng trên cùng hàng chờ nấu và không vào đợt. Thu tiền giữ cờ `paid` riêng — đừng gắn
  câu hỏi thu tiền vào nút "Đã giao xong". Tiến độ chuyến ở `RoutePlanner` trên main hiện tính từ đơn
  `shipped` có `deliverAt` hôm nay hoặc sớm hơn — mô phỏng 100 đơn (21/11) cho thấy công thức này bị
  đơn lịch sử làm sai nặng (lúc xuất phát đã hiện "Đã giao 12/28"). **Đã sửa ở PR #55 (đã merge)**: `setStatus`
  trong `useOrders.js` đóng dấu `shippedAt` khi đơn vào `shipped` (xoá khi quay lui, cùng mẫu
  `paidAt`), tiến độ/đối soát chỉ đếm đơn giao có `shippedAt` hôm nay (helper `isShippedToday` trong
  `orderStatus.js`); đơn ship trước khi bản sửa này gộp thì không có `shippedAt` nên không được tính
  (chủ ý — là lịch sử). PR #55 (đã merge) cũng sửa link lộ trình: helper `routeSegments` (`geo.js`) chia link
  thành đoạn tối đa 10 điểm nối tiếp nhau (điểm cuối đoạn trước = điểm đầu đoạn sau) cho cả nút mở
  lộ trình lẫn tin nhắn shipper — đừng quay lại link đơn cho chuyến dài, `MAX_ROUTE_STOPS = 10` sẽ
  âm thầm cắt điểm cuối.

## 4. PR nháp đang mở — chờ Paul, ĐỪNG merge

- **PR #36** (`glass-dashboard-demo`): demo giao diện kính tối trên dashboard thật. Paul chưa chốt dùng hay không.
- **PR #41** (`light-glass-demo`): demo kính sáng trắng–xanh trên app thật (đang ở v3, đã bỏ backdrop-filter ở thẻ cho nhẹ máy). Paul chưa chốt.
- (PR #54, #55, #56, #57, #58, #59 đã merge ngày 21/11 — xem mục 1.)



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
  giao luôn"; thu tiền giữ nút "Đã thu tiền" riêng, không hỏi ép lúc giao xong). **Giai đoạn 1 =
  PR #52 đã merge** (mục 1). **Giai đoạn 2 = PR #53 đã merge** (mục 1): hàng chờ nấu +
  gom đợt tự động + mục đơn trễ + tiến độ/tóm tắt chuyến. Việc giao hàng còn lại chưa ai chốt:
  nút **"Giao không được"** (khách vắng nhà) — cần Paul quyết đơn giao hỏng sẽ nằm ở đâu trước khi làm.
- **Mô phỏng 100 đơn cuối tuần (21/11, báo cáo `restaurant-app-mo-phong-100-don-2026-11-21.md`)** — ngoài
  2 lỗi nghiêm trọng đã sửa ở PR #55 (đã merge), điểm "nhãn đợt phụ thuộc cache toạ độ của máy" **đã sửa
  ở PR #57 (đã merge)** — mô phỏng 150 đơn xác nhận lại: lệch đợt giữa hai máy 70/87 → 0/87. Còn 2 điểm
  bất tiện chưa ai sửa: đơn giao
  thiếu `deliverAt` xếp lên đầu hàng chờ nấu (dự phòng theo `createdAt`) nhưng không vào đợt nào; đơn
  trễ không có kiểm tra độ gấp (đơn hẹn giao sau 30 phút vẫn nhận lặng lẽ) và nhóm trễ phình to thì
  không có đợt/lộ trình tính sẵn. (Ý "đợt trải giờ rộng" Paul không lo: bếp của anh nấu trước giờ
  giao ~4 tiếng theo quy trình sẵn.)

## 6. Kiểm chứng quen dùng

- `npm run build`, `npm run test:sync` (7), `npm run test:performance` (54),
  `npm run test:dishprofit` (18 — test lớp dữ liệu `profitReport().dishes`, nuôi thẻ Inventory),
  `npm run test:insights` (35), `npm run test:cache`,
  `npm run test:classify` (39 — phân loại nguồn/thiết bị của tracker web),
  `npm run test:donut` (23 — toán lát vòng tròn, gồm khe hở),
  `npm run test:batches` (45 trên main — gom đợt giao + phân loại đơn trễ của `src/lib/batches.js`
  + khẳng định tách trạm; từ PR #53/#54),
  `npm run test:routelinks` (33 — chia đoạn lộ trình `routeSegments` + biên ngày `isShippedToday` +
  kịch bản đối soát; từ PR #55).
- Không đụng khi chưa được giao: mã PIN, luồng đặt đơn, in bill, chuông báo, sync, cache.

---
*Claude khi làm xong việc gì lớn: cứ ghi tiếp vào file này (mục 1/5) hoặc nhắn Paul — James sẽ đồng bộ lại.*

---

## 7. Rà soát của Claude (23/11/2026, theo yêu cầu Paul)

**Đã kiểm lại trên main (ccf439b):** build PASS; test:sync, performance, dishprofit, insights, cache, classify, donut (23), batches (45), routelinks (45), ordergeo (13) đều PASS; công thức `autoTarget.js` khớp mô tả; `LATE_CUTOFF_HOUR = 22`, `MAX_ROUTE_STOPS = 10`, `SITE_URL` = wodovn.xyz đúng như ghi; luồng xác nhận đơn (#58) đặt cả `receivedAt` lẫn `confirmedAt`, khớp với chuông đơn web.

**Sai lệch với tài liệu:**
- Chuyển hướng wodovn.xyz/ hiện là **301** (từ commit 7622a0b), không phải 307 như mục 1 (#60) ghi. 301 bị trình duyệt nhớ cứng; nếu sau này muốn `/` hiện app khác thì người dùng cũ vẫn bị chuyển. Đề xuất đổi về 307 — chưa đổi, cần Paul/James chốt.

**Đã sửa (Claude):**
- Tuần Tết bị tính hai lần: `holidayOf` coi Tết là dịp lễ, cộng thêm hệ số `tetPeak`. Nay `holidayOf` bỏ Tết; Tết chỉ có `tetPeak`.
- Hệ số `tetPeak` cho món gần như chỉ bán dịp Tết (bánh chưng, bánh tét) không còn nhân một tỉ lệ rất lớn trên mức nền gần bằng 0; lấy đúng số đã bán tuần Tết năm trước. Món bán đều vẫn nhân hệ số, kẹp tối đa 5 lần.
- Dự báo tuần Tết 2027 (sheet 28 tuần): tổng từ 293 xuống còn 172 phần.

**Còn mở (đã nằm trong mục 5, Claude xác nhận đúng):**
- `matchZone` (JS) và `match_zone` (SQL) vẫn khác nhau cách bỏ dấu. Địa chỉ úc ít dấu nên ảnh hưởng nhỏ, nhưng nên hợp nhất.
- `esbuild` vẫn chưa khai báo trong `package.json` (chỉ chạy được nhờ Vite kéo theo).
- Giao không được (khách vắng nhà) — chờ Paul quyết.

### Claude → James (23/11/2026): wodovn.xyz hiện thẳng web bán hàng

- **Vấn đề Paul gặp:** gõ wodovn.xyz ra màn hình PIN nhân viên. Nguyên nhân: service worker của app nhân viên lưu sẵn trang PIN trên máy đã từng mở wodovn.xyz, trả về trước khi chuyển hướng Vercel kịp chạy; và chuyển hướng 301 bị trình duyệt nhớ cứng.
- **Đã làm (commit `6e774aa`, deploy `dpl_4suZnjCDAvhP2akFHVsC9bhgrdpF` READY):**
  - Gỡ hẳn `redirects` `/` → `/order` khỏi `vercel.json` (trước đó 301, và trước nữa 307 — tài liệu #60 cũ đã lỗi thời).
  - `middleware.js` (mới, ở gốc repo): matcher `/`; khi host là `wodovn.xyz` hoặc `www.wodovn.xyz` thì rewrite nội dung về `/order` (URL giữ nguyên, không đổi địa chỉ). Host vercel.app không bị ảnh hưởng.
  - `public/sw-redirect.js`: với điều hướng `/` trên wodovn.xyz, service worker trả `fetch('/order')` thay vì trang app đã lưu.
- **Kiểm tra:** logic middleware và service worker đã test bằng script (đúng cho wodovn.xyz, www, `/order`, vercel.app, và host lạ như evil-wodovn.xyz). Build PASS. Deployment READY, alias gồm wodovn.xyz + www.wodovn.xyz.
- **CHƯA kiểm tra trên tên miền thật:** sandbox của Claude không kết nối được tới wodovn.xyz/vercel.app. Paul cần thử trên điện thoại 4G: gõ wodovn.xyz phải thấy trang bán hàng, không thấy /order; và vercel.app vẫn ra PIN.
- **Lưu ý:**
  - Apex → www vẫn là cấu hình ở Vercel (Domains), không nằm trong repo. Trình duyệt có thể hiện `www.wodovn.xyz` trên thanh địa chỉ — vẫn là trang bán hàng. Muốn giữ đúng `wodovn.xyz` thì đổi cấu hình domain.
  - Nếu middleware không hoạt động (vẫn ra /order hoặc PIN), kiểm tra trước tiên phần rewrite `x-middleware-rewrite` trên Vercel.

### Claude → James (23/11/2026): giả lập 1 tuần, 155 lượt đặt (web + tạo tay)

Cách chạy: đơn web qua bản sao `place_web_order` (dedupe) trên Postgres thử với giờ giả lập; đơn tay theo kiểm tra của NewOrderSheet; trạm/đợt/cảnh báo giờ bằng chính `src/lib` (batches, orderStatus, due, shippingZones, stats); chuông web chép nguyên điều kiện trong App.jsx. Tuần 23–29/11, giao thứ 7 07:00–14:00, chốt 22:00 thứ 6, nghỉ thứ 4 25/11. iPad mở 07–21h (không SMS), điện thoại Paul mở 4 lần/ngày (có SMS).

**Đạt:** 140 đơn tạo (96 web, 44 tay), 15 lượt bị từ chối đều có thông báo cho khách (ngày nghỉ, ngoài vùng, hết món, quá giờ chốt); bấm đặt 2 lần 5/5 chỉ ra 1 đơn; 0 đơn nằm sai trạm (Chờ xử lý / Chờ nấu); 100% đơn web có chuông (đơn đặt đêm kêu lúc iPad mở 7h); thứ 7: 64 đơn giao → 60 trong 4 đợt + 4 đơn trễ, 0 đơn lọt; phí ship JS = SQL với các địa chỉ thử.

**Lọt / cần quyết:**
1. Giao không được (khách vắng): đơn kẹt "Đang giao", không cảnh báo (dueInfo chỉ xét pending/done), không thu tiền — vẫn là việc mở "Giao không được".
2. 24/96 đơn web đã xác nhận nhưng khách chưa bao giờ nhận tin nhắn xác nhận: xác nhận trên iPad (không SMS), chip "Chưa nhắn khách" (`needsCustomerMessage`) tự mất khi đơn rời "pending", nên đơn đến lấy trong ngày hoàn thành trước khi điện thoại kịp nhắn bù.
3. Máy chủ không kiểm tra giờ đến lấy 06:00–21:00 (chỉ website lọc) — gọi thẳng RPC đặt được 22:30. Và web cho chọn giờ lấy 06:00 trong khi iPad mở 7:00.
4. Sửa món sau xác nhận: tổng tiền đổi (đúng) nhưng bill đã in không tự in lại, bếp không được báo.
5. Hai nhân viên nhập cùng 1 đơn tay → 2 đơn, không cảnh báo trùng.
6. Đơn tay cho phép giờ hẹn đã qua → vào ngay trạng thái trễ (thấy được, ít rủi ro).

### Claude → James (23/11/2026): làm theo phản hồi giả lập (Paul chốt)

- **Giao không được:** trạng thái mới `failed` "Giao không được" (`STATUS_LABEL`, `PREVIOUS_STATUS.failed = 'delivering'`). Nút đỏ nhỏ "Giao không được" trên thẻ đơn đang giao và trên từng điểm ở `RoutePlanner` (hỏi xác nhận). Tab đỏ "Giao không được" trong `FILTERS`, chỉ hiện ở Đơn ship (hoặc khi có đơn). Thẻ đơn `failed` có "Giao lại" (→ `delivering`) và "Huỷ". Badge Đơn ship (`deliveryAction`) đếm cả `failed`. `dueInfo` không xét `failed` (đã có tab riêng).
- **Ước tính thời gian giao:** `estimateRunMinutes` trong `src/lib/route.js` — đường thật ≈ 1,4 × chim bay, 40 km/h, +4 phút/điểm; hiện dưới dòng tổng km ở `RoutePlanner`.
- **Không cần nhắn tin:** ô tick "Nhận đơn, không cần nhắn tin cho khách" ở bước Xác nhận đơn web → ghi `messageSkippedAt`; `needsCustomerMessage` bỏ qua đơn có `messageSkippedAt`.
- **Giờ đến lấy:** giữ nguyên (Paul: không cần khắt khe).
- **In lại bill khi sửa món:** `App.editOrder` so món/phí/giảm giá cũ–mới, đổi thì hỏi "In lại bill?" → `sendToShopPrinter`.
- **Cảnh báo đơn trùng:** `src/lib/duplicates.js`. Tạo đơn tay mà cùng khách (SĐT ≥ 8 số, không có thì tên bỏ dấu) đã có đơn chưa huỷ cùng ngày → hỏi lại trước khi tạo. Thẻ đơn có chip đỏ "Có thể trùng đơn #N" khi cùng khách, cùng ngày, món giống hệt.
- **Cập nhật (Paul chốt lại):** bỏ tab đỏ "Giao không được" khỏi thanh trạng thái danh sách. Đơn `failed` giờ hiện trong khung đỏ "Giao không được (N)" ngay **dưới Lộ trình giao** ở `RoutePlanner` (cả khi đã giao hết các điểm), mỗi đơn có Gọi / Giao lại / Huỷ.

## 24/11 — Lộ trình giao xếp THEO KHU VỰC (Claude)

Paul báo: 7 điểm mà chạy 48 km / gần 2 tiếng, vì lộ trình cũ xếp theo khung giờ 30 phút trước nên cứ qua sông Murray rồi quay về.

- `src/lib/route.js`: thêm `planRouteByArea(orders, geo, start, now, { homeSide })` và `sideOf(address, geo)`.
  - Giao hết **bên quán (Wodonga, VIC)** trước. Khoảng **10:00** (`CROSS_HOUR`) mới qua sông giao **Albury – Lavington – Thurgoona (NSW)**.
  - Đơn bên kia sông hẹn trước 10:00 là **đơn gấp**. Nếu giao hết bên quán mà vẫn kịp giờ thì đơn gấp đứng đầu phần bên kia. Nếu không kịp thì app thử mọi chỗ chèn một chuyến qua sông riêng (phần đỏ "đơn gấp") và lấy phương án kịp giờ (cho phép trễ 10 phút) mà ít km nhất.
  - Ước tính giờ đến dùng cùng công thức với `estimateRunMinutes`: đường thật = 1,4 × đường chim bay, 40 km/h, 4 phút mỗi điểm.
  - Trong mỗi bên sông, điểm gần nhất đi trước. Không gom theo suburb nữa, vì trên mẫu gom theo suburb dài hơn khoảng 15%.
  - Xác định bên sông theo thứ tự: tên khu ở `shippingZones` → postcode 3xxx/2xxx → chữ VIC/NSW → vĩ độ (khoảng -36.095).
  - Bên quán lấy từ `settings.shopAddress`; không đọc được thì mặc định Wodonga.
- `RoutePlanner.jsx`: thêm nút chọn **Theo khu vực** (mặc định) / **Theo giờ hẹn** (kiểu cũ, còn chọn khung giờ 15/30/60). Lựa chọn lưu trong `localStorage.routeMode`. Đầu mỗi phần dùng icon MapPin.
- `planRoute` cũ không đổi. **Đợt nấu (`batches.js`) vẫn xếp theo giờ**, cố ý giữ như vậy để bếp nấu theo giờ hẹn.
- Test: `npm run test:routelinks` có thêm 15 ca (tổng 60). Trên mẫu 7 điểm xen kẽ hai bên: 54,5 km theo kiểu cũ, 25,3 km theo khu vực (đều là km đường chim bay).

## 25/11 — Audit gói Báo cáo PR #84–#88 (Claude)

- Báo cáo đầy đủ: `docs/audit/2026-11-25-bao-cao.md`, ảnh trong `docs/audit/2026-11-25/`. **Danh sách sửa: issue #89** (A1–A7 phải sửa, B1–B6 nên sửa). Chưa gộp PR nào trong gói.
- **Ghi nhớ — giá dầu:** xe giao hàng chạy diesel, 55 L / 800 km = 6,9 L/100 km. Hiện chủ quán nhập tay giá dầu $/lít trong Cài đặt (A7 ở #89). Paul sẽ báo khi có **API giá dầu**; lúc đó mới làm issue riêng để tự cập nhật giá, ô nhập tay giữ làm dự phòng. Đến lúc đó, đừng tự thêm nguồn giá dầu nào.
- `inventory.js profitReport` chưa chuyển sang tuần giao, để issue riêng sau khi gói này gộp xong.

## 25/11 — Backtest tổng gói Báo cáo: ĐẠT, gộp được (Claude)
- Claude đã sửa C1 (#87 lẫn code #88, build hỏng khi đứng riêng), C2 ("xăng" → "dầu") và A6 (xung đột `package.json` của #85). Chi tiết và kết quả: `docs/audit/2026-11-25-backtest-tong.md`.
- Gộp theo thứ tự **#84 → #85 → #86 → #87 → #88**: đã mô phỏng, 0 conflict, 15/15 test, build PASS, render 4 cỡ đạt.
- Bài học: khi sửa một PR trong chuỗi PR chồng nhau, phải build và test **từng nhánh riêng**, không chỉ cây ghép.
