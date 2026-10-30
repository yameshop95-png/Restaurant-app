export { default as HomePage } from './HomePage';

// Các component placeholder cho từng tab. Tách ra file riêng khi bắt đầu làm chi tiết.

function PageCard({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-base font-semibold text-slate-800">{title}</h2>
      <div className="text-sm text-slate-500">{children}</div>
    </section>
  );
}

export function OrdersPage({ counts, onResolve }) {
  return (
    <PageCard title="Đơn hàng tại quán">
      <p className="mb-4">Có {counts.pendingOrders} đơn đang chờ xác nhận.</p>
      <button
        onClick={onResolve}
        disabled={!counts.pendingOrders}
        className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Xác nhận 1 đơn (demo)
      </button>
    </PageCard>
  );
}

export function DeliveryPage({ counts }) {
  return <PageCard title="Đơn ship">Có {counts.pendingDelivery} đơn giao hàng đang chờ tài xế.</PageCard>;
}

export function MenuPage() {
  return <PageCard title="Quản lý món ăn">Danh sách món, giá, trạng thái còn/hết món.</PageCard>;
}

export function SettingsPage() {
  return <PageCard title="Cài đặt app">Thông tin quán, máy in bếp, âm báo đơn mới, tài khoản nhân viên.</PageCard>;
}
