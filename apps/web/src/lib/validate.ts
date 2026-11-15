// Validator respons/request terhadap kontrak (JSON Schema draft 2020-12).
// Skema berasal dari src/contracts/ (salinan hasil `pnpm sync-contracts`).
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import analysisResultSchema from "@/contracts/analysis-result.schema.json";
import captionRequestSchema from "@/contracts/caption-request.schema.json";
import captionResponseSchema from "@/contracts/caption-response.schema.json";
import errorSchema from "@/contracts/error.schema.json";
import findingSchema from "@/contracts/finding.schema.json";
import healthSchema from "@/contracts/health.schema.json";
import layerResultSchema from "@/contracts/layer-result.schema.json";

export type ValidationResult = { valid: true } | { valid: false; errors: string[] };

const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
// Skema yang dirujuk lewat $ref ("finding.schema.json", "layer-result.schema.json")
// didaftarkan dengan $id-nya masing-masing.
ajv.addSchema([findingSchema, layerResultSchema, analysisResultSchema]);

const compile = (schema: object) => {
  let fn: ValidateFunction | undefined;
  return (data: unknown): ValidationResult => {
    fn ??= ajv.compile(schema);
    return fn(data) ? { valid: true } : { valid: false, errors: formatErrors(fn.errors) };
  };
};

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors?.length) return ["tidak valid"];
  return errors.map((e) => {
    const params = Object.keys(e.params).length ? ` ${JSON.stringify(e.params)}` : "";
    return `${e.instancePath || "/"} ${e.message ?? e.keyword}${params}`;
  });
}

export const validateCaptionRequest = compile(captionRequestSchema);
export const validateCaptionResponse = compile(captionResponseSchema);
export const validateHealth = compile(healthSchema);
export const validateError = compile(errorSchema);
// Skema yang sudah didaftarkan lewat addSchema diambil dengan $id-nya (tidak dikompilasi dua kali).
const compileRef = (id: string) => (data: unknown): ValidationResult => {
  const fn = ajv.getSchema(id);
  if (!fn) return { valid: false, errors: [`skema ${id} tidak terdaftar`] };
  return fn(data) ? { valid: true } : { valid: false, errors: formatErrors(fn.errors) };
};

export const validateFinding = compileRef("finding.schema.json");
export const validateLayerResult = compileRef("layer-result.schema.json");
export const validateAnalysisResult = compileRef("analysis-result.schema.json");

// Tipe TS yang mencerminkan contracts/finding.schema.json dan layer-result.schema.json.
export type Severity = "info" | "perhatian" | "tinggi";
export type LayerId = "L1" | "L2" | "L3" | "L4" | "PII";
export type Finding = {
  id: string;
  layer: LayerId;
  category: string;
  severity: Severity;
  source: "exif" | "rule" | "llm" | "vlm" | "face";
  message: string;
  explanation?: string;
  rule_ref?: string;
  basis?: string;
  evidence?: { text?: string; where?: "caption" | "ocr" | "image"; bboxes?: number[][] };
  redactable?: boolean;
  experimental?: boolean;
};
export type LayerResult = {
  layer: LayerId;
  status: "ok" | "skipped" | "unavailable" | "error";
  provider: "fireworks" | "groq" | "cloudflare" | "ollama" | "rule" | "browser" | null;
  latency_ms: number;
  findings: Finding[];
  note: string | null;
};
