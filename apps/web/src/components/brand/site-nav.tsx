"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const LINKS = [
  { href: "/periksa", label: "Periksa" },
  { href: "/tentang", label: "Tentang" },
] as const;

/** Navigasi utama; halaman aktif ditandai `aria-current`. */
export function SiteNav() {
  const path = usePathname();
  return (
    <nav aria-label="Utama" className="nav-main">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="nav-link" aria-current={path === l.href ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** Logo: ke landing di browser; di mode aplikasi (PWA standalone) ke alat periksa. Fallback "/". */
export function HomeLink({ children }: { children: ReactNode }) {
  const [href, setHref] = useState("/");
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const update = () => setHref(mq.matches ? "/periksa" : "/");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return (
    <Link href={href} className="site-logo" aria-label="TILIK, ke beranda">
      {children}
    </Link>
  );
}
