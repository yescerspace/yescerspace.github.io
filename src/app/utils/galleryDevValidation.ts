import type { GalleryImage } from "../components/Gallery3D";
import { primaryGalleryTextureUrl } from "./galleryMedia";

/**
 * DEV-only: probe hero raster URLs; log ERROR if the image fails to load (404, wrong base, etc.).
 */
export function logGalleryHeroLoadErrorsInDev(items: readonly GalleryImage[]): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;

  for (const item of items) {
    const url = primaryGalleryTextureUrl(item.images);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {};
    img.onerror = () => {
      console.error(
        "[gallery] ERROR: hero image failed to load — URL:",
        url,
        "| projectKey:",
        JSON.stringify(item.projectKey),
        "| raw images[0]:",
        item.images[0] ?? "(none)",
      );
    };
    img.src = url;
  }
}
