"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_LOCALE, Locale, STORAGE_KEY } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

type Params = Record<string, string | number>;

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Params) => string;
};

const LanguageContext = createContext<Ctx>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k, params) => translate(DEFAULT_LOCALE, k, params),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (!saved) return;
      setLocaleState(saved);

      // Mirror the stored choice into the cookie that server components read
      // (`getServerLocale`). `setLocale` writes both, but anyone who chose a
      // language before that cookie existed has only the localStorage half —
      // and for them the server would render English prose under a Hindi UI.
      // Backfilling on mount repairs that silently, once.
      if (!document.cookie.includes(`${STORAGE_KEY}=${saved}`)) {
        document.cookie = `${STORAGE_KEY}=${saved};path=/;max-age=31536000`;
      }
    } catch {}
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.cookie = `${STORAGE_KEY}=${l};path=/;max-age=31536000`;
    } catch {}
  }, []);

  const t = useCallback((key: string, params?: Params) => translate(locale, key, params), [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  return useContext(LanguageContext);
}

/** Inline translated string — usable inside server components as a client island. */
export function T({ k, params }: { k: string; params?: Params }) {
  const { t } = useT();
  return <>{t(k, params)}</>;
}
