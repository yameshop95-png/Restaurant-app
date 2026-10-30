import { CATEGORIES } from '../data/dishes';
import { Deco, DishCard, SectionTitle, useSite } from '../ui';

export default function Menu() {
  const { t, lang, dishes } = useSite();
  const groups = [
    ...CATEGORIES.map((c) => ({
      id: c.id,
      title: c[lang] ?? c.en,
      items: dishes.filter((d) => d.content?.category === c.id),
    })),
    {
      id: 'other',
      title: lang === 'vi' ? 'Món khác' : 'More',
      items: dishes.filter((d) => !CATEGORIES.some((c) => c.id === d.content?.category)),
    },
  ].filter((g) => g.items.length);

  return (
    <>
      <header className="relative overflow-hidden bg-mist">
        <Deco name="sprig" className="left-[6%] top-6 w-24 opacity-50 sm:w-36" />
        <Deco name="basil" className="-right-6 bottom-0 w-32 opacity-40 sm:right-[10%] sm:w-44" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionTitle as="h1" title={t.menuTitle} text={t.menuIntro} />
          {groups.length > 1 && (
            <nav className="mt-8 flex flex-wrap justify-center gap-2">
              {groups.map((g) => (
                <a
                  key={g.id}
                  href={`#${g.id}`}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm ring-1 ring-slate-200 hover:text-blue-500"
                >
                  {g.title}
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {groups.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-24 pt-16">
            <h2 className="mb-8 font-serif text-3xl font-bold text-ink">{g.title}</h2>
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((d) => (
                <DishCard key={d.slug} dish={d} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
