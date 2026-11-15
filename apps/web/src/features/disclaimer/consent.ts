/**
 * FR-UI-03: disclaimer sebelum pemeriksaan pertama di sesi browser.
 *
 * DEVIASI dari teks SPEC (lihat tasks/T-25-disclaimer.md): SPEC menyebut gambar dikirim dan
 * "zero data retention". Keduanya tidak sesuai kode sekarang: foto tidak dikirim (L1 + OCR di perangkat),
 * dan kebijakan retensi penyedia belum diverifikasi. Teks di bawah mengikuti perilaku kode.
 */

export const CONSENT_KEY = "tilik.disclaimer.v1";

/** Subset Storage yang dipakai; `null` = storage tidak tersedia. */
export type ConsentStorage = Pick<Storage, "getItem" | "setItem"> | null | undefined;

export function hasConsent(storage: ConsentStorage): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveConsent(storage: ConsentStorage): void {
  if (!storage) return;
  try {
    storage.setItem(CONSENT_KEY, "1");
  } catch {
    // Storage penuh/diblokir: disclaimer akan muncul lagi, alur tetap jalan.
  }
}

/** sessionStorage bila bisa diakses; aksesornya sendiri bisa melempar (mis. cookie diblokir). */
export function sessionStore(): ConsentStorage {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export type Part = { text: string; strong?: boolean };

export const DISCLAIMER = {
  title: "Sebelum memeriksa",
  paragraphs: [
    [{ text: "Foto diperiksa di HP-mu dan " }, { text: "tidak dikirim", strong: true }, { text: " ke mana pun." }],
    [
      {
        text:
          "Caption dan teks yang terbaca dari foto dikirim ke server TILIK dan ke layanan AI pihak ketiga (Fireworks AI) untuk diperiksa. " +
          "TILIK tidak menyimpannya; hasil pemeriksaan AI untuk teks yang sama bisa disimpan sementara di memori server (paling lama 24 jam) agar lebih hemat.",
      },
    ],
    [
      { text: "Ini purwarupa untuk lomba. " },
      { text: "Jangan memeriksa dokumen dinas asli.", strong: true },
      { text: " Pakai contoh di atas untuk mencoba." },
    ],
  ] as Part[][],
  confirm: "Saya mengerti, lanjutkan",
  cancel: "Batal",
} as const;

/** Kalimat ringkas yang selalu tampil di bawah form. */
export const PRIVACY_NOTE = "Foto tidak dikirim; caption dan teks dari foto diperiksa server + AI pihak ketiga.";

export function disclaimerText(): string {
  return [DISCLAIMER.title, ...DISCLAIMER.paragraphs.map((p) => p.map((x) => x.text).join("")), DISCLAIMER.confirm, DISCLAIMER.cancel].join("\n");
}

/** Gating murni: input ditahan sampai pengguna memutuskan. */
export type Gate<T> =
  | { status: "idle" }
  | { status: "pending"; input: T }
  | { status: "confirmed"; input: T }
  | { status: "cancelled" };

export type GateAction<T> = { type: "hold"; input: T } | { type: "confirm" } | { type: "cancel" };

export function gateReducer<T>(state: Gate<T>, action: GateAction<T>): Gate<T> {
  switch (action.type) {
    case "hold":
      return { status: "pending", input: action.input };
    case "confirm":
      return state.status === "pending" ? { status: "confirmed", input: state.input } : state;
    case "cancel":
      return state.status === "pending" ? { status: "cancelled" } : state;
  }
}
