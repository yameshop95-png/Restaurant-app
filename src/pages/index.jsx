import OrdersPage from './OrdersPage';

export { default as HomePage } from './HomePage';
export { default as SettingsPage } from './SettingsPage';
export { default as CustomersPage } from './CustomersPage';
export { default as MenuPage } from './MenuPage';
export { OrdersPage };
export const DeliveryPage = (props) => <OrdersPage {...props} type="delivery" />;
