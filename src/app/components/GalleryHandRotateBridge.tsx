import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as StdOrbitControls } from "three-stdlib";
import { HAND_ROTATE_SMOOTH, useGalleryHandControl } from "./galleryHandControl";

type GalleryHandRotateBridgeProps = {
  orbitControlsRef: MutableRefObject<StdOrbitControls | null>;
  modalOpen: boolean;
};

/** 🖐️ el konumu ↔️ azimuth · ↕️ polar (merkez = dur). */
export function GalleryHandRotateBridge({
  orbitControlsRef,
  modalOpen,
}: GalleryHandRotateBridgeProps) {
  const hand = useGalleryHandControl();
  const smoothedAzimuthRef = useRef(0);
  const smoothedPolarRef = useRef(0);

  useFrame((_, delta) => {
    const controls = orbitControlsRef.current;
    if (!controls || !hand?.enabled || modalOpen) {
      smoothedAzimuthRef.current = 0;
      smoothedPolarRef.current = 0;
      return;
    }

    const s = hand.sampleRef.current;
    if (s.orbitLocked) {
      smoothedAzimuthRef.current *= 0.85;
      smoothedPolarRef.current *= 0.85;
      return;
    }

    smoothedAzimuthRef.current +=
      (s.rotateVelocity - smoothedAzimuthRef.current) * HAND_ROTATE_SMOOTH;
    smoothedPolarRef.current +=
      (s.polarVelocity - smoothedPolarRef.current) * HAND_ROTATE_SMOOTH;

    let changed = false;

    if (Math.abs(smoothedAzimuthRef.current) > 0.0004) {
      controls.setAzimuthalAngle(
        controls.getAzimuthalAngle() +
          smoothedAzimuthRef.current * delta * 3.2,
      );
      changed = true;
    }

    if (Math.abs(smoothedPolarRef.current) > 0.0004) {
      const nextPolar = THREE.MathUtils.clamp(
        controls.getPolarAngle() +
          smoothedPolarRef.current * delta * 2.6,
        controls.minPolarAngle,
        controls.maxPolarAngle,
      );
      controls.setPolarAngle(nextPolar);
      changed = true;
    }

    if (changed) controls.update();
  });

  return null;
}
