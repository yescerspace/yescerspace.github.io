import bookIconUrl from "../assets/hand-gesture-rules-book.png?url";
import { useLanguage } from "../context/LanguageContext";
import { useGalleryHandControl } from "./galleryHandControl";
import { cn } from "./ui/utils";

export function HandGestureRulesBookButton() {
  const { messages } = useLanguage();
  const hand = useGalleryHandControl();

  if (!hand?.enabled) return null;

  return (
    <button
      type="button"
      onClick={() => hand.setHintOpen(true)}
      aria-label={messages.layout.handGestureRulesBookAria}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-muted/50 p-1 transition-[background-color,border-color,transform] duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] sm:h-10 sm:w-10",
      )}
    >
      <img
        src={bookIconUrl}
        alt=""
        className="h-full w-full rounded-full object-cover"
        draggable={false}
      />
    </button>
  );
}
