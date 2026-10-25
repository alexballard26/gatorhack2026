import type { Metadata, Viewport } from "next";
import { Archivo_Black, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader, SiteFooter } from "@/components/Chrome";

const archivo = Archivo_Black({ variable: "--font-archivo", subsets: ["latin"], weight: "400", display: "swap" });
const grotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], weight: ["400", "500", "700"], display: "swap" });
const mono = Space_Mono({ variable: "--font-space-mono", subsets: ["latin"], weight: ["400", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "Undervote: know your whole ballot",
  description:
    "Find every race on your Nov 3, 2026 ballot and get neutral, cited information on every candidate, researched by Gemini Deep Research.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0B1210", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-bg">
      <body className={`${archivo.variable} ${grotesk.variable} ${mono.variable} flex min-h-screen flex-col bg-bg font-sans text-ink antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-[4px] focus:bg-accent focus:px-3 focus:py-2 focus:font-mono focus:text-sm focus:text-accent-ink"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
