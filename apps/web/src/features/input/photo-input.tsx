"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { prepareImages, type PreparedImages } from "@/lib/image/downscale";
import { CAPTION_MAX, captionProblem, checkCaption } from "./caption";
import { MESSAGES, validateImageFile } from "./validate-file";

/** Input siap analisis. Semua tetap di memori browser; tidak ada yang disimpan ke storage. */
export type PreparedInput = {
  /** File asli, hanya untuk pemrosesan di perangkat (mis. EXIF di T-12). Tidak pernah dikirim. */
  file: File;
  images: PreparedImages;
  caption: string;
};

type Photo =
  | { phase: "empty" }
  | { phase: "checking" }
  | { phase: "error"; message: string }
  | { phase: "ready"; file: File; images: PreparedImages; previewUrl: string; ms: number };

type Props = { onSubmit?: (input: PreparedInput) => void };

export function PhotoInput({ onSubmit }: Props) {
  const ids = { file: useId(), caption: useId(), counter: useId() };
  const [photo, setPhoto] = useState<Photo>({ phase: "empty" });
  const [caption, setCaption] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const token = useRef(0);
  const current = useRef<Photo>(photo);
  current.current = photo;

  useEffect(() => () => release(current.current), []);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const my = ++token.current;
    release(current.current);
    setNotice(null);
    if (!file) return setPhoto({ phase: "empty" });

    setPhoto({ phase: "checking" });
    const started = performance.now();
    const check = await validateImageFile(file);
    if (my !== token.current) return;
    if (!check.ok) return setPhoto({ phase: "error", message: check.message });

    try {
      const images = await prepareImages(file);
      if (my !== token.current) return images.work.close();
      setPhoto({
        phase: "ready",
        file,
        images,
        previewUrl: URL.createObjectURL(images.send.blob),
        ms: Math.round(performance.now() - started),
      });
    } catch {
      if (my === token.current) setPhoto({ phase: "error", message: MESSAGES.unreadable });
    }
  };

  const cap = checkCaption(caption);
  const capProblem = captionProblem(cap);
  const canSubmit = photo.phase === "ready" && cap.ok;

  const submit = () => {
    if (photo.phase !== "ready" || !cap.ok) return;
    if (onSubmit) onSubmit({ file: photo.file, images: photo.images, caption });
    else setNotice("Analisis belum tersedia di versi ini.");
  };

  return (
    <section className="card input-card">
      <h2>Periksa sebelum unggah</h2>
      <p className="muted">Pilih satu foto. Foto diproses di perangkatmu dulu; yang dikirim ke server hanya versi kecil (≤ 1024 px).</p>

      <label htmlFor={ids.file} className="field-label">
        Foto (JPG, PNG, atau WebP, maks. 10 MB)
      </label>
      <input id={ids.file} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} />

      {photo.phase === "checking" && <p className="muted">Menyiapkan foto…</p>}
      {photo.phase === "error" && (
        <p className="status error" role="alert">
          {photo.message}
        </p>
      )}
      {photo.phase === "ready" && (
        <figure className="preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URL lokal */}
          <img src={photo.previewUrl} alt="Pratinjau foto yang dipilih" width={photo.images.send.width} height={photo.images.send.height} />
          <figcaption className="muted">
            {photo.images.work.width}×{photo.images.work.height} px di perangkat · {photo.images.send.width}×{photo.images.send.height} px
            untuk dikirim · siap dalam {photo.ms} ms
          </figcaption>
        </figure>
      )}

      <label htmlFor={ids.caption} className="field-label">
        Caption (opsional)
      </label>
      <textarea
        id={ids.caption}
        rows={4}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        aria-describedby={ids.counter}
        aria-invalid={!cap.ok}
        placeholder="Tulis caption yang akan kamu unggah"
      />
      <p id={ids.counter} className={`counter ${cap.ok ? "muted" : "status error"}`} aria-live="polite">
        {cap.count.toLocaleString("id-ID")}/{CAPTION_MAX.toLocaleString("id-ID")} karakter
        {!cap.ok && !capProblem && " (terlalu panjang)"}
      </p>
      {capProblem && (
        <p className="status error" role="alert">
          {capProblem}
        </p>
      )}

      <button type="button" onClick={submit} disabled={!canSubmit}>
        Periksa
      </button>
      {notice && <p className="muted">{notice}</p>}
    </section>
  );
}

function release(p: Photo) {
  if (p.phase !== "ready") return;
  URL.revokeObjectURL(p.previewUrl);
  p.images.work.close();
}
