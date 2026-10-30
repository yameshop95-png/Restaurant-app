import { Banknote, CheckCircle2, ShoppingBag, Truck } from 'lucide-react';
import { formatMoney } from '../../lib/stats';
import { DEFAULT_ZONES } from '../../lib/shippingZones';
import { TEXT as ORDER_TEXT } from '../../order/i18n';
import { BLOG_ENABLED, dishText, formatPostDate, orderingRules, path, sortedPosts } from '../lib';
import { Deco, DishCard, Link, Photo, SectionTitle, useSite } from '../ui';

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
  const name = shop.shopName || t.defaultName;
  const posts = sortedPosts().slice(0, 3);
  const photoOf = (d) => d && { src: d.content.photo, alt: dishText(d, lang).name };

  return (
    <>
      <Hero t={t} tall={photoOf(pick(0))} round={photoOf(pick(1))} name={name} logo={shop.logo || '/logo-round.svg'} />

      {/* Món đặc biệt + giới thiệu quán: chung một nền xám như mẫu */}
      <section className="relative overflow-hidden bg-mist">
        <Deco name="sprig" className="-left-4 top-2 w-20 opacity-30 sm:left-[14%] sm:top-10 sm:w-40 sm:opacity-50" />
        <Deco name="basil" className="-right-6 top-2 w-24 opacity-30 sm:right-[16%] sm:top-8 sm:w-44 sm:opacity-40" />
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
              <Deco name="branch" className="-right-6 -top-12 w-44 opacity-40 sm:w-56" />
              <div className="relative h-full w-full overflow-hidden rounded-full border-[10px] border-white shadow-[0_40px_80px_-30px_rgba(16,26,36,0.55)]">
                <Photo src={pick(2)?.content.photo} alt={pick(2) ? dishText(pick(2), lang).name : name} />
              </div>
            </div>
            <div>
              <SectionTitle align="left" title={t.welcomeTitle(name)} text={t.welcomeText} />
              <ul className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {t.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-slate-500">
                    <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-blue-500" /> {p}
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
          </div>
        </div>
      </section>

      {/* Đến lấy & giao hàng */}
      <section id="delivery" className="relative scroll-mt-32 overflow-hidden">
        <Deco name="garlic" className="-left-16 -top-6 w-32 opacity-25 sm:left-0 sm:top-8 sm:w-56 sm:opacity-40" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
          <div>
            <SectionTitle align="left" title={t.deliveryTitle} />
            <div className="mt-6 space-y-2 leading-7 text-slate-500">
              <p>{t.pickupText(rules.lead)}</p>
              <p>{t.deliveryText(days[rules.day], rules.start, rules.end, cutDay, rules.cutoff)}</p>
            </div>
            <h3 className="mt-8 text-xs font-bold uppercase tracking-wide text-ink">{t.feeTitle}</h3>
            <ul className="mt-3 divide-y divide-slate-200 rounded-[20px] bg-mist px-5">
              {zones.map((z) => (
                <li key={z.id} className="flex items-center justify-between gap-3 py-3.5">
                  <span className="text-ink">{z.name}</span>
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
            <div className="absolute inset-0 rounded-full bg-blue-500" />
            <div className="absolute inset-[9%] overflow-hidden rounded-full border-[10px] border-white shadow-[0_30px_60px_-24px_rgba(16,26,36,0.6)]">
              <Photo src={pick(3)?.content.photo} alt={pick(3) ? dishText(pick(3), lang).name : name} />
            </div>
            <p className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white px-5 py-3 font-semibold text-ink shadow-[0_16px_30px_-12px_rgba(16,26,36,0.4)]">
              <Truck size={18} className="text-blue-500" /> {days[rules.day]} {rules.start}–{rules.end}
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
        <div className="relative overflow-hidden rounded-[28px] bg-ink px-6 py-16 text-center sm:px-12 sm:py-20">
          <img
            src="/site/photos/cta-weekend.webp"
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div aria-hidden className="absolute inset-0 bg-ink/55" />
          <h2 className="relative mx-auto max-w-2xl font-serif text-4xl font-bold leading-tight text-white text-balance sm:text-5xl">
            {t.ctaTitle}
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg leading-7 text-white/85 text-balance">{t.ctaText}</p>
          <div className="relative mx-auto mt-9 flex max-w-xl flex-col items-stretch gap-3 rounded-[14px] bg-white p-2 text-left sm:flex-row sm:items-center sm:justify-between sm:pl-5">
            <span className="px-3 pt-2 text-sm text-slate-500 sm:p-0">{t.ctaNote(cutDay, rules.cutoff)}</span>
            <Link to={path('/checkout')} className="btn btn-accent shrink-0 px-6 py-3.5 text-base">
              {t.nav.order}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Hero({ t, tall, round, name, logo }) {
  const icons = [ShoppingBag, Truck, Banknote];
  return (
    <section className="relative overflow-hidden">
      {/* Vòng tròn mảnh góc trên bên trái như mẫu */}
      <div aria-hidden className="deco -left-80 -top-96 h-[760px] w-[760px] rounded-full border border-slate-200" />
      <div
        aria-hidden
        className="deco -left-64 -top-[26rem] h-[760px] w-[760px] rounded-full border border-slate-200"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-16 pt-8 sm:px-6 md:grid-cols-[1fr_1.05fr] md:pb-24 md:pt-12">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-500">{t.heroKicker}</p>
          <h1 className="mt-4 font-serif text-5xl font-bold leading-[1.04] text-ink text-balance sm:text-6xl lg:text-[68px]">
            {t.heroTitle}
          </h1>
          <p className="mt-6 max-w-md leading-7 text-slate-500">{t.heroText}</p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link to={path('/menu')} className="btn btn-dark">
              {t.nav.menu}
            </Link>
            <Link to={path('/checkout')} className="btn btn-accent">
              {t.nav.order}
            </Link>
          </div>
          <div className="mt-12 flex items-center gap-4">
            <ul className="flex gap-3">
              {icons.map((Icon, i) => (
                <li
                  key={t.steps[i][0]}
                  title={t.steps[i][0]}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-ink ring-1 ring-ink"
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="sr-only">{t.steps[i][0]}</span>
                </li>
              ))}
            </ul>
            <span className="h-px w-16 bg-slate-300 sm:w-28" />
            <span className="text-sm text-slate-500">{t.steps[2][0]}</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[540px]">
          <Deco name="basil" className="-right-4 -top-12 w-44 opacity-40 sm:-right-10 sm:w-64" />
          <Deco name="branch" className="-bottom-12 right-[30%] w-48 opacity-35 sm:w-60" />
          <div className="relative ml-auto aspect-[516/712] w-[76%] overflow-hidden rounded-[72px_40px_72px_24px] shadow-[0_40px_80px_-40px_rgba(16,26,36,0.7)]">
            {tall ? (
              <Photo src={tall.src} alt={tall.alt} eager />
            ) : (
              <div className="relative flex h-full w-full flex-col items-center justify-start gap-5 bg-ink px-6 pl-[22%] pt-[16%] text-center">
                <Deco name="pan" className="-right-24 -top-10 w-80 opacity-15 invert" />
                <img src={logo} alt="" className="relative w-3/5 rounded-full" />
                <p className="relative hidden font-serif text-2xl text-white sm:block sm:text-3xl">{name}</p>
              </div>
            )}
          </div>
          <div className="absolute bottom-[8%] left-0 aspect-square w-[50%] overflow-hidden rounded-full border-[10px] border-white shadow-[0_30px_60px_-20px_rgba(16,26,36,0.55)]">
            <Photo src={round?.src} alt={round?.alt ?? name} eager />
          </div>
        </div>
      </div>
    </section>
  );
}

export function PostCard({ post, lang, t }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-[28px] bg-card shadow-[0_24px_50px_-30px_rgba(16,26,36,0.35)] ring-1 ring-slate-200/70">
      <Link to={path(`/blog/${post.slug}`)} className="block aspect-[16/9] overflow-hidden">
        <Photo src={post.cover} alt={post.title} />
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
