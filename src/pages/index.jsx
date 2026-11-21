import { lazy } from 'react';
import OrdersPage from './OrdersPage';
import HomePage from './HomePage';

// Màn hình chính và Đơn hàng (dùng nhiều nhất) nằm sẵn trong gói đầu; các trang còn lại chỉ tải khi mở lần đầu
export { HomePage, OrdersPage };
export const SettingsPage = lazy(() => import('./SettingsPage'));
export const CustomersPage = lazy(() => import('./CustomersPage'));
export const CustomerActivityPage = lazy(() => import('./CustomerActivityPage'));
export const MenuPage = lazy(() => import('./MenuPage'));
export const ReportPage = lazy(() => import('./ReportPage'));
export const InventoryPage = lazy(() => import('./InventoryPage'));
export const PrepPage = lazy(() => import('./PrepPage'));
export const DeliveryPage = (props) => <OrdersPage {...props} fixedType="delivery" />;
// Mục "Chờ nấu" riêng trong điều hướng: cùng OrdersPage nhưng khoá vào trạm chờ nấu (gộp cả 2 loại đơn)
export const CookingPage = (props) => <OrdersPage {...props} fixedFilter="cooking" />;
