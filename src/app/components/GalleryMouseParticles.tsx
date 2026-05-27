import { useContext, useEffect, useRef } from "react";
import { cn } from "./ui/utils";
import {
  DEFAULT_GALLERY_PARALLAX,
  GalleryParallaxContext,
  type GalleryParallaxState,
} from "./galleryParallax";

const BG_PARTICLE_COUNT = 100;
const TRAIL_POOL_SIZE = 3600;
const POOL_SIGNATURE = "bg-cluster-v18-no-planet-ring";
/** Gezegen hover canvas halkası (PNG seçim halkası ayrı). */
const ENABLE_PLANET_RING_PARTICLES = false;

/** Arka plan yıldızları — ince toz. */
const DUST_SIZE_MIN = 0.28;
const DUST_SIZE_MAX = 0.58;
const DUST_OPACITY_MIN = 0.22;
const DUST_OPACITY_MAX = 0.92;

/** Gezegen halkası — referans efekt3: daha büyük, yumuşak gri-beyaz noktalar. */
const RING_DUST_SIZE_MIN = 0.32;
const RING_DUST_SIZE_MAX = 0.72;
const RING_DUST_SIZE_SPARK_MAX = 0.98;
const RING_DUST_GLOW = 0.6;
const RING_OPACITY_MIN = 0.08;
const RING_OPACITY_MAX = 0.28;

const MOUSE_FADE_RADIUS = 460;
const MOUSE_LAG_LERP = 0.055;
const MOUSE_ATTRACT = 0.0045;
const TRAIL_LIFETIME_SEC = 0.55;
const TRAIL_SPAWN_MOVE_THRESHOLD = 1.5;
const TRAIL_SPAWN_PER_FRAME = 2;
const MAX_TRAIL_ALIVE = 90;
const DPR_CAP = 2;
const PLANET_ORBIT_SPEED = 0.09;
const PLANET_RING_SPAWN_PER_SEC = 55;
const PLANET_RING_LIFE_SEC = 2.2;
const PLANET_RING_MAX_ALIVE = 420;
/**
 * Halka: disk kenarı + sabit px band (zoom’da ekranda şişmez).
 * Kenar = feather ile uyumlu elips (visibleRadius / radiusPx).
 */
const PLANET_RING_RIM_OFFSET_MIN = 0;
const PLANET_RING_RIM_OFFSET_MAX = 4;
const PLANET_RING_OUTER_OFFSET_MIN = 2;
const PLANET_RING_OUTER_OFFSET_MAX = 10;
const PLANET_RING_OUTER_CHANCE = 0.12;
/** Zoom’da parçacık boyutu sabit kalsın (referans disk ~120px). */
const PLANET_RING_SIZE_REF_RADIUS_PX = 110;

const BG_STRAY_RATIO = 0.24;
/** Gezegenlerle aynı yönde dönsün (önceki +1 zıttı). */
const BG_SKY_ROTATION = -1;
const BG_ZOOM_SPREAD = 0.24;
const BG_FOCAL_SCALE = 0.78;
const BG_DEFAULT_POLAR = ((38 + 100) * 0.5 * Math.PI) / 180;
const BG_TREMBLE_AMP = 0.016;
const BG_LOCAL_ORBIT_MIN = 0.01;
const BG_LOCAL_ORBIT_MAX = 0.038;

type ParticleKind = "bg" | "trail" | "ring";

type PlanetScreenTarget = {
  x: number;
  y: number;
  radiusPx: number;
  visibleRadiusPx?: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  kind: ParticleKind;
  tint: number;
  size: number;
  opacity: number;
  /** Per-star opacity multiplier (bg only). */
  opacityMul?: number;
  shellX?: number;
  shellY?: number;
  shellZ?: number;
  tremblePhase?: number;
  tremblePhase2?: number;
  localOrbitPhase?: number;
  localOrbitSpeed?: number;
  localOrbitRadius?: number;
  orbitAngle?: number;
  /** Disk kenarından dışa sabit px (zoom’da değişmez). */
  orbitOffsetPx?: number;
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function randomDustOpacity(): number {
  const u = Math.random();
  if (u < 0.35) return rand(DUST_OPACITY_MIN, 0.45);
  if (u < 0.7) return rand(0.42, 0.72);
  return rand(0.68, DUST_OPACITY_MAX);
}

function randomDustSize(): number {
  return rand(DUST_SIZE_MIN, DUST_SIZE_MAX);
}

function randomRingDustSize(): number {
  const u = Math.random();
  if (u < 0.08) return rand(0.75, RING_DUST_SIZE_SPARK_MAX);
  if (u < 0.38) return rand(0.52, 0.86);
  return rand(RING_DUST_SIZE_MIN, RING_DUST_SIZE_MAX);
}

function randomRingOpacity(): number {
  const u = Math.random();
  if (u < 0.28) return rand(RING_OPACITY_MIN, 0.14);
  if (u < 0.72) return rand(0.12, 0.2);
  return rand(0.18, RING_OPACITY_MAX);
}

/** Perspektifte eliptik görünür disk kenarı (feather ile uyumlu). */
function discEdgePxAtAngle(planet: PlanetScreenTarget, angle: number): number {
  const rx = Math.max(planet.radiusPx, 1);
  const ry = Math.max(planet.visibleRadiusPx ?? rx * 0.87, 1);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const denom = (c * c) / (rx * rx) + (s * s) / (ry * ry);
  return denom > 1e-8 ? 1 / Math.sqrt(denom) : rx;
}

function ringOrbitPx(
  planet: PlanetScreenTarget,
  angle: number,
  offsetPx: number,
): number {
  return discEdgePxAtAngle(planet, angle) + offsetPx;
}

function ringDrawSize(planet: PlanetScreenTarget, size: number): number {
  const ref = PLANET_RING_SIZE_REF_RADIUS_PX;
  const scale = Math.min(1, ref / Math.max(planet.radiusPx, ref * 0.5));
  return size * scale;
}

/** Disk içine taşan glow’u kes; dışarıda tam opaklık. */
function ringDrawAlpha(
  planet: PlanetScreenTarget,
  x: number,
  y: number,
  size: number,
  baseAlpha: number,
): number {
  const dx = x - planet.x;
  const dy = y - planet.y;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const edge = discEdgePxAtAngle(planet, angle);
  const inner = edge - size * 0.42;
  if (dist <= inner) return 0;
  if (dist >= edge) return baseAlpha;
  return baseAlpha * clamp01((dist - inner) / Math.max(edge - inner, 0.5));
}

function drawSoftDust(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: string,
): void {
  const glow = Math.max(0.0, radius * RING_DUST_GLOW);
  ctx.save();
  ctx.shadowBlur = glow;
  ctx.shadowColor = fill;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.32;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

type BgCluster = {
  x: number;
  y: number;
  z: number;
  spread: number;
  weight: number;
};

/** Asimetrik küme merkezleri — orta bölge daha seyrek. */
const BG_CLUSTERS: BgCluster[] = [
  { x: -1.15, y: 0.12, z: 0.35, spread: 0.42, weight: 1.35 },
  { x: 1.08, y: -0.22, z: 0.28, spread: 0.38, weight: 1.25 },
  { x: 0.95, y: 0.58, z: -0.15, spread: 0.3, weight: 0.75 },
  { x: -0.82, y: -0.55, z: 0.08, spread: 0.34, weight: 0.9 },
  { x: 0.22, y: 0.78, z: 0.55, spread: 0.22, weight: 0.55 },
  { x: -0.35, y: -0.82, z: -0.45, spread: 0.26, weight: 0.65 },
  { x: 0.55, y: 0.05, z: -0.95, spread: 0.32, weight: 0.6 },
  { x: -1.05, y: 0.62, z: -0.55, spread: 0.28, weight: 0.7 },
];

function gaussSpread(scale: number): number {
  return ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 2 * scale;
}

function pickBgCluster(): BgCluster {
  let sum = 0;
  for (const c of BG_CLUSTERS) sum += c.weight;
  let r = Math.random() * sum;
  for (const c of BG_CLUSTERS) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return BG_CLUSTERS[BG_CLUSTERS.length - 1]!;
}

function randomBgShellPosition(): { x: number; y: number; z: number } {
  if (Math.random() < BG_STRAY_RATIO) {
    return {
      x: rand(-1.45, 1.45),
      y: rand(-1.15, 1.15),
      z: rand(-1.25, 1.25),
    };
  }
  const c = pickBgCluster();
  const s = c.spread * rand(0.45, 1.05);
  return {
    x: c.x + gaussSpread(s),
    y: c.y + gaussSpread(s * 0.85),
    z: c.z + gaussSpread(s * 0.95),
  };
}

function bgWorldPosition(
  p: Particle,
  timeSec: number,
  breathe: number,
): { x: number; y: number; z: number } {
  const base = {
    x: p.shellX ?? 0,
    y: p.shellY ?? 0,
    z: p.shellZ ?? 0,
  };
  const phase = p.localOrbitPhase ?? 0;
  const speed = p.localOrbitSpeed ?? 0.3;
  const lr = p.localOrbitRadius ?? 0.02;
  const la = phase + timeSec * speed;

  let x = (base.x + Math.cos(la) * lr) * breathe;
  let y = (base.y + Math.sin(la * 0.73) * lr * 0.55) * breathe;
  let z = (base.z + Math.sin(la * 1.1) * lr) * breathe;

  const tp = p.tremblePhase ?? 0;
  const tp2 = p.tremblePhase2 ?? 0;
  x += Math.sin(timeSec * 2.2 + tp) * BG_TREMBLE_AMP;
  y += Math.cos(timeSec * 1.65 + tp2) * BG_TREMBLE_AMP;
  z += Math.sin(timeSec * 2.5 + tp * 1.2) * BG_TREMBLE_AMP * 0.85;

  return { x, y, z };
}

function projectBgShell3D(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  cam: GalleryParallaxState,
): { x: number; y: number; sizeMul: number; depthAlpha: number } {
  const yaw = cam.azimuth * BG_SKY_ROTATION;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  let rx = x * cosY - z * sinY;
  let rz = x * sinY + z * cosY;
  let ry = y;

  const pitch = (cam.polar - BG_DEFAULT_POLAR) * 0.32;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const ry2 = ry * cosP - rz * sinP;
  const rz2 = ry * sinP + rz * cosP;

  const depth = 1.55 + rz2 * 0.88;
  const focal = Math.min(w, h) * BG_FOCAL_SCALE;
  const sx = w * 0.5 + (rx / depth) * focal;
  const sy = h * 0.5 - (ry2 / depth) * focal;

  const zoom = 1 + (0.5 - cam.distanceT) * BG_ZOOM_SPREAD;
  const depthFade = clamp01((depth - 1.15) / 1.35);

  return {
    x: sx,
    y: sy,
    sizeMul: zoom * (0.68 + 0.38 * depthFade),
    depthAlpha: 0.5 + 0.5 * depthFade,
  };
}

function initBgParticle(): Partial<Particle> {
  const pos = randomBgShellPosition();
  return {
    shellX: pos.x,
    shellY: pos.y,
    shellZ: pos.z,
    tremblePhase: rand(0, Math.PI * 2),
    tremblePhase2: rand(0, Math.PI * 2),
    localOrbitPhase: rand(0, Math.PI * 2),
    localOrbitSpeed: rand(0.12, 0.38),
    localOrbitRadius: rand(BG_LOCAL_ORBIT_MIN, BG_LOCAL_ORBIT_MAX),
    tint: Math.random() < 0.7 ? 0 : Math.floor(rand(1, 4)),
    size: randomDustSize(),
    opacity: randomDustOpacity(),
    opacityMul: rand(0.75, 1.12),
    life: rand(12, 30),
    maxLife: rand(18, 36),
  };
}

function initParticles(_width: number, _height: number): Particle[] {
  const out: Particle[] = [];
  const total = BG_PARTICLE_COUNT + TRAIL_POOL_SIZE;
  for (let i = 0; i < total; i++) {
    const kind: ParticleKind = i < BG_PARTICLE_COUNT ? "bg" : "trail";
    const bg = kind === "bg" ? initBgParticle() : {};
    out.push({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: kind === "bg" ? (bg.life ?? 20) : 0,
      maxLife:
        kind === "bg" ? (bg.maxLife ?? 24) : TRAIL_LIFETIME_SEC,
      kind,
      tint: kind === "bg" ? (bg.tint ?? 0) : 0,
      size: kind === "bg" ? (bg.size ?? 1.2) : rand(0.35, 0.7),
      opacity: kind === "bg" ? (bg.opacity ?? 0.7) : 1,
      opacityMul: bg.opacityMul,
      shellX: bg.shellX,
      shellY: bg.shellY,
      shellZ: bg.shellZ,
      tremblePhase: bg.tremblePhase,
      tremblePhase2: bg.tremblePhase2,
      localOrbitPhase: bg.localOrbitPhase,
      localOrbitSpeed: bg.localOrbitSpeed,
      localOrbitRadius: bg.localOrbitRadius,
    });
  }
  return out;
}

function dustColor(tint: number, alpha: number): string {
  if (tint < 0.5) return `rgba(255,255,255,${alpha})`;
  if (tint < 1.5) return `rgba(175,215,255,${alpha})`;
  if (tint < 2.5) return `rgba(255,215,150,${alpha})`;
  return `rgba(235,180,255,${alpha})`;
}

/** Mouse trail — her zaman saf beyaz. */
function trailColor(alpha: number): string {
  return `rgba(255,255,255,${alpha})`;
}

function spawnTrailAt(
  p: Particle,
  x: number,
  y: number,
  vxHint: number,
  vyHint: number,
): void {
  p.kind = "trail";
  p.orbitAngle = undefined;
  p.orbitOffsetPx = undefined;
  p.shellX = undefined;
  p.shellY = undefined;
  p.shellZ = undefined;
  p.x = x + rand(-2, 2);
  p.y = y + rand(-2, 2);
  p.vx = vxHint * 0.04 + rand(-0.03, 0.03);
  p.vy = vyHint * 0.04 + rand(-0.03, 0.03);
  p.life = p.maxLife = TRAIL_LIFETIME_SEC;
  p.size = rand(0.35, 0.7);
  p.tint = 0;
  p.opacity = 1;
}

function pickRingOffsetPx(): {
  offsetPx: number;
  band: "rim" | "outer";
} {
  if (Math.random() < PLANET_RING_OUTER_CHANCE) {
    return {
      offsetPx: rand(
        PLANET_RING_OUTER_OFFSET_MIN,
        PLANET_RING_OUTER_OFFSET_MAX,
      ),
      band: "outer",
    };
  }
  return {
    offsetPx: rand(PLANET_RING_RIM_OFFSET_MIN, PLANET_RING_RIM_OFFSET_MAX),
    band: "rim",
  };
}

function spawnRingParticle(p: Particle, planet: PlanetScreenTarget): void {
  const angle = Math.random() * Math.PI * 2;
  const { offsetPx, band } = pickRingOffsetPx();
  p.kind = "ring";
  p.size =
    band === "rim"
      ? randomRingDustSize()
      : randomRingDustSize() * rand(0.72, 0.95);
  const radius = ringOrbitPx(planet, angle, offsetPx);
  p.orbitAngle = angle;
  p.orbitOffsetPx = offsetPx;
  p.shellX = undefined;
  p.shellY = undefined;
  p.shellZ = undefined;
  p.x = planet.x + Math.cos(angle) * radius;
  p.y = planet.y + Math.sin(angle) * radius;
  const speedMul = band === "rim" ? 1 : 0.72;
  const speed = PLANET_ORBIT_SPEED * radius * speedMul;
  p.vx = -Math.sin(angle) * speed;
  p.vy = Math.cos(angle) * speed;
  p.life = p.maxLife =
    band === "rim"
      ? rand(PLANET_RING_LIFE_SEC * 0.85, PLANET_RING_LIFE_SEC)
      : rand(2.4, 3.8);
  p.tint = 0;
  p.opacity =
    band === "rim"
      ? randomRingOpacity()
      : rand(RING_OPACITY_MIN, RING_OPACITY_MIN + 0.22);
}

function recycleParticleForRing(p: Particle): boolean {
  /** Arka plan havuzu asla halka/trail için kullanılmasın. */
  if (p.kind === "bg") return false;
  if (p.kind === "ring" && p.life > 0.2) return false;
  if (p.kind === "trail" && p.life > 0.02) return false;
  return true;
}

function seedPlanetRing(
  particles: Particle[],
  planet: PlanetScreenTarget,
  count: number,
): number {
  let spawned = 0;
  for (let i = BG_PARTICLE_COUNT; i < particles.length; i++) {
    if (spawned >= count) break;
    const p = particles[i]!;
    if (!recycleParticleForRing(p)) continue;
    spawnRingParticle(p, planet);
    spawned++;
  }
  return spawned;
}

function stepRingParticle(
  p: Particle,
  planet: PlanetScreenTarget,
  dt: number,
): void {
  let angle = p.orbitAngle ?? Math.atan2(p.y - planet.y, p.x - planet.x);
  const edge = discEdgePxAtAngle(planet, angle);
  const offsetPx =
    p.orbitOffsetPx ??
    Math.max(0, Math.hypot(p.x - planet.x, p.y - planet.y) - edge);
  const radius = ringOrbitPx(planet, angle, offsetPx);

  angle += PLANET_ORBIT_SPEED * dt;

  p.orbitAngle = angle;
  p.orbitOffsetPx = offsetPx;
  p.x = planet.x + Math.cos(angle) * radius;
  p.y = planet.y + Math.sin(angle) * radius;

  const speed = PLANET_ORBIT_SPEED * radius;
  p.vx = -Math.sin(angle) * speed;
  p.vy = Math.cos(angle) * speed;
  p.life -= dt;
}

export function GalleryMouseParticles({
  active,
  pointer,
  className,
}: {
  active: boolean;
  pointer: { x: number; y: number } | null;
  className?: string;
}) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[] | null>(null);
  const poolSignatureRef = useRef(POOL_SIGNATURE);
  const sizeRef = useRef({ w: 0, h: 0 });
  const prevPointerRef = useRef<{ x: number; y: number } | null>(null);
  const laggedPointerRef = useRef<{ x: number; y: number } | null>(null);
  const pointerRef = useRef(pointer);
  const parallaxStoreRef = useContext(GalleryParallaxContext);
  const ringSpawnAccRef = useRef(0);
  const planetHoverActiveRef = useRef(false);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const coarsePointerRef = useRef(false);

  pointerRef.current = pointer;

  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        particlesRef.current = null;
      });
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const onChange = () => {
      reducedMotionRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    coarsePointerRef.current = mq.matches;
    const onChange = () => {
      coarsePointerRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const fgCanvas = fgCanvasRef.current;
    if (!bgCanvas || !fgCanvas) return;

    const resize = () => {
      const parent = bgCanvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w < 1 || h < 1) return;
      const dprCap = coarsePointerRef.current ? 1.5 : DPR_CAP;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      for (const canvas of [bgCanvas, fgCanvas]) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      sizeRef.current = { w, h };
      if (
        !particlesRef.current ||
        poolSignatureRef.current !== POOL_SIGNATURE
      ) {
        poolSignatureRef.current = POOL_SIGNATURE;
        particlesRef.current = initParticles(w, h);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(bgCanvas.parentElement!);

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      laggedPointerRef.current = null;
      prevPointerRef.current = null;
      ringSpawnAccRef.current = 0;
      return;
    }

    const bgCanvas = bgCanvasRef.current;
    const fgCanvas = fgCanvasRef.current;
    if (!bgCanvas || !fgCanvas) return;
    const bgCtx = bgCanvas.getContext("2d");
    const fgCtx = fgCanvas.getContext("2d");
    if (!bgCtx || !fgCtx) return;

    const dprCap = coarsePointerRef.current ? 1.5 : DPR_CAP;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    lastFrameRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;
      const timeSec = now * 0.001;
      const breathe = 1 + Math.sin(timeSec * 0.14) * 0.028;

      const { w, h } = sizeRef.current;
      if (w < 1 || h < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      let particles = particlesRef.current;
      if (!particles) {
        particles = initParticles(w, h);
        particlesRef.current = particles;
      }

      const reduced = reducedMotionRef.current;
      const mouse = pointerRef.current;
      const planetRing: PlanetScreenTarget | null = null;
      if (!ENABLE_PLANET_RING_PARTICLES) {
        for (const p of particles) {
          if (p.kind !== "ring") continue;
          p.kind = "trail";
          p.life = 0;
          p.orbitAngle = undefined;
          p.orbitOffsetPx = undefined;
        }
      }
      const cam =
        parallaxStoreRef?.current ?? DEFAULT_GALLERY_PARALLAX;

      let trailAnchor = laggedPointerRef.current;
      if (mouse) {
        if (!trailAnchor) {
          trailAnchor = { x: mouse.x, y: mouse.y };
          laggedPointerRef.current = trailAnchor;
        } else {
          const lerp = reduced ? 0.2 : MOUSE_LAG_LERP;
          trailAnchor.x += (mouse.x - trailAnchor.x) * lerp;
          trailAnchor.y += (mouse.y - trailAnchor.y) * lerp;
        }
      } else {
        laggedPointerRef.current = null;
        trailAnchor = null;
      }

      if (!reduced && trailAnchor && prevPointerRef.current) {
        const dx = trailAnchor.x - prevPointerRef.current.x;
        const dy = trailAnchor.y - prevPointerRef.current.y;
        const move = Math.hypot(dx, dy);
        if (move > TRAIL_SPAWN_MOVE_THRESHOLD) {
          let aliveTrail = 0;
          for (const p of particles) {
            if (p.kind === "trail" && p.life > 0) aliveTrail++;
          }
          if (aliveTrail < MAX_TRAIL_ALIVE) {
          let spawned = 0;
          for (let i = BG_PARTICLE_COUNT; i < particles.length; i++) {
            const p = particles[i]!;
            if (p.kind === "ring") continue;
            if (p.life > dt * 0.15) continue;
            spawnTrailAt(p, trailAnchor.x, trailAnchor.y, dx, dy);
            spawned++;
            if (spawned >= TRAIL_SPAWN_PER_FRAME) break;
          }
          }
        }
      }
      if (trailAnchor) prevPointerRef.current = { ...trailAnchor };

      if (!reduced) {
        if (ENABLE_PLANET_RING_PARTICLES) {
          if (planetRing) {
            if (!planetHoverActiveRef.current) {
              planetHoverActiveRef.current = true;
              seedPlanetRing(particles, planetRing, PLANET_RING_MAX_ALIVE);
            }

            let aliveRing = 0;
            for (const p of particles) {
              if (p.kind === "ring" && p.life > 0) aliveRing++;
            }

            ringSpawnAccRef.current += dt * PLANET_RING_SPAWN_PER_SEC;
            const spawnBudget = Math.min(
              PLANET_RING_MAX_ALIVE - aliveRing,
              Math.floor(ringSpawnAccRef.current),
            );
            ringSpawnAccRef.current -= spawnBudget;

            for (let n = 0; n < spawnBudget; n++) {
              let placed = false;
              for (let i = BG_PARTICLE_COUNT; i < particles.length; i++) {
                const p = particles[i]!;
                if (!recycleParticleForRing(p)) continue;
                spawnRingParticle(p, planetRing);
                aliveRing++;
                placed = true;
                break;
              }
              if (!placed) break;
              if (aliveRing >= PLANET_RING_MAX_ALIVE) break;
            }
          } else {
            planetHoverActiveRef.current = false;
            ringSpawnAccRef.current = 0;
          }
        }

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]!;

          if (p.kind === "ring") {
            if (!ENABLE_PLANET_RING_PARTICLES || !planetRing) {
              p.kind = "trail";
              p.orbitAngle = undefined;
              p.orbitOffsetPx = undefined;
              p.life = 0;
              continue;
            }
            stepRingParticle(p, planetRing, dt);
            if (p.life <= 0) {
              p.life = 0;
              p.kind = "trail";
              p.orbitAngle = undefined;
              p.orbitOffsetPx = undefined;
            }
            continue;
          }

          if (p.kind === "bg") {
            p.life -= dt * 0.06;
            if (p.life <= 0) {
              Object.assign(p, initBgParticle(), { kind: "bg" as const });
            }
            continue;
          }

          if (trailAnchor && p.life > 0) {
            const mdx = trailAnchor.x - p.x;
            const mdy = trailAnchor.y - p.y;
            const mdist = Math.hypot(mdx, mdy);
            const fade = clamp01(1 - mdist / MOUSE_FADE_RADIUS);
            if (fade > 0) {
              p.vx += mdx * MOUSE_ATTRACT * fade * (dt * 60);
              p.vy += mdy * MOUSE_ATTRACT * fade * (dt * 60);
            }
          }

          p.x += p.vx * (dt * 60);
          p.y += p.vy * (dt * 60);
          p.vx *= 0.97;
          p.vy *= 0.97;
          p.life -= dt;

          if (p.life <= 0) {
            p.life = 0;
            p.vx *= 0.35;
            p.vy *= 0.35;
          }
        }
      }

      const drawParticles = (
        ctx: CanvasRenderingContext2D,
        kinds: Set<ParticleKind>,
        ringPlanet: PlanetScreenTarget | null = null,
        opts?: { clear?: boolean },
      ) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (opts?.clear !== false) {
          ctx.clearRect(0, 0, w, h);
        }

        for (const p of particles) {
          if (!kinds.has(p.kind)) continue;

          let alpha: number;
          let drawX = p.x;
          let drawY = p.y;
          let drawSize = p.size;
          let fill: string;

          if (p.kind === "bg") {
            const world = bgWorldPosition(p, timeSec, breathe);
            const projected = projectBgShell3D(
              world.x,
              world.y,
              world.z,
              w,
              h,
              cam,
            );
            drawX = projected.x;
            drawY = projected.y;
            drawSize = p.size * projected.sizeMul;
            const twinkle =
              (0.82 + 0.18 * clamp01(p.life / p.maxLife)) *
              (p.opacityMul ?? 1);
            alpha =
              p.opacity * twinkle * (0.82 + 0.18 * projected.depthAlpha);
            if (reduced) alpha *= 0.85;
            fill = dustColor(p.tint, alpha);
          } else if (p.kind === "ring") {
            if (p.life <= 0) continue;
            const lifeT = clamp01(p.life / p.maxLife);
            alpha = p.opacity * (0.48 + 0.52 * lifeT);
            if (ringPlanet) {
              drawSize = ringDrawSize(ringPlanet, drawSize);
              alpha = ringDrawAlpha(
                ringPlanet,
                drawX,
                drawY,
                drawSize,
                alpha,
              );
            }
            if (alpha < 0.02) continue;
            fill = dustColor(0, alpha);
            drawSoftDust(ctx, drawX, drawY, drawSize, fill);
            continue;
          } else {
            if (p.life <= 0) continue;
            let a = clamp01(p.life / p.maxLife);
            const fadeFrom = mouse ?? trailAnchor;
            if (fadeFrom) {
              const mdist = Math.hypot(fadeFrom.x - p.x, fadeFrom.y - p.y);
              a *= clamp01(1 - mdist / MOUSE_FADE_RADIUS);
            }
            alpha = a * 0.88;
            fill = trailColor(alpha);
          }

          if (alpha < 0.02) continue;
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.arc(drawX, drawY, drawSize, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      drawParticles(bgCtx, new Set(["bg"]));
      drawParticles(fgCtx, new Set(["trail"]));
      if (ENABLE_PLANET_RING_PARTICLES && planetRing) {
        drawParticles(fgCtx, new Set(["ring"]), planetRing, { clear: false });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, parallaxStoreRef]);

  return (
    <>
      <canvas
        ref={bgCanvasRef}
        className={cn("pointer-events-none absolute inset-0 z-0", className)}
        aria-hidden
      />
      <canvas
        ref={fgCanvasRef}
        className={cn("pointer-events-none absolute inset-0 z-[2]", className)}
        aria-hidden
      />
    </>
  );
}
