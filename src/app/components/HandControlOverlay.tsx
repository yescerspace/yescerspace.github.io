import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import {
  useGalleryHandControl,
} from "./galleryHandControl";

export function HandControlOverlay() {
  const hand = useGalleryHandControl();
  const { messages } = useLanguage();

  if (!hand?.hintOpen) return null;

  const closeHint = () => {
    hand.setHintOpen(false);
  };

  return createPortal(
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
        className="pointer-events-auto relative z-10 min-h-[min(52vh,420px)] w-[min(90vw,640px)] rounded-xl border border-foreground/25 bg-[color-mix(in_oklch,var(--foreground)_40%,transparent)] shadow-2xl backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-label={messages.layout.cameraControl}
      >
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

        {/* Placeholder — future gesture hints / controls */}
        <div className="min-h-[inherit] w-full px-10 py-14" aria-hidden />
      </div>
    </div>,
    document.body,
  );
}
