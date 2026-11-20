import { applyTheme } from './lib/theme';
import { InventoryProvider } from './hooks/useInventory';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import BottomNav from './components/BottomNav';
import OnlineOrderAlert from './components/OnlineOrderAlert';
import PinLogin from './components/PinLogin';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import UndoToast from './components/UndoToast';
import { NAV_ITEMS } from './components/navigation';
import useAlwaysOn from './hooks/useAlwaysOn';
import useAuth from './hooks/useAuth';
import useCustomers from './hooks/useCustomers';
import useMenu from './hooks/useMenu';
import useNow from './hooks/useNow';
import useOrders from './hooks/useOrders';
import useSettings from './hooks/useSettings';
import { exportAll } from './lib/backup';
import { alertBeep, dueInfo, unlockAudio, upcomingOrders } from './lib/due';
import { sendToShopPrinter } from './lib/printQueue';
import { paymentLabel, statusLabel } from './lib/orderStatus';
import {
  HomePage,
  OrdersPage,
  DeliveryPage,
  ReportPage,
  CustomersPage,
  CustomerActivityPage,
  MenuPage,
  InventoryPage,
  PrepPage,
  SettingsPage,
} from './pages';

// Đơn web máy này đã tự in (giữ 300 đơn gần nhất), để tải lại app không in trùng
const PRINTED_KEY = 'restaurant-app.autoPrinted';
function readPrinted() {
  try {
    return new Set(JSON.parse(localStorage.getItem(PRINTED_KEY)) ?? []);
  } catch {
    return new Set();
  }
}
function savePrinted(set) {
  try {
    localStorage.setItem(PRINTED_KEY, JSON.stringify([...set].slice(-300)));
  } catch {
    // bộ nhớ đầy / chế độ ẩn danh: bỏ qua
  }
}

// Map id tab -> component hiển thị trong Main Content Area.
const PAGES = {
  home: HomePage,
  orders: OrdersPage,
  delivery: DeliveryPage,
  prep: PrepPage,
  report: ReportPage,
  customers: CustomersPage,
  activity: CustomerActivityPage,
  menu: MenuPage,
  inventory: InventoryPage,
  settings: SettingsPage,
};

// Chưa đăng nhập thì hiện màn hình nhập mã PIN; dữ liệu chỉ tải sau khi đăng nhập.
export default function App() {
  const auth = useAuth();
  if (auth.status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-page text-slate-500">Đang mở…</div>;
  }
  if (auth.status !== 'signedIn') {
    return (
      <PinLogin
        onLogin={auth.login}
        offlineError={auth.status === 'offline' ? auth.error : null}
        onRetry={auth.retry}
      />
    );
  }
  // key: đổi người đăng nhập thì tải lại từ đầu
  const shop = <Shop key={auth.account.id} account={auth.account} onLogout={auth.logout} />;
  // Dữ liệu kho chỉ chủ quán dùng: tải một lần cho cả app thay vì mỗi lần mở một trang
  return auth.account.role === 'owner' ? <InventoryProvider key={auth.account.id}>{shop}</InventoryProvider> : shop;
}

function Shop({ account, onLogout }) {
  const isOwner = account.role === 'owner';
  // Quản lý: như nhân viên, thêm xem tiền tuần này và quản lý tài khoản nhân viên
  const isManager = account.role === 'manager';
  const [activeTab, setActiveTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const viewDir = useRef('forward');
  const {
    orders,
    ready: ordersReady,
    loadError,
    addOrder,
    updateOrder,
    setStatus,
    markOrder,
    setPaid,
    importOrders,
  } = useOrders(account);
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
  // Đơn online: "Đã nhận đơn" rồi "Đã nhắn xác nhận". Mỗi bước có Hoàn tác như đổi trạng thái.
  const markStep = (id, patch, label) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, order[k] ?? null]));
    markOrder(id, patch);
    setToast({ label: `Đơn #${order.number}: ${label}`, undo: () => markOrder(id, before) });
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
  useAlwaysOn(settings.keepAwake);
  useEffect(() => applyTheme(settings.theme), [settings.theme]);
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

  // Đơn khách đặt qua website: kêu + hiện thông báo nổi.
  // Đơn web còn "chưa nhận" (chờ xử lý, chưa ai bấm Nhận đơn) luôn được báo, kể cả đơn đến lúc app đang tắt
  // hoặc lúc mất mạng: mở app lên là kêu ngay, không để đơn nằm im trong danh sách.
  const [onlineAlerts, setOnlineAlerts] = useState([]);
  const seenOrders = useRef(null);
  useEffect(() => {
    if (!ordersReady) return;
    const unhandled = (o) =>
      o.source === 'web' &&
      o.status === 'pending' &&
      !o.receivedAt &&
      Date.now() - new Date(o.createdAt).getTime() < 7 * 86400000;
    const first = !seenOrders.current;
    if (first) seenOrders.current = new Set();
    const fresh = orders.filter((o) => !seenOrders.current.has(o.id) && unhandled(o));
    orders.forEach((o) => seenOrders.current.add(o.id));
    if (!fresh.length) return;
    alertBeep();
    setOnlineAlerts((list) => [...fresh.filter((o) => !list.some((a) => a.id === o.id)), ...list]);
    // Máy được bật "Tự in bill": đơn website tự ra bill ở quán. Nhớ đơn đã in trên máy này để tải lại app không in trùng;
    // đơn cũ hơn 1 ngày (lúc mới bật app) thì không tự in lại.
    if (settings.autoPrint) {
      const printed = readPrinted();
      const toPrint = fresh.filter(
        (o) => !printed.has(o.id) && (!first || Date.now() - new Date(o.createdAt).getTime() < 86400000),
      );
      toPrint.forEach((o) => printed.add(o.id));
      savePrinted(printed);
      toPrint.forEach((o) => sendToShopPrinter(o, settings.shopName).catch(() => {}));
    }
  }, [orders, ordersReady, settings.autoPrint, settings.shopName]);
  // Đơn đã có người bấm Nhận đơn (máy này hay máy khác) / đã huỷ: tắt thông báo
  useEffect(() => {
    setOnlineAlerts((list) => {
      const next = list.filter((a) => {
        const o = orders.find((x) => x.id === a.id);
        return o && o.status === 'pending' && !o.receivedAt;
      });
      return next.length === list.length ? list : next;
    });
  }, [orders]);
  // Chuông báo lặp lại mỗi 3,5 giây cho tới khi có người bấm vào thông báo để mở đơn (xác nhận),
  // kẻo nhân viên bận không nghe thấy. Bấm vào thông báo hoặc nút X sẽ tắt chuông.
  useEffect(() => {
    if (!onlineAlerts.length) return undefined;
    const timer = setInterval(alertBeep, 3500);
    return () => clearInterval(timer);
  }, [onlineAlerts.length]);
  // Lần chạm đầu tiên vào app mở khoá âm thanh của trình duyệt
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);
  // Tên tab hiện số đơn online chưa xem
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '');
    document.title = onlineAlerts.length ? `(${onlineAlerts.length}) ${base}` : base;
  }, [onlineAlerts.length]);
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
    const from = Math.max(0, NAV_ITEMS.findIndex((item) => item.id === activeTab));
    const to = Math.max(0, NAV_ITEMS.findIndex((item) => item.id === tab));
    viewDir.current = to >= from ? 'forward' : 'back';
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  // Báo cáo chỉ dành cho chủ quán
  const ActivePage = PAGES[!isOwner && (activeTab === 'report' || activeTab === 'inventory') ? 'home' : activeTab];
  const pendingTotal = counts.pendingAll;

  return (
    <div className="min-h-screen">
      <a className="staff-skip" href="#noi-dung">
        Vào nội dung
      </a>
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

        <main id="noi-dung" tabIndex={-1} className="mx-auto max-w-7xl p-4 pb-28 outline-none sm:p-6 sm:pb-28 lg:pb-6">
          {!ordersReady && (
            <p className="mx-auto mb-4 max-w-2xl rounded-2xl bg-card px-4 py-3 text-center text-sm text-slate-500">
              {loadError ? `Chưa tải được dữ liệu: ${loadError}. Đang thử lại…` : 'Đang tải dữ liệu…'}
            </p>
          )}
          <div key={activeTab} className="staff-view" data-dir={viewDir.current}>
          <Suspense fallback={<p className="py-16 text-center text-slate-500">Đang mở…</p>}>
            <ActivePage
              account={account}
              isOwner={isOwner}
              isManager={isManager}
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
              onMarkStep={markStep}
              onSetPaid={changePaid}
              onNavigate={handleTabChange}
            />
          </Suspense>
          </div>
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
