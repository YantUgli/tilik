/**
 * Galeri contoh precomputed (FR-UI-02, T-26). Data dibuat 15 Nov 2026 oleh
 * scripts/gallery/precompute.mjs dari pipeline sungguhan (L1, OCR versi aplikasi, endpoint caption,
 * computeRisk) atas gambar FIKTIF dari scripts/gallery/render.py. Jangan edit JSON dengan tangan.
 * Diimpor statis: membuka galeri tidak memanggil server, OCR, atau worker apa pun.
 */
import type { LayerResult } from "@/lib/validate";
import galeri01 from "./data/galeri-01.json";
import galeri02 from "./data/galeri-02.json";
import galeri03 from "./data/galeri-03.json";

/** Bentuk contracts/analysis-result.schema.json dengan `mode: "precomputed"`. */
export type PrecomputedResult = {
  schema_version: "1.0";
  request_id: string;
  mode: "precomputed";
  layers: LayerResult[];
  has_text_document: boolean | null;
  risk: { level: "aman" | "perhatian" | "tinggi"; incomplete: boolean; top_reasons: string[] };
};

export type GalleryItem = {
  id: string;
  title: string;
  /** Path di public/ (gambar fiktif). */
  image: string;
  caption: string;
  result: PrecomputedResult;
};

export const GALLERY_DATE = "15 Nov 2026";

export const GALLERY: readonly GalleryItem[] = [
  {
    id: "galeri-01",
    title: "Lembur dengan surat dinas di meja",
    image: "/gallery/galeri-01.png",
    caption: "lembur dulu nyiapin berkas",
    result: galeri01 as PrecomputedResult,
  },
  {
    id: "galeri-02",
    title: "Foto pantai dan kabar keberangkatan",
    image: "/gallery/galeri-02.jpg",
    caption: "besok suami berangkat satgas, kumpul di yonif jam 4",
    result: galeri02 as PrecomputedResult,
  },
  {
    id: "galeri-03",
    title: "Kartu ucapan ulang tahun",
    image: "/gallery/galeri-03.png",
    caption: "Selamat ulang tahun anakku, semoga sehat selalu",
    result: galeri03 as PrecomputedResult,
  },
];
