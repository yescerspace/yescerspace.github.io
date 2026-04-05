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

let lastPrefetchedDetailVideo: string | null = null;

/**
 * Hint the browser to fetch the first detail video early (`<link rel="preload" as="video">`).
 * Call on card press / before opening the modal; noop if there is no detail video.
 */
export function prefetchFirstDetailVideo(urls: readonly string[]): void {
  if (typeof document === "undefined") return;
  const raw = firstDetailVideoUrl(urls);
  if (!raw) return;
  if (lastPrefetchedDetailVideo === raw) return;
  lastPrefetchedDetailVideo = raw;
  document
    .querySelectorAll("link[data-gallery-detail-preload]")
    .forEach((el) => el.remove());
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "video";
  link.href = raw;
  link.setAttribute("data-gallery-detail-preload", "1");
  document.head.appendChild(link);
}

export function clearGalleryDetailVideoPreload(): void {
  lastPrefetchedDetailVideo = null;
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
