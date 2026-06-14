import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LEGACY_LOCALE_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  defaultLocale,
  isLocale,
  resolveMessagesForLocale,
  type Locale,
  type TranslationMessages,
} from "../i18n/translations";
import {
  isEnabledSiteLocale,
  resolveEnabledSiteLocale,
} from "../config/locales";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  messages: TranslationMessages;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredSiteLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  try {
    const stored =
      window.localStorage.getItem(LOCALE_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY);
    if (isLocale(stored) && isEnabledSiteLocale(stored)) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return defaultLocale;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredSiteLocale());

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next) || !isEnabledSiteLocale(next)) {
      return;
    }
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      window.localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isLocale(locale) || !isEnabledSiteLocale(locale)) {
      setLocaleState(defaultLocale);
    }
  }, [locale]);

  /**
   * Keep `<html lang="en">` for typography/CSS (Turkish `text-transform` + `lang=tr` on the root
   * caused a flash: correct glyphs, then wrong after `lang` was set to `tr` in an effect).
   * Screen readers / content language: `data-locale` + `lang` on `<main>` in Layout.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = "en";
    document.documentElement.setAttribute(
      "data-locale",
      isLocale(locale) && isEnabledSiteLocale(locale)
        ? locale
        : defaultLocale,
    );
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => {
    const safeLocale = resolveEnabledSiteLocale(
      isLocale(locale) ? locale : defaultLocale,
    );
    return {
      locale: safeLocale,
      setLocale,
      messages: resolveMessagesForLocale(safeLocale),
    };
  }, [locale, setLocale]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
