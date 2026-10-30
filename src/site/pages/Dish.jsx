import { ArrowLeft } from 'lucide-react';
import { POSTS } from '../data/posts';
import { BLOG_ENABLED, dishText, path } from '../lib';
import { Deco, DishCard, Link, Photo, Price, QtyControl, useSite } from '../ui';
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
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <Link
        to={path('/menu')}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> {t.backMenu}
      </Link>
      <article className="mt-6 grid gap-10 md:grid-cols-2 md:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[480px]">
          <Deco name="basil" className="-right-6 -top-8 w-40 opacity-40" />
          <div className="relative h-full w-full overflow-hidden rounded-full border-[10px] border-mist shadow-[0_40px_80px_-30px_rgba(16,26,36,0.55)]">
            <Photo src={dish.content?.photo} alt={txt.name} eager />
          </div>
        </div>
        <div className="space-y-5">
          <h1 className="font-serif text-4xl font-bold leading-tight text-ink text-balance sm:text-5xl">{txt.name}</h1>
          {lang === 'en' && dish.content && <p className="text-slate-500">{dish.content.vi.name}</p>}
          <div className="flex flex-wrap items-center gap-4">
            <Price dish={dish} className="text-3xl" />
            <QtyControl dish={dish} size="lg" />
          </div>
          {txt.portion && (
            <p className="inline-block rounded-2xl bg-mist px-4 py-2 text-sm text-ink">
              <b>{t.portion}:</b> {txt.portion}
            </p>
          )}
          {txt.description && <p className="text-lg leading-8 text-slate-500">{txt.description}</p>}
        </div>
      </article>

      {posts.length > 0 && (
        <section className="pt-14">
          <h2 className="mb-6 font-serif text-3xl font-bold text-ink">{t.related}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {posts.map((p) => (
              <PostCard key={p.slug} post={p} lang={lang} t={t} />
            ))}
          </div>
        </section>
      )}
      {more.length > 0 && (
        <section className="pt-14">
          <h2 className="mb-8 font-serif text-3xl font-bold text-ink">{t.moreDishes}</h2>
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((d) => (
              <DishCard key={d.slug} dish={d} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
