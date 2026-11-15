import { Logo, LogoWordmark } from "./logo";
import { HomeLink, SiteNav } from "./site-nav";

/** Header 56 px: simbol kecil 28 px + wordmark ~22 px, jarak 8 px; navigasi dengan target sentuh ≥ 44 px. */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner nav-bar">
        <HomeLink>
          <Logo size={28} decorative />
          <LogoWordmark height={22} decorative />
        </HomeLink>
        <SiteNav />
      </div>
    </header>
  );
}
