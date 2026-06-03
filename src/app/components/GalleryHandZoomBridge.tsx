import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as StdOrbitControls } from "three-stdlib";
import { HAND_ZOOM_ANIM_SMOOTH, useGalleryHandControl } from "./galleryHandControl";

type OrbitSnapshot = {
  distance: number;
  azimuth: number;
  polar: number;
};

type GalleryHandZoomBridgeProps = {
  orbitControlsRef: MutableRefObject<StdOrbitControls | null>;
  modalOpen: boolean;
  minDistance: number;
  maxDistance: number;
  defaultDistance: number;
  defaultAzimuthRad: number;
  defaultPolarRef: MutableRefObject<number | null>;
};

import { setOrbitDistance } from "./GalleryOrbitWheelSmooth";

/**
 * 🙏 → max zoom-out + azimuth 0 (merkez)
 * Teslim ol → açılış mesafesi + varsayılan açılar
 */
export function GalleryHandZoomBridge({
  orbitControlsRef,
  modalOpen,
  minDistance,
  maxDistance,
  defaultDistance,
  defaultAzimuthRad,
  defaultPolarRef,
}: GalleryHandZoomBridgeProps) {
  const hand = useGalleryHandControl();
  const targetRef = useRef<OrbitSnapshot | null>(null);
  const lastPulseMsRef = useRef(0);

  useFrame(() => {
    const controls = orbitControlsRef.current;
    if (!controls || !hand?.enabled || modalOpen) {
      targetRef.current = null;
      if (hand) hand.sampleRef.current.orbitLocked = false;
      return;
    }

    if (defaultPolarRef.current == null) {
      defaultPolarRef.current = controls.getPolarAngle();
    }
    const defaultPolar = defaultPolarRef.current;

    const s = hand.sampleRef.current;
    const now = performance.now();

    if (s.zoomOutPulse && now - lastPulseMsRef.current > 400) {
      targetRef.current = {
        distance: maxDistance,
        azimuth: 0,
        polar: defaultPolar,
      };
      lastPulseMsRef.current = now;
    } else if (s.resetZoomPulse && now - lastPulseMsRef.current > 400) {
      targetRef.current = {
        distance: THREE.MathUtils.clamp(defaultDistance, minDistance, maxDistance),
        azimuth: defaultAzimuthRad,
        polar: defaultPolar,
      };
      lastPulseMsRef.current = now;
    }

    const target = targetRef.current;
    if (!target) {
      hand.sampleRef.current.orbitLocked = false;
      return;
    }

    hand.sampleRef.current.orbitLocked = true;

    const curDist = controls.getDistance();
    const curAz = controls.getAzimuthalAngle();
    const curPol = controls.getPolarAngle();

    const nextDist = THREE.MathUtils.lerp(curDist, target.distance, HAND_ZOOM_ANIM_SMOOTH);
    const nextAz = THREE.MathUtils.lerp(curAz, target.azimuth, HAND_ZOOM_ANIM_SMOOTH);
    const nextPol = THREE.MathUtils.lerp(curPol, target.polar, HAND_ZOOM_ANIM_SMOOTH);

    setOrbitDistance(controls, nextDist);
    controls.setAzimuthalAngle(nextAz);
    controls.setPolarAngle(nextPol);
    controls.update();

    const done =
      Math.abs(nextDist - target.distance) < 0.04 &&
      Math.abs(nextAz - target.azimuth) < 0.012 &&
      Math.abs(nextPol - target.polar) < 0.012;

    if (done) {
      setOrbitDistance(controls, target.distance);
      controls.setAzimuthalAngle(target.azimuth);
      controls.setPolarAngle(target.polar);
      controls.update();
      targetRef.current = null;
      hand.sampleRef.current.orbitLocked = false;
    }
  });

  return null;
}
