/**
 * Batas caption (FR-IN-02). Penghitung menampilkan karakter tampilan (grapheme), tetapi batas
 * juga dicek per code point agar sejajar dengan server dan `maxLength` di kontrak.
 */

export const CAPTION_MAX = 2200;

export const CAPTION_MESSAGES = {
  codePoints: "Caption terlalu panjang. Emoji tertentu dihitung lebih dari satu karakter.",
} as const;

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("id", { granularity: "grapheme" }) : null;

export function countCaptionChars(text: string): number {
  if (!segmenter) return Array.from(text).length; // cadangan: per code point
  let n = 0;
  for (const _ of segmenter.segment(text)) n++;
  return n;
}

export type CaptionCheck = { count: number; ok: boolean };

/** `count` = grapheme (untuk penghitung). `ok` bila grapheme ≤ 2.200 dan code point ≤ 2.200. */
export function checkCaption(text: string): CaptionCheck {
  const count = countCaptionChars(text);
  return { count, ok: count <= CAPTION_MAX && Array.from(text).length <= CAPTION_MAX };
}

/** Pesan tambahan bila caption ditolak padahal penghitung masih dalam batas (karena code point). */
export function captionProblem({ count, ok }: CaptionCheck): string | null {
  return !ok && count <= CAPTION_MAX ? CAPTION_MESSAGES.codePoints : null;
}
