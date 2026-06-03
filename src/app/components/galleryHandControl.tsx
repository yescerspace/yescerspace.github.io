import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { ClassifiedHand } from "../utils/handGestures";

export type HandedLabel = "left" | "right";
export type HandPoint = { x: number; y: number };
export type HandOverlaySnapshot = {
  handed: HandedLabel;
  points: HandPoint[];
  highlights: number[];
};

/** Kullanıcının fiziksel elleri (selfie). */
export type PhysicalHandState = ClassifiedHand;

/**
 * free — el yok veya 5 parmak açık değil
 * steer — iki el 5 parmak açık: el arası mesafe (azimuth), sağ Y (polar)
 * detail — proje sayfası: sağ el Y kaydır, sol yumruk kapat
 */
export type HandControlMode = "free" | "steer" | "detail";

export type GalleryHandSample = {
  handDetected: boolean;
  mode: HandControlMode;
  userLeft: PhysicalHandState;
  userRight: PhysicalHandState;
  /** İki avuç arası mesafe (0–1 normalize); daralınca sağa, açılınca sola döner */
  handsSpan: number;
  /** Sol yumruk kenarı → detayı kapat */
  closePulse: boolean;
  /** 🙏 — uzaklaştır + merkez */
  zoomOutPulse: boolean;
  /** Teslim ol — açılış boyutuna dön */
  resetZoomPulse: boolean;
  /** Zoom animasyonu sırasında orbit el kontrolü kilitli */
  orbitLocked: boolean;
  overlayHands: HandOverlaySnapshot[];
};

const EMPTY_HAND: PhysicalHandState = {
  detected: false,
  gesture: "none",
  pinchX: 0.5,
  pinchY: 0.5,
  palmX: 0.5,
  palmY: 0.5,
  indexY: 0.5,
  pinchProximity: 0,
};

const EMPTY_SAMPLE: GalleryHandSample = {
  handDetected: false,
  mode: "free",
  userLeft: { ...EMPTY_HAND },
  userRight: { ...EMPTY_HAND },
  handsSpan: 0,
  closePulse: false,
  zoomOutPulse: false,
  resetZoomPulse: false,
  orbitLocked: false,
  overlayHands: [],
};

export type GalleryHandControlContextValue = {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  activeMode: HandControlMode;
  setActiveMode: (mode: HandControlMode) => void;
  trackingReady: boolean;
  setTrackingReady: (ready: boolean) => void;
  trackingError: string | null;
  setTrackingError: (msg: string | null) => void;
  sampleRef: MutableRefObject<GalleryHandSample>;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
};

const GalleryHandControlContext =
  createContext<GalleryHandControlContextValue | null>(null);

export function GalleryHandControlProvider({
  children,
  defaultEnabled = false,
}: {
  children: ReactNode;
  defaultEnabled?: boolean;
}) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [activeMode, setActiveMode] = useState<HandControlMode>("free");
  const [trackingReady, setTrackingReady] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const sampleRef = useRef<GalleryHandSample>({ ...EMPTY_SAMPLE });
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const value = useMemo(
    (): GalleryHandControlContextValue => ({
      enabled,
      setEnabled,
      activeMode,
      setActiveMode,
      trackingReady,
      setTrackingReady,
      trackingError,
      setTrackingError,
      sampleRef,
      videoRef,
    }),
    [enabled, activeMode, trackingReady, trackingError],
  );

  return (
    <GalleryHandControlContext.Provider value={value}>
      {children}
    </GalleryHandControlContext.Provider>
  );
}

export function useGalleryHandControl(): GalleryHandControlContextValue | null {
  return useContext(GalleryHandControlContext);
}

/** Avuçlar birleşince hedef azimuth ofseti (yarım tur) */
export const HAND_STEER_AZIMUTH_MAX_RAD = Math.PI;
/** Eller bitişik sayılır — yatay avuç aralığı */
export const HAND_STEER_SPAN_CLOSE_X = 0.08;
/** Steer nötründen ekstra açılım → ters yönde −π */
export const HAND_STEER_SPAN_WIDE_EXTRA = 0.22;

/** Steer azimuth: yalnızca yatay avuç mesafesi (X); Y kaldırma polar ile karışmaz */
export function steerHandsSpanX(
  left: PhysicalHandState,
  right: PhysicalHandState,
): number {
  if (!left.detected || !right.detected) return 0;
  return Math.abs(right.palmX - left.palmX);
}

/** Nötr spanX'e göre kapanma/açılma → −π…+π ofset (radyan) */
export function steerAzimuthOffsetFromSpan(
  spanX: number,
  neutralSpanX: number,
): number {
  const closeDelta = neutralSpanX - spanX;
  const wideDelta = spanX - neutralSpanX;
  let offset = 0;

  if (closeDelta > 0) {
    const range = Math.max(neutralSpanX - HAND_STEER_SPAN_CLOSE_X, 0.12);
    offset += (closeDelta / range) * HAND_STEER_AZIMUTH_MAX_RAD;
  }
  if (wideDelta > 0) {
    offset -= (wideDelta / HAND_STEER_SPAN_WIDE_EXTRA) * HAND_STEER_AZIMUTH_MAX_RAD;
  }

  return Math.min(
    HAND_STEER_AZIMUTH_MAX_RAD,
    Math.max(-HAND_STEER_AZIMUTH_MAX_RAD, offset),
  );
}

/** Sağ el dikey → polar ofset katsayısı */
export const HAND_STEER_POLAR_PALM_GAIN = 2.1;
/** Polar hedefe yaklaşma (düşük = daha yumuşak / yavaş) */
export const HAND_STEER_POLAR_SMOOTH = 0.06;
/** Azimuth hedefe yaklaşma */
export const HAND_STEER_AZIMUTH_SMOOTH = 0.06;
/** Proje detay — sağ el dikey → scroll (galeri polar ile aynı mantık) */
export const HAND_DETAIL_SCROLL_PALM_GAIN = 2200;
export const HAND_DETAIL_SCROLL_SMOOTH = 0.07;
/** Orbit zoom animasyonu yumuşatma */
export const HAND_ZOOM_ANIM_SMOOTH = 0.045;
export const HAND_GESTURE_PULSE_COOLDOWN_MS = 1100;

export function resetGalleryHandSample(
  ref: MutableRefObject<GalleryHandSample>,
): void {
  ref.current = {
    ...EMPTY_SAMPLE,
    userLeft: { ...EMPTY_HAND },
    userRight: { ...EMPTY_HAND },
  };
}

export function resetGalleryHandControlState(
  hand: GalleryHandControlContextValue,
): void {
  hand.setActiveMode("free");
  hand.setTrackingReady(false);
  hand.setTrackingError(null);
  resetGalleryHandSample(hand.sampleRef);
}
