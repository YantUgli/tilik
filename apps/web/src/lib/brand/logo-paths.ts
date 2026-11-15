/**
 * Geometri logo TILIK (T-50). Sumber: canvas Claude Design "Logo TILIK",
 * artboard "07 · Logo final — Ikat bidik, Palet D". Salin persis; jangan diubah tangan.
 */
export const SYMBOL_VIEWBOX = "0 0 48 48";

/** Di bawah ukuran ini (px) pakai varian KECIL (garis lebih tebal). */
export const SMALL_SYMBOL_MAX = 40;

export type SymbolVariant = {
  ink: { d: string; strokeWidth: number };
  accent: { d: string; strokeWidth: number };
  diamond: { x: number; y: number; size: number };
};

export const SYMBOL_STANDARD: SymbolVariant = {
  ink: { d: "M32 12L24 4 4 24l20 20 8-8", strokeWidth: 4.5 },
  accent: { d: "M35.5 15h3v3h3v3h3v6h-3v3h-3v3h-3", strokeWidth: 3.5 },
  diamond: { x: 20, y: 20, size: 8 },
};

export const SYMBOL_SMALL: SymbolVariant = {
  ink: { d: "M30.5 10.5L24 4 4 24l20 20 6.5-6.5", strokeWidth: 5.5 },
  accent: { d: "M35 15h4.5v4.5h4.5v9h-4.5v4.5h-4.5", strokeWidth: 4.5 },
  diamond: { x: 19.5, y: 19.5, size: 9 },
};

export const WORDMARK_VIEWBOX = "22 -757 1664 763";
export const WORDMARK_ASPECT = 1664 / 763;
export const WORDMARK_PATH =
  "M309 6Q217 6 166.5 -44.5Q116 -95 116 -187V-427H22V-544H32Q72 -544 94 -565Q116 -586 116 -626V-668H247V-544H372V-427H247V-194Q247 -167 256.5 -148Q266 -129 286.5 -119Q307 -109 339 -109Q346 -109 355.5 -110Q365 -111 374 -112V0Q360 2 342 4Q324 6 309 6Z M462 0V-544H593V0ZM462 -605V-745H593V-605Z M702 0V-757H833V0Z M942 0V-544H1073V0ZM942 -605V-745H1073V-605Z M1182 0V-757H1313V-261L1263 -276L1519 -544H1682L1481 -325L1686 0H1536L1358 -282L1436 -298L1272 -122L1313 -202V0Z";

export function symbolFor(size: number): SymbolVariant {
  return size < SMALL_SYMBOL_MAX ? SYMBOL_SMALL : SYMBOL_STANDARD;
}
