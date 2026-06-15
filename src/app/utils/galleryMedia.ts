import { publicAsset } from "./publicAsset";
import galleryManifest from "../data/gallery-manifest.json";

/** Video extensions for detail / texture detection */
const VIDEO_RE = /\.(mp4|webm)(\?.*)?$/i;
/** Raster images (hero + detail) */
const RASTER_RE = /\.(jpe?g|png|webp)(\?.*)?$/i;

function pathOnly(url: string): string {
  return url.split(/[?#]/)[0] ?? url;
}

/** Numeric index from `1.jpg`, `12.webp`, etc.; non-numeric basenames → `null`. */
export function galleryFilenameIndex(url: string): number | null {
  const file = pathOnly(url).split("/").pop() ?? "";
  const base = file.replace(/\.[^.]+$/, "");
  if (!/^\d+$/.test(base)) return null;
  const n = parseInt(base, 10);
  /** Card cover is `00.*` only; `0.*` is ignored here so labels stay 1-based in the detail list. */
  if (base === "00" || base === "0") return null;
  return n;
}

export function isVideoUrl(url: string): boolean {
  return VIDEO_RE.test(pathOnly(url));
}

/**
 * Video yüklenene kadar `<video poster>`: `gallery/…/1.mp4` → `gallery/…/1-.jpg` (manifest’e yazılmaz).
 * Uzantı şimdilik `.jpg`; dosya yoksa tarayıcı poster’ı yok sayar (siyah alan önceki gibi).
 */
export function detailVideoPosterUrl(videoUrl: string): string | null {
  const p = pathOnly(videoUrl);
  if (!isVideoUrl(p)) return null;
  if (/^https?:\/\//i.test(p)) {
    const m = p.match(/\/(?:public\/)?gallery\/(\d+)\/(\d+)\.(mp4|webm)$/i);
    if (m) {
      return withGalleryAssetCacheBust(
        publicAsset(`gallery/${m[1]}/${m[2]}-.jpg`),
      );
    }
    return null;
  }
  const posterPath = p.replace(/\.(mp4|webm)$/i, "-.jpg");
  if (posterPath === p) return null;
  return withGalleryAssetCacheBust(posterPath);
}

export function isRasterImageUrl(url: string): boolean {
  return RASTER_RE.test(pathOnly(url));
}

/**
 * Detail modal: indices `1`, `2`, `3`, … only (excludes `00.*` cover and legacy `0.*`).
 * Sorted by numeric index; gaps in numbering are fine — only existing files are listed.
 */
export function detailPageMediaUrls(urls: readonly string[]): string[] {
  const entries: { url: string; idx: number }[] = [];
  for (const raw of urls) {
    const u = raw?.trim();
    if (!u) continue;
    const idx = galleryFilenameIndex(u);
    if (idx === null || idx < 1) continue;
    entries.push({ url: u, idx });
  }
  entries.sort((a, b) => a.idx - b.idx || a.url.localeCompare(b.url));
  return entries.map((e) => e.url);
}

/** First video in the detail list (`1.*`, `2.*`, … order), if any. */
export function firstDetailVideoUrl(urls: readonly string[]): string | null {
  for (const u of detailPageMediaUrls(urls)) {
    if (isVideoUrl(u)) return u;
  }
  return null;
}

let lastDetailPreloadKey: string | null = null;

const DETAIL_PRELOAD_MAX = 4;

/**
 * Hint the browser to fetch the first few detail assets early (`<link rel="preload">`).
 * Preloads images as `image` and videos as `video` — call on pointer down / before opening the modal.
 */
export function prefetchDetailModalMedia(urls: readonly string[]): void {
  if (typeof document === "undefined") return;
  const detail = detailPageMediaUrls(urls);
  const key = detail.slice(0, DETAIL_PRELOAD_MAX).join("|");
  if (key.length === 0) return;
  if (key === lastDetailPreloadKey) return;
  lastDetailPreloadKey = key;

  document
    .querySelectorAll("link[data-gallery-detail-preload]")
    .forEach((el) => el.remove());

  for (const raw of detail.slice(0, DETAIL_PRELOAD_MAX)) {
    const u = raw?.trim();
    if (!u) continue;
    const link = document.createElement("link");
    link.rel = "preload";
    link.href = u;
    link.setAttribute("data-gallery-detail-preload", "1");
    if (isVideoUrl(u)) {
      link.as = "video";
      document.head.appendChild(link);
      const poster = detailVideoPosterUrl(u);
      if (poster) {
        const pl = document.createElement("link");
        pl.rel = "preload";
        pl.href = poster;
        pl.as = "image";
        pl.setAttribute("data-gallery-detail-preload", "1");
        document.head.appendChild(pl);
      }
    } else if (isRasterImageUrl(u)) {
      link.as = "image";
      document.head.appendChild(link);
    } else {
      continue;
    }
  }
}

/** @deprecated Use {@link prefetchDetailModalMedia} — kept for call sites. */
export function prefetchFirstDetailVideo(urls: readonly string[]): void {
  prefetchDetailModalMedia(urls);
}

export function clearGalleryDetailVideoPreload(): void {
  lastDetailPreloadKey = null;
  if (typeof document === "undefined") return;
  document
    .querySelectorAll("link[data-gallery-detail-preload]")
    .forEach((el) => el.remove());
}

/**
 * Aynı URL tarayıcı önbelleğinde eski bayt olarak kalabiliyor. Sorgu parametresi ekler:
 * dev’de her çağrıda benzersiz; prod’da `gallery-manifest.json` `lastUpdated` (medya değişince `gallery:sync`).
 */
export function withGalleryAssetCacheBust(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  const tag = import.meta.env.DEV
    ? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    : galleryManifest.lastUpdated;
  return `${url}${sep}g=${encodeURIComponent(tag)}`;
}

function coverBasename(url: string): string | null {
  const file = pathOnly(url).split("/").pop() ?? "";
  const base = file.replace(/\.[^.]+$/, "");
  return base === "00" ? base : null;
}

/** WebGL card texture: only `00.*` raster (jpg/png/webp); missing or non-raster → global fallback. */
export function primaryGalleryTextureUrl(urls: readonly string[]): string {
  for (const raw of urls) {
    const u = raw?.trim();
    if (!u) continue;
    if (coverBasename(u) && isRasterImageUrl(u)) {
      return publicAsset(u);
    }
  }
  const fb = publicAsset("fallback.jpg");
  if (import.meta.env.DEV && urls.length > 0) {
    console.error(
      "[gallery] ERROR: no 00.jpg/png/webp for card — using fallback.jpg. urls=",
      urls,
    );
  }
  return fb;
}
