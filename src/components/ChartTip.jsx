import { useEffect } from 'react';

// Hộp thông tin (tooltip) dùng chung cho các biểu đồ có điểm dữ liệu theo tuần — thẻ
// "Báo cáo Hiệu suất Tuần" (tab Báo cáo) và biểu đồ xu hướng trong thẻ "Hoạt Động
// Khách Hàng Website" (tab Customer Active). Mỗi biểu đồ dùng MỘT hộp riêng, chỉ chứa
// số của chính biểu đồ đó, nổi ngay trong vùng vẽ của biểu đồ đó.
// - Neo tại tâm ô tuần được chọn (xPct = % bề ngang vùng vẽ) nhưng hai mép hộp được
//   kẹp bằng CSS clamp() nên hộp không bao giờ tràn khỏi vùng vẽ — kể cả tuần đầu /
//   tuần cuối trên điện thoại ~390px (bản cũ chỉ có max-width nên bị thuật toán
//   shrink-to-fit ép thành cột rất hẹp ở mép phải, chữ xuống dòng từng 1–2 từ).
// - Bề rộng cố định vừa đọc (width truyền vào, tối đa bề ngang vùng vẽ trừ 8px).
// - KHÔNG có bộ hẹn giờ tự tắt nào: hộp hiện khi rê chuột / chạm vào ô tuần và chỉ ẩn
//   khi rê chuột ra khỏi vùng vẽ (mỗi biểu đồ tự gắn onMouseLeave) hoặc chạm / bấm vào
//   chỗ khác ngoài vùng biểu đồ (useChartTipDismiss). Trước đây các điểm ở tầng 2/3
//   chỉ có tooltip native `title` của trình duyệt — không hiện trên cảm ứng và bị
//   trình duyệt tự ẩn — nên đã bỏ hẳn `title`, dùng thống nhất hộp này.
export default function ChartTip({ xPct, width = 216, children }) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-20 rounded-2xl bg-slate-900 px-3.5 py-2 text-center shadow-[0_16px_32px_-12px_rgba(15,23,42,0.5)]"
      style={{
        width,
        maxWidth: 'calc(100% - 8px)',
        left: `clamp(4px, calc(${xPct}% - ${width / 2}px), calc(100% - ${width + 4}px))`,
      }}
      role="status"
    >
      {children}
    </div>
  );
}

// Chạm / bấm vào chỗ khác ngoài mọi vùng biểu đồ (phần tử có thuộc tính
// data-chart-tip-zone) thì ẩn hộp thông tin. Chỉ gắn listener khi hộp đang hiện
// (active = true). Phần rê chuột không đi qua đây — đã có onMouseLeave tại vùng vẽ.
export function useChartTipDismiss(active, onDismiss) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (e.target instanceof Element && !e.target.closest('[data-chart-tip-zone]')) onDismiss();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [active, onDismiss]);
}
