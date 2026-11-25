# Kế hoạch nâng cấp tab Báo cáo: bản hoàn chỉnh cho James

> Bản cuối, Paul duyệt ngày 25/11/2026. Claude soạn từ issue #78 và các comment bổ sung ở #78, #80–#83.
> **File này là nguồn spec duy nhất.** Comment cũ trong issue lệch với file này thì làm theo file này.
> Chỗ nào muốn làm khác: hỏi trong issue tương ứng **trước khi** code.

---

## 0. Quy tắc chung (áp dụng cho mọi PR)

### Quyết định của Paul
1. **Màn hình chính giữ nguyên giao diện.** Chỉ PR 1 đổi cách tính số bên dưới để khớp với Báo cáo.
2. **Data realtime chỉ làm ở tab Báo cáo.** Báo cáo vẫn `ownerOnly` (`src/components/navigation.js:28`). Không mở cho quản lý hay nhân viên.
3. **Không đụng** `BottomNav.jsx`, `navigation.js`, `Sidebar.jsx`. Ngoại lệ duy nhất là issue #79 (badge Đơn ship), một việc riêng.

### Quy ước số liệu
| Loại số | Tính theo | Hàm |
|---|---|---|
| Doanh thu, số đơn, số phần, món của một kỳ / đợt | **ngày bán = ngày giao** (`deliverAt`, không có thì `createdAt`) | `saleDate(o)` (PR 1) |
| Tiền đã thu trong ngày (chốt ca) | `paidAt` | giữ nguyên `dailyCollection` |
| Nhịp nhận đơn ("đã nhận bao nhiêu tới lúc này") | `createdAt` | `currentRun` (PR 3) |
| Gộp món | `dishKey(name)` + `DISH_ALIASES` | `src/lib/dishKey.js` (PR 1) |
| Tiền hiển thị | **`formatMoney`** (`src/lib/stats.js`), ra `$4,386.00` | **cấm tự định dạng** (demo đang ghi `$4.386` là sai) |
| Đơn huỷ | không tính vào bất kỳ số nào, trừ tỉ lệ huỷ | |

**Đợt = tuần giao:** Thứ Hai 00:00 → Chủ nhật 24:00, chứa ngày giao thứ Bảy. Đơn tạo tối thứ Sáu hay từ thứ Hai, miễn giao thứ Bảy 29/11, đều thuộc **đợt 29/11**.

### Quy trình mỗi PR
1. Chỉ bắt đầu PR sau khi PR trước **đã gộp vào main**. Riêng #79 làm song song được.
2. Tạo branch từ main mới nhất, đặt tên như gợi ý ở từng mục.
3. Logic tính toán đặt trong `src/lib/*.js` dạng **hàm thuần có test**. Component chỉ hiển thị.
4. Trước khi báo xong:
   - `npm run build` PASS.
   - **Toàn bộ** `npm run test:*` PASS, gồm cả suite mới. Test mới phải thêm script vào `package.json`.
   - Không được xoá test cũ. Test cũ khẳng định hành vi đã đổi theo spec thì sửa test và ghi lý do.
5. Comment vào issue:
   - Tên branch, số PR, commit.
   - Danh sách file đã đổi.
   - Kết quả test.
   - Những chỗ đã làm khác spec (nếu có, phải đã được duyệt).
6. Claude audit: đọc diff, chạy test, chụp Playwright ở **390 / 834 / 1112 / 1280**. Đạt thì Paul gộp.
7. Sau khi gộp, ghi một mục vào `docs/james-handover.md`.

---

## PR 1: dishKey dùng chung và "ngày bán" (issue #80)
Branch: `fix-dishkey-saledate`. **Không đổi giao diện.**

### Bước làm
1. **Tạo `src/lib/dishKey.js`**
   - Chuyển nguyên `DISH_ALIASES` và `dishKey()` từ `src/lib/report.js` (khoảng dòng 95–108) sang, giữ nguyên comment.
   - Thêm `export function dishLabel(key, menu, fallbackName)`: trả tên món trong thực đơn nếu `dishKey(m.name) === key`, không thì trả `fallbackName`.
   - `report.js` import từ file mới và xoá bản cũ.
2. **Tạo `src/lib/saleDate.js`**
   ```js
   // Quy ước: doanh thu / số đơn / món của một kỳ tính theo NGÀY GIAO (tuần giao).
   // Tiền đã thu trong ngày (chốt ca) tính theo paidAt — xem dailyCollection.
   export const saleDate = (o) => new Date(o.deliverAt ?? o.createdAt);
   ```
3. **`src/lib/report.js`**: các chỗ lọc và chia cột theo `createdAt` (khoảng dòng 83, 184, 193, 200) đổi sang `saleDate(o)`. **Giữ** dòng khoảng 205 (`firstOrderAt`).
4. **`src/lib/stats.js` `summarize(allOrders, now, menu = [])`**
   - Lọc đơn tuần này theo `saleDate`.
   - Gộp món theo `dishKey`, tên hiển thị dùng `dishLabel`.
   - `weekItems` sắp theo **doanh thu giảm dần**, bằng nhau thì theo số lượng.
   - Không đổi `dailyCollection`.
   - `HomePage.jsx`: chỉ thêm `menu` vào lời gọi `summarize`. Không đổi gì khác.
5. **`src/lib/forecast.js` `weeklySeries()`**
   - Khoá món đổi từ `normalizeText(it.name)` sang `dishKey(it.name)`.
   - Tuần đổi từ `createdAt` sang `saleDate`. Vẫn bỏ các đơn có ngày bán sau `now`.
6. **Rà phần còn lại:** chạy `grep -rn "createdAt" src/lib src/components src/pages`. Với mỗi chỗ, ghi vào comment PR: **đổi / không đổi + lý do**. Chỉ đổi chỗ nói về doanh thu / món / số đơn của một kỳ bán. Ví dụ `reportInsights.js`, `nowcast.js`, `analyticsExport.js`, `PairsCard.jsx`, `CustomerStatsCard.jsx`.

### Test (`tests/dish-key`, script `test:dishkey`)
- "Giò Lụa", "giò lụa 500g", "GIÒ LỤA 1kg" → cùng một khoá.
- "Bánh chưng mặn" → `banh chung`. "Bánh chưng ngọt" → khoá **khác**.
- Đơn tạo thứ Hai giao thứ Bảy, và đơn tạo tối thứ Sáu giao thứ Bảy → cùng tuần của thứ Bảy.
- Trên một bộ đơn mẫu, `summarize().weekItems`, `buildReport('week')` và tuần cuối của `weeklySeries` cho **cùng tổng số lượng từng món**.
- **Backtest dự báo:** ghi độ chính xác cũ → mới vào comment. **Giảm quá 2 điểm % thì dừng và hỏi.**

---

## PR 2: chia Báo cáo thành 3 tab con (issue #81)
Branch: `feat-report-subtabs`. **Không thêm thẻ mới.**

### Bước làm
1. **`src/pages/ReportPage.jsx`: thanh 3 tab con** ngay dưới tiêu đề, cùng kiểu nút 2 lựa chọn "Theo khu vực / Theo giờ hẹn" trong `RoutePlanner.jsx`.
   - Thứ tự tab: **Đợt này · Theo kỳ · Khách & món**.
   - Mặc định: **Theo kỳ** (trong PR này). **Không nhớ tab** (không dùng localStorage).
   - Vuốt ngang đổi tab: chỉ làm nếu dùng được `src/hooks/useSwipe.js` mà không phải sửa nó.
2. **Nội dung từng tab** (giữ thứ tự hiện tại):
   - **Đợt này**: một thẻ giữ chỗ "Số liệu đợt thứ Bảy — đang làm" (PR 3 thay bằng thẻ thật).
   - **Theo kỳ** (đủ **9 thẻ**, không bỏ thẻ nào):
     1. Bộ chọn kỳ (Tuần / Tháng / Năm + 2 mũi tên), **giữ nguyên**.
     2. Tổng quan.
     3. Báo cáo Hiệu suất Tuần.
     4. Doanh thu theo ngày/tháng.
     5. Dự báo doanh thu.
     6. Tổng món đã bán.
     7. Nhịp tuần.
     8. Thời điểm.
     9. Nhận xét nhanh.
     10. Dữ liệu phân tích (xuất file), đặt **cuối tab**.
   - **Khách & món** (4 thẻ): Khách hàng trong kỳ, Khách theo ngôn ngữ, Món hay mua kèm, Phân tích AI. Dùng **chung kỳ** đang chọn (`kind`/`anchor` để ở ReportPage). Đầu tab hiện dòng nhỏ "Kỳ: Tháng 11/2026".
3. **Đổi tên thẻ** "Dự báo" (khoảng dòng 587) thành **"Dự báo doanh thu"**.
4. **Sửa bảng "Tổng món đã bán" trên điện thoại** (khoảng dòng 259–268). Đây là lỗi có sẵn: ở 390px cột tên món bị ép còn 2px.
   - Dưới 640px (`sm`), mỗi món tách 2 hàng:
     - Hàng 1: số thứ tự + tên món (không cắt chữ, cho phép xuống dòng).
     - Hàng 2: phần · tiền · % · ▲/▼, căn phải, chữ nhỏ.
   - Từ 640px trở lên giữ nguyên 1 hàng. **Giữ đủ dữ liệu**, không rút gọn như demo.
5. **Dọn comment** `WeeklyPerformanceCard.jsx` (khoảng dòng 20 và 53): bỏ nhắc tới biểu đồ "Lợi nhuận theo tuần" ở Màn hình chính (đã xoá ở commit `c21b241`).
6. **Hiệu năng:** tab không mở thì không render thẻ của tab đó. `buildReport` vẫn tính 1 lần ở ReportPage.

### Test
- Test SSR: 3 tab render được. Theo kỳ đủ 9 thẻ, Khách & món đủ 4 thẻ. Liệt kê thẻ trước/sau trong comment.
- Ở 390px, tên món dài nhất hiện đủ chữ. Claude kiểm bằng Playwright.

---

## PR 3: tab "Đợt này" (issue #82)
Branch: `feat-report-current-run`.

### Bước làm
1. **Cài Recharts 3.x**, khoá đúng phiên bản trong `package.json`.
   - Chỉ import trong component của Báo cáo.
   - Tab Đợt này và biểu đồ tuần giao tải bằng **`React.lazy` + `Suspense`**.
   - Sau `vite build`: chunk `main` và chunk Màn hình chính **không chứa recharts**. Ghi kích thước chunk trước/sau vào comment.
2. **Tạo `src/lib/currentRun.js`** (hàm thuần): `currentRun(orders, now, { forecast, homeSide })`. Trả về các phần sau.
   - **`run`**: ngày giao thứ Bảy của đợt hiện tại.
     - Thứ Hai → thứ Bảy: đợt là thứ Bảy của tuần này.
     - Từ Chủ nhật 00:00: chuyển sang đợt tuần sau.
     - Ghi quy ước này thành comment.
   - **`received`**: số đơn chưa huỷ có `saleDate` thuộc đợt.
   - **`pace`**: với mỗi đợt trong 4 đợt trước, đếm số đơn chưa huỷ có `createdAt ≤ (ngày giao của đợt đó − (ngày giao đợt này − now))`, tức cùng khoảng cách tới ngày giao. Lấy trung bình.
     - Hiển thị "TB ≈15 đơn".
     - `delta` tính bằng %. **Chênh dưới 3 đơn thì ẩn %** và ghi "tương đương mọi tuần".
     - Có dưới 2 đợt trước thì ẩn phần so sánh.
   - **`cumulative`**: số đơn tích luỹ theo từng ngày T2 → hôm nay của đợt này, kèm đường TB 4 đợt trước ở cùng các mốc.
   - **`progress`** (tên hiển thị **"Tiến độ đợt"**, không dùng chữ "pipeline"): Chờ xử lý / Chờ nấu / Nấu xong / Đang giao / Đã giao / Giao không được.
     - **Dùng `isInboxOrder`, `isCookingOrder`** trong `src/lib/batches.js`, không tự viết lại điều kiện.
     - "Đã giao" gồm đơn `shipped`, và đơn đến lấy đã `done` + `paid`. Nếu muốn định nghĩa khác thì hỏi trước.
   - **`money`**: dự kiến = tổng `orderTotal` đơn chưa huỷ; đã thu = đơn `paid`; còn phải thu = hiệu hai số.
   - **`mix`**: Đến lấy và Giao hàng. Trong đơn giao, chia Wodonga và Albury – Lavington bằng `sideOf` (`src/lib/route.js`); không xác định được thì là "Chưa rõ".
3. **Thẻ A "Đợt thứ Bảy này"**, đặt theo demo:
   - Chấm xanh "Trực tiếp · Đợt giao Thứ Bảy 29/11".
   - Câu lớn "Đã nhận **18 đơn** cho đợt này", dòng so sánh viết thành câu.
   - **Biểu đồ Recharts:** cột tích luỹ T2 → hôm nay, kèm đường TB 4 đợt trước nét đứt. Tooltip "Thứ 5 · Đợt này 18 đơn · TB 4 tuần trước 15 đơn" phải hiện **cả khi chạm** trên iPhone/iPad.
   - Khối Tiến độ đợt: **lưới 3 cột × 2 hàng ở mọi cỡ** (demo dùng 6 cột nên nhãn "Giao không được" xuống 3 dòng). Mỗi ô bấm vào mở trang tương ứng qua `onNavigate`: Chờ xử lý → `orders`, Chờ nấu / Nấu xong → `cooking`, Đang giao / Giao không được → `delivery`.
   - Khối Tiền của đợt (3 ô) và Cơ cấu đơn (thanh ngang) giữ như demo.
4. **Thẻ B "Đặt hàng so với dự báo":**
   - Mỗi món: **đã đặt** (tổng qty của đợt, gộp bằng `dishKey`), **dự báo cả đợt** (`weeklyForecast`, cách gọi như `ForecastCard.jsx`), **còn dự kiến** = dự báo − đã đặt, tối thiểu 0.
   - Sắp theo dự báo giảm dần.
   - Đã đặt ≥ 90% dự báo: nền hổ phách + nhãn "Sắp vượt dự báo". Trên 100%: nền đỏ nhạt + nhãn "Vượt dự báo". Nhãn **đặt ở dòng riêng dưới tên món** (ở 390px demo bị gãy chữ).
   - Dự báo `ready: false` thì chỉ hiện cột đã đặt, kèm một dòng giải thích.
   - Dòng cuối: "Chuẩn bị chi tiết ở trang Chuẩn bị →" (`onNavigate('prep')`). Không lặp lại danh sách nấu.
5. **Biểu đồ "Doanh thu theo tuần giao"** (Recharts) đặt ở tab **Theo kỳ**:
   - **Thay** "Doanh thu theo ngày" khi kỳ = **Tháng**.
   - 8 cột, mỗi cột một đợt thứ Bảy, cột đợt hiện tại tô đậm, tooltip ghi tiền bằng `formatMoney` + số đơn.
   - Kỳ **Tuần**: ẩn thẻ này. Kỳ **Năm**: giữ cột theo tháng như cũ.
6. **Đổi tab mặc định** của Báo cáo sang **Đợt này**. Không nhớ tab.

### Test (`tests/current-run`, script `test:currentrun`)
- Đơn tạo thứ Hai / tối thứ Sáu cho thứ Bảy → thuộc đợt. Đơn huỷ → không tính.
- Chủ nhật sau đợt → chuyển sang đợt mới.
- `pace` đúng với 4 đợt mẫu dựng sẵn. Chênh dưới 3 đơn → không có %.
- `progress` khớp `isInboxOrder` / `isCookingOrder`. Tổng 6 ô + số đơn đến lấy chưa xong = `received`. Ghi rõ công thức trong test.
- Wodonga / Albury chia đúng.
- Thẻ B: còn dự kiến không âm. Ngưỡng 90% / 100% đúng.

---

## PR 4: thẻ vận hành ở tab Theo kỳ (issue #83)
Branch: `feat-report-ops-cards`. Logic đặt trong `src/lib/opsReport.js`.

**Thứ tự trong tab Theo kỳ sau PR này:** Bộ chọn kỳ · Tổng quan · Hiệu suất tuần · Doanh thu (theo tuần giao / theo tháng) · Tổng món đã bán · **Đơn theo vùng (F)** · Dự báo doanh thu · **Giao hàng (C)** · **Công nợ (D)** · **Xử lý đơn web (E)** · Nhịp tuần · Thời điểm · Nhận xét nhanh · Xuất dữ liệu.

### Thẻ F "Đơn theo vùng"
- **Phạm vi:** đơn giao chưa huỷ có `saleDate` trong kỳ. Đầu thẻ ghi "Chỉ tính đơn giao hàng · N đơn đến lấy không tính theo vùng".
- **Vùng của đơn**, theo thứ tự:
  1. Suburb tách từ `customer.address`, khớp danh sách suburb trong `src/site/suburbs.js` (không phân biệt hoa thường / dấu, bỏ bang và postcode).
  2. `storedGeoOf(o)?.zone`, bỏ postcode.
  3. "Chưa rõ vùng".

  **Không** ưu tiên `geo.zone` trước, vì OpenStreetMap hay ghi khác tên khách chọn.
- **Hiển thị:**
  - Thanh ngang theo **suburb**, sắp theo doanh thu. Mỗi hàng: `formatMoney` · số đơn · % doanh thu đơn giao.
  - "Chưa rõ vùng" ở cuối, màu xám, có viền đứt nét.
  - **Không** có nút chuyển sang khu phí ship.
- **Độ phủ:** "Dựa trên X/Y đơn giao có vùng". Nếu "Chưa rõ" chiếm **trên 20% số đơn** thì hiện cảnh báo vàng "Nhiều đơn thiếu địa chỉ, tỉ lệ các vùng có thể chưa chính xác".

### Thẻ C "Giao hàng"
- **Số điểm giao, km, thời gian ước tính:**
  - Mỗi đợt tính bằng `planRouteByArea`, toạ độ lấy từ `storedGeoOf`.
  - Điểm xuất phát: `cachedGeocode(settings.shopAddress)` nếu có.
  - Kỳ có nhiều đợt thì cộng lại. Dùng `estimateRunMinutes`.
  - **Không gọi geocode mạng.**
  - Ghi chú: "ước tính đường chim bay × 1,4".
- **Tỉ lệ giao đúng hẹn:** đơn có `shippedAt ≤ deliverAt + 30 phút` / đơn có `shippedAt`. Kèm "n = …".
- **Giao không được:** số đơn đang ở trạng thái `failed`. Ghi rõ "chỉ đếm đơn đang ở trạng thái này".
- **Phí ship và tiền xăng:**
  - Phí ship = tổng `shippingFee`.
  - Tiền xăng = km đường thật × `settings.fuelCostPerKm`, mặc định **0.25**.
  - Thêm ô nhập "$/km" trong **Cài đặt** (chỉ chủ quán sửa).
  - **Tách theo khu phí ship** (`matchZone`), để biết khu Lavington – Thurgoona $7 có đủ bù không.

### Thẻ D "Công nợ" (không phụ thuộc kỳ, ghi rõ trên thẻ)
- Đơn `!paid`, chưa huỷ, có `saleDate` **cách hôm nay hơn 7 ngày**.
- Gộp theo khách bằng khoá giống `customerKey` trong `src/lib/duplicates.js` (SĐT ≥ 8 số, không có thì tên).
- Mỗi khách hiện: tổng nợ, số đơn, đơn cũ nhất được bao nhiêu ngày, nút **Gọi** (`tel:`), nút **Đã thu**.
  - Nút Đã thu hỏi xác nhận, rồi gọi `onSetPaid` cho từng đơn của khách đó.
- Sắp theo tổng nợ. Không có ai thì hiện "Không có đơn chưa thu quá 7 ngày".

### Thẻ E "Xử lý đơn web"
- Đơn `source === 'web'` trong kỳ.
- **Thời gian xác nhận:** trung bình và trung vị của `confirmedAt − receivedAt`. Bỏ đơn thiếu một trong hai mốc, ghi n.
- **Số đơn xác nhận chậm hơn 2 giờ**, kèm danh sách số đơn.
- **Tỉ lệ đơn web / đơn nhập tay.**
- Không lặp lại số liệu của trang Hoạt động khách.

### Test (`tests/ops-report`, script `test:opsreport`)
- "12 Kiewa St, South Albury NSW 2640" → South Albury. Không có suburb nhưng có `geo.zone` "Wodonga 3690" → Wodonga. Không có cả hai → Chưa rõ vùng. Tổng các hàng = tổng đơn giao. Ngưỡng cảnh báo 20%.
- Đúng hẹn / trễ đúng ngưỡng 30 phút.
- Công nợ: SĐT có dấu cách vẫn coi là cùng khách. Nút Đã thu đánh dấu đúng các đơn.
- Thời gian xác nhận bỏ qua đơn thiếu mốc.
- Phí ship / tiền xăng chia đúng theo khu.

---

## Việc song song: issue #79 (Đơn ship)
Làm theo đúng issue #79:
- Badge `deliveryAction` chỉ đếm đơn `done` + `delivering` + `failed`, và `BottomNav` dùng `deliveryAction`.
- Khối "Nấu xong, chờ mang đi" xếp theo thứ tự lộ trình, có đánh số.
- Ẩn nút "Tạo đơn" ở trang Đơn ship.

## Nghiệm thu cuối (sau PR 4)
Claude chạy toàn bộ test và render 4 cỡ cho cả 3 tab, rồi so với demo nhánh `demo/bao-cao-theo-plan`. Paul mở trên iPad thật để xác nhận lần cuối. Sau đó xoá nhánh demo.
