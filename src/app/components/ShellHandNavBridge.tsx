import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import { useGalleryHandControl } from "./galleryHandControl";
import {
  playGalleryClickSound,
  primeGalleryAudioEngineFromUserGesture,
} from "../utils/galleryHoverSfx";

type ShellHandNavBridgeProps = {
  active: boolean;
};

/** Alt menüye ☝️ ile nişan al + 👌 ile tıkla — sayfa değiştirme. */
const FOOTER_ZONE_Y = 0.62;
const NAV_COOLDOWN_MS = 700;

export function ShellHandNavBridge({ active }: ShellHandNavBridgeProps) {
  const hand = useGalleryHandControl();
  const navigate = useNavigate();
  const location = useLocation();

  const cursorRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const lastNavAtRef = useRef(0);
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (!hand?.enabled || !active) return;

    let raf = 0;

    const hideOverlay = () => {
      if (cursorRef.current) cursorRef.current.style.opacity = "0";
      if (ringRef.current) ringRef.current.style.opacity = "0";
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);

      const s = hand.sampleRef.current;
      const engaged =
        hand.enabled &&
        active &&
        !hand.detailModalOpen &&
        s.pointerActive &&
        s.pointerY >= FOOTER_ZONE_Y;

      if (!engaged) {
        hideOverlay();
        return;
      }

      const x = s.pointerX * window.innerWidth;
      const y = s.pointerY * window.innerHeight;

      const cursor = cursorRef.current;
      if (cursor) {
        cursor.style.opacity = "1";
        cursor.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      }

      const links = Array.from(
        document.querySelectorAll<HTMLElement>("[data-hand-nav]"),
      );
      let best: HTMLElement | null = null;
      let bestDist = Infinity;
      for (const el of links) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cx = r.left + r.width / 2;
        const d = Math.abs(cx - x);
        if (d < bestDist) {
          bestDist = d;
          best = el;
        }
      }

      const ring = ringRef.current;
      if (best && ring) {
        const r = best.getBoundingClientRect();
        ring.style.opacity = "1";
        ring.style.left = `${r.left - 12}px`;
        ring.style.top = `${r.top - 7}px`;
        ring.style.width = `${r.width + 24}px`;
        ring.style.height = `${r.height + 14}px`;
      } else if (ring) {
        ring.style.opacity = "0";
      }

      const now = performance.now();
      if (
        s.selectPulse &&
        best &&
        now - lastNavAtRef.current > NAV_COOLDOWN_MS
      ) {
        const target = best.getAttribute("data-hand-nav");
        if (target && target !== pathRef.current) {
          lastNavAtRef.current = now;
          primeGalleryAudioEngineFromUserGesture();
          playGalleryClickSound();
          hand.setHintOpen(false);
          navigate(target);
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      hideOverlay();
    };
  }, [active, hand, navigate]);

  if (!hand?.enabled || !active) return null;

  return createPortal(
    <>
      <div
        ref={ringRef}
        className="pointer-events-none fixed left-0 top-0 z-[99997] rounded-full border-2 border-[#007FFF] bg-[#007FFF]/15 opacity-0 transition-opacity duration-150"
        aria-hidden
      />
      <div
        ref={cursorRef}
        className="pointer-events-none fixed left-0 top-0 z-[99998] opacity-0"
        aria-hidden
      >
        <span className="block h-4 w-4 rounded-full border-2 border-[#007FFF] bg-white/90 shadow-[0_0_8px_rgba(0,127,255,0.6)]" />
      </div>
    </>,
    document.body,
  );
}
