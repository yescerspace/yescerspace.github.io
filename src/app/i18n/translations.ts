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
    /** work/2 detail: ArtStation icon next to back (opens in new tab). */
    artStationAlbumAriaLabel: string;
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
  "3D Archive": "3D Archive",
  "2D Archive": "2D Archive",
  New: "New",
};

/** About page skill chips — tool names; shared across locales. */
const ABOUT_SKILLS: readonly string[] = [
  "Figma",
  "Blender",
  "Unity",
  "Unreal Engine",
  "AI-assisted Design",
  "Claude",
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
  nav: {
    gallery: "GALLERY",
    about: "ABOUT ME",
    contact: "CONNECT",
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
    exploreHint: "Drag, scroll or click.. You're in control!",
    modalYear: "Year",
    modalToolsLabel: "Tools",
    modalProjectFallback: "Project",
    modalYearFallback: "—",
    backToGallery: "Back to gallery",
    artStationAlbumAriaLabel: "ArtStation album (opens in new tab)",
    close: "Close",
    imageErrorAlt: "Error loading image",
  },
  about: {
    title: "ABOUT ME",
    lead:
      "A multidisciplinary designer, creative explorer and technologist focused on interactive experiences, immersive, and digital storytelling.",
    p2:
      "My artworks are going to reveal how design can move beyond static visuals into responsive and experiential systems where interaction, motion, and real-time technologies shape the engagement of people with digital environments.",
    p3:
      "With a bachelor in graphic design and master in 3D Animation for Film & Games. I work across motion design, real-time graphics, and experimental media to build interaction systems that connect physical and digital spaces. These days I am particularly interested in emerging technologies such as vibe coding, and AI-assisted design as tools for building new types of artworks rather than traditional outputs.",
    skillsHeading: "Skills & Tools",
    skills: ABOUT_SKILLS,
  },
  contact: {
    title: "CONNECT",
    headline:
      "Available for new opportunities!\nCurrently, email is the quickest way to get in touch. Use Email Me button below for business inquiries.",
    description: "",
    emailCta: "Email Me",
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
    gallery: "GALERIE",
    about: "ÜBER MICH",
    contact: "VERNETZEN",
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
    "3D Archive": "3D-Archiv",
    "2D Archive": "2D-Archiv",
    New: "Neu",
  },
  gallery: {
    exploreHint: "Ziehen, scrollen oder klicken.. Du hast die Kontrolle!",
    modalYear: "Jahr",
    modalToolsLabel: "Tools",
    modalProjectFallback: "Projekt",
    modalYearFallback: "—",
    backToGallery: "Zurück zur Galerie",
    artStationAlbumAriaLabel: "ArtStation-Album (öffnet in neuem Tab)",
    close: "Schließen",
    imageErrorAlt: "Bild konnte nicht geladen werden",
  },
  about: {
    title: "ÜBER MICH",
    lead:
      "Ein multidisziplinärer Designer, kreativer Entdecker und Technologe mit Fokus auf interaktive Erfahrungen, immersive Ansätze und digitales Storytelling.",
    p2:
      "Meine Arbeiten zeigen, wie Design über statische Visualität hinausgehen kann – hin zu responsiven und erfahrungsorientierten Systemen, in denen Interaktion, Bewegung und Echtzeittechnologien die Art und Weise prägen, wie Menschen mit digitalen Umgebungen interagieren.",
    p3:
      "Ich habe einen Bachelor Abschluss in Grafikdesign sowie einen Master in 3D-Animation für Film und Spiele. Ich arbeite an der Schnittstelle von Motion Design, Echtzeitgrafik und experimentellen Medien, um interaktive Systeme zu entwickeln, die physische und digitale Räume miteinander verbinden. Aktuell interessiere ich mich besonders für neue Technologien wie Vibe Coding und KI-gestütztes Design als Werkzeuge zur Entwicklung neuer künstlerischer Ausdrucksformen, jenseits traditioneller Ergebnisse.",
    skillsHeading: "Skills & Tools",
    skills: ABOUT_SKILLS,
  },
  contact: {
    title: "VERNETZEN",
    headline:
      "Offen für neue Möglichkeiten!\n\nDerzeit ist E-Mail der schnellste Weg. Nutzen Sie den Button „E-Mail schreiben“ unten für geschäftliche Anfragen.",
    description: "",
    emailCta: "E-Mail schreiben",
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
    gallery: "GALERİ",
    about: "HAKKIMDA",
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
    "3D Archive": "3D arşiv",
    "2D Archive": "2D arşiv",
    New: "Yeni",
  },
  gallery: {
    exploreHint: "Sürükle, kaydır veya tıkla.. Kontrol sende!",
    modalYear: "Yıl",
    modalToolsLabel: "Araçlar",
    modalProjectFallback: "Proje",
    modalYearFallback: "—",
    backToGallery: "Galeriye dön",
    artStationAlbumAriaLabel: "ArtStation albümü (yeni sekmede açılır)",
    close: "Kapat",
    imageErrorAlt: "Görüntü yüklenemedi",
  },
  about: {
    title: "HAKKIMDA",
    lead:
      "Etkileşimli deneyimler, dijital ve sürükleyici hikâye anlatımı üzerine odaklanan multidisipliner bir tasarımcı, yaratıcı bir keşifçi ve teknolojiyi yakından takip eden bir sanatçıyım.",
    p2:
      "Çalışmalarım, tasarımın statik görsellerin ötesine geçerek; etkileşim, hareket ve gerçek zamanlı teknolojilerin insanların dijital ortamlarla kurduğu etkileşimi nasıl şekillendirdiğini ortaya koymayı amaçlıyor.",
    p3:
      "Grafik tasarım alanında lisans ve Film & Oyunlar için 3D Animasyon alanında yüksek lisans derecesine sahip biri olarak motion design, real-time capturing ve deneysel medya alanlarında çalışarak fiziksel ve dijital mekânları birbirine bağlayan etkileşim sistemleri geliştiriyorum. Son zamanlarda özellikle vibe coding ve yapay zekâ destekli tasarımlara ve yeni teknolojilere ilgi duyuyorum; bu araçları geleneksel çıktılar üretmekten ziyade yeni tür sanatsal üretim biçimleri geliştiriyorum.",
    skillsHeading: "Yetenekler ve araçlar",
    skills: ABOUT_SKILLS,
  },
  contact: {
    title: "İLETİŞİM",
    headline:
      "Yeni fırsatlara açığım!\nŞu an en hızlı yol e-posta. İş birlikleri için E-posta gönderebilirsiniz.",
    description: "",
    emailCta: "E-posta gönder",
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
