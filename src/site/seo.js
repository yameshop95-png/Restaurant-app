import { TAGLINE } from '../lib/brand';
import { CATEGORIES } from './data/dishes';
import { formatPhoneTel, PICKUP_CLOSE, PICKUP_OPEN } from './format';
import { dishText, findPost, path, SITE_URL, SOCIAL, sortedPosts } from './lib';
import { SITE_TEXT } from './text';

// Thẻ <head> cho từng trang (tiếng Anh, để Google đọc): tiêu đề, mô tả, link chuẩn, ảnh chia sẻ, dữ liệu có cấu trúc
export function pageMeta(route, data, dishes) {
  const meta = pageMetaInner(route, data, dishes);
  const shop = data?.shop ?? {};
  meta.siteName = shop.shopName || SITE_TEXT.en.defaultName;
  return meta;
}

function pageMetaInner(route, data, dishes) {
  const t = SITE_TEXT.en;
  const shop = data?.shop ?? {};
  const name = shop.shopName || t.defaultName;
  const url = (p) => `${SITE_URL}${p}`;
  const logo = url('/pwa-512x512.png');
  const phone = formatPhoneTel(shop.shopPhone);
  const business = {
    '@type': 'FoodEstablishment',
    name,
    slogan: TAGLINE,
    url: url(path()),
    logo: url('/logo-round.svg'),
    image: url('/site/photos/banh-cuon.webp'),
    ...(phone && { telephone: phone }),
    servesCuisine: 'Vietnamese',
    priceRange: '$',
    currenciesAccepted: 'AUD',
    paymentAccepted: 'Cash, Bank Transfer',
    hasMenu: url(path('/menu')),
    areaServed: ['Wodonga', 'West Wodonga', 'Leneva', 'Albury', 'Baranduda', 'Lavington', 'Thurgoona'].map(
      (cityName) => ({ '@type': 'City', name: cityName }),
    ),
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: PICKUP_OPEN,
        closes: PICKUP_CLOSE,
      },
    ],
    sameAs: Object.values(SOCIAL),
  };

  switch (route.name) {
    case 'menu':
      return {
        title: `Menu & Prices | ${name}`,
        description: 'Explore our weekly menu of fresh bánh cuốn, giò lụa, chả chiên, bánh giò and Vietnamese favourites in Albury–Wodonga. Pre-order online for Saturday.',
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
        image: dish.content?.photo ? url(dish.content.photo) : url('/site/photos/banh-cuon.webp'),
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
        title: `Vietnamese Recipes & Food Tips | ${name}`,
        description: 'Learn how to make authentic nước chấm, crispy hành phi and đồ chua at home with easy ingredients from Australian supermarkets.',
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
      return {
        title: `Pre-Order Online | ${name}`,
        description: 'Place your order for Saturday pickup (6 am–9 pm) or morning delivery in Albury–Wodonga. Pay by cash or bank transfer on arrival.',
        path: path('/checkout'),
        noindex: true,
      };
    case 'notfound':
      return notFound(name);
    default:
      return {
        title: `Bánh Cuốn & Giò Chả Albury–Wodonga | ${name}`,
        description: 'Homemade bánh cuốn, giò lụa, chả chiên & bánh giò made fresh weekly in Albury–Wodonga. Pre-order by Friday 10 pm for Saturday pickup or local delivery.',
        ogDescription: `${TAGLINE}. Freshly made weekly in a food-safe kitchen. Order by 10 pm Friday for Saturday pickup or delivery across Wodonga & Albury.`,
        twitterDescription: 'Homemade bánh cuốn, giò lụa, chả chiên & bánh giò made fresh every week. Pre-order for Saturday pickup or delivery.',
        keywords: 'Wodonga Vietnamese food, Albury Vietnamese food, bánh cuốn Albury Wodonga, giò lụa Wodonga, chả chiên, Vietnamese takeaway Wodonga, homemade Vietnamese food',
        geo: true,
        image: url('/site/photos/og-cover.jpg'),
        imageAlt: 'Fresh bánh cuốn topped with fried shallots, herbs and sliced giò lụa',
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

const TITLE_SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'with', 'for', 'to', 'per']);

function titleCaseName(name) {
  return name
    .split(' – ')
    .map((segment) =>
      segment
        .split(' ')
        .map((w, i) => {
          if (!w) return w;
          if (i > 0 && TITLE_SMALL_WORDS.has(w.toLowerCase())) return w.toLowerCase();
          return w[0].toUpperCase() + w.slice(1);
        })
        .join(' '),
    )
    .join(' – ');
}

function dishTitle(dish, txt, shopName) {
  const titled = titleCaseName(txt.name);
  const portion = txt.portion ? txt.portion.replace(/\s*\([^)]*\)\s*$/, '') : '';
  return portion ? `${titled} (${portion}) | ${shopName}` : `${titled} | ${shopName}`;
}

function dishDescription(dish, txt) {
  const price = audPrice(dish.price);
  const viName = dishText(dish, 'vi').name.split(' – ')[0] || txt.name.split(' – ')[0];
  const lead = `Freshly made ${viName ? viName[0].toLowerCase() + viName.slice(1) : viName}`;
  const short = (txt.short || '').replace(/\.+$/, '');
  const pricePart = price && txt.portion ? ` ($${price} / ${txt.portion})` : price ? ` ($${price})` : '';
  return `${lead}${short ? ` – ${short}` : ''}${pricePart}. Pre-order online for Saturday pickup or delivery in Albury–Wodonga.`;
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
  setNamedMeta('og:description', meta.ogDescription || meta.description || '', 'property');
  const canon = document.querySelector('link[rel="canonical"]');
  if (canon && meta.path) canon.setAttribute('href', `${SITE_URL}${meta.path}`);
  setNamedMeta('robots', meta.noindex ? 'noindex' : 'index, follow');
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
    meta.keywords && `<meta name="keywords" content="${esc(meta.keywords)}" />`,
    `<meta name="robots" content="${meta.noindex ? 'noindex' : 'index, follow'}" />`,
    `<link rel="canonical" href="${esc(full)}" />`,
    meta.geo && `<meta name="geo.region" content="AU-VIC" />`,
    meta.geo && `<meta name="geo.placename" content="Wodonga, Albury-Wodonga" />`,
    `<meta property="og:type" content="${meta.type ?? 'website'}" />`,
    `<meta property="og:locale" content="en_AU" />`,
    meta.siteName && `<meta property="og:site_name" content="${esc(meta.siteName)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    (meta.ogDescription || meta.description) && `<meta property="og:description" content="${esc(meta.ogDescription || meta.description)}" />`,
    `<meta property="og:url" content="${esc(full)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    meta.imageAlt && `<meta property="og:image:alt" content="${esc(meta.imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    (meta.twitterDescription || meta.ogDescription || meta.description) && `<meta name="twitter:description" content="${esc(meta.twitterDescription || meta.ogDescription || meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    meta.jsonLd && `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>`,
  ]
    .filter(Boolean)
    .join('\n    ');
}
