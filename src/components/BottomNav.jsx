import { Bike, ClipboardList, LayoutDashboard, Menu, UtensilsCrossed } from 'lucide-react';

// Thanh tab dưới đáy màn hình điện thoại cho các mục dùng nhiều; "Thêm" mở menu đầy đủ
const TABS = [
  { id: 'home', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'orders', label: 'Đơn hàng', icon: ClipboardList, badgeKey: 'pendingAll' },
  { id: 'delivery', label: 'Đơn ship', icon: Bike, badgeKey: 'pendingDelivery' },
  { id: 'menu', label: 'Món ăn', icon: UtensilsCrossed },
];

export default function BottomNav({ activeTab, counts, onTabChange, onMore }) {
  const inTabs = TABS.some((t) => t.id === activeTab);
  const item = (active) =>
    `relative flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-semibold ${
      active ? 'text-orange-600' : 'text-slate-500'
    }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg">
        {TABS.map(({ id, label, icon: Icon, badgeKey }) => {
          const active = activeTab === id;
          const count = badgeKey ? counts[badgeKey] : 0;
          return (
            <button key={id} onClick={() => onTabChange(id)} aria-current={active ? 'page' : undefined} className={item(active)}>
              <span className={`flex h-8 w-14 items-center justify-center rounded-full ${active ? 'bg-orange-100' : ''}`}>
                <Icon size={21} strokeWidth={active ? 2.4 : 2} />
              </span>
              {label}
              {count > 0 && (
                <span className="absolute left-1/2 top-1 ml-2 min-w-5 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-5 text-white ring-2 ring-white">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
        <button onClick={onMore} className={item(!inTabs)}>
          <span className={`flex h-8 w-14 items-center justify-center rounded-full ${!inTabs ? 'bg-orange-100' : ''}`}>
            <Menu size={21} />
          </span>
          Thêm
        </button>
      </div>
    </nav>
  );
}
