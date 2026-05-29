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
  isFiveFingerOpenPalm,
  isFistGesture,
  isPrayerHands,
  isSurrenderPose,
  isUserRightHand,
  OPEN_PALM_HIGHLIGHT_LANDMARKS,
  PRAYER_HIGHLIGHT_LANDMARKS,
} from "../utils/handGestures";
import { HAND_GESTURE_PULSE_COOLDOWN_MS } from "../components/galleryHandControl";

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const EMPTY_HAND: PhysicalHandState = {
  detected: false,
  gesture: "none",
  pinchX: 0.5,
  pinchY: 0.5,
  palmX: 0.5,
  palmY: 0.5,
  indexY: 0.5,
  pinchProximity: 0,
};

export function useHandLandmarker(opts: {
  enabled: boolean;
  modalOpen: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sampleRef: React.MutableRefObject<GalleryHandSample>;
  onModeChange: (mode: HandControlMode) => void;
  onReady: () => void;
  onError: (message: string) => void;
}): void {
  const { enabled, modalOpen, videoRef, sampleRef, onModeChange, onReady, onError } =
    opts;
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const modalOpenRef = useRef(modalOpen);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onModeChangeRef = useRef(onModeChange);
  const lastPublishedModeRef = useRef<HandControlMode>("free");
  const wasLeftFistRef = useRef(false);
  const wasPrayerRef = useRef(false);
  const wasSurrenderRef = useRef(false);
  const lastZoomPulseMsRef = useRef(0);
  const prevModalOpenRef = useRef(false);

  modalOpenRef.current = modalOpen;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  onModeChangeRef.current = onModeChange;

  const makeEmptySample = (): GalleryHandSample => ({
    handDetected: false,
    mode: "free",
    userLeft: { ...EMPTY_HAND },
    userRight: { ...EMPTY_HAND },
    handsSpan: 0,
    closePulse: false,
    zoomOutPulse: false,
    resetZoomPulse: false,
    orbitLocked: false,
    overlayHands: [],
  });

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      wasLeftFistRef.current = false;
      wasPrayerRef.current = false;
      wasSurrenderRef.current = false;
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

        let userRightLm: NormalizedLandmark[] | undefined;
        let userLeftLm: NormalizedLandmark[] | undefined;
        const overlayHands: GalleryHandSample["overlayHands"] = [];

        for (let i = 0; i < handCount; i += 1) {
          const lm = result.landmarks[i];
          if (!lm) continue;
          const isRight = isUserRightHand(lm);
          if (isRight && !userRightLm) userRightLm = lm;
          else if (!isRight && !userLeftLm) userLeftLm = lm;
          else if (!userRightLm) userRightLm = lm;
          else if (!userLeftLm) userLeftLm = lm;
        }

        const userRight = classifyHand(userRightLm);
        const userLeft = classifyHand(userLeftLm);

        const leftOpen = userLeftLm ? isFiveFingerOpenPalm(userLeftLm) : false;
        const rightOpen = userRightLm ? isFiveFingerOpenPalm(userRightLm) : false;

        const handsSpan =
          userLeft.detected && userRight.detected
            ? Math.hypot(
                userRight.palmX - userLeft.palmX,
                userRight.palmY - userLeft.palmY,
              )
            : 0;

        const leftFist = userLeftLm ? isFistGesture(userLeftLm) : false;
        const prayer =
          userLeftLm && userRightLm
            ? isPrayerHands(userLeftLm, userRightLm)
            : false;
        const surrender =
          userLeftLm && userRightLm
            ? isSurrenderPose(userLeftLm, userRightLm)
            : false;

        if (modalOpenRef.current && !prevModalOpenRef.current) {
          wasLeftFistRef.current = leftFist;
        }
        prevModalOpenRef.current = modalOpenRef.current;

        let closePulse = false;
        if (modalOpenRef.current && leftFist && !wasLeftFistRef.current) {
          closePulse = true;
        }
        wasLeftFistRef.current = leftFist;

        let zoomOutPulse = false;
        let resetZoomPulse = false;
        if (!modalOpenRef.current) {
          if (prayer && !wasPrayerRef.current) {
            zoomOutPulse = true;
          }
          if (surrender && !wasSurrenderRef.current) {
            resetZoomPulse = true;
          }
          if (zoomOutPulse || resetZoomPulse) {
            if (now - lastZoomPulseMsRef.current < HAND_GESTURE_PULSE_COOLDOWN_MS) {
              zoomOutPulse = false;
              resetZoomPulse = false;
            } else {
              lastZoomPulseMsRef.current = now;
            }
          }
        }
        wasPrayerRef.current = prayer;
        wasSurrenderRef.current = surrender;

        let mode: HandControlMode = "free";
        if (modalOpenRef.current) {
          mode = "detail";
        } else if (
          leftOpen &&
          rightOpen &&
          userLeft.detected &&
          userRight.detected &&
          !prayer &&
          !surrender
        ) {
          mode = "steer";
        }

        if (mode !== lastPublishedModeRef.current) {
          lastPublishedModeRef.current = mode;
          onModeChangeRef.current(mode);
        }

        const buildOverlay = (
          lm: NormalizedLandmark[],
          handed: "left" | "right",
          highlights: number[],
        ) => {
          overlayHands.push({
            handed,
            points: lm.map((p) => ({ x: p.x, y: p.y })),
            highlights,
          });
        };

        if (userRightLm) {
          const hi = prayer
            ? [...PRAYER_HIGHLIGHT_LANDMARKS]
            : rightOpen
              ? [...OPEN_PALM_HIGHLIGHT_LANDMARKS]
              : [];
          buildOverlay(userRightLm, "right", hi);
        }
        if (userLeftLm) {
          const hi = prayer
            ? [...PRAYER_HIGHLIGHT_LANDMARKS]
            : leftFist
              ? [...FIST_HIGHLIGHT_LANDMARKS]
              : leftOpen
                ? [...OPEN_PALM_HIGHLIGHT_LANDMARKS]
                : [];
          buildOverlay(userLeftLm, "left", hi);
        }

        const orbitLocked = sampleRef.current.orbitLocked;

        sampleRef.current = {
          handDetected: userRight.detected || userLeft.detected,
          mode,
          userLeft: leftFist
            ? { ...userLeft, gesture: "fist" }
            : leftOpen
              ? { ...userLeft, gesture: "open" }
              : userLeft,
          userRight: rightOpen ? { ...userRight, gesture: "open" } : userRight,
          handsSpan,
          closePulse,
          zoomOutPulse,
          resetZoomPulse,
          orbitLocked,
          overlayHands,
        };
      }
      rafRef.current = requestAnimationFrame(runLoop);
    };

    const boot = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
        );
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

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        let video = videoRef.current;
        for (let i = 0; i < 40 && !video; i += 1) {
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
      streamRef.current?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
      sampleRef.current = makeEmptySample();
    };
  }, [enabled, modalOpen, videoRef, sampleRef]);
}
