import { formatMoney } from '../lib/stats';
import { normalizeText } from '../lib/text';
import { CATEGORIES, DISHES } from './data/dishes';
import { POSTS } from './data/posts';
import { formatPortion } from './format';

// Website nằm dưới /order (cùng tên miền với app nhận order). Có tên miền riêng thì đổi SITE_URL.
export const BASE = '/order';
export const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://restaurant-app-seven-lime.vercel.app';
export const path = (p = '') => `${BASE}${p}`;
// Blog bật: trang /order/blog và từng bài được dựng sẵn, có trong sitemap.
export const BLOG_ENABLED = true;
// Trang mạng xã hội của quán (chân trang + dữ liệu cho Google)
export const SOCIAL = { facebook: 'https://www.facebook.com/share/19sRx1kTJc/' };

const key = (s) =>
  normalizeText(s ?? '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const slugify = (s) => key(s).replace(/ /g, '-');

// Ghép món trong thực đơn với nội dung website theo id. Không có id (món mới) thì theo slug hoặc aliases.
export function findDishContent(menuItem) {
  if (!menuItem) return null;
  if (menuItem.id) {
    const byId = DISHES.find((d) => d.id && d.id === menuItem.id);
    if (byId) return byId;
  }
  const nameKey = key(menuItem.name);
  const slug = slugify(menuItem.name || '');
  return (
    DISHES.find(
      (d) => d.slug === slug || (d.aliases ?? []).some((a) => key(a) === nameKey || slugify(a) === slug),
    ) ?? null
  );
}

const categoryOrder = (c) => {
  const i = CATEGORIES.findIndex((x) => x.id === c);
  return i < 0 ? CATEGORIES.length : i;
};

const dishRow = (menuItem, index, content) => ({
  id: menuItem?.id ?? null,
  name: menuItem?.name ?? content?.vi?.name ?? content?.en?.name ?? '',
  price: menuItem ? Number(menuItem.price) : null,
  available: menuItem ? menuItem.available !== false : true,
  portion: String(menuItem?.portion ?? '').trim(),
  content,
  slug: content?.slug ?? (menuItem ? slugify(menuItem.name) : ''),
  index,
});

// Ghép thực đơn trong app (giá, còn / hết) với nội dung website (ảnh, mô tả, định lượng)
export function dishList(menu) {
  if (!menu) return DISHES.filter((c) => c.id).map((c, i) => dishRow(null, i, c));
  return menu
    .map((m, i) => dishRow(m, i, findDishContent(m)))
    .sort((a, b) => categoryOrder(a.content?.category) - categoryOrder(b.content?.category) || a.index - b.index);
}

// Slug các trang món: khi có thực đơn thì chỉ món đang bán (kể cả bánh chưng khi đã có dòng).
export function pageSlugs(menu) {
  const slugs = menu ? dishList(menu).map((d) => d.slug) : DISHES.filter((d) => d.id).map((d) => d.slug);
  return [...new Set(slugs.filter(Boolean))];
}

// Định lượng: lấy trong app trước, không có thì lấy nội dung website. Thêm dấu cách trước đơn vị.
export const dishText = (dish, lang) => {
  const c = dish.content?.[lang] ?? dish.content?.en;
  return {
    name: c?.name ?? dish.name,
    short: c?.short ?? '',
    description: c?.description ?? '',
    portion: formatPortion(dish.portion || c?.portion || '', lang),
    alt: dish.content?.en?.alt || '',
  };
};

export function photoAlt(dish, lang) {
  const name = dishText(dish, lang).name.split(' – ')[0];
  if (!dish?.content?.photo) return name;
  if (lang === 'en' && dish.content.en?.alt) return dish.content.en.alt;
  return name;
}

// Tên trên trang đặt món, không phụ thuộc hoa thường của tên trong máy chủ.
export function checkoutName(menuItem, lang = 'en') {
  const content = findDishContent(menuItem);
  const text = dishText({ ...menuItem, content, portion: menuItem?.portion ?? '' }, lang);
  let name = (text.name || menuItem?.name || '').split(' – ')[0];
  // Nhiều dòng thực đơn dùng chung một trang nội dung (vd Bánh chưng và Bánh tét): giữ tên riêng của từng dòng để khách không nhầm
  if (name.includes(' / ') && menuItem?.name && !menuItem.name.includes('/')) name = menuItem.name;
  return [name, text.portion].filter(Boolean).join(' · ');
}

export function checkoutLine(menuItem, lang = 'en') {
  const name = checkoutName(menuItem, lang);
  const price = menuItem?.price != null && menuItem.price !== '' ? formatMoney(Number(menuItem.price)) : '';
  return [name, price].filter(Boolean).join(' · ');
}

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
