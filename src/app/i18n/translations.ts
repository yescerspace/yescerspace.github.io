import type { GalleryCategory } from "../context/WorksCategoryContext";

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
};

export type TranslationMessages = {
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
    backToGallery: string;
    close: string;
  };
  about: {
    title: string;
    lead: string;
    p2: string;
    p3: string;
    skillsHeading: string;
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

/**
 * Detail modal copy per project. Keys must match `categoryFolder/slug` in
 * `gallery-manifest.json` (see `galleryData.ts`). All locales should list the same keys.
 */
const portfolioProjectsEn: Record<string, PortfolioProjectCopy> = {
  "interactive-vr/Cozy Experience": {
    title: "Cozy Experience",
    description:
      "An intimate interactive study of comfort, scale, and presence—built as a small, warm space you can explore.",
    year: "2026",
  },
  "interactive-vr/VR Experience": {
    title: "VR Experience",
    description:
      "Immersive VR work combining spatial layout, real-time media, and guided focus across a sequence of scenes.",
    year: "2026",
  },
  "motion/Jazz Fest Commercial": {
    title: "Jazz Fest Commercial",
    description:
      "Commercial motion piece for a jazz festival—rhythm, typography, and picture cut to music and brand tone.",
    year: "2025",
  },
  "2d-archive/Spotify Canvas Design": {
    title: "Abstract Reality",
    description:
      "Exploring the boundary between physical and digital space through systems, type, and composition.",
    year: "2025",
  },
  "2d-archive/urban-geometries": {
    title: "Urban Geometries",
    description:
      "Brand and layout study, architectural rhythm translated into graphic structure.",
    year: "2025",
  },
  "2d-archive/urban-geometries copy": {
    title: "Urban Geometries",
    description:
      "Brand and layout study, architectural rhythm translated into graphic structure.",
    year: "2025",
  },
  "motion/Spotify Canvas Design": {
    title: "Digital Tapestry",
    description:
      "Data as choreography, a single hero piece for launch and festival screens.",
    year: "2025",
  },
  "campaigns/spatial-narratives": {
    title: "Spatial Narratives",
    description:
      "Campaign frames for social, light, shadow, and a consistent tonal world.",
    year: "2025",
  },
  "campaigns/Western Union": {
    title: "Western Union",
    description:
      "I worked on commercial projects for Western Union, producing animated promotional materials using Adobe After Effects. The content was developed in multiple languages including Greek, Georgian, Russian, and English, to effectively reach and engage diverse international audiences.",
    year: "2019",
  },
  "3d-archive/sculptural-forms": {
    title: "Sculptural Forms",
    description:
      "Spatial design study, volume, scale, and atmosphere in a single hero environment.",
    year: "2024",
  },
  "3d-archive/studio-reel": {
    title: "HELLO WORLD",
    description:
      "Environmental storytelling, workspace, light, and material as a designed set.",
    year: "2025",
  },
  "2d-archive/chromatic-waves-ii": {
    title: "Chromatic Waves II",
    description:
      "Illustrated series, palette, texture, and rhythm in a limited print run.",
    year: "2025",
  },
  "2d-archive/light-studies": {
    title: "Light Studies",
    description:
      "Editorial illustration on natural light, time, and quiet narrative moments.",
    year: "2024",
  },
};

const portfolioProjectsDe: Record<string, PortfolioProjectCopy> = {
  "interactive-vr/Cozy Experience": {
    title: "Cozy Experience",
    description:
      "Eine intime interaktive Studie zu Komfort, Maßstab und Präsenz—als kleiner, warmer Raum zum Erkunden.",
    year: "2026",
  },
  "interactive-vr/VR Experience": {
    title: "VR Experience",
    description:
      "Immersive VR-Arbeit mit räumlichem Layout, Echtzeit-Medien und geführtem Fokus über eine Sequenz von Szenen.",
    year: "2026",
  },
  "motion/Jazz Fest Commercial": {
    title: "Jazz Fest Commercial",
    description:
      "Kommerzieller Motion-Spot für ein Jazzfestival—Rhythmus, Typografie und Bildschnitt auf Musik und Markenton.",
    year: "2025",
  },
  "2d-archive/Spotify Canvas Design": {
    title: "Abstract Reality",
    description:
      "Die Grenze zwischen physischem und digitalem Raum erkunden – durch Systeme, Typografie und Komposition.",
    year: "2025",
  },
  "2d-archive/urban-geometries": {
    title: "Urban Geometries",
    description:
      "Marken- und Layoutstudie: architektonischer Rhythmus, übersetzt in grafische Struktur.",
    year: "2025",
  },
  "2d-archive/urban-geometries copy": {
    title: "Urban Geometries",
    description:
      "Marken- und Layoutstudie: architektonischer Rhythmus, übersetzt in grafische Struktur.",
    year: "2025",
  },
  "motion/Spotify Canvas Design": {
    title: "Digital Tapestry",
    description:
      "Daten als Choreografie – ein Hero-Spot für Launch und Festival-Screens.",
    year: "2025",
  },
  "campaigns/spatial-narratives": {
    title: "Spatial Narratives",
    description:
      "Kampagnen-Frames für Social: Licht, Schatten und eine konsistente tonale Welt.",
    year: "2025",
  },
  "campaigns/Western Union": {
    title: "Western Union",
    description:
      "Für Western Union habe ich kommerzielle Projekte umgesetzt und mit Adobe After Effects animierte Werbematerialien produziert. Die Inhalte entstanden in mehreren Sprachen – darunter Griechisch, Georgisch, Russisch und Englisch – um internationale Zielgruppen zu erreichen.",
    year: "2019",
  },
  "3d-archive/sculptural-forms": {
    title: "Sculptural Forms",
    description:
      "Raumgestaltungsstudie: Volumen, Maßstab und Atmosphäre in einer Hero-Umgebung.",
    year: "2024",
  },
  "3d-archive/studio-reel": {
    title: "Studio Reel",
    description:
      "Umgebungs-Storytelling: Arbeitsraum, Licht und Material als inszeniertes Set.",
    year: "2025",
  },
  "2d-archive/chromatic-waves-ii": {
    title: "Chromatic Waves II",
    description:
      "Illustrierte Serie: Palette, Textur und Rhythmus in einer limitierten Druckauflage.",
    year: "2025",
  },
  "2d-archive/light-studies": {
    title: "Light Studies",
    description:
      "Editorial-Illustration zu natürlichem Licht, Zeit und ruhigen Erzählmomenten.",
    year: "2024",
  },
};

const portfolioProjectsTr: Record<string, PortfolioProjectCopy> = {
  "interactive-vr/Cozy Experience": {
    title: "Cozy Experience",
    description:
      "Konfor, ölçek ve varlık üzerine samimi bir etkileşim çalışması—keşfedilebilir küçük, sıcak bir alan olarak.",
    year: "2026",
  },
  "interactive-vr/VR Experience": {
    title: "VR Experience",
    description:
      "Mekânsal yerleşim, gerçek zamanlı medya ve sahne dizisinde yönlü odağı birleştiren sürükleyici VR çalışması.",
    year: "2026",
  },
  "motion/Jazz Fest Commercial": {
    title: "Jazz Fest Commercial",
    description:
      "Bir caz festivali için ticari motion parçası—ritim, tipografi ve müzik ile marka tonuna göre kurgu.",
    year: "2025",
  },
  "2d-archive/Spotify Canvas Design": {
    title: "Abstract Reality",
    description:
      "Fiziksel ve dijital alan arasındaki sınırı sistemler, tipografi ve kompozisyon üzerinden keşfetmek.",
    year: "2025",
  },
  "2d-archive/urban-geometries": {
    title: "Urban Geometries",
    description:
      "Marka ve yerleşim çalışması: mimari ritmin grafik yapıya dönüştürülmesi.",
    year: "2025",
  },
  "2d-archive/urban-geometries copy": {
    title: "Urban Geometries",
    description:
      "Marka ve yerleşim çalışması: mimari ritmin grafik yapıya dönüştürülmesi.",
    year: "2025",
  },
  "motion/Spotify Canvas Design": {
    title: "Digital Tapestry",
    description:
      "Veriyi koreografi gibi kullanan tek bir hero çalışma; lansman ve festival ekranları için.",
    year: "2025",
  },
  "campaigns/spatial-narratives": {
    title: "Spatial Narratives",
    description:
      "Sosyal kampanya kareleri: ışık, gölge ve tutarlı bir tonal dünya.",
    year: "2025",
  },
  "campaigns/Western Union": {
    title: "Western Union",
    description:
      "Western Union için ticari projelerde çalıştım; Adobe After Effects ile animasyonlu tanıtım materyalleri ürettim. İçerikler Yunanca, Gürcüce, Rusça ve İngilizce dahil birden çok dilde hazırlanarak çeşitli uluslararası kitlelere ulaşmayı hedefledi.",
    year: "2019",
  },
  "3d-archive/sculptural-forms": {
    title: "Sculptural Forms",
    description:
      "Mekân tasarımı çalışması: tek bir hero ortamda hacim, ölçek ve atmosfer.",
    year: "2024",
  },
  "3d-archive/studio-reel": {
    title: "Studio Reel",
    description:
      "Ortam anlatımı: çalışma alanı, ışık ve malzemenin tasarlanmış bir set olarak kullanımı.",
    year: "2025",
  },
  "2d-archive/chromatic-waves-ii": {
    title: "Chromatic Waves II",
    description:
      "İllüstrasyon serisi: sınırlı baskıda palet, doku ve ritim.",
    year: "2025",
  },
  "2d-archive/light-studies": {
    title: "Light Studies",
    description:
      "Doğal ışık, zaman ve sessiz anlatı anları üzerine editoryal illüstrasyon.",
    year: "2024",
  },
};

const categoryEn: Record<GalleryCategory, string> = {
  "Interactive / VR": "Interactive / VR",
  Motion: "Motion",
  Campaigns: "Campaigns",
  "3D Archive": "3D Archive",
  "2D Archive": "2D Archive",
};

const en: TranslationMessages = {
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
    backToGallery: "Back to gallery",
    close: "Close",
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
    projects: portfolioProjectsEn,
  },
};

const de: TranslationMessages = {
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
    backToGallery: "Zurück zur Galerie",
    close: "Schließen",
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
    projects: portfolioProjectsDe,
  },
};

const tr: TranslationMessages = {
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
    backToGallery: "Galeriye dön",
    close: "Kapat",
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
    projects: portfolioProjectsTr,
  },
};

export const translations: Record<Locale, TranslationMessages> = {
  en,
  de,
  tr,
};

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
  const v = messages.categories[canonical as GalleryCategory];
  return v !== undefined ? v : canonical;
}

/**
 * Detail modal title, description, and year for a gallery item.
 * Pass `messages` from `useLanguage()` so copy follows the selected locale (en / de / tr).
 * Keys are `categoryFolder/slug` — keep in sync with `gallery-manifest.json`.
 */
export function portfolioProjectCopy(
  messages: TranslationMessages,
  projectKey: string,
): PortfolioProjectCopy {
  const p = messages.portfolio.projects[projectKey];
  if (p) return p;
  return { title: projectKey, description: "", year: "" };
}
