import { Bike, ClipboardList, CookingPot, LayoutDashboard, Menu, UtensilsCrossed } from 'lucide-react';

// Thanh tab dưới đáy màn hình điện thoại cho các mục dùng nhiều; "Thêm" mở menu đầy đủ.
// Chờ nấu là trạm làm việc chính của bếp nên ghim thẳng lên thanh này, cạnh Đơn hàng / Đơn ship.
const TABS = [
  { id: 'home', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'orders', label: 'Đơn hàng', icon: ClipboardList, badgeKey: 'inboxAll' },
  { id: 'cooking', label: 'Chờ nấu', icon: CookingPot, badgeKey: 'cookingCount' },
  { id: 'delivery', label: 'Đơn ship', icon: Bike, badgeKey: 'pendingDelivery' },
  { id: 'menu', label: 'Món ăn', icon: UtensilsCrossed },
];

export default function BottomNav({ activeTab, counts, onTabChange, onMore }) {
  const inTabs = TABS.some((t) => t.id === activeTab);
  const item = (active) =>
    `staff-tab relative flex min-h-11 min-w-0 flex-1 items-center justify-center px-0.5 pb-1.5 pt-1.5 text-[13px] font-medium ${
      active ? 'text-orange-600' : 'text-slate-500'
    }`;
  const pill = (active, icon, label) => (
    <span className={`staff-press staff-tab-pill${active ? ' is-active' : ''}`}>
      {icon}
      <span>{label}</span>
    </span>
  );

  return (
    <nav className="staff-chrome fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex max-w-lg">
        {TABS.map(({ id, label, icon: Icon, badgeKey }) => {
          const active = activeTab === id;
          const count = badgeKey ? counts[badgeKey] : 0;
          return (
            <button key={id} onClick={() => onTabChange(id)} aria-current={active ? 'page' : undefined} className={item(active)}>
              {pill(active, <Icon size={20} strokeWidth={active ? 2.25 : 2} />, label)}
              {count > 0 && (
                <span className="absolute left-1/2 top-1 ml-2 min-w-6 rounded-full bg-red-500 px-1 text-center text-[13px] font-bold leading-5 text-white ring-2 ring-card">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
        <button onClick={onMore} className={item(!inTabs)}>
          {pill(!inTabs, <Menu size={21} />, 'Thêm')}
        </button>
      </div>
    </nav>
  );
}
