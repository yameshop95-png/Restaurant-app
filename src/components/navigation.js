import { LayoutDashboard, ClipboardList, Bike, ChartColumn, Users, UtensilsCrossed, Settings } from 'lucide-react';

// Danh sách tab điều hướng. `badgeKey` trỏ tới bộ đếm hiển thị badge trên menu.
export const NAV_ITEMS = [
  { id: 'home', label: 'Màn hình chính', icon: LayoutDashboard },
  // Đơn hàng: 2 tab con Đến lấy / Giao hàng, nên đếm tất cả đơn chờ
  { id: 'orders', label: 'Đơn hàng', icon: ClipboardList, badgeKey: 'pendingAll' },
  { id: 'delivery', label: 'Đơn ship', icon: Bike, badgeKey: 'pendingDelivery' },
  { id: 'report', label: 'Báo cáo', icon: ChartColumn },
  { id: 'customers', label: 'Khách hàng', icon: Users },
  { id: 'menu', label: 'Quản lý món ăn', icon: UtensilsCrossed },
  { id: 'settings', label: 'Cài đặt app', icon: Settings },
];
