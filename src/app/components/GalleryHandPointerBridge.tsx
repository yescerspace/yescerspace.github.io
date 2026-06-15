import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GalleryImage } from "./Gallery3D";
import { useGalleryHandControl } from "./galleryHandControl";
import type { PhysicalHandState } from "./galleryHandControl";
import {
  playGalleryClickSound,
  primeGalleryAudioEngineFromUserGesture,
} from "../utils/galleryHoverSfx";
import { prefetchDetailModalMedia } from "../utils/galleryMedia";

type GalleryHandPointerBridgeProps = {
  modalOpen: boolean;
  images: GalleryImage[];
  visibleIndices: number[];
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
  onPick: (image: GalleryImage) => void;
};

const HOVER_MEMORY_MS = 1800;
const OK_PICK_HOLD_FRAMES = 3;

function aimFromSample(
  pointerActive: boolean,
  pointerX: number,
  pointerY: number,
  left: PhysicalHandState,
  right: PhysicalHandState,
): { x: number; y: number } | null {
  if (pointerActive) return { x: pointerX, y: pointerY };
  if (right.detected && right.gesture === "okSign") {
    return { x: right.pointerX, y: right.pointerY };
  }
  if (left.detected && left.gesture === "okSign") {
    return { x: left.pointerX, y: left.pointerY };
  }
  if (right.detected && right.gesture === "indexUp") {
    return { x: right.pointerX, y: right.pointerY };
  }
  if (left.detected && left.gesture === "indexUp") {
    return { x: left.pointerX, y: left.pointerY };
  }
  return null;
}

function okAimFromSample(
  left: PhysicalHandState,
  right: PhysicalHandState,
): { x: number; y: number } | null {
  if (right.detected && right.gesture === "okSign") {
    return { x: right.pointerX, y: right.pointerY };
  }
  if (left.detected && left.gesture === "okSign") {
    return { x: left.pointerX, y: left.pointerY };
  }
  return null;
}

function raycastGalleryIndex(
  x: number,
  y: number,
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  scene: THREE.Scene,
  images: GalleryImage[],
  visibleIndices: number[],
): number | null {
  const ndcX = x * 2 - 1;
  const ndcY = -(y * 2 - 1);
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

  const hits = raycaster.intersectObjects(scene.children, true);
  for (const hit of hits) {
    let obj: THREE.Object3D | null = hit.object;
    while (obj) {
      const key = obj.userData?.galleryProjectKey as string | undefined;
      if (key) {
        const idx = images.findIndex((img) => img.projectKey === key);
        if (idx >= 0 && visibleIndices.includes(idx)) return idx;
      }
      obj = obj.parent;
    }
  }
  return null;
}

function pickPlanet(
  pickIndex: number | null,
  images: GalleryImage[],
  onPick: (image: GalleryImage) => void,
): boolean {
  if (pickIndex == null) return false;
  const image = images[pickIndex];
  if (!image) return false;
  primeGalleryAudioEngineFromUserGesture();
  prefetchDetailModalMedia(image.images);
  playGalleryClickSound();
  onPick(image);
  return true;
}

function resolvePickIndex(
  hovered: number | null,
  memoryIndex: number | null,
  pickAim: { x: number; y: number },
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  scene: THREE.Scene,
  images: GalleryImage[],
  visibleIndices: number[],
): number | null {
  return (
    hovered ??
    memoryIndex ??
    raycastGalleryIndex(
      pickAim.x,
      pickAim.y,
      raycaster,
      camera,
      scene,
      images,
      visibleIndices,
    )
  );
}

/** ☝️ hover + 👌 seçim */
export function GalleryHandPointerBridge({
  modalOpen,
  images,
  visibleIndices,
  hoveredIndex,
  setHoveredIndex,
  onPick,
}: GalleryHandPointerBridgeProps) {
  const hand = useGalleryHandControl();
  const { camera, scene, raycaster } = useThree();
  const hoveredRef = useRef(hoveredIndex);
  const lastHoverRef = useRef<{ index: number; at: number } | null>(null);
  const okHoldFramesRef = useRef(0);
  const okPickLockedRef = useRef(false);
  const wasOkSignRef = useRef(false);
  const wasEnabledRef = useRef(false);

  hoveredRef.current = hoveredIndex;

  useFrame(() => {
    if (!hand?.enabled) {
      okHoldFramesRef.current = 0;
      okPickLockedRef.current = false;
      wasOkSignRef.current = false;
      wasEnabledRef.current = false;
      lastHoverRef.current = null;
      return;
    }

    if (!wasEnabledRef.current) {
      wasEnabledRef.current = true;
      okHoldFramesRef.current = 0;
      okPickLockedRef.current = false;
      wasOkSignRef.current = false;
      lastHoverRef.current = null;
      if (hoveredRef.current !== null) {
        setHoveredIndex(null);
        hoveredRef.current = null;
      }
    }

    if (modalOpen) {
      if (hoveredRef.current !== null) setHoveredIndex(null);
      okHoldFramesRef.current = 0;
      okPickLockedRef.current = false;
      wasOkSignRef.current = false;
      lastHoverRef.current = null;
      return;
    }

    const s = hand.sampleRef.current;
    const now = performance.now();
    const aim = aimFromSample(
      s.pointerActive,
      s.pointerX,
      s.pointerY,
      s.userLeft,
      s.userRight,
    );
    const okSign =
      s.userRight.gesture === "okSign" ||
      s.userLeft.gesture === "okSign" ||
      s.selectPulse;
    const hoverMemory =
      lastHoverRef.current &&
      now - lastHoverRef.current.at < HOVER_MEMORY_MS
        ? lastHoverRef.current.index
        : null;

    if (aim) {
      const nextHover = raycastGalleryIndex(
        aim.x,
        aim.y,
        raycaster,
        camera,
        scene,
        images,
        visibleIndices,
      );
      if (nextHover !== hoveredRef.current) {
        setHoveredIndex(nextHover);
        hoveredRef.current = nextHover;
      }
      if (nextHover != null) {
        lastHoverRef.current = { index: nextHover, at: now };
      }
    } else if (okSign && hoverMemory != null) {
      // ☝️ → 👌 geçişinde hover korunur.
    } else if (hoveredRef.current !== null) {
      setHoveredIndex(null);
      hoveredRef.current = null;
    }

    const tryPick = (pickAim: { x: number; y: number } | null) => {
      if (okPickLockedRef.current || !pickAim) return false;
      const pickIndex = resolvePickIndex(
        hoveredRef.current,
        hoverMemory,
        pickAim,
        raycaster,
        camera,
        scene,
        images,
        visibleIndices,
      );
      if (pickPlanet(pickIndex, images, onPick)) {
        okPickLockedRef.current = true;
        return true;
      }
      return false;
    };

    if (!okSign) {
      okHoldFramesRef.current = 0;
      okPickLockedRef.current = false;
    } else {
      okHoldFramesRef.current += 1;
      const pickAim = aim ?? okAimFromSample(s.userLeft, s.userRight);
      if (
        !okPickLockedRef.current &&
        okHoldFramesRef.current >= OK_PICK_HOLD_FRAMES
      ) {
        tryPick(pickAim);
      }
    }

    if (okSign && !wasOkSignRef.current && !okPickLockedRef.current) {
      const pickAim = aim ?? okAimFromSample(s.userLeft, s.userRight);
      tryPick(pickAim);
    }

    wasOkSignRef.current = okSign;
  });

  return null;
}
