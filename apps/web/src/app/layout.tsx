import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TILIK",
  description: "Periksa foto dan caption sebelum diunggah ke media sosial.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
