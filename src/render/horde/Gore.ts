import * as THREE from 'three';
import { GRUNTS, type Ichor } from '../../survival/horde/kinds';
import { DEATH, GORE } from '../../survival/horde/Horde';
import { shrinkNearLens } from '../survival/lensNear';

const DROPS = 700, STAINS = 520;
export const ICHOR: Record<Ichor, THREE.Color> = {
  red: new THREE.Color(.26, .008, .014), black: new THREE.Color(.05, .012, .02), white: new THREE.Color(.34, .35, .3),
  green: new THREE.Color(.032, .066, .012), oil: new THREE.Color(.03, .03, .035), purple: new THREE.Color(.08, .008, .07),
};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const FORWARD = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);

interface Drop { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; size: number; life: number; age: number; ichor: Ichor; stain: boolean }
interface Stain { alive: boolean; x: number; z: number; size: number; rot: number; born: number; life: number; ichor: Ichor; variant: number; grow: number }

const STAIN_VERTEX = `
attribute vec4 aStain;
attribute vec3 aTint;
varying vec2 vUv;
varying vec4 vStain;
varying vec3 vTint;
void main() {
	vUv = uv; vStain = aStain; vTint = aTint;
	gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( position, 1.0 );
}`;
const STAIN_FRAGMENT = `
uniform sampler2D uSplat;
varying vec2 vUv;
varying vec4 vStain;
varying vec3 vTint;
void main() {
	// Four splats in a 2x2 atlas; x is which, y how much is left.
	vec2 cell = vec2( mod( vStain.x, 2.0 ), floor( vStain.x / 2.0 ) );
	float a = texture2D( uSplat, ( vUv + cell ) * .5 ).r;
	float alpha = smoothstep( .45, .55, a ) * vStain.y;
	if ( alpha < .01 ) discard;
	// Darker at the rim, a little wet sheen toward the middle - soaked into
	// the floor rather than painted on it.
	float rim = 1.0 - smoothstep( .5, .62, a );
	vec3 color = vTint * ( .55 + .55 * smoothstep( .55, .95, a ) ) * ( 1.0 - rim * .45 );
	gl_FragColor = vec4( color, alpha * .88 );
	#include <colorspace_fragment>
}`;

export class Gore {
  private readonly drops: Drop[] = [];
  private readonly stains: Stain[] = [];
  private readonly dropMesh: THREE.InstancedMesh;
  private readonly stainMesh: THREE.InstancedMesh;
  private readonly stainAttr: THREE.InstancedBufferAttribute;
  private readonly tintAttr: THREE.InstancedBufferAttribute;
  private cursor = 0;
  private stainCursor = 0;
  density = 1;
  private readonly splats = splatTexture();
  private painted = false;
  prepare() { if (this.painted) return; this.painted = true; paintSplats(this.splats.image.data as Uint8Array); this.splats.needsUpdate = true; }

  constructor(scene: THREE.Scene) {
    const gem = new THREE.OctahedronGeometry(1, 0);
    this.dropMesh = new THREE.InstancedMesh(gem, shrinkNearLens(new THREE.MeshBasicMaterial({ color: 0xffffff })), DROPS);
    this.dropMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DROPS * 3), 3);
    this.dropMesh.count = 0; this.dropMesh.frustumCulled = false; this.dropMesh.name = 'gore-drops';
    for (let i = 0; i < DROPS; i++) this.drops.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: .03, life: 1, age: 0, ichor: 'red', stain: false });
    const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.stainAttr = new THREE.InstancedBufferAttribute(new Float32Array(STAINS * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.tintAttr = new THREE.InstancedBufferAttribute(new Float32Array(STAINS * 3), 3).setUsage(THREE.DynamicDrawUsage);
    quad.setAttribute('aStain', this.stainAttr); quad.setAttribute('aTint', this.tintAttr);
    const idle = (globalThis as { requestIdleCallback?: (work: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => this.prepare(), { timeout: 5000 }); else setTimeout(() => this.prepare(), 1000);
    const material = new THREE.ShaderMaterial({ uniforms: { uSplat: { value: this.splats } }, vertexShader: STAIN_VERTEX, fragmentShader: STAIN_FRAGMENT,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    this.stainMesh = new THREE.InstancedMesh(quad, material, STAINS);
    this.stainMesh.count = 0; this.stainMesh.frustumCulled = false; this.stainMesh.renderOrder = -2; this.stainMesh.name = 'gore-stains';
    for (let i = 0; i < STAINS; i++) this.stains.push({ alive: false, x: 0, z: 0, size: 1, rot: 0, born: 0, life: 20, ichor: 'red', variant: 0, grow: 1 });
    scene.add(this.dropMesh, this.stainMesh);
  }

  death(x: number, y: number, z: number, kind: number, death: number, gore: number, dx: number, dz: number, time: number) {
    const def = GRUNTS[kind];
    if (!def) return;
    const ichor = def.ichor, h = def.height;
    if (death === DEATH.BURST) {
      this.spray(x, y + h * .5, z, 0, 1, 0, 70, 9, 1, ichor, true);
      this.stain(x, z, 2.4 + def.radius * 2, ichor, time);
      return;
    }
    if (death === DEATH.ASH) return;
    this.spray(x, y + h * .6, z, dx, .45, dz, death === DEATH.BLOWN ? 20 : 14, 5.5, .55, ichor, true);
    if (gore & GORE.HEAD) this.spray(x, y + h * .92, z, dx * .3, 1, dz * .3, 34, 6.5, .35, ichor, true);
    if (gore & (GORE.ARM_L | GORE.ARM_R)) this.spray(x, y + h * .78, z, dx, .6, dz, 20, 5, .45, ichor, true);
    if (gore & GORE.WAIST) this.spray(x, y + h * .5, z, 0, .8, 0, 40, 6, .8, ichor, true);
    this.stain(x + dx * .6, z + dz * .6, 1.1 + def.radius * 1.6, ichor, time + .4);
  }

  hit(x: number, y: number, z: number, kind: number, dx: number, dz: number) {
    const def = GRUNTS[kind];
    if (def) this.spray(x, y, z, dx, .35, dz, 6, 4, .5, def.ichor, false);
  }

  spray(x: number, y: number, z: number, dx: number, dy: number, dz: number, count: number, speed: number, spread: number, ichor: Ichor, stain: boolean) {
    _v.set(dx, dy, dz);
    if (_v.lengthSq() < 1e-6) _v.set(0, 1, 0);
    _v.normalize();
    const n = Math.round(count * Math.max(.3, this.density));
    for (let i = 0; i < n; i++) {
      const d = this.drops[this.cursor]; this.cursor = (this.cursor + 1) % DROPS;
      const s = speed * (.35 + Math.random() * .9);
      d.alive = true; d.x = x; d.y = y; d.z = z;
      d.vx = (_v.x + (Math.random() - .5) * 2 * spread) * s; d.vy = (_v.y + Math.random() * spread) * s; d.vz = (_v.z + (Math.random() - .5) * 2 * spread) * s;
      d.size = .025 + Math.random() * .045; d.life = .7 + Math.random() * .8; d.age = 0; d.ichor = ichor; d.stain = stain && Math.random() < .12;
    }
  }

  stain(x: number, z: number, size: number, ichor: Ichor, time: number) {
    const st = this.stains[this.stainCursor]; this.stainCursor = (this.stainCursor + 1) % STAINS;
    st.alive = true; st.x = x; st.z = z; st.size = size * (.8 + Math.random() * .4); st.rot = Math.random() * Math.PI * 2;
    st.born = time; st.life = 100 + Math.random() * 40; st.ichor = ichor; st.variant = Math.floor(Math.random() * 4); st.grow = .35;
  }

  update(dt: number, time: number) {
    let n = 0;
    for (const d of this.drops) {
      if (!d.alive) continue;
      d.age += dt;
      d.vy -= 16 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      if (d.y <= .02) {
        d.alive = false;
        if (d.stain) this.stain(d.x, d.z, .25 + d.size * 6, d.ichor, time);
        continue;
      }
      if (d.age > d.life) { d.alive = false; continue; }
      _v.set(d.vx, d.vy, d.vz);
      const speed = _v.length();
      _q.setFromUnitVectors(FORWARD, speed > 1e-4 ? _v.multiplyScalar(1 / speed) : UP);
      const thin = d.size * (1 - .5 * Math.min(1, d.age / d.life));
      _m.compose(_p.set(d.x, d.y, d.z), _q, _s.set(thin, thin, thin * (1 + Math.min(2.4, speed * .22))));
      this.dropMesh.setMatrixAt(n, _m); this.dropMesh.setColorAt(n, ICHOR[d.ichor]);
      n++;
    }
    this.dropMesh.count = n;
    if (n) { this.dropMesh.instanceMatrix.needsUpdate = true; this.dropMesh.instanceColor!.needsUpdate = true; }
    let m = 0;
    for (const st of this.stains) {
      if (!st.alive) continue;
      const age = time - st.born;
      if (age < 0) continue;
      if (age > st.life) { st.alive = false; continue; }
      st.grow = Math.min(1, st.grow + dt * 4);
      const left = Math.min(1, (st.life - age) / 4);
      _q.setFromAxisAngle(UP, st.rot);
      _m.compose(_p.set(st.x, .014 + (m % 7) * .0015, st.z), _q, _s.set(st.size * st.grow, 1, st.size * st.grow));
      this.stainMesh.setMatrixAt(m, _m);
      this.stainAttr.setXYZW(m, st.variant, left, 0, 0);
      const c = ICHOR[st.ichor];
      this.tintAttr.setXYZ(m, c.r, c.g, c.b);
      m++;
    }
    this.stainMesh.count = m;
    if (m) { this.stainMesh.instanceMatrix.needsUpdate = true; this.stainAttr.needsUpdate = true; this.tintAttr.needsUpdate = true; }
  }

  clear() { for (const d of this.drops) d.alive = false; for (const st of this.stains) st.alive = false; this.dropMesh.count = 0; this.stainMesh.count = 0; }
  dispose() {
    this.dropMesh.geometry.dispose(); (this.dropMesh.material as THREE.Material).dispose(); this.dropMesh.removeFromParent();
    this.stainMesh.geometry.dispose(); (this.stainMesh.material as THREE.ShaderMaterial).uniforms.uSplat.value.dispose(); (this.stainMesh.material as THREE.Material).dispose(); this.stainMesh.removeFromParent();
  }
}

const SPLAT_SIZE = 256;
function splatTexture() {
  const texture = new THREE.DataTexture(new Uint8Array(SPLAT_SIZE * SPLAT_SIZE * 4), SPLAT_SIZE, SPLAT_SIZE);
  texture.needsUpdate = true; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function paintSplats(data: Uint8Array) {
  const size = SPLAT_SIZE, half = size / 2;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * half, oy = Math.floor(cell / 2) * half;
    const lobes = Array.from({ length: 7 }, () => ({ a: rnd() * Math.PI * 2, r: .18 + rnd() * .16, w: .3 + rnd() * .5 }));
    const drops = Array.from({ length: 14 }, () => { const a = rnd() * Math.PI * 2, r = .3 + rnd() * .16; return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: .015 + rnd() * .035 }; });
    for (let y = 0; y < half; y++) for (let x = 0; x < half; x++) {
      const u = (x + .5) / half * 2 - 1, v = (y + .5) / half * 2 - 1, r = Math.sqrt(u * u + v * v), a = Math.atan2(v, u);
      let edge = .32;
      for (const lobe of lobes) edge += lobe.r * Math.pow(Math.max(0, Math.cos(a - lobe.a)), 8 / lobe.w) * .6;
      let value = Math.max(0, 1 - r / edge) * 1.3;
      for (const d of drops) { const du = u - d.x, dv = v - d.y; value = Math.max(value, 1 - Math.sqrt(du * du + dv * dv) / d.s); }
      const i = ((oy + y) * size + ox + x) * 4, c = Math.round(Math.max(0, Math.min(1, value)) * 255);
      data[i] = data[i + 1] = data[i + 2] = c; data[i + 3] = 255;
    }
  }
}
