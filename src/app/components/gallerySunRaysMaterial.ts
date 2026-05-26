import * as THREE from "three";

/**
 * Kare düzlem kenarı = kart genişliği × bu — doku tam kare UV (disk warp yok).
 */
export const SUN_RAYS_PLANE_SIDE_MULT = 5.0;

/** UV ölçeği — merkeze zoom (`(vUv-0.5)*expand`). */
export const SUN_RAY_UV_EXPAND = 3.0;
/** Halo PNG blur — texel cinsinden yarıçap (halkayı kalınlaştırır). */
export const SUN_RAY_HALO_BLUR_RADIUS = 3.25;
/** Temel halo parlaklığı (additive). */
export const SUN_RAY_HALO_STRENGTH = 3.85;
/** Halka üzerindeki shine / sweep yoğunluğu. */
export const SUN_RAY_HALO_SHINE_STRENGTH = 0.62;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Halo PNG (koyu merkez + halka, additive): `uTint` = kapak örneklemesi — gezegen başına renk (Gallery3D’de doyurganlaştırılır).
 */
const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uMapTexelSize;
uniform float uAlpha;
uniform vec3 uTint;
uniform float uStrength;
uniform float uUvExpand;
uniform float uBlurRadius;
uniform float uTime;
uniform float uShineStrength;
varying vec2 vUv;

const vec2 kBlurOffsets[9] = vec2[](
  vec2(-1.0, -1.0), vec2(0.0, -1.0), vec2(1.0, -1.0),
  vec2(-1.0,  0.0), vec2(0.0,  0.0), vec2(1.0,  0.0),
  vec2(-1.0,  1.0), vec2(0.0,  1.0), vec2(1.0,  1.0)
);

const float kBlurWeights[9] = float[](
  0.0625, 0.125, 0.0625,
  0.125,  0.25,  0.125,
  0.0625, 0.125, 0.0625
);

void sampleHalo(vec2 uv, out float mask, out vec3 rgb) {
  mask = 0.0;
  rgb = vec3(0.0);
  vec2 step = uMapTexelSize * uBlurRadius;

  for (int i = 0; i < 9; i++) {
    vec2 suv = clamp(uv + kBlurOffsets[i] * step, vec2(0.001), vec2(0.999));
    vec4 tex = texture2D(uMap, suv);
    float w = kBlurWeights[i];
    float lum = max(tex.r, max(tex.g, tex.b));
    mask += lum * tex.a * w;
    rgb += tex.rgb * w;
  }
}

void main() {
  vec2 uv = 0.5 + (vUv - 0.5) * uUvExpand;
  uv = clamp(uv, vec2(0.001), vec2(0.999));

  float mask;
  vec3 rgb;
  sampleHalo(uv, mask, rgb);
  if (mask < 0.0005) discard;

  rgb = rgb * uTint * uStrength;

  vec2 centred = vUv - 0.5;
  float ang = atan(centred.y, centred.x);
  float sweepTight = pow(max(cos(ang * 2.0 - uTime * 1.25), 0.0), 3.5);
  float sweepWide = pow(max(cos(ang - uTime * 0.72 + 0.9), 0.0), 2.2);
  float sweep = max(sweepTight, sweepWide * 0.72);
  float pulse = 0.7 + 0.3 * sin(uTime * 1.65);
  float ringPresence = clamp(mask * 3.4, 0.0, 1.0);
  float baseGlow = ringPresence * 0.38;
  float shine = (sweep * pulse + baseGlow) * uShineStrength * ringPresence;
  vec3 shineCol = mix(vec3(1.0), uTint, 0.12);
  rgb += shineCol * shine * 1.35;

  float a = mask * uAlpha;

  gl_FragColor = vec4(rgb * a, a);
}
`;

function haloMapTexelSize(map: THREE.Texture): THREE.Vector2 {
  const img = map.image as { width?: number; height?: number } | undefined;
  const w = Math.max(1, img?.width ?? 512);
  const h = Math.max(1, img?.height ?? 512);
  return new THREE.Vector2(1 / w, 1 / h);
}

export function createGallerySunburstHaloMaterial(
  map: THREE.Texture,
): THREE.ShaderMaterial {
  map.minFilter = THREE.LinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = false;

  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uMapTexelSize: { value: haloMapTexelSize(map) },
      uAlpha: { value: 0 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      uStrength: { value: SUN_RAY_HALO_STRENGTH },
      uUvExpand: { value: SUN_RAY_UV_EXPAND },
      uBlurRadius: { value: SUN_RAY_HALO_BLUR_RADIUS },
      uTime: { value: 0 },
      uShineStrength: { value: SUN_RAY_HALO_SHINE_STRENGTH },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -0.5,
    polygonOffsetUnits: -0.5,
  });
}
