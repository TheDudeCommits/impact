import * as THREE from 'three';
import type { Fighter } from '../Fighter';
import { drawnBulk } from '../CameraDirector';
import { DREAM_IMPACT } from '../dreamFlag';

export const VEIL_BODIES = 4;
const VEIL_DELAY = DREAM_IMPACT ? .035 : .07, VEIL_IN = DREAM_IMPACT ? .035 : .08, VEIL_OUT = .3, VEIL_LINGER = .6, VEIL_RADIUS = DREAM_IMPACT ? .5 : .42, VEIL_PAD = .16;
export const VEIL_LIGHT = DREAM_IMPACT ? .85 : 1;
const VEIL_WIDE = DREAM_IMPACT ? .65 : VEIL_RADIUS;
export const VEIL = DREAM_IMPACT
  ? { sparks: .9, dust: 1, beam: .75, corona: .8, burst: .95, ghost: 1, rubble: 1 } as const
  : { sparks: .75, dust: .85, beam: .75, corona: .8, burst: .8, ghost: .85, rubble: .6 } as const;
const REACTING = new Set<string>(['hurt', 'flinch', 'launched', 'knockdown', 'splat', 'stun', 'getup']);

const uniforms = {
  uVeilA: { value: Array.from({ length: VEIL_BODIES }, () => new THREE.Vector4()) },
  uVeilB: { value: Array.from({ length: VEIL_BODIES }, () => new THREE.Vector4()) },
};

export const VEIL_GLSL = `
uniform vec4 uVeilA[${VEIL_BODIES}]; uniform vec4 uVeilB[${VEIL_BODIES}];
float victimVeil(vec3 p, float strength){
  vec3 d = p - cameraPosition; float t0 = length(d); d /= max(t0, 1e-4);
  float keep = 1.0;
  for (int i = 0; i < ${VEIL_BODIES}; i++) {
    float w = uVeilB[i].w;
    if (w < .002) continue;
    vec3 a = uVeilA[i].xyz, ab = uVeilB[i].xyz - a, w0 = a - cameraPosition;
    float aa = dot(ab, ab), b = dot(ab, d), c = dot(ab, w0), e = dot(d, w0), den = aa - b * b;
    float s = den > 1e-5 ? clamp((b * e - c) / den, 0.0, 1.0) : 0.0;
    float t = e + b * s;
    float r = uVeilA[i].w, near = length(w0 + ab * s - d * t);
    float cover = (1.0 - smoothstep(r * .7, r * 1.25, near)) * smoothstep(-.15, .1, t - t0) * w;
    keep = min(keep, 1.0 - strength * cover);
  }
  return keep;
}
// The same, and also wherever the effect passes through the body itself: a
// beam's white-hot core running through the victim is what blooms over them,
// from in front or behind.
float victimVeilThrough(vec3 p, float strength){
  float keep = victimVeil(p, strength);
  for (int i = 0; i < ${VEIL_BODIES}; i++) {
    float w = uVeilB[i].w;
    if (w < .002) continue;
    vec3 a = uVeilA[i].xyz, ab = uVeilB[i].xyz - a;
    float s = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0), r = uVeilA[i].w;
    float inside = 1.0 - smoothstep(r * .8, r * 1.6, length(p - a - ab * s));
    keep = min(keep, 1.0 - strength * inside * w);
  }
  return keep;
}`;

export function veilKeep(p: THREE.Vector3, lens: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, r: number, w: number, strength: number) {
  const d = p.clone().sub(lens), t0 = d.length(); d.divideScalar(Math.max(t0, 1e-4));
  const ab = b.clone().sub(a), w0 = a.clone().sub(lens);
  const aa = ab.dot(ab), bb = ab.dot(d), c = ab.dot(w0), e = d.dot(w0), den = aa - bb * bb;
  const s = den > 1e-5 ? THREE.MathUtils.clamp((bb * e - c) / den, 0, 1) : 0, t = e + bb * s;
  const near = w0.clone().addScaledVector(ab, s).addScaledVector(d, -t).length();
  const cover = (1 - THREE.MathUtils.smoothstep(near, r * .7, r * 1.25)) * THREE.MathUtils.smoothstep(t - t0, -.15, .1) * w;
  return 1 - strength * cover;
}

export function veilUniforms(strength: number) {
  return { ...uniforms, uVeilStrength: { value: strength } };
}

const installed = new WeakSet<THREE.Material>();
export function installVeil(material: THREE.Material, strength: number) {
  if (installed.has(material)) return material;
  installed.add(material);
  const previous = material.onBeforeCompile, cache = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms, { uVeilStrength: { value: strength } });
    shader.vertexShader = 'varying vec3 vVeilWorld;\n' + shader.vertexShader.replace('#include <project_vertex>', `
      vec4 veilLocal = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        veilLocal = instanceMatrix * veilLocal;
      #endif
      vVeilWorld = (modelMatrix * veilLocal).xyz;
      #include <project_vertex>`);
    shader.fragmentShader = 'varying vec3 vVeilWorld;\nuniform float uVeilStrength;\n' + VEIL_GLSL + '\n'
      + shader.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      gl_FragColor.a *= victimVeil(vVeilWorld, uVeilStrength);`);
  };
  material.customProgramCacheKey = () => cache() + '-victim-veil';
  material.needsUpdate = true;
  return material;
}

const _feet = new THREE.Vector3(), _head = new THREE.Vector3(), _joint = new THREE.Vector3();
const FEET = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'] as const;

export class VictimVeil {
  private struckAt = new Map<string, number>();
  private big = new Set<string>();
  private weights = new Map<string, number>();
  private order: Fighter[] = [];
  private byWeight = (a: Fighter, b: Fighter) => (this.weights.get(b.state.id) ?? 0) - (this.weights.get(a.state.id) ?? 0);
  struck(id: string, time: number, big = false) { this.struckAt.set(id, time); if (big) this.big.add(id); }
  weight(id: string) { return this.weights.get(id) ?? 0; }

  update(time: number, dt: number, fighters: ReadonlyMap<string, Fighter>) {
    const order = this.order; order.length = 0;
    for (const body of fighters.values()) {
      const id = body.state.id, since = time - (this.struckAt.get(id) ?? -Infinity);
      const active = body.state.alive !== false && body.group.visible && (REACTING.has(body.state.action) || since < VEIL_LINGER);
      if (!active) this.big.delete(id);
      const want = active && since >= VEIL_DELAY ? this.big.has(id) ? 1 : VEIL_LIGHT : 0;
      let w = this.weights.get(id) ?? 0;
      w = want > w ? Math.min(want, w + dt / VEIL_IN) : Math.max(want, w - dt / VEIL_OUT);
      this.weights.set(id, w);
      if (w > .002) order.push(body);
    }
    order.sort(this.byWeight);
    for (let i = 0; i < VEIL_BODIES; i++) {
      const a = uniforms.uVeilA.value[i], b = uniforms.uVeilB.value[i], body = order[i];
      if (!body) { b.w = 0; continue; }
      const bulk = drawnBulk(body), w = this.weights.get(body.state.id) ?? 0;
      this.span(body, bulk);
      const wide = VEIL_LIGHT < 1 ? THREE.MathUtils.clamp((w - VEIL_LIGHT) / (1 - VEIL_LIGHT), 0, 1) : 0;
      a.set(_feet.x, _feet.y, _feet.z, (VEIL_RADIUS + (VEIL_WIDE - VEIL_RADIUS) * wide) * bulk);
      b.set(_head.x, _head.y, _head.z, w);
    }
  }
  private span(body: Fighter, bulk: number) {
    const joints = body.joints, p = body.group.position;
    const head = joints?.get('Head');
    if (!head || body.model?.visible === false) { _feet.set(p.x, p.y, p.z); _head.set(p.x, p.y + 1.95 * bulk, p.z); }
    else {
      head.getWorldPosition(_head);
      let low = Infinity;
      for (let i = 0; i < FEET.length; i++) { const bone = joints!.get(FEET[i]); if (!bone) continue; bone.getWorldPosition(_joint); if (_joint.y < low) { low = _joint.y; _feet.copy(_joint); } }
      if (!Number.isFinite(low)) _feet.set(p.x, p.y, p.z);
    }
    _joint.subVectors(_head, _feet); const length = _joint.length();
    if (length > 1e-4) { _joint.multiplyScalar(VEIL_PAD / length); _head.add(_joint); _feet.sub(_joint); }
  }
}
