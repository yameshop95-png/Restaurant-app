import { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import useCustomers from './hooks/useCustomers';
import useMenu from './hooks/useMenu';
import useOrders from './hooks/useOrders';
import { HomePage, OrdersPage, DeliveryPage, CustomersPage, MenuPage, SettingsPage } from './pages';

// Map id tab -> component hiển thị trong Main Content Area.
const PAGES = {
  home: HomePage,
  orders: OrdersPage,
  delivery: DeliveryPage,
  customers: CustomersPage,
  menu: MenuPage,
  settings: SettingsPage,
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeStaff] = useState(4);
  const { orders, addOrder, updateOrder, setStatus, setPaid } = useOrders();
  const { customers, saveCustomer, importCustomers, updateCustomer, deleteCustomer } = useCustomers();
  const { menu, addItem, updateItem, deleteItem, moveItem, importMenu } = useMenu();

  // Tạo hoặc sửa đơn đều cập nhật luôn danh bạ khách hàng
  const createOrder = (order) => {
    addOrder(order);
    saveCustomer(order.customer);
  };
  const editOrder = (id, order) => {
    updateOrder(id, order);
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
            menu={menu}
            onAddOrder={createOrder}
            onUpdateOrder={editOrder}
            onAddCustomer={saveCustomer}
            onUpdateCustomer={updateCustomer}
            onDeleteCustomer={deleteCustomer}
            onAddMenuItem={addItem}
            onUpdateMenuItem={updateItem}
            onDeleteMenuItem={deleteItem}
            onMoveMenuItem={moveItem}
            onImportMenu={importMenu}
            onImportCustomers={importCustomers}
            onSetStatus={setStatus}
            onSetPaid={setPaid}
          />
        </main>
      </div>
    </div>
  );
}
