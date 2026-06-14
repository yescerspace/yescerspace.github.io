import type { Locale } from "../i18n/translations";

/**
 * Locales shown in the header switcher and selectable on the live site.
 * Turkish copy stays in the repo — to bring TR back, add `"tr"` below:
 * `["en", "de", "tr"]`
 */
export const ENABLED_SITE_LOCALES: readonly Locale[] = ["en", "de"];

export function isEnabledSiteLocale(
  value: string | null | undefined,
): value is Locale {
  return (ENABLED_SITE_LOCALES as readonly string[]).includes(value ?? "");
}

export function resolveEnabledSiteLocale(locale: Locale): Locale {
  return isEnabledSiteLocale(locale) ? locale : "en";
}
