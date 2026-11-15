import { SYMBOL_VIEWBOX, WORDMARK_ASPECT, WORDMARK_PATH, WORDMARK_VIEWBOX, symbolFor } from "@/lib/brand/logo-paths";

type A11y = { decorative?: boolean };

function a11yProps({ decorative }: A11y) {
  return decorative
    ? ({ "aria-hidden": true, focusable: "false" } as const)
    : ({ role: "img", "aria-label": "TILIK" } as const);
}

/** Simbol TILIK. `size < 40` → varian kecil. Warna lewat --logo-ink/--logo-accent (ikut mode gelap). */
export function Logo({ size = 28, decorative, className }: { size?: number; className?: string } & A11y) {
  const s = symbolFor(size);
  return (
    <svg viewBox={SYMBOL_VIEWBOX} width={size} height={size} className={className} {...a11yProps({ decorative })}>
      <path
        d={s.ink.d}
        fill="none"
        stroke="var(--logo-ink)"
        strokeWidth={s.ink.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={s.accent.d} fill="none" stroke="var(--logo-accent)" strokeWidth={s.accent.strokeWidth} />
      <rect
        x={s.diamond.x}
        y={s.diamond.y}
        width={s.diamond.size}
        height={s.diamond.size}
        transform="rotate(45 24 24)"
        fill="var(--logo-accent)"
      />
    </svg>
  );
}

/** Wordmark "tilik"; `height` dalam px. */
export function LogoWordmark({ height = 22, decorative, className }: { height?: number; className?: string } & A11y) {
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      height={height}
      width={Math.round(height * WORDMARK_ASPECT * 100) / 100}
      className={className}
      {...a11yProps({ decorative })}
    >
      <path d={WORDMARK_PATH} fill="var(--logo-ink)" />
    </svg>
  );
}
