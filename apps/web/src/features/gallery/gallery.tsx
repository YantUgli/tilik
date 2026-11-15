"use client";

/**
 * "Coba contoh" (FR-UI-02): hasil precomputed statis, tanpa server, OCR, atau worker.
 * Gambar bermosaik dibuat di browser dari gambar galeri dengan encoder redaksi yang sama (T-14).
 */
import { useEffect, useState } from "react";
import { activeBoxes, collectAreas } from "@/features/redact/areas";
import { encodeRedactedJpeg } from "@/features/redact/pixelate";
import { LayerCard } from "@/features/result/layer-card";
import { RiskCard } from "@/features/result/risk-card";
import { L1_TITLE, SERVER_TITLES } from "@/features/result/session";
import { GALLERY, GALLERY_DATE, type GalleryItem } from "./items";

const NO_DISABLED: ReadonlySet<string> = new Set();

export function GalleryPicker({ onOpen }: { onOpen: (item: GalleryItem) => void }) {
  return (
    <section className="card gallery-card" aria-labelledby="gallery-title">
      <h2 id="gallery-title">Coba contoh</h2>
      <p className="muted small">Lihat hasil TILIK tanpa menyiapkan foto.</p>
      <ul className="gallery-list">
        {GALLERY.map((g) => (
          <li key={g.id}>
            <button type="button" className="gallery-item" onClick={() => onOpen(g)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.image} alt="" width={96} height={72} loading="lazy" />
              <span className="gallery-text">
                <strong>{g.title}</strong>
                <span className="badge">Contoh fiktif</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Muat gambar galeri lewat <img> (bukan fetch) lalu mosaik area redactable. */
function useRedactedImage(item: GalleryItem): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const boxes = activeBoxes(collectAreas(item.result.layers.slice(1)), NO_DISABLED);
    if (!boxes.length) return;
    let alive = true;
    let made: string | null = null;
    const img = new Image();
    img.src = item.image;
    img
      .decode()
      .then(() => createImageBitmap(img))
      .then(async (bitmap) => {
        try {
          return await encodeRedactedJpeg(bitmap, boxes);
        } finally {
          bitmap.close();
        }
      })
      .then((blob) => {
        if (!alive) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [item]);
  return url;
}

export function GalleryView({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  const redacted = useRedactedImage(item);
  const [l1, ...server] = item.result.layers;
  const { level, incomplete } = item.result.risk;
  return (
    <div className="results gallery-view">
      <p className="card gallery-banner small">
        <span className="badge">Contoh fiktif</span> Hasil contoh ini disimpan dari pemeriksaan sungguhan pada {GALLERY_DATE};
        tidak memanggil server.
      </p>
      <section className="card">
        <div className="layer-head">
          <h2>{item.title}</h2>
          <button type="button" onClick={onClose}>
            Tutup contoh
          </button>
        </div>
        <figure className="gallery-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={redacted ?? item.image} alt={`Gambar contoh fiktif: ${item.title}`} />
          <figcaption className="muted small">
            {redacted ? "Area dokumen dinas sudah dibuat mosaik. " : ""}Caption: “{item.caption}”
          </figcaption>
        </figure>
      </section>
      <RiskCard risk={{ level, incomplete }} />
      <LayerCard title={L1_TITLE} layer={l1} />
      {server.map((layer, i) => (
        <LayerCard key={i} title={SERVER_TITLES[i] ?? layer.layer} layer={layer} />
      ))}
    </div>
  );
}
