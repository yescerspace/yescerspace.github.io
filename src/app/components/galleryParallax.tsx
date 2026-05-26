import { createContext, useContext } from "react";
import type { MutableRefObject } from "react";

/** OrbitControls snapshot for 2D starfield parallax (updated each frame). */
export type GalleryParallaxState = {
  azimuth: number;
  polar: number;
  /** 0 = closest zoom, 1 = farthest */
  distanceT: number;
};

export const DEFAULT_GALLERY_PARALLAX: GalleryParallaxState = {
  azimuth: 0,
  polar: 1.05,
  distanceT: 0.5,
};

export const GalleryParallaxContext =
  createContext<MutableRefObject<GalleryParallaxState> | null>(null);

export function useGalleryParallaxRef(): MutableRefObject<GalleryParallaxState> | null {
  return useContext(GalleryParallaxContext);
}
