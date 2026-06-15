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
import type { HandGestureState } from "../utils/handGestureEventBus";

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
 * pointer — ☝️ gezegen imleci / 👌 seçim
 * rotate — 🖐️ ↕️ galeri döndürme
 * detail — 🖐️ ↕️ detay kaydır · ✊ kapat
 */
export type HandControlMode = "free" | "pointer" | "rotate" | "detail";

export type GalleryHandSample = {
  handDetected: boolean;
  /** State machine çıktısı (IDLE | ROTATE_MODE | …) */
  gestureState: HandGestureState;
  mode: HandControlMode;
  userLeft: PhysicalHandState;
  userRight: PhysicalHandState;
  /** ☝️ imleç konumu (0–1, galeri alanı) */
  pointerX: number;
  pointerY: number;
  pointerActive: boolean;
  /** 👌 seçim kenarı */
  selectPulse: boolean;
  /** ✊ detay kapat */
  closePulse: boolean;
  /** 🖐️ yukarı açık avuç — başlangıç kadrajı */
  resetZoomPulse: boolean;
  /** ✊ yumruk — zoom out (pulse) */
  zoomOutPulse: boolean;
  openPalmHeld: boolean;
  /** 🖐️ sabit açık avuç — zoom in (pulse) */
  zoomInPulse: boolean;
  fistHeld: boolean;
  /** 🖐️ ↔️ galeri — el X konumu → azimuth hızı */
  rotateVelocity: number;
  /** 🖐️ ↕️ galeri — el Y konumu → polar hızı */
  polarVelocity: number;
  waveActive: boolean;
  /** ✋ Detay modunda avuç ↕️ → sayfa kaydırma hızı */
  detailScrollVelocity: number;
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
  gestureState: "IDLE",
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
  polarVelocity: 0,
  waveActive: false,
  detailScrollVelocity: 0,
  orbitLocked: false,
  overlayHands: [],
};

export const GALLERY_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
  audio: false,
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
  cameraStreamRef: MutableRefObject<MediaStream | null>;
  cameraAccessPromiseRef: MutableRefObject<Promise<MediaStream> | null>;
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
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraAccessPromiseRef = useRef<Promise<MediaStream> | null>(null);

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
      cameraStreamRef,
      cameraAccessPromiseRef,
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
export const HAND_ROTATE_SMOOTH = 0.22;
/** Orbit zoom animasyonu yumuşatma */
export const HAND_ZOOM_ANIM_SMOOTH = 0.045;
export const HAND_GESTURE_PULSE_COOLDOWN_MS = 550;

export function resetGalleryHandSample(
  ref: MutableRefObject<GalleryHandSample>,
): void {
  ref.current = {
    ...EMPTY_SAMPLE,
    userLeft: { ...EMPTY_HAND },
    userRight: { ...EMPTY_HAND },
    gestureState: "IDLE",
  };
}

/** Tıklama anında çağrılmalı — tarayıcı kamera izni kullanıcı jestine bağlı. */
export function requestGalleryCameraStream(
  hand: GalleryHandControlContextValue,
): Promise<MediaStream> {
  const live = hand.cameraStreamRef.current;
  if (live?.active) return Promise.resolve(live);

  if (!hand.cameraAccessPromiseRef.current) {
    hand.cameraAccessPromiseRef.current = navigator.mediaDevices
      .getUserMedia(GALLERY_CAMERA_CONSTRAINTS)
      .then((stream) => {
        hand.cameraStreamRef.current = stream;
        return stream;
      })
      .catch((err) => {
        hand.cameraAccessPromiseRef.current = null;
        throw err;
      });
  }

  return hand.cameraAccessPromiseRef.current;
}

export function stopGalleryCameraStream(
  hand: GalleryHandControlContextValue,
): void {
  hand.cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  hand.cameraStreamRef.current = null;
  hand.cameraAccessPromiseRef.current = null;
  if (hand.videoRef.current) hand.videoRef.current.srcObject = null;
}

export function resetGalleryHandControlState(
  hand: GalleryHandControlContextValue,
): void {
  stopGalleryCameraStream(hand);
  hand.setHintOpen(false);
  hand.setEnabled(false);
  hand.setActiveMode("free");
  hand.setTrackingReady(false);
  hand.setTrackingError(null);
  resetGalleryHandSample(hand.sampleRef);
}

/** Kamera kontrolünü aç/kapat — tıklama anında çağrılmalı (izin jesti). */
export function toggleGalleryCameraControl(
  hand: GalleryHandControlContextValue,
): void {
  if (hand.enabled) {
    resetGalleryHandControlState(hand);
    return;
  }
  hand.setTrackingError(null);
  hand.setTrackingReady(false);
  requestGalleryCameraStream(hand).catch((err) => {
    hand.setTrackingError(
      err instanceof Error ? err.message : "Camera permission failed",
    );
    hand.setHintOpen(false);
    hand.setEnabled(false);
  });
  hand.setHintOpen(true);
  hand.setEnabled(true);
}
