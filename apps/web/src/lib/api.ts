// Klien API TILIK untuk halaman uji koneksi (T-08). Hanya /health dan /analyze/caption.
import { validateCaptionResponse, validateError, validateHealth, type ValidationResult } from "@/lib/validate";

export type CaptionRequest = {
  caption: string | null;
  ocr_text: string | null;
  lang: "id";
};

/** Request uji: teks netral, tanpa data pengguna. */
export const SAMPLE_CAPTION_REQUEST: CaptionRequest = {
  caption: "Uji koneksi TILIK: selamat pagi dari Yonif 999/Contoh.",
  ocr_text: null,
  lang: "id",
};

export type ApiOutcome =
  | { kind: "not_configured"; message: string }
  | { kind: "unreachable"; message: string }
  | { kind: "http_error"; message: string; status: number; body: unknown; contractError: boolean }
  | { kind: "invalid"; message: string; status: number; body: unknown; errors: string[] }
  | { kind: "ok"; body: unknown };

export type FetchOptions = {
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  timeoutMs?: number;
};

// HF Spaces gratis bisa tidur; request pertama setelah bangun bisa lama.
const DEFAULT_TIMEOUT_MS = 30_000;

/** Normalisasi NEXT_PUBLIC_API_URL. Kosong atau bukan http(s) -> null. */
export function resolveApiUrl(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return value.replace(/\/+$/, "");
}

const NOT_CONFIGURED: ApiOutcome = {
  kind: "not_configured",
  message:
    "NEXT_PUBLIC_API_URL belum diisi atau tidak valid (harus http:// atau https://). " +
    "Isi di .env.local untuk lokal atau di pengaturan Environment Variables Vercel, lalu build ulang.",
};

async function request(
  baseUrl: string | null,
  path: string,
  init: RequestInit,
  validate: (data: unknown) => ValidationResult,
  { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: FetchOptions = {},
): Promise<ApiOutcome> {
  if (!baseUrl) return NOT_CONFIGURED;
  const url = `${baseUrl}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  let text: string;
  try {
    res = await fetchImpl(url, { ...init, signal: controller.signal });
    text = await res.text();
  } catch (err) {
    const timedOut = controller.signal.aborted;
    return {
      kind: "unreachable",
      message: timedOut
        ? `API tidak menjawab dalam batas waktu ${Math.round(timeoutMs / 1000)} detik (${url}). ` +
          "Server mungkin sedang bangun dari tidur; coba lagi sebentar lagi."
        : `API tidak bisa dihubungi (${url}). Periksa URL, apakah server hidup, dan apakah ` +
          `origin halaman ini ada di ALLOWED_ORIGINS server. Detail: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = text;
  let isJson = false;
  try {
    body = JSON.parse(text);
    isJson = true;
  } catch {
    // body tetap teks mentah
  }

  if (!res.ok) {
    const contractError = isJson && validateError(body).valid;
    return {
      kind: "http_error",
      status: res.status,
      body,
      contractError,
      message: `API menjawab HTTP ${res.status}${contractError ? "" : " (body tidak sesuai skema error)"}.`,
    };
  }

  if (!isJson) {
    return {
      kind: "invalid",
      status: res.status,
      body,
      errors: ["body bukan JSON"],
      message: "Respons API bukan JSON.",
    };
  }
  const check = validate(body);
  if (!check.valid) {
    return {
      kind: "invalid",
      status: res.status,
      body,
      errors: check.errors,
      message: "Respons API tidak sesuai kontrak.",
    };
  }
  return { kind: "ok", body };
}

export function getHealth(baseUrl: string | null, opts?: FetchOptions): Promise<ApiOutcome> {
  return request(baseUrl, "/health", { method: "GET" }, validateHealth, opts);
}

export function postCaption(
  baseUrl: string | null,
  body: CaptionRequest,
  opts?: FetchOptions,
): Promise<ApiOutcome> {
  return request(
    baseUrl,
    "/analyze/caption",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    validateCaptionResponse,
    opts,
  );
}
