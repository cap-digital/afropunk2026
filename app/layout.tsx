import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--fonte-inter",
});

export const metadata: Metadata = {
  title: "AFROPUNK 2026 · Dashboard de Mídia",
  description:
    "Performance das campanhas AFROPUNK 2026 por praça — Rio de Janeiro, Recife e Salvador.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
