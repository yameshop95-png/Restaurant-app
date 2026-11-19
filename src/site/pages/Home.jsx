import { Banknote, CalendarCheck, Leaf, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';

// Biểu tượng cho từng ý trong t.points (cùng thứ tự)
const POINT_ICONS = [Leaf, CalendarCheck, ShieldCheck, ShoppingBag, Truck, Banknote];
import { formatMoney } from '../../lib/stats';
import { DEFAULT_ZONES } from '../../lib/shippingZones';
import { TEXT as ORDER_TEXT } from '../../order/i18n';
import { formatClock, formatLead, zoneDisplayName } from '../format';
import { BLOG_ENABLED, formatPostDate, orderingRules, path, photoAlt, sortedPosts } from '../lib';
import SplitText from '../SplitText';
import { DishCard, Link, Photo, SectionTitle, useSite } from '../ui';

// Trang chủ theo bố cục mẫu Figma: mở đầu · món đặc biệt · giới thiệu quán · lấy & giao hàng · kêu gọi đặt món
export default function Home() {
  const { t, lang, dishes, shop } = useSite();
  const featured = dishes.filter((d) => d.content?.featured);
  const popular = (featured.length ? featured : dishes).slice(0, 4);
  const photos = dishes.filter((d) => d.content?.photo);
  const pick = (i) => photos[i % Math.max(photos.length, 1)] ?? null;
  const zones = shop.shippingZones ?? DEFAULT_ZONES;
  const rules = orderingRules(shop);
  const days = ORDER_TEXT[lang].weekdays;
  const cutDay = days[(rules.day + 6) % 7];
  const start = formatClock(rules.start, lang);
  const end = formatClock(rules.end, lang);
  const cutoff = formatClock(rules.cutoff, lang);
  const lead = formatLead(rules.lead, lang);
  const name = shop.shopName || t.defaultName;
  const posts = sortedPosts().slice(0, 3);

  return (
    <>
      <Hero t={t} />

      {/* Món đặc biệt + giới thiệu quán: chung một nền xám như mẫu */}
      <section className="relative overflow-hidden bg-mist">
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-24">
          <SectionTitle title={t.specialTitle} text={t.specialText} />
          <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((d) => (
              <DishCard key={d.slug} dish={d} />
            ))}
          </div>
          <p className="mt-12 text-center">
            <Link to={path('/menu')} className="font-semibold text-blue-500 hover:text-blue-600">
              {t.allDishes} →
            </Link>
          </p>

          <div className="mt-24 grid items-center gap-12 md:mt-32 md:grid-cols-2">
            <div className="relative mx-auto aspect-square w-full max-w-[520px]">
              <div className="relative h-full w-full overflow-hidden">
                <Photo src={pick(2)?.content.photo} alt={pick(2) ? photoAlt(pick(2), lang) : name} />
              </div>
            </div>
            <div>
              <SectionTitle align="left" title={t.welcomeTitle(name)} text={t.welcomeText} />
              <ul className="mt-8 grid gap-x-6 gap-y-4 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-3">
                {t.points.map((p, i) => {
                  const Icon = POINT_ICONS[i] ?? Leaf;
                  return (
                    <li
                      key={p}
                      className={`flex items-start gap-3 ${i < 3 ? 'font-semibold text-ink' : 'text-slate-500'}`}
                    >
                      <Icon size={22} className="mt-0.5 shrink-0 text-blue-500" /> {p}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link to={path('/menu')} className="btn btn-dark">
                  {t.nav.menu}
                </Link>
                <Link to={path('/checkout')} className="btn btn-accent">
                  {t.nav.order}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Đến lấy & giao hàng */}
      <section id="delivery" className="relative scroll-mt-32 overflow-hidden">
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
          <div>
            <SectionTitle align="left" title={t.deliveryTitle} />
            <div className="mt-6 space-y-2 leading-7 text-slate-500">
              <p>{t.pickupText(lead)}</p>
              <p>{t.deliveryText(days[rules.day], start, end, cutDay, cutoff)}</p>
            </div>
            <h3 className="mt-8 text-xs font-bold uppercase tracking-wide text-ink">{t.feeTitle}</h3>
            <ul className="mt-3 divide-y divide-slate-300 bg-mist px-5">
              {zones.map((z) => (
                <li key={z.id} className="flex items-center justify-between gap-3 py-3.5">
                  <span className="text-ink">{zoneDisplayName(z.name)}</span>
                  <span className="font-bold text-ink">{formatMoney(Number(z.fee) || 0)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to={path('/menu')} className="btn btn-dark">
                {t.nav.menu}
              </Link>
              <Link to={path('/checkout')} className="btn btn-accent">
                {t.nav.order}
              </Link>
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-[460px]">
            <div className="absolute inset-0 overflow-hidden">
              <Photo src={pick(3)?.content.photo} alt={pick(3) ? photoAlt(pick(3), lang) : name} />
            </div>
            <p className="absolute bottom-0 left-0 flex items-center gap-2 whitespace-nowrap bg-page px-5 py-3 font-semibold text-ink">
              <Truck size={18} className="text-blue-500" /> {days[rules.day]} {start}–{end}
            </p>
          </div>
        </div>
      </section>

      {BLOG_ENABLED && (
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <SectionTitle title={t.fromBlog} />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {posts.map((p) => (
              <PostCard key={p.slug} post={p} lang={lang} t={t} />
            ))}
          </div>
          <p className="mt-10 text-center">
            <Link to={path('/blog')} className="font-semibold text-blue-500">
              {t.allPosts} →
            </Link>
          </p>
        </section>
      )}

      {/* Kêu gọi đặt món (chỗ ô đăng ký nhận tin của mẫu) */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden bg-ink px-6 py-16 text-center sm:px-12 sm:py-20">
          <img
            src="/site/photos/cta-weekend.webp"
            alt="Lạp xưởng sausages and a plate of fried rice on an outdoor table"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div aria-hidden className="absolute inset-0 bg-ink/55" />
          <h2 className="relative mx-auto max-w-2xl font-serif text-4xl font-bold leading-tight text-white text-balance sm:text-5xl">
            {t.ctaTitle}
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg leading-7 text-white/85 text-balance">{t.ctaText}</p>
          <div className="relative mx-auto mt-9 flex max-w-xl flex-col items-stretch gap-3 bg-page p-2 text-left sm:flex-row sm:items-center sm:justify-between sm:pl-5">
            <span className="px-3 pt-2 text-sm text-slate-500 sm:p-0">{t.ctaNote(cutDay, cutoff)}</span>
            <Link to={path('/checkout')} className="btn btn-accent shrink-0 px-6 py-3.5 text-base">
              {t.nav.order}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Hero({ t }) {
  return (
    <section className="relative">
      {/* Ảnh tràn màn hình, không chữ đè lên; tiêu đề nằm dưới ảnh */}
      <div className="relative h-[46vh] min-h-[280px] w-full overflow-hidden sm:h-[56vh]">
        <img
          src="/site/photos/cta-weekend.webp"
          alt="Lạp xưởng sausages and a plate of fried rice on an outdoor table"
          fetchpriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:gap-14 md:py-16">
        <div>
          <p className="text-sm font-semibold text-blue-500">{t.heroKicker}</p>
          <SplitText
            key={t.heroTitle}
            tag="h1"
            text={t.heroTitle}
            className="mt-3 font-serif text-4xl font-normal leading-[1.08] tracking-tight text-ink text-balance sm:text-5xl lg:text-6xl"
            delay={35}
            duration={0.7}
            splitType="chars"
            from={{ opacity: 0, y: 40 }}
            to={{ opacity: 1, y: 0 }}
            threshold={0.1}
            rootMargin="-100px"
          />
        </div>
        <div className="md:pt-8">
          <p className="max-w-md text-lg leading-8 text-slate-500">{t.heroText}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to={path('/checkout')} className="btn btn-dark">
              {t.nav.order}
            </Link>
            <Link to={path('/menu')} className="btn btn-accent">
              {t.nav.menu}
            </Link>
          </div>
          <p className="mt-8 flex items-center gap-3 text-sm text-slate-500">
            <Leaf size={18} className="text-blue-500" aria-hidden="true" />
            {t.freshBadge}
          </p>
        </div>
      </div>
    </section>
  );
}

export function PostCard({ post, lang, t }) {
  return (
    <article className="flex flex-col overflow-hidden bg-card ring-1 ring-slate-300">
      <Link to={path(`/blog/${post.slug}`)} className="block aspect-[16/9] overflow-hidden">
        <Photo src={post.cover} alt={post.coverAlt || post.title} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {formatPostDate(post.date, lang)}
        </p>
        <Link to={path(`/blog/${post.slug}`)}>
          <h3 className="font-serif text-xl font-bold leading-snug text-ink text-balance">{post.title}</h3>
        </Link>
        <p className="line-clamp-3 text-sm leading-6 text-slate-500">{post.description}</p>
        <Link to={path(`/blog/${post.slug}`)} className="mt-auto pt-2 text-sm font-semibold text-blue-500">
          {t.readMore} →
        </Link>
      </div>
    </article>
  );
}
