import type { Metadata, Viewport } from "next";
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
  title: {
    default: "Singapore Major Pick'em",
    template: "%s · Pick'em",
  },
  description: "Private Swiss-stage pick'em for the PGL Singapore 2026 CS2 Major.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

const scrollbarCss = `
html {
  scrollbar-width: thin;
  scrollbar-color: rgba(244, 244, 245, 0.28) transparent;
}
*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background-color: rgba(244, 244, 245, 0.28);
  border-radius: 999px;
}
*::-webkit-scrollbar-thumb:hover {
  background-color: rgba(244, 244, 245, 0.48);
}
*::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}
*::-webkit-scrollbar-corner {
  background: transparent;
}
.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <style dangerouslySetInnerHTML={{ __html: scrollbarCss }} />
        {children}
      </body>
    </html>
  );
}
