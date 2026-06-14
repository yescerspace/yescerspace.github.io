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

/** Kamera açıldıktan sonra yanlış 👌 algısına karşı bekleme. */
const CAMERA_ARM_MS = 800;
/** ☝️ hover → 👌 geçişi için bellek. */
const INDEX_HOVER_MEMORY_MS = 1800;
/** 👌 en az bu kadar kare tutulmalı. */
const OK_PICK_HOLD_FRAMES = 6;

function aimForIndexUp(
  pointerActive: boolean,
  pointerX: number,
  pointerY: number,
  left: PhysicalHandState,
  right: PhysicalHandState,
): { x: number; y: number } | null {
  if (pointerActive) return { x: pointerX, y: pointerY };
  if (right.detected && right.gesture === "indexUp") {
    return { x: right.pointerX, y: right.pointerY };
  }
  if (left.detected && left.gesture === "indexUp") {
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

/** ☝️ imleç + 👌 seçim */
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
  const lastIndexHoverRef = useRef<{ index: number; at: number } | null>(null);
  const okHoldFramesRef = useRef(0);
  const okPickLockedRef = useRef(false);
  const enabledSinceRef = useRef(0);
  const wasEnabledRef = useRef(false);

  hoveredRef.current = hoveredIndex;

  useFrame(() => {
    if (!hand?.enabled) {
      okHoldFramesRef.current = 0;
      okPickLockedRef.current = false;
      wasEnabledRef.current = false;
      lastIndexHoverRef.current = null;
      return;
    }

    const now = performance.now();

    if (!wasEnabledRef.current) {
      wasEnabledRef.current = true;
      enabledSinceRef.current = now;
      okHoldFramesRef.current = 0;
      okPickLockedRef.current = false;
      lastIndexHoverRef.current = null;
      if (hoveredRef.current !== null) {
        setHoveredIndex(null);
        hoveredRef.current = null;
      }
    }

    if (modalOpen) {
      if (hoveredRef.current !== null) setHoveredIndex(null);
      okHoldFramesRef.current = 0;
      okPickLockedRef.current = false;
      lastIndexHoverRef.current = null;
      return;
    }

    const s = hand.sampleRef.current;
    const indexAim = aimForIndexUp(
      s.pointerActive,
      s.pointerX,
      s.pointerY,
      s.userLeft,
      s.userRight,
    );
    const okSign =
      s.userRight.gesture === "okSign" || s.userLeft.gesture === "okSign";
    const indexHoverFresh =
      lastIndexHoverRef.current != null &&
      now - lastIndexHoverRef.current.at < INDEX_HOVER_MEMORY_MS;

    if (indexAim) {
      const nextHover = raycastGalleryIndex(
        indexAim.x,
        indexAim.y,
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
        lastIndexHoverRef.current = { index: nextHover, at: now };
      }
    } else if (okSign && indexHoverFresh) {
      // ☝️ → 👌 geçişinde hover’ı koru; yeni raycast yapma.
    } else if (hoveredRef.current !== null) {
      setHoveredIndex(null);
      hoveredRef.current = null;
    }

    if (!okSign) {
      okHoldFramesRef.current = 0;
      okPickLockedRef.current = false;
      return;
    }

    okHoldFramesRef.current += 1;

    const armed = now - enabledSinceRef.current >= CAMERA_ARM_MS;
    if (
      armed &&
      !okPickLockedRef.current &&
      okHoldFramesRef.current >= OK_PICK_HOLD_FRAMES &&
      indexHoverFresh
    ) {
      const pickIndex =
        hoveredRef.current ?? lastIndexHoverRef.current?.index ?? null;
      if (pickPlanet(pickIndex, images, onPick)) {
        okPickLockedRef.current = true;
      }
    }
  });

  return null;
}
