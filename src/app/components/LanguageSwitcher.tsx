import {
  Fragment,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  LOCALE_SWITCHER_ENTRIES,
  type Locale,
} from "../i18n/translations";
import { ENABLED_SITE_LOCALES } from "../config/locales";
import { useLanguage } from "../context/LanguageContext";

const VISIBLE_LOCALE_SWITCHER_ENTRIES = LOCALE_SWITCHER_ENTRIES.filter(({ code }) =>
  (ENABLED_SITE_LOCALES as readonly Locale[]).includes(code),
);

export function LanguageSwitcher() {
  const { locale, setLocale, messages } = useLanguage();

  const onKeyToggle = useCallback(
    (code: Locale, e: ReactKeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setLocale(code);
      }
    },
    [setLocale],
  );

  return (
    <nav
      lang="en"
      translate="no"
      className="notranslate flex shrink-0 items-center gap-x-2 text-[0.65rem] font-medium normal-case tracking-[0.14em] text-foreground sm:text-[0.68rem]"
      aria-label={messages.aria.languageSwitcher}
    >
      {VISIBLE_LOCALE_SWITCHER_ENTRIES.map(({ code, label, flag }, index) => {
        const active = locale === code;
        return (
          <Fragment key={code}>
            {index > 0 ? (
              <span
                className="select-none text-muted-foreground/80"
                style={{ opacity: 0.45 }}
                aria-hidden
              >
                /
              </span>
            ) : null}
            <span
              role="button"
              tabIndex={0}
              onClick={() => setLocale(code)}
              onKeyDown={(e) => onKeyToggle(code, e)}
              className={`relative cursor-pointer select-none outline-none transition-[opacity,color] duration-200 ease-out focus-visible:ring-1 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                active
                  ? "font-bold text-foreground opacity-100"
                  : "font-medium text-muted-foreground opacity-[0.5] hover:text-foreground hover:opacity-[0.72]"
              } `}
            >
              <span
                className={`inline-flex items-center gap-1 ${
                  active
                    ? "after:absolute after:left-0 after:right-0 after:top-full after:mt-0.5 after:h-px after:rounded-full after:bg-foreground/35 after:content-['']"
                    : undefined
                }`}
              >
                {label}
                {flag ? (
                  <span className="text-[0.92em] leading-none" aria-hidden>
                    {flag}
                  </span>
                ) : null}
              </span>
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
}
