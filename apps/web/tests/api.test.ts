import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SAMPLE_CAPTION_REQUEST, getHealth, postCaption, resolveApiUrl } from "@/lib/api";
import { validateCaptionRequest } from "@/lib/validate";
import { REPO_EXAMPLES } from "./paths";

const load = (file: string): unknown => JSON.parse(readFileSync(join(REPO_EXAMPLES, file), "utf8"));

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("resolveApiUrl", () => {
  it.each([undefined, "", "   "])("kosong (%j) -> null", (raw) => {
    expect(resolveApiUrl(raw)).toBeNull();
  });
  it("membuang garis miring di akhir", () => {
    expect(resolveApiUrl(" https://contoh.hf.space/ ")).toBe("https://contoh.hf.space");
  });
  it.each(["contoh.hf.space", "ftp://contoh", "javascript:alert(1)"])("menolak %s", (raw) => {
    expect(resolveApiUrl(raw)).toBeNull();
  });
});

describe("getHealth", () => {
  it("tanpa URL: not_configured dan tidak memanggil fetch", async () => {
    const fetchImpl = vi.fn();
    const out = await getHealth(null, { fetchImpl });
    expect(out).toMatchObject({ kind: "not_configured", message: expect.stringMatching(/NEXT_PUBLIC_API_URL/) });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fetch gagal (jaringan/CORS): unreachable dengan pesan jelas", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const out = await getHealth("https://api.contoh.test", { fetchImpl });
    expect(out).toMatchObject({ kind: "unreachable", message: expect.stringMatching(/tidak bisa dihubungi/) });
  });

  it("timeout: unreachable", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const out = await getHealth("https://api.contoh.test", { fetchImpl, timeoutMs: 10 });
    expect(out).toMatchObject({ kind: "unreachable", message: expect.stringMatching(/batas waktu/) });
  });

  it("200 valid: ok, memanggil /health dengan GET", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(load("health.valid.json")));
    const out = await getHealth("https://api.contoh.test", { fetchImpl });
    expect(out.kind).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.contoh.test/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("200 tidak sesuai kontrak: invalid beserta error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(load("health.invalid.missing-version.json")));
    const out = await getHealth("https://api.contoh.test", { fetchImpl });
    expect(out.kind).toBe("invalid");
    if (out.kind === "invalid") expect(out.errors.length).toBeGreaterThan(0);
  });

  it("200 bukan JSON: invalid", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));
    const out = await getHealth("https://api.contoh.test", { fetchImpl });
    expect(out.kind).toBe("invalid");
  });

  it("503: http_error dan body error dikenali", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(load("error.valid.json"), 503));
    const out = await getHealth("https://api.contoh.test", { fetchImpl });
    expect(out.kind).toBe("http_error");
    if (out.kind === "http_error") {
      expect(out.status).toBe(503);
      expect(out.contractError).toBe(true);
    }
  });
});

describe("postCaption", () => {
  it("contoh request valid terhadap kontrak", () => {
    expect(validateCaptionRequest(SAMPLE_CAPTION_REQUEST)).toEqual({ valid: true });
  });

  it("tanpa URL: not_configured", async () => {
    const out = await postCaption(null, SAMPLE_CAPTION_REQUEST, { fetchImpl: vi.fn() });
    expect(out.kind).toBe("not_configured");
  });

  it("200 valid: ok, POST JSON ke /analyze/caption", async () => {
    const body = load("caption-response.valid.l4-llm-skipped.json");
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const out = await postCaption("https://api.contoh.test", SAMPLE_CAPTION_REQUEST, { fetchImpl });
    expect(out).toEqual({ kind: "ok", body });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.contoh.test/analyze/caption");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual(SAMPLE_CAPTION_REQUEST);
  });

  it("200 tidak sesuai kontrak: invalid, body mentah tetap dikembalikan", async () => {
    const body = load("caption-response.invalid.two-layers-only.json");
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const out = await postCaption("https://api.contoh.test", SAMPLE_CAPTION_REQUEST, { fetchImpl });
    expect(out.kind).toBe("invalid");
    if (out.kind === "invalid") expect(out.body).toEqual(body);
  });
});
