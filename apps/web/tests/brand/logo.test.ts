import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Logo, LogoWordmark } from "@/components/brand/logo";

// .ts (bukan .tsx) karena vitest.config hanya memuat tests/**/*.test.ts.
const html = (props: Parameters<typeof Logo>[0]) => renderToStaticMarkup(createElement(Logo, props));

describe("Logo", () => {
  it("size 20 → simbol kecil", () => {
    const out = html({ size: 20 });
    expect(out).toContain("M30.5 10.5");
    expect(out).not.toContain("M32 12");
  });

  it("size 48 → simbol standar", () => {
    const out = html({ size: 48 });
    expect(out).toContain("M32 12");
    expect(out).not.toContain("M30.5 10.5");
  });

  it("ambang: 39 kecil, 40 standar", () => {
    expect(html({ size: 39 })).toContain("M30.5 10.5");
    expect(html({ size: 40 })).toContain("M32 12");
  });

  it('default role="img" aria-label="TILIK"', () => {
    const out = html({ size: 28 });
    expect(out).toContain('role="img"');
    expect(out).toContain('aria-label="TILIK"');
    expect(out).not.toContain("aria-hidden");
  });

  it("decorative → aria-hidden, tanpa role/label", () => {
    const out = html({ size: 28, decorative: true });
    expect(out).toContain('aria-hidden="true"');
    expect(out).not.toContain('role="img"');
    expect(out).not.toContain("aria-label");
  });

  it("warna lewat CSS var, tanpa hex", () => {
    const out = html({ size: 48 }) + renderToStaticMarkup(createElement(LogoWordmark, { height: 22 }));
    expect(out).toContain("var(--logo-ink)");
    expect(out).toContain("var(--logo-accent)");
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
