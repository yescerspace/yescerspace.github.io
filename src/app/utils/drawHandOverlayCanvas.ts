import type { HandOverlaySnapshot } from "../components/galleryHandControl";
import { HAND_CONNECTIONS } from "./handGestures";

function mirrorX(x: number): number {
  return 1 - x;
}

/** Beyaz merkez + yeşil halka — işaret / başparmak ucu imleci. */
function drawFingerAimCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(74, 222, 128, 0.95)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill();
}

/** Selfie preview üzerinde yeşil iskelet + kırmızı vurgu noktaları. */
export function drawHandOverlayCanvas(
  canvas: HTMLCanvasElement,
  hands: readonly HandOverlaySnapshot[],
): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w <= 0 || h <= 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  for (const hand of hands) {
    const pts = hand.points;
    if (pts.length < 21) continue;
    const highlightSet = new Set(hand.highlights);

    ctx.strokeStyle = "rgba(74, 222, 128, 0.95)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [a, b] of HAND_CONNECTIONS) {
      const p0 = pts[a];
      const p1 = pts[b];
      if (!p0 || !p1) continue;
      ctx.beginPath();
      ctx.moveTo(mirrorX(p0.x) * w, p0.y * h);
      ctx.lineTo(mirrorX(p1.x) * w, p1.y * h);
      ctx.stroke();
    }

    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      if (!p) continue;
      const x = mirrorX(p.x) * w;
      const y = p.y * h;
      const hot = highlightSet.has(i);
      ctx.beginPath();
      ctx.arc(x, y, hot ? 4.5 : 2.2, 0, Math.PI * 2);
      ctx.fillStyle = hot ? "#ef4444" : "rgba(134, 239, 172, 0.98)";
      ctx.fill();
      if (hot) {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    if (highlightSet.has(8)) {
      const indexTip = pts[8];
      if (indexTip) {
        drawFingerAimCursor(
          ctx,
          mirrorX(indexTip.x) * w,
          indexTip.y * h,
        );
      }
      const thumbTip = pts[4];
      if (thumbTip) {
        drawFingerAimCursor(
          ctx,
          mirrorX(thumbTip.x) * w,
          thumbTip.y * h,
        );
      }
    } else if (highlightSet.has(4)) {
      const thumbTip = pts[4];
      if (thumbTip) {
        drawFingerAimCursor(
          ctx,
          mirrorX(thumbTip.x) * w,
          thumbTip.y * h,
        );
      }
    }
  }
}
