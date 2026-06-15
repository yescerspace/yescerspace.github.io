import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type {
  GalleryHandSample,
  PhysicalHandState,
} from "../components/galleryHandControl";
import { HAND_GESTURE_PULSE_COOLDOWN_MS } from "../components/galleryHandControl";
import { classifyHand } from "./handGestures";
import { HandGestureDetector, landmarksForOverlay } from "./handGestureDetector";
import {
  gestureStateToLegacyMode,
  HandGestureStateMachine,
  overlayHighlightsForState,
} from "./handGestureStateMachine";
import type { HandGestureState } from "./handGestureEventBus";
import { buildRawHandFrame } from "./handRawInput";

const EMPTY_HAND: PhysicalHandState = {
  detected: false,
  gesture: "none",
  pointerX: 0.5,
  pointerY: 0.5,
  palmX: 0.5,
  palmY: 0.5,
  indexY: 0.5,
  wristX: 0.5,
  wristY: 0.5,
};

/** Layer 2–3 orchestrator: Raw → Detector → StateMachine → sample. */
export class HandGesturePipeline {
  readonly detector = new HandGestureDetector();
  readonly stateMachine = new HandGestureStateMachine(
    HAND_GESTURE_PULSE_COOLDOWN_MS,
  );

  reset(): void {
    this.detector.reset();
    this.stateMachine.reset();
  }

  processFrame(opts: {
    landmarks: NormalizedLandmark[][];
    handednesses: Array<Array<{ categoryName?: string; score?: number }>> | undefined;
    timestamp: number;
    modalOpen: boolean;
    orbitLocked: boolean;
    userRightLm?: NormalizedLandmark[];
    userLeftLm?: NormalizedLandmark[];
  }): GalleryHandSample {
    const raw = buildRawHandFrame(
      opts.landmarks,
      opts.handednesses,
      opts.timestamp,
    );
    const detected = this.detector.update(raw);
    const interaction = this.stateMachine.update(detected, {
      modalOpen: opts.modalOpen,
      now: opts.timestamp,
    });

    const userRight = classifyHand(opts.userRightLm);
    const userLeft = classifyHand(opts.userLeftLm);
    const state = interaction.state as HandGestureState;
    const hl = overlayHighlightsForState(state, detected);

    const overlayHands: GalleryHandSample["overlayHands"] = landmarksForOverlay(
      raw,
      hl,
    );

    return {
      handDetected: detected.handDetected,
      gestureState: state,
      mode: gestureStateToLegacyMode(state, opts.modalOpen),
      userLeft,
      userRight,
      pointerX: interaction.pointerX,
      pointerY: interaction.pointerY,
      pointerActive: interaction.pointerActive,
      selectPulse: interaction.selectPulse,
      closePulse: interaction.closePulse,
      resetZoomPulse: interaction.resetZoomPulse,
      zoomOutPulse: interaction.zoomOutPulse,
      openPalmHeld: interaction.openPalmHeld,
      zoomInPulse: interaction.zoomInPulse,
      fistHeld: interaction.fistHeld,
      rotateVelocity: interaction.rotateVelocity,
      polarVelocity: interaction.polarVelocity,
      waveActive: interaction.waveActive,
      detailScrollVelocity: interaction.detailScrollVelocity,
      orbitLocked: opts.orbitLocked,
      overlayHands,
    };
  }

  emptySample(): GalleryHandSample {
    return {
      handDetected: false,
      gestureState: "IDLE",
      mode: "free",
      userLeft: { ...EMPTY_HAND },
      userRight: { ...EMPTY_HAND },
      pointerX: 0.5,
      pointerY: 0.5,
      pointerActive: false,
      selectPulse: false,
      closePulse: false,
      resetZoomPulse: false,
      zoomOutPulse: false,
      openPalmHeld: false,
      zoomInPulse: false,
      fistHeld: false,
      rotateVelocity: 0,
      polarVelocity: 0,
      waveActive: false,
      detailScrollVelocity: 0,
      orbitLocked: false,
      overlayHands: [],
    };
  }
}
