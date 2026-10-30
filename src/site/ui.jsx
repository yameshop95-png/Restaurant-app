import { createContext, useContext, useEffect, useState } from 'react';
import { Facebook, Mail, MapPin, Minus, Phone, Plus, ShoppingBag } from 'lucide-react';
import { formatMoney } from '../lib/stats';
import { TEXT as ORDER_TEXT } from '../order/i18n';
import { BLOG_ENABLED, dishText, orderingRules, path, SOCIAL } from './lib';

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

// Hình vẽ lá / tỏi mờ của mẫu (public/site/deco)
export function Deco({ name, className = '' }) {
  return <img src={`/site/deco/${name}.png`} alt="" aria-hidden="true" className={`deco ${className}`} />;
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
      className={`flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_35%_25%,#fff7f1,#fbe2d3_75%)] ${className}`}
    >
      <img src={shop.logo || '/logo-round.svg'} alt="" className="w-2/5 max-w-36 rounded-full drop-shadow-md" />
    </div>
  );
}

export function QtyControl({ dish, size = 'md' }) {
  const { cart, setQty, t, mounted } = useSite();
  const qty = mounted ? (cart[dish.id] ?? 0) : 0;
  const btn = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  if (!dish.id) return null;
  if (!dish.available) {
    return <span className="rounded-full bg-mist px-3 py-1.5 text-sm font-semibold text-slate-500">{t.soldOut}</span>;
  }
  if (!qty) {
    return (
      <button
        onClick={() => setQty(dish.id, 1)}
        className={`btn btn-accent ${size === 'lg' ? 'h-12' : 'h-10 px-5 text-base'}`}
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
        className={`flex ${btn} items-center justify-center rounded-full border border-slate-300 text-ink hover:bg-mist`}
      >
        <Minus size={18} />
      </button>
      <span className="w-6 text-center text-lg font-bold tabular-nums">{qty}</span>
      <button
        onClick={() => setQty(dish.id, qty + 1)}
        aria-label={`+1 ${dish.name}`}
        className={`flex ${btn} items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600`}
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

// Thẻ món như mẫu: ảnh tròn nổi trên thẻ trắng, nhãn giá tròn xanh đen
export function DishCard({ dish }) {
  const { lang } = useSite();
  const txt = dishText(dish, lang);
  const href = path(`/menu/${dish.slug}`);
  return (
    <article className={`group relative flex flex-col pt-24 ${dish.available ? '' : 'opacity-60'}`}>
      <Link
        to={href}
        aria-label={txt.name}
        className="absolute left-1/2 top-0 z-10 block aspect-square w-48 -translate-x-1/2 overflow-hidden rounded-full shadow-[0_18px_40px_-18px_rgba(16,26,36,0.45)] transition duration-300 group-hover:-translate-y-1"
      >
        <Photo src={dish.content?.photo} alt={txt.name} />
      </Link>
      {dish.price != null && (
        <span
          className={`absolute left-[calc(50%+3.5rem)] top-8 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-ink font-bold text-white shadow-[0_12px_24px_-8px_rgba(16,26,36,0.6)] ${dish.price % 1 ? 'text-xs' : 'text-[15px]'}`}
        >
          {formatMoney(dish.price).replace(/\.00$/, '')}
        </span>
      )}
      <div className="flex flex-1 flex-col items-center rounded-[28px] bg-card px-5 pb-6 pt-32 text-center shadow-[0_24px_50px_-30px_rgba(16,26,36,0.35)] ring-1 ring-slate-200/70">
        <Link to={href} className="block">
          <h3 className="font-serif text-xl font-bold leading-snug text-ink">{txt.name}</h3>
        </Link>
        {txt.short && <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{txt.short}</p>}
        {txt.portion && (
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{txt.portion}</p>
        )}
        <div className="mt-auto pt-5">
          <QtyControl dish={dish} />
        </div>
      </div>
    </article>
  );
}

// Tiêu đề khu vực như mẫu: chữ có chân, giữa trang, một câu nhỏ bên dưới
export function SectionTitle({ title, text, align = 'center', as: H = 'h2' }) {
  const center = align === 'center';
  return (
    <div className={center ? 'mx-auto max-w-xl text-center' : 'max-w-xl'}>
      <H className="font-serif text-4xl font-bold leading-tight text-ink text-balance sm:text-5xl">{title}</H>
      {text && <p className={`mt-4 text-base leading-7 text-slate-500 ${center ? 'mx-auto max-w-md' : ''}`}>{text}</p>}
    </div>
  );
}

export function Logo({ size = 'h-11 w-11', text = 'text-lg sm:text-xl' }) {
  const { shop, t } = useSite();
  return (
    <Link to={path()} className="flex min-w-0 items-center gap-3">
      <img
        src={shop.logo || '/logo-round.svg'}
        alt=""
        className={`${size} shrink-0 rounded-full transition-all duration-300`}
      />
      <span className={`${text} font-bold leading-tight tracking-tight text-ink transition-all duration-300`}>
        {shop.shopName || t.defaultName}
      </span>
    </Link>
  );
}

// Thanh trên cùng: hàng 1 logo to + tên quán đầy đủ, hàng 2 các mục. Lướt xuống thì logo thu về cỡ thường.
export function Nav() {
  const { t, lang, setLang, route } = useSite();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const item = (to, label, active) => (
    <Link
      to={to}
      className={`shrink-0 border-b-2 py-2.5 text-[15px] sm:text-base ${
        active ? 'border-blue-500 font-semibold text-blue-500' : 'border-transparent text-ink hover:text-blue-500'
      }`}
    >
      {label}
    </Link>
  );
  return (
    <header className="sticky top-0 z-30 bg-page/95 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(16,26,36,0.06)] backdrop-blur">
      <div
        className={`mx-auto flex max-w-6xl items-center gap-3 px-4 transition-all duration-300 sm:px-6 ${
          compact ? 'py-2' : 'py-3 sm:py-4'
        }`}
      >
        <Logo
          size={compact ? 'h-11 w-11' : 'h-16 w-16 sm:h-24 sm:w-24'}
          text={compact ? 'text-lg sm:text-xl' : 'text-[22px] sm:text-3xl'}
        />
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
            className="rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-500 hover:text-ink"
            aria-label={t.lang}
          >
            {lang === 'vi' ? 'EN' : 'VI'}
          </button>
          <Link to={path('/checkout')} className="btn btn-accent hidden px-7 py-4 text-lg sm:inline-flex">
            {t.nav.order}
          </Link>
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl items-center gap-5 overflow-x-auto px-4 sm:gap-10 sm:px-6">
        {item(path('/menu'), t.nav.menu, route.name === 'menu' || route.name === 'dish')}
        {item(
          path('/#delivery'),
          <>
            <span className="sm:hidden">{t.nav.deliveryShort}</span>
            <span className="hidden sm:inline">{t.nav.delivery}</span>
          </>,
          false,
        )}
        {BLOG_ENABLED && item(path('/blog'), t.nav.blog, route.name === 'blog' || route.name === 'post')}
        {item('#contact', t.nav.contact, false)}
        <Link
          to={path('/checkout')}
          className="btn btn-accent my-1.5 ml-auto shrink-0 px-4 py-2 text-[15px] shadow-none sm:hidden"
        >
          {t.nav.order}
        </Link>
      </nav>
    </header>
  );
}

export function Footer() {
  const { shop, t, lang, dishes } = useSite();
  const rules = orderingRules(shop);
  const days = ORDER_TEXT[lang].weekdays;
  const picks = (dishes.some((d) => d.content?.featured) ? dishes.filter((d) => d.content?.featured) : dishes).slice(
    0,
    4,
  );
  const head = 'text-xs font-bold uppercase leading-10 tracking-wide text-ink';
  const link = 'block leading-10 text-slate-500 hover:text-ink';
  return (
    <footer id="contact" className="scroll-mt-32 bg-page">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-14 sm:px-6 grid-cols-2 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo size="h-12 w-12" />
          <p className="mt-5 max-w-sm leading-7 text-slate-500">{t.footerAbout}</p>
          <p className={`${head} mt-6`}>{t.ordering}</p>
          <dl className="grid grid-cols-3 gap-4 text-[15px] leading-7 text-slate-500">
            <div>
              <dt>{t.pickupLabel}</dt>
              <dd>{t.anyDay}</dd>
            </div>
            <div>
              <dt>{t.deliveryLabel}</dt>
              <dd>
                {days[rules.day]} {rules.start}–{rules.end}
              </dd>
            </div>
            <div>
              <dt>{t.orderBy}</dt>
              <dd>
                {days[(rules.day + 6) % 7]} {rules.cutoff}
              </dd>
            </div>
          </dl>
        </div>
        <nav>
          <p className={head}>{t.navTitle}</p>
          <Link to={path('/menu')} className={link}>
            {t.nav.menu}
          </Link>
          <Link to={path('/checkout')} className={link}>
            {t.nav.order}
          </Link>
          <Link to={path('/#delivery')} className={link}>
            {t.nav.delivery}
          </Link>
          {BLOG_ENABLED && (
            <Link to={path('/blog')} className={link}>
              {t.nav.blog}
            </Link>
          )}
        </nav>
        <nav>
          <p className={head}>{t.dishesTitle}</p>
          {picks.map((d) => (
            <Link key={d.slug} to={path(`/menu/${d.slug}`)} className={`${link} truncate`}>
              {dishText(d, lang).name.split(' – ')[0]}
            </Link>
          ))}
        </nav>
        <div className="col-span-2 md:col-span-1">
          <p className={head}>{t.contactTitle}</p>
          <ul className="space-y-3 pt-1.5 text-slate-500">
            {shop.shopPhone && (
              <li className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-ink text-ink">
                  <Phone size={16} />
                </span>
                <a href={`tel:${shop.shopPhone}`} className="hover:text-ink">
                  {shop.shopPhone}
                </a>
              </li>
            )}
            {shop.shopAddress && (
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-ink text-ink">
                  <MapPin size={16} />
                </span>
                <span className="pt-1.5">{shop.shopAddress}</span>
              </li>
            )}
            {!shop.shopPhone && !shop.shopAddress && (
              <li className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-ink text-ink">
                  <Mail size={16} />
                </span>
                {t.contactSoon}
              </li>
            )}
          </ul>
          <p className={`${head} mt-6`}>{t.followUs}</p>
          <a
            href={SOCIAL.facebook}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink ring-1 ring-ink transition hover:bg-ink hover:text-white"
          >
            <Facebook size={18} />
          </a>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-wrap justify-between gap-3 border-t border-slate-200 px-4 py-8 text-[15px] text-slate-500 sm:px-6">
        <p>
          © {new Date().getFullYear()} <b className="text-ink">{shop.shopName || t.defaultName}</b> · Albury–Wodonga
        </p>
        <p>{t.payNote}</p>
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
        className="mx-auto flex max-w-md items-center justify-between rounded-2xl bg-ink px-5 py-4 font-semibold text-white shadow-[0_20px_40px_-12px_rgba(16,26,36,0.6)]"
      >
        <span className="flex items-center gap-2">
          <ShoppingBag size={18} /> {t.cart(count, formatMoney(total))}
        </span>
        <span className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-bold">{t.checkout} →</span>
      </Link>
    </div>
  );
}
