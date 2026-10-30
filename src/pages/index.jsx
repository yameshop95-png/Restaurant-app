import OrdersPage from './OrdersPage';

export { default as HomePage } from './HomePage';
export { default as SettingsPage } from './SettingsPage';
export { OrdersPage };
export const DeliveryPage = (props) => <OrdersPage {...props} type="delivery" />;

// Các component placeholder cho từng tab. Tách ra file riêng khi bắt đầu làm chi tiết.

function PageCard({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-base font-semibold text-slate-800">{title}</h2>
      <div className="text-sm text-slate-500">{children}</div>
    </section>
  );
}

export function MenuPage() {
  return <PageCard title="Quản lý món ăn">Danh sách món, giá, trạng thái còn/hết món.</PageCard>;
}
