import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import UndoToast from './components/UndoToast';
import useCustomers from './hooks/useCustomers';
import useMenu from './hooks/useMenu';
import useNow from './hooks/useNow';
import useOrders from './hooks/useOrders';
import useSettings from './hooks/useSettings';
import { exportAll } from './lib/backup';
import { alertBeep, dueInfo, upcomingOrders } from './lib/due';
import { paymentLabel, STATUS_LABEL } from './lib/orderStatus';
import { HomePage, OrdersPage, DeliveryPage, ReportPage, CustomersPage, MenuPage, SettingsPage } from './pages';

// Map id tab -> component hiển thị trong Main Content Area.
const PAGES = {
  home: HomePage,
  orders: OrdersPage,
  delivery: DeliveryPage,
  report: ReportPage,
  customers: CustomersPage,
  menu: MenuPage,
  settings: SettingsPage,
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { orders, addOrder, updateOrder, setStatus, setPaid, importOrders } = useOrders();
  const { customers, saveCustomer, importCustomers, updateCustomer, deleteCustomer } = useCustomers();
  const { menu, addItem, updateItem, deleteItem, moveItem, importMenu } = useMenu();

  // Mọi thay đổi trạng thái / thanh toán đều có "Hoàn tác" trong vài giây, phòng bấm nhầm
  const [toast, setToast] = useState(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const changeStatus = (id, status) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const before = order.status;
    setStatus(id, status);
    setToast({ label: `Đơn #${order.number}: ${STATUS_LABEL[status]}`, undo: () => setStatus(id, before) });
  };
  const changePaid = (id, paid, method) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const { paid: wasPaid, paymentMethod, paidAt } = order;
    setPaid(id, paid, method);
    const what = paid ? `Đã thanh toán${method ? ` · ${paymentLabel(method)}` : ''}` : 'Chưa thanh toán';
    setToast({ label: `Đơn #${order.number}: ${what}`, undo: () => setPaid(id, wasPaid, paymentMethod, paidAt) });
  };
  const { settings, updateSettings } = useSettings();
  const now = useNow();
  const upcoming = upcomingOrders(orders, now, 60);

  // Kêu + rung một lần khi đơn vào mốc "còn ≤ 30 phút" và một lần nữa khi trễ giờ.
  // Lần đầu mở app chỉ ghi nhận các đơn đang gấp, không kêu.
  const notified = useRef(null);
  useEffect(() => {
    const keys = orders.flatMap((o) => {
      const due = dueInfo(o, now);
      return due ? [`${o.id}:${due.level}`] : [];
    });
    if (!notified.current) {
      notified.current = new Set(keys);
      return;
    }
    const fresh = keys.filter((k) => !notified.current.has(k));
    fresh.forEach((k) => notified.current.add(k));
    if (fresh.length && settings.dueSound) alertBeep();
  }, [orders, now, settings.dueSound]);

  // Sao lưu tất cả vào một file Excel và ghi lại thời điểm để nhắc sao lưu định kỳ
  const backupNow = async () => {
    await exportAll({ orders, customers, menu });
    updateSettings({ lastBackupAt: new Date().toISOString() });
  };

  // Tạo hoặc sửa đơn đều cập nhật luôn danh bạ khách hàng (khách tại quán không để SĐT thì không lưu)
  const rememberCustomer = (customer) => customer.phone && saveCustomer(customer);
  const createOrder = (order) => {
    addOrder(order);
    rememberCustomer(order.customer);
  };
  const editOrder = (id, order) => {
    updateOrder(id, order);
    rememberCustomer(order.customer);
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
        upcoming={upcoming}
        now={now}
        settings={settings}
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
            now={now}
            settings={settings}
            onUpdateSettings={updateSettings}
            onBackupNow={backupNow}
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
            onImportOrders={importOrders}
            onImportCustomers={importCustomers}
            onSetStatus={changeStatus}
            onSetPaid={changePaid}
          />
        </main>
        <UndoToast
          toast={toast}
          onUndo={() => {
            toast.undo();
            setToast(null);
          }}
          onDismiss={dismissToast}
        />
      </div>
    </div>
  );
}
