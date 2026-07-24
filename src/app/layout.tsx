import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Inter, Cormorant_Garamond } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Arva editorial pairing — Inter (sans) + Cormorant Garamond (Reckless serif substitute).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-cormorant",
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
    <html lang="en" className={`${plusJakarta.variable} ${jetBrainsMono.variable} ${inter.variable} ${cormorant.variable}`}>
      <body className="bg-background text-on-background antialiased font-sans">
        {children}
      </body>
    </html>
  );
}