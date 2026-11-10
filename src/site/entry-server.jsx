import { renderToString } from 'react-dom/server';
import SiteApp from './SiteApp.jsx';
import { POSTS } from './data/posts';
import { BLOG_ENABLED, dishList, pageSlugs, parseRoute, path, SITE_URL } from './lib';
import { headHtml, pageMeta } from './seo';

// Dùng lúc build (scripts/prerender.mjs): dựng sẵn HTML từng trang
export const SITE = SITE_URL;

export function routes(data) {
  const slugs = pageSlugs(data?.menu ?? null);
  return [path(), path('/menu'), ...slugs.map((s) => path(`/menu/${s}`)), ...(BLOG_ENABLED ? [path('/blog'), ...POSTS.map((p) => path(`/blog/${p.slug}`))] : []), path('/checkout')];
}

export function render(url, data) {
  const meta = pageMeta(parseRoute(url), data, dishList(data?.menu ?? null));
  return {
    html: renderToString(<SiteApp initialPath={url} initialData={data} />),
    head: headHtml(meta),
    indexable: !meta.noindex,
  };
}
