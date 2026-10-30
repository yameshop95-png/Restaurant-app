import { ArrowRight, Banknote, ShoppingBag, Truck } from 'lucide-react';
import { formatMoney } from '../../lib/stats';
import { DEFAULT_ZONES } from '../../lib/shippingZones';
import { BLOG_ENABLED, dishText, formatPostDate, path, sortedPosts } from '../lib';
import { DishCard, Link, Photo, useSite } from '../ui';

export default function Home() {
  const { t, lang, dishes, shop } = useSite();
  const featured = dishes.filter((d) => d.content?.featured);
  const popular = (featured.length ? featured : dishes).slice(0, 4);
  const hero = dishes.find((d) => d.content?.featured && d.content.photo) ?? dishes.find((d) => d.content?.photo);
  const zones = shop.shippingZones ?? DEFAULT_ZONES;
  const posts = sortedPosts().slice(0, 3);
  const icons = [ShoppingBag, Truck, Banknote];

  return (
    <>
      {/* Mở đầu: tên quán, câu giới thiệu, ảnh món */}
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-6 pt-8 sm:px-6 md:grid-cols-[1.05fr_1fr] md:pt-14">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-500">
            {shop.shopName || t.defaultName}
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.08] text-slate-900 text-balance sm:text-5xl">
            {t.heroTitle}
          </h1>
          <p className="max-w-xl text-lg text-slate-600">{t.heroText}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={path('/checkout')}
              className="flex items-center gap-2 rounded-2xl bg-blue-500 px-6 py-3.5 font-bold text-white active:bg-blue-600"
            >
              {t.nav.order} <ArrowRight size={18} />
            </Link>
            <Link
              to={path('/menu')}
              className="rounded-2xl border border-slate-300 px-6 py-3.5 font-bold text-slate-900 hover:bg-slate-50"
            >
              {t.seeMenu}
            </Link>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-slate-200">
          {hero ? (
            <Photo src={hero.content.photo} alt={dishText(hero, lang).name} eager />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#4a2a1a,#1e1e24_70%)]">
              <img src={shop.logo || '/logo-round.svg'} alt="" className="w-1/2 max-w-64 rounded-full" />
            </div>
          )}
        </div>
      </section>

      {/* Cách đặt */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h2 className="sr-only">{t.how}</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {t.steps.map(([title, text], i) => {
            const Icon = icons[i];
            return (
              <li key={title} className="flex gap-4 rounded-3xl border border-slate-200 bg-card p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                  <Icon size={22} />
                </span>
                <span>
                  <span className="block font-bold text-slate-900">{title}</span>
                  <span className="mt-1 block text-sm text-slate-500">{text}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Món nổi bật */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{t.popular}</h2>
          <Link to={path('/menu')} className="shrink-0 text-sm font-semibold text-blue-500">
            {t.allDishes} →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((d) => (
            <DishCard key={d.slug} dish={d} />
          ))}
        </div>
      </section>

      {/* Bài blog mới */}
      {BLOG_ENABLED && (
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{t.fromBlog}</h2>
            <Link to={path('/blog')} className="shrink-0 text-sm font-semibold text-blue-500">
              {t.allPosts} →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {posts.map((p) => (
              <PostCard key={p.slug} post={p} lang={lang} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* Khu giao hàng */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-card p-6">
          <h2 className="text-xl font-bold text-slate-900">{t.areas}</h2>
          <p className="mt-1 text-sm text-slate-500">{t.areasNote}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {zones.map((z) => (
              <li key={z.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-semibold text-slate-900">{z.name}</span>
                <span className="font-bold text-gold">{formatMoney(Number(z.fee) || 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

export function PostCard({ post, lang, t }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-card">
      <Link to={path(`/blog/${post.slug}`)} className="block aspect-[16/9] overflow-hidden">
        <Photo src={post.cover} alt={post.title} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {formatPostDate(post.date, lang)}
        </p>
        <Link to={path(`/blog/${post.slug}`)}>
          <h3 className="text-lg font-bold leading-snug text-slate-900 text-balance">{post.title}</h3>
        </Link>
        <p className="line-clamp-3 text-sm text-slate-500">{post.description}</p>
        <Link to={path(`/blog/${post.slug}`)} className="mt-auto pt-2 text-sm font-semibold text-blue-500">
          {t.readMore} →
        </Link>
      </div>
    </article>
  );
}
