import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Luminansi relatif WCAG 2.x dari "#rrggbb". */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

function vars(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}

const light = vars(css.match(/^:root\s*\{([^}]*)\}/m)![1]);
const darkBlock = css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/)![1];
const dark = vars(darkBlock);

describe("contrastRatio", () => {
  it("hitam-putih = 21, sama = 1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#8a4b26", "#8a4b26")).toBeCloseTo(1, 5);
  });
});

describe.each([
  ["terang", light],
  ["gelap", dark],
])("token mode %s", (_mode, t) => {
  const texts = ["fg", "muted", "ok", "warn", "error"];

  it.each(texts.flatMap((fg) => ["bg", "card"].map((bg) => [fg, bg])))("--%s di atas --%s ≥ 4,5", (fg, bg) => {
    expect(t[fg], `--${fg}`).toBeDefined();
    expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("teks tombol (--on-accent) di atas soga (--accent) ≥ 4,5", () => {
    expect(t.accent).toBe("#8a4b26");
    expect(contrastRatio(t["on-accent"], t.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("severity berbeda terang-gelapnya, bukan hanya hue (rasio antarpasangan ≥ 1,25)", () => {
    const sev = [t.ok, t.warn, t.error];
    for (let i = 0; i < sev.length; i++)
      for (let j = i + 1; j < sev.length; j++) expect(contrastRatio(sev[i], sev[j])).toBeGreaterThanOrEqual(1.25);
  });

  it("bata #A0522D hanya dipakai sebagai aksen logo", () => {
    const uses = Object.entries(t).filter(([, v]) => v === "#a0522d").map(([k]) => k);
    expect(uses.every((k) => k === "logo-accent")).toBe(true);
  });
});
