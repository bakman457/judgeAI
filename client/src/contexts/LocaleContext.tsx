import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "en" | "el";

export const LOCALE_STORAGE_KEY = "judge-ai-locale";

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "el" ? "el" : "en";
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      return normalizeLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Ignore storage restrictions
    }
    document.documentElement.lang = locale === "el" ? "el" : "en";
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale: (nextLocale: Locale) => setLocaleState(nextLocale),
    toggleLocale: () => setLocaleState(current => (current === "en" ? "el" : "en")),
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
