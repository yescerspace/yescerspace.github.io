import {
  createContext,
  useContext,
  forwardRef,
  Suspense,
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
import {
  OrbitControls as DreiOrbitControls,
  useTexture,
} from "@react-three/drei";
import type { OrbitControls as StdOrbitControls } from "three-stdlib";
import { motion, AnimatePresence } from "motion/react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Heart, Share, X } from "lucide-react";
import * as THREE from "three";
import { useLanguage } from "../context/LanguageContext";
import {
  localizedCategory,
  portfolioProjectCopy,
} from "../i18n/translations";
import gallerySunRayAssetUrl from "../assets/gallery-halo-grey-ring.png?url";
import artstationIconUrl from "../assets/artstation.png?url";
import { publicAsset } from "../utils/publicAsset";
import { cn } from "./ui/utils";
import { logGalleryHeroLoadErrorsInDev } from "../utils/galleryDevValidation";
import {
  clearGalleryDetailVideoPreload,
  detailPageMediaUrls,
  detailVideoPosterUrl,
  firstDetailVideoUrl,
  galleryFilenameIndex,
  isVideoUrl,
  prefetchDetailModalMedia,
  primaryGalleryTextureUrl,
  withGalleryAssetCacheBust,
} from "../utils/galleryMedia";
import {
  GALLERY_YEAR_PLANET_SCALE_MAX,
  GALLERY_YEAR_PLANET_SCALE_MIN,
  galleryYearScaleFactorsForProjectKeys,
} from "../utils/galleryPlanetYearScale";
import {
  normalizeManifestKeyPart,
  projectKeyFromParts,
} from "../utils/galleryProjectKey";
import {
  playGalleryClickSound,
  playGalleryHoverChime,
  preloadGalleryHoverSfx,
  primeGalleryAudioEngineFromUserGesture,
  wakeGalleryHoverAudioFromUserGesture,
} from "../utils/galleryHoverSfx";
import {
  createGallerySunburstHaloMaterial,
  SUN_RAYS_PLANE_SIDE_MULT,
} from "./gallerySunRaysMaterial";
import { GalleryMouseParticles } from "./GalleryMouseParticles";
import { GalleryHandOrbitBridge } from "./GalleryHandOrbitBridge";
import { GalleryHandZoomBridge } from "./GalleryHandZoomBridge";
import { GalleryOrbitWheelSmooth } from "./GalleryOrbitWheelSmooth";
import { HandControlOverlay } from "./HandControlOverlay";
import { GalleryHandModalEffect } from "./GalleryHandModalEffect";
import { useGalleryHandControl } from "./galleryHandControl";
import {
  DEFAULT_GALLERY_PARALLAX,
  GalleryParallaxContext,
  useGalleryParallaxRef,
} from "./galleryParallax";
/** Hover halo diskin hafif önünde (kamera yönü +Z); arkada kalınca opak disk tamamen kapatıyordu. */
const GALLERY_HALO_LAYER_Z = 0.01;
/** İkinci PNG katmanı — halkayı biraz daha koyu/doygun gösterir. */
const GALLERY_HALO_DARKEN_LAYER_Z = 0.003;
const GALLERY_HALO_RENDER_ORDER = 4;
/** Hover’daki gezegen komşularının üstünde çizilir (renderOrder). */
const GALLERY_CARD_HOVER_RENDER_ORDER = 28;
/**
 * Hover sırasında “seçili gezegen”i temsil eden PNG halka (geçici kapatma).
 * İstersen geri açmak için `true` yap.
 */
const SHOW_HOVER_SELECTION_RING_PNG = true;

if (import.meta.env.DEV) {
  THREE.Cache.enabled = false;
}

/** Legacy `?project=work%2Fslug` on `/` redirects to `/work/slug`. */
const LEGACY_GALLERY_PROJECT_QUERY = "project";

const GALLERY_FAVORITES_STORAGE_KEY = "portfolio-gallery-favorites-v1";

/** Canonical piece URL path, e.g. `work/3` → `/work/3`. */
function galleryProjectPath(projectKey: string): string {
  const i = projectKey.indexOf("/");
  if (i <= 0 || i >= projectKey.length - 1) return "/";
  const folder = normalizeManifestKeyPart(projectKey.slice(0, i));
  const slug = normalizeManifestKeyPart(projectKey.slice(i + 1));
  return `/${encodeURIComponent(folder)}/${encodeURIComponent(slug)}`;
}

function absoluteGalleryPieceUrl(projectKey: string): string {
  const rel = galleryProjectPath(projectKey);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (!base) return `${window.location.origin}${rel}`;
  return `${window.location.origin}${base}${rel}`;
}

function readGalleryFavoriteKeys(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(GALLERY_FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((x): x is string => typeof x === "string"),
    );
  } catch {
    return new Set();
  }
}

function persistGalleryFavoriteKeys(keys: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      GALLERY_FAVORITES_STORAGE_KEY,
      JSON.stringify([...keys]),
    );
  } catch {
    /* quota / private mode */
  }
}

/** work/2 detail: ArtStation album link beside the back control. */
const WORK2_ARTSTATION_ALBUM_URL =
  "https://www.artstation.com/yesimceren/albums/14104609";
/** `false` iken ikon gösterilmez; tekrar açmak için `true` yap. */
const WORK2_ARTSTATION_BUTTON_ENABLED = false;

/** Initial playback level (0–1) when a clip loads; audience can change it with the player controls. */
const DETAIL_VIDEO_VOLUME = 0.2;

function tryPlayDetailVideo(v: HTMLVideoElement): void {
  v.volume = DETAIL_VIDEO_VOLUME;
  if (v.preload !== "auto") {
    v.preload = "auto";
  }
  const attempt = () => {
    v.muted = false;
    void v.play().catch(() => {
      v.muted = true;
      void v.play().catch(() => {});
    });
  };
  attempt();
  if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
  if (v.dataset.detailPlayPending === "1") return;
  v.dataset.detailPlayPending = "1";
  v.addEventListener(
    "canplay",
    () => {
      delete v.dataset.detailPlayPending;
      attempt();
    },
    { once: true },
  );
}

function detailReadingModeActive(readingEl: HTMLElement | null): boolean {
  if (!readingEl || typeof window === "undefined") return false;
  const r = readingEl.getBoundingClientRect();
  return r.top < window.innerHeight * 0.78;
}

function pickDetailVideoPlayIndex(
  detailUrls: readonly string[],
  srcFor: (u: string) => string,
  failed: Record<string, boolean>,
  itemEls: readonly (HTMLElement | null)[],
  forcedPlayIndex: number | null,
  readingEl: HTMLElement | null = null,
): number {
  if (detailReadingModeActive(readingEl)) return -1;

  const viewBottom =
    typeof window !== "undefined" ? window.innerHeight : 800;

  if (forcedPlayIndex != null) {
    const u = detailUrls[forcedPlayIndex];
    if (u && !failed[u] && isVideoUrl(srcFor(u))) {
      const wrap = itemEls[forcedPlayIndex];
      if (wrap) {
        const r = wrap.getBoundingClientRect();
        const visible = Math.min(r.bottom, viewBottom) - Math.max(r.top, 0);
        if (visible > 32) return forcedPlayIndex;
      }
    }
  }
  let bestI = -1;
  let bestVisible = 0;

  for (let i = 0; i < detailUrls.length; i++) {
    const u = detailUrls[i];
    if (!u || failed[u] || !isVideoUrl(srcFor(u))) continue;
    const wrap = itemEls[i];
    if (!wrap) continue;
    const r = wrap.getBoundingClientRect();
    const visible = Math.min(r.bottom, viewBottom) - Math.max(r.top, 0);
    if (visible > bestVisible) {
      bestVisible = visible;
      bestI = i;
    }
  }

  return bestI >= 0 && bestVisible > 32 ? bestI : -1;
}

function syncDetailVideoPlayback(
  detailUrls: readonly string[],
  srcFor: (u: string) => string,
  failed: Record<string, boolean>,
  itemEls: readonly (HTMLElement | null)[],
  videoEls: readonly (HTMLVideoElement | null)[],
  forcedPlayIndex: number | null = null,
  readingEl: HTMLElement | null = null,
): void {
  const playIndex = pickDetailVideoPlayIndex(
    detailUrls,
    srcFor,
    failed,
    itemEls,
    forcedPlayIndex,
    readingEl,
  );

  for (let i = 0; i < videoEls.length; i++) {
    const v = videoEls[i];
    if (!v) continue;
    const u = detailUrls[i];
    if (!u || failed[u] || !isVideoUrl(srcFor(u))) continue;
    if (i === playIndex) {
      tryPlayDetailVideo(v);
    } else {
      delete v.dataset.detailPlayPending;
      v.pause();
      v.muted = true;
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

/**
 * Card textures: bust cache + dev `fetch` no-store (see `withGalleryAssetCacheBust`).
 */
function loadGalleryTextureUrl(
  url: string,
  onLoad: (tex: THREE.Texture) => void,
  onError: () => void,
): void {
  const loadUrl = withGalleryAssetCacheBust(url);
  const loadWithTextureLoader = () => {
    sharedTextureLoader.load(loadUrl, onLoad, undefined, onError);
  };

  if (import.meta.env.DEV) {
    const absolute =
      loadUrl.startsWith("http://") || loadUrl.startsWith("https://")
        ? loadUrl
        : new URL(loadUrl, window.location.origin).href;
    fetch(absolute, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        sharedTextureLoader.load(
          objectUrl,
          (tex) => {
            URL.revokeObjectURL(objectUrl);
            onLoad(tex);
          },
          undefined,
          () => {
            URL.revokeObjectURL(objectUrl);
            loadWithTextureLoader();
          },
        );
      })
      .catch(loadWithTextureLoader);
    return;
  }
  loadWithTextureLoader();
}

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
      loadGalleryTextureUrl(
        url,
        (loaded) => {
          if (cancelled) {
            loaded.dispose();
            return;
          }
          applySquareFaceTextureUV(loaded);
          commit(loaded);
        },
        () => {
          console.error("[Gallery3D] Fallback asset failed to load:", url);
          loadSolid();
        },
      );
    };

    const loadPrimary = (url: string) => {
      loadGalleryTextureUrl(
        url,
        (loaded) => {
          if (cancelled) {
            loaded.dispose();
            return;
          }
          applySquareFaceTextureUV(loaded);
          commit(loaded);
        },
        () => {
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
/** Organic motion on the shell (visible gentle bob vs “frozen” discs). */
const ALL_CLOUD_DRIFT_AMP = 0.048;
/** Long-period glide — low amp vs drift. */
const ALL_CLOUD_GLIDE_AMP = 0.03;
/** Radial drift’in ne kadarı kesilsin (0 = hepsi tangential, 1 = olduğu gibi). */
const ALL_CLOUD_DRIFT_RADIAL_DAMP = 0.72;
/** “All” view: circular disc — segment count for smooth outline. */
const ALL_CLOUD_CIRCLE_SEGMENTS = 72;
/**
 * Perspektif ölçeği: `refD / distCam` (ref = kamera→orbit hedefi). Yakın büyük, uzak küçük;
 * min = uzaktaki taban (önceki “en küçük” boyut), max = yakındaki üst sınır.
 */
const ALL_CLOUD_PERSPECTIVE_CLAMP_MIN = 0.58;
/** Headroom so “near” planets can grow; far end still clamped at MIN. */
const ALL_CLOUD_PERSPECTIVE_CLAMP_MAX = 2.12;
/**
 * Only scales ratios above 1.0 (closer discs): far planets keep the same MIN clamp behaviour.
 */
const ALL_CLOUD_PERSPECTIVE_NEAR_STRETCH = 1.17;
/** Slot başına deterministik boyut jitter’ı (oranın etrafında ±). */
const PLANET_SLOT_SCALE_JITTER = 0.14;
/** depthScale hedefini takip (orbit sürüklerken daha çevik). */
const ALL_CLOUD_DEPTH_SMOOTH_SPEED = 9.5;
/**
 * Dikey eksene (xz) minimum uzaklık / yerel kabuk yarıçapı — ortada “görünmez gezegen” boşluğu.
 */
const CLOUD_HUB_VOID_MIN_XZ_FRAC = 0.44;
/**
 * “All”: ortadaki görünmez çekirdeğe daha geniş boşluk (yörünge halkası daha dışta).
 */
const CLOUD_HUB_VOID_MIN_XZ_FRAC_ALL = 0.68;
/**
 * “All”da öğeleri merkeze göre aynı oranda büyüt — birbirlerinden uzaklaşır; açılar / hash’ler aynı kalır.
 */
const ALL_CATEGORY_PAIRWISE_SPREAD = 1.48;
/** Çekirdeğe yakın gezegenleri dışa iter; dış kabuk (≥ bu oran) sabit kalır. */
const CLOUD_INNER_SPREAD_OUTER_ANCHOR = 0.9;
const CLOUD_INNER_SPREAD_MAX_MUL = 1.32;

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
 * Seçili projeler: kırpma / hizalama için Y ve ölçek (grup uzayı; diğer gezegenlere dokunmaz).
 * `ringRadius` ile ölçeklenir — sabit ~0.1 ofset, kabukta görünür değişim yapmıyordu.
 * VR Experience: ekranda aşağı (Y−). Emberfall: yukarı (Y+) + hafif büyütme.
 */
function galleryProjectLayoutTweak(
  projectKey: string,
  depthScaleMul: number,
  ringRadiusLocal: number,
): { dy: number; scaleMul: number } {
  const k = Math.max(ringRadiusLocal, 0.35);
  const spread =
    ALL_CLOUD_PERSPECTIVE_CLAMP_MAX - ALL_CLOUD_PERSPECTIVE_CLAMP_MIN;
  const near01 = THREE.MathUtils.clamp(
    (depthScaleMul - ALL_CLOUD_PERSPECTIVE_CLAMP_MIN) / Math.max(spread, 1e-6),
    0,
    1,
  );

  if (projectKey === "work/3") {
    /** Hafif Y− (kırpma); fazlası work/5 ile ekranda üst üste bindiriyordu */
    const t = 0.22 + 0.78 * near01;
    return { dy: -k * 0.1 * t, scaleMul: 1 };
  }
  if (projectKey === "work/1") {
    /** Emberfall */
    return { dy: k * 0.2, scaleMul: 1.09 };
  }
  if (projectKey === "work/9") {
    /** Wholy Cow / 2D Archive — hafif Y− (kabukta biraz aşağı) */
    return { dy: -k * 0.14, scaleMul: 1 };
  }
  return { dy: 0, scaleMul: 1 };
}

/**
 * Kabukta merkeze doğru çekme (0–1): kopuk duran projeleri küme ile hizalar; diğer gezegenlere dokunmaz.
 */
/**
 * “Tümü” kabuğunda: xz açı + Y + isteğe bağlı radyal ölçek (merkeze göre farklı katman).
 * Zoom karışımı ayrı — work/3–5 için taban yüzdesi var (tam sönmesin).
 */
function galleryProjectShellSeparation(
  projectKey: string,
  allCategoryLayout: boolean,
): { angleRad: number; yMul: number; radialMul: number } {
  if (!allCategoryLayout) {
    return { angleRad: 0, yMul: 0, radialMul: 1 };
  }
  if (projectKey === "work/1") {
    return { angleRad: 0.38, yMul: 0.18, radialMul: 1 };
  }
  if (projectKey === "work/4") {
    return { angleRad: -0.38, yMul: -0.17, radialMul: 1 };
  }
  if (projectKey === "work/3") {
    /** VR — küme içinde; minimal açı/Y, merkeze sıkı kabuk */
    return { angleRad: 0.32, yMul: 0.16, radialMul: 0.8 };
  }
  if (projectKey === "work/5") {
    return { angleRad: -0.98, yMul: -0.52, radialMul: 0.84 };
  }
  if (projectKey === "work/8") {
    return { angleRad: 0.1, yMul: 0.05, radialMul: 0.84 };
  }
  /** Eski iş — kameradan uzak, dış kabukta kalsın. */
  if (projectKey === "work/2") {
    return { angleRad: 0.62, yMul: 0.08, radialMul: 1.22 };
  }
  /** Yeni iş — görünür bölgede, merkeze yapışmasın. */
  if (projectKey === "work/12") {
    return { angleRad: -0.42, yMul: -0.12, radialMul: 1.08 };
  }
  return { angleRad: 0, yMul: 0, radialMul: 1 };
}

function galleryProjectRadialPull(projectKey: string): number {
  if (projectKey === "work/1") {
    return 0;
  }
  /** Dış kabukta kopuk kalanlar — merkeze doğru (0–1, pozisyon × (1 − pull)). */
  if (
    projectKey === "work/3" ||
    projectKey === "work/6" ||
    projectKey === "work/7" ||
    projectKey === "work/8"
  ) {
    if (projectKey === "work/3") return 0.34;
    if (projectKey === "work/8") return 0.36;
    return 0.24;
  }
  return 0;
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

/** İç kabuktakileri çekirdekten dışa aç — seçim için aralık; dıştakiler sabit. */
function spreadInnerCloudFromCore(
  x: number,
  yW: number,
  z: number,
  shellR: number,
): [number, number, number] {
  const rh = Math.hypot(x, z);
  if (rh < 1e-6 || shellR < 1e-6) return [x, yW, z];
  const r01 = rh / shellR;
  if (r01 >= CLOUD_INNER_SPREAD_OUTER_ANCHOR) return [x, yW, z];
  const t = THREE.MathUtils.clamp(
    (CLOUD_INNER_SPREAD_OUTER_ANCHOR - r01) / CLOUD_INNER_SPREAD_OUTER_ANCHOR,
    0,
    1,
  );
  const mul = THREE.MathUtils.lerp(1, CLOUD_INNER_SPREAD_MAX_MUL, t * t);
  return [x * mul, yW, z * mul];
}

type OrbitDeformState = { r: number; az: number; py: number };

/**
 * Kabuk yarıçapı (r), azimut (az) ve düşey düzlem (py) — önceki kare baz pozisyondan impuls.
 */
function integrateOrbitDeform(
  dt: number,
  api: OrbitDragPhysicsApi,
  deltaZoom: number,
  camera: THREE.Camera,
  last: { x: number; y: number; z: number },
  radius: number,
  slot: number,
  groupScale: number,
  d: OrbitDeformState,
  v: OrbitDeformState,
): void {
  const rh = Math.hypot(last.x, last.z);
  if (rh > 1e-5) {
    const om = api.omegaSmoothed;
    if (api.isDragging && Math.abs(om) > 1e-7) {
      v.az += om * DEFORM_AZ_COUPLE * dt;
      v.r +=
        om *
        DEFORM_R_DRAG_COUPLE *
        dt *
        ((slotHash01(slot, 51) - 0.5) * 2);
      v.py +=
        om *
        DEFORM_PY_COUPLE *
        dt *
        ((slotHash01(slot, 52) - 0.5) * 2);
    }
    if (!api.isDragging && Math.abs(api.orbitMomentum) > 0.02) {
      v.az += api.orbitMomentum * DEFORM_MOM_AZ_COUPLE * dt;
    }
  }
  if (!api.isDragging && Math.abs(deltaZoom) > 0.0008) {
    v.r += deltaZoom * DEFORM_SCROLL_R_COUPLE;
    v.py += deltaZoom * DEFORM_SCROLL_PY_COUPLE;
    v.az +=
      deltaZoom *
      DEFORM_SCROLL_AZ_COUPLE *
      ((slotHash01(slot, 61) - 0.5) * 2);
  }

  const ar = -DEFORM_SPRING_K * d.r - DEFORM_DAMP * v.r;
  const aaz = -DEFORM_SPRING_K * d.az - DEFORM_DAMP * v.az;
  const apy = -DEFORM_SPRING_K * d.py - DEFORM_DAMP * v.py;
  v.r += ar * dt;
  v.az += aaz * dt;
  v.py += apy * dt;
  d.r += v.r * dt;
  d.az += v.az * dt;
  d.py += v.py * dt;

  d.r = THREE.MathUtils.clamp(d.r, -DEFORM_R_MAX, DEFORM_R_MAX);
  d.az = THREE.MathUtils.clamp(d.az, -DEFORM_AZ_MAX, DEFORM_AZ_MAX);
  d.py = THREE.MathUtils.clamp(d.py, -DEFORM_PY_MAX, DEFORM_PY_MAX);
  if (Math.abs(d.r) >= DEFORM_R_MAX * 0.995) v.r *= 0.58;
  if (Math.abs(d.az) >= DEFORM_AZ_MAX * 0.995) v.az *= 0.58;
  if (Math.abs(d.py) >= DEFORM_PY_MAX * 0.995) v.py *= 0.58;
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
    const [px, py, pz] = pushCloudOntoHubRing(0, x1, 0, z1, R, hubFrac);
    return spreadInnerCloudFromCore(px, py, pz, R);
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
  const [px, py, pz] = pushCloudOntoHubRing(slot, x, yW, z, R, hubFrac);
  return spreadInnerCloudFromCore(px, py, pz, R);
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
const HOVER_SCALE = 1.24;
const HOVER_LIFT = 0.19;
/**
 * Uzak/küçük görünen gezegenlerde hover: kameraya doğru (dünya birimi). Yakın/büyükte boost 0’a iner.
 */
/** Dünya birimi — hover’da kameraya doğru kaydırma (yakındaki disklerde de taban pay). */
const HOVER_TOWARD_CAMERA_WORLD = 0.27;
/** Uniform mesh scale — disc / box hero size in the shell (satellite “planets”). */
const CARD_MESH_BASE_SCALE = 1.64;
/** Pull ring positions toward center for a tighter circle (after parallax) */
const RING_RADIAL_COMPACT = 0.8;
/**
 * When mesh scale > 1, nudge the group toward ring center — **only from base scale**
 * (zoom/year), never from hover scale; otherwise hover reads like drifting toward the hub.
 * `pull = (scaleForHubInward - 1) * SCALE_INWARD_K * ringRadius`.
 */
const SCALE_INWARD_K = 0.5;
/**
 * Zoom ile halka/kabuk yarıçapını büyütme (0 = zoom’da çekirdekten dışarı kayma yok).
 * Eskiden küçük pozitif değer “yakın zoom’da kabuk genişlemesi” veriyordu.
 */
const ZOOM_RING_EXPAND = 0;
/** Kameraya doğru paralaks çekişi — düşük = yakınlaşınca daha az sağa-sola yayılma. */
const ZOOM_DEPTH_PULL = 0.13;
const ZOOM_PARALLAX_Y = 0.1;
const ZOOM_SCALE_BOOST = 0.036;

/**
 * Reference vertical FOV for orbit distance math and Canvas projection.
 * `AdaptiveFovSync` smoothes around this baseline (~60° vs the old ~78° wide look).
 */
const CAMERA_FOV = 60;
/** Tight near plane; stay well under min orbit distance */
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 2000;

/** Frustum slack vs scaled carousel bounds (>1 = extra padding so thumbnails stay in view). */
const FRAMING_MARGIN = 1.035;

/** Uniform scale for the carousel group (larger on screen without shrinking orbit min) */
const GALLERY_GROUP_WORLD_SCALE = 1.22;

/** Cinematic FOV at min vs max orbit distance (deg); clamped up by geometry */
/** Yakın zoom’da biraz daha geniş taban — detay çerçevesi + floorFov ile uyum. */
const ADAPTIVE_FOV_AT_MIN_DISTANCE = 54;
const ADAPTIVE_FOV_AT_MAX_DISTANCE = 58;
const ADAPTIVE_FOV_ABSOLUTE_CAP = 76;
/** Mobil/portrait: yakın zoom’da kırpmayı azaltmak için biraz daha yüksek cap. */
const ADAPTIVE_FOV_ABSOLUTE_CAP_MOBILE = 84;
/** Exponential smoothing for FOV follow (~0.08–0.12 effective step at 60fps) */
const ADAPTIVE_FOV_SMOOTHING = 9.5;
/** Geometrik min’in altı — tüm kabuk kadrajı (uzak zoom-out üst sınırı için de kullanılır). */
const ORBIT_MIN_DISTANCE_RELAX = 0.52;
/** Mobil/portrait: daha yakına zoom (kabuk kadrajı). */
const ORBIT_MIN_DISTANCE_RELAX_MOBILE = 0.44;
/** İç halka / merkez gezegene yakın zoom — tam kabuktan bağımsız. */
const ORBIT_HUB_MIN_DISTANCE_RELAX = 0.5;
/** Mobil/portrait: merkez gezegene daha yakına zoom. */
const ORBIT_HUB_MIN_DISTANCE_RELAX_MOBILE = 0.42;
/** Max orbit distance as a multiple of full-shell relaxed min */
const ORBIT_MAX_DISTANCE_RATIO = 2.12;
/** Mobil/portrait: biraz daha geniş zoom-out aralığı. */
const ORBIT_MAX_DISTANCE_RATIO_MOBILE = 2.35;
/**
 * Initial camera distance between min and max (0 = closest zoom, 1 = farthest).
 * Higher = calmer opening frame; scroll still reaches `min`.
 */
const DEFAULT_ORBIT_DISTANCE_T = 0.72;
/** Açılış kadrajı — OrbitControls yatay (azimuth) açısı, derece. */
const DEFAULT_ORBIT_AZIMUTH_DEG = -30;
const DEFAULT_ORBIT_AZIMUTH_RAD = THREE.MathUtils.degToRad(
  DEFAULT_ORBIT_AZIMUTH_DEG,
);

/**
 * Orbit pivot + ring anchor (world Y). Lifts the layout so framing is balanced
 * (avoids empty top / clipped bottom) while keeping pan disabled so Y never drifts.
 */
const ORBIT_TARGET_Y = 0.28;
const _orbitTarget = new THREE.Vector3(0, ORBIT_TARGET_Y, 0);

/**
 * Dikey orbit: polar açı φ, +Y ekseninden (0° = tam tepeden, 90° ≈ yatay).
 * φ küçülürse kamera daha “yukarıda” (kuş bakışı); φ büyürse daha alçak.
 * Dar aralık (ör. 100–110) = toplam ~10° hareket + düşük min kuş bakışını kilitler.
 * Eski dar varsayılan: 78 / 88.
 */
const ORBIT_POLAR_MIN_DEG = 38;
const ORBIT_POLAR_MAX_DEG = 100;

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

type FramingExtents = { radialMax: number; verticalHalf: number };

function carouselFramingExtents(ringRadius: number): FramingExtents {
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

/** İç halka (hub void) — merkeze en yakın gezegen kadrajı. */
function hubPlanetFramingExtents(layoutRingRadius: number): FramingExtents {
  const sMax =
    CARD_MESH_BASE_SCALE * HOVER_SCALE * (1 + ZOOM_SCALE_BOOST);
  const hubR =
    layoutRingRadius *
    0.95 *
    CLOUD_HUB_VOID_MIN_XZ_FRAC_ALL *
    ALL_CATEGORY_PAIRWISE_SPREAD;
  const radialMax =
    (hubR + CARD_W * sMax * 0.62) * GALLERY_GROUP_WORLD_SCALE;
  const verticalHalf =
    (CARD_H * sMax * 0.58 + HOVER_LIFT * 0.45) * GALLERY_GROUP_WORLD_SCALE;
  return { radialMax, verticalHalf };
}

function minSafeOrbitDistanceFromExtents(
  extents: FramingExtents,
  ringRadiusFloor: number,
  fovVerticalDeg: number,
  aspect: number,
): number {
  const { radialMax, verticalHalf } = extents;
  const boundRadius = Math.hypot(radialMax, verticalHalf);
  const fovRad = THREE.MathUtils.degToRad(fovVerticalDeg);
  const tanHalfV = Math.tan(fovRad * 0.5);
  const tanHalfH = Math.tan(fovRad * 0.5) * Math.max(aspect, 0.25);
  const dVert = (boundRadius * FRAMING_MARGIN) / tanHalfV;
  const dHorz = (radialMax * FRAMING_MARGIN) / tanHalfH;
  return Math.max(dVert, dHorz, ringRadiusFloor);
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
  return minSafeOrbitDistanceFromExtents(
    carouselFramingExtents(ringRadius),
    ringRadius * GALLERY_GROUP_WORLD_SCALE * 0.27 * FRAMING_CLOUD_EXTENT_PAD,
    fovVerticalDeg,
    aspect,
  );
}

/** Merkez / iç halkadaki tek gezegene yakın zoom için daha düşük min mesafe. */
function minSafeOrbitDistanceForHub(
  layoutRingRadius: number,
  fovVerticalDeg: number,
  aspect: number,
): number {
  return minSafeOrbitDistanceFromExtents(
    hubPlanetFramingExtents(layoutRingRadius),
    layoutRingRadius * GALLERY_GROUP_WORLD_SCALE * 0.1 * FRAMING_CLOUD_EXTENT_PAD,
    fovVerticalDeg,
    aspect,
  );
}

function minimumVerticalFovDegreesFromExtents(
  distance: number,
  extents: FramingExtents,
  aspect: number,
): number {
  const d = Math.max(distance, 1e-4);
  const { radialMax, verticalHalf } = extents;
  const boundRadius = Math.hypot(radialMax, verticalHalf);
  const a = Math.max(aspect, 0.25);
  const tanHalfFromVertical = (boundRadius * FRAMING_MARGIN) / d;
  const tanHalfFromHorizontal = (radialMax * FRAMING_MARGIN) / (d * a);
  const tanHalf = Math.max(tanHalfFromVertical, tanHalfFromHorizontal);
  const capped = Math.min(tanHalf, Math.tan(THREE.MathUtils.degToRad(89)));
  return THREE.MathUtils.radToDeg(2 * Math.atan(capped));
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
  return minimumVerticalFovDegreesFromExtents(
    distance,
    carouselFramingExtents(ringRadius),
    aspect,
  );
}

function orbitZoomLimits(
  layoutRingRadius: number,
  aspect: number,
): { min: number; max: number } {
  const isPortraitMobile = aspect < 0.78;
  const framingRadius = layoutRingRadius * ALL_CLOUD_FRAMING_RADIUS_MULT;
  const geometricMinFull = minSafeOrbitDistance(
    framingRadius,
    CAMERA_FOV,
    aspect,
  );
  const geometricMinHub = minSafeOrbitDistanceForHub(
    layoutRingRadius,
    CAMERA_FOV,
    aspect,
  );
  const minFullRelaxed =
    geometricMinFull *
    (isPortraitMobile ? ORBIT_MIN_DISTANCE_RELAX_MOBILE : ORBIT_MIN_DISTANCE_RELAX);
  const minHubRelaxed =
    geometricMinHub *
    (isPortraitMobile
      ? ORBIT_HUB_MIN_DISTANCE_RELAX_MOBILE
      : ORBIT_HUB_MIN_DISTANCE_RELAX);
  const floor =
    layoutRingRadius * GALLERY_GROUP_WORLD_SCALE * 0.12 * FRAMING_CLOUD_EXTENT_PAD;
  const min = Math.max(Math.min(minFullRelaxed, minHubRelaxed), floor);
  const max = Math.max(
    minFullRelaxed *
      (isPortraitMobile ? ORBIT_MAX_DISTANCE_RATIO_MOBILE : ORBIT_MAX_DISTANCE_RATIO),
    min * 1.35,
  );
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
  azimuthRad: number = DEFAULT_ORBIT_AZIMUTH_RAD,
): void {
  const e = cameraElevationAngle();
  const sy = Math.sin(e) * distance;
  const cz = Math.cos(e) * distance;
  const sinAz = Math.sin(azimuthRad);
  const cosAz = Math.cos(azimuthRad);
  camera.position.set(cz * sinAz, ORBIT_TARGET_Y + sy, cz * cosAz);
  camera.lookAt(_orbitTarget);
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.updateProjectionMatrix();
  }
}

function cameraTupleForOrbitDistance(
  distance: number,
  azimuthRad: number = DEFAULT_ORBIT_AZIMUTH_RAD,
): [number, number, number] {
  const e = cameraElevationAngle();
  const sy = Math.sin(e) * distance;
  const cz = Math.cos(e) * distance;
  const sinAz = Math.sin(azimuthRad);
  const cosAz = Math.cos(azimuthRad);
  return [cz * sinAz, ORBIT_TARGET_Y + sy, cz * cosAz];
}

function defaultViewportAspect(): number {
  if (typeof window === "undefined") return 1.5;
  const h = Math.max(1, window.innerHeight);
  return THREE.MathUtils.clamp(window.innerWidth / h, 0.5, 2.5);
}

function RingCameraSync({
  ringRadius,
  orbitControlsRef,
  defaultDistanceT = DEFAULT_ORBIT_DISTANCE_T,
}: {
  ringRadius: number;
  orbitControlsRef: MutableRefObject<StdOrbitControls | null>;
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
    const controls = orbitControlsRef.current;
    if (controls) {
      controls.setAzimuthalAngle(DEFAULT_ORBIT_AZIMUTH_RAD);
      controls.update();
    }
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.near = CAMERA_NEAR;
      camera.far = CAMERA_FAR;
      camera.updateProjectionMatrix();
    }
  }, [ringRadius, camera, baseD, orbitControlsRef]);

  return null;
}

function AdaptiveFovSync({
  layoutRingRadius,
  minDistance,
  maxDistance,
}: {
  layoutRingRadius: number;
  minDistance: number;
  maxDistance: number;
}) {
  const { camera, size } = useThree();
  const aspect = Math.max(size.width / Math.max(size.height, 1), 0.25);
  const fullExtents = useMemo(
    () =>
      carouselFramingExtents(
        layoutRingRadius * ALL_CLOUD_FRAMING_RADIUS_MULT,
      ),
    [layoutRingRadius],
  );
  const hubExtents = useMemo(
    () => hubPlanetFramingExtents(layoutRingRadius),
    [layoutRingRadius],
  );

  useFrame((_, delta) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const dist = camera.position.distanceTo(_orbitTarget);
    const span = Math.max(maxDistance - minDistance, 1e-5);
    const u = THREE.MathUtils.clamp((dist - minDistance) / span, 0, 1);
    const zoomT = u * u * (3 - 2 * u);
    const isPortraitMobile = aspect < 0.78;
    const framingExtents: FramingExtents = {
      radialMax: THREE.MathUtils.lerp(
        hubExtents.radialMax,
        fullExtents.radialMax,
        zoomT,
      ),
      verticalHalf: THREE.MathUtils.lerp(
        hubExtents.verticalHalf,
        fullExtents.verticalHalf,
        zoomT,
      ),
    };
    const floorFov = minimumVerticalFovDegreesFromExtents(
      dist,
      framingExtents,
      aspect,
    );

    const cinematic = THREE.MathUtils.lerp(
      ADAPTIVE_FOV_AT_MIN_DISTANCE,
      ADAPTIVE_FOV_AT_MAX_DISTANCE,
      zoomT,
    );

    const targetFov = Math.min(
      Math.max(cinematic, floorFov),
      isPortraitMobile ? ADAPTIVE_FOV_ABSOLUTE_CAP_MOBILE : ADAPTIVE_FOV_ABSOLUTE_CAP,
    );

    const alpha = 1 - Math.exp(-ADAPTIVE_FOV_SMOOTHING * delta);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, alpha);
    camera.updateProjectionMatrix();
  });

  return null;
}

/** Daha düşük = hover’da ölçeğe daha yavaş yaklaşır (`delta * HOVER_LERP`). */
const HOVER_LERP = 5;
/** Hover sun-ray layer opacity 0→1 (satellite discs). */
const HOVER_HALO_LERP = 6;

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
/** Stabilized billboard: roll is fixed by world up (avoids twist from `setFromUnitVectors` alone). */
const _bbWorldUp = new THREE.Vector3(0, 1, 0);
const _bbRight = new THREE.Vector3();
const _bbUp = new THREE.Vector3();
const _bbMatrix = new THREE.Matrix4();
const _shuffleHub = new THREE.Vector3();
const _shuffleTangent = new THREE.Vector3();
const _shuffleTan2 = new THREE.Vector3();
const _shuffleTarget = new THREE.Vector3();

type ZoomFxRef = React.MutableRefObject<{
  zoomIn: number;
  camAzimuth: number;
}>;

const ZoomFxContext = createContext<ZoomFxRef | null>(null);

/**
 * Orbit drag — ortak momentum (emergent faz); gezegenler aynı alanı paylaşır, hash gürültüsü yok.
 */
type OrbitDragPhysicsApi = {
  omegaSmoothed: number;
  isDragging: boolean;
  /** Kamera azimuth (rad) — itme yönü kabukla ilişkilendirilir. */
  camAzimuth: number;
  /** Sürüklemeyle biriken açısal momentum; idle’da sönümlenir, faz uyumunda kullanılır. */
  orbitMomentum: number;
};

const OrbitDragPhysicsContext =
  createContext<MutableRefObject<OrbitDragPhysicsApi> | null>(null);

const ORBIT_DRAG_SPIN_COUPLE = 0.095;
const ORBIT_DRAG_RADIAL_COUPLE = 0.038;
const ORBIT_DRAG_CROSS_COUPLE = 0.03;
const ORBIT_DRAG_Y_COUPLE = 0.026;
const ORBIT_COHERENCE_AMP = 0.16;
const ORBIT_MOMENTUM_INTEGRATE = 0.92;
const ORBIT_MOMENTUM_DECAY = 3.1;
const ORBIT_MOMENTUM_RESIDUAL = 0.014;
const ORBIT_DRAG_OMEGA_SMOOTH_IN = 14;
const ORBIT_DRAG_OMEGA_SMOOTH_OUT = 5;
const ORBIT_SPRING_K = 3.05;
const ORBIT_SPRING_C = 1.35;
const ORBIT_OFFSET_MAX = 0.72;
const REST_BIAS_MAX = 0.26;
const REST_BIAS_DECAY = 0.009;
const REST_FROM_VEL_SCALE = 0.32;
/** Per-slot nudge on drag release (world-ish; scaled by ring radius in useFrame). */
const DRAG_END_JITTER_MUL = 0.045;
const IDLE_FLOAT_FREQ = 0.42;
/** Vertical / horizontal idle bob — multiplied by `radius` in useFrame (reduced vs scripted “swim”). */
const IDLE_FLOAT_Y_MUL = 0.026;
const IDLE_FLOAT_Y2_MUL = 0.013;
const IDLE_FLOAT_XZ_MUL = 0.011;
/**
 * Kabuk yörüngesi deformasyonu (r / az / py) — kütle–yay; input → hız → parametre, 0’a gevşer.
 * Düşük yay + agresif impuls = uzun süre okunur “yörünge değişti” hissi (abartılı olabilir).
 */
const DEFORM_SPRING_K = 1.45;
const DEFORM_DAMP = 3.85;
const DEFORM_AZ_COUPLE = 2.75;
const DEFORM_R_DRAG_COUPLE = 0.38;
const DEFORM_PY_COUPLE = 1.25;
const DEFORM_MOM_AZ_COUPLE = 0.48;
const DEFORM_MOM_R_COUPLE = 0.11;
const DEFORM_MOM_PY_COUPLE = 0.09;
const DEFORM_SCROLL_R_COUPLE = 4.6;
const DEFORM_SCROLL_PY_COUPLE = 2.15;
const DEFORM_SCROLL_AZ_COUPLE = 1.25;
const DEFORM_R_MAX = 0.52;
const DEFORM_AZ_MAX = 1.95;
const DEFORM_PY_MAX = 1.45;
/** `cy` kayması: py × radius × bu katsayı */
const DEFORM_PY_RADIUS_MUL = 1.28;

function OrbitDragPhysicsSync({
  orbitControlsRef,
  apiRef,
}: {
  orbitControlsRef: MutableRefObject<StdOrbitControls | null>;
  apiRef: MutableRefObject<OrbitDragPhysicsApi>;
}) {
  const { camera } = useThree();
  const lastAzimuthRef = useRef<number | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let attempts = 0;
    const id = window.setInterval(() => {
      attempts += 1;
      const c = orbitControlsRef.current;
      if (!c) {
        if (attempts > 240) window.clearInterval(id);
        return;
      }
      window.clearInterval(id);
      const onStart = () => {
        apiRef.current.isDragging = true;
      };
      const onEnd = () => {
        apiRef.current.isDragging = false;
      };
      c.addEventListener("start", onStart);
      c.addEventListener("end", onEnd);
      cleanup = () => {
        c.removeEventListener("start", onStart);
        c.removeEventListener("end", onEnd);
      };
    }, 24);
    return () => {
      window.clearInterval(id);
      cleanup?.();
    };
  }, [orbitControlsRef, apiRef]);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.055);
    const az = Math.atan2(camera.position.x, camera.position.z);
    if (lastAzimuthRef.current === null) {
      lastAzimuthRef.current = az;
      return;
    }
    let dAz = az - lastAzimuthRef.current;
    dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
    lastAzimuthRef.current = az;
    const omegaRaw = dAz / Math.max(d, 1e-6);
    const omegaClamped = THREE.MathUtils.clamp(omegaRaw, -20, 20);
    const targetOmega = apiRef.current.isDragging ? omegaClamped : 0;
    apiRef.current.omegaSmoothed = THREE.MathUtils.lerp(
      apiRef.current.omegaSmoothed,
      targetOmega,
      Math.min(
        1,
        d *
          (apiRef.current.isDragging
            ? ORBIT_DRAG_OMEGA_SMOOTH_IN
            : ORBIT_DRAG_OMEGA_SMOOTH_OUT),
      ),
    );

    apiRef.current.camAzimuth = az;
    const om = apiRef.current.omegaSmoothed;
    if (apiRef.current.isDragging && Math.abs(om) > 1e-7) {
      apiRef.current.orbitMomentum += om * d * ORBIT_MOMENTUM_INTEGRATE;
    } else {
      apiRef.current.orbitMomentum *= Math.exp(-d * ORBIT_MOMENTUM_DECAY);
    }
    apiRef.current.orbitMomentum = THREE.MathUtils.clamp(
      apiRef.current.orbitMomentum,
      -9,
      9,
    );
  });

  return null;
}

/** Publishes orbit angles + zoom to 2D starfield (GalleryMouseParticles). */
function GalleryParallaxBridge({
  orbitControlsRef,
  minDistance,
  maxDistance,
}: {
  orbitControlsRef: MutableRefObject<StdOrbitControls | null>;
  minDistance: number;
  maxDistance: number;
}) {
  const parallaxRef = useGalleryParallaxRef();
  useFrame(() => {
    const store = parallaxRef;
    const controls = orbitControlsRef.current;
    if (!store || !controls) return;
    const dist = controls.getDistance();
    const span = Math.max(maxDistance - minDistance, 1e-5);
    store.current = {
      azimuth: controls.getAzimuthalAngle(),
      polar: controls.getPolarAngle(),
      distanceT: THREE.MathUtils.clamp((dist - minDistance) / span, 0, 1),
    };
  });
  return null;
}

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
  /** Düşük öncelik: kartlardan önce çalışsın; ilk karede `zoomIn` güncel olsun. */
  useFrame(() => {
    const dist = camera.position.distanceTo(_orbitTarget);
    const zoomIn = 1 - THREE.MathUtils.smoothstep(dist, minDistance, maxDistance);
    zoomRef.current.zoomIn = zoomIn;
    zoomRef.current.camAzimuth = Math.atan2(camera.position.x, camera.position.z);
  }, -20);
  return null;
}

const PLACEHOLDER_GRAY = new THREE.Color(0x5c5c66);

/** Neutral map multiply — standard brightness/contrast on hero thumbnails. */
const COVER_PHOTO_NEUTRAL = new THREE.Color(1, 1, 1);

/** Fallback outer veil (matches previous fixed purple) when cover color cannot be sampled. */
const DEFAULT_DISC_OUTER_GLOW = new THREE.Vector3(0.38, 0.32, 0.52);
/** Koyu/mor kapaklarda halo için pastel üst ton (görünürlük + yumuşaklık). */
const _HALO_PASTEL_SOFT = new THREE.Color(0xe8e4f6);
/** Hover halo halkası: kapak rengini doyurganlaştır (her gezegende farklı his). */
const _sunRayCoverTint = new THREE.Color();
const HALO_RING_COVER_SAT_BOOST = 1.48;
/** rad/s — yavaş sürekli dönüş (hover’da). */
const HALO_RING_SPIN_SPEED = 0.048;

/**
 * Koyu kapaklarda (mor vb.) additive halo kaybolmasın: parlaklık tabanı + hafif pastel.
 */
function applyHaloRingPastelLiftForDarkCovers(c: THREE.Color): void {
  let lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  const minLum = 0.39;
  if (lum < minLum && lum > 1e-8) {
    const k = Math.min(minLum / lum, 2.55);
    c.r = THREE.MathUtils.clamp(c.r * k, 0.06, 1);
    c.g = THREE.MathUtils.clamp(c.g * k, 0.06, 1);
    c.b = THREE.MathUtils.clamp(c.b * k, 0.06, 1);
  }
  lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  if (lum < 0.54) {
    const t = ((0.54 - lum) / 0.54) * 0.42;
    c.lerp(_HALO_PASTEL_SOFT, t);
  }
  c.r = THREE.MathUtils.clamp(c.r, 0.08, 1);
  c.g = THREE.MathUtils.clamp(c.g, 0.08, 1);
  c.b = THREE.MathUtils.clamp(c.b, 0.08, 1);
}

/**
 * Same center-crop square as {@link applySquareFaceTextureUV} (object-fit: cover on the card).
 * Downsample + saturation-weighted average → dominant RGB for the outer glow.
 */
function extractCoverDominantGlowVector(texture: THREE.Texture): THREE.Vector3 {
  const out = DEFAULT_DISC_OUTER_GLOW.clone();
  if (typeof document === "undefined") return out;

  const img = texture.image as
    | HTMLImageElement
    | ImageBitmap
    | HTMLCanvasElement
    | OffscreenCanvas
    | { width?: number; height?: number }
    | null
    | undefined;

  const w = (img && "width" in img && img.width) || 0;
  const h = (img && "height" in img && img.height) || 0;
  if (w < 2 || h < 2) return out;

  const ar = w / h;
  let sx: number;
  let sy: number;
  let sw: number;
  let sh: number;
  if (ar >= 1) {
    sw = h;
    sh = h;
    sx = (w - sw) * 0.5;
    sy = 0;
  } else {
    sw = w;
    sh = w;
    sx = 0;
    sy = (h - sh) * 0.5;
  }

  const sampleSize = 48;
  const canvas = document.createElement("canvas");
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return out;

  try {
    ctx.drawImage(
      img as CanvasImageSource,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      sampleSize,
      sampleSize,
    );
  } catch {
    return out;
  }

  const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

  let r = 0;
  let g = 0;
  let b = 0;
  let tw = 0;
  for (let i = 0; i < data.length; i += 4) {
    const sr = data[i]! / 255;
    const sg = data[i + 1]! / 255;
    const sb = data[i + 2]! / 255;
    const maxc = Math.max(sr, sg, sb);
    const minc = Math.min(sr, sg, sb);
    const sat = maxc > 1e-6 ? (maxc - minc) / maxc : 0;
    const weight = 0.2 + sat * 2.8;
    r += sr * weight;
    g += sg * weight;
    b += sb * weight;
    tw += weight;
  }
  if (tw < 1e-9) return out;

  r /= tw;
  g /= tw;
  b /= tw;

  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  const l = (maxc + minc) * 0.5;
  const chromaBoost = 1.15;
  r = THREE.MathUtils.clamp(l + (r - l) * chromaBoost, 0.06, 0.98);
  g = THREE.MathUtils.clamp(l + (g - l) * chromaBoost, 0.06, 0.98);
  b = THREE.MathUtils.clamp(l + (b - l) * chromaBoost, 0.06, 0.98);

  out.set(r, g, b);
  return out;
}

/**
 * Disc rim: feather + cover-tinted outer veil + iridescence (slow uIrisTime drift, no white rim).
 */
const DISC_FEATHER_MAP_FRAGMENT_PATCH = `#include <map_fragment>
#ifdef USE_MAP
{
	vec2 _hub = vMapUv - vec2(0.5);
	float _rr = length(_hub) * 2.0;
	float _featherA = 1.0 - smoothstep(0.87, 0.998, _rr);
	float _glow = smoothstep(0.74, 0.91, _rr) * (1.0 - smoothstep(0.92, 1.02, _rr));
	diffuseColor.rgb += uCoverGlow * _glow * 0.22;
	vec2 _p = _hub * 2.0;
	float _r2 = dot(_p, _p);
	float _z = sqrt(max(0.001, 1.0 - _r2));
	vec3 _N = normalize(vec3(_p.x, _p.y, _z));
	vec3 _V = vec3(0.0, 0.0, 1.0);
	float _vn = max(dot(_N, _V), 0.0);
	float _fres = pow(1.0 - _vn, 2.35);
	float _fresWide = pow(1.0 - _vn, 1.55);
	float _rimBand = smoothstep(0.4, 0.93, _rr) * (1.0 - smoothstep(0.88, 1.03, _rr));
	/** Hue / rim / glint / alpha: no uIrisInteract — avoids drag “pulse” on outer ring; glow stays steady. */
	float _hue = uIrisTime * 0.55 + _rr * 5.2 + _fres * 3.8;
	vec3 _a = vec3(sin(_hue * 1.1), sin(_hue * 1.1 + 2.1), sin(_hue * 1.1 + 4.18));
	_a = _a * 0.5 + 0.5;
	vec3 _iris = vec3(
		_a.x * 0.72 + 0.18,
		_a.y * 0.58 + 0.12,
		_a.z * 0.78 + 0.15
	);
	_iris = mix(_iris, vec3(0.72, 0.28, 0.58), 0.55);
	_iris = mix(_iris, vec3(0.22, 0.48, 0.82), 0.48);
	_iris = mix(_iris, vec3(0.52, 0.32, 0.78), 0.42);
	_iris = clamp(_iris, vec3(0.0), vec3(0.96));
	float _irisAmt = _rimBand * (0.38 * _fres + 0.42 * _fresWide) * 0.22;
	vec3 _glint = mix(vec3(0.45, 0.55, 0.88), vec3(0.82, 0.4, 0.72), 0.5 + 0.5 * sin(_hue * 0.9 + 1.0));
	diffuseColor.rgb += _iris * _irisAmt;
	diffuseColor.rgb += _glint * _rimBand * _fres * _fres * 0.07;
	diffuseColor.a *= _featherA;
	diffuseColor.a = max(diffuseColor.a, _rimBand * (_fres * 0.22 + _fresWide * 0.12) * 0.12);
}
#else
#ifdef USE_UV
{
	vec2 _hub = vUv - vec2(0.5);
	float _rr = length(_hub) * 2.0;
	float _featherA = 1.0 - smoothstep(0.87, 0.998, _rr);
	float _glow = smoothstep(0.74, 0.91, _rr) * (1.0 - smoothstep(0.92, 1.02, _rr));
	diffuseColor.rgb += uCoverGlow * _glow * 0.22;
	vec2 _p = _hub * 2.0;
	float _r2 = dot(_p, _p);
	float _z = sqrt(max(0.001, 1.0 - _r2));
	vec3 _N = normalize(vec3(_p.x, _p.y, _z));
	vec3 _V = vec3(0.0, 0.0, 1.0);
	float _vn = max(dot(_N, _V), 0.0);
	float _fres = pow(1.0 - _vn, 2.35);
	float _fresWide = pow(1.0 - _vn, 1.55);
	float _rimBand = smoothstep(0.4, 0.93, _rr) * (1.0 - smoothstep(0.88, 1.03, _rr));
	float _hue = uIrisTime * 0.55 + _rr * 5.2 + _fres * 3.8;
	vec3 _a = vec3(sin(_hue * 1.1), sin(_hue * 1.1 + 2.1), sin(_hue * 1.1 + 4.18));
	_a = _a * 0.5 + 0.5;
	vec3 _iris = vec3(
		_a.x * 0.72 + 0.18,
		_a.y * 0.58 + 0.12,
		_a.z * 0.78 + 0.15
	);
	_iris = mix(_iris, vec3(0.72, 0.28, 0.58), 0.55);
	_iris = mix(_iris, vec3(0.22, 0.48, 0.82), 0.48);
	_iris = mix(_iris, vec3(0.52, 0.32, 0.78), 0.42);
	_iris = clamp(_iris, vec3(0.0), vec3(0.96));
	float _irisAmt = _rimBand * (0.38 * _fres + 0.42 * _fresWide) * 0.22;
	vec3 _glint = mix(vec3(0.45, 0.55, 0.88), vec3(0.82, 0.4, 0.72), 0.5 + 0.5 * sin(_hue * 0.9 + 1.0));
	diffuseColor.rgb += _iris * _irisAmt;
	diffuseColor.rgb += _glint * _rimBand * _fres * _fres * 0.07;
	diffuseColor.a *= _featherA;
	diffuseColor.a = max(diffuseColor.a, _rimBand * (_fres * 0.22 + _fresWide * 0.12) * 0.12);
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
  /**
   * Gezegen ölçeği — `images[i]` ile aynı uzunluk; yıl (portfolio EN) ile en yeni = en büyük.
   */
  cardScaleMuls: readonly number[];
  /** Yıla göre ölçek faktörü (min..max) — başlangıç derinlik dağılımında da kullanılır. */
  yearScaleFactors: readonly number[];
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
  yearScaleFactor,
  satelliteFloat,
  allCategoryLayout,
  hovered,
  modalOpen,
  sunBurstTexture,
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
  /** Year-derived factor (newer -> larger) for depth balance on first load. */
  yearScaleFactor: number;
  /** Cloud shell: Fibonacci positions + drift (same for “All” and single categories). */
  satelliteFloat: boolean;
  /** “All” kategorisi: yatay / rastgele dağılım. */
  allCategoryLayout: boolean;
  hovered: boolean;
  modalOpen: boolean;
  /** Shared sun-ray texture for all cards (see {@link GalleryScene}). */
  sunBurstTexture: THREE.Texture;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onPick: () => void;
  onSoftGalleryHint: () => void;
}) {
  const zoomFxRef = useContext(ZoomFxContext);
  const orbitPhysicsApiRef = useContext(OrbitDragPhysicsContext);
  const prefersReducedMotion = usePrefersReducedMotion();
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  /** Orbit drag: yay + gecikme — hedef konuma göre offset (grup uzayında). */
  const orbitOffRef = useRef(new THREE.Vector3());
  const orbitVelRef = useRef(new THREE.Vector3());
  /** Yayın denge noktası (0 değil); bırakınca güncellenir → simetrik dönüş yok. */
  const restBiasRef = useRef(new THREE.Vector3());
  const prevDragRef = useRef(false);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const smoothZoomRef = useRef(0);
  /** Previous smoothed zoom (0–1) — zoom wheel gives a small impulse to satellites. */
  const prevZoomZiRef = useRef<number | null>(null);
  /**
   * Layout-only zoom: lags behind `zi` while orbit-dragging so shell radius / parallax
   * don’t chase tiny camera-distance jitter (was a visible snap-back).
   */
  const smoothLayoutZoomRef = useRef(0);
  const smoothOpacityRef = useRef(1);
  const smoothMeshScaleRef = useRef(CARD_MESH_BASE_SCALE);
  /** Smoothed distance-based scale in “All” (near = larger, far = smaller). */
  const smoothDepthScaleRef = useRef(1);
  /** Hover lift only — kept separate so “All” satellite float does not fight the hover lerp. */
  const smoothHoverYRef = useRef(0);
  /** Cover photo → outer disc glow tint (same crop as card texture). */
  const coverOuterGlowRef = useRef(DEFAULT_DISC_OUTER_GLOW.clone());
  const smoothHoverHaloRef = useRef(0);
  /** Cumulative Z spin for sun-ray quad (quaternion reset from disc each frame). */
  const sunRaySpinAccumRef = useRef(0);
  const sunRayGroupRef = useRef<THREE.Group>(null);
  /** Kabuk: r (yarıçap), az (yaw), py (düzlem) — önceki kare bazına impuls. */
  const orbitDeformRef = useRef<OrbitDeformState>({ r: 0, az: 0, py: 0 });
  const orbitDeformVelRef = useRef<OrbitDeformState>({ r: 0, az: 0, py: 0 });
  const lastBaseLocalRef = useRef({ x: 0, y: 0, z: 0 });

  const finalImageUrl = primaryGalleryImageUrl(image);
  const texture = useResilientTexture(finalImageUrl);

  useEffect(() => {
    if (!texture) return;
    coverOuterGlowRef.current.copy(extractCoverDominantGlowVector(texture));
  }, [texture]);

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

  useEffect(() => {
    if (!modalOpen) return;
    orbitOffRef.current.set(0, 0, 0);
    orbitVelRef.current.set(0, 0, 0);
    restBiasRef.current.set(0, 0, 0);
    prevDragRef.current = false;
    orbitDeformRef.current = { r: 0, az: 0, py: 0 };
    orbitDeformVelRef.current = { r: 0, az: 0, py: 0 };
    lastBaseLocalRef.current = { x: 0, y: 0, z: 0 };
  }, [modalOpen]);

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

  const sunRayGeometry = useMemo(() => {
    if (!satelliteFloat) return null;
    const side = CARD_W * SUN_RAYS_PLANE_SIDE_MULT;
    return new THREE.PlaneGeometry(side, side, 1, 1);
  }, [satelliteFloat]);

  const sunRayMaterial = useMemo(() => {
    if (!satelliteFloat) return null;
    return createGallerySunburstHaloMaterial(sunBurstTexture);
  }, [satelliteFloat, sunBurstTexture]);

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
    mat.customProgramCacheKey = () => "galleryDiscFeatherGlowIris:v12";
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uIrisTime = { value: 0 };
      shader.uniforms.uCoverGlow = {
        value: DEFAULT_DISC_OUTER_GLOW.clone(),
      };
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
uniform float uIrisTime;
uniform vec3 uCoverGlow;`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        DISC_FEATHER_MAP_FRAGMENT_PATCH,
      );
      mat.userData.uIrisTimeUniform = shader.uniforms.uIrisTime;
      mat.userData.uCoverGlowUniform = shader.uniforms.uCoverGlow;
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
      if (sunRayGeometry) sunRayGeometry.dispose();
    };
  }, [sunRayGeometry]);

  useEffect(() => {
    return () => {
      if (sunRayMaterial) sunRayMaterial.dispose();
    };
  }, [sunRayMaterial]);

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
    const prevZi = prevZoomZiRef.current;
    const deltaZoom =
      prevZi === null ? 0 : THREE.MathUtils.clamp(zi - prevZi, -0.22, 0.22);
    prevZoomZiRef.current = zi;

    const api = orbitPhysicsApiRef?.current ?? null;
    const layoutZoomLerp = api?.isDragging === true ? 1.75 : 11;
    smoothLayoutZoomRef.current = THREE.MathUtils.lerp(
      smoothLayoutZoomRef.current,
      zi,
      Math.min(1, delta * layoutZoomLerp),
    );
    const ziLayout = smoothLayoutZoomRef.current;

    const t = Math.min(1, delta * HOVER_LERP);
    const zoomScale = 1 + ZOOM_SCALE_BOOST * ziLayout;
    /** Hub’a merkez çekişi için — hover ölçeği hariç (yoksa hover çekirdeğe süzülür gibi görünür). */
    const scaleForHubInward =
      CARD_MESH_BASE_SCALE * cardScaleMul * zoomScale;

    const hoverActive = hovered && !modalOpen ? 1 : 0;
    const hoverScaleMul = THREE.MathUtils.lerp(1, HOVER_SCALE, hoverActive);
    const targetS =
      CARD_MESH_BASE_SCALE * cardScaleMul * hoverScaleMul * zoomScale;
    /** Bulut görünümünde düşey “lift” yok; yaklaşma yalnızca `HOVER_TOWARD_CAMERA_WORLD` ile. */
    const targetY =
      hovered && !modalOpen ? (satelliteFloat ? 0 : HOVER_LIFT) : 0;

    const s = THREE.MathUtils.lerp(smoothMeshScaleRef.current, targetS, t);
    smoothMeshScaleRef.current = s;
    g.scale.set(1, 1, 1);

    const yHover = THREE.MathUtils.lerp(smoothHoverYRef.current, targetY, t);
    smoothHoverYRef.current = yHover;

    const depth = ZOOM_DEPTH_PULL * ziLayout;
    const recencyT = THREE.MathUtils.clamp(
      (yearScaleFactor - GALLERY_YEAR_PLANET_SCALE_MIN) /
        Math.max(
          GALLERY_YEAR_PLANET_SCALE_MAX - GALLERY_YEAR_PLANET_SCALE_MIN,
          1e-6,
        ),
      0,
      1,
    );
    const recencyDepthMul = THREE.MathUtils.lerp(0.72, 1.08, recencyT);
    const ageRetreat = THREE.MathUtils.lerp(0.055, 0, recencyT);
    const legacyRetreat = image.projectKey === "work/2" ? 0.09 : 0;
    const towardCameraDepth = Math.max(
      0,
      depth * recencyDepthMul - ageRetreat - legacyRetreat,
    );

    let px: number;
    let pz: number;
    let localY: number;
    let dx: number;
    let dz: number;
    /** Ring layout only; satellite discs use quaternion billboard instead. */
    let yaw = 0;

    if (satelliteFloat) {
      const allowDeformIntegrate =
        !prefersReducedMotion && !modalOpen && api !== null;
      if (allowDeformIntegrate) {
        integrateOrbitDeform(
          Math.min(delta, 0.055),
          api!,
          deltaZoom,
          camera,
          lastBaseLocalRef.current,
          radius,
          slot,
          GALLERY_GROUP_WORLD_SCALE,
          orbitDeformRef.current,
          orbitDeformVelRef.current,
        );
      }
      const d = orbitDeformRef.current;
      const shellR =
        radius *
        (1 + ZOOM_RING_EXPAND * ziLayout) *
        1.2 *
        (1 + THREE.MathUtils.clamp(d.r, -DEFORM_R_MAX, DEFORM_R_MAX));
      const [cx0, cy0, cz0] = allCloudBasePosition(
        slot,
        n,
        shellR,
        allCategoryLayout,
      );
      const az = THREE.MathUtils.clamp(d.az, -DEFORM_AZ_MAX, DEFORM_AZ_MAX);
      const ca = Math.cos(az);
      const sa = Math.sin(az);
      let cx = cx0 * ca - cz0 * sa;
      let cz = cx0 * sa + cz0 * ca;
      let cy = cy0 + d.py * radius * DEFORM_PY_RADIUS_MUL;
      const sep = galleryProjectShellSeparation(
        image.projectKey,
        allCategoryLayout,
      );
      /**
       * Açılış + zoom: `ziLayout`/`zTarget` birleşimi. work/3–5: taban ~0.82 — uzak zoom’da
       * tamamen sönüp yeniden yapışmasınlar (diğerleri hâlâ doğal toplanır).
       */
      let sepZoomBlend = THREE.MathUtils.clamp(
        Math.max(ziLayout, zTarget),
        0,
        1,
      );
      if (image.projectKey === "work/5") {
        sepZoomBlend = Math.max(sepZoomBlend, 0.82);
      }
      if (image.projectKey === "work/3") {
        sepZoomBlend = Math.min(sepZoomBlend, 0.72);
      }
      if (image.projectKey === "work/8") {
        sepZoomBlend = Math.min(sepZoomBlend, 0.68);
      }
      const sepAngleRad = sep.angleRad * sepZoomBlend;
      const sepYMul = sep.yMul * sepZoomBlend;
      if (sepAngleRad !== 0) {
        const rh = Math.hypot(cx, cz);
        if (rh > 1e-6) {
          const t0 = Math.atan2(cz, cx);
          const t1 = t0 + sepAngleRad;
          cx = Math.cos(t1) * rh;
          cz = Math.sin(t1) * rh;
        }
      }
      if (sepYMul !== 0) {
        cy += sepYMul * shellR;
      }
      if (sep.radialMul !== 1) {
        const rm = 1 + (sep.radialMul - 1) * sepZoomBlend;
        cx *= rm;
        cy *= rm;
        cz *= rm;
      }
      const radialPull = galleryProjectRadialPull(image.projectKey);
      if (radialPull > 0) {
        const f = 1 - radialPull;
        cx *= f;
        cy *= f;
        cz *= f;
      }

      _toCamera.subVectors(
        camera.position,
        _scratchA.set(cx, ORBIT_TARGET_Y + cy, cz),
      );
      const len0 = _toCamera.length();
      if (len0 > 1e-6) _toCamera.multiplyScalar(1 / len0);
      _toCamera.y *= ZOOM_TO_CAM_Y_DAMP;
      _toCamera.normalize();

      let basePx = cx + _toCamera.x * towardCameraDepth;
      let basePy = cy + _toCamera.y * towardCameraDepth * ZOOM_TO_CAM_Y_DAMP;
      let basePz = cz + _toCamera.z * towardCameraDepth;
      /** Yakın zoom’da merkeze sıkıştır — dağılmayı azaltır. */
      const cloudCompact = THREE.MathUtils.lerp(0.985, 0.93, ziLayout);
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
      const inwardPull =
        (scaleForHubInward - 1) * SCALE_INWARD_K * radius;
      const py =
        basePy + inwardY * inwardPull + driftY;
      px = basePx + inwardX * inwardPull + driftX;
      pz = basePz + inwardZ * inwardPull + driftZ;
      localY = py + yHover;

      lastBaseLocalRef.current.x = px;
      lastBaseLocalRef.current.y = localY;
      lastBaseLocalRef.current.z = pz;

      g.rotation.set(0, 0, 0);
    } else {
      const R = radius * (1 + ZOOM_RING_EXPAND * ziLayout);
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

      let basePx = bx + _toCamera.x * towardCameraDepth;
      let basePz = bz + _toCamera.z * towardCameraDepth;
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
      const inwardPull =
        (scaleForHubInward - 1) * SCALE_INWARD_K * radius;
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
    }

    const allowMotion =
      satelliteFloat && !prefersReducedMotion && !modalOpen;

    let fx = px;
    let fy = localY;
    let fz = pz;
    if (allowMotion && api) {
      const dt = Math.min(delta, 0.055);
      const off = orbitOffRef.current;
      const vel = orbitVelRef.current;
      const rest = restBiasRef.current;
      const omega = api.omegaSmoothed;
      const mom = api.orbitMomentum;
      const camAz = api.camAzimuth;

      const rh = Math.hypot(px, pz);
      const theta = rh > 1e-6 ? Math.atan2(px, pz) : 0;
      const coherence =
        1 + ORBIT_COHERENCE_AMP * Math.cos(2 * theta + mom * 2.45);
      const camPhase = camAz - theta;
      const radialMod = 0.72 + 0.28 * Math.cos(2 * camPhase + mom * 0.8);

      const mass = 0.86 + 0.13 * Math.sin(4 * theta + mom * 1.05);
      const kSpring =
        ORBIT_SPRING_K * (0.9 + 0.1 * Math.cos(3 * theta + mom * 0.9));
      const cDamp =
        ORBIT_SPRING_C * (0.88 + 0.12 * Math.sin(2 * theta + camAz * 0.5));
      const invM = 1 / mass;

      const wasDrag = prevDragRef.current;
      prevDragRef.current = api.isDragging;
      if (wasDrag && !api.isDragging) {
        const j = radius * DRAG_END_JITTER_MUL;
        rest.x = THREE.MathUtils.clamp(
          vel.x * REST_FROM_VEL_SCALE +
            (slotHash01(slot, 201) - 0.5) * 2 * j,
          -REST_BIAS_MAX,
          REST_BIAS_MAX,
        );
        rest.y = THREE.MathUtils.clamp(
          vel.y * REST_FROM_VEL_SCALE * 0.65 +
            (slotHash01(slot, 202) - 0.5) * 2 * j * 0.75,
          -REST_BIAS_MAX * 0.55,
          REST_BIAS_MAX * 0.55,
        );
        rest.z = THREE.MathUtils.clamp(
          vel.z * REST_FROM_VEL_SCALE +
            (slotHash01(slot, 203) - 0.5) * 2 * j,
          -REST_BIAS_MAX,
          REST_BIAS_MAX,
        );
      }

      if (!api.isDragging) {
        const decay = Math.min(1, REST_BIAS_DECAY * dt);
        rest.lerp(_scratchA.set(0, 0, 0), decay);
      }

      if (rh > 1e-5) {
        const tx = -pz / rh;
        const tz = px / rh;
        const rx = px / rh;
        const rz = pz / rh;
        const orthX = -tz;
        const orthZ = tx;

        const drive = omega * dt * invM;
        if (api.isDragging && Math.abs(omega) > 1e-6) {
          vel.x +=
            tx * drive * ORBIT_DRAG_SPIN_COUPLE * coherence +
            rx * drive * ORBIT_DRAG_RADIAL_COUPLE * coherence * radialMod +
            orthX * drive * ORBIT_DRAG_CROSS_COUPLE * coherence;
          vel.z +=
            tz * drive * ORBIT_DRAG_SPIN_COUPLE * coherence +
            rz * drive * ORBIT_DRAG_RADIAL_COUPLE * coherence * radialMod +
            orthZ * drive * ORBIT_DRAG_CROSS_COUPLE * coherence;
          vel.y +=
            omega *
            rh *
            ORBIT_DRAG_Y_COUPLE *
            Math.sin(theta + camAz) *
            dt *
            invM;
        } else if (!api.isDragging && Math.abs(mom) > 0.012) {
          const residual = mom * ORBIT_MOMENTUM_RESIDUAL * dt * invM;
          vel.x += tx * residual * coherence;
          vel.z += tz * residual * coherence;
        }
      }

      const ax = (-kSpring * (off.x - rest.x) - cDamp * vel.x) / mass;
      const ay = (-kSpring * (off.y - rest.y) - cDamp * vel.y) / mass;
      const az = (-kSpring * (off.z - rest.z) - cDamp * vel.z) / mass;
      vel.x += ax * dt;
      vel.y += ay * dt;
      vel.z += az * dt;
      off.x += vel.x * dt;
      off.y += vel.y * dt;
      off.z += vel.z * dt;
      const oLen = off.length();
      if (oLen > ORBIT_OFFSET_MAX) {
        off.multiplyScalar(ORBIT_OFFSET_MAX / oLen);
      }

      fx = px + off.x;
      fy = localY + off.y;
      fz = pz + off.z;
    }

    if (allowMotion) {
      const rh0 = Math.hypot(px, pz);
      const theta0 = rh0 > 1e-6 ? Math.atan2(px, pz) : 0;
      const mom0 = api?.orbitMomentum ?? 0;
      const camAz0 = api?.camAzimuth ?? 0;
      const idlePhase = theta0 * 2 + mom0 * 1.85 + camAz0 * 0.35;
      const ft = floatT;
      const ampBase = Math.max(radius, 1.2);
      const iy =
        ampBase * IDLE_FLOAT_Y_MUL *
          Math.sin(ft * IDLE_FLOAT_FREQ + idlePhase) +
        ampBase *
          IDLE_FLOAT_Y2_MUL *
          Math.sin(ft * IDLE_FLOAT_FREQ * 1.29 + idlePhase * 1.07);
      const ampXZ = ampBase * IDLE_FLOAT_XZ_MUL;
      const ix =
        ampXZ * Math.sin(ft * IDLE_FLOAT_FREQ * 0.81 + idlePhase * 1.25);
      const iz =
        ampXZ * Math.cos(ft * IDLE_FLOAT_FREQ * 0.74 + idlePhase * 1.18);
      fx += ix;
      fy += iy;
      fz += iz;
    }

    let depthScaleMul = 1;
    let layoutScaleMul = 1;
    if (satelliteFloat) {
      const S = GALLERY_GROUP_WORLD_SCALE;
      _scratchB.set(
        fx * S,
        ORBIT_TARGET_Y + fy * S,
        fz * S,
      );
      const distCam = camera.position.distanceTo(_scratchB);
      const refD = camera.position.distanceTo(_orbitTarget);
      const ratio = refD / Math.max(distCam, 0.01);
      const slotJitter =
        1 + (slotHash01(slot, 81) - 0.5) * 2 * PLANET_SLOT_SCALE_JITTER;
      let ratioWeighted = ratio * slotJitter;
      if (ratioWeighted > 1.0) {
        ratioWeighted =
          1.0 +
          (ratioWeighted - 1.0) * ALL_CLOUD_PERSPECTIVE_NEAR_STRETCH;
      }
      const perspectiveTarget = THREE.MathUtils.clamp(
        ratioWeighted,
        ALL_CLOUD_PERSPECTIVE_CLAMP_MIN,
        ALL_CLOUD_PERSPECTIVE_CLAMP_MAX,
      );
      const depthSmooth =
        api?.isDragging === true ? 4.8 : ALL_CLOUD_DEPTH_SMOOTH_SPEED;
      smoothDepthScaleRef.current = THREE.MathUtils.lerp(
        smoothDepthScaleRef.current,
        perspectiveTarget,
        Math.min(1, delta * depthSmooth),
      );
      depthScaleMul = smoothDepthScaleRef.current;
      const tw = galleryProjectLayoutTweak(
        image.projectKey,
        depthScaleMul,
        radius,
      );
      fy += tw.dy;
      layoutScaleMul = tw.scaleMul;
    } else {
      smoothDepthScaleRef.current = THREE.MathUtils.lerp(
        smoothDepthScaleRef.current,
        1,
        Math.min(1, delta * 18),
      );
      depthScaleMul = smoothDepthScaleRef.current;
    }

    if (satelliteFloat && hovered && !modalOpen) {
      const span =
        ALL_CLOUD_PERSPECTIVE_CLAMP_MAX - ALL_CLOUD_PERSPECTIVE_CLAMP_MIN;
      const tNear =
        span > 1e-6
          ? THREE.MathUtils.clamp(
              (depthScaleMul - ALL_CLOUD_PERSPECTIVE_CLAMP_MIN) / span,
              0,
              1,
            )
          : 0;
      const farBoost = 1 - tNear;
      const Sw = GALLERY_GROUP_WORLD_SCALE;
      const wx = fx * Sw;
      const wy = ORBIT_TARGET_Y + fy * Sw;
      const wz = fz * Sw;
      _toCamera.subVectors(camera.position, _scratchA.set(wx, wy, wz));
      const len = _toCamera.length();
      if (len > 1e-6) {
        _toCamera.multiplyScalar(1 / len);
        /** Yakındaki disklerde de belirgin: taban + uzak slotlarda ekstra. */
        const pullW =
          HOVER_TOWARD_CAMERA_WORLD *
          THREE.MathUtils.lerp(0.5, 1, farBoost);
        fx += (_toCamera.x * pullW) / Sw;
        fy += (_toCamera.y * pullW) / Sw;
        fz += (_toCamera.z * pullW) / Sw;
      }
    }

    g.position.set(fx, fy, fz);

    mesh.scale.setScalar(s * depthScaleMul * layoutScaleMul);

    const Sw = GALLERY_GROUP_WORLD_SCALE;
    _scratchB.set(fx * Sw, ORBIT_TARGET_Y + fy * Sw, fz * Sw);
    _toCamera.subVectors(camera.position, _scratchB);
    const dCam = _toCamera.length();

    if (satelliteFloat) {
      if (dCam > 1e-7) {
        _toCamera.multiplyScalar(1 / dCam);
        const z = _toCamera;
        _bbRight.crossVectors(_bbWorldUp, z);
        if (_bbRight.lengthSq() < 1e-10) {
          _bbRight.set(1, 0, 0).cross(z);
        }
        if (_bbRight.lengthSq() < 1e-10) {
          mesh.quaternion.identity();
        } else {
          _bbRight.normalize();
          _bbUp.crossVectors(z, _bbRight).normalize();
          _bbMatrix.makeBasis(_bbRight, _bbUp, z);
          mesh.quaternion.setFromRotationMatrix(_bbMatrix);
        }
      }
      _frontNormal.set(0, 0, 1).applyQuaternion(mesh.quaternion);
    } else {
      mesh.rotation.set(0, yaw, 0);
      _frontNormal.set(0, 0, 1).applyAxisAngle(
        THREE.Object3D.DEFAULT_UP,
        yaw,
      );
      if (dCam > 1e-6) _toCamera.multiplyScalar(1 / dCam);
    }

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
      const m = mats as THREE.MeshBasicMaterial & {
        userData: {
          uIrisTimeUniform?: { value: number };
          uCoverGlowUniform?: { value: THREE.Vector3 };
        };
      };
      m.opacity = op;
      m.transparent = true;
      m.depthWrite = false;
      const uT = m.userData.uIrisTimeUniform;
      const uGlow = m.userData.uCoverGlowUniform;
      if (uGlow) {
        uGlow.value.copy(coverOuterGlowRef.current);
      }
      if (uT) {
        /** Slow hue drift only — rim/glow no longer tied to orbit drag. */
        uT.value = state.clock.elapsedTime * 0.22;
      }
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

    if (satelliteFloat && mesh) {
      const targetH = hovered && !modalOpen ? 1 : 0;
      smoothHoverHaloRef.current = THREE.MathUtils.lerp(
        smoothHoverHaloRef.current,
        targetH,
        Math.min(1, delta * HOVER_HALO_LERP),
      );
      const a = smoothHoverHaloRef.current;
      const g = coverOuterGlowRef.current;

      if (sunRayGroupRef.current && sunRayMaterial) {
        const srGroup = sunRayGroupRef.current;
        srGroup.raycast = () => {};
        for (const child of srGroup.children) {
          if (child instanceof THREE.Mesh) child.raycast = () => {};
        }
        const su = sunRayMaterial.uniforms as {
          uAlpha: { value: number };
          uTint: { value: THREE.Vector3 };
          uTime: { value: number };
        };
        su.uAlpha.value = a;
        su.uTime.value = prefersReducedMotion ? 0 : state.clock.elapsedTime;
        _sunRayCoverTint.setRGB(g.x, g.y, g.z);
        const lum =
          _sunRayCoverTint.r * 0.299 +
          _sunRayCoverTint.g * 0.587 +
          _sunRayCoverTint.b * 0.114;
        _sunRayCoverTint.r = THREE.MathUtils.clamp(
          lum + (_sunRayCoverTint.r - lum) * HALO_RING_COVER_SAT_BOOST,
          0.04,
          1,
        );
        _sunRayCoverTint.g = THREE.MathUtils.clamp(
          lum + (_sunRayCoverTint.g - lum) * HALO_RING_COVER_SAT_BOOST,
          0.04,
          1,
        );
        _sunRayCoverTint.b = THREE.MathUtils.clamp(
          lum + (_sunRayCoverTint.b - lum) * HALO_RING_COVER_SAT_BOOST,
          0.04,
          1,
        );
        applyHaloRingPastelLiftForDarkCovers(_sunRayCoverTint);
        su.uTint.value.set(
          _sunRayCoverTint.r,
          _sunRayCoverTint.g,
          _sunRayCoverTint.b,
        );
        if (a < 0.02) {
          sunRaySpinAccumRef.current = 0;
        } else if (!prefersReducedMotion) {
          sunRaySpinAccumRef.current += delta * HALO_RING_SPIN_SPEED;
        }
        srGroup.quaternion.copy(mesh.quaternion);
        srGroup.rotateZ(sunRaySpinAccumRef.current);
        const base = Math.max(mesh.scale.x, mesh.scale.y);
        srGroup.scale.setScalar(base);
      }

      const onTop = hovered && !modalOpen;
      const cardGroup = groupRef.current;
      if (cardGroup) {
        cardGroup.renderOrder = onTop ? GALLERY_CARD_HOVER_RENDER_ORDER : 0;
      }
      mesh.renderOrder = onTop ? GALLERY_CARD_HOVER_RENDER_ORDER : 0;
      if (sunRayGroupRef.current) {
        const haloRenderOrder = onTop
          ? GALLERY_CARD_HOVER_RENDER_ORDER + 1
          : GALLERY_HALO_RENDER_ORDER;
        for (const child of sunRayGroupRef.current.children) {
          if (child instanceof THREE.Mesh) {
            child.renderOrder = haloRenderOrder;
          }
        }
      }
    } else if (mesh) {
      mesh.renderOrder =
        hovered && !modalOpen ? GALLERY_CARD_HOVER_RENDER_ORDER : 0;
    }
  });

  return (
    <group ref={groupRef} frustumCulled={false}>
      {SHOW_HOVER_SELECTION_RING_PNG &&
      satelliteFloat &&
      sunRayGeometry &&
      sunRayMaterial ? (
        <group
          ref={sunRayGroupRef}
          position={[0, 0, GALLERY_HALO_LAYER_Z]}
          frustumCulled={false}
        >
          <mesh
            geometry={sunRayGeometry}
            material={sunRayMaterial}
            frustumCulled={false}
            renderOrder={GALLERY_HALO_RENDER_ORDER}
          />
          <mesh
            geometry={sunRayGeometry}
            material={sunRayMaterial}
            position={[0, 0, GALLERY_HALO_DARKEN_LAYER_Z]}
            frustumCulled={false}
            renderOrder={GALLERY_HALO_RENDER_ORDER}
          />
        </group>
      ) : null}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={
          satelliteFloat ? (circleMaterial as THREE.MeshBasicMaterial) : boxMaterials!
        }
        frustumCulled={false}
        userData={{ galleryProjectKey: image.projectKey }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          if (modalOpen) return;
          wakeGalleryHoverAudioFromUserGesture();
          if (!prefersReducedMotion) {
            playGalleryHoverChime();
          }
          onHoverStart();
        }}
        onPointerOut={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHoverEnd();
        }}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          primeGalleryAudioEngineFromUserGesture();
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
          playGalleryClickSound();
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
  cardScaleMuls,
  yearScaleFactors,
  orbitDefaultDistanceT,
  allCategoryLayout,
  orbitControlsRef,
  hoveredIndex,
  setHoveredIndex,
  modalOpen,
  onPick,
  onSoftGalleryHint,
}: GallerySceneProps) {
  const handControl = useGalleryHandControl();
  const handMode = handControl?.activeMode ?? "free";
  const handBlocksMouse = Boolean(
    handControl?.enabled && !modalOpen && handMode === "steer",
  );
  const handStopsAutoRotate = Boolean(
    handControl?.enabled && !modalOpen && handMode !== "free",
  );
  const visibleCount = visibleIndices.length;
  const satelliteFloat = true;
  const autoRotateSpeed =
    visibleCount >= 2 ? AUTO_ROTATE_SPEED_MANY : AUTO_ROTATE_SPEED;
  const minPolarRad = THREE.MathUtils.degToRad(ORBIT_POLAR_MIN_DEG);
  const maxPolarRad = THREE.MathUtils.degToRad(ORBIT_POLAR_MAX_DEG);
  const swappedSlotsByImageIndex = useMemo(() => {
    const byIndex = new Map<number, number>();
    const slotByProjectKey = new Map<string, number>();
    visibleIndices.forEach((imageIndex, slot) => {
      const img = images[imageIndex];
      if (!img) return;
      slotByProjectKey.set(img.projectKey, slot);
      byIndex.set(imageIndex, slot);
    });
    const swapProjects = (a: string, b: string) => {
      const slotA = slotByProjectKey.get(a);
      const slotB = slotByProjectKey.get(b);
      if (slotA == null || slotB == null) return;
      const idxA = visibleIndices[slotA];
      const idxB = visibleIndices[slotB];
      if (idxA == null || idxB == null) return;
      byIndex.set(idxA, slotB);
      byIndex.set(idxB, slotA);
    };
    swapProjects("work/2", "work/12");
    swapProjects("work/5", "work/8");
    return byIndex;
  }, [images, visibleIndices]);

  const sunBurstTex = useTexture(gallerySunRayAssetUrl);
  useLayoutEffect(() => {
    sunBurstTex.colorSpace = THREE.SRGBColorSpace;
    sunBurstTex.wrapS = THREE.ClampToEdgeWrapping;
    sunBurstTex.wrapT = THREE.ClampToEdgeWrapping;
    sunBurstTex.needsUpdate = true;
  }, [sunBurstTex]);

  const { size } = useThree();
  const aspect = Math.max(size.width / Math.max(size.height, 1), 0.25);
  const { min: minZoomDistance, max: maxZoomDistance } = useMemo(
    () => orbitZoomLimits(ringRadius, aspect),
    [ringRadius, aspect],
  );
  const defaultZoomDistance = useMemo(
    () =>
      THREE.MathUtils.clamp(
        baseOrbitCameraDistance(ringRadius, aspect, orbitDefaultDistanceT),
        minZoomDistance,
        maxZoomDistance,
      ),
    [ringRadius, aspect, orbitDefaultDistanceT, minZoomDistance, maxZoomDistance],
  );
  const defaultPolarRef = useRef<number | null>(null);
  /** Açılışta 0 olunca ilk paint’te ayrım blend’i 0 kalıyordu; ~varsayılan orbit’e yakın. */
  const zoomFxRef = useRef({
    zoomIn: 0.52,
    camAzimuth: DEFAULT_ORBIT_AZIMUTH_RAD,
  });
  const orbitPhysicsApiRef = useRef<OrbitDragPhysicsApi>({
    omegaSmoothed: 0,
    isDragging: false,
    camAzimuth: DEFAULT_ORBIT_AZIMUTH_RAD,
    orbitMomentum: 0,
  });

  useEffect(() => {
    preloadGalleryHoverSfx();
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    orbitPhysicsApiRef.current.orbitMomentum = 0;
  }, [modalOpen]);

  return (
    <ZoomFxContext.Provider value={zoomFxRef}>
      <OrbitDragPhysicsContext.Provider value={orbitPhysicsApiRef}>
        <OrbitDragPhysicsSync
          orbitControlsRef={orbitControlsRef}
          apiRef={orbitPhysicsApiRef}
        />
      <GalleryParallaxBridge
        orbitControlsRef={orbitControlsRef}
        minDistance={minZoomDistance}
        maxDistance={maxZoomDistance}
      />
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
        enableZoom={!modalOpen && !handBlocksMouse}
        enableRotate={!modalOpen && !handBlocksMouse}
        zoomSpeed={0.72}
        rotateSpeed={1.05}
        enableDamping
        dampingFactor={0.052}
        minDistance={minZoomDistance}
        maxDistance={maxZoomDistance}
        autoRotate={!modalOpen && hoveredIndex === null && !handStopsAutoRotate}
        autoRotateSpeed={autoRotateSpeed}
        minPolarAngle={minPolarRad}
        maxPolarAngle={maxPolarRad}
        target={[0, ORBIT_TARGET_Y, 0]}
        onStart={onSoftGalleryHint}
      />
      <GalleryOrbitWheelSmooth
        orbitControlsRef={orbitControlsRef}
        enabled={!modalOpen && !handBlocksMouse}
        minDistance={minZoomDistance}
        maxDistance={maxZoomDistance}
        zoomSpeed={0.72}
      />
      <GalleryHandOrbitBridge
        orbitControlsRef={orbitControlsRef}
        modalOpen={modalOpen}
        minPolarAngle={minPolarRad}
        maxPolarAngle={maxPolarRad}
      />
      <GalleryHandZoomBridge
        orbitControlsRef={orbitControlsRef}
        modalOpen={modalOpen}
        minDistance={minZoomDistance}
        maxDistance={maxZoomDistance}
        defaultDistance={defaultZoomDistance}
        defaultAzimuthRad={DEFAULT_ORBIT_AZIMUTH_RAD}
        defaultPolarRef={defaultPolarRef}
      />
      <RingCameraSync
        ringRadius={ringRadius}
        orbitControlsRef={orbitControlsRef}
        defaultDistanceT={orbitDefaultDistanceT}
      />
      <AdaptiveFovSync
        layoutRingRadius={ringRadius}
        minDistance={minZoomDistance}
        maxDistance={maxZoomDistance}
      />
      {GALLERY_SCENE_DEBUG ? (
        <GallerySceneDebugLogger
          ringRadius={ringRadius}
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
          const cardScaleMul = cardScaleMuls[imageIndex] ?? 1;
          const yearScaleFactor = yearScaleFactors[imageIndex] ?? 1;
          const mappedSlot = swappedSlotsByImageIndex.get(imageIndex) ?? slot;
          return (
            <GalleryCardMesh
              key={`card-${imageIndex}`}
              image={image}
              slot={mappedSlot}
              visibleCount={visibleIndices.length}
              radius={ringRadius}
              cardScaleMul={cardScaleMul}
              yearScaleFactor={yearScaleFactor}
              satelliteFloat={satelliteFloat}
              allCategoryLayout={allCategoryLayout}
              hovered={hoveredIndex === imageIndex}
              modalOpen={modalOpen}
              sunBurstTexture={sunBurstTex}
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
      </OrbitDragPhysicsContext.Provider>
    </ZoomFxContext.Provider>
  );
}

/** Portfolio detail: index `0` is hero only; `1+` stacked vertically, aspect preserved. */
const ProjectImageScroll = forwardRef(function ProjectImageScroll(
  {
    urls,
    heroAlt,
    className,
    outerScrollRef,
    muteWhenReadingRef,
    playbackSyncKey,
  }: {
    urls: string[];
    heroAlt: string;
    className?: string;
    /** Modal backdrop scroll — sync video play/pause when reading info below. */
    outerScrollRef?: MutableRefObject<HTMLDivElement | null>;
    /** When this block enters view, pause all detail videos (info section). */
    muteWhenReadingRef?: MutableRefObject<HTMLElement | null>;
    /** Re-bind scroll listeners when modal opens (outer ref is ready). */
    playbackSyncKey?: string;
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
  const forcedPlayIndexRef = useRef<number | null>(null);

  const detailUrlsKey = useMemo(() => detailUrls.join("\0"), [detailUrls]);
  const heroUrl = useMemo(() => primaryGalleryTextureUrl(urls), [urls]);
  const heroSrc = useMemo(
    () => withGalleryAssetCacheBust(heroUrl),
    [heroUrl, detailUrlsKey],
  );
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
    const readingEl = muteWhenReadingRef?.current ?? null;
    const scrollPick = pickDetailVideoPlayIndex(
      detailUrls,
      srcFor,
      failed,
      itemRefs.current,
      null,
      readingEl,
    );
    if (
      forcedPlayIndexRef.current != null &&
      (scrollPick < 0 || scrollPick !== forcedPlayIndexRef.current)
    ) {
      forcedPlayIndexRef.current = null;
    }
    syncDetailVideoPlayback(
      detailUrls,
      srcFor,
      failed,
      itemRefs.current,
      videoRefs.current,
      forcedPlayIndexRef.current,
      readingEl,
    );
  }, [detailUrls, srcFor, failed, muteWhenReadingRef]);

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
    forcedPlayIndexRef.current = null;
  }, [detailUrls.length]);

  useEffect(() => {
    const onFullscreenChanged = () => {
      const fsEl = document.fullscreenElement;
      if (!fsEl) {
        forcedPlayIndexRef.current = null;
        schedulePlaybackSync();
        return;
      }
      const idx = videoRefs.current.findIndex((v) => v === fsEl);
      forcedPlayIndexRef.current = idx >= 0 ? idx : null;
      schedulePlaybackSync();
    };
    document.addEventListener("fullscreenchange", onFullscreenChanged);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChanged);
  }, [schedulePlaybackSync]);

  useEffect(() => {
    return () => {
      if (playbackRafRef.current !== 0) {
        cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = 0;
      }
    };
  }, []);

  useEffect(() => {
    if (detailUrls.length === 0) return;
    syncPlayback();

    const scrollRoots = new Set<HTMLDivElement>();
    const inner = scrollRef.current;
    const outer = outerScrollRef?.current;
    if (inner) scrollRoots.add(inner);
    if (outer) scrollRoots.add(outer);

    for (const el of scrollRoots) {
      el.addEventListener("scroll", schedulePlaybackSync, { passive: true });
    }
    const ro = new ResizeObserver(() => schedulePlaybackSync());
    if (inner) ro.observe(inner);
    window.addEventListener("resize", schedulePlaybackSync);

    const io = new IntersectionObserver(
      () => schedulePlaybackSync(),
      { root: null, threshold: [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1] },
    );
    for (const el of itemRefs.current) {
      if (el) io.observe(el);
    }

    return () => {
      for (const el of scrollRoots) {
        el.removeEventListener("scroll", schedulePlaybackSync);
      }
      ro.disconnect();
      window.removeEventListener("resize", schedulePlaybackSync);
      io.disconnect();
    };
  }, [
    detailUrls.length,
    detailUrlsKey,
    outerScrollRef,
    playbackSyncKey,
    schedulePlaybackSync,
    syncPlayback,
  ]);

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
        className={cn(
          "min-h-[min(70vh,580px)] w-full min-w-0 bg-app-shell-bg/40",
          className,
        )}
        role="region"
        aria-label={heroAlt}
      >
        <img
          src={heroSrc}
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
      className={cn(
        "max-h-[min(70vh,580px)] w-full min-w-0 overflow-y-auto overscroll-y-auto bg-app-shell-bg/35 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0",
        className,
      )}
      role="region"
      aria-label={heroAlt}
    >
      <div className="flex w-full flex-col gap-8">
        {detailUrls.map((url, i) => {
          const src = failed[url]
            ? fallbackImageUrl()
            : withGalleryAssetCacheBust(url);
          const indexLabel = galleryFilenameIndex(url);
          const showVideo = !failed[url] && isVideoUrl(src);
          const label =
            indexLabel != null ? `${heroAlt} — ${indexLabel}` : heroAlt;
          const isPrimaryDetailVideo =
            showVideo && firstVideoUrl != null && url === firstVideoUrl;
          const videoPoster = showVideo ? detailVideoPosterUrl(url) : null;
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
                  poster={videoPoster ?? undefined}
                  controls
                  controlsList="nodownload"
                  playsInline
                  preload="auto"
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
                  onPlay={(e) => {
                    if (e.nativeEvent.isTrusted) {
                      forcedPlayIndexRef.current = i;
                    }
                    schedulePlaybackSync();
                  }}
                  onPause={() => {
                    if (forcedPlayIndexRef.current === i) {
                      forcedPlayIndexRef.current = null;
                    }
                    schedulePlaybackSync();
                  }}
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
  const galleryShellRef = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(
    null,
  );

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
  const parallaxRef = useRef(DEFAULT_GALLERY_PARALLAX);

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

  const galleryYearScaleFactors = useMemo(
    () => galleryYearScaleFactorsForProjectKeys(images.map((img) => img.projectKey)),
    [images],
  );

  const galleryCardScaleMuls = useMemo(() => {
    const base = ALL_CLOUD_LAYOUT_SCALE * GALLERY_COVER_GLOBAL_SCALE;
    return galleryYearScaleFactors.map((f) => base * f);
  }, [galleryYearScaleFactors]);

  const cameraWorldPos = useMemo((): [number, number, number] => {
    const aspect = defaultViewportAspect();
    const { min, max } = orbitZoomLimits(ringRadius, aspect);
    const D = THREE.MathUtils.clamp(
      baseOrbitCameraDistance(ringRadius, aspect, orbitDefaultDistanceT),
      min,
      max,
    );
    return cameraTupleForOrbitDistance(D);
  }, [ringRadius, orbitDefaultDistanceT]);

  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [favoriteKeys, setFavoriteKeys] = useState(readGalleryFavoriteKeys);
  const [shareCopied, setShareCopied] = useState(false);
  const shareCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const closeModal = useCallback(() => {
    navigate(
      { pathname: "/", hash: location.hash, search: "" },
      { replace: true },
    );
    onCloseModal?.();
  }, [navigate, location.hash, onCloseModal]);

  const handlePick = useCallback(
    (image: GalleryImage) => {
      navigate(
        {
          pathname: galleryProjectPath(image.projectKey),
          hash: location.hash,
          search: "",
        },
        { replace: false },
      );
      onOpenImage?.(image);
    },
    [navigate, location.hash, onOpenImage],
  );

  useLayoutEffect(() => {
    if (location.pathname !== "/") return;
    const sp = new URLSearchParams(location.search);
    const legacy = sp.get(LEGACY_GALLERY_PROJECT_QUERY);
    if (!legacy) return;
    const image = images.find((img) => img.projectKey === legacy);
    sp.delete(LEGACY_GALLERY_PROJECT_QUERY);
    const qs = sp.toString();
    if (!image) {
      navigate({ pathname: "/", search: qs ? `?${qs}` : "" }, { replace: true });
      return;
    }
    navigate(
      {
        pathname: galleryProjectPath(legacy),
        search: qs ? `?${qs}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, images, navigate]);

  useLayoutEffect(() => {
    const categoryFolder = params.categoryFolder;
    const slug = params.slug;
    if (!categoryFolder || !slug) {
      setSelectedImage(null);
      return;
    }
    const projectKey = projectKeyFromParts(categoryFolder, slug);
    const image = images.find((img) => img.projectKey === projectKey);
    if (!image) {
      navigate("/", { replace: true });
      return;
    }
    prefetchDetailModalMedia(image.images);
    setSelectedImage(image);
  }, [params.categoryFolder, params.slug, images, navigate]);

  const toggleFavorite = useCallback((projectKey: string) => {
    setFavoriteKeys((prev) => {
      const next = new Set(prev);
      if (next.has(projectKey)) next.delete(projectKey);
      else next.add(projectKey);
      persistGalleryFavoriteKeys(next);
      return next;
    });
  }, []);

  const dismissShareCopiedSoon = useCallback(() => {
    if (shareCopiedTimerRef.current !== null) {
      clearTimeout(shareCopiedTimerRef.current);
    }
    shareCopiedTimerRef.current = window.setTimeout(() => {
      setShareCopied(false);
      shareCopiedTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(
    () => () => {
      if (shareCopiedTimerRef.current !== null) {
        clearTimeout(shareCopiedTimerRef.current);
      }
    },
    [],
  );

  const detailModalOpen = selectedImage !== null;

  useEffect(() => {
    if (!detailModalOpen) setShareCopied(false);
  }, [detailModalOpen]);

  const handleShareProject = useCallback(async () => {
    if (selectedImage == null) return;
    navigate(
      {
        pathname: galleryProjectPath(selectedImage.projectKey),
        hash: location.hash,
        search: "",
      },
      { replace: false },
    );
    const shareUrl = absoluteGalleryPieceUrl(selectedImage.projectKey);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      dismissShareCopiedSoon();
    } catch {
      window.prompt(messages.gallery.modalShareAriaLabel, shareUrl);
    }
  }, [
    selectedImage,
    navigate,
    location.hash,
    messages.gallery.modalShareAriaLabel,
    dismissShareCopiedSoon,
  ]);

  const detailModalScrollRef = useRef<HTMLDivElement>(null);
  const modalDetailWheelRootRef = useRef<HTMLDivElement>(null);
  const detailInfoRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!detailModalOpen) return;
    const root = modalDetailWheelRootRef.current;
    if (!root) return;

    const onWheel = (e: WheelEvent) => {
      const scrollEl = detailModalScrollRef.current;
      if (!scrollEl || e.deltaY === 0) return;

      const delta = e.deltaY;
      const innerOverflows =
        scrollEl.scrollHeight > scrollEl.clientHeight + 1;
      const innerAtTop = scrollEl.scrollTop <= 0.5;
      const innerAtBottom =
        scrollEl.scrollTop + scrollEl.clientHeight >=
        scrollEl.scrollHeight - 0.5;

      if (delta > 0) {
        if (innerOverflows && !innerAtBottom) {
          e.preventDefault();
          scrollEl.scrollTop += delta;
          scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
        }
        return;
      }

      if (delta < 0) {
        if (root.scrollTop > 0.5) {
          return;
        }
        if (innerOverflows && !innerAtTop) {
          e.preventDefault();
          scrollEl.scrollTop += delta;
          scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
        }
      }
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
      <HandControlOverlay modalOpen={detailModalOpen} />
      <GalleryHandModalEffect
        modalOpen={detailModalOpen}
        scrollRef={detailModalScrollRef}
        onCloseModal={closeModal}
      />
      <div className="flex min-h-0 w-full flex-1 flex-col px-0 pb-0 pt-0">
        <div
          ref={galleryShellRef}
          className="relative min-h-[220px] w-full min-w-0 flex-1 basis-0 select-none bg-background sm:min-h-[240px]"
          style={{
            touchAction: "none",
            backgroundImage: "var(--app-shell-gradient)",
            backgroundAttachment: "fixed",
          }}
          onPointerMove={(e) => {
            const el = galleryShellRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            setPointer({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }}
          onPointerLeave={() => setPointer(null)}
        >
          <GalleryParallaxContext.Provider value={parallaxRef}>
            <GalleryMouseParticles
              active={!detailModalOpen}
              pointer={pointer}
            />
          <Canvas
            className="absolute inset-0 z-[1] h-full w-full touch-none [transform:translateZ(0)]"
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
            <Suspense fallback={null}>
              <GalleryScene
                  images={images}
                  visibleIndices={visibleIndices}
                  ringRadius={ringRadius}
                  orbitFramingRadius={orbitFramingRadius}
                  cardScaleMuls={galleryCardScaleMuls}
                  yearScaleFactors={galleryYearScaleFactors}
                  orbitDefaultDistanceT={orbitDefaultDistanceT}
                  allCategoryLayout={allFibonacciShellLayout}
                  orbitControlsRef={orbitControlsRef}
                  hoveredIndex={hoveredIndex}
                  setHoveredIndex={setHoveredIndex}
                  modalOpen={detailModalOpen}
                  onPick={handlePick}
                  onSoftGalleryHint={noopSoftGalleryHint}
                />
              </Suspense>
          </Canvas>
          </GalleryParallaxContext.Provider>
        </div>

        <p
          className="pointer-events-none w-full shrink-0 self-start pb-1 pt-2 text-left text-[length:var(--font-size)] font-medium italic leading-snug tracking-[0.12em] text-muted-foreground sm:pb-1.5"
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
              className="absolute inset-0 overflow-y-auto overscroll-y-auto p-6 sm:p-10 flex items-start justify-center"
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
              className="relative flex w-full max-w-3xl min-h-0 flex-col gap-10 pb-4"
              onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            >
              <div className="min-h-0 w-full min-w-0 shrink-0 bg-app-shell-bg">
                <ProjectImageScroll
                  ref={detailModalScrollRef}
                  outerScrollRef={modalDetailWheelRootRef}
                  muteWhenReadingRef={detailInfoRef}
                  playbackSyncKey={selectedImage.projectKey}
                  key={`${selectedImage.projectKey}|${selectedImage.images.join("|")}`}
                  urls={selectedImage.images}
                  heroAlt={selectedPortfolioCopy.title}
                  className="min-h-[min(70vh,580px)] max-h-[min(70vh,580px)]"
                />
              </div>

              <motion.div
                ref={detailInfoRef}
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{
                  delay: 0.1,
                  duration: 0.4,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="flex min-h-0 w-full flex-col gap-10 justify-start"
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

                <div className="flex flex-wrap items-center gap-3">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={closeModal}
                    className="w-fit rounded-full bg-primary px-6 py-2.5 text-sm tracking-wide text-primary-foreground"
                    style={{ fontWeight: 500 }}
                  >
                    {galleryCopy.backToGallery}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleFavorite(selectedImage.projectKey)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    style={{ fontWeight: 500 }}
                    aria-label={galleryCopy.modalFavoriteAriaLabel}
                    aria-pressed={favoriteKeys.has(selectedImage.projectKey)}
                  >
                    <Heart
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        favoriteKeys.has(selectedImage.projectKey) ?
                          "fill-[#db544b] stroke-[#db544b] text-[#db544b]"
                        : "fill-transparent stroke-primary-foreground text-primary-foreground",
                      )}
                      strokeWidth={2}
                    />
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => void handleShareProject()}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm tracking-wide text-primary-foreground"
                    style={{ fontWeight: 500 }}
                    aria-label={galleryCopy.modalShareAriaLabel}
                  >
                    <Share className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                  </motion.button>
                  {shareCopied ? (
                    <span
                      className="text-sm text-muted-foreground"
                      aria-live="polite"
                    >
                      {galleryCopy.modalShareCopied}
                    </span>
                  ) : null}
                  {selectedImage.projectKey === "work/2" &&
                  WORK2_ARTSTATION_BUTTON_ENABLED ? (
                    <a
                      href={WORK2_ARTSTATION_ALBUM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={galleryCopy.artStationAlbumAriaLabel}
                    >
                      <img
                        src={artstationIconUrl}
                        alt=""
                        width={22}
                        height={22}
                        className="h-[22px] w-[22px] object-contain"
                        decoding="async"
                      />
                    </a>
                  ) : null}
                </div>
              </motion.div>

              <button
                type="button"
                onClick={closeModal}
                className="absolute -right-1 -top-1 rounded-full bg-card p-2.5 text-foreground transition-transform hover:scale-105"
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
