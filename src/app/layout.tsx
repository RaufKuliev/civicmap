import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const manrope = Manrope({ subsets: ["cyrillic", "latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Гражданская карта", template: "%s — Гражданская карта" },
  description: "Справочный каталог одномандатных избирательных округов и кандидатов.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" data-scroll-behavior="smooth"><body className={manrope.variable}><a className="skip-link" href="#main-content">К основному содержанию</a><SiteHeader /><main id="main-content" tabIndex={-1}>{children}</main><SiteFooter /></body></html>;
}
