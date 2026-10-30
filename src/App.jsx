import { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import useCustomers from './hooks/useCustomers';
import useOrders from './hooks/useOrders';
import { HomePage, OrdersPage, DeliveryPage, MenuPage, SettingsPage } from './pages';

// Map id tab -> component hiển thị trong Main Content Area.
const PAGES = {
  home: HomePage,
  orders: OrdersPage,
  delivery: DeliveryPage,
  menu: MenuPage,
  settings: SettingsPage,
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeStaff] = useState(4);
  const { orders, addOrder, setStatus, setPaid } = useOrders();
  const { customers, saveCustomer, importCustomers } = useCustomers();

  const createOrder = (order) => {
    addOrder(order);
    saveCustomer(order.customer);
  };

  const pending = orders.filter((o) => o.status === 'pending');
  const counts = {
    pendingOrders: pending.filter((o) => o.type === 'dine-in').length,
    pendingDelivery: pending.filter((o) => o.type === 'delivery').length,
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const ActivePage = PAGES[activeTab];
  const pendingTotal = counts.pendingOrders + counts.pendingDelivery;

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        counts={counts}
        activeStaff={activeStaff}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:pl-72">
        <TopBar
          activeTab={activeTab}
          pendingTotal={pendingTotal}
          onMenuClick={() => setSidebarOpen(true)}
          onBellClick={() => handleTabChange('orders')}
        />

        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          <ActivePage
            orders={orders}
            counts={counts}
            activeStaff={activeStaff}
            customers={customers}
            onAddOrder={createOrder}
            onImportCustomers={importCustomers}
            onSetStatus={setStatus}
            onSetPaid={setPaid}
          />
        </main>
      </div>
    </div>
  );
}
