import {
  Activity,
  Boxes,
  LayoutDashboard,
  ClipboardList,
  CookingPot,
  Bike,
  ChartColumn,
  ChefHat,
  Users,
  UtensilsCrossed,
  Settings,
} from 'lucide-react';

// Danh sách tab điều hướng. `badgeKey` trỏ tới bộ đếm hiển thị badge trên menu; `ownerOnly`: nhân viên không thấy.
export const NAV_ITEMS = [
  { id: 'home', label: 'Màn hình chính', icon: LayoutDashboard },
  // Đơn hàng: trạm hộp thư đến — badge chỉ đếm đơn web chưa xác nhận (đơn đã xác nhận nằm ở Chờ nấu)
  { id: 'orders', label: 'Đơn hàng', icon: ClipboardList, badgeKey: 'inboxAll' },
  // Chờ nấu: mục riêng của bếp — đơn đã xác nhận đang chờ nấu, gộp cả giao hàng và đến lấy
  { id: 'cooking', label: 'Chờ nấu', icon: CookingPot, badgeKey: 'cookingCount' },
  // Đơn ship: đếm đơn giao đang chờ + đang đi giao (đơn đang trên xe vẫn phải thấy ở badge)
  { id: 'delivery', label: 'Đơn ship', icon: Bike, badgeKey: 'deliveryAction' },
  { id: 'prep', label: 'Phiếu làm hàng', icon: ChefHat },
  { id: 'activity', label: 'Customer Active', icon: Activity },
  { id: 'customers', label: 'Khách hàng', icon: Users },
  { id: 'menu', label: 'Quản lý món ăn', icon: UtensilsCrossed },
  { id: 'report', label: 'Báo cáo', icon: ChartColumn, ownerOnly: true },
  { id: 'inventory', label: 'Inventory Management', icon: Boxes, ownerOnly: true },
  { id: 'settings', label: 'Cài đặt app', icon: Settings },
];
