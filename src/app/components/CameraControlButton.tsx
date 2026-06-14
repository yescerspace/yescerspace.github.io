import { useLanguage } from "../context/LanguageContext";
import {
  resetGalleryHandControlState,
  useGalleryHandControl,
} from "./galleryHandControl";
import { cn } from "./ui/utils";

export function CameraControlButton() {
  const { messages } = useLanguage();
  const hand = useGalleryHandControl();

  if (!hand) return null;

  const { hintOpen, enabled, setHintOpen, setEnabled } = hand;

  return (
    <div className="mt-1 flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={() => {
          if (enabled) {
            resetGalleryHandControlState(hand);
            return;
          }
          setHintOpen(true);
          setEnabled(true);
        }}
        aria-pressed={enabled}
        aria-label={
          enabled ? messages.layout.cameraControlOn : messages.layout.cameraControl
        }
        title={
          enabled ? messages.layout.cameraControlOn : messages.layout.cameraControl
        }
        className={cn(
          "inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full text-left leading-none transition-opacity hover:opacity-70",
          "text-[#3a3d48] opacity-45",
          enabled && "opacity-80 text-[#5c606c]",
          hintOpen && enabled && "opacity-90",
        )}
      >
        <span className="select-none text-[11px] font-normal sm:text-[12px]" aria-hidden>
          .
        </span>
      </button>
    </div>
  );
}
