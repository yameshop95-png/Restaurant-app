import { sortedPosts } from '../lib';
import { useSite } from '../ui';
import { PostCard } from './Home';

export default function Blog() {
  const { t, lang } = useSite();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <h1 className="text-4xl font-extrabold text-slate-900">{t.blogTitle}</h1>
      <p className="mt-2 max-w-2xl text-lg text-slate-600">{t.blogIntro}</p>
      {t.englishOnly && <p className="mt-1 text-sm text-slate-500">{t.englishOnly}</p>}
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedPosts().map((p) => (
          <PostCard key={p.slug} post={p} lang={lang} t={t} />
        ))}
      </div>
    </div>
  );
}
