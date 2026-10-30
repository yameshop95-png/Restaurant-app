import { useCallback, useEffect, useRef, useState } from 'react';
import BottomNav from './components/BottomNav';
import OnlineOrderAlert from './components/OnlineOrderAlert';
import PinLogin from './components/PinLogin';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import UndoToast from './components/UndoToast';
import useAuth from './hooks/useAuth';
import useCustomers from './hooks/useCustomers';
import useMenu from './hooks/useMenu';
import useNow from './hooks/useNow';
import useOrders from './hooks/useOrders';
import useSettings from './hooks/useSettings';
import { exportAll } from './lib/backup';
import { alertBeep, dueInfo, upcomingOrders } from './lib/due';
import { paymentLabel, statusLabel } from './lib/orderStatus';
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

// Chưa đăng nhập thì hiện màn hình nhập mã PIN; dữ liệu chỉ tải sau khi đăng nhập.
export default function App() {
  const auth = useAuth();
  if (auth.status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-page text-slate-500">Đang mở…</div>;
  }
  if (auth.status !== 'signedIn') {
    return <PinLogin onLogin={auth.login} offlineError={auth.status === 'offline' ? auth.error : null} onRetry={auth.retry} />;
  }
  // key: đổi người đăng nhập thì tải lại từ đầu
  return <Shop key={auth.account.id} account={auth.account} onLogout={auth.logout} />;
}

function Shop({ account, onLogout }) {
  const isOwner = account.role === 'owner';
  const [activeTab, setActiveTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { orders, ready: ordersReady, loadError, addOrder, updateOrder, setStatus, setPaid, importOrders } =
    useOrders(account);
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
    setToast({ label: `Đơn #${order.number}: ${statusLabel(status, order.type)}`, undo: () => setStatus(id, before) });
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
    if (!ordersReady) return;
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
  }, [orders, ordersReady, now, settings.dueSound]);

  // Đơn khách đặt qua website: kêu + hiện thông báo nổi. Lần đầu tải chỉ ghi nhận đơn đã có.
  const [onlineAlerts, setOnlineAlerts] = useState([]);
  const seenOrders = useRef(null);
  useEffect(() => {
    if (!ordersReady) return;
    if (!seenOrders.current) {
      seenOrders.current = new Set(orders.map((o) => o.id));
      return;
    }
    const fresh = orders.filter(
      (o) =>
        !seenOrders.current.has(o.id) &&
        o.source === 'web' &&
        Date.now() - new Date(o.createdAt).getTime() < 30 * 60000
    );
    orders.forEach((o) => seenOrders.current.add(o.id));
    if (!fresh.length) return;
    alertBeep();
    setOnlineAlerts((list) => [...fresh, ...list]);
  }, [orders, ordersReady]);
  const dismissOnline = useCallback((id) => setOnlineAlerts((list) => list.filter((o) => o.id !== id)), []);

  // Sao lưu tất cả vào một file Excel và ghi lại thời điểm để nhắc sao lưu định kỳ
  const backupNow = async () => {
    await exportAll({ orders, customers, menu });
    updateSettings({ lastBackupAt: new Date().toISOString() });
  };

  // Tạo hoặc sửa đơn đều cập nhật luôn danh bạ khách hàng (khách đến lấy không để SĐT thì không lưu)
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
    pendingPickup: pending.filter((o) => o.type !== 'delivery').length,
    pendingDelivery: pending.filter((o) => o.type === 'delivery').length,
    pendingAll: pending.length,
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  // Báo cáo chỉ dành cho chủ quán
  const ActivePage = PAGES[!isOwner && activeTab === 'report' ? 'home' : activeTab];
  const pendingTotal = counts.pendingAll;

  return (
    <div className="min-h-screen">
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        counts={counts}
        upcoming={upcoming}
        now={now}
        settings={settings}
        account={account}
        onLogout={onLogout}
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

        <main className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-6">
          {!ordersReady && (
            <p className="mx-auto mb-4 max-w-2xl rounded-2xl bg-card px-4 py-3 text-center text-sm text-slate-500">
              {loadError ? `Chưa tải được dữ liệu: ${loadError}. Đang thử lại…` : 'Đang tải dữ liệu…'}
            </p>
          )}
          <ActivePage
            account={account}
            isOwner={isOwner}
            dataReady={ordersReady}
            onLogout={onLogout}
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
        <BottomNav
          activeTab={activeTab}
          counts={counts}
          onTabChange={handleTabChange}
          onMore={() => setSidebarOpen(true)}
        />
        <OnlineOrderAlert
          alerts={onlineAlerts}
          onDismiss={dismissOnline}
          onOpen={(o) => {
            dismissOnline(o.id);
            handleTabChange(o.type === 'delivery' ? 'delivery' : 'orders');
          }}
        />
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
