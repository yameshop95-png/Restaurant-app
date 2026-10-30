// Sau `vite build`: dựng sẵn HTML từng trang website (/order/...) để Google đọc được nội dung,
// kèm sitemap.xml và robots.txt. Thực đơn / thông tin quán lấy từ máy chủ lúc build (lỗi mạng thì dựng không có giá).
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIST = path.resolve('dist');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hgkqcswzggsbpusrhpue.supabase.co';
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_qm7OXVxaPuwAhAB2zjOXow_7zBFNnON';

async function loadData() {
  if (process.env.SITE_DATA_FILE) return JSON.parse(await fs.readFile(process.env.SITE_DATA_FILE, 'utf8'));
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_shop`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[prerender] Không tải được thực đơn (${err.message}); dựng trang không có giá.`);
    return null;
  }
}

const { render, routes, SITE } = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href);
const template = await fs.readFile(path.join(DIST, 'order.html'), 'utf8');
const data = await loadData();
const dataScript = `<script>window.__SITE_DATA__=${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
const indexable = [];

for (const url of routes(data)) {
  const { html, head, indexable: idx } = render(url, data);
  const page = template
    .replace('<!--site-head-->', head)
    .replace('<div id="order-root"><!--site-html-->', `<div id="order-root" data-path="${url}">${html}`)
    .replace('<!--site-data-->', dataScript);
  const file = path.join(DIST, url, 'index.html');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, page);
  if (idx) indexable.push(url);
}
// /order giờ là order/index.html
await fs.rm(path.join(DIST, 'order.html'));

const today = new Date().toISOString().slice(0, 10);
await fs.writeFile(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable
    .map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`
);
// App nhận order (/) không cho Google lập chỉ mục; chỉ website /order
await fs.writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /order\nDisallow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`[prerender] ${indexable.length} trang + sitemap.xml${data ? '' : ' (không có giá)'}`);
