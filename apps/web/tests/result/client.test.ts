import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { analyzeCaption } from "@/lib/api";
import { validateCaptionRequest, validateLayerResult } from "@/lib/validate";
import { REPO_EXAMPLES } from "../paths";

const load = (file: string): unknown => JSON.parse(readFileSync(join(REPO_EXAMPLES, file), "utf8"));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const BASE = "https://api.contoh.test";

const expectThreeServerLayers = (layers: unknown[]) => {
  expect(layers).toHaveLength(3);
  for (const l of layers) expect(validateLayerResult(l)).toEqual({ valid: true });
};

describe("analyzeCaption", () => {
  it("mengirim {caption, ocr_text: null, lang: 'id'} ke POST /analyze/caption", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(load("caption-response.valid.json")));
    await analyzeCaption(BASE, "besok berangkat", null, { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${BASE}/analyze/caption`);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toEqual({ caption: "besok berangkat", ocr_text: null, lang: "id" });
    expect(validateCaptionRequest(body)).toEqual({ valid: true });
  });

  it("respons valid kontrak → ok, lapis dari server apa adanya", async () => {
    const body = load("caption-response.valid.json") as { layers: unknown[] };
    const out = await analyzeCaption(BASE, "x", null, { fetchImpl: vi.fn().mockResolvedValue(json(body)) });
    expect(out.problem).toBeNull();
    expect(out.layers).toEqual(body.layers);
  });

  it.each(["caption-response.valid.l4-llm-unavailable.json", "caption-response.valid.l4-llm-skipped.json", "caption-response.valid.l4-llm-error.json"])(
    "%s → ok (status lapis dari server dipertahankan)",
    async (file) => {
      const out = await analyzeCaption(BASE, "x", null, { fetchImpl: vi.fn().mockResolvedValue(json(load(file))) });
      expect(out.problem).toBeNull();
      expectThreeServerLayers(out.layers);
    },
  );

  it.each(["caption-response.invalid.two-layers-only.json", "caption-response.invalid.wrong-order.json", "caption-response.invalid.missing-request-id.json"])(
    "respons tidak valid (%s) → tiga lapis error, tidak crash",
    async (file) => {
      const out = await analyzeCaption(BASE, "x", null, { fetchImpl: vi.fn().mockResolvedValue(json(load(file))) });
      expect(out.problem).toBe("invalid");
      expect(out.layers.map((l) => [l.layer, l.status])).toEqual([
        ["L3", "error"],
        ["L4", "error"],
        ["L4", "error"],
      ]);
      expectThreeServerLayers(out.layers);
    },
  );

  it("body bukan JSON → error, tidak crash", async () => {
    const out = await analyzeCaption(BASE, "x", null, { fetchImpl: vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })) });
    expect(out.problem).toBe("invalid");
    expect(out.layers.every((l) => l.status === "error")).toBe(true);
  });

  it("http_429: dipetakan ke sibuk dengan pesan ramah", async () => {
    const out = await analyzeCaption(BASE, "x", null, {
      fetchImpl: vi.fn().mockResolvedValue(json(load("error.valid.rate-limited.json"), 429)),
    });
    expect(out.problem).toBe("busy");
    expect(out.message).toBe("Sedang ramai, coba lagi sebentar.");
    expect(out.layers.every((l) => l.status === "unavailable")).toBe(true);
    expectThreeServerLayers(out.layers);
  });

  it("server tidak bisa dihubungi → tidak tersedia", async () => {
    const out = await analyzeCaption(BASE, "x", null, { fetchImpl: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) });
    expect(out.problem).toBe("unavailable");
    expect(out.layers.every((l) => l.status === "unavailable")).toBe(true);
    expectThreeServerLayers(out.layers);
  });

  it("HTTP 503 → tidak tersedia", async () => {
    const out = await analyzeCaption(BASE, "x", null, { fetchImpl: vi.fn().mockResolvedValue(json(load("error.valid.json"), 503)) });
    expect(out.problem).toBe("unavailable");
  });

  it("URL API kosong → tidak tersedia tanpa memanggil fetch", async () => {
    const fetchImpl = vi.fn();
    const out = await analyzeCaption(null, "x", null, { fetchImpl });
    expect(out.problem).toBe("unavailable");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("note placeholder tidak memuat caption pengguna", async () => {
    const out = await analyzeCaption(BASE, "rahasia-caption", null, { fetchImpl: vi.fn().mockRejectedValue(new TypeError("x")) });
    expect(JSON.stringify(out)).not.toContain("rahasia-caption");
  });
});
