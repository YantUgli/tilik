import type { MetadataRoute } from "next";

// T-27 (versi manifest saja): TANPA service worker.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TILIK — Periksa dulu, baru unggah",
    short_name: "TILIK",
    description: "Periksa foto dan caption sebelum diunggah ke media sosial.",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F4EBDD",
    theme_color: "#F4EBDD",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
