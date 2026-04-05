import type { GalleryCategory } from "../context/WorksCategoryContext";
import portfolioContentEn from "../data/portfolio-content-en.json";
import portfolioContentDe from "../data/portfolio-content-de.json";
import portfolioContentTr from "../data/portfolio-content-tr.json";
import { slugFromProjectKey } from "../utils/galleryProjectKey";

/**
 * **Single source of truth for all user-visible UI strings** (nav, layout, gallery chrome,
 * About/Contact, aria labels, locale switcher labels).
 * Portfolio project copy (EN / DE / TR): `portfolio-content-en.json`, `portfolio-content-de.json`, `portfolio-content-tr.json`.
 * Project list and file paths come from `gallery-manifest.json` + `public/` (see `galleryData.ts`).
 */
export type Locale = "en" | "de" | "tr";

/** Display and persistence order: EN → DE → TR */
export const LOCALES: Locale[] = ["en", "de", "tr"];

export const defaultLocale: Locale = "en";

export const LOCALE_STORAGE_KEY = "portfolio-locale";

export type CategoryMessages = { all: string } & Record<GalleryCategory, string>;

/** Keys: `categoryFolder/slug` (see gallery-manifest.json). */
export type PortfolioProjectCopy = {
  title: string;
  description: string;
  year: string;
  /** Comma-separated or free-text tool names (e.g. "Adobe", "Blender, Unity"). */
  tools: string;
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
  /** Short labels for the locale switcher (EN / DE / TR). */
  localeLabels: Record<Locale, string>;
  nav: {
    gallery: string;
    about: string;
    contact: string;
  };
  sidebar: {
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
    close: string;
    /** Alt text when an image fails to load (fallback UI). */
    imageErrorAlt: string;
  };
  about: {
    title: string;
    lead: string;
    p2: string;
    p3: string;
    skillsHeading: string;
    /** Skill / tool names shown as chips (localized where it makes sense). */
    skills: readonly string[];
  };
  contact: {
    title: string;
    headline: string;
    description: string;
    emailCta: string;
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
      out[key] = { title: "", description: "", year: "", tools: "" };
      continue;
    }
    const o = v as Record<string, unknown>;
    out[key] = {
      title: typeof o.title === "string" ? o.title : "",
      description: typeof o.description === "string" ? o.description : "",
      year: typeof o.year === "string" ? o.year : "",
      tools: typeof o.tools === "string" ? o.tools : "",
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
  Campaigns: "Campaigns",
  "3D Archive": "3D Archive",
  "2D Archive": "2D Archive",
};

/** About page skill chips — tool names; shared across locales. */
const ABOUT_SKILLS: readonly string[] = [
  "Figma",
  "Blender",
  "Unity",
  "AI-assisted Design",
  "TouchDesigner",
  "WebGL",
  "Three.js",
  "Cursor",
  "Substance Painter",
];

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
  localeLabels: {
    en: "EN",
    de: "DE",
    tr: "TR",
  },
  nav: {
    gallery: "GALLERY",
    about: "ABOUT",
    contact: "CONTACT",
  },
  sidebar: {
    portfolio: "Portfolio",
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
    exploreHint: "Drag to explore and choose",
    modalYear: "Year",
    modalToolsLabel: "Tools",
    modalProjectFallback: "Project",
    modalYearFallback: "—",
    backToGallery: "Back to gallery",
    close: "Close",
    imageErrorAlt: "Error loading image",
  },
  about: {
    title: "ABOUT",
    lead:
      "A multidisciplinary designer and creative technologist focused on interactive experiences, immersive systems, and physical-digital storytelling.",
    p2:
      "My practice explores how design can move beyond static visuals into responsive and experiential systems  where interaction, motion, and real-time technologies shape how people engage with digital environments. With a background in digital art and architectural thinking, I work across interaction design, real-time graphics, and experimental media to build systems that connect physical and digital spaces.",
    p3:
      "I am particularly interested in emerging technologies such as creative coding, real-time rendering, and AI-assisted design as tools for building new types of experiences rather than traditional outputs.",
    skillsHeading: "Skills & Tools",
    skills: ABOUT_SKILLS,
  },
  contact: {
    title: "CONTACT",
    headline: "Available for new opportunities!",
    description:
      "I design thoughtful visual systems and experiences that connect storytelling, aesthetics, and technology from brand and editorial work to real-time and interactive projects.",
    emailCta: "Email Me",
    rolesLine: "Freelance, contract, and full-time roles.",
    nameLabel: "Name",
    emailLabel: "Email",
    messageLabel: "Message",
    placeholderName: "Your name",
    placeholderEmail: "you@example.com",
    placeholderMessage: "Tell me about your project or role…",
    send: "Send message",
    formSubject: "Portfolio contact",
    noFormNote:
      "For now, email is the quickest way to get in touch. Use Email Me above.",
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
  localeLabels: {
    en: "EN",
    de: "DE",
    tr: "TR",
  },
  nav: {
    gallery: "GALERIE",
    about: "ÜBER MICH",
    contact: "KONTAKT",
  },
  sidebar: {
    portfolio: "Portfolio",
    taglineWorks:
      "Ein kreativer Spielraum für neue Tools, KI-gestützte Workflows und präzisen visuellen Craft.",
    taglineOther:
      "Multidisziplinäres Design und Creative Technology.",
  },
  categories: {
    all: "Alle",
    "Interactive / VR": "Interaktiv / VR",
    Motion: "Motion Design",
    Campaigns: "Kampagnen",
    "3D Archive": "3D-Archiv",
    "2D Archive": "2D-Archiv",
  },
  gallery: {
    exploreHint: "Ziehen zum Erkunden und Auswählen",
    modalYear: "Jahr",
    modalToolsLabel: "Tools",
    modalProjectFallback: "Projekt",
    modalYearFallback: "—",
    backToGallery: "Zurück zur Galerie",
    close: "Schließen",
    imageErrorAlt: "Bild konnte nicht geladen werden",
  },
  about: {
    title: "ÜBER MICH",
    lead:
      "Als multidisziplinärer Designer und Creative Technologist spezialisiere ich mich auf 3D-Visualisierung, interaktive Erlebnisse und experimentelles Design.",
    p2:
      "Mit einem Hintergrund in Architektur und digitaler Kunst erforsche ich die Schnittstelle von physischer und digitaler Welt durch immersive Installationen, Computational Design und moderne Rendering-Techniken.",
    p3:
      "Meine Arbeit verbindet klassische Designprinzipien mit Technologien wie KI, Echtzeit-Rendering und gestenbasierter Interaktion, um einzigartige visuelle Erlebnisse zu schaffen.",
    skillsHeading: "Skills & Tools",
    skills: ABOUT_SKILLS,
  },
  contact: {
    title: "KONTAKT",
    headline: "Offen für neue Möglichkeiten!",
    description:
      "Ich gestalte durchdachte visuelle Systeme und Erlebnisse, die Storytelling, Ästhetik und Technologie verbinden: von Marken- und Editorial-Arbeit bis zu Echtzeit- und interaktiven Projekten.",
    emailCta: "E-Mail schreiben",
    rolesLine: "Freelance, Festanstellung und Projektaufträge.",
    nameLabel: "Name",
    emailLabel: "E-Mail",
    messageLabel: "Nachricht",
    placeholderName: "Ihr Name",
    placeholderEmail: "sie@beispiel.de",
    placeholderMessage: "Erzählen Sie von Ihrem Projekt oder der Rolle…",
    send: "Nachricht senden",
    formSubject: "Portfolio Kontakt",
    noFormNote:
      "Vorerst ist E-Mail der schnellste Weg. Nutzen Sie oben E-Mail schreiben.",
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
  localeLabels: {
    en: "EN",
    de: "DE",
    tr: "TR",
  },
  nav: {
    gallery: "GALERİ",
    about: "HAKKINDA",
    contact: "İLETİŞİM",
  },
  sidebar: {
    portfolio: "Portfolyo",
    taglineWorks:
      "Yeni araçlar, yapay zekâ destekli iş akışları ve rafine görsel ustalık için yaratıcı bir oyun alanı.",
    taglineOther:
      "Disiplinlerarası tasarım ve yaratıcı teknoloji.",
  },
  categories: {
    all: "Tümü",
    "Interactive / VR": "Etkileşimli / VR",
    Motion: "Hareket",
    Campaigns: "Kampanyalar",
    "3D Archive": "3D arşiv",
    "2D Archive": "2D arşiv",
  },
  gallery: {
    exploreHint: "Keşfetmek ve seçmek için sürükleyin",
    modalYear: "Yıl",
    modalToolsLabel: "Araçlar",
    modalProjectFallback: "Proje",
    modalYearFallback: "—",
    backToGallery: "Galeriye dön",
    close: "Kapat",
    imageErrorAlt: "Görüntü yüklenemedi",
  },
  about: {
    title: "HAKKINDA",
    lead:
      "3D görselleştirme, etkileşimli deneyimler ve deneysel tasarım üzerine çalışan çok disiplinli bir tasarımcı ve yaratıcı teknologum.",
    p2:
      "Mimari ve dijital sanat geçmişimle, sürükleyici enstalasyonlar, hesaplamalı tasarım ve ileri düzey görüntüleme teknikleri aracılığıyla fiziksel ve dijital dünyaların kesişimini keşfediyorum.",
    p3:
      "Çalışmalarım geleneksel tasarım ilkelerini yapay zekâ, gerçek zamanlı görüntüleme ve jest tabanlı arayüzler gibi gelişen teknolojilerle birleştirerek özgün görsel deneyimler üretiyor.",
    skillsHeading: "Yetenekler ve araçlar",
    skills: ABOUT_SKILLS,
  },
  contact: {
    title: "İLETİŞİM",
    headline: "Yeni fırsatlara açığım!",
    description:
      "Hikâye anlatımı, estetik ve teknolojiyi bir araya getiren; marka ve yayın çalışmalarından gerçek zamanlı ve etkileşimli projelere uzanan düşünceli görsel sistemler ve deneyimler tasarlıyorum.",
    emailCta: "E-posta gönder",
    rolesLine: "Serbest, sözleşmeli ve tam zamanlı roller.",
    nameLabel: "Ad",
    emailLabel: "E-posta",
    messageLabel: "Mesaj",
    placeholderName: "Adınız",
    placeholderEmail: "ornek@e-posta.com",
    placeholderMessage: "Projeniz veya rol hakkında yazın…",
    send: "Mesaj gönder",
    formSubject: "Portfolyo iletişim",
    noFormNote:
      "Şimdilik en hızlı yol e-posta. Yukarıdaki E-posta gönder bağlantısını kullanın.",
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

export function readStoredLocale(): Locale {
  try {
    if (typeof window === "undefined") return defaultLocale;
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return defaultLocale;
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
export function portfolioProjectCopy(
  messages: TranslationMessages,
  projectKey: string,
): PortfolioProjectCopy {
  const slug = slugFromProjectKey(projectKey);
  const yearDash = messages.gallery?.modalYearFallback ?? "—";

  const p = messages.portfolio?.projects?.[projectKey];
  if (p) {
    const title = p.title?.trim() ?? "";
    const year = String(p.year ?? "").trim();
    const titleOut = title || slug;
    const yearOut = year || yearDash;
    if (import.meta.env?.DEV) {
      if (!title) {
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
