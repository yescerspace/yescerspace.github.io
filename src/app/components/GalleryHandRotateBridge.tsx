import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import type { OrbitControls as StdOrbitControls } from "three-stdlib";
import { HAND_ROTATE_SMOOTH, useGalleryHandControl } from "./galleryHandControl";

type GalleryHandRotateBridgeProps = {
  orbitControlsRef: MutableRefObject<StdOrbitControls | null>;
  modalOpen: boolean;
};

/** 👋 Açık avuç yatay kaydırma → azimuth döndürme. */
export function GalleryHandRotateBridge({
  orbitControlsRef,
  modalOpen,
}: GalleryHandRotateBridgeProps) {
  const hand = useGalleryHandControl();
  const smoothedVelocityRef = useRef(0);

  useFrame((_, delta) => {
    const controls = orbitControlsRef.current;
    if (!controls || !hand?.enabled || modalOpen) {
      smoothedVelocityRef.current = 0;
      return;
    }

    const s = hand.sampleRef.current;
    if (s.orbitLocked || s.mode !== "rotate") {
      smoothedVelocityRef.current *= 0.85;
      return;
    }

    const target = s.rotateVelocity;
    smoothedVelocityRef.current +=
      (target - smoothedVelocityRef.current) * HAND_ROTATE_SMOOTH;

    if (Math.abs(smoothedVelocityRef.current) > 0.0004) {
      controls.setAzimuthalAngle(
        controls.getAzimuthalAngle() +
          smoothedVelocityRef.current * delta * 2.1,
      );
      controls.update();
    }
  });

  return null;
}
