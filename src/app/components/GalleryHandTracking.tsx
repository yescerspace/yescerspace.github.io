import { useCallback } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../context/LanguageContext";
import { useHandLandmarker } from "../hooks/useHandLandmarker";
import {
  useGalleryHandControl,
  type GalleryHandControlContextValue,
} from "./galleryHandControl";
import { cn } from "./ui/utils";

function GalleryHandTrackingInner({
  hand,
}: {
  hand: GalleryHandControlContextValue;
}) {
  const { messages } = useLanguage();

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

  return createPortal(
    <div
      className="pointer-events-none fixed left-7 top-[4.75rem] z-[99998] sm:left-12 sm:top-[5.25rem] lg:left-14"
      aria-live="polite"
    >
      <div className="relative overflow-hidden rounded-lg border border-foreground/20 bg-card/80 shadow-lg backdrop-blur-sm">
        <video
          ref={(el) => {
            hand.videoRef.current = el;
          }}
          className={cn(
            "block h-[4.5rem] w-[6rem] object-cover sm:h-[5.25rem] sm:w-[7rem]",
            "[transform:scaleX(-1)]",
          )}
          playsInline
          muted
          autoPlay
          aria-label={messages.layout.cameraControlOn}
        />
        {!hand.trackingReady && !hand.trackingError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-[9px] tracking-wide text-muted-foreground">
            …
          </div>
        ) : null}
        {hand.trackingError ? (
          <div className="absolute inset-x-0 bottom-0 bg-destructive/90 px-1 py-0.5 text-center text-[8px] leading-tight text-destructive-foreground">
            {hand.trackingError}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** Kamera + el takibi — ipucu sayfasından bağımsız, enabled iken sürekli çalışır. */
export function GalleryHandTracking() {
  const hand = useGalleryHandControl();
  if (!hand?.enabled) return null;
  return <GalleryHandTrackingInner hand={hand} />;
}
