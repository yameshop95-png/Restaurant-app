import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Cài app ra màn hình chính + mở được khi mạng yếu (lưu sẵn giao diện app trên máy)
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Nhận order',
        short_name: 'Nhận order',
        description: 'Nhận order, giao hàng và báo cáo cho quán ăn',
        lang: 'vi',
        start_url: '/',
        display: 'standalone',
        background_color: '#f1f5f9',
        theme_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        // Máy chủ AI luôn phải gọi qua mạng, không trả trang app thay thế
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
