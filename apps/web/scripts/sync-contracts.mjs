#!/usr/bin/env node
// Menyalin contracts/*.schema.json (akar repo) ke apps/web/src/contracts/.
//
// Salinan di-commit supaya build tetap jalan walau hanya apps/web yang tersedia
// (mis. Vercel dengan root directory apps/web). Bila folder sumber tidak ada,
// skrip ini tidak mengubah apa pun dan salinan yang di-commit yang dipakai.
// Kesamaan salinan dengan sumber dijaga oleh tests/contracts-sync.test.ts.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../../../contracts/", import.meta.url));
const DEST = fileURLToPath(new URL("../src/contracts/", import.meta.url));

const header = (file) =>
  `JANGAN DIEDIT: hasil sync dari contracts/${file} lewat \`pnpm sync-contracts\`. ` +
  "Ubah sumbernya di contracts/, lalu jalankan ulang sync.";

const schemaFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith(".schema.json")).sort();

if (!existsSync(SRC)) {
  console.warn(`[sync-contracts] ${SRC} tidak ada; memakai salinan yang sudah di-commit di src/contracts/.`);
  process.exit(0);
}

mkdirSync(DEST, { recursive: true });

const sources = schemaFiles(SRC);
let changed = 0;

for (const file of sources) {
  const schema = JSON.parse(readFileSync(join(SRC, file), "utf8"));
  if ("$comment" in schema) {
    // Header memakai $comment; sumber yang sudah punya $comment akan tertimpa.
    console.error(`[sync-contracts] ${file} sudah punya $comment; sesuaikan skrip ini dulu.`);
    process.exit(1);
  }
  const out = `${JSON.stringify({ $comment: header(file), ...schema }, null, 2)}\n`;
  const target = join(DEST, file);
  if (!existsSync(target) || readFileSync(target, "utf8") !== out) {
    writeFileSync(target, out);
    changed++;
  }
}

for (const file of schemaFiles(DEST)) {
  if (!sources.includes(file)) {
    rmSync(join(DEST, file));
    changed++;
  }
}

console.log(`[sync-contracts] ${sources.length} skema, ${changed} berubah.`);
