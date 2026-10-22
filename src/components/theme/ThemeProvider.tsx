"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  STORAGE_KEY,
  isTheme,
  themeCookie,
  type Theme,
} from "@/lib/theme/config";

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<Ctx>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * The app's theme, held once for the whole tree.
 *
 * Mounted in the root layout rather than the dashboard shell, because the
 * switch has to work on the landing page and /login too — the places a farmer
 * sees before they have an account.
 *
 * Two deliberate differences from LanguageProvider, which is otherwise the
 * model for this file:
 *
 *   1. `initial` is seeded from the server. LanguageProvider starts at the
 *      default and corrects itself in an effect, which is precisely the flash
 *      we are here to prevent — and it also means anything reading the context
 *      during the first render (chart colours, the hero video source) would
 *      read the wrong value and then swap.
 *
 *   2. `setTheme` writes the DOM attribute itself. The repaint must not wait
 *      for React, a router refresh or a navigation; flipping the attribute is
 *      what makes the switch feel instant.
 *
 * It knows nothing about accounts on purpose. The farmer is only known inside
 * the dashboard, so the Supabase half lives in ThemeAccountSync, mounted
 * there — this provider stays usable on pages where nobody is signed in.
 */
export default function ThemeProvider({
  initial,
  children,
}: {
  /** From `getServerTheme()` — the cookie the server just rendered against. */
  initial: Theme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initial);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      document.documentElement.dataset.theme = next;
      localStorage.setItem(STORAGE_KEY, next);
      document.cookie = themeCookie(next);
    } catch {
      /* private mode or blocked storage — the attribute above already took */
    }
  }, []);

  const toggle = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme, setTheme]
  );

  // Repair pass, for the one case the server cannot see: a browser that kept
  // localStorage but lost the cookie. Mirrors LanguageProvider's backfill.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isTheme(stored) && stored !== theme) setTheme(stored);
      else if (!isTheme(stored)) localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
    // Once, on mount. Later changes come through setTheme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
