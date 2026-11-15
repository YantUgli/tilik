import Link from "next/link";
import { Logo, LogoWordmark } from "./logo";

/** Header 56 px: simbol kecil 28 px + wordmark ~22 px, jarak 8 px. */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo" aria-label="TILIK, ke beranda">
          <Logo size={28} decorative />
          <LogoWordmark height={22} decorative />
        </Link>
      </div>
    </header>
  );
}
