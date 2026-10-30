import { CATEGORIES, DISHES } from './data/dishes';
import { POSTS } from './data/posts';
import { normalizeText } from '../lib/text';

// Website nằm dưới /order (cùng tên miền với app nhận order). Có tên miền riêng thì đổi SITE_URL.
export const BASE = '/order';
export const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://restaurant-app-seven-lime.vercel.app';
export const path = (p = '') => `${BASE}${p}`;
// Blog tạm ẩn (chưa viết xong bài): không hiện trên menu, trang chủ, trang món, sitemap. Viết xong thì đổi thành true.
export const BLOG_ENABLED = false;

const key = (s) =>
  normalizeText(s ?? '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const slugify = (s) => key(s).replace(/ /g, '-');

// Ghép thực đơn trong app (giá, còn / hết) với nội dung website (ảnh, mô tả, định lượng)
export function dishList(menu) {
  const content = new Map(DISHES.map((d) => [key(d.match), d]));
  const order = (c) => {
    const i = CATEGORIES.findIndex((x) => x.id === c);
    return i < 0 ? CATEGORIES.length : i;
  };
  if (!menu) {
    return DISHES.map((c, i) => ({
      id: null,
      name: c.vi.name,
      price: null,
      available: true,
      content: c,
      slug: c.slug,
      index: i,
    }));
  }
  return menu
    .map((m, i) => {
      const c = content.get(key(m.name)) ?? null;
      return {
        id: m.id,
        name: m.name,
        price: Number(m.price),
        available: m.available !== false,
        content: c,
        slug: c?.slug ?? slugify(m.name),
        index: i,
      };
    })
    .sort((a, b) => order(a.content?.category) - order(b.content?.category) || a.index - b.index);
}

export const dishText = (dish, lang) => {
  const c = dish.content?.[lang] ?? dish.content?.en;
  return {
    name: c?.name ?? dish.name,
    short: c?.short ?? '',
    description: c?.description ?? '',
    portion: c?.portion ?? '',
  };
};

export const findPost = (slug) => POSTS.find((p) => p.slug === slug) ?? null;
export const sortedPosts = () => [...POSTS].sort((a, b) => b.date.localeCompare(a.date));

// Đường dẫn → trang. Trên máy dev trang có thể là /order.html
export function parseRoute(pathname) {
  let p = (pathname || '/')
    .replace(/\/index\.html$/, '')
    .replace(/\.html$/, '')
    .replace(/\/+$/, '');
  if (!p.startsWith(BASE)) return { name: 'home' };
  p = p.slice(BASE.length);
  const parts = p.split('/').filter(Boolean);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'menu') return parts[1] ? { name: 'dish', slug: parts[1] } : { name: 'menu' };
  if (parts[0] === 'blog' && BLOG_ENABLED) return parts[1] ? { name: 'post', slug: parts[1] } : { name: 'blog' };
  if (parts[0] === 'checkout') return { name: 'checkout' };
  return { name: 'notfound' };
}

export const formatPostDate = (iso, lang) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

// Quy định nhận đơn website (chủ quán chỉnh trong app: Cài đặt → Đặt món online)
export function orderingRules(shop) {
  const web = shop?.webOrdering ?? {};
  const num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    lead: num(web.leadMinutes, 30),
    day: num(web.deliveryDay, 6),
    start: web.deliveryStart || '08:00',
    end: web.deliveryEnd || '12:00',
    cutoff: web.deliveryCutoff || '20:00',
  };
}
