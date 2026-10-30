import { ArrowLeft, ArrowRight } from 'lucide-react';
import Markdown from '../Markdown';
import { findPost, formatPostDate, path } from '../lib';
import { DishCard, Link, Photo, useSite } from '../ui';
import NotFound from './NotFound';

export default function Post({ slug }) {
  const { t, lang, dishes, navigate } = useSite();
  const post = findPost(slug);
  if (!post) return <NotFound />;
  const related = (post.dishes ?? []).map((s) => dishes.find((d) => d.slug === s)).filter(Boolean);

  return (
    <div className="px-4 pt-6 sm:px-6">
      <article className="mx-auto max-w-3xl" lang="en">
        <Link to={path('/blog')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> {t.blogTitle}
        </Link>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">{formatPostDate(post.date, lang)}</p>
        <h1 className="mt-2 font-serif text-4xl font-bold leading-tight text-ink text-balance sm:text-5xl">{post.title}</h1>
        <p className="mt-4 text-xl leading-relaxed text-slate-600">{post.description}</p>
        {post.cover && (
          <div className="mt-8 aspect-[16/9] overflow-hidden rounded-[2rem] border border-slate-200">
            <Photo src={post.cover} alt={post.title} eager />
          </div>
        )}
        <div className="mt-8">
          <Markdown source={post.body} onNavigate={navigate} />
        </div>
      </article>

      {related.length > 0 && (
        <section className="mx-auto max-w-6xl pt-14">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">{t.inThisPost}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((d) => (
              <DishCard key={d.slug} dish={d} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto mt-14 max-w-3xl rounded-3xl border border-slate-200 bg-card p-6 text-center">
        <h2 className="text-2xl font-bold text-slate-900">{t.orderCta}</h2>
        <p className="mt-2 text-slate-600">{t.orderCtaText}</p>
        <Link to={path('/checkout')} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-6 py-3.5 font-bold text-white active:bg-blue-600">
          {t.nav.order} <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
