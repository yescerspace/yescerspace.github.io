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
 * free — bekleniyor
 * pointer — ☝️ gezegen imleci
 * rotate — 👋 avuç yatay kaydırma
 * detail — proje detayı
 */
export type HandControlMode = "free" | "pointer" | "rotate" | "detail";

export type GalleryHandSample = {
  handDetected: boolean;
  mode: HandControlMode;
  userLeft: PhysicalHandState;
  userRight: PhysicalHandState;
  /** ☝️ imleç konumu (0–1, galeri alanı) */
  pointerX: number;
  pointerY: number;
  pointerActive: boolean;
  /** 👌 seçim kenarı */
  selectPulse: boolean;
  /** 🫳 detay kapat */
  closePulse: boolean;
  /** 🖐️ yukarı açık avuç — başlangıç kadrajı */
  resetZoomPulse: boolean;
  /** 🖐️ açık avuç — zoom out */
  zoomOutPulse: boolean;
  openPalmHeld: boolean;
  /** ✊ yumruk — zoom in */
  zoomInPulse: boolean;
  fistHeld: boolean;
  /** 👋 Avuç yatay kaydırma → azimuth hızı (selfie, ayna X). */
  rotateVelocity: number;
  waveActive: boolean;
  orbitLocked: boolean;
  overlayHands: HandOverlaySnapshot[];
};

const EMPTY_HAND: PhysicalHandState = {
  detected: false,
  gesture: "none",
  pointerX: 0.5,
  pointerY: 0.5,
  palmX: 0.5,
  palmY: 0.5,
  indexY: 0.5,
  wristX: 0.5,
  wristY: 0.5,
};

const EMPTY_SAMPLE: GalleryHandSample = {
  handDetected: false,
  mode: "free",
  userLeft: { ...EMPTY_HAND },
  userRight: { ...EMPTY_HAND },
  pointerX: 0.5,
  pointerY: 0.5,
  pointerActive: false,
  selectPulse: false,
  closePulse: false,
  resetZoomPulse: false,
  zoomOutPulse: false,
  openPalmHeld: false,
  zoomInPulse: false,
  fistHeld: false,
  rotateVelocity: 0,
  waveActive: false,
  orbitLocked: false,
  overlayHands: [],
};

export type GalleryHandControlContextValue = {
  hintOpen: boolean;
  setHintOpen: (open: boolean) => void;
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  detailModalOpen: boolean;
  setDetailModalOpen: (open: boolean) => void;
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
  const [hintOpen, setHintOpen] = useState(false);
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<HandControlMode>("free");
  const [trackingReady, setTrackingReady] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const sampleRef = useRef<GalleryHandSample>({ ...EMPTY_SAMPLE });
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const value = useMemo(
    (): GalleryHandControlContextValue => ({
      hintOpen,
      setHintOpen,
      enabled,
      setEnabled,
      detailModalOpen,
      setDetailModalOpen,
      activeMode,
      setActiveMode,
      trackingReady,
      setTrackingReady,
      trackingError,
      setTrackingError,
      sampleRef,
      videoRef,
    }),
    [hintOpen, enabled, detailModalOpen, activeMode, trackingReady, trackingError],
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

/** 👋 dönüş yumuşatma */
export const HAND_ROTATE_SMOOTH = 0.14;
/** Orbit zoom animasyonu yumuşatma */
export const HAND_ZOOM_ANIM_SMOOTH = 0.045;
export const HAND_GESTURE_PULSE_COOLDOWN_MS = 900;

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
  hand.setHintOpen(false);
  hand.setEnabled(false);
  hand.setActiveMode("free");
  hand.setTrackingReady(false);
  hand.setTrackingError(null);
  resetGalleryHandSample(hand.sampleRef);
}
