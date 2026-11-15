import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Landing } from "@/components/landing";
import Tentang from "@/app/tentang/page";

const SRC = new URL("../../src/", import.meta.url);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(name) ? [p] : [];
  });
}

/** Buang komentar supaya yang diuji hanya kode dan teks yang bisa tampil. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("landing", () => {
  const html = renderToStaticMarkup(createElement(Landing));

  it("punya satu h1 dan CTA Mulai periksa ke alat", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Mulai periksa");
    expect(html).toContain('href="#periksa"');
    expect(html).toContain('href="#contoh"');
  });

  it("menyatakan foto tidak dikirim", () => {
    expect(html).toContain("tidak dikirim");
  });
});

describe("/tentang", () => {
  const html = renderToStaticMarkup(createElement(Tentang));

  it("memuat bagian Keterbatasan, satu h1, dan tautan repo", () => {
    expect(html).toContain("Keterbatasan");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("https://github.com/YantUgli/tilik");
    expect(html).toContain("tidak berafiliasi resmi");
  });
});

describe("teks yang salah tidak muncul di src/**", () => {
  const all = files(SRC.pathname.replace(/^\/([A-Za-z]:)/, "$1"));

  it("menemukan berkas sumber", () => {
    expect(all.length).toBeGreaterThan(10);
  });

  it.each(["untuk dikirim", "zero data retention"])("tidak ada %j", (phrase) => {
    const hits = all.filter((f) => stripComments(readFileSync(f, "utf8")).toLowerCase().includes(phrase));
    expect(hits).toEqual([]);
  });
});
