import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { GalleryHandCameraPreview } from "./GalleryHandCameraPreview";
import { HandGestureRulesPanel } from "./HandGestureRulesPanel";
import { useGalleryHandControl } from "./galleryHandControl";

/** Intro modal (kurallar alanı) + sol üst mini kamera. */
export function HandControlOverlay() {
  const hand = useGalleryHandControl();
  const { messages } = useLanguage();

  if (!hand?.enabled) return null;

  const closeHint = () => hand.setHintOpen(false);
  const large = hand.hintOpen;

  return createPortal(
    <>
      {large ? (
        <div
          className="pointer-events-none fixed left-0 top-0 -z-10 h-px w-px overflow-hidden opacity-0"
          aria-hidden
        >
          <GalleryHandCameraPreview hand={hand} />
        </div>
      ) : (
        <div
          className="pointer-events-none fixed left-7 top-[4.75rem] z-[99998] sm:left-12 sm:top-[5.25rem] lg:left-14"
          aria-live="polite"
        >
          <GalleryHandCameraPreview hand={hand} />
        </div>
      )}

      {large ? (
        <div
          className="pointer-events-none fixed inset-0 z-[99999] flex items-center justify-center p-6 sm:p-10"
          aria-live="polite"
        >
          <div
            className="pointer-events-auto fixed inset-0"
            style={{ background: "var(--modal-backdrop)" }}
            aria-hidden
            onClick={closeHint}
          />

          <div
            className="pointer-events-auto relative z-10 flex max-h-[min(85vh,520px)] w-[min(92vw,400px)] flex-col overflow-y-auto rounded-xl border border-foreground/25 bg-[color-mix(in_oklch,var(--foreground)_40%,transparent)] p-4 shadow-2xl backdrop-blur-md sm:p-5"
            role="dialog"
            aria-modal
            aria-label={messages.layout.handGestureRulesDialogAria}
          >
            <button
              type="button"
              onClick={closeHint}
              className="absolute right-3 top-3 z-10 shrink-0 rounded-full bg-card p-2.5 text-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              style={{
                boxShadow:
                  "0 4px 24px color-mix(in oklch, oklch(0.05 0.02 268) 55%, transparent)",
              }}
              aria-label={messages.layout.gestureControlOff}
            >
              <X className="h-5 w-5 text-muted-foreground" aria-hidden />
            </button>

            <HandGestureRulesPanel />
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
