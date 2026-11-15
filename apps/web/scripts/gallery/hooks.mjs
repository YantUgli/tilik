/**
 * Resolver kecil agar Node bisa memuat modul src/ apa adanya (T-26): alias `@/x` → src/x.ts dan
 * impor relatif tanpa ekstensi di file .ts → `.ts`. Dipakai hanya oleh precompute.mjs (--import).
 * Diperlukan karena features/l1/map.ts mengimpor nilai `readExif` lewat `@/`.
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

const withTs = (path) => (existsSync(path) ? path : existsSync(`${path}.ts`) ? `${path}.ts` : path);

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return next(pathToFileURL(withTs(SRC + specifier.slice(2))).href, context);
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return next(pathToFileURL(withTs(fileURLToPath(new URL(specifier, context.parentURL)))).href, context);
    }
    return next(specifier, context);
  },
});
