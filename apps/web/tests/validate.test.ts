import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateCaptionRequest,
  validateCaptionResponse,
  validateError,
  validateHealth,
  type ValidationResult,
} from "@/lib/validate";
import { REPO_EXAMPLES } from "./paths";

const examples = (prefix: string) =>
  readdirSync(REPO_EXAMPLES)
    .filter((f) => f.startsWith(`${prefix}.`) && f.endsWith(".json"))
    .sort();
const load = (file: string): unknown => JSON.parse(readFileSync(join(REPO_EXAMPLES, file), "utf8"));

const cases: Array<[string, (data: unknown) => ValidationResult]> = [
  ["caption-response", validateCaptionResponse],
  ["caption-request", validateCaptionRequest],
  ["health", validateHealth],
  ["error", validateError],
];

describe.each(cases)("validator %s", (prefix, validate) => {
  const valid = examples(prefix).filter((f) => f.includes(".valid"));
  const invalid = examples(prefix).filter((f) => f.includes(".invalid."));

  it("punya contoh valid dan invalid", () => {
    expect(valid.length).toBeGreaterThan(0);
    expect(invalid.length).toBeGreaterThan(0);
  });

  it.each(valid)("menerima %s", (file) => {
    expect(validate(load(file))).toEqual({ valid: true });
  });

  it.each(invalid)("menolak %s", (file) => {
    const result = validate(load(file));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("validator caption-response, kasus khusus", () => {
  it("memeriksa finding lewat $ref antarskema (layer-result -> finding)", () => {
    const body = load("caption-response.valid.json") as {
      layers: Array<{ findings: Array<Record<string, unknown>> }>;
    };
    const broken = structuredClone(body);
    broken.layers[0].findings[0].severity = "parah";
    const result = validateCaptionResponse(broken);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.join("\n")).toMatch(/severity/);
  });

  it("menolak bukan-objek", () => {
    expect(validateCaptionResponse("ok").valid).toBe(false);
    expect(validateCaptionResponse(null).valid).toBe(false);
  });
});
