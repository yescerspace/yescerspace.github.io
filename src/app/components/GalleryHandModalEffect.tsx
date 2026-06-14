import { useEffect, useRef, type MutableRefObject } from "react";
import { useGalleryHandControl } from "./galleryHandControl";

type GalleryHandModalEffectProps = {
  modalOpen: boolean;
  onCloseModal: () => void;
  outerScrollRef: MutableRefObject<HTMLDivElement | null>;
  innerScrollRef: MutableRefObject<HTMLDivElement | null>;
};

function applyDetailHandScroll(
  delta: number,
  outer: HTMLDivElement | null,
  inner: HTMLDivElement | null,
): void {
  if (delta === 0) return;

  const tryInner = (): boolean => {
    if (!inner) return false;
    const overflows = inner.scrollHeight > inner.clientHeight + 1;
    if (!overflows) return false;
    const atTop = inner.scrollTop <= 0.5;
    const atBottom =
      inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 0.5;
    if (delta > 0 && !atBottom) {
      inner.scrollTop += delta;
      inner.dispatchEvent(new Event("scroll", { bubbles: true }));
      return true;
    }
    if (delta < 0 && !atTop) {
      inner.scrollTop += delta;
      inner.dispatchEvent(new Event("scroll", { bubbles: true }));
      return true;
    }
    return false;
  };

  if (!tryInner() && outer) {
    outer.scrollTop += delta;
    outer.dispatchEvent(new Event("scroll", { bubbles: true }));
  }
}

/** ✋ ↕️ detay kaydır · ✊ kapat */
export function GalleryHandModalEffect({
  modalOpen,
  onCloseModal,
  outerScrollRef,
  innerScrollRef,
}: GalleryHandModalEffectProps) {
  const hand = useGalleryHandControl();
  const lastFrameMsRef = useRef(0);

  useEffect(() => {
    if (!hand?.enabled || !modalOpen) return;

    let raf = 0;
    const tick = (now: number) => {
      const sample = hand.sampleRef.current;
      if (sample.closePulse) {
        onCloseModal();
      }

      const last = lastFrameMsRef.current || now;
      const dt = Math.min(0.05, (now - last) / 1000);
      lastFrameMsRef.current = now;

      const velocity = sample.detailScrollVelocity;
      if (Math.abs(velocity) > 0.006) {
        const delta = velocity * dt * 680;
        applyDetailHandScroll(
          delta,
          outerScrollRef.current,
          innerScrollRef.current,
        );
      }

      raf = requestAnimationFrame(tick);
    };

    lastFrameMsRef.current = performance.now();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hand, modalOpen, onCloseModal, outerScrollRef, innerScrollRef]);

  return null;
}
