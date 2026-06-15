import { useCallback, useEffect, useRef } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useHandLandmarker } from "../hooks/useHandLandmarker";
import { drawHandOverlayCanvas } from "../utils/drawHandOverlayCanvas";
import {
  type GalleryHandControlContextValue,
} from "./galleryHandControl";
import { cn } from "./ui/utils";

type GalleryHandCameraPreviewProps = {
  hand: GalleryHandControlContextValue;
  large?: boolean;
};

export function GalleryHandCameraPreview({
  hand,
  large = false,
}: GalleryHandCameraPreviewProps) {
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

  if (!hand.enabled) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        large
          ? "aspect-[4/3] w-full rounded-lg border border-foreground/20 bg-black/80 shadow-inner"
          : "inline-block w-fit rounded-lg border border-foreground/20 bg-card/80 shadow-lg backdrop-blur-sm",
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
