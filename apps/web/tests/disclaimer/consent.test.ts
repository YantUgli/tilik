import { describe, expect, it } from "vitest";
import {
  CONSENT_KEY,
  PRIVACY_NOTE,
  disclaimerText,
  gateReducer,
  hasConsent,
  saveConsent,
  type Gate,
} from "@/features/disclaimer/consent";

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("consent", () => {
  it("storage null → false tanpa error", () => {
    expect(hasConsent(null)).toBe(false);
    expect(() => saveConsent(null)).not.toThrow();
  });

  it("storage melempar → false tanpa error", () => {
    expect(hasConsent(throwing)).toBe(false);
    expect(() => saveConsent(throwing)).not.toThrow();
    expect(hasConsent(throwing)).toBe(false);
  });

  it("setelah saveConsent → true", () => {
    const s = memoryStorage();
    expect(hasConsent(s)).toBe(false);
    saveConsent(s);
    expect(hasConsent(s)).toBe(true);
    expect(s.getItem(CONSENT_KEY)).toBe("1");
  });
});

describe("text", () => {
  const text = disclaimerText();
  it("memuat pernyataan yang sesuai kode", () => {
    expect(text).toContain("tidak dikirim");
    expect(text).toContain("Fireworks AI");
    expect(text).toContain("Jangan memeriksa dokumen dinas asli");
  });
  it("tidak memuat klaim yang tidak terbukti", () => {
    for (const t of [text, PRIVACY_NOTE]) expect(t.toLowerCase()).not.toContain("zero data retention");
  });
});

describe("gate", () => {
  const idle: Gate<string> = { status: "idle" };
  it("input ditahan, diteruskan setelah konfirmasi", () => {
    const held = gateReducer(idle, { type: "hold", input: "x" });
    expect(held).toEqual({ status: "pending", input: "x" });
    expect(gateReducer(held, { type: "confirm" })).toEqual({ status: "confirmed", input: "x" });
  });
  it("input dibuang saat batal", () => {
    const held = gateReducer(idle, { type: "hold", input: "x" });
    const out = gateReducer(held, { type: "cancel" });
    expect(out).toEqual({ status: "cancelled" });
    expect(gateReducer(out, { type: "confirm" })).toEqual({ status: "cancelled" });
  });
  it("confirm tanpa input tertahan tidak meneruskan apa pun", () => {
    expect(gateReducer(idle, { type: "confirm" })).toEqual(idle);
  });
});
