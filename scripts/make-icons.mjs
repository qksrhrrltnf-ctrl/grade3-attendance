// 앱 아이콘 생성: public/favicon.svg, public/apple-touch-icon.png, public/icons/*.png
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pub = resolve(root, "public");
mkdirSync(resolve(pub, "icons"), { recursive: true });

// lucide clipboard-check (24x24) 를 파란 둥근 사각형 위에 올림. scale: 글리프 크기 비율
const svg = ({ size = 512, radius = 112, scale = 0.62, bg = "#2563eb" }) => {
  const g = size * scale, k = g / 24, off = (size - g) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1e40af"/></linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="${bg === "gradient" ? "url(#bg)" : bg}"/>
  <g transform="translate(${off} ${off}) scale(${k})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <path d="m9 14 2 2 4-4"/>
  </g>
</svg>`;
};

writeFileSync(resolve(pub, "favicon.svg"), svg({ size: 64, radius: 14, bg: "gradient" }));

const jobs = [
  ["icons/icon-192.png", svg({ bg: "gradient" }), 192],
  ["icons/icon-512.png", svg({ bg: "gradient" }), 512],
  ["icons/maskable-512.png", svg({ radius: 0, scale: 0.46, bg: "#2563eb" }), 512], // 안전 영역 고려해 작게
  ["apple-touch-icon.png", svg({ radius: 0, scale: 0.6, bg: "gradient" }), 180],   // iOS가 모서리를 깎음
];
for (const [name, s, size] of jobs) {
  await sharp(Buffer.from(s)).resize(size, size).png().toFile(resolve(pub, name));
  console.log("생성:", name);
}
