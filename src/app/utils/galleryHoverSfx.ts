import galleryHoverSfx1Url from "../assets/gallery-hover-1.mp3?url";
import galleryHoverSfx2Url from "../assets/gallery-hover-2.mp3?url";
import galleryHoverSfx3Url from "../assets/gallery-hover-3.mp3?url";

/**
 * Zirve gain (0–1). Çalma anında uygulanır — ham tamponlar önbellekte; değiştirmek **hemen** etkiler (sayfayı yenile).
 * Düşük tutuldu; üstüne attack/release + low-pass ile yumuşak net ses.
 */
export const GALLERY_HOVER_SFX_VOLUME = 0.045;

/** Son çalınan tampon indeksi — arka arkaya aynı klip daha seyrek seçilir. */
let lastHoverBufferIndex = -1;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickHoverBufferIndex(count: number): number {
  if (count <= 1) return 0;
  const candidates = Array.from({ length: count }, (_, i) => i).filter(
    (i) => i !== lastHoverBufferIndex,
  );
  const idx =
    candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
  lastHoverBufferIndex = idx;
  return idx;
}

const HOVER_SFX_URLS = [
  galleryHoverSfx1Url,
  galleryHoverSfx2Url,
  galleryHoverSfx3Url,
] as const;

let preloadHintsInjected = false;

/** Tarayıcıya MP3’leri erken indirme ipucu — fetch ile aynı URL’ye hizalanır. */
function injectGalleryHoverSfxPreloadHints(): void {
  if (typeof document === "undefined" || preloadHintsInjected) return;
  preloadHintsInjected = true;
  const head = document.head;
  if (!head) return;
  for (const url of HOVER_SFX_URLS) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "fetch";
    link.href = url;
    link.setAttribute("data-gallery-hover-sfx-preload", "");
    head.appendChild(link);
  }
}

const inflightArrayBuffers: Promise<ArrayBuffer[]> =
  typeof window === "undefined"
    ? Promise.resolve([])
    : Promise.all(
        HOVER_SFX_URLS.map((url) =>
          fetch(url).then((r) => {
            if (!r.ok) throw new Error(`SFX ${r.status}`);
            return r.arrayBuffer();
          }),
        ),
      ).catch(() => [] as ArrayBuffer[]);

let audioContext: AudioContext | null = null;
/** Ham decode — ses seviyesi buraya gömülmez. */
let decodedBuffers: AudioBuffer[] | null = null;
let decodePromise: Promise<void> | null = null;
let contextUnlockWired = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext) return audioContext;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioContext = new Ctor();
    return audioContext;
  } catch {
    return null;
  }
}

function wireContextUnlockOnce(): void {
  if (contextUnlockWired || typeof document === "undefined") return;
  contextUnlockWired = true;
  const unlock = () => {
    const c = audioContext;
    if (c?.state === "suspended") {
      void c.resume();
    }
  };
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("keydown", unlock, { passive: true });
  /** İlk etkileşim sadece hover ise (tıklamadan) ses yine de uyansın. */
  document.addEventListener("pointermove", unlock, { passive: true, once: true });
}

async function decodeAllBuffers(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;

  const abs = await inflightArrayBuffers;
  if (abs.length !== HOVER_SFX_URLS.length) return;

  decodedBuffers = await Promise.all(
    abs.map((ab) => ctx.decodeAudioData(ab.slice(0))),
  );
}

export function preloadGalleryHoverSfx(): void {
  if (typeof window === "undefined") return;
  injectGalleryHoverSfxPreloadHints();
  wireContextUnlockOnce();
  if (decodedBuffers?.length === HOVER_SFX_URLS.length) return;
  if (!decodePromise) {
    decodePromise = decodeAllBuffers().catch(() => {
      decodePromise = null;
    });
  }
}

function connectGentleHoverChain(
  ctx: AudioContext,
  source: AudioBufferSourceNode,
): void {
  const buf = source.buffer;
  if (!buf) return;

  const rate = randomBetween(0.92, 1.1);
  source.playbackRate.value = rate;

  const peak =
    Math.max(0.0001, GALLERY_HOVER_SFX_VOLUME) * randomBetween(0.72, 1.18);

  const t0 = ctx.currentTime;
  const duration = buf.duration / rate;

  const attackBase = Math.min(0.045, Math.max(0.012, duration * 0.22));
  const releaseBase = Math.min(0.16, Math.max(0.04, duration * 0.38));
  const attackSec = attackBase * randomBetween(0.78, 1.22);
  const releaseSec = releaseBase * randomBetween(0.8, 1.2);
  const releaseStart = Math.max(t0 + attackSec + 0.002, t0 + duration - releaseSec);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = randomBetween(2000, 3600);
  filter.Q.value = randomBetween(0.5, 0.92);

  const panner = ctx.createStereoPanner();
  panner.pan.value = randomBetween(-0.28, 0.28);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + attackSec);
  gain.gain.linearRampToValueAtTime(peak, releaseStart);
  gain.gain.linearRampToValueAtTime(0, t0 + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);
}

async function playChimeAsync(): Promise<void> {
  preloadGalleryHoverSfx();
  if (decodePromise) {
    await decodePromise;
  }
  const ctx = getAudioContext();
  const buffers = decodedBuffers;
  if (!ctx || !buffers?.length) return;

  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => {});
  }

  const buf = buffers[pickHoverBufferIndex(buffers.length)]!;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  connectGentleHoverChain(ctx, src);
  src.start(0);
}

export function playGalleryHoverChime(): void {
  void playChimeAsync().catch(() => {});
}
