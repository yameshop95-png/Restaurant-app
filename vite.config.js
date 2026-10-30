import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

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

export default defineConfig({
  // 2 trang: app nhận order cho quán (/) và website đặt món cho khách (/order)
  build: {
    rollupOptions: {
      input: { main: 'index.html', order: 'order.html' },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
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
        background_color: '#121214',
        theme_color: '#121214',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        // Máy chủ AI luôn phải gọi qua mạng, không trả trang app thay thế
        navigateFallbackDenylist: [/^\/api\//, /^\/order/],
        // Font chữ (Google Fonts): lưu lại để lần sau mở không cần mạng vẫn đúng font
        runtimeCaching: [
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
});
