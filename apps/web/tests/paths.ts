import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** contracts/ di akar repo (sumber kebenaran). Tidak ada bila apps/web dipakai terpisah. */
export const REPO_CONTRACTS = fileURLToPath(new URL("../../../contracts/", import.meta.url));
export const REPO_EXAMPLES = fileURLToPath(new URL("../../../contracts/examples/", import.meta.url));
/** Salinan yang di-commit di apps/web (hasil `pnpm sync-contracts`). */
export const SYNCED_CONTRACTS = fileURLToPath(new URL("../src/contracts/", import.meta.url));

export const hasRepoContracts = existsSync(REPO_CONTRACTS);
