import { HandGestureRulesBookButton } from "./HandGestureRulesBookButton";
import { SwitchToCameraButton } from "./SwitchToCameraButton";

export function GalleryHandControlButtons() {
  return (
    <div className="flex items-center gap-2">
      <SwitchToCameraButton />
      <HandGestureRulesBookButton />
    </div>
  );
}
