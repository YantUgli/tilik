"use client";

export type FaceSearchState = { phase: "idle" } | { phase: "running" } | { phase: "done"; count: number } | { phase: "failed" };

type Props = {
  state: FaceSearchState;
  /** false selama versi kerja belum siap. */
  ready: boolean;
  onSearch: () => void;
};

export const FACE_FAILED_MESSAGE = "Pencarian wajah gagal, coba lagi.";
export const FACE_NONE_MESSAGE = "Tidak ada wajah yang ditemukan.";
export const FACE_LIMIT_NOTE =
  "Pencarian paling andal untuk wajah dekat atau sedang; wajah kecil atau jauh bisa terlewat, periksa pratinjau.";

/**
 * Tombol "Cari wajah" (FR-PII-01, T-15). Dipicu pengguna: MediaPipe baru diunduh saat ditekan. Deteksi di
 * perangkat; tidak ada gambar yang dikirim. Wajah yang ditemukan muncul sebagai toggle di panel redaksi.
 */
export function FaceSearch({ state, ready, onSearch }: Props) {
  const running = state.phase === "running";
  const canSearch = state.phase === "idle" || state.phase === "failed";
  return (
    <div className="face-search">
      {canSearch && (
        <button type="button" className="secondary" onClick={onSearch} disabled={!ready}>
          {state.phase === "failed" ? "Coba cari wajah lagi" : "Cari wajah"}
        </button>
      )}
      {running && (
        <button type="button" className="secondary" disabled>
          Mencari wajah…
        </button>
      )}
      <p className="status small" role="status" aria-live="polite">
        {state.phase === "failed" && FACE_FAILED_MESSAGE}
        {state.phase === "done" && state.count === 0 && FACE_NONE_MESSAGE}
        {state.phase === "done" && state.count > 0 && `${state.count} wajah ditemukan dan disamarkan.`}
      </p>
      <p className="muted small">{FACE_LIMIT_NOTE}</p>
    </div>
  );
}
