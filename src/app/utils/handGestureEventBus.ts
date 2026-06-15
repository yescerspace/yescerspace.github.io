export type HandGestureState =
  | "IDLE"
  | "ROTATE_MODE"
  | "SCROLL_MODE"
  | "SELECT_MODE"
  | "ZOOM_MODE";

export type HandGestureEvent =
  | { type: "GESTURE_ROTATE"; x: number; y: number }
  | { type: "GESTURE_SCROLL"; y: number }
  | { type: "GESTURE_SELECT"; pointerX: number; pointerY: number }
  | { type: "GESTURE_CONFIRM_SELECT" }
  | { type: "GESTURE_ZOOM_IN" }
  | { type: "GESTURE_ZOOM_OUT" }
  | { type: "GESTURE_RESET_VIEW" }
  | { type: "GESTURE_CLOSE_DETAIL" }
  | { type: "GESTURE_STATE"; state: HandGestureState };

type Listener = (event: HandGestureEvent) => void;

/** Layer 4 — hafif event bus; interaction katmanı dinler. */
class HandGestureEventBus {
  private listeners = new Set<Listener>();

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event: HandGestureEvent): void {
    for (const fn of this.listeners) fn(event);
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const handGestureEventBus = new HandGestureEventBus();
