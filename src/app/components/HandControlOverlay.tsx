import { createPortal } from "react-dom";
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
          className="pointer-events-none fixed right-7 top-[4.75rem] z-[99998] sm:right-12 sm:top-[5.25rem] lg:right-14"
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
            className="pointer-events-auto relative z-10 flex max-h-[min(85vh,520px)] w-[min(92vw,400px)] flex-col overflow-hidden rounded-xl border border-foreground/25 bg-[color-mix(in_oklch,var(--foreground)_40%,transparent)] shadow-2xl backdrop-blur-md"
            role="dialog"
            aria-modal
            aria-label={messages.layout.handGestureRulesDialogAria}
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 sm:pb-4">
              <HandGestureRulesPanel />
            </div>
            <div className="shrink-0 border-t border-foreground/10 px-4 py-4 sm:px-5 sm:py-4">
              <button
                type="button"
                onClick={closeHint}
                className="w-full rounded-full bg-primary px-6 py-2.5 text-sm tracking-wide text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ fontWeight: 500 }}
              >
                {messages.layout.handGestureRulesStart}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
