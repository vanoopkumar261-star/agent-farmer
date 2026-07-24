"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_LOCALE, Locale, STORAGE_KEY } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<Ctx>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k) => translate(DEFAULT_LOCALE, k),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved) setLocaleState(saved);
    } catch {}
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.cookie = `${STORAGE_KEY}=${l};path=/;max-age=31536000`;
    } catch {}
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

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
export function T({ k }: { k: string }) {
  const { t } = useT();
  return <>{t(k)}</>;
}
