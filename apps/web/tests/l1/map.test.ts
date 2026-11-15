import { describe, expect, it } from "vitest";
import { analyzeL1, formatGps, mapExifToFindings } from "@/features/l1/map";
import { readExif } from "@/lib/image/metadata";
import { validateFinding, validateLayerResult } from "@/lib/validate";
import { FAKE, exifJpeg, plainJpeg, plainPng, plainWebp, pngWithExif, webpWithExif } from "./fixtures";

const full = { latitude: -6.9012345, longitude: 107.6098765, dateTimeOriginal: FAKE.date, make: "ContohHP", model: "X1", software: "Kamera 1.0" };

describe("mapExifToFindings", () => {
  it("memetakan GPS, waktu, dan perangkat sesuai tabel kartu", () => {
    const findings = mapExifToFindings(full);
    expect(findings.map((f) => [f.category, f.severity])).toEqual([
      ["gps", "tinggi"],
      ["waktu", "info"],
      ["perangkat", "info"],
    ]);
    for (const f of findings) {
      expect(f.layer).toBe("L1");
      expect(f.source).toBe("exif");
      expect(f.id).toMatch(/^b-\d+$/);
      expect(validateFinding(f)).toEqual({ valid: true });
    }
    expect(new Set(findings.map((f) => f.id)).size).toBe(findings.length);
  });

  it("menggabungkan Software ke temuan perangkat", () => {
    const [dev] = mapExifToFindings({ make: "ContohHP", model: "X1", software: "Kamera 1.0" });
    expect(dev.category).toBe("perangkat");
    expect(dev.evidence?.text).toContain("ContohHP X1");
    expect(dev.evidence?.text).toContain("Kamera 1.0");
    const [onlySw] = mapExifToFindings({ software: "Kamera 1.0" });
    expect(onlySw.category).toBe("perangkat");
    expect(onlySw.severity).toBe("info");
  });

  it("tanpa EXIF → tanpa temuan", () => {
    expect(mapExifToFindings(null)).toEqual([]);
    expect(mapExifToFindings({})).toEqual([]);
  });

  it("GPS hanya satu sumbu tidak dianggap lokasi", () => {
    expect(mapExifToFindings({ latitude: -6.9 })).toEqual([]);
  });

  it("rounds_gps: evidence.text tidak memuat lebih dari 2 desimal", () => {
    const [gps] = mapExifToFindings(full);
    expect(gps.evidence?.text).toBe("sekitar -6,90, 107,61");
    expect(gps.evidence?.text).not.toMatch(/\d[.,]\d{3}/);
    expect(JSON.stringify(gps)).not.toContain("6.901");
    expect(JSON.stringify(gps)).not.toContain("107.609");
  });

  it("formatGps memakai koma desimal dan tidak menampilkan -0,00", () => {
    expect(formatGps(-6.9, 107.61)).toBe("sekitar -6,90, 107,61");
    expect(formatGps(-0.001, 0.004)).toBe("sekitar 0,00, 0,00");
  });

  it("waktu ditampilkan dalam format Indonesia", () => {
    const f = mapExifToFindings({ dateTimeOriginal: "2026:11:13 08:30:00" })[0];
    expect(f.evidence?.text).toBe("13 November 2026, 08.30");
  });

  it("startId menggeser penomoran", () => {
    expect(mapExifToFindings(full, 5).map((f) => f.id)).toEqual(["b-5", "b-6", "b-7"]);
  });
});

describe("readExif", () => {
  it("membaca GPS, waktu, perangkat, software dari JPEG asli", async () => {
    const exif = await readExif(exifJpeg());
    expect(exif?.latitude).toBeCloseTo(FAKE.lat, 4);
    expect(exif?.longitude).toBeCloseTo(FAKE.lon, 4);
    expect(exif).toMatchObject({ dateTimeOriginal: FAKE.date, make: FAKE.make, model: FAKE.model, software: FAKE.software });
  });

  it("file tanpa EXIF → null", async () => {
    expect(await readExif(plainJpeg())).toBeNull();
    expect(await readExif(plainPng())).toBeNull();
    expect(await readExif(plainWebp())).toBeNull();
  });

  it("membaca chunk eXIf PNG dan EXIF WebP", async () => {
    expect((await readExif(pngWithExif()))?.latitude).toBeCloseTo(FAKE.lat, 4);
    expect((await readExif(webpWithExif()))?.longitude).toBeCloseTo(FAKE.lon, 4);
  });
});

describe("analyzeL1 (LayerResult)", () => {
  it("ok dengan temuan, provider browser, valid kontrak", async () => {
    const r = await analyzeL1(exifJpeg());
    expect(r).toMatchObject({ layer: "L1", status: "ok", provider: "browser", note: null });
    expect(r.findings.map((f) => f.category)).toEqual(["gps", "waktu", "perangkat"]);
    expect(validateLayerResult(r)).toEqual({ valid: true });
  });

  it("file tanpa EXIF → ok, findings kosong", async () => {
    const r = await analyzeL1(plainJpeg());
    expect(r).toMatchObject({ status: "ok", findings: [] });
    expect(validateLayerResult(r)).toEqual({ valid: true });
  });

  it("exifr gagal parse → status error, findings kosong, tidak melempar", async () => {
    const r = await analyzeL1(plainJpeg(), async () => {
      throw new Error("rusak");
    });
    expect(r).toMatchObject({ layer: "L1", status: "error", provider: "browser", findings: [] });
    expect(r.note).toBeTruthy();
    expect(r.note).not.toContain("rusak");
    expect(validateLayerResult(r)).toEqual({ valid: true });
  });
});
