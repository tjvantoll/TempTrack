import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TempTrack",
  description: "Location and temperature alerting for the TempTrack connected tracker.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-20 border-b border-line bg-[var(--bg)]/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="shrink-0" aria-label="TempTrack home">
              <Logo />
            </Link>
            <NavLinks />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        <footer className="border-t border-line px-4 py-5 text-center text-xs text-muted sm:px-6">
          Data from{" "}
          <a
            className="text-primary underline underline-offset-2 hover:text-[var(--primary-hover)]"
            href="https://notehub.io"
            target="_blank"
            rel="noreferrer"
          >
            Blues Notehub
          </a>
          . Fixes and readings are plotted on capture time, not upload time.
        </footer>
      </body>
    </html>
  );
}
