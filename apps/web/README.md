# apps/web

Frontend TILIK (Next.js App Router, TypeScript, pnpm). Saat ini berisi halaman uji koneksi:
`/` memanggil `GET /health` dan, lewat tombol "Uji caption", `POST /analyze/caption`, lalu
memvalidasi respons terhadap kontrak dan menampilkan JSON mentahnya.

```
pnpm install
pnpm dev              # http://localhost:3000
pnpm test             # vitest
pnpm build            # sync-contracts + next build
pnpm sync-contracts   # salin ulang contracts/*.schema.json ke src/contracts/
```

`NEXT_PUBLIC_API_URL` (URL backend, http/https) dibaca saat build. Bila kosong atau API tidak
bisa dihubungi, halaman tetap jalan dan menampilkan pesannya. Jangan menaruh secret di
variabel `NEXT_PUBLIC_*`.

`src/contracts/` adalah salinan skema dari `contracts/` di akar repo; jangan diedit (lihat
`src/contracts/README.md`).
