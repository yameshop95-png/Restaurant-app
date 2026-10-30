import { createContext, useContext } from 'react';
import { MapPin, Minus, Phone, Plus, ShoppingBag } from 'lucide-react';
import { formatMoney } from '../lib/stats';
import { dishText, path } from './lib';

export const SiteContext = createContext(null);
export const useSite = () => useContext(SiteContext);

// Link trong website: chuyển trang không tải lại
export function Link({ to, className, children, ...rest }) {
  const { navigate } = useSite();
  return (
    <a href={to} className={className} onClick={(e) => navigate(e, to)} {...rest}>
      {children}
    </a>
  );
}

// Ảnh món; chưa có ảnh thì hiện khung có logo
export function Photo({ src, alt, className = '', eager = false }) {
  const { shop } = useSite();
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#3a2418,#1e1e24_70%)] ${className}`}
    >
      <img src={shop.logo || '/logo-round.svg'} alt="" className="w-1/3 max-w-32 rounded-full opacity-90" />
    </div>
  );
}

export function QtyControl({ dish, size = 'md' }) {
  const { cart, setQty, t, mounted } = useSite();
  const qty = mounted ? cart[dish.id] ?? 0 : 0;
  const btn = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  if (!dish.id) return null;
  if (!dish.available) {
    return <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-500">{t.soldOut}</span>;
  }
  if (!qty) {
    return (
      <button
        onClick={() => setQty(dish.id, 1)}
        className={`flex items-center gap-1.5 rounded-full bg-blue-500 px-4 font-semibold text-white active:bg-blue-600 ${size === 'lg' ? 'h-12 text-base' : 'h-10 text-sm'}`}
      >
        <Plus size={18} /> {t.add}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setQty(dish.id, qty - 1)}
        aria-label={`−1 ${dish.name}`}
        className={`flex ${btn} items-center justify-center rounded-full bg-slate-100 text-slate-900 active:bg-slate-200`}
      >
        <Minus size={18} />
      </button>
      <span className="w-6 text-center text-lg font-bold tabular-nums">{qty}</span>
      <button
        onClick={() => setQty(dish.id, qty + 1)}
        aria-label={`+1 ${dish.name}`}
        className={`flex ${btn} items-center justify-center rounded-full bg-blue-500 text-white active:bg-blue-600`}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

export function Price({ dish, className = '' }) {
  const { t } = useSite();
  if (dish.price == null) return <span className={`text-sm text-slate-500 ${className}`}>{t.priceSoon}</span>;
  return <span className={`font-bold text-gold ${className}`}>{formatMoney(dish.price)}</span>;
}

export function DishCard({ dish }) {
  const { lang } = useSite();
  const txt = dishText(dish, lang);
  const href = path(`/menu/${dish.slug}`);
  return (
    <article className={`flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-card ${dish.available ? '' : 'opacity-60'}`}>
      <Link to={href} className="block aspect-[4/3] overflow-hidden" aria-label={txt.name}>
        <Photo src={dish.content?.photo} alt={txt.name} className="transition duration-300 hover:scale-105" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link to={href} className="block">
          <h3 className="text-lg font-bold leading-snug text-slate-900">{txt.name}</h3>
        </Link>
        {txt.short && <p className="text-sm text-slate-500">{txt.short}</p>}
        {txt.portion && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{txt.portion}</p>}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <Price dish={dish} className="text-lg" />
          <QtyControl dish={dish} />
        </div>
      </div>
    </article>
  );
}

export function Nav() {
  const { shop, t, lang, setLang, route } = useSite();
  const item = (to, label, active) => (
    <Link
      to={to}
      className={`rounded-lg px-3 py-2 text-sm font-semibold ${active ? 'text-white' : 'text-slate-500 hover:text-slate-800'}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-page/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6">
        <Link to={path()} className="flex min-w-0 items-center gap-2.5">
          <img src={shop.logo || '/logo-round.svg'} alt="" className="h-10 w-10 shrink-0 rounded-full" />
          <span className="hidden truncate font-bold text-slate-900 sm:block">{shop.shopName || t.defaultName}</span>
        </Link>
        <nav className="ml-auto flex items-center gap-0.5">
          {item(path('/menu'), t.nav.menu, route.name === 'menu' || route.name === 'dish')}
          {item(path('/blog'), t.nav.blog, route.name === 'blog' || route.name === 'post')}
          <Link to={path('/checkout')} className="ml-1 rounded-xl bg-blue-500 px-3.5 py-2 text-sm font-bold text-white active:bg-blue-600">
            {t.nav.order}
          </Link>
          <button
            onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
            className="ml-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700"
            aria-label={t.lang}
          >
            {lang === 'vi' ? 'EN' : 'VI'}
          </button>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  const { shop, t } = useSite();
  return (
    <footer className="mt-16 border-t border-slate-200 bg-card">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6">
        <div className="flex items-start gap-3">
          <img src={shop.logo || '/logo-round.svg'} alt="" className="h-14 w-14 shrink-0 rounded-full" />
          <div>
            <p className="font-bold text-slate-900">{shop.shopName || t.defaultName}</p>
            <p className="mt-1 text-sm text-slate-500">{t.footerHours}</p>
          </div>
        </div>
        <div className="space-y-1.5 text-sm text-slate-700 sm:text-right">
          {shop.shopAddress && (
            <p className="flex items-start gap-1.5 sm:justify-end">
              <MapPin size={16} className="mt-0.5 shrink-0" /> {shop.shopAddress}
            </p>
          )}
          {shop.shopPhone && (
            <p className="flex items-center gap-1.5 sm:justify-end">
              <Phone size={16} className="shrink-0" />
              <a href={`tel:${shop.shopPhone}`} className="select-all">
                {shop.shopPhone}
              </a>
            </p>
          )}
          <p className="flex flex-wrap gap-x-4 gap-y-1 pt-2 sm:justify-end">
            <Link to={path('/menu')} className="hover:text-slate-900">{t.nav.menu}</Link>
            <Link to={path('/blog')} className="hover:text-slate-900">{t.nav.blog}</Link>
            <Link to={path('/checkout')} className="hover:text-slate-900">{t.nav.order}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

// Thanh giỏ hàng dưới đáy (trừ trang đặt món)
export function CartBar() {
  const { cart, dishes, route, t, mounted } = useSite();
  if (!mounted || route.name === 'checkout') return null;
  const items = dishes.filter((d) => d.id && cart[d.id] > 0);
  const count = items.reduce((s, d) => s + cart[d.id], 0);
  if (!count) return null;
  const total = items.reduce((s, d) => s + cart[d.id] * (d.price ?? 0), 0);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <Link
        to={path('/checkout')}
        className="mx-auto flex max-w-md items-center justify-between rounded-2xl bg-blue-500 px-5 py-3.5 font-bold text-white shadow-xl shadow-black/50 active:bg-blue-600"
      >
        <span className="flex items-center gap-2">
          <ShoppingBag size={18} /> {t.cart(count, formatMoney(total))}
        </span>
        <span>{t.checkout} →</span>
      </Link>
    </div>
  );
}
