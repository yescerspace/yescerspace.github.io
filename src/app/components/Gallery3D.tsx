import {
  createContext,
  useContext,
  forwardRef,
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useMemo,
  type MouseEvent,
  type MutableRefObject,
  type Ref,
  type VideoHTMLAttributes,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls as DreiOrbitControls } from "@react-three/drei";
import type { OrbitControls as StdOrbitControls } from "three-stdlib";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import * as THREE from "three";
import { useLanguage } from "../context/LanguageContext";
import {
  localizedCategory,
  portfolioProjectCopy,
} from "../i18n/translations";
import { publicAsset } from "../utils/publicAsset";
import { logGalleryHeroLoadErrorsInDev } from "../utils/galleryDevValidation";
import {
  clearGalleryDetailVideoPreload,
  detailPageMediaUrls,
  firstDetailVideoUrl,
  galleryFilenameIndex,
  isVideoUrl,
  prefetchDetailModalMedia,
  primaryGalleryTextureUrl,
} from "../utils/galleryMedia";

/** Detail modal: allow first-row video at top; others only when vertically centered in the scroller. */
const DETAIL_FIRST_VIDEO_SCROLL_TOP_MAX = 56;
const DETAIL_VIDEO_CENTER_BAND_FRAC = 0.22;
/** Initial playback level (0–1) when a clip loads; audience can change it with the player controls. */
const DETAIL_VIDEO_VOLUME = 0.2;

/** Avoid audio before the first frame is decoded (`loadedmetadata` alone is not enough). */
function videoCanShowFrame(v: HTMLVideoElement): boolean {
  return v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}

function syncDetailVideoPlayback(
  scrollEl: HTMLDivElement,
  detailUrls: readonly string[],
  srcFor: (u: string) => string,
  failed: Record<string, boolean>,
  itemEls: readonly (HTMLElement | null)[],
  videoEls: readonly (HTMLVideoElement | null)[],
): void {
  const firstUrl = detailUrls[0];
  const firstIsVideo =
    firstUrl != null &&
    !failed[firstUrl] &&
    isVideoUrl(srcFor(firstUrl));

  const cRect = scrollEl.getBoundingClientRect();
  const centerY = cRect.top + cRect.height / 2;
  const band = Math.max(56, cRect.height * DETAIL_VIDEO_CENTER_BAND_FRAC);

  let playIndex = -1;

  if (firstIsVideo && scrollEl.scrollTop < DETAIL_FIRST_VIDEO_SCROLL_TOP_MAX) {
    playIndex = 0;
  } else {
    let bestI = -1;
    let bestDist = Infinity;
    for (let i = 0; i < detailUrls.length; i++) {
      const u = detailUrls[i];
      if (!u || failed[u] || !isVideoUrl(srcFor(u))) continue;
      const wrap = itemEls[i];
      if (!wrap) continue;
      const r = wrap.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const dist = Math.abs(mid - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        bestI = i;
      }
    }
    if (bestI >= 0 && bestDist <= band) {
      playIndex = bestI;
    }
  }

  for (let i = 0; i < videoEls.length; i++) {
    const v = videoEls[i];
    if (!v) continue;
    const u = detailUrls[i];
    if (!u || failed[u] || !isVideoUrl(srcFor(u))) continue;
    if (i === playIndex) {
      if (videoCanShowFrame(v)) {
        void v.play().catch(() => {});
      }
    } else {
      v.pause();
    }
  }
}

export interface GalleryImage {
  /** `categoryFolder/slug` — matches `portfolio.projects` keys in translations.ts */
  projectKey: string;
  /** Sorted by filename: `0.*` = hero/thumbnail; `1.*`, `2.*`, … = detail + order (see sync script). */
  images: string[];
  category: string;
}

interface Gallery3DProps {
  images: GalleryImage[];
  onOpenImage?: (image: GalleryImage) => void;
  onCloseModal?: () => void;
}

/** Public root fallback (`/public/fallback.jpg`) */
function fallbackImageUrl(): string {
  return publicAsset("fallback.jpg");
}

export function primaryGalleryImageUrl(item: GalleryImage): string {
  return primaryGalleryTextureUrl(item.images);
}

const sharedTextureLoader = new THREE.TextureLoader();
sharedTextureLoader.setCrossOrigin("anonymous");

function configureTexture(t: THREE.Texture): void {
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
}

/**
 * Maps the image with object-fit: cover onto the square card faces (1080×1080 intent)
 * so non-square sources are center-cropped instead of stretched.
 */
function applySquareFaceTextureUV(t: THREE.Texture): void {
  const img = t.image as { width?: number; height?: number } | undefined;
  const w = img?.width ?? 0;
  const h = img?.height ?? 0;
  if (!w || !h) return;
  const ar = w / h;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  if (ar >= 1) {
    const rx = 1 / ar;
    t.repeat.set(rx, 1);
    t.offset.set((1 - rx) / 2, 0);
  } else {
    t.repeat.set(1, ar);
    t.offset.set(0, (1 - ar) / 2);
  }
  t.needsUpdate = true;
}

function createSolidFallbackTexture(): THREE.DataTexture {
  const data = new Uint8Array([0x52, 0x52, 0x5c, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

/** Shared light neutral — cards never start textureless (avoids a black/dark flash). */
let lightCardPlaceholderTexture: THREE.DataTexture | null = null;
function getLightCardPlaceholderTexture(): THREE.DataTexture {
  if (!lightCardPlaceholderTexture) {
    const data = new Uint8Array([0xe6, 0xe7, 0xeb, 255]);
    const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    lightCardPlaceholderTexture = tex;
    applySquareFaceTextureUV(lightCardPlaceholderTexture);
    configureTexture(lightCardPlaceholderTexture);
  }
  return lightCardPlaceholderTexture;
}

/**
 * Loads a texture via TextureLoader; never throws. Falls back to `publicAsset("fallback.jpg")`, then a solid color.
 * Starts from a light placeholder so the card is never texture-null while loading.
 */
function useResilientTexture(imageUrl: string | undefined): THREE.Texture | null {
  const placeholder = getLightCardPlaceholderTexture();
  const [texture, setTexture] = useState<THREE.Texture | null>(() => placeholder);
  const lastLoadedRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTexture(placeholder);

    const disposeLastLoaded = () => {
      if (lastLoadedRef.current) {
        lastLoadedRef.current.dispose();
        lastLoadedRef.current = null;
      }
    };

    const commit = (t: THREE.Texture) => {
      if (cancelled) {
        t.dispose();
        return;
      }
      disposeLastLoaded();
      lastLoadedRef.current = t;
      configureTexture(t);
      setTexture(t);
    };

    const loadSolid = () => {
      if (cancelled) return;
      try {
        const solid = createSolidFallbackTexture();
        applySquareFaceTextureUV(solid);
        commit(solid);
      } catch (e) {
        console.error("[Gallery3D] Solid fallback texture failed:", e);
      }
    };

    const loadFallbackAsset = () => {
      const url = fallbackImageUrl();
      sharedTextureLoader.load(
        url,
        (loaded) => {
          if (cancelled) {
            loaded.dispose();
            return;
          }
          applySquareFaceTextureUV(loaded);
          commit(loaded);
        },
        undefined,
        (err) => {
          console.error(
            "[Gallery3D] Fallback asset failed to load:",
            url,
            err,
          );
          loadSolid();
        },
      );
    };

    const loadPrimary = (url: string) => {
      sharedTextureLoader.load(
        url,
        (loaded) => {
          if (cancelled) {
            loaded.dispose();
            return;
          }
          applySquareFaceTextureUV(loaded);
          commit(loaded);
        },
        undefined,
        (_err) => {
          console.error(
            "[Gallery3D] Image failed to load (using fallback asset):",
            url,
          );
          loadFallbackAsset();
        },
      );
    };

    const primary = imageUrl?.trim();
    if (!primary) {
      console.warn(
        "[Gallery3D] Missing or empty image URL; using fallback asset.",
      );
      loadFallbackAsset();
    } else {
      loadPrimary(primary);
    }

    return () => {
      cancelled = true;
      disposeLastLoaded();
      setTexture(placeholder);
    };
  }, [imageUrl, placeholder]);

  return texture;
}

/** Arc length (world units) between adjacent cards — lower = denser ring, more overlap */
const ORBIT_CARD_SPACING = 1.28;
/** Minimum shell radius for the Fibonacci cloud (All + filtered categories). */
const ORBIT_MIN_RADIUS_ALL = 5.05;
/** When exactly two pieces are on the ring, enforce a wider radius so they do not overlap */
const ORBIT_TWO_ITEM_MIN_RADIUS = 0.78;
/**
 * With 4+ items on a filtered ring (e.g. Motion), enforce a wider orbit so neighbors
 * don’t feel glued — more empty “hub” in the middle.
 */
const ORBIT_MIN_RADIUS_FILTERED_MANY = 1.06;
/** Extra arc length between cards when a category filter is active (3 items). */
const FILTERED_RING_SPACING_MULT_3 = 1.28;
/** Extra arc length when 4+ items on a filtered ring (Motion, etc.). */
const FILTERED_RING_SPACING_MULT_4PLUS = 1.52;

/**
 * Cloud gallery: circular covers on a Fibonacci shell + drift.
 * Raised well above the original 0.46 so covers read clearly on screen.
 */
const ALL_CLOUD_LAYOUT_SCALE = 1.08;
/** Global cover scale on the shell (1 = nominal). */
const GALLERY_COVER_GLOBAL_SCALE = 1;
/** Extra radius for orbit / FOV framing so the 3D shell doesn’t clip. */
const ALL_CLOUD_FRAMING_RADIUS_MULT = 1.52;
/** Organic motion — keep very subtle so orbit around the hub reads as the main motion. */
const ALL_CLOUD_DRIFT_AMP = 0.024;
/** Long-period glide — low amp vs drift. */
const ALL_CLOUD_GLIDE_AMP = 0.018;
/** Radial drift’in ne kadarı kesilsin (0 = hepsi tangential, 1 = olduğu gibi). */
const ALL_CLOUD_DRIFT_RADIAL_DAMP = 0.72;
/** “All” view: circular disc — segment count for smooth outline. */
const ALL_CLOUD_CIRCLE_SEGMENTS = 72;
/**
 * Perspektif ölçeği: `refD / distCam` (ref = kamera→orbit hedefi). Yakın kapak büyük, uzak küçük.
 */
const ALL_CLOUD_PERSPECTIVE_CLAMP_MIN = 0.58;
const ALL_CLOUD_PERSPECTIVE_CLAMP_MAX = 1.48;
/** depthScale hedefini takip (orbit sürüklerken daha çevik). */
const ALL_CLOUD_DEPTH_SMOOTH_SPEED = 9.5;
/**
 * Dikey eksene (xz) minimum uzaklık / yerel kabuk yarıçapı — ortada “görünmez gezegen” boşluğu.
 */
const CLOUD_HUB_VOID_MIN_XZ_FRAC = 0.44;
/**
 * “All”: ortadaki görünmez çekirdeğe daha geniş boşluk (yörünge halkası daha dışta).
 */
const CLOUD_HUB_VOID_MIN_XZ_FRAC_ALL = 0.6;
/**
 * “All”da öğeleri merkeze göre aynı oranda büyüt — birbirlerinden uzaklaşır; açılar / hash’ler aynı kalır.
 */
const ALL_CATEGORY_PAIRWISE_SPREAD = 1.42;

/**
 * Front/back faces match hero artwork aspect: 1080×1080 (square).
 * Box face is width (X) × height (Y); export `0.*` at this size to avoid stretching.
 */
const CARD_FACE_PIXEL_W = 1080;
const CARD_FACE_PIXEL_H = 1080;
const CARD_FACE_ASPECT_W_OVER_H = CARD_FACE_PIXEL_W / CARD_FACE_PIXEL_H;

/** Thin print slab: width × height × depth (`BoxGeometry`; depth keeps edges visible) */
const CARD_W = 0.92;
const CARD_H = CARD_W / CARD_FACE_ASPECT_W_OVER_H;
const CARD_D = 0.014;
/** Deterministic 0–1 hash for per-slot scatter (stable across frames). */
function slotHash01(slot: number, salt: number): number {
  const x = Math.sin(slot * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Orta boşluğu koru: xz’de eksene çok yakın noktaları dışarı iter (hepsi aynı yerel R ölçeğine göre).
 */
function pushCloudOntoHubRing(
  slot: number,
  x: number,
  yW: number,
  z: number,
  R: number,
  hubVoidFrac: number = CLOUD_HUB_VOID_MIN_XZ_FRAC,
): [number, number, number] {
  const rh = Math.hypot(x, z);
  const rhMin = R * hubVoidFrac;
  if (rh <= 1e-6) {
    const ang = slotHash01(slot, 11) * Math.PI * 2;
    return [Math.cos(ang) * rhMin, yW, Math.sin(ang) * rhMin];
  }
  if (rh < rhMin) {
    const s = rhMin / rh;
    return [x * s, yW, z * s];
  }
  return [x, yW, z];
}

/**
 * Fibonacci sphere + jitter — loose “planet shell” of thumbnails (not a flat ring).
 * `allCategoryLayout`: “All” görünümünde daha yatay bant + ekstra rastgele açı.
 */
function allCloudBasePosition(
  slot: number,
  n: number,
  shellRadius: number,
  allCategoryLayout: boolean,
): [number, number, number] {
  if (n <= 0) return [0, 0, shellRadius];
  if (n === 1) {
    const R = shellRadius * 0.95;
    const t = slotHash01(0, 11) * Math.PI * 2;
    const hubFrac = allCategoryLayout
      ? CLOUD_HUB_VOID_MIN_XZ_FRAC_ALL
      : CLOUD_HUB_VOID_MIN_XZ_FRAC;
    const rr = Math.max(R * hubFrac * 1.08, R * 0.52);
    let x1 = Math.cos(t) * rr;
    let z1 = Math.sin(t) * rr;
    if (allCategoryLayout) {
      x1 *= ALL_CATEGORY_PAIRWISE_SPREAD;
      z1 *= ALL_CATEGORY_PAIRWISE_SPREAD;
    }
    return pushCloudOntoHubRing(0, x1, 0, z1, R, hubFrac);
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  const i = slot + 0.5;
  const y = 1 - (i / n) * 2;
  const clampY = THREE.MathUtils.clamp(y, -0.999, 0.999);
  const theta = golden * slot;
  const h1 = slotHash01(slot, 1);
  const h2 = slotHash01(slot, 2);
  const h3 = slotHash01(slot, 3);
  const h4 = slotHash01(slot, 4);
  const h5 = slotHash01(slot, 5);
  const h6 = slotHash01(slot, 6);
  /** Kabuktan içe/dışa — “All”da daha geniş radyal + yatay açı. */
  let radialJitter = 0.52 + h1 * 0.52;
  let thetaJitter = (h2 - 0.5) * 1.05;
  let yJitter = (h3 - 0.5) * 0.52;
  if (allCategoryLayout) {
    radialJitter = 0.36 + h1 * 0.78;
    thetaJitter = (h2 - 0.5) * 1.75;
    yJitter = (h3 - 0.5) * 0.3;
  }
  /** Ek yarıçap katmanı (deterministik, slot başına sabit). */
  let shellRadiusMul = 0.8 + h4 * 0.36;
  if (allCategoryLayout) {
    shellRadiusMul = 0.76 + h4 * 0.58;
  }
  let t = theta + thetaJitter;
  if (allCategoryLayout) {
    t += (h5 - 0.5) * 1.92 + (h6 - 0.5) * 0.95;
  }
  const yF = clampY + yJitter;
  const yMax = allCategoryLayout ? 0.64 : 0.965;
  const yClamped = THREE.MathUtils.clamp(yF, -yMax, yMax);
  const rAdj = Math.sqrt(Math.max(0, 1 - yClamped * yClamped));
  const R = shellRadius * radialJitter * shellRadiusMul;
  let x = Math.cos(t) * rAdj * R;
  let z = Math.sin(t) * rAdj * R;
  let yW = yClamped * R;
  if (allCategoryLayout) {
    yW *= 0.78;
    const spread = 0.46 * R;
    const xz = (slotHash01(slot, 7) - 0.5) * spread;
    const xz2 = (slotHash01(slot, 8) - 0.5) * spread;
    const h9 = slotHash01(slot, 9);
    const h10 = slotHash01(slot, 10);
    x += xz + (h9 - 0.5) * spread * 0.85;
    z += xz2 + (h10 - 0.5) * spread * 0.85;
    const s = ALL_CATEGORY_PAIRWISE_SPREAD;
    x *= s;
    yW *= s;
    z *= s;
  }
  const hubFrac = allCategoryLayout
    ? CLOUD_HUB_VOID_MIN_XZ_FRAC_ALL
    : CLOUD_HUB_VOID_MIN_XZ_FRAC;
  return pushCloudOntoHubRing(slot, x, yW, z, R, hubFrac);
}

/** Circumference = n × spacing → radius = n×spacing / (2π); never below minRadius */
function ringRadiusWorld(
  itemCount: number,
  minRadiusWorld: number,
  isFilteredCategory: boolean,
): number {
  let spacing =
    itemCount === 2 ? ORBIT_CARD_SPACING * 1.1 : ORBIT_CARD_SPACING;
  if (isFilteredCategory && itemCount >= 4) {
    spacing *= FILTERED_RING_SPACING_MULT_4PLUS;
  } else if (isFilteredCategory && itemCount === 3) {
    spacing *= FILTERED_RING_SPACING_MULT_3;
  }
  const radius = (itemCount * spacing) / (2 * Math.PI);
  let r = Math.max(radius, minRadiusWorld);
  if (itemCount === 2) {
    r = Math.max(r, ORBIT_TWO_ITEM_MIN_RADIUS);
  }
  if (isFilteredCategory && itemCount >= 4) {
    r = Math.max(r, ORBIT_MIN_RADIUS_FILTERED_MANY);
  }
  return r;
}

/** Used by camera framing math (must sit before carouselFramingExtents) */
const HOVER_SCALE = 1.06;
const HOVER_LIFT = 0.16;
/** Uniform mesh scale — slightly smaller vs before so spread + black space read like the reference. */
const CARD_MESH_BASE_SCALE = 1.52;
/** Pull ring positions toward center for a tighter circle (after parallax) */
const RING_RADIAL_COMPACT = 0.8;
/**
 * When mesh scale > 1, nudge the group toward ring center so growth reads inward
 * (pull = (scale - 1) * SCALE_INWARD_K * ringRadius).
 */
const SCALE_INWARD_K = 0.5;
const ZOOM_RING_EXPAND = 0.062;
const ZOOM_DEPTH_PULL = 0.22;
const ZOOM_PARALLAX_Y = 0.1;
const ZOOM_SCALE_BOOST = 0.042;

/**
 * Reference vertical FOV for orbit distance math and Canvas projection.
 * `AdaptiveFovSync` smoothes around this baseline (~60° vs the old ~78° wide look).
 */
const CAMERA_FOV = 60;
/** Tight near plane; stay well under min orbit distance */
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 2000;

/** Frustum slack vs scaled carousel bounds (>1 = extra padding so thumbnails stay in view). */
const FRAMING_MARGIN = 1.06;

/** Uniform scale for the carousel group (larger on screen without shrinking orbit min) */
const GALLERY_GROUP_WORLD_SCALE = 1.22;

/** Cinematic FOV at min vs max orbit distance (deg); clamped up by geometry */
const ADAPTIVE_FOV_AT_MIN_DISTANCE = 50;
const ADAPTIVE_FOV_AT_MAX_DISTANCE = 57;
const ADAPTIVE_FOV_ABSOLUTE_CAP = 72;
/** Exponential smoothing for FOV follow (~0.08–0.12 effective step at 60fps) */
const ADAPTIVE_FOV_SMOOTHING = 9.5;
/** Keep close to geometric min so zoom-in cannot clip the cloud (Fibonacci + spread extends past ring math). */
const ORBIT_MIN_DISTANCE_RELAX = 0.94;
/** Max orbit distance as a multiple of min (wider zoom-out; min = closest zoom unchanged) */
const ORBIT_MAX_DISTANCE_RATIO = 1.62;
/**
 * Initial camera distance between min and max (0 = closest zoom, 1 = farthest).
 * Higher = calmer opening frame; scroll still reaches `min`.
 */
const DEFAULT_ORBIT_DISTANCE_T = 0.72;

/**
 * Orbit pivot + ring anchor (world Y). Lifts the layout so framing is balanced
 * (avoids empty top / clipped bottom) while keeping pan disabled so Y never drifts.
 */
const ORBIT_TARGET_Y = 0.28;
const _orbitTarget = new THREE.Vector3(0, ORBIT_TARGET_Y, 0);

/**
 * Baseline elevation in the YZ plane (from +Z toward +Y). atan(ratio) matches
 * the old CAMERA_YZ_RATIO line; bias nudges the ring slightly higher on screen.
 */
const CAMERA_YZ_RATIO = 0.76 / 9.42;
const CAMERA_ELEVATION_BIAS = 0.024;

function cameraElevationAngle(): number {
  return Math.atan(CAMERA_YZ_RATIO) + CAMERA_ELEVATION_BIAS;
}

/**
 * Worst-case carousel bounds (hover + zoom parallax on ring) for framing math.
 * Scaled by `GALLERY_GROUP_WORLD_SCALE` so orbit limits match the scaled group.
 * `FRAMING_CLOUD_EXTENT_PAD`: Fibonacci shell + spread extend past nominal ring radius.
 */
const FRAMING_CLOUD_EXTENT_PAD = 1.22;

function carouselFramingExtents(ringRadius: number): {
  radialMax: number;
  verticalHalf: number;
} {
  const sMax =
    CARD_MESH_BASE_SCALE * HOVER_SCALE * (1 + ZOOM_SCALE_BOOST);
  const rRing =
    ringRadius * (1 + ZOOM_RING_EXPAND) * RING_RADIAL_COMPACT;
  const radialMax =
    (rRing + (CARD_W * sMax) * 0.52 + ZOOM_DEPTH_PULL * 0.34) *
    GALLERY_GROUP_WORLD_SCALE *
    FRAMING_CLOUD_EXTENT_PAD;
  const verticalHalf =
    ((CARD_H * sMax) * 0.52 + HOVER_LIFT + ZOOM_PARALLAX_Y * 0.48) *
    GALLERY_GROUP_WORLD_SCALE *
    FRAMING_CLOUD_EXTENT_PAD;
  return { radialMax, verticalHalf };
}

/**
 * Minimum orbit distance (camera to target) so the full carousel stays inside the
 * vertical and horizontal frusta for the given FOV and aspect.
 */
function minSafeOrbitDistance(
  ringRadius: number,
  fovVerticalDeg: number,
  aspect: number,
): number {
  const { radialMax, verticalHalf } = carouselFramingExtents(ringRadius);
  const boundRadius = Math.hypot(radialMax, verticalHalf);
  const fovRad = THREE.MathUtils.degToRad(fovVerticalDeg);
  const tanHalfV = Math.tan(fovRad * 0.5);
  const tanHalfH = Math.tan(fovRad * 0.5) * Math.max(aspect, 0.25);
  const dVert = (boundRadius * FRAMING_MARGIN) / tanHalfV;
  const dHorz = (radialMax * FRAMING_MARGIN) / tanHalfH;
  /** Soft floor so tiny filters stay usable; geometric dVert usually dominates */
  return Math.max(
    dVert,
    dHorz,
    ringRadius * GALLERY_GROUP_WORLD_SCALE * 0.34 * FRAMING_CLOUD_EXTENT_PAD,
  );
}

/**
 * Minimum vertical FOV (deg) at distance `d` so carousel bounds stay in frustum.
 * Mirrors `minSafeOrbitDistance` geometry (inverse problem).
 */
function minimumVerticalFovDegrees(
  distance: number,
  ringRadius: number,
  aspect: number,
): number {
  const d = Math.max(distance, 1e-4);
  const { radialMax, verticalHalf } = carouselFramingExtents(ringRadius);
  const boundRadius = Math.hypot(radialMax, verticalHalf);
  const a = Math.max(aspect, 0.25);
  const tanHalfFromVertical = (boundRadius * FRAMING_MARGIN) / d;
  const tanHalfFromHorizontal = (radialMax * FRAMING_MARGIN) / (d * a);
  const tanHalf = Math.max(tanHalfFromVertical, tanHalfFromHorizontal);
  const capped = Math.min(tanHalf, Math.tan(THREE.MathUtils.degToRad(89)));
  return THREE.MathUtils.radToDeg(2 * Math.atan(capped));
}

function orbitZoomLimits(
  ringRadius: number,
  aspect: number,
): { min: number; max: number } {
  const geometricMin = minSafeOrbitDistance(ringRadius, CAMERA_FOV, aspect);
  /** Allow noticeably closer zoom; stay above a small ring-relative floor */
  const min = Math.max(
    geometricMin * ORBIT_MIN_DISTANCE_RELAX,
    ringRadius * GALLERY_GROUP_WORLD_SCALE * 0.26 * FRAMING_CLOUD_EXTENT_PAD,
  );
  const max = min * ORBIT_MAX_DISTANCE_RATIO;
  return { min, max };
}

/**
 * Default orbit: between min (closest zoom) and max so the scene opens zoomed out,
 * not parked at the near limit.
 */
function baseOrbitCameraDistance(
  ringRadius: number,
  aspect: number,
  /** 0 = en yakın zoom, 1 = en uzak; sparse kategoride daha düşük tutulur. */
  distanceT: number = DEFAULT_ORBIT_DISTANCE_T,
): number {
  const { min, max } = orbitZoomLimits(ringRadius, aspect);
  return THREE.MathUtils.lerp(min, max, distanceT);
}

/**
 * Places the camera on the YZ meridian at exact Euclidean distance `distance`
 * from the orbit target (matches OrbitControls distance + zoom limits).
 */
function setCameraPositionForOrbitDistance(
  camera: THREE.Camera,
  distance: number,
): void {
  const e = cameraElevationAngle();
  const sy = Math.sin(e) * distance;
  const cz = Math.cos(e) * distance;
  camera.position.set(0, ORBIT_TARGET_Y + sy, cz);
  camera.lookAt(_orbitTarget);
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.updateProjectionMatrix();
  }
}

function cameraTupleForOrbitDistance(distance: number): [number, number, number] {
  const e = cameraElevationAngle();
  return [0, ORBIT_TARGET_Y + Math.sin(e) * distance, Math.cos(e) * distance];
}

function defaultViewportAspect(): number {
  if (typeof window === "undefined") return 1.5;
  const h = Math.max(1, window.innerHeight);
  return THREE.MathUtils.clamp(window.innerWidth / h, 0.5, 2.5);
}

function RingCameraSync({
  ringRadius,
  defaultDistanceT = DEFAULT_ORBIT_DISTANCE_T,
}: {
  ringRadius: number;
  defaultDistanceT?: number;
}) {
  const { camera, size } = useThree();
  const aspect = Math.max(
    size.width / Math.max(size.height, 1),
    0.25,
  );
  const { min, max } = useMemo(
    () => orbitZoomLimits(ringRadius, aspect),
    [ringRadius, aspect],
  );
  const baseD = useMemo(
    () =>
      THREE.MathUtils.clamp(
        baseOrbitCameraDistance(ringRadius, aspect, defaultDistanceT),
        min,
        max,
      ),
    [ringRadius, aspect, min, max, defaultDistanceT],
  );

  useLayoutEffect(() => {
    setCameraPositionForOrbitDistance(camera, baseD);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.near = CAMERA_NEAR;
      camera.far = CAMERA_FAR;
      camera.updateProjectionMatrix();
    }
  }, [ringRadius, camera, baseD]);

  return null;
}

function AdaptiveFovSync({
  ringRadius,
  minDistance,
  maxDistance,
}: {
  ringRadius: number;
  minDistance: number;
  maxDistance: number;
}) {
  const { camera, size } = useThree();
  const aspect = Math.max(size.width / Math.max(size.height, 1), 0.25);

  useFrame((_, delta) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const dist = camera.position.distanceTo(_orbitTarget);
    const floorFov = minimumVerticalFovDegrees(dist, ringRadius, aspect);

    const span = Math.max(maxDistance - minDistance, 1e-5);
    const u = THREE.MathUtils.clamp((dist - minDistance) / span, 0, 1);
    const smoothT = u * u * (3 - 2 * u);
    const cinematic = THREE.MathUtils.lerp(
      ADAPTIVE_FOV_AT_MIN_DISTANCE,
      ADAPTIVE_FOV_AT_MAX_DISTANCE,
      smoothT,
    );

    const targetFov = Math.min(
      Math.max(cinematic, floorFov),
      ADAPTIVE_FOV_ABSOLUTE_CAP,
    );

    const alpha = 1 - Math.exp(-ADAPTIVE_FOV_SMOOTHING * delta);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, alpha);
    camera.updateProjectionMatrix();
  });

  return null;
}

const HOVER_LERP = 10;

/** Slow camera orbit — invisible hub; primary motion (paused on hover / modal). */
const AUTO_ROTATE_SPEED = 0.32;
const AUTO_ROTATE_SPEED_MANY = 0.48;

/** Zoom-driven layout/parallax (smoothed in useFrame) */
const ZOOM_LERP = 7;
const ZOOM_TO_CAM_Y_DAMP = 0.42;
const FACING_OPACITY_MIN = 0.44;
const FACING_OPACITY_MAX = 1;

const _scratchA = new THREE.Vector3();
const _scratchB = new THREE.Vector3();
const _toCamera = new THREE.Vector3();
const _frontNormal = new THREE.Vector3();

type ZoomFxRef = React.MutableRefObject<{
  zoomIn: number;
  camAzimuth: number;
}>;

const ZoomFxContext = createContext<ZoomFxRef | null>(null);

function ZoomFrameSync({
  minDistance,
  maxDistance,
  zoomRef,
}: {
  minDistance: number;
  maxDistance: number;
  zoomRef: ZoomFxRef;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const dist = camera.position.distanceTo(_orbitTarget);
    const zoomIn = 1 - THREE.MathUtils.smoothstep(dist, minDistance, maxDistance);
    zoomRef.current.zoomIn = zoomIn;
    zoomRef.current.camAzimuth = Math.atan2(camera.position.x, camera.position.z);
  });
  return null;
}

const PLACEHOLDER_GRAY = new THREE.Color(0x5c5c66);

/** Neutral map multiply — standard brightness/contrast on hero thumbnails. */
const COVER_PHOTO_NEUTRAL = new THREE.Color(1, 1, 1);

/** Soft disc edge: radial alpha in fragment shader (same UVs as the map). */
const DISC_FEATHER_MAP_FRAGMENT_PATCH = `#include <map_fragment>
#ifdef USE_MAP
{
	vec2 _hub = vMapUv - vec2(0.5);
	float _rr = length(_hub) * 2.0;
	diffuseColor.a *= 1.0 - smoothstep(0.75, 0.995, _rr);
}
#else
#ifdef USE_UV
{
	vec2 _hub = vUv - vec2(0.5);
	float _rr = length(_hub) * 2.0;
	diffuseColor.a *= 1.0 - smoothstep(0.75, 0.995, _rr);
}
#endif
#endif`;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

interface GallerySceneProps {
  images: GalleryImage[];
  visibleIndices: number[];
  /** Layout shell radius (card positions). */
  ringRadius: number;
  /** Wider radius for orbit min/max + FOV when “All” cloud needs extra margin. */
  orbitFramingRadius: number;
  /** Effective `ALL_CLOUD_LAYOUT_SCALE` × optional sparse-category boost. */
  cardScaleMul: number;
  /** Initial orbit distance lerp (RingCameraSync + Canvas open frame). */
  orbitDefaultDistanceT: number;
  /** Fibonacci shell + drift (full gallery always uses this layout). */
  allCategoryLayout: boolean;
  orbitControlsRef: MutableRefObject<StdOrbitControls | null>;
  hoveredIndex: number | null;
  setHoveredIndex: (i: number | null) => void;
  modalOpen: boolean;
  onPick: (image: GalleryImage) => void;
  onSoftGalleryHint: () => void;
}

function GalleryCardMesh({
  image,
  slot,
  visibleCount,
  radius,
  cardScaleMul,
  satelliteFloat,
  allCategoryLayout,
  hovered,
  modalOpen,
  onHoverStart,
  onHoverEnd,
  onPick,
  onSoftGalleryHint,
}: {
  image: GalleryImage;
  slot: number;
  visibleCount: number;
  radius: number;
  /** Multiplier on {@link CARD_MESH_BASE_SCALE} (cloud disc layout). */
  cardScaleMul: number;
  /** Cloud shell: Fibonacci positions + drift (same for “All” and single categories). */
  satelliteFloat: boolean;
  /** “All” kategorisi: yatay / rastgele dağılım. */
  allCategoryLayout: boolean;
  hovered: boolean;
  modalOpen: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onPick: () => void;
  onSoftGalleryHint: () => void;
}) {
  const zoomFxRef = useContext(ZoomFxContext);
  const prefersReducedMotion = usePrefersReducedMotion();
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const smoothZoomRef = useRef(0);
  const smoothOpacityRef = useRef(1);
  const smoothMeshScaleRef = useRef(CARD_MESH_BASE_SCALE);
  /** Smoothed distance-based scale in “All” (near = larger, far = smaller). */
  const smoothDepthScaleRef = useRef(1);
  /** Hover lift only — kept separate so “All” satellite float does not fight the hover lerp. */
  const smoothHoverYRef = useRef(0);

  const finalImageUrl = primaryGalleryImageUrl(image);
  const texture = useResilientTexture(finalImageUrl);

  const backMap = useMemo(() => {
    if (!texture) return null;
    const t = texture.clone();
    t.wrapS = THREE.RepeatWrapping;
    /** Horizontal mirror of the front face UVs (matches square crop) */
    t.repeat.set(-texture.repeat.x, texture.repeat.y);
    t.offset.set(texture.repeat.x + texture.offset.x, texture.offset.y);
    t.needsUpdate = true;
    return t;
  }, [texture]);

  useEffect(() => {
    return () => {
      if (backMap) backMap.dispose();
    };
  }, [backMap]);

  const geometry = useMemo(() => {
    if (satelliteFloat) {
      /** Diameter ≈ prior square width; single texture covers the full disc. */
      const radius = CARD_W * 0.5;
      return new THREE.CircleGeometry(
        radius,
        ALL_CLOUD_CIRCLE_SEGMENTS,
      );
    }
    return new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D);
  }, [satelliteFloat]);

  /**
   * “All”: one circular mesh, one hero texture (no repeated faces).
   * Filtered: box with front/back + gray edges.
   */
  const circleMaterial = useMemo(() => {
    if (!satelliteFloat) return null;
    const hasMap = Boolean(texture);
    const mat = new THREE.MeshBasicMaterial({
      map: texture ?? undefined,
      color: hasMap ? COVER_PHOTO_NEUTRAL.clone() : PLACEHOLDER_GRAY,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mat.customProgramCacheKey = () => "galleryDiscFeather:v5";
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        DISC_FEATHER_MAP_FRAGMENT_PATCH,
      );
    };
    return mat;
  }, [texture, satelliteFloat]);

  const boxMaterials = useMemo(() => {
    if (satelliteFloat) return null;
    const hasMap = Boolean(texture);
    const frontTint = hasMap ? COVER_PHOTO_NEUTRAL.clone() : PLACEHOLDER_GRAY;

    const edgeGray = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x9a9ca8),
      roughness: 0.55,
      metalness: 0.05,
      transparent: false,
      opacity: 1,
      depthWrite: true,
    });
    const front = new THREE.MeshBasicMaterial({
      map: texture ?? undefined,
      color: frontTint,
      transparent: false,
      opacity: 1,
      depthWrite: true,
    });
    const back = new THREE.MeshStandardMaterial({
      map: backMap ?? texture ?? undefined,
      color: hasMap ? new THREE.Color(0.78, 0.78, 0.82) : PLACEHOLDER_GRAY,
      roughness: 0.91,
      metalness: 0,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
      transparent: false,
      opacity: 1,
      depthWrite: true,
    });
    return [edgeGray, edgeGray, edgeGray, edgeGray, front, back] as [
      THREE.MeshStandardMaterial,
      THREE.MeshStandardMaterial,
      THREE.MeshStandardMaterial,
      THREE.MeshStandardMaterial,
      THREE.MeshBasicMaterial,
      THREE.MeshStandardMaterial,
    ];
  }, [texture, backMap, satelliteFloat]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    return () => {
      if (circleMaterial) {
        circleMaterial.map = null;
        circleMaterial.dispose();
      }
    };
  }, [circleMaterial]);

  useEffect(() => {
    return () => {
      if (!boxMaterials) return;
      const seen = new Set<THREE.Material>();
      boxMaterials.forEach((m) => {
        if (seen.has(m)) return;
        seen.add(m);
        m.map = null;
        m.dispose();
      });
    };
  }, [boxMaterials]);

  const { camera } = useThree();

  useLayoutEffect(() => {
    smoothMeshScaleRef.current = CARD_MESH_BASE_SCALE * cardScaleMul;
  }, [satelliteFloat, cardScaleMul]);

  useLayoutEffect(() => {
    smoothDepthScaleRef.current = 1;
  }, [satelliteFloat]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    const mesh = meshRef.current;
    if (!g || !mesh || !zoomFxRef) return;

    const floatT = state.clock.elapsedTime;
    const n = Math.max(visibleCount, 1);
    const angle = (slot / n) * Math.PI * 2;

    const zk = Math.min(1, delta * ZOOM_LERP);
    const zTarget = zoomFxRef.current.zoomIn;
    smoothZoomRef.current = THREE.MathUtils.lerp(
      smoothZoomRef.current,
      zTarget,
      zk,
    );
    const zi = smoothZoomRef.current;

    const t = Math.min(1, delta * HOVER_LERP);
    const zoomScale = 1 + ZOOM_SCALE_BOOST * zi;
    const targetS =
      CARD_MESH_BASE_SCALE *
      cardScaleMul *
      (hovered ? HOVER_SCALE : 1) *
      zoomScale;
    const targetY = hovered ? HOVER_LIFT : 0;

    const s = THREE.MathUtils.lerp(smoothMeshScaleRef.current, targetS, t);
    smoothMeshScaleRef.current = s;
    g.scale.set(1, 1, 1);

    const yHover = THREE.MathUtils.lerp(smoothHoverYRef.current, targetY, t);
    smoothHoverYRef.current = yHover;

    const depth = ZOOM_DEPTH_PULL * zi;

    let px: number;
    let pz: number;
    let localY: number;
    let dx: number;
    let dz: number;
    let yaw: number;

    if (satelliteFloat) {
      const shellR = radius * (1 + ZOOM_RING_EXPAND * zi) * 1.2;
      const [cx, cy, cz] = allCloudBasePosition(slot, n, shellR, allCategoryLayout);

      _toCamera.subVectors(
        camera.position,
        _scratchA.set(cx, ORBIT_TARGET_Y + cy, cz),
      );
      const len0 = _toCamera.length();
      if (len0 > 1e-6) _toCamera.multiplyScalar(1 / len0);
      _toCamera.y *= ZOOM_TO_CAM_Y_DAMP;
      _toCamera.normalize();

      let basePx = cx + _toCamera.x * depth;
      let basePy = cy + _toCamera.y * depth * ZOOM_TO_CAM_Y_DAMP;
      let basePz = cz + _toCamera.z * depth;
      const cloudCompact = 0.98;
      basePx *= cloudCompact;
      basePy *= cloudCompact;
      basePz *= cloudCompact;

      const phase = slot * 1.884 + n * 0.31;
      let driftX = 0;
      let driftY = 0;
      let driftZ = 0;
      if (!prefersReducedMotion) {
        const slow = floatT * 0.19;
        const glide = floatT * 0.105;
        driftX =
          ALL_CLOUD_DRIFT_AMP * Math.sin(slow + phase) +
          ALL_CLOUD_GLIDE_AMP * Math.sin(glide + phase * 0.73) +
          ALL_CLOUD_GLIDE_AMP * 0.42 * Math.cos(glide * 0.88 + phase * 1.07);
        driftY =
          ALL_CLOUD_DRIFT_AMP * 0.78 * Math.sin(slow * 1.04 + phase * 1.28) +
          ALL_CLOUD_GLIDE_AMP * 0.58 * Math.sin(glide * 0.91 + phase * 0.5);
        driftZ =
          ALL_CLOUD_DRIFT_AMP * Math.sin(slow * 0.91 + phase * 0.88) +
          ALL_CLOUD_GLIDE_AMP * Math.cos(glide + phase * 1.12) +
          ALL_CLOUD_GLIDE_AMP * 0.38 * Math.sin(glide * 0.79 + phase * 0.66);
      }

      /** Kabuk üzerinde: drift’in merkeze doğru bileşenini kes (içe/dışa zıplama + ani ölçek azalır). */
      {
        const rl = Math.hypot(basePx, basePy, basePz);
        if (rl > 1e-5) {
          const qx = basePx / rl;
          const qy = basePy / rl;
          const qz = basePz / rl;
          const rad = driftX * qx + driftY * qy + driftZ * qz;
          const k = ALL_CLOUD_DRIFT_RADIAL_DAMP;
          driftX -= rad * qx * k;
          driftY -= rad * qy * k;
          driftZ -= rad * qz * k;
        }
      }

      const dx3 = -basePx;
      const dy3 = -basePy;
      const dz3 = -basePz;
      const radialLen3 = Math.hypot(dx3, dy3, dz3);
      let inwardX = 0;
      let inwardY = 0;
      let inwardZ = 0;
      if (radialLen3 > 1e-6) {
        inwardX = dx3 / radialLen3;
        inwardY = dy3 / radialLen3;
        inwardZ = dz3 / radialLen3;
      }
      const inwardPull = (s - 1) * SCALE_INWARD_K * radius;
      const py =
        basePy + inwardY * inwardPull + driftY;
      px = basePx + inwardX * inwardPull + driftX;
      pz = basePz + inwardZ * inwardPull + driftZ;
      localY = py + yHover;

      dx = -basePx;
      dz = -basePz;

      _toCamera.subVectors(
        camera.position,
        _scratchA.set(px, ORBIT_TARGET_Y + localY, pz),
      );
      _toCamera.y = 0;
      const hLen = Math.hypot(_toCamera.x, _toCamera.z);
      if (hLen > 1e-6) {
        yaw = Math.atan2(_toCamera.x, _toCamera.z);
      } else {
        yaw = Math.atan2(dx, dz) - Math.PI / 2;
      }

      g.rotation.set(0, 0, 0);
      /** Billboards toward camera — no local-axis spin (no pitch/roll wobble). */
      mesh.rotation.set(0, yaw, 0);
    } else {
      const R = radius * (1 + ZOOM_RING_EXPAND * zi);
      const bx = Math.sin(angle) * R;
      const bz = Math.cos(angle) * R;

      _toCamera.subVectors(
        camera.position,
        _scratchA.set(bx, ORBIT_TARGET_Y, bz),
      );
      const len = _toCamera.length();
      if (len > 1e-6) _toCamera.multiplyScalar(1 / len);
      _toCamera.y *= ZOOM_TO_CAM_Y_DAMP;
      _toCamera.normalize();

      let basePx = bx + _toCamera.x * depth;
      let basePz = bz + _toCamera.z * depth;
      basePx *= RING_RADIAL_COMPACT;
      basePz *= RING_RADIAL_COMPACT;

      dx = -basePx;
      dz = -basePz;
      const radialLen = Math.hypot(dx, dz);
      let inwardX = 0;
      let inwardZ = 0;
      if (radialLen > 1e-6) {
        inwardX = dx / radialLen;
        inwardZ = dz / radialLen;
      }
      const inwardPull = (s - 1) * SCALE_INWARD_K * radius;
      px = basePx + inwardX * inwardPull;
      pz = basePz + inwardZ * inwardPull;
      localY = yHover;

      _toCamera.subVectors(
        camera.position,
        _scratchA.set(px, ORBIT_TARGET_Y + localY, pz),
      );
      _toCamera.y = 0;
      const hLen = Math.hypot(_toCamera.x, _toCamera.z);
      if (hLen > 1e-6) {
        yaw = Math.atan2(_toCamera.x, _toCamera.z);
      } else {
        yaw = Math.atan2(dx, dz) - Math.PI / 2;
      }
      g.rotation.set(0, 0, 0);
      mesh.rotation.set(0, yaw, 0);
    }

    g.position.set(px, localY, pz);

    let depthScaleMul = 1;
    if (satelliteFloat) {
      const S = GALLERY_GROUP_WORLD_SCALE;
      _scratchB.set(
        px * S,
        ORBIT_TARGET_Y + localY * S,
        pz * S,
      );
      const distCam = camera.position.distanceTo(_scratchB);
      const refD = camera.position.distanceTo(_orbitTarget);
      const perspectiveTarget = THREE.MathUtils.clamp(
        refD / Math.max(distCam, 0.01),
        ALL_CLOUD_PERSPECTIVE_CLAMP_MIN,
        ALL_CLOUD_PERSPECTIVE_CLAMP_MAX,
      );
      smoothDepthScaleRef.current = THREE.MathUtils.lerp(
        smoothDepthScaleRef.current,
        perspectiveTarget,
        Math.min(1, delta * ALL_CLOUD_DEPTH_SMOOTH_SPEED),
      );
      depthScaleMul = smoothDepthScaleRef.current;
    } else {
      smoothDepthScaleRef.current = THREE.MathUtils.lerp(
        smoothDepthScaleRef.current,
        1,
        Math.min(1, delta * 18),
      );
      depthScaleMul = smoothDepthScaleRef.current;
    }
    mesh.scale.setScalar(s * depthScaleMul);

    _frontNormal.set(0, 0, 1).applyAxisAngle(
      THREE.Object3D.DEFAULT_UP,
      yaw,
    );
    _toCamera.subVectors(
      camera.position,
      _scratchA.set(px, ORBIT_TARGET_Y + localY, pz),
    );
    const dCam = _toCamera.length();
    if (dCam > 1e-6) _toCamera.multiplyScalar(1 / dCam);
    const facing = THREE.MathUtils.clamp(_frontNormal.dot(_toCamera), 0, 1);
    const targetOp = THREE.MathUtils.lerp(
      FACING_OPACITY_MIN,
      FACING_OPACITY_MAX,
      0.18 + 0.82 * facing,
    );
    smoothOpacityRef.current = THREE.MathUtils.lerp(
      smoothOpacityRef.current,
      targetOp,
      Math.min(1, delta * ZOOM_LERP * 0.85),
    );
    const op = smoothOpacityRef.current;

    const mats = mesh.material;
    if (satelliteFloat && !Array.isArray(mats)) {
      const m = mats as THREE.MeshBasicMaterial;
      m.opacity = op;
      m.transparent = true;
      m.depthWrite = false;
    } else {
      const list = Array.isArray(mats) ? mats : [mats];
      /** Box face order: +x, −x, +y, −y, +z (front), −z (back) */
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (i === 4 || i === 5) {
          m.opacity = 1;
          m.transparent = false;
          m.depthWrite = true;
          continue;
        }
        const edge = m as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
        edge.opacity = op;
        edge.transparent = op < 0.998;
        edge.depthWrite = op > 0.92;
      }
    }
  });

  return (
    <group ref={groupRef} frustumCulled={false}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={
          satelliteFloat ? (circleMaterial as THREE.MeshBasicMaterial) : boxMaterials!
        }
        frustumCulled={false}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          if (modalOpen) return;
          onHoverStart();
        }}
        onPointerOut={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHoverEnd();
        }}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onSoftGalleryHint();
          prefetchDetailModalMedia(image.images);
          pointerDown.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          const p = pointerDown.current;
          pointerDown.current = null;
          if (modalOpen || !p) return;
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12) {
            return;
          }
          onPick();
        }}
      />
    </group>
  );
}

function SceneCursor({ hovered }: { hovered: boolean }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.domElement.style.cursor = hovered ? "pointer" : "grab";
  }, [gl, hovered]);
  return null;
}

/** Dev-only: formatted console snapshot of camera, orbit, and ring (see user request). */
const GALLERY_SCENE_DEBUG =
  typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

type OrbitControlsLike = {
  minDistance: number;
  maxDistance: number;
  target: THREE.Vector3;
  getPolarAngle: () => number;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

function GallerySceneDebugLogger({
  ringRadius,
  minDistance,
  maxDistance,
  logOnInteraction,
}: {
  ringRadius: number;
  minDistance: number;
  maxDistance: number;
  /** Log again on orbit start/end (avoids spamming every `change` frame) */
  logOnInteraction: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsLike | null;

  const logSnapshot = useCallback(
    (label: string) => {
      if (!controls) return;
      const p = camera.position;
      const t = controls.target;
      const dist = p.distanceTo(t);
      const polar = controls.getPolarAngle();
      const polarDeg = THREE.MathUtils.radToDeg(polar);
      const isPersp = camera instanceof THREE.PerspectiveCamera;

      console.log(
        [
          "",
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          `[Gallery3D / 3D scene] ${label}`,
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          "▸ Camera",
          `    position:     x=${p.x.toFixed(4)}  y=${p.y.toFixed(4)}  z=${p.z.toFixed(4)}`,
          `    fov:          ${isPersp ? `${camera.fov.toFixed(3)}° (vertical)` : "N/A (not PerspectiveCamera)"}`,
          `    near / far:   ${isPersp ? `${camera.near} / ${camera.far}` : "N/A"}`,
          "",
          "▸ OrbitControls",
          `    distance (camera → target): ${dist.toFixed(4)}`,
          `    target (world):             x=${t.x.toFixed(4)}  y=${t.y.toFixed(4)}  z=${t.z.toFixed(4)}`,
          `    minDistance / maxDistance:  ${controls.minDistance.toFixed(4)} / ${controls.maxDistance.toFixed(4)}`,
          `    polar angle:                ${polar.toFixed(5)} rad  (${polarDeg.toFixed(2)}°)`,
          "",
          "▸ Gallery ring",
          `    carousel center (world):    matches orbit target above (ring group origin)`,
          `    ringRadius (layout math):   ${ringRadius.toFixed(4)}`,
          `    group vertical offset:      Y = ${ORBIT_TARGET_Y}  (group position [0, ORBIT_TARGET_Y, 0])`,
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          "",
        ].join("\n"),
      );
    },
    [camera, controls, ringRadius],
  );

  useEffect(() => {
    if (!GALLERY_SCENE_DEBUG || !controls) return;

    let rafOuter = 0;
    let rafInner = 0;
    rafOuter = requestAnimationFrame(() => {
      rafInner = requestAnimationFrame(() => {
        logSnapshot("first load (after camera + controls sync)");
      });
    });

    const onStart = () => {
      if (logOnInteraction) logSnapshot("interaction start");
    };
    const onEnd = () => {
      if (logOnInteraction) logSnapshot("interaction end");
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);

    return () => {
      cancelAnimationFrame(rafOuter);
      cancelAnimationFrame(rafInner);
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
    };
  }, [controls, logOnInteraction, logSnapshot]);

  return null;
}

function GalleryScene({
  images,
  visibleIndices,
  ringRadius,
  orbitFramingRadius,
  cardScaleMul,
  orbitDefaultDistanceT,
  allCategoryLayout,
  orbitControlsRef,
  hoveredIndex,
  setHoveredIndex,
  modalOpen,
  onPick,
  onSoftGalleryHint,
}: GallerySceneProps) {
  const visibleCount = visibleIndices.length;
  const satelliteFloat = true;
  const autoRotateSpeed =
    visibleCount >= 2 ? AUTO_ROTATE_SPEED_MANY : AUTO_ROTATE_SPEED;

  const { size } = useThree();
  const aspect = Math.max(size.width / Math.max(size.height, 1), 0.25);
  const { min: minZoomDistance, max: maxZoomDistance } = useMemo(
    () => orbitZoomLimits(orbitFramingRadius, aspect),
    [orbitFramingRadius, aspect],
  );
  const zoomFxRef = useRef({ zoomIn: 0, camAzimuth: 0 });

  return (
    <ZoomFxContext.Provider value={zoomFxRef}>
      <ZoomFrameSync
        minDistance={minZoomDistance}
        maxDistance={maxZoomDistance}
        zoomRef={zoomFxRef}
      />
      <SceneCursor hovered={hoveredIndex !== null} />
      <ambientLight intensity={0.78} />
      <directionalLight position={[4.5, 8, 6]} intensity={1.02} />
      <directionalLight position={[-3, 2, -2]} intensity={0.32} />

      <DreiOrbitControls
        ref={orbitControlsRef}
        makeDefault
        enabled={!modalOpen}
        enablePan={false}
        enableZoom={!modalOpen}
        zoomSpeed={0.55}
        enableDamping
        dampingFactor={0.052}
        minDistance={minZoomDistance}
        maxDistance={maxZoomDistance}
        autoRotate={!modalOpen && hoveredIndex === null}
        autoRotateSpeed={autoRotateSpeed}
        minPolarAngle={THREE.MathUtils.degToRad(78)}
        maxPolarAngle={THREE.MathUtils.degToRad(88)}
        target={[0, ORBIT_TARGET_Y, 0]}
        onStart={onSoftGalleryHint}
      />
      <RingCameraSync
        ringRadius={orbitFramingRadius}
        defaultDistanceT={orbitDefaultDistanceT}
      />
      <AdaptiveFovSync
        ringRadius={orbitFramingRadius}
        minDistance={minZoomDistance}
        maxDistance={maxZoomDistance}
      />
      {GALLERY_SCENE_DEBUG ? (
        <GallerySceneDebugLogger
          ringRadius={orbitFramingRadius}
          minDistance={minZoomDistance}
          maxDistance={maxZoomDistance}
          logOnInteraction
        />
      ) : null}

      <group
        position={[0, ORBIT_TARGET_Y, 0]}
        scale={GALLERY_GROUP_WORLD_SCALE}
        frustumCulled={false}
      >
        {visibleIndices.map((imageIndex, slot) => {
          const image = images[imageIndex];
          if (!image) return null;
          return (
            <GalleryCardMesh
              key={`card-${imageIndex}`}
              image={image}
              slot={slot}
              visibleCount={visibleIndices.length}
              radius={ringRadius}
              cardScaleMul={cardScaleMul}
              satelliteFloat={satelliteFloat}
              allCategoryLayout={allCategoryLayout}
              hovered={hoveredIndex === imageIndex}
              modalOpen={modalOpen}
              onHoverStart={() => {
                setHoveredIndex(imageIndex);
              }}
              onHoverEnd={() => {
                setHoveredIndex(null);
              }}
              onPick={() => onPick(image)}
              onSoftGalleryHint={onSoftGalleryHint}
            />
          );
        })}
      </group>
    </ZoomFxContext.Provider>
  );
}

/** Portfolio detail: index `0` is hero only; `1+` stacked vertically, aspect preserved. */
const ProjectImageScroll = forwardRef(function ProjectImageScroll(
  {
    urls,
    heroAlt,
  }: {
    urls: string[];
    heroAlt: string;
  },
  forwardedRef: Ref<HTMLDivElement>,
) {
  const detailUrls = useMemo(() => detailPageMediaUrls(urls), [urls]);
  const firstVideoUrl = useMemo(() => firstDetailVideoUrl(urls), [urls]);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const setScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      (scrollRef as MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef != null) {
        (forwardedRef as MutableRefObject<HTMLDivElement | null>).current =
          node;
      }
    },
    [forwardedRef],
  );
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const detailUrlsKey = useMemo(() => detailUrls.join("\0"), [detailUrls]);
  const heroUrl = useMemo(() => primaryGalleryTextureUrl(urls), [urls]);
  const [readyUrls, setReadyUrls] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setReadyUrls(new Set());
  }, [detailUrlsKey]);

  const markDetailMediaReady = useCallback((u: string) => {
    setReadyUrls((prev) => {
      if (prev.has(u)) return prev;
      const next = new Set(prev);
      next.add(u);
      return next;
    });
  }, []);

  const readyUrlsKey = useMemo(
    () =>
      [...readyUrls].sort().join("\0") +
      "|" +
      Object.keys(failed).sort().join("\0"),
    [readyUrls, failed],
  );

  const srcFor = useCallback(
    (url: string) =>
      failed[url] ? fallbackImageUrl() : url,
    [failed],
  );

  const syncPlayback = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;
    syncDetailVideoPlayback(
      root,
      detailUrls,
      srcFor,
      failed,
      itemRefs.current,
      videoRefs.current,
    );
  }, [detailUrls, srcFor, failed]);

  const playbackRafRef = useRef(0);
  const schedulePlaybackSync = useCallback(() => {
    if (playbackRafRef.current !== 0) return;
    playbackRafRef.current = requestAnimationFrame(() => {
      playbackRafRef.current = 0;
      syncPlayback();
    });
  }, [syncPlayback]);

  useLayoutEffect(() => {
    itemRefs.current.length = detailUrls.length;
    videoRefs.current.length = detailUrls.length;
  }, [detailUrls.length]);

  useEffect(() => {
    return () => {
      if (playbackRafRef.current !== 0) {
        cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = 0;
      }
    };
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || detailUrls.length === 0) return;
    syncPlayback();
    root.addEventListener("scroll", schedulePlaybackSync, { passive: true });
    const ro = new ResizeObserver(() => schedulePlaybackSync());
    ro.observe(root);
    window.addEventListener("resize", schedulePlaybackSync);
    return () => {
      root.removeEventListener("scroll", schedulePlaybackSync);
      ro.disconnect();
      window.removeEventListener("resize", schedulePlaybackSync);
    };
  }, [detailUrls.length, schedulePlaybackSync, syncPlayback]);

  useLayoutEffect(() => {
    if (detailUrls.length === 0) return;
    syncPlayback();
  }, [detailUrls, failed, syncPlayback]);

  useEffect(() => {
    schedulePlaybackSync();
  }, [readyUrlsKey, detailUrlsKey, schedulePlaybackSync]);

  /** No `1+` media — still show hero (`0.*`) so the modal is never empty. */
  if (detailUrls.length === 0) {
    return (
      <div
        ref={setScrollRef}
        className="min-h-[min(70vh,580px)] w-full min-w-0 bg-app-shell-bg/40"
        role="region"
        aria-label={heroAlt}
      >
        <img
          src={heroUrl}
          alt={heroAlt}
          className="block h-auto max-w-full w-full select-none object-contain"
          draggable={false}
          loading="eager"
          decoding="async"
          onError={(e) => {
            const el = e.currentTarget;
            el.onerror = null;
            el.src = fallbackImageUrl();
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={setScrollRef}
      className="max-h-[min(70vh,580px)] w-full min-w-0 overflow-y-auto overscroll-y-contain bg-app-shell-bg/35 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
      role="region"
      aria-label={heroAlt}
    >
      <div className="flex w-full flex-col gap-8">
        {detailUrls.map((url, i) => {
          const src = srcFor(url);
          const indexLabel = galleryFilenameIndex(url);
          const showVideo = !failed[url] && isVideoUrl(src);
          const label =
            indexLabel != null ? `${heroAlt} — ${indexLabel}` : heroAlt;
          const isPrimaryDetailVideo =
            showVideo && firstVideoUrl != null && url === firstVideoUrl;
          return (
            <div
              key={`${url}-${i}`}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className="w-full min-h-[4rem] shrink-0"
            >
              {showVideo ? (
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  src={src}
                  controls
                  controlsList="nodownload"
                  playsInline
                  preload={isPrimaryDetailVideo ? "auto" : "metadata"}
                  {...(isPrimaryDetailVideo
                    ? ({ fetchPriority: "high" } as VideoHTMLAttributes<HTMLVideoElement>)
                    : ({
                        fetchPriority: "low",
                      } as VideoHTMLAttributes<HTMLVideoElement>))}
                  className="block h-auto max-w-full w-full bg-black/20"
                  aria-label={label}
                  onLoadedMetadata={() => {
                    markDetailMediaReady(url);
                    schedulePlaybackSync();
                  }}
                  onLoadedData={(e) => {
                    const v = e.currentTarget;
                    if (v.dataset.portfolioDefaultVolume !== "1") {
                      v.dataset.portfolioDefaultVolume = "1";
                      v.volume = DETAIL_VIDEO_VOLUME;
                    }
                    markDetailMediaReady(url);
                    schedulePlaybackSync();
                  }}
                  onCanPlay={schedulePlaybackSync}
                  onError={() => {
                    setFailed((f) => ({ ...f, [url]: true }));
                    markDetailMediaReady(url);
                    console.error("[Gallery3D] Modal video failed:", url);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                  }}
                />
              ) : (
                <img
                  src={src}
                  alt={label}
                  className="block h-auto max-w-full w-full select-none bg-black/10"
                  draggable={false}
                  loading={i <= 1 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={i === 0 ? "high" : i === 1 ? "high" : "low"}
                  onLoad={() => {
                    markDetailMediaReady(url);
                  }}
                  onError={() => {
                    setFailed((f) => ({ ...f, [url]: true }));
                    markDetailMediaReady(url);
                    console.error("[Gallery3D] Modal image failed:", url);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

ProjectImageScroll.displayName = "ProjectImageScroll";

export function Gallery3D({
  images,
  onOpenImage,
  onCloseModal,
}: Gallery3DProps) {
  const { messages } = useLanguage();
  const { gallery: galleryCopy } = messages;

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  const selectedPortfolioCopy = useMemo(
    () =>
      selectedImage == null
        ? null
        : portfolioProjectCopy(messages, selectedImage.projectKey),
    [messages, selectedImage],
  );

  useEffect(() => {
    logGalleryHeroLoadErrorsInDev(images);
  }, [images]);

  const noopSoftGalleryHint = useCallback(() => {}, []);

  const orbitControlsRef = useRef<StdOrbitControls | null>(null);

  const visibleIndices = useMemo(
    () => images.map((_, i) => i),
    [images],
  );

  const ringRadius = useMemo(() => {
    return ringRadiusWorld(visibleIndices.length, ORBIT_MIN_RADIUS_ALL, false);
  }, [visibleIndices.length]);

  const orbitFramingRadius = useMemo(
    () => ringRadius * ALL_CLOUD_FRAMING_RADIUS_MULT,
    [ringRadius],
  );

  const orbitDefaultDistanceT = DEFAULT_ORBIT_DISTANCE_T;

  const galleryCardScaleMul = useMemo(
    () => ALL_CLOUD_LAYOUT_SCALE * GALLERY_COVER_GLOBAL_SCALE,
    [],
  );

  const cameraWorldPos = useMemo((): [number, number, number] => {
    const aspect = defaultViewportAspect();
    const { min, max } = orbitZoomLimits(orbitFramingRadius, aspect);
    const D = THREE.MathUtils.clamp(
      baseOrbitCameraDistance(
        orbitFramingRadius,
        aspect,
        orbitDefaultDistanceT,
      ),
      min,
      max,
    );
    return cameraTupleForOrbitDistance(D);
  }, [orbitFramingRadius, orbitDefaultDistanceT]);

  const closeModal = useCallback(() => {
    setSelectedImage(null);
    onCloseModal?.();
  }, [onCloseModal]);

  const handlePick = useCallback(
    (image: GalleryImage) => {
      prefetchDetailModalMedia(image.images);
      setSelectedImage(image);
      onOpenImage?.(image);
    },
    [onOpenImage],
  );

  const detailModalOpen = selectedImage !== null;
  const detailModalScrollRef = useRef<HTMLDivElement>(null);
  const modalDetailWheelRootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!detailModalOpen) return;
    const root = modalDetailWheelRootRef.current;
    if (!root) return;

    const onWheel = (e: WheelEvent) => {
      const scrollEl = detailModalScrollRef.current;
      if (!scrollEl) return;
      if (scrollEl.scrollHeight <= scrollEl.clientHeight + 1) return;

      const delta = e.deltaY;
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const atTop = scrollTop <= 0.5;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 0.5;

      if (delta < 0 && atTop) return;
      if (delta > 0 && atBottom) return;

      e.preventDefault();
      scrollEl.scrollTop += delta;
    };

    root.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => root.removeEventListener("wheel", onWheel, true);
  }, [detailModalOpen, selectedImage?.projectKey]);

  useEffect(() => {
    if (!detailModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detailModalOpen]);

  useEffect(() => {
    if (!detailModalOpen) {
      clearGalleryDetailVideoPreload();
      return;
    }
    return () => {
      clearGalleryDetailVideoPreload();
    };
  }, [detailModalOpen]);

  /** Full gallery: Fibonacci cloud shell + drift. */
  const allFibonacciShellLayout = true;

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
      <div className="flex min-h-0 w-full flex-1 flex-col px-2 pb-0 pt-0 sm:px-4">
        <div
          className="relative min-h-[220px] w-full min-w-0 flex-1 basis-0 select-none bg-background sm:min-h-[240px]"
          style={{
            touchAction: "none",
            backgroundImage: "var(--app-shell-gradient)",
            backgroundAttachment: "fixed",
          }}
        >
          <Canvas
            className="absolute inset-0 h-full w-full touch-none [transform:translateZ(0)]"
            gl={{
              antialias: true,
              alpha: true,
              premultipliedAlpha: false,
              preserveDrawingBuffer: true,
              powerPreference: "high-performance",
            }}
            camera={{
              fov: CAMERA_FOV,
              near: CAMERA_NEAR,
              far: CAMERA_FAR,
              position: cameraWorldPos,
            }}
            onCreated={({ gl, scene, camera }) => {
              scene.background = null;
              gl.setClearColor(0x000000, 0);
              gl.setClearAlpha(0);
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.02;
              if (camera instanceof THREE.PerspectiveCamera) {
                camera.fov = CAMERA_FOV;
                camera.near = CAMERA_NEAR;
                camera.far = CAMERA_FAR;
              }
              camera.position.set(
                cameraWorldPos[0],
                cameraWorldPos[1],
                cameraWorldPos[2],
              );
              camera.lookAt(0, ORBIT_TARGET_Y, 0);
              if (camera instanceof THREE.PerspectiveCamera) {
                camera.updateProjectionMatrix();
              }
            }}
          >
            <GalleryScene
              images={images}
              visibleIndices={visibleIndices}
              ringRadius={ringRadius}
              orbitFramingRadius={orbitFramingRadius}
              cardScaleMul={galleryCardScaleMul}
              orbitDefaultDistanceT={orbitDefaultDistanceT}
              allCategoryLayout={allFibonacciShellLayout}
              orbitControlsRef={orbitControlsRef}
              hoveredIndex={hoveredIndex}
              setHoveredIndex={setHoveredIndex}
              modalOpen={detailModalOpen}
              onPick={handlePick}
              onSoftGalleryHint={noopSoftGalleryHint}
            />
          </Canvas>
        </div>

        <p
          className="pointer-events-none w-full max-w-lg shrink-0 self-center px-4 pb-1 pt-2 text-center text-[11px] font-medium italic leading-snug tracking-[0.12em] text-muted-foreground sm:pb-1.5"
          aria-live="polite"
        >
          {galleryCopy.exploreHint}
        </p>
      </div>

      <AnimatePresence>
        {selectedImage && selectedPortfolioCopy ? (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-50 [isolation:isolate]"
          >
            <div
              ref={modalDetailWheelRootRef}
              className="absolute inset-0 overflow-y-auto overscroll-y-contain p-6 sm:p-10 flex items-start justify-center"
              style={{
                background: "var(--modal-backdrop)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
              onClick={closeModal}
              role="presentation"
            >
            <motion.div
              key="modal-card"
              initial={{ scale: 0.94, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 20 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="relative my-auto flex w-full max-w-6xl min-h-0 flex-col items-stretch gap-10 lg:flex-row lg:items-start lg:gap-14"
              onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            >
              <div className="min-h-0 w-full min-w-0 flex-1 shrink-0 bg-app-shell-bg lg:max-w-[min(100%,560px)]">
                <ProjectImageScroll
                  ref={detailModalScrollRef}
                  key={`${selectedImage.projectKey}|${selectedImage.images.join("|")}`}
                  urls={selectedImage.images}
                  heroAlt={selectedPortfolioCopy.title}
                />
              </div>

              <motion.div
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{
                  delay: 0.1,
                  duration: 0.4,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="flex min-h-0 w-full flex-1 flex-col justify-start gap-10 lg:sticky lg:top-24 lg:max-w-md lg:self-start"
              >
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {localizedCategory(messages, selectedImage.category)}
                  </p>
                  <h2
                    className="mb-4 tracking-tight text-foreground"
                    style={{ fontSize: "1.75rem", lineHeight: 1.25 }}
                  >
                    {selectedPortfolioCopy.title}
                  </h2>
                  <p className="text-[0.95rem] leading-relaxed text-muted-foreground">
                    {selectedPortfolioCopy.description}
                  </p>
                </div>

                <div className="border-t border-border pt-10">
                  <div className="flex flex-col gap-6">
                    {selectedPortfolioCopy.tools.trim() !== "" ? (
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-4">
                        <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {galleryCopy.modalToolsLabel ?? "Tools"}
                        </span>
                        <p className="text-[0.95rem] leading-relaxed text-muted-foreground sm:min-w-0 sm:flex-1">
                          {selectedPortfolioCopy.tools}
                        </p>
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-4">
                      <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {galleryCopy.modalYear}
                      </span>
                      <span className="text-[0.95rem] leading-relaxed text-muted-foreground tabular-nums sm:min-w-0 sm:flex-1">
                        {selectedPortfolioCopy.year}
                      </span>
                    </div>
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={closeModal}
                  className="mt-2 w-fit rounded-full bg-primary px-6 py-2.5 text-sm tracking-wide text-primary-foreground"
                  style={{ fontWeight: 500 }}
                >
                  {galleryCopy.backToGallery}
                </motion.button>
              </motion.div>

              <button
                type="button"
                onClick={closeModal}
                className="absolute -right-1 -top-1 rounded-full bg-card p-2.5 text-foreground transition-transform hover:scale-105 lg:right-0 lg:top-0"
                style={{
                  boxShadow:
                    "0 4px 24px color-mix(in oklch, oklch(0.05 0.02 268) 55%, transparent)",
                }}
                aria-label={galleryCopy.close}
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
