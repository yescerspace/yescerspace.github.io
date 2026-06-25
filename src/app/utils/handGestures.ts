import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type HandGestureKind =
  | "none"
  | "fist"
  | "openPalm"
  | "indexUp"
  | "okSign"
  | "pinch"
  | "palmDown";

export type ClassifiedHand = {
  detected: boolean;
  gesture: HandGestureKind;
  /** İşaret ucu / imleç X (0–1, ayna). */
  pointerX: number;
  /** İşaret ucu / imleç Y (0–1). */
  pointerY: number;
  palmX: number;
  palmY: number;
  indexY: number;
  wristX: number;
  wristY: number;
};

export const OPEN_PALM_HIGHLIGHT_LANDMARKS = [0, 4, 8, 12, 16, 20] as const;
export const FIST_HIGHLIGHT_LANDMARKS = [0, 5, 9, 13, 17] as const;
export const INDEX_HIGHLIGHT_LANDMARKS = [6, 7, 8] as const;
export const OK_SIGN_HIGHLIGHT_LANDMARKS = [3, 4, 8] as const;
export const PINCH_HIGHLIGHT_LANDMARKS = [3, 4, 6, 7, 8] as const;
export const PALM_DOWN_HIGHLIGHT_LANDMARKS = [0, 5, 9, 13, 17] as const;

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const WRIST = 0;
const FINGER_CHAINS = [
  { tip: 8, pip: 6 },
  { tip: 12, pip: 10 },
  { tip: 16, pip: 14 },
  { tip: 20, pip: 18 },
] as const;

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distXY(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function fingerExtended(
  landmarks: NormalizedLandmark[],
  tip: number,
  pip: number,
): boolean {
  const wrist = landmarks[WRIST];
  return dist(wrist, landmarks[tip]) > dist(wrist, landmarks[pip]) * 1.02;
}

function countExtendedFingers(landmarks: NormalizedLandmark[]): number {
  let n = 0;
  if (fingerExtended(landmarks, 4, 3)) n += 1;
  for (const { tip, pip } of FINGER_CHAINS) {
    if (fingerExtended(landmarks, tip, pip)) n += 1;
  }
  return n;
}

function palmCenter(landmarks: NormalizedLandmark[]): { x: number; y: number } {
  const ids = [0, 5, 9, 13, 17] as const;
  let x = 0;
  let y = 0;
  for (const i of ids) {
    x += landmarks[i].x;
    y += landmarks[i].y;
  }
  return { x: x / ids.length, y: y / ids.length };
}

function palmSpan(landmarks: NormalizedLandmark[]): number {
  return dist(landmarks[WRIST], landmarks[9]);
}

function mirrorX(x: number): number {
  return 1 - x;
}

export { mirrorX };

/** Selfie kamerada: düşük x = kullanıcının sağ eli. */
export function isUserRightHand(landmarks: NormalizedLandmark[]): boolean {
  const { x } = palmCenter(landmarks);
  return x < 0.5;
}

/** ✊ Yumruk — 👌/☝️ ile çakışmasın (OK işaretinde 2 parmak açık kalır). */
export function isFistGesture(landmarks: NormalizedLandmark[]): boolean {
  if (isPinchPickGesture(landmarks) || isIndexUpGesture(landmarks)) return false;
  return countExtendedFingers(landmarks) <= 2;
}

/** ✊ Detay kapat — gevşek yumruktan daha sıkı (kaydırırken yanlış kapanmasın). */
export function isStrictFistGesture(landmarks: NormalizedLandmark[]): boolean {
  if (isPinchPickGesture(landmarks) || isIndexUpGesture(landmarks)) return false;
  return countExtendedFingers(landmarks) <= 1;
}

/** 🖐️ Detay kaydırma avucu — 3+ parmak yeterli (MediaPipe bazen bir parmak kaçırır). */
export function isScrollOpenPalm(landmarks: NormalizedLandmark[]): boolean {
  if (isPinchPickGesture(landmarks) || isIndexUpGesture(landmarks)) return false;
  if (isStrictFistGesture(landmarks)) return false;
  return countExtendedFingers(landmarks) >= 3;
}

/** 🖐️ Beş parmak açık (4+ yeterli — MediaPipe bazen bir parmak kaçırır). */
export function isFiveFingerOpenPalm(landmarks: NormalizedLandmark[]): boolean {
  return countExtendedFingers(landmarks) >= 4;
}

/** Başparmak ucu (4) ↔ işaret ucu (8) mesafesi / avuç ölçeği. */
export function thumbIndexTipRatio(landmarks: NormalizedLandmark[]): number {
  return dist(landmarks[4], landmarks[8]) / palmSpan(landmarks);
}

/** ☝️ İşaret parmağı yukarı — imleç */
export function isIndexUpGesture(landmarks: NormalizedLandmark[]): boolean {
  const ratio = thumbIndexTipRatio(landmarks);
  if (ratio < 0.15) return false;
  return (
    fingerExtended(landmarks, 8, 6) &&
    !fingerExtended(landmarks, 12, 10) &&
    !fingerExtended(landmarks, 16, 14) &&
    !fingerExtended(landmarks, 20, 18)
  );
}

/** 🤏 Pinch seçim — başparmak + işaret ucu birbirine değince */
export function isPinchPickGesture(landmarks: NormalizedLandmark[]): boolean {
  const ratio = thumbIndexTipRatio(landmarks);
  // Uçlar yeterince yakın olsun; çok sıkı bastırınca (ratio≈0) da geçerli.
  if (ratio > 0.17) return false;
  // İşaret parmağı dümdüz kıvrık değil (yumruktan ayırt et).
  if (!fingerExtended(landmarks, 8, 6)) return false;
  return true;
}

/** 👌 @deprecated Pick için {@link isPinchPickGesture} kullan. */
export function isOkSignGesture(landmarks: NormalizedLandmark[]): boolean {
  return isPinchPickGesture(landmarks);
}

/** 🤏 Pinch (ayrı; seçimde kullanılmıyor). */
export function isPinchGesture(landmarks: NormalizedLandmark[]): boolean {
  if (isIndexUpGesture(landmarks) || isOkSignGesture(landmarks)) return false;
  const span = palmSpan(landmarks);
  const tipDist = dist(landmarks[4], landmarks[8]);
  if (tipDist > span * 0.4 || tipDist < span * 0.06) return false;
  return fingerExtended(landmarks, 8, 6) || fingerExtended(landmarks, 4, 3);
}

/** 🖐️ Beş parmak açık — galeri ↕️ döndür / detay ↕️ kaydır. */
export function isOpenPalmSplayedMove(landmarks: NormalizedLandmark[]): boolean {
  if (isFistGesture(landmarks) || isIndexUpGesture(landmarks)) return false;
  if (isPinchPickGesture(landmarks)) return false;
  return isFiveFingerOpenPalm(landmarks);
}

/** @deprecated Use {@link isOpenPalmSplayedMove} */
export function isWaveOpenPalm(landmarks: NormalizedLandmark[]): boolean {
  return isOpenPalmSplayedMove(landmarks);
}

/** @deprecated Use {@link isOpenPalmSplayedMove} */
export function isDetailScrollOpenPalm(landmarks: NormalizedLandmark[]): boolean {
  return isOpenPalmSplayedMove(landmarks);
}
export function isStartPositionPose(landmarks: NormalizedLandmark[]): boolean {
  if (!isFiveFingerOpenPalm(landmarks)) return false;

  const palm = palmCenter(landmarks);
  const span = palmSpan(landmarks);
  if (palm.y > 0.58) return false;

  const indexUp = landmarks[8].y < palm.y + span * 0.14;
  return indexUp;
}

/** 🖐️ Zoom in — açık avuç, başlangıç pozu değil, merkezde sabit. */
export function isOpenPalmZoomInHold(landmarks: NormalizedLandmark[]): boolean {
  return isFiveFingerOpenPalm(landmarks) && !isStartPositionPose(landmarks);
}

/** @deprecated Use {@link isOpenPalmZoomInHold} */
export function isOpenPalmZoomOut(landmarks: NormalizedLandmark[]): boolean {
  return isOpenPalmZoomInHold(landmarks);
}

/**
 * El konumu (0–1) → sürekli orbit hızı.
 * Merkez (center ± deadZone) → 0; kenara gittikçe hız artar.
 */
export function palmPositionDrive(
  value: number,
  center = 0.5,
  deadZone = 0.1,
  maxRate = 2.6,
): number {
  const offset = value - center;
  if (Math.abs(offset) <= deadZone) return 0;
  const sign = Math.sign(offset);
  const range = Math.max(0.05, 0.5 - deadZone);
  const t = (Math.abs(offset) - deadZone) / range;
  return sign * t * t * maxRate;
}

/**
 * 🖐️ Başlangıç kadrajı — tek el yukarıda, beş parmak açık.
 */
export class WristPanTracker {
  private lastX: number | null = null;
  private lastT = 0;
  private velocity = 0;

  reset(): void {
    this.lastX = null;
    this.lastT = 0;
    this.velocity = 0;
  }

  push(mirroredX: number, now: number): number {
    if (this.lastX == null) {
      this.lastX = mirroredX;
      this.lastT = now;
      return 0;
    }

    const dt = Math.max(1, now - this.lastT) / 1000;
    const dx = mirroredX - this.lastX;
    this.lastX = mirroredX;
    this.lastT = now;

    if (Math.abs(dx) < 0.00025) {
      this.velocity *= 0.72;
      return this.velocity;
    }

    const instant = (dx / dt) * 0.55;
    this.velocity += (instant - this.velocity) * 0.48;
    return THREE_CLAMP(this.velocity, -5, 5);
  }
}

/** 🖐️ ↕️ Avuç dikey kaydırma → galeri döndürme / detay scroll hızı. */
export class WristVerticalTracker {
  private lastY: number | null = null;
  private lastT = 0;
  private velocity = 0;

  reset(): void {
    this.lastY = null;
    this.lastT = 0;
    this.velocity = 0;
  }

  push(palmY: number, now: number): number {
    if (this.lastY == null) {
      this.lastY = palmY;
      this.lastT = now;
      return 0;
    }

    const dt = Math.max(1, now - this.lastT) / 1000;
    const dy = palmY - this.lastY;
    this.lastY = palmY;
    this.lastT = now;

    if (Math.abs(dy) < 0.00025) {
      this.velocity *= 0.72;
      return this.velocity;
    }

    const instant = (dy / dt) * 0.52;
    this.velocity += (instant - this.velocity) * 0.48;
    return THREE_CLAMP(this.velocity, -4.5, 4.5);
  }
}

/** @deprecated Use WristPanTracker — kept for reference */
export class WristCircleTracker {
  private points: Array<{ x: number; y: number; t: number }> = [];

  push(wrist: { x: number; y: number }, now: number): void {
    this.points.push({ x: wrist.x, y: wrist.y, t: now });
    this.points = this.points.filter((p) => now - p.t < 720);
  }

  reset(): void {
    this.points = [];
  }

  /** Radyan/saniye benzeri azimuth hızı; işaret yönünde döner. */
  getRotateVelocity(): number {
    if (this.points.length < 10) return 0;

    const cx =
      this.points.reduce((sum, p) => sum + p.x, 0) / this.points.length;
    const cy =
      this.points.reduce((sum, p) => sum + p.y, 0) / this.points.length;

    let totalAngle = 0;
    for (let i = 1; i < this.points.length; i += 1) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const angA = Math.atan2(a.y - cy, a.x - cx);
      const angB = Math.atan2(b.y - cy, b.x - cx);
      let delta = angB - angA;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      totalAngle += delta;
    }

    if (Math.abs(totalAngle) < 0.55) return 0;
    return THREE_CLAMP(totalAngle * 0.085, -2.4, 2.4);
  }
}

function THREE_CLAMP(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function classifyHand(
  landmarks: NormalizedLandmark[] | undefined,
): ClassifiedHand {
  if (!landmarks?.length) {
    return {
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
  }

  const palm = palmCenter(landmarks);
  const index = landmarks[8];
  const thumb = landmarks[4];
  const wrist = landmarks[WRIST];

  let gesture: HandGestureKind = "none";
  if (isPinchPickGesture(landmarks)) gesture = "pinch";
  else if (isIndexUpGesture(landmarks)) gesture = "indexUp";
  else if (isFistGesture(landmarks)) gesture = "fist";
  else if (isFiveFingerOpenPalm(landmarks)) gesture = "openPalm";

  const pinchAim = gesture === "pinch";
  const pointerX = pinchAim ? mirrorX((thumb.x + index.x) / 2) : mirrorX(index.x);
  const pointerY = pinchAim ? (thumb.y + index.y) / 2 : index.y;

  return {
    detected: true,
    gesture,
    pointerX,
    pointerY,
    palmX: mirrorX(palm.x),
    palmY: palm.y,
    indexY: index.y,
    wristX: mirrorX(wrist.x),
    wristY: wrist.y,
  };
}
