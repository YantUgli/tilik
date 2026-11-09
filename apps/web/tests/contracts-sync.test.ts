import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_CONTRACTS, SYNCED_CONTRACTS, hasRepoContracts } from "./paths";

const schemaFiles = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".schema.json"))
    .sort();

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

describe.skipIf(!hasRepoContracts)("salinan src/contracts sama dengan contracts/", () => {
  it("berisi file skema yang sama persis", () => {
    expect(schemaFiles(SYNCED_CONTRACTS)).toEqual(schemaFiles(REPO_CONTRACTS));
  });

  it.each(hasRepoContracts ? schemaFiles(REPO_CONTRACTS) : [])(
    "%s identik dengan sumber (selain header $comment)",
    (file) => {
      const { $comment, ...copy } = readJson(join(SYNCED_CONTRACTS, file));
      expect($comment).toMatch(/^JANGAN DIEDIT/);
      expect(copy).toEqual(readJson(join(REPO_CONTRACTS, file)));
    },
  );
});
