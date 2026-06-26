import galleryHoverHeartbeat1Url from "../assets/gallery-hover-heartbeat-1.wav?url";
import galleryHoverHeartbeat2Url from "../assets/gallery-hover-heartbeat-2.wav?url";
import galleryHoverHeartbeat3Url from "../assets/gallery-hover-heartbeat-3.wav?url";
import galleryClickMp3Url from "../assets/gallery-click.mp3?url";

/**
 * Zirve gain (0–1). Çalma anında uygulanır — ham tamponlar önbellekte; değiştirmek **hemen** etkiler (sayfayı yenile).
 * Düşük tutuldu; üstüne attack/release + low-pass ile yumuşak net ses.
 */
/** Hover zirve gain — tıklamadan biraz daha yüksek tutulabilir. */
const GALLERY_UI_SFX_PEAK = 0.22;

export const GALLERY_HOVER_SFX_VOLUME = GALLERY_UI_SFX_PEAK;

/** Tıklama SFX — hover’dan daha düşük. */
export const GALLERY_CLICK_SFX_VOLUME = 0.08;

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
  galleryHoverHeartbeat1Url,
  galleryHoverHeartbeat2Url,
  galleryHoverHeartbeat3Url,
] as const;

let preloadHintsInjected = false;
let clickPreloadHintInjected = false;

/** Tarayıcıya hover kliplerini erken indirme ipucu — fetch ile aynı URL’ye hizalanır. */
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

function injectGalleryClickSfxPreloadHint(): void {
  if (typeof document === "undefined" || clickPreloadHintInjected) return;
  clickPreloadHintInjected = true;
  const head = document.head;
  if (!head) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "fetch";
  link.href = galleryClickMp3Url;
  link.setAttribute("data-gallery-click-sfx-preload", "");
  head.appendChild(link);
}

/**
 * SES İNDİRME TEMBEL: modül yüklenince DEĞİL, ilk kullanıcı jestinde / tarayıcı boştayken başlar.
 * Böylece ilk sayfa açılışı ~1 MB ses indirmesiyle yarışmaz.
 */
let hoverArrayBuffersPromise: Promise<ArrayBuffer[]> | null = null;
function getHoverArrayBuffers(): Promise<ArrayBuffer[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  if (!hoverArrayBuffersPromise) {
    hoverArrayBuffersPromise = Promise.all(
      HOVER_SFX_URLS.map((url) =>
        fetch(url).then((r) => {
          if (!r.ok) throw new Error(`SFX ${r.status}`);
          return r.arrayBuffer();
        }),
      ),
    ).catch(() => [] as ArrayBuffer[]);
  }
  return hoverArrayBuffersPromise;
}

let clickArrayBufferPromise: Promise<ArrayBuffer | null> | null = null;
function getClickArrayBuffer(): Promise<ArrayBuffer | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!clickArrayBufferPromise) {
    clickArrayBufferPromise = fetch(galleryClickMp3Url)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
  }
  return clickArrayBufferPromise;
}

let decodedClickBuffer: AudioBuffer | null = null;
let clickBufferLoadPromise: Promise<AudioBuffer | null> | null = null;
let clickDecodeFailed = false;

let audioContext: AudioContext | null = null;
/** Ham decode — ses seviyesi buraya gömülmez. */
let decodedBuffers: AudioBuffer[] | null = null;
let decodePromise: Promise<void> | null = null;
let contextUnlockWired = false;
let lifecycleResumeWired = false;

function getAudioContext(): AudioContext | null {
  return audioContext;
}

/**
 * Sadece gerçek kullanıcı jesti stack’inde çağırın (pointerdown, wheel, touchstart, keydown).
 * Sayfa yükünde `new AudioContext()` yapmak sürekli suspended bağlam üretir; hover ile düzelmez.
 */
function ensureAudioContextCreatedInUserGesture(): AudioContext | null {
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

function queueHoverDecodeIfNeeded(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (decodedBuffers?.length === HOVER_SFX_URLS.length) return;
  if (!decodePromise) {
    decodePromise = decodeAllBuffers().catch(() => {
      decodePromise = null;
    });
  }
}

/**
 * İlk jestte (tıklama, tekerlek, dokunma, tuş) bağlamı oluşturur ve decode kuyruğunu başlatır.
 * Kart `pointerdown` ile de çağrılır — sürüklemeden önce bile jest sayılır.
 */
export function primeGalleryAudioEngineFromUserGesture(): void {
  preloadGalleryHoverSfx();
  const ctx = ensureAudioContextCreatedInUserGesture();
  if (!ctx) return;
  void ctx.resume().catch(() => {});
  queueHoverDecodeIfNeeded();
  ensureClickBufferDecodeStarted();
}

function wireContextUnlockOnce(): void {
  if (contextUnlockWired || typeof document === "undefined") return;
  contextUnlockWired = true;
  const unlock = () => {
    primeGalleryAudioEngineFromUserGesture();
  };
  /**
   * capture: true + window: R3F / OrbitControls / kart stopPropagation yapsa bile
   * jest yakalanır; aksi halde ilk sürükleme/tıklama document’e hiç ulaşmıyordu.
   */
  const opts = { passive: true, capture: true } as const;
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("touchstart", unlock, opts);
  window.addEventListener("keydown", unlock, opts);
  window.addEventListener("wheel", unlock, opts);
}

function wireLifecycleResumeBestEffort(): void {
  if (lifecycleResumeWired || typeof window === "undefined") return;
  lifecycleResumeWired = true;
  const tryResume = () => {
    const c = audioContext;
    if (c?.state === "suspended") void c.resume().catch(() => {});
  };
  window.addEventListener("pageshow", tryResume, { passive: true });
  window.addEventListener("focus", tryResume, { passive: true });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "visible") tryResume();
    },
    { passive: true },
  );
}

async function decodeAllBuffers(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;

  const abs = await getHoverArrayBuffers();
  if (abs.length !== HOVER_SFX_URLS.length) return;

  decodedBuffers = await Promise.all(
    abs.map((ab) => ctx.decodeAudioData(ab.slice(0))),
  );
}

let warmupScheduled = false;
/** İndirme ipuçları + arka plan fetch'i tarayıcı boştayken başlat (içerikle yarışmasın). */
function scheduleAudioWarmup(): void {
  if (warmupScheduled || typeof window === "undefined") return;
  warmupScheduled = true;
  const warm = () => {
    injectGalleryHoverSfxPreloadHints();
    injectGalleryClickSfxPreloadHint();
    void getHoverArrayBuffers();
    void getClickArrayBuffer();
  };
  const ric = (
    window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") ric(warm, { timeout: 3000 });
  else setTimeout(warm, 1500);
}

export function preloadGalleryHoverSfx(): void {
  if (typeof window === "undefined") return;
  wireContextUnlockOnce();
  wireLifecycleResumeBestEffort();
  scheduleAudioWarmup();
  const ctx = getAudioContext();
  if (ctx) {
    queueHoverDecodeIfNeeded();
    ensureClickBufferDecodeStarted();
  }
}

function ensureClickBufferDecodeStarted(): void {
  if (decodedClickBuffer || clickBufferLoadPromise || clickDecodeFailed) return;
  if (!getAudioContext()) return;
  clickBufferLoadPromise = loadDecodedClickBuffer().finally(() => {
    clickBufferLoadPromise = null;
  });
}

async function loadDecodedClickBuffer(): Promise<AudioBuffer | null> {
  if (decodedClickBuffer) return decodedClickBuffer;
  const ctx = getAudioContext();
  if (!ctx) {
    return null;
  }
  const ab = await getClickArrayBuffer();
  if (!ab) {
    clickDecodeFailed = true;
    return null;
  }
  try {
    decodedClickBuffer = await ctx.decodeAudioData(ab.slice(0));
    return decodedClickBuffer;
  } catch {
    clickDecodeFailed = true;
    return null;
  }
}

async function getDecodedClickBuffer(): Promise<AudioBuffer | null> {
  if (decodedClickBuffer) return decodedClickBuffer;
  if (clickDecodeFailed) return null;
  ensureClickBufferDecodeStarted();
  if (clickBufferLoadPromise) {
    return clickBufferLoadPromise.then(() => decodedClickBuffer);
  }
  return loadDecodedClickBuffer();
}

/**
 * Pointer olayı ile aynı senkron stack’te çağrılmalı (ör. kart `pointerover`).
 * Ses `useFrame` ile gecikmeli tetiklenince tarayıcı jest zinciri kopar; bu yüzden burada `resume` gerekir.
 */
export function wakeGalleryHoverAudioFromUserGesture(): void {
  preloadGalleryHoverSfx();
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
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
    Math.max(0.0001, GALLERY_HOVER_SFX_VOLUME) * randomBetween(0.88, 1.06);

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
  if (!getAudioContext()) return;
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
  preloadGalleryHoverSfx();
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  void playChimeAsync().catch(() => {});
}

function connectClickPlaybackChain(
  ctx: AudioContext,
  source: AudioBufferSourceNode,
): void {
  const buf = source.buffer;
  if (!buf) return;

  const t0 = ctx.currentTime;
  const dur = buf.duration;
  const peak =
    Math.max(0.0001, GALLERY_CLICK_SFX_VOLUME) * randomBetween(0.88, 1.06);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.006);
  const end = t0 + dur;
  gain.gain.setValueAtTime(peak, Math.min(end - 0.02, t0 + dur * 0.85));
  gain.gain.linearRampToValueAtTime(0, end);

  source.connect(gain);
  gain.connect(ctx.destination);
}

async function playClickAsync(): Promise<void> {
  preloadGalleryHoverSfx();
  const buf = await getDecodedClickBuffer();
  const ctx = getAudioContext();
  if (!ctx || !buf) return;
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => {});
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  connectClickPlaybackChain(ctx, src);
  src.start(0);
}

/** Galeri öğesine tıklanınca (pointer jesti ile aynı stack’te çağırın). */
export function playGalleryClickSound(): void {
  primeGalleryAudioEngineFromUserGesture();
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  void playClickAsync().catch(() => {});
}
