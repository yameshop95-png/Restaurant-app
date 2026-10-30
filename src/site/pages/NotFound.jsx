import { path } from '../lib';
import { Link, useSite } from '../ui';

export default function NotFound() {
  const { t } = useSite();
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold text-slate-900">{t.notFound}</h1>
      <p className="mt-2 text-slate-600">{t.notFoundText}</p>
      <Link to={path('/menu')} className="mt-6 inline-block rounded-2xl bg-blue-500 px-6 py-3 font-bold text-white">
        {t.seeMenu}
      </Link>
    </div>
  );
}
