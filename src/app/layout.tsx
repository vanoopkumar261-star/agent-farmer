import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

/**
 * Redesign v2 loads two faces, down from four.
 *
 * Inter is the whole product's voice (tailwind `font-sans`). JetBrains Mono
 * stays for the small uppercase metadata labels used across the cards.
 * Plus Jakarta Sans and Cormorant Garamond were dropped: Inter replaced the
 * former, and the latter was loaded but referenced by no component.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Terra-Tech OS - Agent Farmer",
  description: "Next-generation autonomous agricultural management system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable}`}>
      <body className="bg-background text-on-background antialiased font-sans">
        {children}
      </body>
    </html>
  );
}