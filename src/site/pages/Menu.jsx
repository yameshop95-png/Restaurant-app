import { CATEGORIES } from '../data/dishes';
import { DishCard, useSite } from '../ui';

export default function Menu() {
  const { t, lang, dishes } = useSite();
  const groups = [
    ...CATEGORIES.map((c) => ({ id: c.id, title: c[lang] ?? c.en, items: dishes.filter((d) => d.content?.category === c.id) })),
    { id: 'other', title: lang === 'vi' ? 'Món khác' : 'More', items: dishes.filter((d) => !CATEGORIES.some((c) => c.id === d.content?.category)) },
  ].filter((g) => g.items.length);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <h1 className="text-4xl font-extrabold text-slate-900">{t.menuTitle}</h1>
      <p className="mt-2 max-w-2xl text-lg text-slate-600">{t.menuIntro}</p>
      {groups.length > 1 && (
        <nav className="mt-5 flex flex-wrap gap-2">
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800">
              {g.title}
            </a>
          ))}
        </nav>
      )}
      {groups.map((g) => (
        <section key={g.id} id={g.id} className="scroll-mt-20 pt-10">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">{g.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((d) => (
              <DishCard key={d.slug} dish={d} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
