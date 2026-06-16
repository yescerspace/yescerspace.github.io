import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import type { GalleryHandSample } from "./galleryHandControl";
import { useGalleryHandControl } from "./galleryHandControl";
import {
  HandNavSwipeDetector,
  shellNavNeighbor,
} from "../utils/handNavSwipe";
import {
  playGalleryClickSound,
  primeGalleryAudioEngineFromUserGesture,
} from "../utils/galleryHoverSfx";

type ShellHandNavBridgeProps = {
  active: boolean;
};

function palmForSwipe(sample: GalleryHandSample): { x: number; y: number } | null {
  if (sample.pointerActive) return null;
  if (
    sample.userRight.gesture === "pinch" ||
    sample.userLeft.gesture === "pinch" ||
    sample.userRight.gesture === "indexUp" ||
    sample.userLeft.gesture === "indexUp"
  ) {
    return null;
  }

  const hand = sample.userRight.detected
    ? sample.userRight
    : sample.userLeft.detected
      ? sample.userLeft
      : null;
  if (!hand) return null;

  if (
    hand.gesture === "openPalm" ||
    hand.gesture === "fist" ||
    hand.gesture === "none"
  ) {
    return { x: hand.palmX, y: hand.palmY };
  }

  return null;
}

/** 🖐️ ↔️ hızlı sallama — SPACE / ABOUT / CONNECT (touchpad swipe gibi) */
export function ShellHandNavBridge({ active }: ShellHandNavBridgeProps) {
  const hand = useGalleryHandControl();
  const navigate = useNavigate();
  const location = useLocation();
  const swipeRef = useRef(new HandNavSwipeDetector());

  useEffect(() => {
    if (!hand?.enabled || !active || hand.detailModalOpen) {
      swipeRef.current.reset();
      return;
    }

    let raf = 0;

    const tick = () => {
      if (!hand.enabled || !active || hand.detailModalOpen) return;

      const s = hand.sampleRef.current;
      const palm = palmForSwipe(s);
      const direction = swipeRef.current.push(
        performance.now(),
        palm?.x ?? 0.5,
        palm?.y ?? 0.5,
        palm != null,
      );

      if (direction) {
        const nextPath = shellNavNeighbor(location.pathname, direction);
        if (nextPath && nextPath !== location.pathname) {
          primeGalleryAudioEngineFromUserGesture();
          playGalleryClickSound();
          hand.setHintOpen(false);
          navigate(nextPath);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, hand, location.pathname, navigate]);

  return null;
}
