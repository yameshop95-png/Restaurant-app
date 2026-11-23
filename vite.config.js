import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createHash } from 'node:crypto';
import { VitePWA } from 'vite-plugin-pwa';
import { flattenLayers } from './scripts/flatten-css-layers.mjs';

// Website đặt món của khách không phải app nhận order: bỏ nút "cài app" và service worker của app khỏi trang đó
const orderPageWithoutPwa = {
  name: 'order-page-without-pwa',
  enforce: 'post',
  transformIndexHtml: {
    order: 'post',
    handler: (html, ctx) =>
      ctx.path.endsWith('order.html')
        ? html.replace(/<link rel="manifest"[^>]*>/, '').replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, '')
        : html,
  },
};

// Safari cũ (iOS / iPadOS trước 15.4) không hiểu @layer nên bỏ qua toàn bộ CSS của Tailwind v4 (app hiện chữ trơn).
// Bỏ vỏ @layer trong file CSS khi build, rồi đặt lại tên file theo nội dung mới (để máy đã lưu bản cũ phải tải bản mới)
// và sửa mọi chỗ trỏ tới tên cũ (HTML, JS). Trình duyệt mới hiển thị y như cũ.
const cssForOldSafari = {
  name: 'css-for-old-safari',
  enforce: 'post',
  generateBundle(_, bundle) {
    const renames = [];
    for (const [key, file] of Object.entries(bundle)) {
      if (file.type !== 'asset' || !key.endsWith('.css')) continue;
      const css = flattenLayers(String(file.source));
      const hash = createHash('sha256').update(css).digest('base64url').slice(0, 8);
      const next = key.replace(/-[\w-]{8}\.css$/, `-${hash}.css`);
      file.source = css;
      if (next !== key) {
        file.fileName = next;
        delete bundle[key];
        bundle[next] = file;
        renames.push([key.split('/').pop(), next.split('/').pop()]);
      }
    }
    if (!renames.length) return;
    const swap = (text) => renames.reduce((t, [from, to]) => t.split(from).join(to), text);
    for (const file of Object.values(bundle)) {
      if (file.type === 'chunk') file.code = swap(file.code);
      else if (/\.(html|js|json|webmanifest)$/.test(file.fileName)) file.source = swap(String(file.source));
      if (file.viteMetadata?.importedCss) {
        file.viteMetadata.importedCss = new Set([...file.viteMetadata.importedCss].map(swap));
      }
    }
  },
};

export default defineConfig(({ isSsrBuild }) => ({
  // 2 trang: app nhận order cho quán (/) và website cho khách (/order, dựng sẵn từng trang bằng scripts/prerender.mjs)
  build: isSsrBuild
    ? {}
    : {
        rollupOptions: {
          input: { main: 'index.html', order: 'order.html' },
        },
      },
  plugins: isSsrBuild
    ? [react(), tailwindcss()]
    : [
    react(),
    tailwindcss(),
    cssForOldSafari,
    // Cài app ra màn hình chính + mở được khi mạng yếu (lưu sẵn giao diện app trên máy)
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.svg', 'logo-round.svg'],
      manifest: {
        name: 'Nhận order',
        short_name: 'Nhận order',
        description: 'Nhận order, giao hàng và báo cáo cho quán ăn',
        lang: 'vi',
        start_url: '/',
        display: 'standalone',
        background_color: '#ecebe6',
        theme_color: '#ecebe6',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        // Trang website (/order) không thuộc app; order.html được thay bằng các trang dựng sẵn sau build
        globIgnores: ['order.html', 'order/**', 'site/**', 'assets/order-*'],
        // Máy chủ AI luôn phải gọi qua mạng, không trả trang app thay thế
        navigateFallbackDenylist: [/^\/api\//, /^\/order/],
        // wodovn.xyz/ → website bán hàng: chạy trước bộ đệm trang app (xem public/sw-redirect.js)
        importScripts: ['sw-redirect.js'],
        // Font chữ (Google Fonts): lưu lại để lần sau mở không cần mạng vẫn đúng font
        runtimeCaching: [
          // Ảnh nhỏ món trong danh sách đơn (36 KB tất cả): lưu lại để mở lại không cần mạng
          {
            urlPattern: /\/site\/thumbs\//,
            handler: 'CacheFirst',
            options: { cacheName: 'thumbs', expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
    orderPageWithoutPwa,
  ],
}));
