import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLocation } from "react-router";
import { useLanguage } from "../context/LanguageContext";
import { useHandLandmarker } from "../hooks/useHandLandmarker";
import { HAND_CONNECTIONS } from "../utils/handGestures";
import {
  resetGalleryHandControlState,
  useGalleryHandControl,
  type GalleryHandControlContextValue,
  type HandControlMode,
} from "./galleryHandControl";
import { cn } from "./ui/utils";

function modeLabel(mode: HandControlMode, messages: {
  layout: {
    handModeSteer: string;
    handModeDetail: string;
    handModeFree: string;
  };
}): string {
  switch (mode) {
    case "steer":
      return messages.layout.handModeSteer;
    case "detail":
      return messages.layout.handModeDetail;
    default:
      return messages.layout.handModeFree;
  }
}

function HandControlOverlayPanel({
  hand,
  modalOpen,
}: {
  hand: GalleryHandControlContextValue;
  modalOpen: boolean;
}) {
  const { messages } = useLanguage();
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const setReady = useCallback(
    (ready: boolean) => hand.setTrackingReady(ready),
    [hand],
  );
  const setError = useCallback(
    (msg: string | null) => hand.setTrackingError(msg),
    [hand],
  );

  useHandLandmarker({
    enabled: hand.enabled,
    modalOpen,
    videoRef: hand.videoRef,
    sampleRef: hand.sampleRef,
    onModeChange: hand.setActiveMode,
    onReady: () => {
      setReady(true);
      setError(null);
    },
    onError: (msg) => {
      setReady(false);
      setError(msg);
    },
  });

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = overlayRef.current;
      const sample = hand.sampleRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const width = canvas.clientWidth;
          const height = canvas.clientHeight;
          if (canvas.width !== width) canvas.width = width;
          if (canvas.height !== height) canvas.height = height;
          ctx.clearRect(0, 0, width, height);

          for (const h of sample.overlayHands) {
            const highlightSet = new Set(h.highlights);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#22c55e";
            for (const [a, b] of HAND_CONNECTIONS) {
              const pa = h.points[a];
              const pb = h.points[b];
              if (!pa || !pb) continue;
              ctx.beginPath();
              ctx.moveTo((1 - pa.x) * width, pa.y * height);
              ctx.lineTo((1 - pb.x) * width, pb.y * height);
              ctx.stroke();
            }
            for (let i = 0; i < h.points.length; i += 1) {
              const p = h.points[i];
              const px = (1 - p.x) * width;
              const py = p.y * height;
              const accent = highlightSet.has(i);
              const isThumb = i >= 1 && i <= 4;
              ctx.beginPath();
              ctx.fillStyle = accent ? "#4ade80" : isThumb ? "#86efac" : "#ef4444";
              ctx.arc(px, py, accent ? 5.5 : isThumb ? 3 : 2.2, 0, Math.PI * 2);
              ctx.fill();
              if (accent) {
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.5;
                ctx.stroke();
              }
            }
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [hand]);

  const turnOff = () => {
    hand.setEnabled(false);
    resetGalleryHandControlState(hand);
  };

  return (
    <div className="pointer-events-auto flex w-[min(92vw,220px)] flex-col gap-1.5 rounded-lg border border-border/90 bg-card/95 p-2 shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-foreground sm:text-[10px]">
          {modeLabel(hand.activeMode, messages)}
        </p>
        <button
          type="button"
          onClick={turnOff}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={messages.layout.gestureControlOff}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        className={cn(
          "relative overflow-hidden rounded-md border border-border/80 bg-black/80",
          !hand.trackingReady && "opacity-75",
        )}
      >
        <video
          ref={(el) => {
            hand.videoRef.current = el;
          }}
          className="block h-[108px] w-full scale-x-[-1] object-cover sm:h-[120px]"
          playsInline
          muted
          autoPlay
          aria-hidden
        />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        />
        {!hand.trackingReady && !hand.trackingError && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/40 text-[10px] text-muted-foreground">
            …
          </span>
        )}
      </div>
      <p className="text-[9px] leading-snug tracking-wide text-muted-foreground sm:text-[10px]">
        {messages.layout.handGestureArmedHint}
      </p>
      {hand.trackingError ? (
        <p className="text-[9px] leading-snug text-destructive/90">
          {hand.trackingError}
        </p>
      ) : null}
    </div>
  );
}

export function HandControlOverlay({ modalOpen }: { modalOpen: boolean }) {
  const location = useLocation();
  const hand = useGalleryHandControl();

  const pathSegments = location.pathname
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean);
  const isGalleryDetail =
    pathSegments.length === 2 &&
    pathSegments[0] !== "about" &&
    pathSegments[0] !== "connect" &&
    pathSegments[0] !== "contact";
  const isGallery = location.pathname === "/" || isGalleryDetail;

  if (!hand?.enabled || !isGallery) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed left-4 top-[5.5rem] z-[99999] sm:left-6 sm:top-[6rem] lg:left-8"
      aria-live="polite"
    >
      <HandControlOverlayPanel hand={hand} modalOpen={modalOpen} />
    </div>,
    document.body,
  );
}
