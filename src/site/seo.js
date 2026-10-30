import { CATEGORIES } from './data/dishes';
import { dishText, findPost, path, SITE_URL, SOCIAL, sortedPosts } from './lib';
import { SITE_TEXT } from './text';

// Thẻ <head> cho từng trang (tiếng Anh, để Google đọc): tiêu đề, mô tả, link chuẩn, ảnh chia sẻ, dữ liệu có cấu trúc
export function pageMeta(route, data, dishes) {
  const t = SITE_TEXT.en;
  const shop = data?.shop ?? {};
  const name = shop.shopName || t.defaultName;
  const url = (p) => `${SITE_URL}${p}`;
  const logo = url('/pwa-512x512.png');
  const business = {
    '@type': 'Restaurant',
    name,
    url: url(path()),
    image: logo,
    servesCuisine: 'Vietnamese',
    priceRange: '$',
    areaServed: ['Albury', 'Wodonga', 'Lavington', 'Thurgoona'],
    hasMenu: url(path('/menu')),
    sameAs: Object.values(SOCIAL),
    ...(shop.shopPhone && { telephone: shop.shopPhone }),
    ...(shop.shopAddress && { address: { '@type': 'PostalAddress', streetAddress: shop.shopAddress, addressCountry: 'AU' } }),
  };

  switch (route.name) {
    case 'menu':
      return {
        title: `Menu – Bánh Cuốn, Giò Chả & More | ${name}`,
        description: `Order ${dishes.slice(0, 6).map((d) => dishText(d, 'en').name.split(' – ')[0]).join(', ')} and more for pickup or Saturday delivery in Albury–Wodonga.`,
        path: path('/menu'),
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Menu',
          name: `${name} menu`,
          hasMenuSection: CATEGORIES.map((c) => ({
            '@type': 'MenuSection',
            name: c.en,
            hasMenuItem: dishes
              .filter((d) => d.content?.category === c.id)
              .map((d) => ({
                '@type': 'MenuItem',
                name: dishText(d, 'en').name,
                description: dishText(d, 'en').short,
                ...(d.price != null && { offers: { '@type': 'Offer', price: d.price.toFixed(2), priceCurrency: 'AUD' } }),
              })),
          })),
        },
      };
    case 'dish': {
      const dish = dishes.find((d) => d.slug === route.slug);
      if (!dish) return notFound(name);
      const txt = dishText(dish, 'en');
      return {
        title: `${txt.name} | ${name}, Albury–Wodonga`,
        description: `${txt.short || txt.description}${dish.price != null ? ` A$${dish.price.toFixed(2)}.` : ''} Pre-order for pickup or Saturday delivery.`.trim(),
        path: path(`/menu/${dish.slug}`),
        image: dish.content?.photo ? url(dish.content.photo) : logo,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'MenuItem',
          name: txt.name,
          description: txt.description || txt.short,
          ...(dish.content?.photo && { image: url(dish.content.photo) }),
          ...(dish.price != null && { offers: { '@type': 'Offer', price: dish.price.toFixed(2), priceCurrency: 'AUD' } }),
        },
      };
    }
    case 'blog':
      return {
        title: `Blog – Vietnamese Food Guides | ${name}`,
        description: t.blogIntro,
        path: path('/blog'),
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: `${name} blog`,
          blogPost: sortedPosts().map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: url(path(`/blog/${p.slug}`)), datePublished: p.date })),
        },
      };
    case 'post': {
      const post = findPost(route.slug);
      if (!post) return notFound(name);
      return {
        title: `${post.title} | ${name}`,
        description: post.description,
        path: path(`/blog/${post.slug}`),
        type: 'article',
        image: post.cover ? url(post.cover) : logo,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          dateModified: post.date,
          image: post.cover ? url(post.cover) : logo,
          author: { '@type': 'Organization', name },
          publisher: { '@type': 'Organization', name, logo: { '@type': 'ImageObject', url: logo } },
          mainEntityOfPage: url(path(`/blog/${post.slug}`)),
        },
      };
    }
    case 'checkout':
      return { title: `Order online | ${name}`, description: t.orderCtaText, path: path('/checkout'), noindex: true };
    case 'notfound':
      return notFound(name);
    default:
      return {
        title: `${name} – Bánh Cuốn & Giò Chả in Albury–Wodonga`,
        description: t.heroText,
        path: path(),
        jsonLd: { '@context': 'https://schema.org', ...business },
      };
  }
}

const notFound = (name) => ({ title: `Page not found | ${name}`, description: '', path: path(), noindex: true });

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function headHtml(meta) {
  const full = `${SITE_URL}${meta.path}`;
  const image = meta.image ?? `${SITE_URL}/pwa-512x512.png`;
  return [
    `<title>${esc(meta.title)}</title>`,
    meta.description && `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(full)}" />`,
    meta.noindex && `<meta name="robots" content="noindex" />`,
    `<meta property="og:type" content="${meta.type ?? 'website'}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    meta.description && `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(full)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    meta.jsonLd && `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>`,
  ]
    .filter(Boolean)
    .join('\n    ');
}
