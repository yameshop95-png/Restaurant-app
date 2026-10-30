import { ArrowLeft } from 'lucide-react';
import { POSTS } from '../data/posts';
import { BLOG_ENABLED, dishText, path } from '../lib';
import { DishCard, Link, Photo, Price, QtyControl, useSite } from '../ui';
import { PostCard } from './Home';
import NotFound from './NotFound';

export default function Dish({ slug }) {
  const { t, lang, dishes } = useSite();
  const dish = dishes.find((d) => d.slug === slug);
  if (!dish) return <NotFound />;
  const txt = dishText(dish, lang);
  const posts = !BLOG_ENABLED ? [] : POSTS.filter((p) => p.dishes?.includes(dish.slug)).slice(0, 3);
  const more = dishes.filter((d) => d.slug !== dish.slug && d.content?.category === dish.content?.category).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      <Link to={path('/menu')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> {t.backMenu}
      </Link>
      <article className="mt-4 grid gap-8 md:grid-cols-2 md:items-start">
        <div className="aspect-[4/3] overflow-hidden rounded-[2rem] border border-slate-200">
          <Photo src={dish.content?.photo} alt={txt.name} eager />
        </div>
        <div className="space-y-5">
          <h1 className="text-3xl font-extrabold leading-tight text-slate-900 text-balance sm:text-4xl">{txt.name}</h1>
          {lang === 'en' && dish.content && <p className="text-slate-500">{dish.content.vi.name}</p>}
          <div className="flex flex-wrap items-center gap-4">
            <Price dish={dish} className="text-3xl" />
            <QtyControl dish={dish} size="lg" />
          </div>
          {txt.portion && (
            <p className="inline-block rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-800">
              <b>{t.portion}:</b> {txt.portion}
            </p>
          )}
          {txt.description && <p className="text-lg leading-relaxed text-slate-700">{txt.description}</p>}
        </div>
      </article>

      {posts.length > 0 && (
        <section className="pt-14">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">{t.related}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {posts.map((p) => (
              <PostCard key={p.slug} post={p} lang={lang} t={t} />
            ))}
          </div>
        </section>
      )}
      {more.length > 0 && (
        <section className="pt-14">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">{t.moreDishes}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((d) => (
              <DishCard key={d.slug} dish={d} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
