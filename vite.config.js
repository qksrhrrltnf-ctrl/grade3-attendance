import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
// GitHub Pages 프로젝트 사이트는 /<repo>/ 하위에 배포되므로 CI에서 BASE_PATH 를 넘깁니다.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "icons/*.png"],
      manifest: {
        name: "3학년 감독·출결",
        short_name: "감독출결",
        description: "3학년 수능 전 자습 감독 일정과 출결 체크",
        lang: "ko",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#ff90e8",
        background_color: "#f4f4f0",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        runtimeCaching: [
          {
            // Pretendard 폰트 (jsDelivr) — 한 번 받으면 오프라인에서도 사용
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "jsdelivr-fonts",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
