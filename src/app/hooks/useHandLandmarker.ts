import { useEffect, useRef } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  type GalleryHandSample,
  type HandControlMode,
  type PhysicalHandState,
} from "../components/galleryHandControl";
import {
  classifyHand,
  FIST_HIGHLIGHT_LANDMARKS,
  INDEX_HIGHLIGHT_LANDMARKS,
  isFistGesture,
  isOpenPalmSplayedMove,
  isOpenPalmZoomInHold,
  isStartPositionPose,
  isUserRightHand,
  OK_SIGN_HIGHLIGHT_LANDMARKS,
  OPEN_PALM_HIGHLIGHT_LANDMARKS,
  palmPositionDrive,
  WristVerticalTracker,
} from "../utils/handGestures";
import { HAND_GESTURE_PULSE_COOLDOWN_MS } from "../components/galleryHandControl";

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const MEDIAPIPE_WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

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

function assignUserHands(
  landmarks: NormalizedLandmark[][],
  handednesses: Array<Array<{ categoryName?: string }>> | undefined,
): { userRightLm?: NormalizedLandmark[]; userLeftLm?: NormalizedLandmark[] } {
  let userRightLm: NormalizedLandmark[] | undefined;
  let userLeftLm: NormalizedLandmark[] | undefined;

  for (let i = 0; i < landmarks.length; i += 1) {
    const lm = landmarks[i];
    if (!lm) continue;

    const mpLabel = handednesses?.[i]?.[0]?.categoryName;
    const isUserRight =
      mpLabel === "Right" || (mpLabel == null && isUserRightHand(lm));

    if (isUserRight && !userRightLm) userRightLm = lm;
    else if (!isUserRight && !userLeftLm) userLeftLm = lm;
    else if (!userRightLm) userRightLm = lm;
    else if (!userLeftLm) userLeftLm = lm;
  }

  return { userRightLm, userLeftLm };
}

function gestureHighlights(
  gesture: PhysicalHandState["gesture"],
): number[] {
  switch (gesture) {
    case "fist":
      return [...FIST_HIGHLIGHT_LANDMARKS];
    case "openPalm":
      return [...OPEN_PALM_HIGHLIGHT_LANDMARKS];
    case "indexUp":
      return [...INDEX_HIGHLIGHT_LANDMARKS];
    case "okSign":
      return [...OK_SIGN_HIGHLIGHT_LANDMARKS];
    default:
      return [];
  }
}

function pickMoveHand(
  userLeft: PhysicalHandState,
  userRight: PhysicalHandState,
  userLeftLm: NormalizedLandmark[] | undefined,
  userRightLm: NormalizedLandmark[] | undefined,
): PhysicalHandState | null {
  const rightMove =
    userRightLm && isOpenPalmSplayedMove(userRightLm) && userRight.detected;
  const leftMove =
    userLeftLm && isOpenPalmSplayedMove(userLeftLm) && userLeft.detected;
  if (rightMove) return userRight;
  if (leftMove) return userLeft;
  return null;
}

export function useHandLandmarker(opts: {
  enabled: boolean;
  modalOpen: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sampleRef: React.MutableRefObject<GalleryHandSample>;
  cameraStreamRef: React.MutableRefObject<MediaStream | null>;
  cameraAccessPromiseRef: React.MutableRefObject<Promise<MediaStream> | null>;
  onModeChange: (mode: HandControlMode) => void;
  onReady: () => void;
  onError: (message: string) => void;
}): void {
  const {
    enabled,
    modalOpen,
    videoRef,
    sampleRef,
    cameraStreamRef,
    cameraAccessPromiseRef,
    onModeChange,
    onReady,
    onError,
  } = opts;
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const modalOpenRef = useRef(modalOpen);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onModeChangeRef = useRef(onModeChange);
  const lastPublishedModeRef = useRef<HandControlMode>("free");
  const wasStartPoseRef = useRef(false);
  const wasAnyFistRef = useRef(false);
  const wasOpenPalmRef = useRef(false);
  const wasModalFistRef = useRef(false);
  const lastPulseMsRef = useRef(0);
  const detailScrollTrackerRef = useRef(new WristVerticalTracker());

  modalOpenRef.current = modalOpen;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  onModeChangeRef.current = onModeChange;

  const makeEmptySample = (): GalleryHandSample => ({
    handDetected: false,
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
  });

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      const video = videoRef.current;
      if (video) video.srcObject = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      wasStartPoseRef.current = false;
      wasAnyFistRef.current = false;
      wasOpenPalmRef.current = false;
      wasModalFistRef.current = false;
      detailScrollTrackerRef.current.reset();
      sampleRef.current = makeEmptySample();
      return;
    }

    let cancelled = false;

    const runLoop = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (
        video &&
        landmarker &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        const now = performance.now();
        const result = landmarker.detectForVideo(video, now);
        const handCount = Math.min(result.landmarks.length, 2);
        const overlayHands: GalleryHandSample["overlayHands"] = [];

        const { userRightLm, userLeftLm } = assignUserHands(
          result.landmarks.slice(0, handCount),
          result.handednesses ?? result.handedness,
        );

        const userRight = classifyHand(userRightLm);
        const userLeft = classifyHand(userLeftLm);

        const startPose =
          (userLeftLm ? isStartPositionPose(userLeftLm) : false) ||
          (userRightLm ? isStartPositionPose(userRightLm) : false);

        const leftFist = userLeftLm ? isFistGesture(userLeftLm) : false;
        const rightFist = userRightLm ? isFistGesture(userRightLm) : false;
        const anyFist = leftFist || rightFist;

        const okSign =
          userRight.gesture === "okSign" || userLeft.gesture === "okSign";
        const pointerHand =
          userRight.gesture === "indexUp"
            ? userRight
            : userLeft.gesture === "indexUp"
              ? userLeft
              : null;

        const moveHand = pickMoveHand(
          userLeft,
          userRight,
          userLeftLm,
          userRightLm,
        );

        let rotateVelocity = 0;
        let polarVelocity = 0;
        let detailScrollVelocity = 0;

        if (modalOpenRef.current) {
          if (moveHand && !anyFist) {
            detailScrollVelocity = detailScrollTrackerRef.current.push(
              moveHand.palmY,
              now,
            );
          } else {
            detailScrollTrackerRef.current.reset();
          }
        } else if (moveHand && !anyFist && !pointerHand && !okSign) {
          detailScrollTrackerRef.current.reset();
          rotateVelocity = palmPositionDrive(moveHand.palmX);
          polarVelocity = palmPositionDrive(moveHand.palmY);
        } else {
          detailScrollTrackerRef.current.reset();
        }

        const waveActive =
          !modalOpenRef.current &&
          moveHand != null &&
          (Math.abs(rotateVelocity) > 0.004 || Math.abs(polarVelocity) > 0.004);

        const leftOpenZoom =
          userLeftLm &&
          isOpenPalmZoomInHold(userLeftLm) &&
          userLeft.gesture === "openPalm";
        const rightOpenZoom =
          userRightLm &&
          isOpenPalmZoomInHold(userRightLm) &&
          userRight.gesture === "openPalm";
        const palmAtCenter =
          Math.abs(rotateVelocity) < 0.012 && Math.abs(polarVelocity) < 0.012;
        const openPalmHeld = Boolean(
          (leftOpenZoom || rightOpenZoom) && palmAtCenter && moveHand != null,
        );

        let closePulse = false;
        let resetZoomPulse = false;
        let zoomOutPulse = false;
        let zoomInPulse = false;
        let fistHeld = false;

        if (modalOpenRef.current) {
          if (anyFist && !wasModalFistRef.current) {
            closePulse = true;
          }
        } else {
          if (startPose && !wasStartPoseRef.current) {
            resetZoomPulse = true;
          }
          if (openPalmHeld && !wasOpenPalmRef.current) {
            zoomInPulse = true;
          }
          if (anyFist && !wasAnyFistRef.current) {
            zoomOutPulse = true;
          }
          fistHeld = anyFist;

          const pulse = resetZoomPulse || zoomOutPulse || zoomInPulse;
          if (pulse && now - lastPulseMsRef.current < HAND_GESTURE_PULSE_COOLDOWN_MS) {
            resetZoomPulse = false;
            zoomOutPulse = false;
            zoomInPulse = false;
          } else if (pulse) {
            lastPulseMsRef.current = now;
          }
        }

        wasStartPoseRef.current = startPose;
        wasAnyFistRef.current = anyFist;
        wasOpenPalmRef.current = openPalmHeld;
        wasModalFistRef.current = modalOpenRef.current ? anyFist : false;

        let mode: HandControlMode = "free";
        if (modalOpenRef.current) {
          mode = "detail";
        } else if (pointerHand || okSign) {
          mode = "pointer";
        } else if (moveHand && waveActive) {
          mode = "rotate";
        }

        if (mode !== lastPublishedModeRef.current) {
          lastPublishedModeRef.current = mode;
          onModeChangeRef.current(mode);
        }

        if (userRightLm) {
          overlayHands.push({
            handed: "right",
            points: userRightLm.map((p) => ({ x: p.x, y: p.y })),
            highlights: gestureHighlights(userRight.gesture),
          });
        }
        if (userLeftLm) {
          overlayHands.push({
            handed: "left",
            points: userLeftLm.map((p) => ({ x: p.x, y: p.y })),
            highlights: gestureHighlights(userLeft.gesture),
          });
        }

        sampleRef.current = {
          handDetected: userRight.detected || userLeft.detected,
          mode,
          userLeft,
          userRight,
          pointerX: pointerHand?.pointerX ?? 0.5,
          pointerY: pointerHand?.pointerY ?? 0.5,
          pointerActive: pointerHand != null,
          selectPulse: false,
          closePulse,
          resetZoomPulse,
          zoomOutPulse,
          openPalmHeld,
          zoomInPulse,
          fistHeld,
          rotateVelocity,
          polarVelocity,
          waveActive,
          detailScrollVelocity,
          orbitLocked: sampleRef.current.orbitLocked,
          overlayHands,
        };
      }
      rafRef.current = requestAnimationFrame(runLoop);
    };

    const boot = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
        if (cancelled) return;

        let landmarker: HandLandmarker;
        const opts = {
          baseOptions: {
            modelAssetPath: HAND_MODEL_URL,
            delegate: "GPU" as const,
          },
          runningMode: "VIDEO" as const,
          numHands: 2,
          minHandDetectionConfidence: 0.3,
          minTrackingConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
        };
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, opts);
        } catch {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            ...opts,
            baseOptions: { ...opts.baseOptions, delegate: "CPU" },
          });
        }
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;

        const accessPromise = cameraAccessPromiseRef.current;
        const stream =
          cameraStreamRef.current ??
          (accessPromise
            ? await accessPromise
            : await navigator.mediaDevices.getUserMedia({
                video: {
                  facingMode: "user",
                  width: { ideal: 640 },
                  height: { ideal: 480 },
                },
                audio: false,
              }));
        if (cancelled) {
          if (!cameraStreamRef.current) {
            stream.getTracks().forEach((t) => t.stop());
          }
          return;
        }
        cameraStreamRef.current = stream;

        let video = videoRef.current;
        for (let i = 0; i < 80 && !video; i += 1) {
          await new Promise((r) => setTimeout(r, 32));
          video = videoRef.current;
        }
        if (!video) throw new Error("Video element missing");
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;

        onReadyRef.current();
        rafRef.current = requestAnimationFrame(runLoop);
      } catch (err) {
        if (cancelled) return;
        onErrorRef.current(
          err instanceof Error ? err.message : "Camera or hand tracking failed",
        );
        sampleRef.current = makeEmptySample();
      }
    };

    void boot();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      sampleRef.current = makeEmptySample();
    };
  }, [enabled, videoRef, sampleRef, cameraStreamRef, cameraAccessPromiseRef]);
}
