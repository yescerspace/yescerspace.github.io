import type { GestureDetectorSnapshot } from "./handGestureDetector";
import { palmPositionDrive } from "./handGestures";
import type { HandGestureState } from "./handGestureEventBus";
import { handGestureEventBus } from "./handGestureEventBus";

export type InteractionOutput = {
  state: HandGestureState;
  rotateVelocity: number;
  polarVelocity: number;
  detailScrollVelocity: number;
  pointerActive: boolean;
  pointerX: number;
  pointerY: number;
  selectPulse: boolean;
  closePulse: boolean;
  resetZoomPulse: boolean;
  zoomInPulse: boolean;
  zoomOutPulse: boolean;
  fistHeld: boolean;
  openPalmHeld: boolean;
  waveActive: boolean;
};

const SMOOTH = 0.22;
const MOVE_EPS = 0.003;
const ROTATE_AZIMUTH_RATE = 3.8;
const ROTATE_POLAR_RATE = 3.2;
const ROTATE_DEAD_ZONE = 0.08;
const MODAL_CLOSE_GRACE_MS = 1200;
const MODAL_FIST_CLOSE_FRAMES = 16;
const MODAL_SCROLL_ACTIVITY_MS = 600;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function dead(v: number, eps = MOVE_EPS): number {
  return Math.abs(v) < eps ? 0 : v;
}

/** Layer 3 — jest kararları; ham landmark'a dokunmaz. */
export class HandGestureStateMachine {
  state: HandGestureState = "IDLE";
  private smoothAz = 0;
  private smoothPol = 0;
  private smoothScroll = 0;
  private wasOkSignConfirmed = false;
  private wasFist = false;
  private wasStartPose = false;
  private wasModalOpen = false;
  private modalOpenedAt = 0;
  private modalFistCloseFrames = 0;
  private modalScrollActiveUntil = 0;
  private lastPulseMs = 0;
  private readonly pulseCooldownMs: number;

  constructor(pulseCooldownMs: number) {
    this.pulseCooldownMs = pulseCooldownMs;
  }

  reset(): void {
    this.state = "IDLE";
    this.smoothAz = 0;
    this.smoothPol = 0;
    this.smoothScroll = 0;
    this.wasOkSignConfirmed = false;
    this.wasFist = false;
    this.wasStartPose = false;
    this.wasModalOpen = false;
    this.modalOpenedAt = 0;
    this.modalFistCloseFrames = 0;
    this.modalScrollActiveUntil = 0;
  }

  update(
    g: GestureDetectorSnapshot,
    ctx: { modalOpen: boolean; now: number },
  ): InteractionOutput {
    const out: InteractionOutput = {
      state: this.state,
      rotateVelocity: 0,
      polarVelocity: 0,
      detailScrollVelocity: 0,
      pointerActive: false,
      pointerX: g.pointerX,
      pointerY: g.pointerY,
      selectPulse: false,
      closePulse: false,
      resetZoomPulse: false,
      zoomInPulse: false,
      zoomOutPulse: false,
      fistHeld: false,
      openPalmHeld: false,
      waveActive: false,
    };

    if (!g.handDetected) {
      this.state = "IDLE";
      this.smoothAz = 0;
      this.smoothPol = 0;
      this.smoothScroll = 0;
      out.state = this.state;
      return out;
    }

    if (ctx.modalOpen && !this.wasModalOpen) {
      this.modalOpenedAt = ctx.now;
      this.modalFistCloseFrames = 0;
      this.modalScrollActiveUntil = ctx.now + MODAL_CLOSE_GRACE_MS;
      this.wasFist = g.isFist;
      this.state = "IDLE";
      this.smoothScroll = 0;
    } else if (!ctx.modalOpen && this.wasModalOpen) {
      this.modalFistCloseFrames = 0;
      this.modalScrollActiveUntil = 0;
    }
    this.wasModalOpen = ctx.modalOpen;

    if (ctx.modalOpen) {
      this.applyModalTransitions(g, ctx.now, out);
    } else {
      this.applyGalleryTransitions(g, ctx.now, out);
    }

    out.state = this.state;
    this.applyMotion(g, ctx.modalOpen, ctx.now, out);
    this.emitEvents(g, ctx.modalOpen, out);

    handGestureEventBus.emit({ type: "GESTURE_STATE", state: this.state });

    return out;
  }

  private applyGalleryTransitions(
    g: GestureDetectorSnapshot,
    now: number,
    out: InteractionOutput,
  ): void {
    if (g.isStartPose && !this.wasStartPose) {
      out.resetZoomPulse = this.allowPulse(now);
    }
    this.wasStartPose = g.isStartPose;

    switch (this.state) {
      case "IDLE":
        if (g.isFist) this.state = "ZOOM_MODE";
        else if (g.isIndexPoint) this.state = "SELECT_MODE";
        else if (g.isOpenHand) this.state = "ROTATE_MODE";
        break;
      case "ROTATE_MODE":
        if (g.isFist) this.state = "ZOOM_MODE";
        else if (g.isIndexPoint) this.state = "SELECT_MODE";
        else if (!g.isOpenHand) this.state = "IDLE";
        break;
      case "SELECT_MODE":
        if (g.isFist) this.state = "ZOOM_MODE";
        else if (g.isOpenHand && !g.isIndexPoint) this.state = "ROTATE_MODE";
        else if (!g.isIndexPoint && !g.isOkSign) this.state = "IDLE";
        break;
      case "ZOOM_MODE":
        if (!g.isFist) this.state = "IDLE";
        break;
      default:
        this.state = "IDLE";
    }

    if (g.isFist && !this.wasFist) {
      out.zoomInPulse = this.allowPulse(now);
    }
    this.wasFist = g.isFist;
    out.fistHeld = g.isFist;

    if (g.okSignConfirmed && !this.wasOkSignConfirmed) {
      out.selectPulse = true;
    }
    this.wasOkSignConfirmed = g.okSignConfirmed;
  }

  private applyModalTransitions(
    g: GestureDetectorSnapshot,
    now: number,
    out: InteractionOutput,
  ): void {
    const scrollActive =
      this.state === "SCROLL_MODE" ||
      g.isScrollPalm ||
      g.isOpenHand ||
      g.isOkSign ||
      g.okSignConfirmed ||
      Math.abs(this.smoothScroll) > 0.015 ||
      now < this.modalScrollActiveUntil;

    const fistCloseCandidate =
      g.isStrictFist && !scrollActive && !g.isIndexPoint;

    if (fistCloseCandidate) {
      this.modalFistCloseFrames += 1;
    } else {
      this.modalFistCloseFrames = 0;
    }

    const pastGrace = now - this.modalOpenedAt >= MODAL_CLOSE_GRACE_MS;
    if (
      pastGrace &&
      this.modalFistCloseFrames >= MODAL_FIST_CLOSE_FRAMES &&
      this.allowPulse(now)
    ) {
      out.closePulse = true;
      this.modalFistCloseFrames = 0;
    }

    switch (this.state) {
      case "IDLE":
        if (g.isScrollPalm || g.isOpenHand) this.state = "SCROLL_MODE";
        break;
      case "SCROLL_MODE":
        if (!g.isScrollPalm && !g.isOpenHand) this.state = "IDLE";
        break;
      default:
        this.state = g.isScrollPalm || g.isOpenHand ? "SCROLL_MODE" : "IDLE";
    }

    this.wasFist = g.isFist;
  }

  private applyMotion(
    g: GestureDetectorSnapshot,
    modalOpen: boolean,
    now: number,
    out: InteractionOutput,
  ): void {
    if (modalOpen) {
      if (this.state === "SCROLL_MODE") {
        const target = palmPositionDrive(g.palmY, 0.5, 0.11, 2.4);
        this.smoothScroll = lerp(this.smoothScroll, target, SMOOTH);
        out.detailScrollVelocity = dead(this.smoothScroll, 0.008);
        if (Math.abs(out.detailScrollVelocity) > 0.006) {
          this.modalScrollActiveUntil = now + MODAL_SCROLL_ACTIVITY_MS;
        }
      } else {
        this.smoothScroll *= 0.8;
        out.detailScrollVelocity = 0;
      }
      return;
    }

    if (this.state === "ROTATE_MODE" && g.isOpenHand) {
      const targetAz = palmPositionDrive(
        g.palmX,
        0.5,
        ROTATE_DEAD_ZONE,
        ROTATE_AZIMUTH_RATE,
      );
      const targetPol = palmPositionDrive(
        g.palmY,
        0.5,
        ROTATE_DEAD_ZONE,
        ROTATE_POLAR_RATE,
      );
      this.smoothAz = lerp(this.smoothAz, targetAz, SMOOTH);
      this.smoothPol = lerp(this.smoothPol, targetPol, SMOOTH);
      out.rotateVelocity = dead(this.smoothAz);
      out.polarVelocity = dead(this.smoothPol);
      out.waveActive =
        Math.abs(out.rotateVelocity) > 0.004 ||
        Math.abs(out.polarVelocity) > 0.004;
      out.openPalmHeld =
        g.isOpenHand &&
        Math.abs(out.rotateVelocity) < 0.01 &&
        Math.abs(out.polarVelocity) < 0.01;
    } else {
      this.smoothAz *= 0.82;
      this.smoothPol *= 0.82;
    }

    if (this.state === "SELECT_MODE" || g.isIndexPoint) {
      out.pointerActive = g.isIndexPoint;
      out.pointerX = g.indexPointerX;
      out.pointerY = g.indexPointerY;
    }

    if (this.state === "ZOOM_MODE") {
      out.fistHeld = g.isFist;
    }
  }

  private emitEvents(
    g: GestureDetectorSnapshot,
    modalOpen: boolean,
    out: InteractionOutput,
  ): void {
    if (!modalOpen && out.waveActive) {
      handGestureEventBus.emit({
        type: "GESTURE_ROTATE",
        x: out.rotateVelocity,
        y: out.polarVelocity,
      });
    }
    if (modalOpen && Math.abs(out.detailScrollVelocity) > 0.008) {
      handGestureEventBus.emit({
        type: "GESTURE_SCROLL",
        y: out.detailScrollVelocity,
      });
    }
    if (out.pointerActive) {
      handGestureEventBus.emit({
        type: "GESTURE_SELECT",
        pointerX: out.pointerX,
        pointerY: out.pointerY,
      });
    }
    if (out.selectPulse) {
      handGestureEventBus.emit({ type: "GESTURE_CONFIRM_SELECT" });
    }
    if (out.zoomInPulse) handGestureEventBus.emit({ type: "GESTURE_ZOOM_IN" });
    if (out.resetZoomPulse) {
      handGestureEventBus.emit({ type: "GESTURE_RESET_VIEW" });
    }
    if (out.closePulse) {
      handGestureEventBus.emit({ type: "GESTURE_CLOSE_DETAIL" });
    }
  }

  private allowPulse(now: number): boolean {
    if (now - this.lastPulseMs < this.pulseCooldownMs) return false;
    this.lastPulseMs = now;
    return true;
  }
}

export function gestureStateToLegacyMode(
  state: HandGestureState,
  modalOpen: boolean,
): "free" | "pointer" | "rotate" | "detail" {
  if (modalOpen) return "detail";
  switch (state) {
    case "SELECT_MODE":
      return "pointer";
    case "ROTATE_MODE":
      return "rotate";
    default:
      return "free";
  }
}

export function overlayHighlightsForState(
  state: HandGestureState,
  g: GestureDetectorSnapshot,
): number[] {
  if (g.isOkSign) return [3, 4, 8];
  if (g.isIndexPoint) return [6, 7, 8];
  if (g.isFist) return [0, 5, 9, 13, 17];
  if (state === "ROTATE_MODE" || state === "SCROLL_MODE" || g.isOpenHand || g.isScrollPalm) {
    return [0, 4, 8, 12, 16, 20];
  }
  return [];
}
