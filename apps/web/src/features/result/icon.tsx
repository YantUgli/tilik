/** Ikon stroke sederhana (inline SVG, dekoratif): status tidak hanya lewat warna, teks selalu menyertai. */
export type IconName = "ok" | "warn" | "alert" | "pending" | "fail";

const PATHS: Record<IconName, string> = {
  ok: "M20 6 9 17l-5-5",
  warn: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  alert: "M12 8v4M12 16h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  pending: "M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  fail: "M15 9l-6 6M9 9l6 6M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
