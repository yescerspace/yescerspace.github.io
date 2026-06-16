import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GalleryImage } from "./Gallery3D";
import { useGalleryHandControl } from "./galleryHandControl";
import {
  playGalleryClickSound,
  primeGalleryAudioEngineFromUserGesture,
} from "../utils/galleryHoverSfx";
import { prefetchDetailModalMedia } from "../utils/galleryMedia";
import { aimFromHandSample, pinchAimFromHandSample } from "../utils/handAim";

type GalleryHandPointerBridgeProps = {
  modalOpen: boolean;
  images: GalleryImage[];
  visibleIndices: number[];
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
  onPick: (image: GalleryImage) => void;
};

const HOVER_MEMORY_MS = 1800;

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

/** ☝️ hover + 🤏 pinch seçim (başparmak + işaret teması, onaylı) */
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
  const pickLockedRef = useRef(false);
  const wasEnabledRef = useRef(false);

  hoveredRef.current = hoveredIndex;

  useFrame(() => {
    if (!hand?.enabled) {
      pickLockedRef.current = false;
      wasEnabledRef.current = false;
      lastHoverRef.current = null;
      return;
    }

    if (!wasEnabledRef.current) {
      wasEnabledRef.current = true;
      pickLockedRef.current = false;
      lastHoverRef.current = null;
      if (hoveredRef.current !== null) {
        setHoveredIndex(null);
        hoveredRef.current = null;
      }
    }

    if (modalOpen) {
      if (hoveredRef.current !== null) setHoveredIndex(null);
      pickLockedRef.current = false;
      lastHoverRef.current = null;
      return;
    }

    const s = hand.sampleRef.current;
    const now = performance.now();
    const aim = aimFromHandSample(
      s.pointerActive,
      s.pointerX,
      s.pointerY,
      s.userLeft,
      s.userRight,
    );
    const hoverMemory =
      lastHoverRef.current &&
      now - lastHoverRef.current.at < HOVER_MEMORY_MS
        ? lastHoverRef.current.index
        : null;

    const pinching =
      s.userRight.gesture === "pinch" || s.userLeft.gesture === "pinch";

    if (aim && s.pointerActive) {
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
    } else if ((pinching || s.selectPulse) && hoverMemory != null) {
      // ☝️ → 🤏 geçişinde hover korunur.
    } else if (hoveredRef.current !== null) {
      setHoveredIndex(null);
      hoveredRef.current = null;
    }

    if (!s.selectPulse) {
      pickLockedRef.current = false;
    } else if (!pickLockedRef.current) {
      const pickAim =
        pinchAimFromHandSample(s.userLeft, s.userRight) ??
        aim ??
        (hoverMemory != null && lastHoverRef.current
          ? {
              x: s.pointerX,
              y: s.pointerY,
            }
          : null);
      if (pickAim) {
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
          pickLockedRef.current = true;
        }
      }
    }
  });

  return null;
}
