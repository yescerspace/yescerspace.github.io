import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type HandGestureKind =
  | "none"
  | "pinch"
  | "indexUp"
  | "uBack"
  | "fist"
  | "open";

export type ClassifiedHand = {
  detected: boolean;
  gesture: HandGestureKind;
  pinchX: number;
  pinchY: number;
  palmX: number;
  palmY: number;
  indexY: number;
  pinchProximity: number;
};

export const PINCH_HIGHLIGHT_LANDMARKS = [3, 4, 8] as const;
export const OPEN_PALM_HIGHLIGHT_LANDMARKS = [0, 4, 8, 12, 16, 20] as const;
export const FIST_HIGHLIGHT_LANDMARKS = [0, 5, 9, 13, 17] as const;
export const PRAYER_HIGHLIGHT_LANDMARKS = [0, 4, 8, 12] as const;
export const INDEX_HIGHLIGHT_LANDMARK = 8;
export const UBACK_HIGHLIGHT_LANDMARKS = [4, 8] as const;

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
  return dist(wrist, landmarks[tip]) > dist(wrist, landmarks[pip]) * 1.05;
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

/** Selfie kamerada: düşük x = kullanıcının sağ eli. */
export function isUserRightHand(landmarks: NormalizedLandmark[]): boolean {
  const { x } = palmCenter(landmarks);
  return x < 0.5;
}

export function thumbIndexProximity(landmarks: NormalizedLandmark[]): number {
  const span = Math.max(palmSpan(landmarks), 1e-4);
  const tipDist = dist(landmarks[4], landmarks[8]);
  const baseDist = dist(landmarks[4], landmarks[5]);
  const tipScore = 1 - Math.min(1, Math.max(0, tipDist / (span * 0.62)));
  const baseScore = 1 - Math.min(1, Math.max(0, baseDist / (span * 0.45)));
  return Math.max(tipScore, baseScore * 0.95);
}

/** İki uç birbirine değiyor — referans PNG / video pinch. */
export function isPinchGesture(landmarks: NormalizedLandmark[]): boolean {
  const span = palmSpan(landmarks);
  const tipDist = dist(landmarks[4], landmarks[8]);
  const baseDist = dist(landmarks[4], landmarks[5]);
  const tipsTouch = tipDist < span * 0.5;
  const cShape = tipDist < span * 0.72 && baseDist < span * 0.44;
  if (!tipsTouch && !cShape) return false;
  return countExtendedFingers(landmarks) <= 3;
}

export function isOpenPalmGesture(landmarks: NormalizedLandmark[]): boolean {
  return countExtendedFingers(landmarks) >= 4;
}

/** Ekrana dönük 5 parmak açık avuç. */
export function isFiveFingerOpenPalm(landmarks: NormalizedLandmark[]): boolean {
  return countExtendedFingers(landmarks) >= 5;
}

/** Yumruk — parmaklar kapalı (detay sayfasını kapat). */
export function isFistGesture(landmarks: NormalizedLandmark[]): boolean {
  return countExtendedFingers(landmarks) <= 1;
}

/**
 * 🙏 — iki avuç birbirine yakın, parmaklar yukarı (uzaklaştır + merkez).
 */
export function isPrayerHands(
  left: NormalizedLandmark[],
  right: NormalizedLandmark[],
): boolean {
  const lc = palmCenter(left);
  const rc = palmCenter(right);
  const palmGap = distXY(lc, rc);
  const avgHand = (palmSpan(left) + palmSpan(right)) / 2;
  if (palmGap > avgHand * 0.48) return false;
  if (Math.abs(lc.y - rc.y) > avgHand * 0.32) return false;

  const indexGap = dist(left[8], right[8]);
  const middleGap = dist(left[12], right[12]);
  if (indexGap > avgHand * 0.4 || middleGap > avgHand * 0.45) return false;

  const leftUp = left[8].y < lc.y + avgHand * 0.08;
  const rightUp = right[8].y < rc.y + avgHand * 0.08;
  return leftUp && rightUp;
}

/**
 * Teslim ol — iki el 5 parmak açık, yukarıda, birbirinden ayrı (varsayılan boyuta dön).
 */
export function isSurrenderPose(
  left: NormalizedLandmark[],
  right: NormalizedLandmark[],
): boolean {
  if (!isFiveFingerOpenPalm(left) || !isFiveFingerOpenPalm(right)) return false;
  if (isPrayerHands(left, right)) return false;

  const lc = palmCenter(left);
  const rc = palmCenter(right);
  const avgY = (lc.y + rc.y) * 0.5;
  if (avgY > 0.44) return false;

  const palmGap = distXY(lc, rc);
  const avgHand = (palmSpan(left) + palmSpan(right)) / 2;
  return palmGap > avgHand * 0.85;
}

/** İşaret yukarı — baş parmak uzak (seçim için artık kullanılmıyor ama tanı kalsın). */
export function isIndexUpGesture(landmarks: NormalizedLandmark[]): boolean {
  const span = palmSpan(landmarks);
  if (dist(landmarks[4], landmarks[8]) < span * 0.38) return false;
  return (
    fingerExtended(landmarks, 8, 6) &&
    !fingerExtended(landmarks, 12, 10) &&
    !fingerExtended(landmarks, 16, 14) &&
    !fingerExtended(landmarks, 20, 18)
  );
}

/**
 * U / L — işaret yukarı, baş yana açık (detaydan geri).
 * Kullanıcının 2. PNG’sindeki pose.
 */
export function isUBackGesture(landmarks: NormalizedLandmark[]): boolean {
  const span = palmSpan(landmarks);
  const thumbIndex = dist(landmarks[4], landmarks[8]);
  if (thumbIndex < span * 0.52) return false;
  const indexUp = fingerExtended(landmarks, 8, 6);
  const thumbOut = fingerExtended(landmarks, 4, 3);
  const middleDown = !fingerExtended(landmarks, 12, 10);
  const ringDown = !fingerExtended(landmarks, 16, 14);
  const pinkyDown = !fingerExtended(landmarks, 20, 18);
  if (!indexUp || !thumbOut) return false;
  const thumbIndexX = landmarks[4].x - landmarks[8].x;
  const thumbApart = Math.abs(thumbIndexX) > span * 0.14;
  return thumbApart && middleDown && ringDown && pinkyDown;
}

export function classifyHand(
  landmarks: NormalizedLandmark[] | undefined,
): ClassifiedHand {
  if (!landmarks?.length) {
    return {
      detected: false,
      gesture: "none",
      pinchX: 0.5,
      pinchY: 0.5,
      palmX: 0.5,
      palmY: 0.5,
      indexY: 0.5,
      pinchProximity: 0,
    };
  }

  const palm = palmCenter(landmarks);
  const proximity = thumbIndexProximity(landmarks);
  let gesture: HandGestureKind = "none";
  if (isUBackGesture(landmarks)) gesture = "uBack";
  else if (isPinchGesture(landmarks)) gesture = "pinch";
  else if (isFistGesture(landmarks)) gesture = "fist";
  else if (isOpenPalmGesture(landmarks)) gesture = "open";
  else if (isIndexUpGesture(landmarks)) gesture = "indexUp";

  const thumb = landmarks[4];
  const index = landmarks[8];

  return {
    detected: true,
    gesture,
    pinchX: mirrorX((thumb.x + index.x) * 0.5),
    pinchY: (thumb.y + index.y) * 0.5,
    palmX: mirrorX(palm.x),
    palmY: palm.y,
    indexY: index.y,
    pinchProximity: proximity,
  };
}
