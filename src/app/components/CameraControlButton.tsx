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

  const { enabled, setEnabled } = hand;

  return (
    <div className="mt-1 flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={() => {
          if (enabled) {
            resetGalleryHandControlState(hand);
          }
          setEnabled(!enabled);
        }}
        aria-pressed={enabled}
        className={cn(
          "text-left text-[10px] font-medium tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground sm:text-[11px]",
          enabled && "text-foreground",
        )}
      >
        {enabled ? messages.layout.cameraControlOn : messages.layout.cameraControl}
      </button>
    </div>
  );
}
