import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useHandLandmarker } from "../hooks/useHandLandmarker";
import { drawHandOverlayCanvas } from "../utils/drawHandOverlayCanvas";
import {
  useGalleryHandControl,
  type GalleryHandControlContextValue,
} from "./galleryHandControl";
import { cn } from "./ui/utils";

function HandCameraPreview({
  hand,
  large,
}: {
  hand: GalleryHandControlContextValue;
  large: boolean;
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
    modalOpen: hand.detailModalOpen,
    videoRef: hand.videoRef,
    sampleRef: hand.sampleRef,
    cameraStreamRef: hand.cameraStreamRef,
    cameraAccessPromiseRef: hand.cameraAccessPromiseRef,
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
    if (!hand.enabled) return;

    let raf = 0;
    const paint = () => {
      const canvas = overlayRef.current;
      if (canvas) {
        drawHandOverlayCanvas(canvas, hand.sampleRef.current.overlayHands);
      }
      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [hand.enabled, hand.sampleRef]);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-black/80",
        large
          ? "aspect-[4/3] w-full rounded-lg border border-foreground/20 shadow-inner"
          : "rounded-lg border border-foreground/20 bg-card/80 shadow-lg backdrop-blur-sm",
      )}
    >
      <video
        ref={(el) => {
          hand.videoRef.current = el;
        }}
        className={cn(
          "block w-full object-cover [transform:scaleX(-1)]",
          large ? "h-full min-h-[220px]" : "h-[4.5rem] w-[6rem] sm:h-[5.25rem] sm:w-[7rem]",
        )}
        playsInline
        muted
        autoPlay
        aria-label={messages.layout.cameraControlOn}
      />
      <canvas
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      />
      {!hand.trackingReady && !hand.trackingError ? (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-background/60 text-muted-foreground",
            large ? "text-sm" : "text-[9px] tracking-wide",
          )}
        >
          …
        </div>
      ) : null}
      {hand.trackingError ? (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-destructive/90 px-2 py-1 text-center text-destructive-foreground",
            large ? "text-xs" : "text-[8px] leading-tight",
          )}
        >
          {hand.trackingError}
        </div>
      ) : null}
    </div>
  );
}

export function HandControlOverlay() {
  const hand = useGalleryHandControl();
  const { messages } = useLanguage();

  if (!hand?.enabled) return null;

  const closeHint = () => hand.setHintOpen(false);
  const large = hand.hintOpen;

  return createPortal(
    <div
      className={cn(
        large
          ? "pointer-events-none fixed inset-0 z-[99999] flex items-center justify-center p-6 sm:p-10"
          : "pointer-events-none fixed left-7 top-[4.75rem] z-[99998] sm:left-12 sm:top-[5.25rem] lg:left-14",
      )}
      aria-live="polite"
    >
      {large ? (
        <div
          className="pointer-events-auto fixed inset-0"
          style={{ background: "var(--modal-backdrop)" }}
          aria-hidden
          onClick={closeHint}
        />
      ) : null}

      <div
        className={cn(
          large &&
            "pointer-events-auto relative z-10 flex w-[min(92vw,560px)] flex-col gap-4 rounded-xl border border-foreground/25 bg-[color-mix(in_oklch,var(--foreground)_40%,transparent)] p-4 shadow-2xl backdrop-blur-md sm:p-6",
        )}
        role={large ? "dialog" : undefined}
        aria-modal={large ? true : undefined}
        aria-label={large ? messages.layout.cameraControl : undefined}
      >
        {large ? (
          <button
            type="button"
            onClick={closeHint}
            className="absolute left-3 top-3 z-10 shrink-0 rounded-full bg-card p-2.5 text-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            style={{
              boxShadow:
                "0 4px 24px color-mix(in oklch, oklch(0.05 0.02 268) 55%, transparent)",
            }}
            aria-label={messages.layout.gestureControlOff}
          >
            <X className="h-5 w-5 text-muted-foreground" aria-hidden />
          </button>
        ) : null}

        <HandCameraPreview hand={hand} large={large} />

        {large ? (
          <p className="px-1 pt-1 text-center text-[11px] leading-relaxed text-foreground/85 sm:text-xs">
            {messages.layout.handGestureArmedHint}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
