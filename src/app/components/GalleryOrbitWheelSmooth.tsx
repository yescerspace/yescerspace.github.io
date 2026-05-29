import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as StdOrbitControls } from "three-stdlib";

/** Pixel delta — LINE (mouse wheel) / PAGE normalized like OrbitControls. */
function normalizeWheelDeltaY(e: WheelEvent): number {
  let dy = e.deltaY;
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    dy *= 16;
  } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    dy *= Math.min(window.innerHeight, 800);
  }
  return dy;
}

/** Discrete mouse notch vs trackpad pixel stream. */
function isDiscreteWheelStep(e: WheelEvent, dyPx: number): boolean {
  return (
    e.deltaMode === WheelEvent.DOM_DELTA_LINE ||
    e.deltaMode === WheelEvent.DOM_DELTA_PAGE ||
    Math.abs(dyPx) > 48
  );
}

export function setOrbitDistance(
  controls: StdOrbitControls,
  distance: number,
): void {
  const offset = new THREE.Vector3()
    .subVectors(controls.object.position, controls.target)
    .normalize()
    .multiplyScalar(distance);
  controls.object.position.copy(controls.target).add(offset);
  controls.update();
}

type GalleryOrbitWheelSmoothProps = {
  orbitControlsRef: MutableRefObject<StdOrbitControls | null>;
  enabled: boolean;
  minDistance: number;
  maxDistance: number;
  zoomSpeed: number;
};

/** Smooths chunky mouse-wheel zoom; trackpad pixel wheels still use OrbitControls. */
const WHEEL_CATCHUP_RATE = 16;
const WHEEL_ZOOM_SCALE = 0.00032;

export function GalleryOrbitWheelSmooth({
  orbitControlsRef,
  enabled,
  minDistance,
  maxDistance,
  zoomSpeed,
}: GalleryOrbitWheelSmoothProps) {
  const pendingPxRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      pendingPxRef.current = 0;
      return;
    }

    let el: HTMLElement | null = null;
    let onWheel: ((e: WheelEvent) => void) | null = null;
    let cancelled = false;

    const attach = () => {
      if (cancelled) return;
      const controls = orbitControlsRef.current;
      if (!controls) {
        requestAnimationFrame(attach);
        return;
      }
      const dom = controls.domElement;
      if (!dom) return;
      el = dom;

      onWheel = (e: WheelEvent) => {
        if (!enabled) return;
        const dyPx = normalizeWheelDeltaY(e);
        if (!isDiscreteWheelStep(e, dyPx)) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        pendingPxRef.current += THREE.MathUtils.clamp(dyPx, -140, 140);
      };

      dom.addEventListener("wheel", onWheel, { passive: false, capture: true });
    };

    attach();

    return () => {
      cancelled = true;
      pendingPxRef.current = 0;
      if (el && onWheel) {
        el.removeEventListener("wheel", onWheel, true);
      }
    };
  }, [enabled, orbitControlsRef]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const controls = orbitControlsRef.current;
    if (!controls) return;

    let pending = pendingPxRef.current;
    if (Math.abs(pending) < 0.25) return;

    const step = pending * Math.min(1, delta * WHEEL_CATCHUP_RATE);
    pendingPxRef.current = pending - step;

    const dist = controls.getDistance();
    const scale = Math.exp(step * WHEEL_ZOOM_SCALE * zoomSpeed * 5);
    const next = THREE.MathUtils.clamp(dist * scale, minDistance, maxDistance);
    setOrbitDistance(controls, next);
  });

  return null;
}
