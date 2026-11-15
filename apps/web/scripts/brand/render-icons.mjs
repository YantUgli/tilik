// T-50: render ikon PNG statis SEKALI (hasil dikomit). Tanpa dependensi baru: memakai next/og (satori + resvg bawaan Next).
// Jalankan dari apps/web:  node scripts/brand/render-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

const BG = "#8A4B26"; // soga
const INK = "#F4EBDD";
const ACC = "#F0C987";

// Simbol STANDAR (≥ 40 px); semua ikon di sini ≥ 108 px. Salinan persis dari src/lib/brand/logo-paths.ts.
const symbol = (px) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${px}" height="${px}">` +
      `<path d="M32 12L24 4 4 24l20 20 8-8" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M35.5 15h3v3h3v3h3v6h-3v3h-3v3h-3" fill="none" stroke="${ACC}" stroke-width="3.5"/>` +
      `<rect x="20" y="20" width="8" height="8" transform="rotate(45 24 24)" fill="${ACC}"/></svg>`,
  ).toString("base64")}`;

/** kind: "any" (sudut ~23%, simbol 68%), "maskable" (latar penuh, simbol 56% ≤ 60%), "apple" (latar penuh; iOS membulatkan sendiri). */
async function render(size, kind, out) {
  const ratio = kind === "maskable" ? 0.56 : 0.68;
  const px = Math.round(size * ratio);
  const el = h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BG,
        borderRadius: kind === "any" ? Math.round(size * 0.23) : 0,
      },
    },
    h("img", { src: symbol(px), width: px, height: px }),
  );
  const res = new ImageResponse(el, { width: size, height: size });
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log("ditulis", out);
}

mkdirSync("public/icons", { recursive: true });
await render(192, "any", "public/icons/icon-192.png");
await render(512, "any", "public/icons/icon-512.png");
await render(192, "maskable", "public/icons/icon-maskable-192.png");
await render(512, "maskable", "public/icons/icon-maskable-512.png");
await render(180, "apple", "src/app/apple-icon.png");
