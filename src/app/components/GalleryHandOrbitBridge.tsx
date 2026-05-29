import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as StdOrbitControls } from "three-stdlib";
import {
  HAND_STEER_AZIMUTH_SMOOTH,
  HAND_STEER_AZIMUTH_SPAN_GAIN,
  HAND_STEER_POLAR_PALM_GAIN,
  HAND_STEER_POLAR_SMOOTH,
  useGalleryHandControl,
} from "./galleryHandControl";

type GalleryHandOrbitBridgeProps = {
  orbitControlsRef: MutableRefObject<StdOrbitControls | null>;
  modalOpen: boolean;
  minPolarAngle: number;
  maxPolarAngle: number;
};

/**
 * İki el 5 parmak açık:
 * - İki el birbirine yaklaşınca → azimuth sağa; uzaklaşınca → sola
 * - Sağ el yukarı/aşağı → polar (üstten / normal / alttan)
 */
export function GalleryHandOrbitBridge({
  orbitControlsRef,
  modalOpen,
  minPolarAngle,
  maxPolarAngle,
}: GalleryHandOrbitBridgeProps) {
  const hand = useGalleryHandControl();
  const polarNeutralRef = useRef<number | null>(null);
  const rightPalmNeutralRef = useRef<number | null>(null);
  const spanNeutralRef = useRef<number | null>(null);
  const azimuthNeutralRef = useRef<number | null>(null);
  const smoothedPolarRef = useRef<number | null>(null);
  const smoothedAzimuthRef = useRef<number | null>(null);
  const wasSteerRef = useRef(false);

  useFrame(() => {
    const controls = orbitControlsRef.current;
    if (!controls || !hand?.enabled || modalOpen) {
      wasSteerRef.current = false;
      polarNeutralRef.current = null;
      rightPalmNeutralRef.current = null;
      spanNeutralRef.current = null;
      azimuthNeutralRef.current = null;
      smoothedPolarRef.current = null;
      smoothedAzimuthRef.current = null;
      return;
    }

    const s = hand.sampleRef.current;

    if (s.orbitLocked || s.mode !== "steer") {
      wasSteerRef.current = false;
      polarNeutralRef.current = null;
      rightPalmNeutralRef.current = null;
      spanNeutralRef.current = null;
      azimuthNeutralRef.current = null;
      smoothedPolarRef.current = null;
      smoothedAzimuthRef.current = null;
      return;
    }

    if (!wasSteerRef.current) {
      polarNeutralRef.current = controls.getPolarAngle();
      rightPalmNeutralRef.current = s.userRight.palmY;
      spanNeutralRef.current = s.handsSpan;
      azimuthNeutralRef.current = controls.getAzimuthalAngle();
      smoothedPolarRef.current = controls.getPolarAngle();
      smoothedAzimuthRef.current = controls.getAzimuthalAngle();
      wasSteerRef.current = true;
    }

    const neutralPolar = polarNeutralRef.current ?? controls.getPolarAngle();
    const neutralPalmY = rightPalmNeutralRef.current ?? s.userRight.palmY;
    const palmOffsetY = s.userRight.palmY - neutralPalmY;
    const targetPolar =
      neutralPolar + palmOffsetY * HAND_STEER_POLAR_PALM_GAIN;

    if (smoothedPolarRef.current == null) {
      smoothedPolarRef.current = controls.getPolarAngle();
    }
    smoothedPolarRef.current = THREE.MathUtils.lerp(
      smoothedPolarRef.current,
      THREE.MathUtils.clamp(targetPolar, minPolarAngle, maxPolarAngle),
      HAND_STEER_POLAR_SMOOTH,
    );
    controls.setPolarAngle(smoothedPolarRef.current);

    const neutralSpan = spanNeutralRef.current ?? s.handsSpan;
    const neutralAz = azimuthNeutralRef.current ?? controls.getAzimuthalAngle();
    const spanOffset = neutralSpan - s.handsSpan;
    const targetAzimuth = neutralAz + spanOffset * HAND_STEER_AZIMUTH_SPAN_GAIN;

    if (smoothedAzimuthRef.current == null) {
      smoothedAzimuthRef.current = controls.getAzimuthalAngle();
    }
    smoothedAzimuthRef.current = THREE.MathUtils.lerp(
      smoothedAzimuthRef.current,
      targetAzimuth,
      HAND_STEER_AZIMUTH_SMOOTH,
    );
    controls.setAzimuthalAngle(smoothedAzimuthRef.current);

    controls.update();
  });

  return null;
}
