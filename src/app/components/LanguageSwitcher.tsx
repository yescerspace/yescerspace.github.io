import {
  Fragment,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  LOCALES,
  LOCALE_DISPLAY_LABELS,
  type Locale,
} from "../i18n/translations";
import { useLanguage } from "../context/LanguageContext";

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
      className="flex items-center gap-x-2 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-foreground sm:text-[0.68rem]"
      aria-label={messages.aria.languageSwitcher}
    >
      {LOCALES.map((code, index) => {
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
                className={
                  active
                    ? "after:absolute after:left-0 after:right-0 after:top-full after:mt-0.5 after:h-px after:rounded-full after:bg-foreground/35 after:content-['']"
                    : undefined
                }
              >
                {LOCALE_DISPLAY_LABELS[code]}
              </span>
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
}
