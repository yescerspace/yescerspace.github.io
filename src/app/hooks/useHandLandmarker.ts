import { useEffect, useRef } from "react";
import type {
  HandLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  type GalleryHandSample,
  type HandControlMode,
} from "../components/galleryHandControl";
import { isUserRightHand } from "../utils/handGestures";
import { HandGesturePipeline } from "../utils/handGesturePipeline";

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const MEDIAPIPE_WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

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

/** Layer 0 — kamera + MediaPipe; jest mantığı pipeline'da. */
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
    onReady,
    onError,
  } = opts;
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const pipelineRef = useRef(new HandGesturePipeline());
  const modalOpenRef = useRef(modalOpen);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onModeChangeRef = useRef(opts.onModeChange);
  const lastPublishedModeRef = useRef<HandControlMode>("free");

  modalOpenRef.current = modalOpen;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  onModeChangeRef.current = opts.onModeChange;

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      const video = videoRef.current;
      if (video) video.srcObject = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      pipelineRef.current.reset();
      sampleRef.current = pipelineRef.current.emptySample();
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
        const handCount = Math.min(result.landmarks.length, 1);
        const { userRightLm, userLeftLm } = assignUserHands(
          result.landmarks.slice(0, handCount),
          result.handednesses ?? result.handedness,
        );

        const sample = pipelineRef.current.processFrame({
          landmarks: result.landmarks.slice(0, handCount),
          handednesses: result.handednesses ?? result.handedness,
          timestamp: now,
          modalOpen: modalOpenRef.current,
          orbitLocked: sampleRef.current.orbitLocked,
          userRightLm,
          userLeftLm,
        });

        if (sample.mode !== lastPublishedModeRef.current) {
          lastPublishedModeRef.current = sample.mode;
          onModeChangeRef.current(sample.mode);
        }

        sampleRef.current = sample;
      }
      rafRef.current = requestAnimationFrame(runLoop);
    };

    const boot = async () => {
      try {
        // MediaPipe sadece Hands Mode açılınca yüklensin (ana paketten ayrı chunk).
        const { FilesetResolver, HandLandmarker } = await import(
          "@mediapipe/tasks-vision"
        );
        if (cancelled) return;

        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
        if (cancelled) return;

        let landmarker: HandLandmarker;
        const lmOpts = {
          baseOptions: {
            modelAssetPath: HAND_MODEL_URL,
            delegate: "GPU" as const,
          },
          runningMode: "VIDEO" as const,
          numHands: 1,
          minHandDetectionConfidence: 0.3,
          minTrackingConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
        };
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, lmOpts);
        } catch {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            ...lmOpts,
            baseOptions: { ...lmOpts.baseOptions, delegate: "CPU" },
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
        sampleRef.current = pipelineRef.current.emptySample();
      }
    };

    void boot();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      pipelineRef.current.reset();
      sampleRef.current = pipelineRef.current.emptySample();
    };
  }, [enabled, videoRef, sampleRef, cameraStreamRef, cameraAccessPromiseRef]);
}
