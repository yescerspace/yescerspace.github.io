import type { GalleryCategory } from "../context/WorksCategoryContext";
import portfolioContentEn from "../data/portfolio-content-en.json";
import portfolioContentDe from "../data/portfolio-content-de.json";
import portfolioContentTr from "../data/portfolio-content-tr.json";
import { slugFromProjectKey } from "../utils/galleryProjectKey";

/**
 * **Single source of truth for all user-visible UI strings** (nav, layout, gallery chrome,
 * About/Contact, aria labels, locale switcher labels).
 * Portfolio project copy (EN / DE / TR): `portfolio-content-en.json`, `portfolio-content-de.json`, `portfolio-content-tr.json`.
 * English UI uses `en` below; project titles/descriptions for locale `en` come **only** from `portfolio-content-en.json` (`portfolioEn`).
 * Project list and file paths come from `gallery-manifest.json` + `public/` (see `galleryData.ts`).
 */
export type Locale = "en" | "de" | "tr";

/**
 * Header language switcher: fixed order and labels (never passed through UI translation).
 * Single tuple avoids lookup bugs; use {@link LOCALES} for locale codes only.
 */
export const LOCALE_SWITCHER_ENTRIES: readonly {
  code: Locale;
  label: string;
}[] = [
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
  { code: "tr", label: "TR" },
];

/** Display and persistence order: EN → DE → TR */
export const LOCALES: Locale[] = LOCALE_SWITCHER_ENTRIES.map((e) => e.code);

/**
 * Short codes for the language switcher only — always EN / DE / TR (never localized),
 * so the three options stay unambiguous regardless of the active UI language.
 */
export const LOCALE_DISPLAY_LABELS: Record<Locale, string> =
  LOCALE_SWITCHER_ENTRIES.reduce(
    (acc, e) => {
      acc[e.code] = e.label;
      return acc;
    },
    {} as Record<Locale, string>,
  );

export const defaultLocale: Locale = "en";

/** Current persisted locale (v2). */
export const LOCALE_STORAGE_KEY = "portfolio-locale-v2";

/** Legacy key — removed when persisting locale from the language switcher. */
export const LEGACY_LOCALE_STORAGE_KEY = "portfolio-locale";

export type CategoryMessages = { all: string } & Record<GalleryCategory, string>;

/** Keys: `categoryFolder/slug` (see gallery-manifest.json). */
export type PortfolioProjectCopy = {
  title: string;
  description: string;
  year: string;
  /** Comma-separated or free-text tool names (e.g. "Adobe", "Blender, Unity"). */
  tools: string;
  /**
   * Gallery nav / modal tag — canonical English labels only (`GALLERY_CATEGORIES`).
   * Set in **`portfolio-content-en.json`**; overrides `gallery-manifest.json` `category` when present.
   */
  category?: string;
};

export type TranslationMessages = {
  /** Shell: document title, header brand, optional non-route UI. */
  layout: {
    documentTitle: string;
    brandName: string;
    gestureControlOff: string;
  };
  /** Accessibility labels (not visible copy). */
  aria: {
    primaryNavigation: string;
    workCategoriesNavigation: string;
    languageSwitcher: string;
  };
  nav: {
    gallery: string;
    about: string;
    contact: string;
  };
  sidebar: {
    /** Header line under brand (e.g. PORTFOLIO). */
    portfolio: string;
    taglineWorks: string;
    taglineOther: string;
  };
  categories: CategoryMessages;
  gallery: {
    exploreHint: string;
    modalYear: string;
    /** Label above the tools line in the project detail modal (shown with a trailing colon in UI). */
    modalToolsLabel: string;
    /** Title when no `portfolio.projects[projectKey]` entry exists (never show raw `projectKey`). */
    modalProjectFallback: string;
    /** Year line when entry is missing or `year` is empty in copy (never use manifest). */
    modalYearFallback: string;
    backToGallery: string;
    /** Detail modal: copy or system share the deep link (`?project=…`). */
    modalShare: string;
    modalShareAriaLabel: string;
    modalShareCopied: string;
    /** Heart toggle; pair with `aria-pressed` on the control. */
    modalFavoriteAriaLabel: string;
    /** work/2 detail: ArtStation icon next to back (opens in new tab). */
    artStationAlbumAriaLabel: string;
    close: string;
    /** Alt text when an image fails to load (fallback UI). */
    imageErrorAlt: string;
  };
  about: {
    lead: string;
    p2: string;
    p3: string;
    p4: string;
  };
  contact: {
    headline: string;
    description: string;
    emailCta: string;
    /** Between mailto CTA and address: "or" / "oder" / "veya". */
    emailInlineOr: string;
    copyEmail: string;
    emailCopiedFeedback: string;
    artStationProfileAriaLabel: string;
    behanceProfileAriaLabel: string;
    rolesLine: string;
    nameLabel: string;
    emailLabel: string;
    messageLabel: string;
    placeholderName: string;
    placeholderEmail: string;
    placeholderMessage: string;
    send: string;
    formSubject: string;
    noFormNote: string;
  };
  portfolio: {
    projects: Record<string, PortfolioProjectCopy>;
  };
};

/** Keys = `categoryFolder/slug` (see gallery-manifest). Same keys in all three JSON files. */
function normalizePortfolioContentJson(
  raw: unknown,
): Record<string, PortfolioProjectCopy> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, PortfolioProjectCopy> = {};
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) {
      out[key] = {
        title: "",
        description: "",
        year: "",
        tools: "",
      };
      continue;
    }
    const o = v as Record<string, unknown>;
    const category =
      typeof o.category === "string" && o.category.trim() !== ""
        ? o.category.trim()
        : undefined;
    out[key] = {
      title: typeof o.title === "string" ? o.title : "",
      description: typeof o.description === "string" ? o.description : "",
      year: typeof o.year === "string" ? o.year : "",
      tools: typeof o.tools === "string" ? o.tools : "",
      ...(category !== undefined ? { category } : {}),
    };
  }
  return out;
}

const portfolioEn = normalizePortfolioContentJson(portfolioContentEn);
const portfolioDe = normalizePortfolioContentJson(portfolioContentDe);
const portfolioTr = normalizePortfolioContentJson(portfolioContentTr);

const categoryEn: Record<GalleryCategory, string> = {
  "Interactive / VR": "Interactive / VR",
  Motion: "Motion",
  "3D Archive": "3D Archive",
  "2D Archive": "2D Archive",
  New: "New",
};

const en: TranslationMessages = {
  layout: {
    documentTitle: "YESIM CEREN ÜNAL Portfolio",
    brandName: "YESIM CEREN ÜNAL",
    gestureControlOff: "Turn off gesture control",
  },
  aria: {
    primaryNavigation: "Primary",
    workCategoriesNavigation: "Work categories",
    languageSwitcher: "Language",
  },
  nav: {
    gallery: "SPACE",
    about: "ABOUT ME",
    contact: "CONNECT",
  },
  sidebar: {
    portfolio: "PORTFOLIO",
    taglineWorks:
      "A creative playground for art, code, and interactive experience.",
    taglineOther:
      "A creative technologist focused on interactive design and real-time experiences.",
  },
  categories: {
    all: "All",
    ...categoryEn,
  },
  gallery: {
    exploreHint: "Drag, scroll.. You're in control!",
    modalYear: "Year",
    modalToolsLabel: "Tools",
    modalProjectFallback: "Project",
    modalYearFallback: "—",
    backToGallery: "Back",
    modalShare: "Share",
    modalShareAriaLabel: "Share a link to this project",
    modalShareCopied: "Link copied",
    modalFavoriteAriaLabel: "Favorite",
    artStationAlbumAriaLabel: "ArtStation album (opens in new tab)",
    close: "Close",
    imageErrorAlt: "Error loading image",
  },
  about: {
    lead:
      "Hi, I'm Ceren, a multidisciplinary designer working across 3D, motion, and interaction. I'm curious by nature, I enjoy learning, and I try to constantly improve everything rather than leaving things as they are.",
    p2:
      "It all started with a bachelor's degree in graphic design. Designs were supposed to stay static, but that didn't last long. I'm drawn to motion and interaction, so over time my work evolved into responsive, immersive experiences that pull people in.",
    p3:
      "Previously, I worked in the game industry from 2019 to 2024, specializing in marketing assets, 3D character art, and environment design for five years. By combining this experience with a master's degree in 3D animation, I refined my production methods and expanded my approach to working with creative tools. After gaining experience with VR systems, game development, and simulations, I became increasingly interested in how rhythm, movement, and interaction shape digital experiences, shifting my focus from static outputs toward evolving systems.",
    p4:
      "Recently, my focus has been on building more code-based mediums such as audio-reactive visuals, immersive visuals, and creating experiences that feel alive. I'm still exploring, still experimenting, and still making mistakes.",
  },
  contact: {
    headline:
      "Did you hear my heartbeat while viewing my artworks?\n\nIf so, let's connect now! Email is the quickest way to get in touch.",
    description: "",
    emailCta: "Email Me",
    emailInlineOr: "or",
    copyEmail: "Copy Email",
    emailCopiedFeedback: "Copied!",
    artStationProfileAriaLabel: "ArtStation profile (opens in new tab)",
    behanceProfileAriaLabel: "Behance profile (opens in new tab)",
    rolesLine: "",
    nameLabel: "Name",
    emailLabel: "Email",
    messageLabel: "Message",
    placeholderName: "Your name",
    placeholderEmail: "you@example.com",
    placeholderMessage: "Tell me about your project or role…",
    send: "Send message",
    formSubject: "Portfolio contact",
    noFormNote: "",
  },
  portfolio: {
    projects: portfolioEn,
  },
};

const de: TranslationMessages = {
  layout: {
    documentTitle: "YESIM CEREN ÜNAL Portfolio",
    brandName: "YESIM CEREN ÜNAL",
    gestureControlOff: "Gestensteuerung ausschalten",
  },
  aria: {
    primaryNavigation: "Hauptnavigation",
    workCategoriesNavigation: "Werkkategorien",
    languageSwitcher: "Sprache",
  },
  nav: {
    gallery: "RAUM",
    about: "ÜBER MICH",
    contact: "VERNETZEN",
  },
  sidebar: {
    portfolio: "PORTFOLIO",
    taglineWorks:
      "Ein kreativer Spielraum für neue Tools, KI-gestützte Workflows und präzisen visuellen Craft.",
    taglineOther:
      "Multidisziplinäres Design und Creative Technology.",
  },
  categories: {
    all: "Alle",
    "Interactive / VR": "Interaktiv / VR",
    Motion: "BEWEGTBILD",
    "3D Archive": "3D-Archiv",
    "2D Archive": "2D-Archiv",
    New: "Neu",
  },
  gallery: {
    exploreHint: "Scrollen, ziehen… deine Kontrolle, einfach volle!",
    modalYear: "Jahr",
    modalToolsLabel: "Tools",
    modalProjectFallback: "Projekt",
    modalYearFallback: "—",
    backToGallery: "Zurück",
    modalShare: "Teilen",
    modalShareAriaLabel: "Link zu diesem Projekt teilen",
    modalShareCopied: "Link kopiert",
    modalFavoriteAriaLabel: "Favorit",
    artStationAlbumAriaLabel: "ArtStation-Album (öffnet in neuem Tab)",
    close: "Schließen",
    imageErrorAlt: "Bild konnte nicht geladen werden",
  },
  about: {
    lead:
      "Hallo, ich bin Ceren, eine multidisziplinäre Designerin mit Schwerpunkt auf 3D, Motion und Interaktion. Ich bin von Natur aus neugierig, lerne gerne und versuche ständig, Dinge weiterzuentwickeln, anstatt sie so zu lassen, wie sie sind.",
    p2:
      "Alles begann mit einem Bachelorabschluss in Grafikdesign. Designs sollten eigentlich statisch bleiben, aber das hielt nicht lange an. Ich fühlte mich schon immer zu Bewegung und Interaktion hingezogen, sodass sich meine Arbeit mit der Zeit zu responsiven, immersiven Erfahrungen entwickelte, die Menschen hineinziehen.",
    p3:
      "Zuvor arbeitete ich von 2019 bis 2024 in der Spielebranche und spezialisierte mich über fünf Jahre hinweg auf Marketing-Assets, 3D-Character-Art und Environment Design. Durch die Verbindung meines Hintergrunds mit einem Masterabschluss in 3D-Animation konnte ich meine Produktionsmethoden verfeinern und meine Arbeitsweise mit digitalen Tools erweitern. Nachdem ich Erfahrungen mit VR-Systemen, Game Development und Simulationen gesammelt hatte, begann ich mich stärker darauf zu konzentrieren, wie Rhythmus, Bewegung und Interaktion digitale Erfahrungen formen, und verlagerte meinen Fokus von statischen Ergebnissen hin zu sich entwickelnden Systemen.",
    p4:
      "In letzter Zeit beschäftige ich mich verstärkt mit codebasierten Medien wie audioreaktiven Visuals, immersiven Visuals und der Gestaltung von Erfahrungen, die sich lebendig anfühlen. Ich entdecke weiterhin Neues, experimentiere weiter und mache immer noch Fehler.",
  },
  contact: {
    headline:
      "Haben Sie meinen Herzschlag gehört, während Sie meine Arbeiten angesehen haben?\n\nWenn ja, lassen Sie uns jetzt in Kontakt treten! E-Mail ist der schnellste Weg, mich zu erreichen.",
    description: "",
    emailCta: "E-Mail schreiben",
    emailInlineOr: "oder",
    copyEmail: "E-Mail kopieren",
    emailCopiedFeedback: "Kopiert!",
    artStationProfileAriaLabel: "ArtStation-Profil (öffnet in neuem Tab)",
    behanceProfileAriaLabel: "Behance-Profil (öffnet in neuem Tab)",
    rolesLine: "",
    nameLabel: "Name",
    emailLabel: "E-Mail",
    messageLabel: "Nachricht",
    placeholderName: "Ihr Name",
    placeholderEmail: "sie@beispiel.de",
    placeholderMessage: "Erzählen Sie von Ihrem Projekt oder der Rolle…",
    send: "Nachricht senden",
    formSubject: "Portfolio Kontakt",
    noFormNote: "",
  },
  portfolio: {
    projects: portfolioDe,
  },
};

const tr: TranslationMessages = {
  layout: {
    documentTitle: "YESIM CEREN ÜNAL Portfolio",
    brandName: "YESIM CEREN ÜNAL",
    gestureControlOff: "Jest kontrolünü kapat",
  },
  aria: {
    primaryNavigation: "Birincil gezinme",
    workCategoriesNavigation: "Çalışma kategorileri",
    languageSwitcher: "Dil",
  },
  nav: {
    gallery: "ALAN",
    about: "HAKKIMDA",
    contact: "İLETİŞİM",
  },
  sidebar: {
    portfolio: "PORTFOLYO",
    taglineWorks:
      "Yeni araçlar, yapay zekâ destekli iş akışları ve rafine görsel ustalık için yaratıcı bir oyun alanı.",
    taglineOther:
      "Disiplinlerarası tasarım ve yaratıcı teknoloji.",
  },
  categories: {
    all: "Tümü",
    "Interactive / VR": "Etkileşimli / VR",
    Motion: "Hareket",
    "3D Archive": "3D arşiv",
    "2D Archive": "2D arşiv",
    New: "Yeni",
  },
  gallery: {
    exploreHint: "Kaydır, sürükle.. kontrol sende!",
    modalYear: "Yıl",
    modalToolsLabel: "Araçlar",
    modalProjectFallback: "Proje",
    modalYearFallback: "—",
    backToGallery: "Geri",
    modalShare: "Paylaş",
    modalShareAriaLabel: "Bu projeye giden bağlantıyı paylaş",
    modalShareCopied: "Bağlantı kopyalandı",
    modalFavoriteAriaLabel: "Favori",
    artStationAlbumAriaLabel: "ArtStation albümü (yeni sekmede açılır)",
    close: "Kapat",
    imageErrorAlt: "Görüntü yüklenemedi",
  },
  about: {
    lead:
      "Merhaba, ben Ceren. 3D, motion ve etkileşim alanlarında çalışan multidisipliner bir tasarımcıyım. Meraklıyım, öğrenmeyi seviyorum ve bir şeyleri olduğu gibi bırakmak yerine sürekli geliştirmeye çalışıyorum.",
    p2:
      "Her şey grafik tasarım lisansıyla başladı. Tasarımların sabit kalması gerekiyordu ama bu çok uzun sürmedi. Hareket ve etkileşime her zaman ilgim vardı, bu yüzden zamanla işlerim insanı içine çeken immersif deneyimlere dönüştü.",
    p3:
      "Daha önce, 2019–2024 yılları arasında oyun sektöründe çalıştım ve beş yıl boyunca pazarlama materyalleri, 3D karakter tasarımı ve çevre tasarımı alanlarında uzmanlaştım. Deneyimlerimi 3D animasyon alanındaki yüksek lisansımla birleştirerek üretim yöntemlerimi geliştirme ve araçlarla çalışma biçimimi genişletme fırsatı buldum. VR sistemleri, oyun geliştirme ve simülasyonlar üzerine deneyim kazandıktan sonra günümüzde ritim, hareket ve etkileşimin dijital deneyimleri nasıl şekillendirdiğine daha fazla odaklanmaya başladım ve statik çıktılardan evrilen sistemlere yöneldim.",
    p4:
      "Son zamanlarda odağım; ses tepkili görseller, immersif görseller ve canlı hissettiren deneyimler gibi daha kod tabanlı mecralar üretmek üzerine yoğunlaşıyor. Hâlâ keşfediyor, hâlâ deniyor ve hâlâ hata yapıyorum.",
  },
  contact: {
    headline:
      "Çalışmalarımı incelerken kalp atışlarımı duydunuz mu?\n\nEğer öyleyse, hadi iletişime geçelim! Bana ulaşmanın en hızlı yolu şimdilik e-posta.",
    description: "",
    emailCta: "E-posta gönder",
    emailInlineOr: "veya",
    copyEmail: "E-postayı kopyala",
    emailCopiedFeedback: "Kopyalandı!",
    artStationProfileAriaLabel: "ArtStation profili (yeni sekmede açılır)",
    behanceProfileAriaLabel: "Behance profili (yeni sekmede açılır)",
    rolesLine: "",
    nameLabel: "Ad",
    emailLabel: "E-posta",
    messageLabel: "Mesaj",
    placeholderName: "Adınız",
    placeholderEmail: "ornek@e-posta.com",
    placeholderMessage: "Projeniz veya rol hakkında yazın…",
    send: "Mesaj gönder",
    formSubject: "Portfolyo iletişim",
    noFormNote: "",
  },
  portfolio: {
    projects: portfolioTr,
  },
};

export const translations: Record<Locale, TranslationMessages> = {
  en,
  de,
  tr,
};

/** Safe lookup for bootstrap / runtime; invalid or missing locale → English. */
export function resolveMessagesForLocale(
  locale: string | undefined | null,
): TranslationMessages {
  const loc = isLocale(locale) ? locale : defaultLocale;
  const msgs = translations[loc] ?? translations[defaultLocale];
  return msgs;
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "de" || value === "tr";
}

/** Resolve canonical English category from data to localized label */
export function localizedCategory(
  messages: TranslationMessages,
  canonical: string,
): string {
  const v = messages.categories?.[canonical as GalleryCategory];
  return v !== undefined ? v : canonical;
}

/**
 * Resolves portfolio copy for the current locale.
 * Lookup is a plain object get: `messages.portfolio.projects[projectKey]` — must match
 * `projectKeyFromManifestEntry` / `gallery-manifest.json` keys (see `galleryProjectKey.ts`).
 */
/** Strip EN draft marker (` … --` at end of title) so modals never show the raw suffix. */
function stripPortfolioTitleDraftSuffix(title: string): string {
  return title.replace(/\s*--\s*$/, "").trim();
}

export function portfolioProjectCopy(
  messages: TranslationMessages,
  projectKey: string,
): PortfolioProjectCopy {
  const slug = slugFromProjectKey(projectKey);
  const yearDash = messages.gallery?.modalYearFallback ?? "—";

  const p = messages.portfolio?.projects?.[projectKey];
  if (p) {
    const rawTitle = p.title?.trim() ?? "";
    const title = stripPortfolioTitleDraftSuffix(rawTitle);
    const year = String(p.year ?? "").trim();
    const titleOut = title || slug;
    const yearOut = year || yearDash;
    if (import.meta.env?.DEV) {
      if (!title && !rawTitle) {
        console.warn(
          `[portfolio] Empty title — using slug fallback | projectKey=${JSON.stringify(projectKey)} | slug=${JSON.stringify(slug)}`,
        );
      }
      if (!year) {
        console.warn(
          `[portfolio] Empty year — using "—" | projectKey=${JSON.stringify(projectKey)}`,
        );
      }
    }
    return {
      title: titleOut,
      description: p.description ?? "",
      year: yearOut,
      tools: (p.tools ?? "").trim(),
    };
  }
  if (import.meta.env?.DEV) {
    const available = Object.keys(messages.portfolio?.projects ?? {});
    console.error(
      `[portfolio] PROJECT KEY MISMATCH: expected=${JSON.stringify(projectKey)} (portfolio.projects lookup) | actual=missing — no entry for this key.`,
    );
    console.error(
      "[portfolio] translation keys (sample):",
      available.slice(0, 8),
      "| total:",
      available.length,
    );
    for (const candidate of available) {
      if (candidate.length !== projectKey.length) continue;
      if (candidate === projectKey) continue;
      const diff: number[] = [];
      for (let i = 0; i < projectKey.length; i++) {
        if (candidate.charCodeAt(i) !== projectKey.charCodeAt(i)) {
          diff.push(i);
        }
      }
      if (diff.length <= 4 && diff.length > 0) {
        console.error("[portfolio] Similar key (char diff at indices):", {
          candidate,
          projectKey,
          indices: diff,
        });
      }
    }
  }
  return {
    title: slug,
    description: "",
    year: yearDash,
    tools: "",
  };
}

/** Explicit locale + key lookup (same data as `portfolioProjectCopy(translations[locale], projectKey)`). */
export function getPortfolioProjectCopy(
  locale: Locale,
  projectKey: string,
): PortfolioProjectCopy {
  return portfolioProjectCopy(resolveMessagesForLocale(locale), projectKey);
}
