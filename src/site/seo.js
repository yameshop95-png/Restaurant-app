import { CATEGORIES } from './data/dishes';
import { formatPhoneTel } from './format';
import { dishText, findPost, path, SITE_URL, SOCIAL, sortedPosts } from './lib';
import { SITE_TEXT } from './text';

// Thẻ <head> cho từng trang (tiếng Anh, để Google đọc): tiêu đề, mô tả, link chuẩn, ảnh chia sẻ, dữ liệu có cấu trúc
export function pageMeta(route, data, dishes) {
  const t = SITE_TEXT.en;
  const shop = data?.shop ?? {};
  const name = shop.shopName || t.defaultName;
  const url = (p) => `${SITE_URL}${p}`;
  const logo = url('/pwa-512x512.png');
  const phone = formatPhoneTel(shop.shopPhone);
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
    ...(phone && { telephone: phone }),
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'West Wodonga',
      addressRegion: 'VIC',
      addressCountry: 'AU',
    },
    // Giờ đóng cửa thứ 7 chưa có, nên không ghi closes.
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Saturday',
      opens: '06:00',
    },
  };

  switch (route.name) {
    case 'menu':
      return {
        title: `Menu: bánh cuốn, giò chả & more | ${name}`,
        description: t.menuDescription,
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
                ...(d.price != null && { offers: offer(d) }),
              })),
          })),
        },
      };
    case 'dish': {
      const dish = dishes.find((d) => d.slug === route.slug);
      if (!dish) return notFound(name);
      const txt = dishText(dish, 'en');
      return {
        title: dishTitle(dish, txt, name),
        description: dishDescription(dish, txt),
        path: path(`/menu/${dish.slug}`),
        image: dish.content?.photo ? url(dish.content.photo) : logo,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'MenuItem',
          name: txt.name,
          description: txt.description || txt.short,
          ...(dish.content?.photo && { image: url(dish.content.photo) }),
          ...(dish.price != null && { offers: offer(dish) }),
        },
      };
    }
    case 'blog':
      return {
        title: `Vietnamese food guides | ${name}`,
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
        jsonLd: postJsonLd(post, name, url, logo),
      };
    }
    case 'checkout':
      return { title: `Order online | ${name}`, description: t.orderCtaText, path: path('/checkout'), noindex: true };
    case 'notfound':
      return notFound(name);
    default:
      return {
        title: `Bánh cuốn & giò chả in Albury–Wodonga | ${name}`,
        description: t.homeDescription,
        path: path(),
        jsonLd: { '@context': 'https://schema.org', ...business },
      };
  }
}

const notFound = (name) => ({ title: `Page not found | ${name}`, description: 'This page does not exist. Try the menu instead.', path: path(), noindex: true });

const audPrice = (price) => {
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const offer = (dish) => ({
  '@type': 'Offer',
  price: audPrice(dish.price),
  priceCurrency: 'AUD',
});

function dishTitle(dish, txt, shopName) {
  const override = dish.content?.en?.title;
  if (override) {
    const titled = `${override} | ${shopName}`;
    if ([...titled].length <= 60) return titled;
  }
  const [short, gloss] = txt.name.split(' – ');
  const bare = `${short} | ${shopName}`;
  if (!gloss) return trimTitle(bare);
  const words = gloss.split(' ');
  while (words.length) {
    const titled = `${short} (${words.join(' ')}) | ${shopName}`;
    if ([...titled].length <= 60) return titled;
    words.pop();
  }
  return trimTitle(bare);
}

function trimTitle(title) {
  return [...title].length <= 60 ? title : `${[...title].slice(0, 59).join('').replace(/\s+\S*$/, '')}…`;
}

function dishDescription(dish, txt) {
  const price = audPrice(dish.price);
  const tail = [price && txt.portion ? `A$${price} for ${txt.portion}.` : price ? `A$${price}.` : '', 'Pre-order online.']
    .filter(Boolean)
    .join(' ');
  const full = `${txt.short} ${tail}`.replace(/\s+/g, ' ').trim();
  if ([...full].length <= 155) return full;
  const room = 155 - [...tail].length - 1;
  const short = [...txt.short].slice(0, Math.max(0, room - 1)).join('').replace(/\s+\S*$/, '');
  return `${short}… ${tail}`.replace(/\s+/g, ' ').trim();
}

function postJsonLd(post, name, url, logo) {
  const posting = {
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    image: post.cover ? url(post.cover) : logo,
    author: { '@type': 'Organization', name },
    publisher: { '@type': 'Organization', name, logo: { '@type': 'ImageObject', url: logo } },
    mainEntityOfPage: url(path(`/blog/${post.slug}`)),
  };
  if (!post.faq?.length) return { '@context': 'https://schema.org', ...posting };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      posting,
      {
        '@type': 'FAQPage',
        mainEntity: post.faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };
}

export function applyMeta(meta) {
  if (typeof document === 'undefined') return;
  document.title = meta.title || '';
  setNamedMeta('description', meta.description || '');
  setNamedMeta('og:title', meta.title || '', 'property');
  setNamedMeta('og:description', meta.description || '', 'property');
  const canon = document.querySelector('link[rel="canonical"]');
  if (canon && meta.path) canon.setAttribute('href', `${SITE_URL}${meta.path}`);
  const robots = document.querySelector('meta[name="robots"]');
  if (meta.noindex) {
    if (robots) robots.setAttribute('content', 'noindex');
    else setNamedMeta('robots', 'noindex');
  } else if (robots) robots.remove();
  let ld = document.querySelector('script[type="application/ld+json"]');
  if (meta.jsonLd) {
    if (!ld) {
      ld = document.createElement('script');
      ld.type = 'application/ld+json';
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c');
  } else if (ld) ld.remove();
}

function setNamedMeta(name, content, attr = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

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
