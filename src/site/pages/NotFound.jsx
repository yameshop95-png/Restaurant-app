import { path } from '../lib';
import { Link, useSite } from '../ui';

export default function NotFound() {
  const { t } = useSite();
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-serif text-4xl font-bold text-ink">{t.notFound}</h1>
      <p className="mt-2 text-slate-600">{t.notFoundText}</p>
      <Link to={path('/menu')} className="btn btn-accent mt-8">
        {t.seeMenu}
      </Link>
    </div>
  );
}
