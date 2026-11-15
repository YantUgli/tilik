/**
 * Precompute galeri T-26 dari pipeline SUNGGUHAN (hasil tidak diedit tangan):
 *   L1  = analyzeL1(bytes gambar)                      (src/features/l1/map.ts)
 *   OCR = tesseract.js (versi aplikasi) + toOcrPayload  (src/features/ocr/words.ts)
 *   L3/L4 = POST <API>/analyze/caption                  (satu request per contoh, tanpa retry)
 *   risk = computeRisk(layers)                          (src/lib/risk.ts)
 * galeri-02.jpg diberi EXIF FIKTIF (GPS -6.9000, 107.6100) lewat piexifjs sebelum dianalisis.
 * Validasi kontrak dilakukan di tests/gallery/data.test.ts, bukan di sini.
 *
 * Jalankan dari apps/web (setelah render.py):
 *   node --experimental-strip-types --import ./scripts/gallery/hooks.mjs scripts/gallery/precompute.mjs [galeri-0N ...]
 * Cache ind.traineddata ditulis ke folder sementara OS, bukan ke repo.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import piexif from "piexifjs";
import { createWorker, OEM } from "tesseract.js";
import { analyzeL1 } from "../../src/features/l1/map.ts";
import { toOcrPayload } from "../../src/features/ocr/words.ts";
import { readDimensions } from "../../src/lib/image/dimensions.ts";
import { computeRisk } from "../../src/lib/risk.ts";

const API = process.env.TILIK_API_URL ?? "https://tilik-api.fastapicloud.dev";
const PUBLIC = fileURLToPath(new URL("../../public/gallery/", import.meta.url));
const DATA = fileURLToPath(new URL("../../src/features/gallery/data/", import.meta.url));

export const GALLERY = [
  { id: "galeri-01", file: "galeri-01.png", caption: "lembur dulu nyiapin berkas" },
  { id: "galeri-02", file: "galeri-02.jpg", caption: "besok suami berangkat satgas, kumpul di yonif jam 4", exif: true },
  { id: "galeri-03", file: "galeri-03.png", caption: "Selamat ulang tahun anakku, semoga sehat selalu" },
];

function embedFakeExif(path) {
  const gps = {
    [piexif.GPSIFD.GPSLatitudeRef]: "S",
    [piexif.GPSIFD.GPSLatitude]: piexif.GPSHelper.degToDmsRational(6.9),
    [piexif.GPSIFD.GPSLongitudeRef]: "E",
    [piexif.GPSIFD.GPSLongitude]: piexif.GPSHelper.degToDmsRational(107.61),
  };
  const dict = {
    "0th": { [piexif.ImageIFD.Make]: "ContohHP", [piexif.ImageIFD.Model]: "Contoh X1" },
    Exif: { [piexif.ExifIFD.DateTimeOriginal]: "2026:11:14 06:30:00" },
    GPS: gps,
  };
  const jpeg = readFileSync(path).toString("binary");
  writeFileSync(path, Buffer.from(piexif.insert(piexif.dump(dict), jpeg), "binary"));
}

const SEVERITY_RANK = { info: 0, perhatian: 1, tinggi: 2 };

async function main() {
  const only = process.argv.slice(2);
  const items = GALLERY.filter((g) => !only.length || only.includes(g.id));
  const cachePath = mkdtempSync(join(tmpdir(), "tilik-tess-"));
  const worker = await createWorker("ind", OEM.LSTM_ONLY, { cachePath });
  try {
    for (const g of items) {
      const path = join(PUBLIC, g.file);
      if (g.exif) embedFakeExif(path);
      const bytes = new Uint8Array(readFileSync(path));
      const l1 = await analyzeL1(bytes);
      const dims = readDimensions(bytes);
      if (!dims) throw new Error(`ukuran ${g.file} tidak terbaca`);
      const { data } = await worker.recognize(Buffer.from(bytes), {}, { blocks: true });
      const ocr = toOcrPayload(data, dims.width, dims.height);
      const body = { caption: g.caption, ocr_text: ocr.ocr_text, lang: "id" };
      if (ocr.ocr_words?.length) body.ocr_words = ocr.ocr_words;
      const res = await fetch(`${API}/analyze/caption`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`${g.id}: HTTP ${res.status} ${JSON.stringify(json)}`);
      const layers = [l1, ...json.layers];
      const { level, incomplete } = computeRisk(layers);
      const all = layers.flatMap((l) => l.findings);
      const top = Math.max(-1, ...all.map((f) => SEVERITY_RANK[f.severity]));
      const result = {
        schema_version: "1.0",
        request_id: g.id,
        mode: "precomputed",
        layers,
        has_text_document: null,
        risk: { level, incomplete, top_reasons: all.filter((f) => SEVERITY_RANK[f.severity] === top && top > 0).map((f) => f.id) },
      };
      writeFileSync(join(DATA, `${g.id}.json`), `${JSON.stringify(result, null, 2)}\n`);
      const summary = layers.map((l) => `${l.layer}/${l.provider}:${l.status}[${l.findings.map((f) => `${f.category}:${f.severity}:${f.source}`).join(",")}]`);
      console.log(`${g.id} → ${level}${incomplete ? " (belum lengkap)" : ""}\n  ${summary.join("\n  ")}\n  OCR: ${JSON.stringify(ocr.ocr_text)}`);
    }
  } finally {
    await worker.terminate();
    rmSync(cachePath, { recursive: true, force: true });
  }
}

await main();
