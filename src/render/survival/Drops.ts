import * as THREE from 'three';
import type { VfxKit } from '../vfx/VfxKit';
import { SPRITE, ORIENT } from '../vfx/SparkField';
import { LENS_NEAR, shrinkNearLens } from './lensNear';

export interface DropView { id: number; kind: 'xp' | 'heal' | 'meter' | 'magnet' | 'bomb' | 'chest'; value: number; x: number; y: number; z: number; pulled: boolean }

const MAX = 260, CHESTS = 16, BEAMS = 24;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

const CRYSTAL_VERTEX = `
attribute vec4 aTint;
varying vec3 vNormal; varying vec3 vView; varying vec4 vTint;
${LENS_NEAR}
void main() {
	vec4 world = modelMatrix * instanceMatrix * vec4(position * lensNear((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz), 1.0);
	vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
	vView = normalize(cameraPosition - world.xyz);
	vTint = aTint;
	gl_Position = projectionMatrix * viewMatrix * world;
}`;
const CRYSTAL_FRAGMENT = `
uniform float uTime;
varying vec3 vNormal; varying vec3 vView; varying vec4 vTint;
void main() {
	vec3 n = normalize(vNormal);
	float facet = dot(n, normalize(vec3(.35, .85, .4))) * .5 + .5;
	float rim = pow(1.0 - max(0.0, dot(n, normalize(vView))), 2.2);
	vec3 color = vTint.rgb * (.35 + .75 * facet) + vec3(1.0) * rim * .55;
	// A glint sweeps across the faces now and then.
	float glint = pow(max(0.0, sin(uTime * 2.6 + vTint.w * 6.2831 + dot(n, vec3(1.3, .6, -.9)) * 3.2)), 28.0);
	color += vec3(1.2) * glint;
	// An ink edge where the faces turn away, for the manga line.
	color *= mix(1.0, .25, smoothstep(.72, .95, rim) * .6);
	gl_FragColor = vec4(color, 1.0);
}`;
const HALO_VERTEX = `
attribute vec4 aTint; attribute vec4 aShape;
varying vec2 vUv; varying vec4 vTint; varying vec4 vShape;
${LENS_NEAR}
void main() {
	vUv = position.xy; vTint = aTint; vShape = aShape;
	vec3 centre = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float size = length(instanceMatrix[0].xyz) * lensNear(centre);
	vec4 mv = viewMatrix * vec4(centre, 1.0);
	mv.xy += position.xy * size;
	gl_Position = projectionMatrix * mv;
}`;
const HALO_FRAGMENT = `
uniform float uTime;
varying vec2 vUv; varying vec4 vTint; varying vec4 vShape;
void main() {
	float r = length(vUv), a = atan(vUv.y, vUv.x);
	if (r > 1.0) discard;
	float seed = vShape.y, kind = vShape.x;
	float glow = pow(1.0 - r, 3.0) * .75;
	float spin = uTime * (kind > 2.5 && kind < 3.5 ? -3.5 : .7) + seed * 6.2831;
	float twinkle = .55 + .45 * sin(uTime * 6.0 + seed * 40.0);
	// A four-point star, long arms and short.
	float star = pow(abs(cos((a + spin) * 2.0)), 90.0) * pow(1.0 - r, 1.3) * twinkle * 1.6;
	star += pow(abs(cos((a + spin + .785) * 2.0)), 140.0) * pow(1.0 - r, 2.5) * twinkle * .7;
	float core = pow(max(0.0, 1.0 - r * 3.2), 2.0);
	float extra = 0.0;
	if (kind > .5 && kind < 1.5) {
		// A heart of light.
		vec2 p = vUv * 2.4; p.y += .25;
		float h = pow(p.x * p.x + p.y * p.y - .5, 3.0) - p.x * p.x * p.y * p.y * p.y;
		extra = (1.0 - smoothstep(-.03, .03, h)) * (.8 + .2 * sin(uTime * 8.0));
	} else if (kind > 1.5 && kind < 2.5) {
		// Crackles round the meter orb.
		float bolt = abs(fract((a + uTime * 3.0) * 1.9 + sin(r * 30.0 + uTime * 20.0) * .08) - .5);
		extra = (1.0 - smoothstep(.0, .06, bolt)) * smoothstep(.3, .45, r) * (1.0 - smoothstep(.6, .85, r)) * step(.5, fract(uTime * 5.0 + seed));
	} else if (kind > 2.5 && kind < 3.5) {
		// A vortex.
		float arms = sin(a * 3.0 + r * 14.0 - uTime * 9.0);
		extra = smoothstep(.55, 1.0, arms) * smoothstep(.1, .3, r) * (1.0 - smoothstep(.6, .95, r)) * .9;
	}
	vec3 color = vTint.rgb * (glow + star + extra * 1.2) + vec3(1.0) * (core * .9 + star * .35);
	float alpha = clamp(glow + star + core + extra, 0.0, 1.0) * vTint.w;
	if (alpha < .01) discard;
	gl_FragColor = vec4(color * vTint.w, alpha);
}`;
const BEAM_VERTEX = `
attribute vec4 aTint;
varying vec2 vUv; varying vec4 vTint;
${LENS_NEAR}
void main() {
	vUv = uv; vTint = aTint;
	vec3 centre = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	vec3 toCam = cameraPosition - centre; toCam.y = 0.0;
	vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam + vec3(1e-4))));
	float w = length(instanceMatrix[0].xyz) * lensNear(centre), h = length(instanceMatrix[1].xyz);
	vec3 world = centre + side * position.x * w + vec3(0.0, 1.0, 0.0) * position.y * h;
	gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const BEAM_FRAGMENT = `
uniform float uTime;
varying vec2 vUv; varying vec4 vTint;
void main() {
	float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
	float body = pow(across, 3.0) * pow(1.0 - vUv.y, 1.4);
	float core = pow(across, 18.0) * (1.0 - vUv.y) * 1.6;
	float ripple = .8 + .2 * sin(vUv.y * 24.0 - uTime * 6.0);
	float alpha = (body * ripple + core) * vTint.w;
	if (alpha < .005) discard;
	gl_FragColor = vec4(vTint.rgb * alpha + vec3(1.0) * core * .6 * vTint.w, alpha);
}`;

function chestGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (w: number, h: number, d: number, x: number, y: number, z: number, top: number, side: number) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z);
    const normals = g.getAttribute('normal'), colors: number[] = [];
    const lit = new THREE.Color(top), dark = new THREE.Color(side);
    for (let i = 0; i < normals.count; i++) { const ny = normals.getY(i), nz = normals.getZ(i); const c = ny > .5 ? lit : ny < -.5 ? dark.clone().multiplyScalar(.5) : dark.clone().multiplyScalar(nz > .5 ? 1 : .75); colors.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    parts.push(g);
  };
  add(.9, .42, .56, 0, .21, 0, 0x6a2a1c, 0x3a140c);
  add(.92, .2, .58, 0, .52, 0, 0x7c3422, 0x44180e);
  for (const x of [-.3, .3]) add(.08, .64, .6, x, .31, 0, 0xffe07a, 0xc08a1e);
  add(.94, .05, .6, 0, .42, 0, 0xffe07a, 0xb07c18);
  add(.16, .18, .06, 0, .38, .3, 0xfff3b0, 0xffd04a);
  const merged = new THREE.BufferGeometry();
  const count = parts.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.getAttribute('position').array as Float32Array, o * 3); col.set(g.getAttribute('color').array as Float32Array, o * 3); nor.set(g.getAttribute('normal').array as Float32Array, o * 3); o += g.getAttribute('position').count; g.dispose(); }
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3)); merged.setAttribute('color', new THREE.BufferAttribute(col, 3)); merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return merged;
}

const TINT: Record<DropView['kind'], [number, number, number]> = {
  xp: [.3, .8, 1.25], heal: [.35, 1.7, .55], meter: [.45, .75, 2.2], magnet: [1.4, .45, 2.1], bomb: [2.2, .35, .15], chest: [2.2, 1.6, .45],
};
const KIND_INDEX: Record<DropView['kind'], number> = { xp: 0, heal: 1, meter: 2, magnet: 3, bomb: 4, chest: 5 };

export class Drops {
  private readonly crystals: THREE.InstancedMesh;
  private readonly halos: THREE.InstancedMesh;
  private readonly beams: THREE.InstancedMesh;
  private readonly chests: THREE.InstancedMesh;
  private readonly bombs: THREE.InstancedMesh;
  private readonly time = { value: 0 };
  private readonly crystalTint: THREE.InstancedBufferAttribute;
  private readonly haloTint: THREE.InstancedBufferAttribute;
  private readonly haloShape: THREE.InstancedBufferAttribute;
  private readonly beamTint: THREE.InstancedBufferAttribute;
  private seen = new Map<number, { x: number; y: number; z: number; pulled: boolean; kind: DropView['kind'] }>();
  private next = new Map<number, { x: number; y: number; z: number; pulled: boolean; kind: DropView['kind'] }>();
  private trail = 0;

  constructor(scene: THREE.Scene, private readonly kit: VfxKit) {
    const uniforms = { uTime: this.time };
    const shard = new THREE.OctahedronGeometry(.095, 0); shard.scale(1, 1.75, 1);
    this.crystalTint = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4); shard.setAttribute('aTint', this.crystalTint);
    this.crystals = new THREE.InstancedMesh(shard, new THREE.ShaderMaterial({ uniforms, vertexShader: CRYSTAL_VERTEX, fragmentShader: CRYSTAL_FRAGMENT, toneMapped: false }), MAX);
    const quad = new THREE.PlaneGeometry(2, 2);
    this.haloTint = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4); this.haloShape = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
    quad.setAttribute('aTint', this.haloTint); quad.setAttribute('aShape', this.haloShape);
    this.halos = new THREE.InstancedMesh(quad, new THREE.ShaderMaterial({ uniforms, vertexShader: HALO_VERTEX, fragmentShader: HALO_FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), MAX);
    const beam = new THREE.PlaneGeometry(1, 1); beam.translate(0, .5, 0);
    this.beamTint = new THREE.InstancedBufferAttribute(new Float32Array(BEAMS * 4), 4); beam.setAttribute('aTint', this.beamTint);
    this.beams = new THREE.InstancedMesh(beam, new THREE.ShaderMaterial({ uniforms, vertexShader: BEAM_VERTEX, fragmentShader: BEAM_FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }), BEAMS);
    this.chests = new THREE.InstancedMesh(chestGeometry(), shrinkNearLens(new THREE.MeshBasicMaterial({ vertexColors: true })), CHESTS);
    this.bombs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.2, 1), shrinkNearLens(new THREE.MeshBasicMaterial({ color: 0x120c10 })), CHESTS);
    for (const mesh of [this.crystals, this.halos, this.beams, this.chests, this.bombs]) { mesh.count = 0; mesh.frustumCulled = false; scene.add(mesh); }
    this.crystals.name = 'survival-drops'; this.halos.renderOrder = 4; this.beams.renderOrder = 3;
  }

  update(drops: readonly DropView[], time: number, dt: number, lens?: THREE.Vector3) {
    this.time.value = time;
    const k = this.kit;
    let c = 0, h = 0, b = 0, chest = 0, bomb = 0;
    this.trail += dt;
    const trailing = this.trail > .045;
    if (trailing) this.trail = 0;
    let streaks = 0;
    this.next.clear();
    for (const drop of drops) {
      if (h >= MAX) break;
      const seed = (drop.id * .61803) % 1;
      const bob = drop.pulled ? 0 : Math.sin(time * 2.6 + drop.id) * .07;
      const x = drop.x, y = drop.y + bob, z = drop.z;
      const tint = TINT[drop.kind];
      if (lens && Math.hypot(x - lens.x, y - lens.y, z - lens.z) < 1.2) continue;
      const big = drop.kind === 'xp' ? Math.min(1.15, .75 + Math.sqrt(drop.value) * .14) : 1;
      if (drop.kind === 'xp' || drop.kind === 'meter' || drop.kind === 'heal') {
        const warm = drop.kind === 'xp' ? Math.min(1, Math.max(0, (drop.value - 3) / 12)) : 0;
        _q.setFromEuler(_e.set(Math.sin(time + seed * 9) * .25, time * 2.2 + seed * 6.28, 0));
        _m.compose(_p.set(x, y, z), _q, _s.setScalar(big * (drop.kind === 'xp' ? 1 : .9)));
        this.crystals.setMatrixAt(c, _m);
        this.crystalTint.setXYZW(c++, tint[0] + warm * .12, tint[1] + warm * .35, tint[2] + warm * .25, seed);
      }
      if (drop.kind === 'bomb' && bomb < CHESTS) {
        _m.compose(_p.set(x, y, z), _q.identity(), _s.setScalar(1)); this.bombs.setMatrixAt(bomb++, _m);
        if (trailing && Math.random() < .5) k.hitSpark(x + .08, y + .2, z, { spike: 0xfff2b0, rim: 0xff6a1e, light: 0xff7a2a, ink: 0x100404 }, 0, time);
      }
      if (drop.kind === 'chest' && chest < CHESTS) {
        _q.setFromEuler(_e.set(0, time * .8 + seed * 6.28, 0));
        _m.compose(_p.set(x, Math.max(.05, y - .35), z), _q, _s.setScalar(1)); this.chests.setMatrixAt(chest++, _m);
      }
      const haloSize = (drop.kind === 'xp' ? .42 : drop.kind === 'chest' ? .95 : .62) * big;
      _m.compose(_p.set(x, y + (drop.kind === 'chest' ? .05 : 0), z), _q.identity(), _s.setScalar(haloSize));
      this.halos.setMatrixAt(h, _m);
      this.haloTint.setXYZW(h, tint[0], tint[1], tint[2], 1);
      this.haloShape.setXYZW(h++, KIND_INDEX[drop.kind], seed, 0, 0);
      if ((drop.kind === 'chest' || drop.kind === 'magnet' || drop.kind === 'bomb') && b < BEAMS && !drop.pulled) {
        _m.compose(_p.set(x, 0, z), _q.identity(), _s.set(drop.kind === 'chest' ? 1.1 : .7, drop.kind === 'chest' ? 9 : 6, 1));
        this.beams.setMatrixAt(b, _m); this.beamTint.setXYZW(b++, tint[0] * .5, tint[1] * .5, tint[2] * .5, drop.kind === 'chest' ? .85 : .55);
      }
      const last = this.seen.get(drop.id);
      if (drop.pulled && last && trailing && streaks < 48) {
        const vx = (x - last.x) / Math.max(dt, 1e-3), vy = (y - last.y) / Math.max(dt, 1e-3), vz = (z - last.z) / Math.max(dt, 1e-3);
        if (vx * vx + vy * vy + vz * vz > 4) {
          streaks++;
          const sp = k.sparks.spec;
          sp.reset(SPRITE.streak, time, .16).pos(x, y, z).velocity(vx * .2, vy * .2, vz * .2);
          sp.orient = ORIENT.velocity; sp.sized(.06 * big, .03, .5); sp.stretch = 5; sp.drag = 6;
          sp.hot(0xffffff, 1.8).cool(new THREE.Color(tint[0] / 2.2, tint[1] / 2.2, tint[2] / 2.2).getHex(), .3); k.sparks.emit();
        }
      }
      this.next.set(drop.id, { x, y, z, pulled: drop.pulled, kind: drop.kind });
    }
    for (const [id, last] of this.seen) {
      if (this.next.has(id) || !last.pulled) continue;
      const tint = TINT[last.kind];
      const hex = new THREE.Color(tint[0] / 2.2, tint[1] / 2.2, tint[2] / 2.2).getHex();
      if (last.kind === 'xp') { if (Math.random() < .5) k.hitSpark(last.x, last.y, last.z, { spike: 0xffffff, rim: hex, light: hex, ink: 0x06121a }, 0, time); }
      else { k.hitSpark(last.x, last.y, last.z, { spike: 0xffffff, rim: hex, light: hex, ink: 0x06121a }, 2, time); k.ring(last.x, last.y - .9, last.z, .3, 2.6, time, .35, 0xffffff, hex, .2, 'flat'); }
    }
    [this.seen, this.next] = [this.next, this.seen];
    this.crystals.count = c; this.halos.count = h; this.beams.count = b; this.chests.count = chest; this.bombs.count = bomb;
    for (const mesh of [this.crystals, this.halos, this.beams, this.chests, this.bombs]) if (mesh.count) mesh.instanceMatrix.needsUpdate = true;
    this.crystalTint.needsUpdate = c > 0; this.haloTint.needsUpdate = this.haloShape.needsUpdate = h > 0; this.beamTint.needsUpdate = b > 0;
  }

  clear() { this.seen.clear(); this.next.clear(); for (const mesh of [this.crystals, this.halos, this.beams, this.chests, this.bombs]) mesh.count = 0; }
  dispose() { for (const mesh of [this.crystals, this.halos, this.beams, this.chests, this.bombs]) { mesh.removeFromParent(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose(); } }
}
