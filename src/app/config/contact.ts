/**
 * Contact integration (email + Formspree endpoint), not UI copy.
 * User-visible strings live in `src/app/i18n/translations.ts` → `contact`.
 * Copy `.env.example` to `.env` and set values.
 */
export const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() ||
  "yesimcerenunal@gmail.com";

/** Full URL, e.g. https://formspree.io/f/abcdefgh, create at https://formspree.io */
export const FORMSPREE_ENDPOINT = (
  import.meta.env.VITE_FORMSPREE_ENDPOINT as string | undefined
)?.trim();

export const ARTSTATION_PROFILE_URL = "https://www.artstation.com/yesimceren";
export const BEHANCE_PROFILE_URL = "https://www.behance.net/yesimceren";

/** Visible label + aria key live in i18n; add Patreon/Gumroad here when ready. */
export type ContactSocialLinkId = "artstation" | "behance";

export type ContactSocialLinkDef = {
  readonly id: ContactSocialLinkId;
  readonly href: string;
  readonly label: string;
  readonly ariaLabelKey: "artStationProfileAriaLabel" | "behanceProfileAriaLabel";
  /** Bundled in Contact.tsx — kept here for future Patreon/Gumroad rows. */
  readonly iconKey: ContactSocialLinkId;
};

export const CONTACT_SOCIAL_LINKS: readonly ContactSocialLinkDef[] = [
  {
    id: "artstation",
    href: ARTSTATION_PROFILE_URL,
    label: "ArtStation",
    ariaLabelKey: "artStationProfileAriaLabel",
    iconKey: "artstation",
  },
  {
    id: "behance",
    href: BEHANCE_PROFILE_URL,
    label: "Behance",
    ariaLabelKey: "behanceProfileAriaLabel",
    iconKey: "behance",
  },
];
