/** Batas caption (FR-IN-02), dihitung per karakter tampilan (grapheme). */

export const CAPTION_MAX = 2200;

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("id", { granularity: "grapheme" }) : null;

export function countCaptionChars(text: string): number {
  if (!segmenter) return Array.from(text).length; // cadangan: per code point
  let n = 0;
  for (const _ of segmenter.segment(text)) n++;
  return n;
}

export function checkCaption(text: string): { count: number; ok: boolean } {
  const count = countCaptionChars(text);
  return { count, ok: count <= CAPTION_MAX };
}
