import { publicAsset } from "./publicAsset";

/** Video extensions for detail / texture detection */
const VIDEO_RE = /\.(mp4|webm)(\?.*)?$/i;
/** Raster images (hero + detail) */
const RASTER_RE = /\.(jpe?g|png|webp)(\?.*)?$/i;

function pathOnly(url: string): string {
  return url.split(/[?#]/)[0] ?? url;
}

/** Numeric index from `0.jpg`, `12.webp`, etc.; non-numeric basenames → `null`. */
export function galleryFilenameIndex(url: string): number | null {
  const file = pathOnly(url).split("/").pop() ?? "";
  const base = file.replace(/\.[^.]+$/, "");
  if (!/^\d+$/.test(base)) return null;
  return parseInt(base, 10);
}

export function isVideoUrl(url: string): boolean {
  return VIDEO_RE.test(pathOnly(url));
}

export function isRasterImageUrl(url: string): boolean {
  return RASTER_RE.test(pathOnly(url));
}

/**
 * Detail modal: indices `1`, `2`, `3`, … only (excludes `0` = hero/thumbnail).
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
    } else if (isRasterImageUrl(u)) {
      link.as = "image";
    } else {
      continue;
    }
    document.head.appendChild(link);
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

/** WebGL card texture: only `0` raster (jpg/png/webp); `0` video or missing → global fallback. */
export function primaryGalleryTextureUrl(urls: readonly string[]): string {
  for (const raw of urls) {
    const u = raw?.trim();
    if (!u) continue;
    if (galleryFilenameIndex(u) === 0 && isRasterImageUrl(u)) return u;
  }
  const fb = publicAsset("fallback.jpg");
  if (import.meta.env.DEV && urls.length > 0) {
    console.error(
      "[gallery] ERROR: no 0.jpg/png/webp for card — using fallback.jpg. urls=",
      urls,
    );
  }
  return fb;
}
