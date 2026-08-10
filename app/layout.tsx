import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KadeBill",
  description: "KadeBill — invoice generator for point-of-sale billing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        print:block + print:min-h-0: body is flex + min-h-full for the
        on-screen app shell, but a flex ancestor with a forced full-viewport
        min-height doesn't fragment across printed pages cleanly — this is
        the outermost link in the chain described in DotMatrixInvoice.tsx's
        pagination comment. Without this reset here, no fix further down the
        tree can fully compensate.
      */}
      <body className="flex min-h-full print:block print:min-h-0">{children}</body>
    </html>
  );
}
