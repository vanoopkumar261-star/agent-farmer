import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { getServerTheme } from "@/lib/theme/serverTheme";
import { DEFAULT_THEME, STORAGE_KEY } from "@/lib/theme/config";
import { getServerLocale } from "@/lib/i18n/serverLocale";
import ThemeProvider from "@/components/theme/ThemeProvider";

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

/**
 * Applies the theme before the first paint.
 *
 * The server has already rendered `data-theme` from the cookie, so for anyone
 * who has used the switch this script finds nothing to do. It exists for the
 * two cases the cookie cannot cover:
 *
 *   - a visitor whose browser cleared cookies but kept localStorage, which is
 *     the same backfill LanguageProvider does for `af_locale`;
 *   - a first visit, where it plants the cookie so the very next request is
 *     server-correct and this script becomes a no-op forever after.
 *
 * The cookie is read FIRST and wins, because the cookie is what the server
 * just rendered against — preferring localStorage would reintroduce the
 * mismatch this script exists to prevent. Everything is wrapped in try/catch:
 * in a locked-down browser a storage read throws, and a theme is not worth a
 * blank page.
 */
const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${STORAGE_KEY}=([^;]*)/);var t=m&&m[1];if(t!=='light'&&t!=='dark'){t=localStorage.getItem('${STORAGE_KEY}');}if(t!=='light'&&t!=='dark'){t='${DEFAULT_THEME}';}document.documentElement.dataset.theme=t;if(!m){document.cookie='${STORAGE_KEY}='+t+';path=/;max-age=31536000;samesite=lax';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = getServerTheme();
  // The app speaks nine languages; <html lang> claimed English for all of
  // them, which is what a screen reader and a translation prompt both read.
  const locale = getServerLocale();

  return (
    // suppressHydrationWarning covers exactly one thing: THEME_SCRIPT mutating
    // data-theme on this element before React hydrates. It does not mask
    // mismatches anywhere in the component tree.
    <html
      lang={locale}
      data-theme={theme}
      suppressHydrationWarning
      className={`${inter.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      {/* af-bg/af-ink, not the old literal Material pair: the body was painting
          #f8f9ff regardless of the token palette, so overscroll areas and any
          page shorter than the viewport would stay near-white in dark mode. */}
      <body className="bg-af-bg text-af-ink antialiased font-sans">
        {/* Mounted here, not in the dashboard shell: the switch has to work on
            the landing page and /login, which a farmer sees before they have
            an account. The dashboard layer adds the farmer id on top. */}
        <ThemeProvider initial={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}