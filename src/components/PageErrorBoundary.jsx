import { Component } from 'react';

// Khung đỡ lỗi cho khu vực trang: nếu một trang tải lười (Báo cáo, Cài đặt…)
// không tải được hoặc lỗi khi vẽ, chỉ hiện thẻ báo lỗi + nút tải lại ở đúng
// khu vực đó thay vì sập cả app. Đặt bên trong div key={activeTab} của App
// nên đổi tab là khung tự reset. Trước đây app không có khung đỡ lỗi nào:
// một lần tải tệp lỗi là mất cả phiên làm việc (xem lib/resumeTab.js).
export default class PageErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Ghi ra console để tiện soi khi Paul quay màn hình gửi kèm
    console.error('Không mở được mục này:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-2xl rounded-2xl bg-card px-5 py-8 text-center shadow-sm">
        <p className="font-semibold text-slate-800">Chưa mở được mục này</p>
        <p className="mt-1 text-sm text-slate-500">Có thể app vừa cập nhật bản mới. Bấm tải lại để mở tiếp.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white active:bg-blue-600"
        >
          Tải lại app
        </button>
      </div>
    );
  }
}
