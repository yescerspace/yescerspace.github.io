import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  isFistGesture,
  isFiveFingerOpenPalm,
  isIndexUpGesture,
  isOkSignGesture,
  isScrollOpenPalm,
  isStartPositionPose,
  isStrictFistGesture,
} from "./handGestures";
import type { RawHandFrame, RawHandSide } from "./handRawInput";

export type GestureFrameFeatures = {
  handed: RawHandSide["handed"];
  isOpenHand: boolean;
  isScrollPalm: boolean;
  isFist: boolean;
  isStrictFist: boolean;
  isOkSign: boolean;
  isIndexPoint: boolean;
  isStartPose: boolean;
  palmX: number;
  palmY: number;
  pointerX: number;
  pointerY: number;
  indexPointerX: number;
  indexPointerY: number;
};

export type GestureDetectorSnapshot = {
  handDetected: boolean;
  dominant: GestureFrameFeatures | null;
  isOpenHand: boolean;
  isScrollPalm: boolean;
  isFist: boolean;
  isStrictFist: boolean;
  isOkSign: boolean;
  okSignConfirmed: boolean;
  isIndexPoint: boolean;
  isStartPose: boolean;
  palmX: number;
  palmY: number;
  pointerX: number;
  pointerY: number;
  indexPointerX: number;
  indexPointerY: number;
  moveX: number;
  moveY: number;
};

const MAX_HISTORY = 15;
const OK_CONFIRM_FRAMES = 8;
const INDEX_CONFIRM_RATIO = 0.45;

function featuresFromHand(hand: RawHandSide): GestureFrameFeatures {
  const lm = hand.landmarks;
  const indexUp = isIndexUpGesture(lm);
  const okSign = isOkSignGesture(lm);
  return {
    handed: hand.handed,
    isOpenHand:
      isFiveFingerOpenPalm(lm) &&
      !okSign &&
      !indexUp &&
      !isFistGesture(lm),
    isScrollPalm: isScrollOpenPalm(lm),
    isFist: isFistGesture(lm),
    isStrictFist: isStrictFistGesture(lm),
    isOkSign: okSign,
    isIndexPoint: indexUp,
    isStartPose: isStartPositionPose(lm),
    palmX: hand.palm.x,
    palmY: hand.palm.y,
    pointerX: hand.pointer.x,
    pointerY: hand.pointer.y,
    indexPointerX: hand.pointer.x,
    indexPointerY: hand.pointer.y,
  };
}

function ratioTrue(values: boolean[], min = 0.55): boolean {
  if (!values.length) return false;
  const hits = values.filter(Boolean).length;
  return hits / values.length >= min;
}

/** Layer 2 — history tabanlı jest algılama (tek kareye bağlı değil). */
export class HandGestureDetector {
  private history: GestureFrameFeatures[] = [];

  reset(): void {
    this.history = [];
  }

  update(frame: RawHandFrame): GestureDetectorSnapshot {
    const dominantHand =
      frame.hands.length === 0
        ? null
        : frame.hands.reduce((best, h) =>
            h.confidence >= (best?.confidence ?? 0) ? h : best,
          );

    if (dominantHand) {
      this.history.push(featuresFromHand(dominantHand));
      if (this.history.length > MAX_HISTORY) this.history.shift();
    } else {
      this.history = [];
    }

    const h = this.history;
    const last = h[h.length - 1] ?? null;
    const openHist = h.map((f) => f.isOpenHand);
    const scrollHist = h.map((f) => f.isScrollPalm);
    const fistHist = h.map((f) => f.isFist);
    const strictFistHist = h.map((f) => f.isStrictFist);
    const okHist = h.map((f) => f.isOkSign);
    const indexHist = h.map((f) => f.isIndexPoint);
    const startHist = h.map((f) => f.isStartPose);

    let moveX = 0;
    let moveY = 0;
    if (h.length >= 2) {
      const a = h[h.length - 2]!;
      const b = h[h.length - 1]!;
      moveX = b.palmX - a.palmX;
      moveY = b.palmY - a.palmY;
    }

    const okRecent = okHist.slice(-OK_CONFIRM_FRAMES);
    const okSignConfirmed =
      okRecent.length >= OK_CONFIRM_FRAMES &&
      okRecent.filter(Boolean).length >= OK_CONFIRM_FRAMES - 1;

    return {
      handDetected: last != null,
      dominant: last,
      isOpenHand: ratioTrue(openHist, 0.5),
      isScrollPalm: ratioTrue(scrollHist, 0.4),
      isFist: ratioTrue(fistHist, 0.55),
      isStrictFist: ratioTrue(strictFistHist, 0.65),
      isOkSign: ratioTrue(okHist.slice(-5), 0.55),
      okSignConfirmed,
      isIndexPoint: ratioTrue(indexHist, INDEX_CONFIRM_RATIO),
      isStartPose: ratioTrue(startHist.slice(-6), 0.65),
      palmX: last?.palmX ?? 0.5,
      palmY: last?.palmY ?? 0.5,
      pointerX: last?.pointerX ?? 0.5,
      pointerY: last?.pointerY ?? 0.5,
      indexPointerX: last?.indexPointerX ?? 0.5,
      indexPointerY: last?.indexPointerY ?? 0.5,
      moveX,
      moveY,
    };
  }
}

export function landmarksForOverlay(
  frame: RawHandFrame,
  highlights: number[],
): Array<{ handed: "left" | "right"; points: { x: number; y: number }[]; highlights: number[] }> {
  return frame.hands.map((hand) => ({
    handed: hand.handed,
    points: hand.landmarks.map((p) => ({ x: p.x, y: p.y })),
    highlights,
  }));
}

export type { NormalizedLandmark };
