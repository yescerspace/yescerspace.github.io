import type { PhysicalHandState } from "../components/galleryHandControl";

function isPinchHand(hand: PhysicalHandState): boolean {
  return hand.detected && hand.gesture === "pinch";
}

export function aimFromHandSample(
  pointerActive: boolean,
  pointerX: number,
  pointerY: number,
  left: PhysicalHandState,
  right: PhysicalHandState,
): { x: number; y: number } | null {
  if (pointerActive) return { x: pointerX, y: pointerY };
  if (isPinchHand(right)) {
    return { x: right.pointerX, y: right.pointerY };
  }
  if (isPinchHand(left)) {
    return { x: left.pointerX, y: left.pointerY };
  }
  if (right.detected && right.gesture === "indexUp") {
    return { x: right.pointerX, y: right.pointerY };
  }
  if (left.detected && left.gesture === "indexUp") {
    return { x: left.pointerX, y: left.pointerY };
  }
  return null;
}

export function pinchAimFromHandSample(
  left: PhysicalHandState,
  right: PhysicalHandState,
): { x: number; y: number } | null {
  if (isPinchHand(right)) {
    return { x: right.pointerX, y: right.pointerY };
  }
  if (isPinchHand(left)) {
    return { x: left.pointerX, y: left.pointerY };
  }
  return null;
}
