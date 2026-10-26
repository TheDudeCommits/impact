import * as THREE from 'three';
import { noiseTexture } from '../noiseTexture';

const SHELL_LIFE = .5, PILLAR_LIFE = .85, VORTEX_LIFE = .62;
export const BURST = { shell: 1, pillar: 2, vortex: 4, all: 7 } as const;

const SHELL_VERTEX = `
varying vec3 vN; varying vec3 vW; varying vec2 vUv;
void main(){
  vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const SHELL_FRAGMENT = `
uniform float uAge; uniform float uTime; uniform vec3 uHot; uniform vec3 uCore; uniform vec3 uDeep; uniform sampler2D uNoise; uniform float uNear;
varying vec3 vN; varying vec3 vW; varying vec2 vUv;
void main(){
  vec3 v = normalize(cameraPosition - vW);
  float facing = abs(dot(normalize(vN), v)), rim = 1. - facing;
  float t = uTime;
  vec2 p = vec2(vUv.x * 3., vUv.y * 1.2 - t * 1.6);
  float n = texture2D(uNoise, p).g * .65 + texture2D(uNoise, p * 2.1 + .3).b * .35;
  // Deep pools in the glass and bright streaks up it.
  float pool = smoothstep(.62, .66, n) * smoothstep(.15, .5, facing);
  float streak = smoothstep(.7, .74, texture2D(uNoise, vec2(vUv.x * 6., vUv.y * .5 - t * 2.4)).r);
  vec3 col = mix(uCore, uHot * 1.6, smoothstep(.45, .92, rim));
  col = mix(col, uDeep * .7, pool * .85);
  col = mix(col, uHot * 1.3, streak * .5);
  float fade = 1. - smoothstep(.45, 1., uAge);
  // Glass: clear where it faces the lens, burning where it turns away - a wall of colour from close up otherwise.
  float a = clamp(mix(.1, 1., smoothstep(.35, .9, rim)) + pool * .3, 0., 1.) * fade;
  // Its foot is in the floor's light; its tip thins into the pillar.
  a *= smoothstep(.0, .06, vUv.y) * (1. - smoothstep(.9, 1., vUv.y) * .6) * uNear;
  gl_FragColor = vec4(col * a, a);
}`;

const PILLAR_FRAGMENT = `
uniform float uAge; uniform float uTime; uniform vec3 uHot; uniform vec3 uCore; uniform sampler2D uNoise;
varying vec3 vN; varying vec3 vW; varying vec2 vUv;
void main(){
  vec3 v = normalize(cameraPosition - vW);
  float facing = abs(dot(normalize(vN), v));
  float t = uTime;
  float n = texture2D(uNoise, vec2(vUv.x * 4., vUv.y * 2.5 - t * 3.)).g;
  float streak = smoothstep(.55, .75, n);
  // White down its heart, the aura's colour at its sides, ragged with rising streaks; thinning as it rises.
  vec3 col = mix(uCore * 1.4, uHot * 2.6, smoothstep(.35, .95, facing));
  col += uHot * streak * .6;
  float rise = 1. - smoothstep(.25, 1., vUv.y);
  float fade = (1. - smoothstep(.35, 1., uAge)) * smoothstep(.0, .06, uAge);
  float a = clamp(smoothstep(.0, .35, facing) * (.55 + .45 * streak), 0., 1.) * rise * fade;
  gl_FragColor = vec4(col * a, a * .85);
}`;

const VORTEX_FRAGMENT = `
uniform float uAge; uniform float uTime; uniform vec3 uHot; uniform vec3 uCore; uniform vec3 uDeep; uniform sampler2D uNoise;
varying vec3 vN; varying vec3 vW; varying vec2 vUv;
void main(){
  vec3 v = normalize(cameraPosition - vW);
  // Two flat tones, light where the ribbon faces the lens and its shadow where it turns away: drawn, not shaded.
  float lit = step(.45, abs(dot(normalize(vN), v)));
  vec3 col = mix(uDeep * 1.4, uCore * 1.25, lit);
  // The ribbon's own edges burn; its tail tears away first.
  float across = abs(vUv.y * 2. - 1.);
  col = mix(col, uHot * 1.5, smoothstep(.72, .86, across));
  float tear = texture2D(uNoise, vec2(vUv.x * 2.2 - uTime * .8, vUv.y * .7)).g;
  float gone = uAge * 1.25 + (1. - vUv.x) * .55;
  if (tear < gone - .45) discard;
  float a = (1. - smoothstep(.88, 1., across)) * smoothstep(.0, .08, vUv.x) * (1. - smoothstep(.85, 1., vUv.x));
  gl_FragColor = vec4(col * a, a);
}`;

function teardrop() {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, y = t;
    const r = Math.sin(Math.PI * Math.pow(t, .62)) * (1 - t * .25) * .5;
    points.push(new THREE.Vector2(Math.max(.001, r), y));
  }
  return new THREE.LatheGeometry(points, 40);
}

function ribbon(turns: number, rise: number, width: number) {
  const segs = 64, positions: number[] = [], normals: number[] = [], uvs: number[] = [], index: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, a = u * turns * Math.PI * 2, r = .55 + u * .65, y = u * rise;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    const w = width * Math.sin(Math.PI * Math.min(1, u * 1.15));
    const ox = Math.cos(a) * w * .5, oz = Math.sin(a) * w * .5, oy = w * .8;
    positions.push(cx - ox, y - oy, cz - oz, cx + ox, y + oy, cz + oz);
    const nx = -Math.sin(a), nz = Math.cos(a);
    normals.push(nx, 0, nz, nx, 0, nz);
    uvs.push(u, 0, u, 1);
    if (i < segs) { const k = i * 2; index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  return g;
}

interface Burst {
  group: THREE.Group;
  shell: THREE.Mesh<THREE.LatheGeometry, THREE.ShaderMaterial>;
  pillar: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  vortex: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[];
  born: number; scale: number; owner?: THREE.Object3D; live: boolean; parts: number;
  unlinked: number;
}

const premultiplied = { transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor } as const;

export class AuraBurst {
  private pool: Burst[] = [];
  private teardrop = teardrop();
  private column = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true).translate(0, .5, 0);
  private ribbons = [ribbon(1.4, 2.4, .7), ribbon(1.1, 1.6, .9), ribbon(1.7, 3, .55)];
  constructor(private scene: THREE.Scene, size = 3) {
    for (let i = 0; i < size; i++) this.pool.push(this.build());
  }

  private material(fragmentShader: string) {
    return new THREE.ShaderMaterial({ name: 'AuraBurst', vertexShader: SHELL_VERTEX, fragmentShader, ...premultiplied,
      uniforms: { uAge: { value: 0 }, uTime: { value: 0 }, uNear: { value: 1 }, uHot: { value: new THREE.Color() }, uCore: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uNoise: { value: noiseTexture() } } });
  }

  private build(): Burst {
    const group = new THREE.Group(); group.name = 'aura-burst';
    const shell = new THREE.Mesh(this.teardrop, this.material(SHELL_FRAGMENT)); shell.renderOrder = 3;
    const pillar = new THREE.Mesh(this.column, this.material(PILLAR_FRAGMENT)); pillar.renderOrder = 3;
    const vortex = this.ribbons.map(r => { const m = new THREE.Mesh(r, this.material(VORTEX_FRAGMENT)); m.renderOrder = 4; return m; });
    group.add(shell, pillar, ...vortex);
    const burst: Burst = { group, shell, pillar, vortex, born: -1e9, scale: 1, live: false, parts: BURST.all, unlinked: 2 + vortex.length };
    for (const o of [shell, pillar, ...vortex]) {
      o.frustumCulled = false; o.castShadow = o.receiveShadow = false;
      o.onAfterRender = () => { if (!o.userData.linked) { o.userData.linked = true; burst.unlinked--; } };
    }
    group.scale.setScalar(1e-4);
    this.scene.add(group);
    return burst;
  }

  fire(at: THREE.Vector3, time: number, hot: THREE.Color, core: THREE.Color, deep: THREE.Color, scale = 1, owner?: THREE.Object3D, parts: number = BURST.all) {
    let burst = this.pool.find(b => !b.live);
    if (!burst) { burst = this.pool.reduce((a, b) => (a.born < b.born ? a : b)); }
    burst.live = true; burst.born = time; burst.scale = scale; burst.owner = owner; burst.parts = parts;
    burst.group.position.copy(at); burst.group.visible = true; burst.group.scale.setScalar(1);
    for (const mesh of [burst.shell, burst.pillar, ...burst.vortex]) {
      const u = mesh.material.uniforms;
      (u.uHot.value as THREE.Color).copy(hot); (u.uCore.value as THREE.Color).copy(core); (u.uDeep.value as THREE.Color).copy(deep);
    }
    burst.vortex.forEach((m, i) => { m.rotation.y = Math.random() * Math.PI * 2 + i * 2.1; });
  }

  private eye?: THREE.Vector3;
  update(time: number, dt: number, eye?: THREE.Vector3) {
    this.eye = eye;
    for (const b of this.pool) {
      if (!b.live) { if (b.group.visible && !b.unlinked) { b.group.visible = false; b.group.scale.setScalar(1); } continue; }
      const age = time - b.born;
      if (age > Math.max(SHELL_LIFE, PILLAR_LIFE, VORTEX_LIFE) || age < -.5) { this.retire(b); continue; }
      if (b.owner) { b.group.position.x = b.owner.position.x; b.group.position.z = b.owner.position.z; }
      const s = b.scale;
      const ks = Math.min(1, age / SHELL_LIFE), shellIn = 1 - Math.pow(1 - Math.min(1, age / .12), 3);
      const near = this.eye ? THREE.MathUtils.smoothstep(Math.hypot(this.eye.x - b.group.position.x, this.eye.z - b.group.position.z), 3.4 * s, 5.2 * s) : 1;
      b.shell.material.uniforms.uNear.value = near;
      b.shell.visible = ks < 1 && near > .02 && (b.parts & BURST.shell) !== 0;
      b.shell.scale.set(1.9 * s * (.75 + .3 * shellIn + .12 * ks), 3.7 * s * (.8 + .2 * shellIn + .08 * ks), 1.9 * s * (.75 + .3 * shellIn + .12 * ks));
      b.shell.material.uniforms.uAge.value = ks; b.shell.material.uniforms.uTime.value = time;
      const kp = Math.min(1, age / PILLAR_LIFE);
      b.pillar.visible = kp < 1 && (b.parts & BURST.pillar) !== 0;
      const width = (.55 + .5 * Math.exp(-age * 6) + .06 * Math.sin(age * 40)) * s * (1 - kp * .5);
      b.pillar.scale.set(width, 26 * s * Math.min(1, age / .1), width);
      b.pillar.material.uniforms.uAge.value = kp; b.pillar.material.uniforms.uTime.value = time;
      const kv = Math.min(1, age / VORTEX_LIFE), out = 1 - Math.pow(1 - kv, 2.2);
      b.vortex.forEach((m, i) => {
        m.visible = kv < 1 && (b.parts & BURST.vortex) !== 0;
        m.scale.set(s * (.8 + 1.8 * out), s * (.9 + .5 * out), s * (.8 + 1.8 * out));
        m.rotation.y += (14 - 10 * kv) * (i % 2 ? -1 : 1) * Math.min(dt, .05);
        m.material.uniforms.uAge.value = kv; m.material.uniforms.uTime.value = time;
      });
    }
  }

  private retire(b: Burst) { b.live = false; b.group.visible = b.unlinked > 0; b.group.scale.setScalar(b.unlinked > 0 ? 1e-4 : 1); }
  reset() { for (const b of this.pool) this.retire(b); }
  dispose() {
    for (const b of this.pool) { b.group.removeFromParent(); for (const m of [b.shell, b.pillar, ...b.vortex]) m.material.dispose(); }
    this.teardrop.dispose(); this.column.dispose(); for (const r of this.ribbons) r.dispose();
  }
}
