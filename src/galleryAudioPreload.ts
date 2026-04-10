/**
 * React ana paketinden bağımsız, mümkün olan en erken anda çalışır:
 * galeri hover SFX fetch + decode ile ana thread’deki ağır işlerle yarışır.
 */
import { preloadGalleryHoverSfx } from "./app/utils/galleryHoverSfx";

preloadGalleryHoverSfx();
