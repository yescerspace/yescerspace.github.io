import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { isUserRightHand, mirrorX } from "./handGestures";

export type RawHandSide = {
  handed: "left" | "right";
  landmarks: NormalizedLandmark[];
  confidence: number;
  palm: { x: number; y: number; z: number };
  pointer: { x: number; y: number };
  wrist: { x: number; y: number };
};

/** Layer 1 — MediaPipe çıktısı, jest mantığı yok. */
export type RawHandFrame = {
  timestamp: number;
  hands: RawHandSide[];
};

function palmCenter(lm: NormalizedLandmark[]): { x: number; y: number; z: number } {
  const ids = [0, 5, 9, 13, 17] as const;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const i of ids) {
    x += lm[i].x;
    y += lm[i].y;
    z += lm[i].z ?? 0;
  }
  const n = ids.length;
  return { x: x / n, y: y / n, z: z / n };
}

export function buildRawHandFrame(
  landmarks: NormalizedLandmark[][],
  handednesses: Array<Array<{ categoryName?: string; score?: number }>> | undefined,
  timestamp: number,
): RawHandFrame {
  const hands: RawHandSide[] = [];

  for (let i = 0; i < landmarks.length && i < 1; i += 1) {
    const lm = landmarks[i];
    if (!lm?.length) continue;

    const mpLabel = handednesses?.[i]?.[0]?.categoryName;
    const isUserRight =
      mpLabel === "Right" || (mpLabel == null && isUserRightHand(lm));
    const handed: RawHandSide["handed"] = isUserRight ? "right" : "left";
    const palm = palmCenter(lm);
    const index = lm[8];
    const wrist = lm[0];

    hands.push({
      handed,
      landmarks: lm,
      confidence: handednesses?.[i]?.[0]?.score ?? 0.85,
      palm: { x: mirrorX(palm.x), y: palm.y, z: palm.z },
      pointer: { x: mirrorX(index.x), y: index.y },
      wrist: { x: mirrorX(wrist.x), y: wrist.y },
    });
  }

  return { timestamp, hands };
}
