import { AlarmClock, BellRing, ChefHat, LogOut, Phone, UserRound, X } from 'lucide-react';
import { NAV_ITEMS } from './navigation';

function Badge({ count, active }) {
  if (!count) return null;
  return (
    <span
      className={`ml-auto min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-bold ${
        active ? 'bg-card text-orange-600' : 'bg-red-500 text-white'
      }`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function Sidebar({ activeTab, onTabChange, counts, upcoming, now, settings, account, onLogout, isOpen, onClose }) {
  const totalPending = counts.pendingAll;
  const overdue = upcoming.filter((o) => new Date(o.deliverAt) < now).length;
  // Bấm vào ô "cần giao" thì mở tab của đơn gấp nhất
  const urgentTab = upcoming[0]?.type === 'delivery' ? 'delivery' : 'orders';

  return (
    <>
      {/* Lớp nền mờ khi mở sidebar trên mobile */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/60 transition-opacity lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-[#0d0d0f] text-slate-800 border-r border-slate-200 transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo + tên quán (đặt trong Cài đặt app) */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-5">
          <button
            onClick={() => onTabChange('settings')}
            className="flex min-w-0 items-center gap-3 text-left"
            aria-label="Thông tin quán"
          >
            {settings.logo ? (
              <img src={settings.logo} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-card object-cover" />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
                <ChefHat size={24} />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-white">{settings.shopName || 'Quán của bạn'}</p>
              <p className="truncate text-xs text-slate-500">
                {settings.shopName ? 'Nhận order' : 'Bấm để đặt tên quán'}
              </p>
            </div>
          </button>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-white lg:hidden"
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Đơn đến giờ giao / giờ khách đến lấy trong 1 giờ tới (kể cả đơn đã trễ) */}
        <button
          onClick={() => upcoming.length && onTabChange(urgentTab)}
          className={`mx-4 mt-4 flex items-center gap-3 rounded-xl px-4 py-3 text-left ${
            overdue ? 'bg-red-500/20 ring-1 ring-red-400/60' : 'bg-slate-50'
          }`}
        >
          <AlarmClock size={18} className={overdue ? 'text-red-300' : upcoming.length ? 'text-orange-400' : 'text-slate-500'} />
          <span className="text-sm">
            {upcoming.length ? (
              <>
                <span className="font-semibold text-white">{upcoming.length} đơn</span> cần xong trong 1 giờ tới
                {overdue > 0 && <span className="block font-semibold text-red-300">{overdue} đơn đã trễ giờ</span>}
              </>
            ) : (
              <span className="text-slate-500">Không có đơn cần xong trong 1 giờ tới</span>
            )}
          </span>
        </button>

        {/* Ưu tiên cao: thanh cảnh báo đơn mới chờ xử lý */}
        {totalPending > 0 && (
          <button
            onClick={() => onTabChange('orders')}
            className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-red-500 px-4 py-3 text-left text-white shadow-lg shadow-red-500/30 ring-2 ring-red-400/50 transition hover:bg-red-600"
          >
            <BellRing size={22} className="shrink-0 animate-bounce" />
            <div className="min-w-0">
              <p className="text-sm font-bold">{totalPending} đơn mới chờ xử lý</p>
              <p className="text-xs text-white/80">
                {counts.pendingPickup} đến lấy · {counts.pendingDelivery} giao hàng
              </p>
            </div>
          </button>
        )}

        {/* Menu điều hướng */}
        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3">
          {NAV_ITEMS.filter((item) => !item.ownerOnly || account.role === 'owner').map(({ id, label, icon: Icon, badgeKey }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  active
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
                <Badge count={badgeKey ? counts[badgeKey] : 0} active={active} />
              </button>
            );
          })}
        </nav>

        {settings.shopPhone && (
          <a
            href={`tel:${settings.shopPhone}`}
            className="flex items-center gap-2 border-t border-slate-200 px-5 py-3 text-sm text-slate-500"
          >
            <Phone size={14} /> {settings.shopPhone}
          </a>
        )}

        {/* Người đang dùng máy này */}
        <div className="flex items-center gap-3 border-t border-slate-200 px-5 py-3">
          <UserRound size={18} className="shrink-0 text-slate-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{account.name}</p>
            <p className="text-xs text-slate-500">{account.role === 'owner' ? 'Chủ quán' : 'Nhân viên'}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-white"
          >
            <LogOut size={15} /> Đổi người
          </button>
        </div>
      </aside>
    </>
  );
}
