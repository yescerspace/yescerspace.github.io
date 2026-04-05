import type { GalleryImage } from "../components/Gallery3D";
import {
  GALLERY_CATEGORIES,
  type GalleryCategory,
} from "../context/WorksCategoryContext";
import { translations } from "../i18n/translations";
import {
  projectKeyFromParts,
} from "../utils/galleryProjectKey";
import { publicAsset } from "../utils/publicAsset";
import galleryManifest from "./gallery-manifest.json";

/**
 * Gallery **project list and media paths** come from **`gallery-manifest.json`** (hand-edited;
 * nothing in dev/build overwrites it).
 *
 * **Sources of truth:**
 * - Which projects exist and their `images[]` paths → **`src/app/data/gallery-manifest.json`**
 * - Titles, descriptions, years → EN: **`src/app/data/portfolio-content.json`**; DE/TR: **`src/app/i18n/translations.ts`**
 *
 * `projectKey` = `categoryFolder/slug` and must match translation keys exactly.
 *
 * @see public/gallery/README.md
 */
export type GalleryManifestProject = (typeof galleryManifest.projects)[number];

/** Canonical key — same as `projectKeyFromParts` (see `galleryProjectKey.ts`). */
export function projectKeyFromManifestEntry(entry: {
  categoryFolder: string;
  slug: string;
}): string {
  return projectKeyFromParts(entry.categoryFolder, entry.slug);
}

function projectKey(entry: { categoryFolder: string; slug: string }): string {
  return projectKeyFromManifestEntry(entry);
}

function manifestEntryToGalleryImage(entry: GalleryManifestProject): GalleryImage {
  return {
    projectKey: projectKey(entry),
    images: entry.images.map((p) => publicAsset(p)),
    category: entry.category,
  };
}

/** Flat list for "All" and the gallery — order follows manifest (category order, then project). */
export const galleryItems: GalleryImage[] = Array.isArray(galleryManifest.projects)
  ? galleryManifest.projects.map(manifestEntryToGalleryImage)
  : [];

if (import.meta.env?.DEV) {
  const byCategory = new Map<GalleryCategory, number>();
  for (const c of GALLERY_CATEGORIES) {
    byCategory.set(c, 0);
  }
  const enProjects = translations.en.portfolio?.projects ?? {};
  const enProjectKeys = new Set(Object.keys(enProjects));
  const manifestProjects = Array.isArray(galleryManifest.projects)
    ? galleryManifest.projects
    : [];
  const manifestKeys = new Set(manifestProjects.map((p) => projectKey(p)));
  for (const p of manifestProjects) {
    const cat = p.category as GalleryCategory;
    const k = projectKey(p);
    console.log(
      `[galleryData] projectKey generation: categoryFolder=${JSON.stringify(p.categoryFolder)} slug=${JSON.stringify(p.slug)} → projectKey=${JSON.stringify(k)}`,
    );
    if (!GALLERY_CATEGORIES.includes(cat)) {
      console.warn(
        `[galleryData] Unknown category in manifest: "${p.category}" (project "${p.slug}").`,
      );
      continue;
    }
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    if (!enProjectKeys.has(k)) {
      console.error(
        `[galleryData] PROJECT KEY MISMATCH: expected=${JSON.stringify(k)} (translation key in en.portfolio.projects) | actual=missing — add this key to translations (EN/DE/TR).`,
      );
      console.error("[galleryData] EN keys (sample):", [...enProjectKeys].sort());
    }
  }
  for (const k of enProjectKeys) {
    if (!manifestKeys.has(k)) {
      console.error(
        `[galleryData] PROJECT KEY MISMATCH: expected=manifest project | actual=${JSON.stringify(k)} (orphan translation key — remove or add manifest row).`,
      );
    }
  }
  const enSorted = [...enProjectKeys].sort();
  for (const loc of ["de", "tr"] as const) {
    const locKeys = Object.keys(
      translations[loc].portfolio?.projects ?? {},
    ).sort();
    if (JSON.stringify(enSorted) !== JSON.stringify(locKeys)) {
      console.error(
        `[galleryData] portfolio.projects keys differ between en and ${loc} (must match byte-for-byte).`,
        { en: enSorted, [loc]: locKeys },
      );
    }
  }
  for (const [cat, n] of byCategory) {
    if (n === 0) {
      console.warn(`[galleryData] Category "${cat}" has no projects on disk.`);
    }
  }
  const seen = new Set<string>();
  for (const item of galleryItems) {
    if (seen.has(item.projectKey)) {
      console.warn(`[galleryData] Duplicate project key: ${item.projectKey}`);
    }
    seen.add(item.projectKey);
  }
  console.log(
    "[galleryData] valid projectKeys (manifest ↔ translations):",
    [...manifestKeys].sort(),
  );
}
