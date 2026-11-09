# src/contracts/ — JANGAN DIEDIT

Salinan `contracts/*.schema.json` dari akar repo, dibuat oleh `pnpm sync-contracts`
(juga dijalankan otomatis oleh `pnpm build`). Setiap file diberi header `$comment`.

Salinan ini di-commit supaya build tetap jalan bila hanya `apps/web` yang tersedia.
Untuk mengubah skema, ubah sumbernya di `contracts/`, lalu jalankan ulang sync.
`tests/contracts-sync.test.ts` gagal bila salinan berbeda dari sumber.
