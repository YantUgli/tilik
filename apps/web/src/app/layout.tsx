import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SiteHeader } from "@/components/brand/site-header";
import "./globals.css";

// Self-host saat build: tidak ada request runtime ke Google.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: { default: "TILIK — Periksa dulu, baru unggah", template: "%s · TILIK" },
  description: "Periksa foto dan caption sebelum diunggah ke media sosial.",
  applicationName: "TILIK",
  appleWebApp: { capable: true, title: "TILIK", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4EBDD" },
    { media: "(prefers-color-scheme: dark)", color: "#2B1C12" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
