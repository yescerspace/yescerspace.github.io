import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as StdOrbitControls } from "three-stdlib";
import { HAND_ZOOM_ANIM_SMOOTH, useGalleryHandControl } from "./galleryHandControl";
import { setOrbitDistance } from "./GalleryOrbitWheelSmooth";

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

/**
 * ✊ → zoom in
 * 🖐️ → zoom out
 * 🖐️ yukarı → başlangıç kadrajı
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
    const zoomInTarget = THREE.MathUtils.lerp(
      minDistance,
      defaultDistance,
      0.22,
    );

    if (s.fistHeld) {
      targetRef.current = {
        distance: zoomInTarget,
        azimuth: controls.getAzimuthalAngle(),
        polar: controls.getPolarAngle(),
      };
    } else if (s.openPalmHeld && s.mode !== "rotate") {
      targetRef.current = {
        distance: maxDistance,
        azimuth: controls.getAzimuthalAngle(),
        polar: controls.getPolarAngle(),
      };
    } else if (s.zoomInPulse && now - lastPulseMsRef.current > 350) {
      targetRef.current = {
        distance: zoomInTarget,
        azimuth: controls.getAzimuthalAngle(),
        polar: controls.getPolarAngle(),
      };
      lastPulseMsRef.current = now;
    } else if (s.zoomOutPulse && now - lastPulseMsRef.current > 350) {
      targetRef.current = {
        distance: maxDistance,
        azimuth: 0,
        polar: defaultPolar,
      };
      lastPulseMsRef.current = now;
    } else if (s.resetZoomPulse && now - lastPulseMsRef.current > 350) {
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

    const held = s.fistHeld || s.openPalmHeld;
    const smooth = held ? HAND_ZOOM_ANIM_SMOOTH * 1.3 : HAND_ZOOM_ANIM_SMOOTH;
    const nextDist = THREE.MathUtils.lerp(curDist, target.distance, smooth);
    const nextAz = THREE.MathUtils.lerp(curAz, target.azimuth, smooth);
    const nextPol = THREE.MathUtils.lerp(curPol, target.polar, smooth);

    setOrbitDistance(controls, nextDist);
    controls.setAzimuthalAngle(nextAz);
    controls.setPolarAngle(nextPol);
    controls.update();

    const done =
      !held &&
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
