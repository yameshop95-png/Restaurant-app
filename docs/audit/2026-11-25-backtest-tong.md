# Backtest tổng gói Báo cáo, PR #84–#88 (25/11/2026)

> Claude sửa nốt C1, C2 và A6 theo yêu cầu của Paul, rồi kiểm lại toàn bộ.
> **Kết luận: ĐẠT, James gộp được theo thứ tự #84 → #85 → #86 → #87 → #88.**
> Lần audit trước: `docs/audit/2026-11-25-bao-cao.md`. Danh sách lỗi đã sửa: issue #89.

## 1. Claude đã sửa
Toàn bộ là commit mới hoặc merge commit, push fast-forward lên đúng nhánh PR, không rewrite history.

| Mục | PR / nhánh | Commit | Việc |
|---|---|---|---|
| Chuỗi PR | #86 `feat-report-subtabs` | `2f9a831` | Merge #84 mới (`1db024e`, có A1) vào #86 |
| C1 | #87 `feat-report-current-run` | `e1da0dd`, `e3f8b6b` | Gỡ code của #88 lẫn vào `ReportPage.jsx` (OpsCards, thẻ C/D/E/F, `onSetPaid`). Trước khi sửa, nhánh #87 **build hỏng** khi đứng riêng |
| C2 | #88 `feat-report-ops-cards` | `3c51aca`, `772589a` | Merge #87 đã sửa (không conflict); đổi chữ "xăng ≈" thành "dầu ≈" |
| A6 | #85 `fix-ship-after-69` | `16d07b8` | Chuyển `test:shippage` lên sau `test:sync`, hết xung đột `package.json` |

## 2. Kết quả kiểm
**Từng nhánh đứng riêng:**

| Nhánh | Build | Test |
|---|---|---|
| #84 `1db024e` | PASS | 11/11 |
| #85 `16d07b8` | PASS | 11/11 |
| #86 `2f9a831` | PASS | 12/12 |
| #87 `e3f8b6b` | PASS | 13/13 |
| #88 `772589a` | PASS | 14/14 |

**Mô phỏng gộp vào main (`bcf1db2`) theo thứ tự #84 → #85 → #86 → #87 → #88:**
- 5/5 lần merge **sạch, 0 conflict**.
- **15/15 suite PASS**, build PASS.
- Chunk `main` 72,6 KB gzip, không chứa recharts.

**Render thật trên bản đã gộp** (390 / 834 / 1112 / 1280, 3 tab Báo cáo):

| Kiểm | Kết quả |
|---|---|
| Tràn ngang, lỗi JS | 0 / 0 |
| Thanh "Món bán trong tuần" (Màn hình chính) | tối đa 100% (trước là 120%) |
| Tooltip biểu đồ khi chạm 1 lần | Hiện "Thứ 4 · Đợt này 14 đơn · TB 4 tuần trước 14 đơn" |
| Kéo ngang trên biểu đồ | Không nhảy tab |
| Thẻ Đặt hàng so với dự báo | Số nguyên, 2 hàng, tên đúng thực đơn |
| Thẻ Giao hàng | km đường thật (75,8 → 106,1 km); dầu theo vùng có số; 6,9 L/100 km × $2.50/L |
| Công nợ → Đã thu | Chọn Tiền mặt / Chuyển khoản / PayID; 8 đơn được đánh dấu; Hoàn tác trả đủ 8 |
| Badge Đơn ship | 3 = 2 nấu xong + 1 đang giao (không tính đơn chờ xử lý) |
| Khối chờ mang đi | Xếp Wodonga trước Albury, có số thứ tự; không có nút Tạo đơn |
| Lộ trình theo khu vực | 21,4 km, so với 36,4 km nếu xếp theo giờ |

## 3. Việc của James
1. Bỏ draft và **gộp theo đúng thứ tự #84 → #85 → #86 → #87 → #88**. PR nào báo "out of date" thì bấm **Update branch** (merge, không rebase).
2. Deploy main lên Vercel, ghi `docs/james-handover.md`.
3. Đóng các issue #79, #80, #81, #82, #83, #89, #78.
4. Paul mở tab Báo cáo trên iPad thật để xác nhận. Xong thì xoá nhánh `demo/bao-cao-theo-plan`.

## 4. Để sau (không trong gói này)
- `inventory.js profitReport` theo tuần giao: issue riêng.
- API giá dầu: chờ Paul báo. Hiện chủ quán nhập tay giá $/lít trong Cài đặt.
