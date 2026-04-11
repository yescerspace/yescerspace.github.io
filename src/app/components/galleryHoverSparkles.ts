import * as THREE from "three";

/**
 * Sparkle noktaları: `NormalBlending` (srcAlpha·dst) veya `AdditiveBlending` (srcAlpha+ONE) yerine
 * **ekran benzeri** harman — koyu arka planda daha az “mat boya”, daha çok ışık ekler; kenarlar daha yumuşak.
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendFunc.xhtml
 */
export function applyGallerySparkleBlendMode(m: THREE.PointsMaterial): void {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcColorFactor;
  m.blendEquationAlpha = THREE.AddEquation;
  m.blendSrcAlpha = THREE.OneFactor;
  m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
}

const SPARKLE_FEATHER_SHADER_KEY = "gallerySparkleOuterFeather:v1";

/**
 * Halka dış çeperinde opacity feather: `aFeather` × sprite map alfası (geometry’de üretilir).
 */
export function patchGallerySparkleOuterRimFeather(m: THREE.PointsMaterial): void {
  m.customProgramCacheKey = () => SPARKLE_FEATHER_SHADER_KEY;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
attribute float aFeather;
varying float vSparkleFeather;
`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vSparkleFeather = aFeather;
`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
varying float vSparkleFeather;
`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_particle_fragment>",
      `#include <map_particle_fragment>
diffuseColor.a *= vSparkleFeather;
`,
    );
  };
}

/** Daha geride çizilir (sun-ray’in arkası). */
export const GALLERY_SPARKLE_LAYER_Z = -0.042;
export const GALLERY_SPARKLE_RENDER_ORDER = -4;

const SPARKLE_COUNT = 440;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp(
    (x - edge0) / Math.max(edge1 - edge0, 1e-9),
    0,
    1,
  );
  return t * t * (3 - 2 * t);
}

let spriteMap: THREE.Texture | null = null;

/** Yumuşak daire sprite — additive noktalar için (tek sefer oluşturulur). */
export function getGallerySparkleSpriteMap(): THREE.Texture {
  if (spriteMap) return spriteMap;
  if (typeof document === "undefined") {
    const data = new Uint8Array([255, 255, 255, 255]);
    spriteMap = new THREE.DataTexture(data, 1, 1);
    spriteMap.needsUpdate = true;
    return spriteMap;
  }
  const s = 64;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d");
  if (!ctx) {
    const data = new Uint8Array([255, 255, 255, 255]);
    spriteMap = new THREE.DataTexture(data, 1, 1);
    spriteMap.needsUpdate = true;
    return spriteMap;
  }
  const g = ctx.createRadialGradient(s * 0.5, s * 0.5, 0, s * 0.5, s * 0.5, s * 0.5);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  spriteMap = new THREE.CanvasTexture(c);
  spriteMap.colorSpace = THREE.SRGBColorSpace;
  spriteMap.needsUpdate = true;
  return spriteMap;
}

/**
 * Disk çevresi + hemen iç halo: noktalar sun-ray düzlemine kadar yayılmaz (eskiden `planeSideMult`
 * ile dışarı taşıyordu, çok “uzak” görünüyordu). `R = cardW/2` gezegen yarıçapı.
 */
export function buildGalleryHoverSparkleGeometry(
  cardW: number,
  _planeSideMult: number,
): THREE.BufferGeometry {
  const R = cardW * 0.5;
  /** Disk kenarına yakın (içten başla). */
  const inner = R * 0.94;
  /** Dış sınır: halo halkası; sun ışınlarının dış çerçevesine kadar değil. */
  const outer = R * 1.3;
  const band = outer - inner;
  const pos = new Float32Array(SPARKLE_COUNT * 3);
  const feather = new Float32Array(SPARKLE_COUNT);
  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const u = Math.random();
    const r = Math.sqrt(inner * inner + u * (outer * outer - inner * inner));
    pos[i * 3] = r * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(theta);
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.006;
    /** t: içten dışa 0→1 — son %50’lik dış dilimde opaklık 1→0 feather. */
    const t = band > 1e-6 ? (r - inner) / band : 0;
    feather[i] = 1 - smoothstep(0.5, 1, t);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aFeather", new THREE.BufferAttribute(feather, 1));
  return geo;
}
