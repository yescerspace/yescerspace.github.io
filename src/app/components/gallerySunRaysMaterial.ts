import * as THREE from "three";

/**
 * Kare düzlem kenarı = kart genişliği × bu — doku tam kare UV (disk warp yok).
 */
export const SUN_RAYS_PLANE_SIDE_MULT = 5.0;

/** UV ölçeği — merkeze zoom (`(vUv-0.5)*expand`). */
export const SUN_RAY_UV_EXPAND = 3.0;

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
uniform float uAlpha;
uniform vec3 uTint;
uniform float uStrength;
uniform float uUvExpand;
varying vec2 vUv;

void main() {
  vec2 uv = 0.5 + (vUv - 0.5) * uUvExpand;
  uv = clamp(uv, vec2(0.001), vec2(0.999));
  vec4 tex = texture2D(uMap, uv);

  float lum = max(tex.r, max(tex.g, tex.b));
  float mask = lum * tex.a;
  if (mask < 0.0005) discard;

  vec3 rgb = tex.rgb * uTint * uStrength;
  float a = mask * uAlpha;

  gl_FragColor = vec4(rgb * a, a);
}
`;

export function createGallerySunburstHaloMaterial(
  map: THREE.Texture,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uAlpha: { value: 0 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      uStrength: { value: 3.0 },
      uUvExpand: { value: SUN_RAY_UV_EXPAND },
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
