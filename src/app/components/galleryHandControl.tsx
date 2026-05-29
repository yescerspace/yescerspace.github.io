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

/** El arası mesafe → azimuth (daralt = sağa döner) */
export const HAND_STEER_AZIMUTH_SPAN_GAIN = 5.8;
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
