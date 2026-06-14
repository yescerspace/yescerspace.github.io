import { useEffect } from "react";
import { useGalleryHandControl } from "./galleryHandControl";

type GalleryHandModalEffectProps = {
  modalOpen: boolean;
  onCloseModal: () => void;
};

/** 🫳 Avuç aşağı → proje detayını kapat. */
export function GalleryHandModalEffect({
  modalOpen,
  onCloseModal,
}: GalleryHandModalEffectProps) {
  const hand = useGalleryHandControl();

  useEffect(() => {
    if (!hand?.enabled || !modalOpen) return;

    let raf = 0;
    const tick = () => {
      if (hand.sampleRef.current.closePulse) {
        onCloseModal();
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hand, modalOpen, onCloseModal]);

  return null;
}
