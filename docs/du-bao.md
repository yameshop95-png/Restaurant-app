# Dự báo món, phân loại món, báo cáo ngôn ngữ

Tài liệu này ghi lại cách app đang dự báo và phân tích, để cải tiến dần khi có thêm dữ liệu thật.
Mọi tính toán chạy trong trình duyệt, từ đơn hàng của quán. Không gọi dịch vụ ngoài, không lưu thêm bảng mới lên Supabase.

## 1. Dự báo món tuần này (`src/lib/forecast.js`, ô "Dự báo món tuần này" ở Màn hình chính)

Cho từng món:

1. **Mức nền**
   - Món bán đều: san bằng mũ `F = α·Y + (1 − α)·F`, `α = 0,3`.
   - Món bán thưa (≥ 30% số tuần không bán): Croston bản SBA `F = (1 − β/2) · z / p`, `β = 0,2`
     (`z` = số phần mỗi lần có bán, `p` = số tuần giữa hai lần bán, đều làm mượt).
2. **Hệ số nhân** theo điều kiện của tuần cần dự báo. Mỗi hệ số = bán trung bình trong các tuần cùng điều kiện ÷ bán trung bình
   mọi tuần, co rút về 1: `(n·hệ số + K) / (n + K)`, `K = 4`.
   - Tuần trong tháng (1–5, theo ngày thứ Năm của tuần)
   - Mùa ở Úc (hè 12–2, thu 3–5, đông 6–8, xuân 9–11)
   - Tuần lương: tuần chia 2 nhóm xen kẽ A/B (lương ở Úc thường trả 2 tuần một lần), mốc thứ Hai 1/1/2024 là nhóm A
   - Dịp lễ: tuần chứa ngày lễ hoặc tuần ngay trước (khách đặt trước). Năm mới, Quốc khánh Úc 26/1, Phục Sinh, Ngày của Mẹ
     (Chủ nhật thứ 2 tháng 5), Ngày của Cha (Chủ nhật đầu tháng 9), Giáng sinh, Tết (danh sách `TET`, cần bổ sung sau 2032)
   - Thời tiết: chủ quán chọn mỗi tuần (Nóng / Mát / Lạnh / Mưa), lưu chung trong thông tin quán (`weatherLog`)
3. **Tự chọn hệ số**: dự báo lại tối đa 16 tuần gần nhất (mỗi tuần chỉ dùng dữ liệu trước nó, cần ≥ 4 tuần trước),
   đo `WAPE = Σ|thực − dự báo| ÷ Σ thực` trên tổng số phần. Thêm dần từng nhóm hệ số, chỉ giữ nhóm làm WAPE giảm ≥ 2 điểm %.
   Kiểm thử với dữ liệu giả: tìm đúng nhóm có thật (tuần lương, thời tiết), không chọn nhóm nào khi dữ liệu chỉ có nhiễu.
4. **Khoảng dao động** = dự báo ± độ lệch chuẩn của 8 tuần gần nhất.

Tham số nằm ở `PARAMS` trong `src/lib/forecast.js`.

Vì sao không lấy thời tiết tự động: API miễn phí của Open-Meteo không cho dùng cho việc kinh doanh (kể cả bảng điều khiển nội
bộ để lập kế hoạch); muốn dùng phải mua gói thương mại. Nghiên cứu về bán hàng nhà hàng cho thấy nhiệt độ là yếu tố thời tiết
ảnh hưởng mạnh nhất tới món khách chọn, mưa ảnh hưởng tâm trạng nhiều hơn doanh số.

## 2. Phân loại món (`src/lib/menuEngineering.js`, tab Inventory → Tổng quan)

Menu engineering (Kasavana & Smith, 1982):
lãi mỗi phần = giá bán − giá vốn; tỉ lệ bán = phần món ÷ tổng phần; phổ biến khi tỉ lệ bán ≥ 70% × (1 ÷ số món);
lãi cao khi lãi mỗi phần ≥ lãi trung bình (bình quân theo số phần). Bốn nhóm: Ngôi sao, Bán chạy lãi thấp, Lãi cao ít người mua,
Ít bán lãi thấp. Chỉ món có công thức (biết giá vốn) mới được phân loại.

## 3. Khách theo ngôn ngữ (`src/lib/languageReport.js`, tab Báo cáo)

Đơn website ghi ngôn ngữ khách dùng (`order.lang`). Ba nhóm: web tiếng Việt, web tiếng Anh, đơn tạo trong app (không có
ngôn ngữ). Không suy đoán dân tộc từ tên khách, không hỏi dân tộc (thông tin nhạy cảm theo luật quyền riêng tư Úc).

## 4. File dữ liệu theo tháng (`src/lib/analyticsExport.js`, nút "Tải file phân tích" ở tab Báo cáo)

File `phan-tich-<quán>-<YYYY-MM>.xlsx`, chủ quán lưu vào máy tính hoặc OneDrive mỗi tháng:

| Sheet | Nội dung |
|---|---|
| Ngôn ngữ theo tháng | số đơn và doanh thu của 3 nhóm, % tiếng Anh trong đơn web |
| Món theo tháng | số phần mỗi món, tách theo nhóm ngôn ngữ |
| Món theo tuần | mỗi tuần × món: số phần + tuần trong tháng, mùa, nhóm tuần lương, dịp lễ, thời tiết (dữ liệu học dự báo) |
| Kiểm tra dự báo | dự báo lại các tuần đã qua so với thực tế, WAPE, yếu tố đang dùng |
| Dự báo đã lưu | dự báo thật của từng tuần, lưu trên máy này lúc mở ô dự báo lần đầu trong tuần (`localStorage`, `src/lib/forecastLog.js`) |
| Phân loại món | phân loại từng tháng (khi dữ liệu Inventory đã tải) |

Sheet "Dự báo đã lưu" là dự báo thật, làm trước khi biết kết quả; so với "Món theo tuần" sẽ biết độ chính xác thật,
khác với "Kiểm tra dự báo" (dự báo lại sau khi đã có dữ liệu).

## 5. Cải tiến khi có dữ liệu thật

Theo thứ tự, mỗi bước kiểm bằng WAPE trên file "Kiểm tra dự báo" và so "Dự báo đã lưu" với số bán thật:

- [ ] Khi có ≥ 12 tuần: chỉnh `α` (thử 0,2 / 0,3 / 0,4) theo WAPE thấp nhất; xem `intermittent` 30% có hợp không.
- [ ] Khi có ≥ 26 tuần: xem nhóm tuần lương có được giữ không; nếu có, ghi lại nhóm A/B nào bán nhiều.
- [ ] Khi có ≥ 1 năm: bật thử hệ số mùa riêng cho từng món; so tuần Tết, Giáng sinh năm nay với năm trước.
- [ ] Khi có ≥ 2 mùa Tết: học hệ số riêng cho từng tuần trước Tết (4, 3, 2, 1 tuần), vì bánh chưng / bánh tét đặt trước nhiều tuần.
- [ ] Khoảng dao động: thay ± độ lệch chuẩn bằng phân phối Poisson / nhị thức âm cho món bán ít, để khoảng không âm và sát hơn.
- [ ] Nếu quán muốn thời tiết tự động: mua gói thương mại của một nhà cung cấp thời tiết (đọc kỹ điều khoản), lưu nhiệt độ
      trung bình tuần thay cho lựa chọn tay, rồi so WAPE trước và sau.
- [ ] Khách theo ngôn ngữ: khi đủ vài tháng, xem món nào khách tiếng Anh mua nhiều để viết mô tả / ảnh tiếng Anh cho món đó.
