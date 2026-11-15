import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("manifest (T-27, tanpa service worker)", () => {
  const m = manifest();

  it("id, start_url, scope, display, warna", () => {
    expect(m.id).toBe("/");
    expect(m.start_url).toBe("/periksa");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#F4EBDD");
    expect(m.background_color).toBe("#F4EBDD");
    expect(m.short_name).toBe("TILIK");
    expect(m.lang).toBe("id");
  });

  it.each(["192x192", "512x512"])("ikon %s ada untuk purpose any dan maskable, filenya ada", (size) => {
    const icons = (m.icons ?? []).filter((i) => i.sizes === size);
    expect(icons.map((i) => i.purpose).sort()).toEqual(["any", "maskable"]);
    for (const i of icons) expect(existsSync(new URL(`../../public${i.src}`, import.meta.url)), i.src).toBe(true);
  });
});
