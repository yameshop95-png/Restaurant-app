import { useCallback, useEffect, useMemo, useState } from 'react';
import { siteClient, store } from './client';
import { BASE, dishList, parseRoute } from './lib';
import { pageMeta } from './seo';
import { SITE_TEXT } from './text';
import { CartBar, Footer, Nav, SiteContext } from './ui';
import Blog from './pages/Blog';
import Checkout from './pages/Checkout';
import Dish from './pages/Dish';
import Home from './pages/Home';
import Menu from './pages/Menu';
import NotFound from './pages/NotFound';
import Post from './pages/Post';

const LANG_KEY = 'order-site.lang';
const CART_KEY = 'site.cart';

// Website cho khách. Lúc build, mỗi trang được dựng sẵn thành HTML (scripts/prerender.mjs) để Google đọc được;
// trên trình duyệt React tiếp quản, tải lại giá / còn hết món mới nhất và chuyển trang không cần tải lại.
// Lần vẽ đầu tiên phải giống hệt bản dựng sẵn: tiếng Anh, giỏ trống; sau đó mới đọc ngôn ngữ và giỏ đã lưu.
export default function SiteApp({ initialPath, initialData }) {
  const [pathname, setPathname] = useState(initialPath);
  const route = parseRoute(pathname);
  const [lang, setLangState] = useState('en');
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState(initialData ?? null);
  const [loadError, setLoadError] = useState(false);
  const [cart, setCart] = useState({});

  const reload = useCallback(async () => {
    const { data: res, error } = await siteClient().rpc('public_shop');
    if (error || !res) {
      setLoadError((had) => had || !data);
      return;
    }
    setLoadError(false);
    setData(res);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setMounted(true);
    const saved = store.get(LANG_KEY, null);
    setLangState(saved ?? (/^vi/i.test(navigator.language) ? 'vi' : 'en'));
    setCart(store.get(CART_KEY, {}));
    reload();
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [reload]);

  useEffect(() => {
    if (mounted) store.set(CART_KEY, cart);
  }, [cart, mounted]);

  const setLang = (l) => {
    setLangState(l);
    store.set(LANG_KEY, l);
  };

  const dishes = useMemo(() => dishList(data?.menu ?? null), [data]);

  // Đổi tiêu đề / mô tả trang khi chuyển trang
  useEffect(() => {
    if (!mounted) return;
    const meta = pageMeta(route, data, dishes);
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description ?? '');
    document.documentElement.lang = lang;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, data, mounted, lang]);

  const navigate = useCallback((e, to) => {
    if (e && (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1)) return;
    if (!to.startsWith(BASE)) return;
    e?.preventDefault();
    const [p, hash] = to.split('#');
    window.history.pushState({}, '', to);
    setPathname(p);
    setTimeout(() => (hash ? document.getElementById(hash)?.scrollIntoView() : window.scrollTo(0, 0)), 0);
  }, []);

  const setQty = useCallback(
    (id, n) =>
      setCart((c) => {
        const v = Math.max(0, Math.min(50, n));
        const next = { ...c };
        if (v) next[id] = v;
        else delete next[id];
        return next;
      }),
    []
  );

  const value = {
    route,
    lang,
    setLang,
    t: SITE_TEXT[lang],
    data,
    shop: data?.shop ?? {},
    dishes,
    loadError,
    reload,
    cart,
    setQty,
    clearCart: () => setCart({}),
    navigate,
    mounted,
  };

  const page = {
    home: <Home />,
    menu: <Menu />,
    dish: <Dish slug={route.slug} />,
    blog: <Blog />,
    post: <Post slug={route.slug} />,
    checkout: <Checkout />,
  }[route.name] ?? <NotFound />;

  return (
    <SiteContext.Provider value={value}>
      <div className="flex min-h-screen flex-col bg-page">
        <Nav />
        <main className="flex-1 pb-24">{page}</main>
        <Footer />
        <CartBar />
      </div>
    </SiteContext.Provider>
  );
}
