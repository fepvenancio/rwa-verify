import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "rwa-verify explorer",
  description: "Read-side verification of tokenised real-world assets: ERC-3643 / 7943 / 4626 baseline plus ERC-8320 / 8325 / 8326 / 8328 / 8330.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex w-full max-w-5xl items-baseline justify-between gap-4 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold">
              rwa-verify
            </Link>
            <a href="/api/v1" className="text-zinc-600 hover:underline dark:text-zinc-400">
              API
            </a>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
