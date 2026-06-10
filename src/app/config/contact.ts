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
export const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/cerryhub/";
export const GUMROAD_PROFILE_URL = "https://cerryhub.gumroad.com/";

export type ContactSocialLinkId =
  | "artstation"
  | "behance"
  | "instagram"
  | "gumroad";

export type ContactSocialAriaLabelKey =
  | "artStationProfileAriaLabel"
  | "behanceProfileAriaLabel"
  | "instagramProfileAriaLabel"
  | "gumroadProfileAriaLabel";

export type ContactSocialLinkDef = {
  readonly id: ContactSocialLinkId;
  readonly href: string;
  readonly label: string;
  readonly ariaLabelKey: ContactSocialAriaLabelKey;
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
  {
    id: "instagram",
    href: INSTAGRAM_PROFILE_URL,
    label: "instagram",
    ariaLabelKey: "instagramProfileAriaLabel",
    iconKey: "instagram",
  },
  {
    id: "gumroad",
    href: GUMROAD_PROFILE_URL,
    label: "Gumroad",
    ariaLabelKey: "gumroadProfileAriaLabel",
    iconKey: "gumroad",
  },
];
