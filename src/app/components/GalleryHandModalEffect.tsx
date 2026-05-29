import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import {
  HAND_DETAIL_SCROLL_PALM_GAIN,
  HAND_DETAIL_SCROLL_SMOOTH,
  useGalleryHandControl,
} from "./galleryHandControl";
type GalleryHandModalEffectProps = {
  modalOpen: boolean;
  scrollRef: MutableRefObject<HTMLDivElement | null>;
  onCloseModal: () => void;
};

/**
 * Proje detay:
 * - Sağ el 5 parmak açık, yukarı/aşağı → içerik kaydır
 * - Sol el yumruk → kapat
 */
export function GalleryHandModalEffect({
  modalOpen,
  scrollRef,
  onCloseModal,
}: GalleryHandModalEffectProps) {
  const hand = useGalleryHandControl();
  const scrollNeutralRef = useRef(0);
  const rightPalmNeutralRef = useRef<number | null>(null);
  const smoothedScrollRef = useRef<number | null>(null);
  const wasDetailRef = useRef(false);

  useEffect(() => {
    if (!hand?.enabled || !modalOpen) {
      wasDetailRef.current = false;
      rightPalmNeutralRef.current = null;
      smoothedScrollRef.current = null;
      return;
    }

    let raf = 0;
    const tick = () => {
      const s = hand.sampleRef.current;

      if (s.closePulse) {
        onCloseModal();
        raf = requestAnimationFrame(tick);
        return;
      }

      if (s.mode !== "detail") {
        wasDetailRef.current = false;
        rightPalmNeutralRef.current = null;
        smoothedScrollRef.current = null;
        raf = requestAnimationFrame(tick);
        return;
      }

      const el = scrollRef.current;
      const rightOpen = s.userRight.gesture === "open";

      if (!el || !rightOpen) {
        raf = requestAnimationFrame(tick);
        return;
      }

      if (!wasDetailRef.current) {
        scrollNeutralRef.current = el.scrollTop;
        rightPalmNeutralRef.current = s.userRight.palmY;
        smoothedScrollRef.current = el.scrollTop;
        wasDetailRef.current = true;
      }

      const neutralY = rightPalmNeutralRef.current ?? s.userRight.palmY;
      const palmOffsetY = s.userRight.palmY - neutralY;
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const targetScroll = Math.min(
        maxScroll,
        Math.max(0, scrollNeutralRef.current + palmOffsetY * HAND_DETAIL_SCROLL_PALM_GAIN),
      );

      if (smoothedScrollRef.current == null) {
        smoothedScrollRef.current = el.scrollTop;
      }
      smoothedScrollRef.current +=
        (targetScroll - smoothedScrollRef.current) * HAND_DETAIL_SCROLL_SMOOTH;
      el.scrollTop = smoothedScrollRef.current;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hand, modalOpen, scrollRef, onCloseModal]);

  return null;
}
