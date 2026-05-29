/**
 * Contact integration (email + Formspree endpoint), not UI copy.
 * User-visible strings live in `src/app/i18n/translations.ts` → `contact`.
 * Copy `.env.example` to `.env` and set values.
 */
export const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() ||
  "yesimcerenn@gmail.com";

/** Full URL, e.g. https://formspree.io/f/abcdefgh, create at https://formspree.io */
export const FORMSPREE_ENDPOINT = (
  import.meta.env.VITE_FORMSPREE_ENDPOINT as string | undefined
)?.trim();

export const ARTSTATION_PROFILE_URL = "https://www.artstation.com/yesimceren";
export const BEHANCE_PROFILE_URL = "https://www.behance.net/yesimceren";
