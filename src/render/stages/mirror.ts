import * as THREE from 'three';
import type { DressContext } from './dressing';

export interface MirrorSource {
  mesh: THREE.Mesh;
  map?: THREE.Texture | null;
  tint?: THREE.ColorRepresentation;
  strength?: number;
  cycle?: boolean;
  scroll?: number;
  edge?: { u: number; v: number; cells?: number };
}

export interface MirrorOptions {
  floor: readonly THREE.Mesh[];
  y?: number;
  strength: number;
  f0?: number;
  fade: number;
  blur?: number;
  polish?: { size: number; amount: number };
  extent?: [number, number];
  smear?: number;
}

const VERT = `
  varying vec2 vUv; varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const FRAG = `
  uniform sampler2D map; uniform vec3 uTint; uniform float uStrength; uniform float uF0; uniform float uFade; uniform float uBlur;
  uniform float uY; uniform vec2 uPolish; uniform vec2 uExtent; uniform float uTime; uniform float uCycle; uniform float uScroll;
  uniform vec3 uEdge; uniform float uSmear;
  varying vec2 vUv; varying vec3 vWorld;
  float mHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float mNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(mHash(i), mHash(i + vec2(1., 0.)), f.x), mix(mHash(i + vec2(0., 1.)), mHash(i + vec2(1., 1.)), f.x), f.y); }
  void main() {
    // Where the ray from the lens to this mirrored point crosses the floor.
    vec3 ray = vWorld - cameraPosition;
    float t = (cameraPosition.y - uY) / max(cameraPosition.y - vWorld.y, 1e-3);
    vec3 floorPoint = cameraPosition + ray * t;
    if (abs(floorPoint.x) > uExtent.x || abs(floorPoint.z) > uExtent.y) discard;
    float cosView = clamp((cameraPosition.y - uY) / max(length(cameraPosition - floorPoint), 1e-3), 0., 1.);
    float fresnel = uF0 + (1. - uF0) * pow(1. - cosView, 5.);
    float depth = max(uY - vWorld.y, 0.);
    float fade = exp(-depth / uFade * 1.1);
    float polish = 1. - uPolish.y + uPolish.y * (.35 + .65 * mNoise(floorPoint.xz / uPolish.x) * mNoise(floorPoint.xz / uPolish.x * 2.7 + 13.));
    vec2 uv = vUv;
    // The picture's own edges, softened (before the screens' frames swap, so the fade stays on the quad).
    float edge = 1.;
    if (uEdge.x > 0.) {
      float fv = fract(vUv.y * uEdge.z);
      edge = smoothstep(0., uEdge.x, vUv.x) * smoothstep(1., 1. - uEdge.x, vUv.x) * smoothstep(0., uEdge.y, fv) * smoothstep(1., 1. - uEdge.y, fv);
    }
    if (uCycle > .5 && fract(uTime / 20.) > .5) uv.y = uv.y >= .5 ? uv.y - .5 : uv.y + .5;
    uv.x += uTime * uScroll;
    // A rough polish streaks a reflection toward the viewer: five taps down the picture's v, wider the deeper it lies.
    float bias = uBlur + depth * .08, smear = uSmear * (1. + depth * .1);
    vec3 col = (texture2D(map, uv, bias).rgb * .3 + (texture2D(map, uv + vec2(0., smear), bias).rgb + texture2D(map, uv - vec2(0., smear), bias).rgb) * .22
      + (texture2D(map, uv + vec2(0., smear * 2.), bias).rgb + texture2D(map, uv - vec2(0., smear * 2.), bias).rgb) * .13) * uTint;
    float k = uStrength * fresnel * fade * polish * edge;
    gl_FragColor = vec4(col * k, 1.);
  }`;

export function mirrorBright(c: DressContext, sources: readonly MirrorSource[], o: MirrorOptions) {
  const y = o.y ?? 0;
  for (const floor of o.floor) floor.renderOrder = Math.min(floor.renderOrder, -2);
  const reflect = new THREE.Matrix4().set(1, 0, 0, 0, 0, -1, 0, 2 * y, 0, 0, 1, 0, 0, 0, 0, 1);
  const out: THREE.Mesh[] = [];
  for (const s of sources) {
    const source = s.mesh.material as THREE.MeshBasicMaterial;
    const map = s.map ?? source.map;
    if (!map) continue;
    const material = new THREE.ShaderMaterial({
      name: `${source.name} mirrored`,
      uniforms: {
        map: { value: map }, uTint: { value: new THREE.Color(s.tint ?? 0xffffff) }, uStrength: { value: o.strength * (s.strength ?? 1) },
        uF0: { value: o.f0 ?? .05 }, uFade: { value: o.fade }, uBlur: { value: o.blur ?? 2 }, uY: { value: y },
        uPolish: { value: new THREE.Vector2(o.polish?.size ?? 3, o.polish?.amount ?? .5) },
        uExtent: { value: new THREE.Vector2(...(o.extent ?? [1e5, 1e5])) },
        uTime: c.ambient.time, uCycle: { value: s.cycle ? 1 : 0 }, uScroll: { value: s.scroll ?? 0 },
        uEdge: { value: new THREE.Vector3(s.edge?.u ?? 0, s.edge?.v ?? 0, s.edge?.cells ?? 1) }, uSmear: { value: o.smear ?? 0 },
      },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: false, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, depthFunc: THREE.GreaterDepth,
      side: THREE.FrontSide, fog: false,
    });
    const mesh = new THREE.Mesh(s.mesh.geometry, material);
    mesh.name = `${s.mesh.name} mirrored`;
    s.mesh.updateWorldMatrix(true, false);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.multiplyMatrices(reflect, s.mesh.matrixWorld);
    mesh.renderOrder = -1;
    mesh.frustumCulled = false;
    c.root.add(mesh);
    out.push(mesh);
  }
  return out;
}
