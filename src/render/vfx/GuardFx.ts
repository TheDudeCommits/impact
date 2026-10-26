import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';
import { bodyCentre, type VfxKit } from './VfxKit';
import { ORIENT, SPRITE } from './SparkField';
import { elementFor } from './palette';


const SLOTS = 16;
const RADIUS = 1.05;
const FADE_IN = 16, FADE_OUT = 9;
const WEIGHT: Record<string, number> = { light: .55, heavy: .8, special: 1, ultimate: 1.2 };
const FLARE_RISE = .035, FLARE_LIFE = .36;
const SNAP = .2, CALM_SNAP = .08;
const SHATTER = .42;
const BLOCK = 0, PARRY = 1, DEFLECT = 2, BREAK = 3;

interface Slot {
  id: string | null;
  alpha: number;
  integrity: number;
  seed: number;
  hitAt: number; power: number; kind: number;
  hx: number; hy: number; hz: number;
  r: number; g: number; b: number;
  flareAt: number;
  shatterAt: number;
  seenAt: number;
}

export const GUARD_VERTEX = `
attribute vec4 aGuard; attribute vec4 aHit; attribute vec4 aFace; attribute vec4 aTint;
uniform float uCalm;
varying vec3 vObj; varying vec3 vN; varying vec3 vView; varying vec4 vGuard; varying vec4 vHit; varying vec4 vFace; varying vec4 vTint;
void main(){
  vec3 dir = normalize(position);
  float hitAge = aGuard.w, power = aHit.w;
  // Where the blow landed, as an angle over the shell from it.
  float ang = acos(clamp(dot(dir, aHit.xyz), -1.0, 1.0));
  // The dent: the orb gives under the blow and springs back - a damped wobble, or a plain ease with reduced motion.
  float width = .42 + .3 * power;
  float spring = exp(-hitAge * 10.0) * (uCalm > .5 ? 1.0 : cos(hitAge * 38.0));
  float dent = power * .15 * exp(-(ang * ang) / (width * width)) * spring;
  // The ripple: a low swell racing out over the shell from the blow.
  float front = hitAge * (5.0 + 2.5 * power);
  float ripple = power * .045 * exp(-pow((ang - front) / .28, 2.0)) * exp(-hitAge * 4.5);
  vec3 p = dir * (1.0 - dent + ripple);
  vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vObj = dir;
  vN = normalize((modelMatrix * instanceMatrix * vec4(dir, 0.0)).xyz);
  vView = cameraPosition - world.xyz;
  vGuard = aGuard; vHit = aHit; vFace = aFace; vTint = aTint;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

export const GUARD_FRAGMENT = `
uniform float uTime; uniform float uCalm;
varying vec3 vObj; varying vec3 vN; varying vec3 vView; varying vec4 vGuard; varying vec4 vHit; varying vec4 vFace; varying vec4 vTint;
vec3 hash3(vec3 p){
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
// The two nearest cell centres' distances, a hash of the edge between them, and a hash of the nearest cell.
vec4 cells(vec3 x){
  vec3 p = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0; vec3 c1 = vec3(0.0), c2 = vec3(0.0);
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 b = vec3(float(i), float(j), float(k)), r = b + hash3(p + b) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = p + b; } else if (d < d2) { d2 = d; c2 = p + b; }
  }
  return vec4(sqrt(d1), sqrt(d2), fract(sin(dot(c1 + c2, vec3(12.9898, 78.233, 37.719))) * 43758.5453),
    fract(sin(dot(c1, vec3(41.3, 289.1, 97.7))) * 43758.5453));
}
void main(){
  float integrity = vGuard.x, alpha = vGuard.y, seed = vGuard.z, hitAge = vGuard.w;
  float power = vHit.w, flare = vFace.z, shatter = vFace.w, kind = vTint.w;
  vec3 n = normalize(vN), v = normalize(vView), dir = normalize(vObj);
  float rim = pow(1.0 - abs(dot(n, v)), 2.6);
  vec3 level = vec3(dir.x, 0.0, dir.z);
  float front = clamp(dot(level / max(length(level), 1e-4), vec3(vFace.x, 0.0, vFace.y)) * .5 + .5, 0.0, 1.0);
  // The lattice of the shell, fine cells; the cracks, coarse ones - an edge is cracked when its hash is under how
  // spent the guard is, so they spread as it empties and stay where they were.
  vec4 c = cells(dir * 4.2 + seed);
  float lattice = 1.0 - smoothstep(.02, .07, c.y - c.x);
  float spent = max(1.0 - integrity, shatter);
  vec4 k = cells(dir * 2.3 + seed * 1.7 + 11.0);
  float crack = (1.0 - smoothstep(0.0, .03 + .035 * spent, k.y - k.x)) * step(k.z, spent * 1.4 - .3);
  // Breaking, the orb falls apart cell by cell: a cell goes when its hash is under how far the break has gone.
  if (shatter > 0.0 && c.w < shatter * 1.35 - .15) discard;
  vec3 cool = vec3(.55, .86, 1.0), warm = vec3(1.0, .66, .28), danger = vec3(1.0, .2, .16);
  vec3 tint = integrity > .5 ? mix(warm, cool, (integrity - .5) * 2.0) : mix(danger, warm, integrity * 2.0);
  float flicker = uCalm > .5 ? 1.0 : mix(1.0, .5 + .5 * step(.5, fract(uTime * 13.0 + seed)), smoothstep(.3, .06, integrity));
  // The hit point and the ripple, from where the last blow landed: a block's in the guard's white, a parry's white-hot,
  // a deflected shot's in the shot's own colour, a break's in the guard's dying colour.
  float ang = acos(clamp(dot(dir, vHit.xyz), -1.0, 1.0));
  float speed = 6.0 + 3.0 * power, at = ang - hitAge * speed;
  float ring = exp(-pow(at / (.14 + .08 * power), 2.0)) * exp(-hitAge * 3.5) * power * 1.5;
  // The cells the ripple crosses light up as it passes, so it reads wherever the orb is seen from.
  float wake = lattice * exp(-pow(at / .4, 2.0)) * exp(-hitAge * 4.0) * power;
  float mark = exp(-ang * ang * (14.0 - 5.0 * min(power, 1.5))) * exp(-hitAge * (kind > 1.5 ? 5.0 : 8.0)) * power;
  // And the whole bubble shimmers with a blocked blow, as hard as it was: a block reads from any side of it. (A parry
  // has its flare; a break its shatter.)
  float pulse = kind < .5 ? power * exp(-hitAge * 12.0) : 0.0;
  // The parry: energy surges over the whole shell from the contact point, in thin bands, and the rim and the lattice
  // blaze - the face stays clear enough that the fighter inside is seen through it.
  float surge = flare * pow(.5 + .5 * sin(ang * 9.0 - uTime * 42.0), 6.0) * smoothstep(3.3, 0.0, ang - hitAge * 12.0);
  float lit = flare * (rim * 1.25 + lattice * .5) * (gl_FrontFacing ? 1.0 : .5) + flare * flare * .03 + surge * .4;
  float dim = .35 + .65 * integrity;
  // The far wall, seen through the near one: its lattice and rim faint, everything that happens on it - the blow's
  // mark and ripple, the cracks, the parry's surge - as strong as on the near wall.
  float wall = gl_FrontFacing ? 1.0 : .3;
  float glow = (rim * (.35 + .55 * front) + lattice * (.1 + .2 * front) + .02) * dim * flicker * wall;
  // The cracks burn in the guard's colour as it empties: white-hot hairlines at first, amber, then red.
  vec3 crackColour = mix(vec3(1.0, .97, .92), tint * 1.35, smoothstep(.35, .85, spent));
  vec3 contact = mix(vec3(1.0, .98, .95), vTint.rgb, .65);
  float shimmer = pulse * (lattice * .9 + rim * .6) * wall;
  vec3 col = tint * glow * 1.5 + crackColour * crack * (1.1 + .7 * spent) + tint * shimmer * 1.4
    + contact * (ring * 1.4 + wake * 1.3 + mark * 2.2) + vec3(1.05, 1.0, .98) * lit * 1.1 + crackColour * shatter * lattice * .9;
  // A wall right at the lens (the game camera close behind its own fighter, an orb swelling past it) thins away
  // rather than filling the frame.
  float lens = smoothstep(.35, 1.4, length(vView));
  float a = clamp(glow * .85 + crack * .85 + shimmer * .55 + ring * .8 + wake * .6 + mark * .9 + lit * .6 + shatter * lattice * .45, 0.0, 1.0) * alpha * lens;
  // Bright enough for the bloom to catch the brightest of it, never so bright that it hazes the fighter inside.
  col = min(col, vec3(1.7)) * lens;
  if (a < .003) discard;
  gl_FragColor = vec4(col, a);
}`;

export class GuardFx {
  private readonly geometry = new THREE.IcosahedronGeometry(1, 6);
  private readonly uniforms = { uTime: { value: 0 }, uCalm: { value: 0 } };
  private readonly back = new THREE.ShaderMaterial({ vertexShader: GUARD_VERTEX, fragmentShader: GUARD_FRAGMENT, transparent: true, depthWrite: false, toneMapped: false, side: THREE.BackSide, uniforms: this.uniforms });
  private readonly front = new THREE.ShaderMaterial({ vertexShader: GUARD_VERTEX, fragmentShader: GUARD_FRAGMENT, transparent: true, depthWrite: false, toneMapped: false, side: THREE.FrontSide, uniforms: this.uniforms });
  private readonly mesh: THREE.InstancedMesh;
  private readonly frontMesh: THREE.InstancedMesh;
  private readonly guard = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS * 4), 4);
  private readonly hit = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS * 4), 4);
  private readonly face = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS * 4), 4);
  private readonly tint = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS * 4), 4);
  private readonly slots: Slot[] = Array.from({ length: SLOTS }, (_, i) => ({ id: null, alpha: 0, integrity: 1, seed: i * 7.31,
    hitAt: -1e9, power: 0, kind: BLOCK, hx: 0, hy: 0, hz: 1, r: 1, g: 1, b: 1, flareAt: -1e9, shatterAt: -1e9, seenAt: -1e9 }));
  private readonly byId = new Map<string, number>();
  private readonly matrix = new THREE.Matrix4();
  private readonly centre = new THREE.Vector3();
  private readonly towards = new THREE.Vector3();
  private readonly colour = new THREE.Color();
  reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(scene: THREE.Scene, private readonly kit: VfxKit) {
    for (const [name, attribute] of [['aGuard', this.guard], ['aHit', this.hit], ['aFace', this.face], ['aTint', this.tint]] as const) {
      attribute.setUsage(THREE.DynamicDrawUsage); this.geometry.setAttribute(name, attribute);
    }
    this.mesh = new THREE.InstancedMesh(this.geometry, this.back, SLOTS);
    this.frontMesh = new THREE.InstancedMesh(this.geometry, this.front, SLOTS);
    this.frontMesh.instanceMatrix = this.mesh.instanceMatrix;
    for (const [mesh, name] of [[this.mesh, 'guard-aura'], [this.frontMesh, 'guard-aura-front']] as const) {
      mesh.name = name; mesh.frustumCulled = false; mesh.count = 0;
      mesh.renderOrder = 2;
      scene.add(mesh);
    }
  }

  private slotOf(id: string, time: number) {
    const known = this.byId.get(id);
    if (known !== undefined) return this.slots[known];
    for (let i = 0; i < SLOTS; i++) {
      const s = this.slots[i];
      if (s.id !== null && (s.alpha > .01 || time - s.seenAt < .5)) continue;
      if (s.id !== null) this.byId.delete(s.id);
      s.id = id; s.alpha = 0; s.integrity = 1; s.hitAt = s.flareAt = s.shatterAt = -1e9; s.power = 0; s.kind = BLOCK;
      this.byId.set(id, i);
      return s;
    }
    return undefined;
  }

  event(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (event.kind !== 'blocked' && event.kind !== 'just-guard' && event.kind !== 'guard-break') return;
    const defender = event.targetId ? fighters?.get(event.targetId) : undefined;
    if (!defender) return;
    const time = event.serverTime, slot = this.slotOf(defender.state.id, time);
    const c = event.kind === 'just-guard' && event.endpoint ? this.centre.set(event.endpoint.x, event.endpoint.y, event.endpoint.z) : bodyCentre(defender, this.centre);
    const size = RADIUS * (defender.state.size ?? 1);
    const o = event.origin, source = fighters?.get(event.actorId);
    if (o) this.towards.set(o.x - c.x, o.y - c.y, o.z - c.z);
    else if (source) this.towards.subVectors(source.group.position, c).setY(0);
    else this.towards.set(Math.sin(defender.state.yaw), 0, Math.cos(defender.state.yaw));
    if (this.towards.lengthSq() < 1e-6) this.towards.set(Math.sin(defender.state.yaw), 0, Math.cos(defender.state.yaw));
    this.towards.normalize();
    this.towards.y = THREE.MathUtils.clamp(this.towards.y, -.45, .45); this.towards.normalize();
    const weight = WEIGHT[event.slot ?? 'light'] ?? .6;
    const kind = event.kind === 'blocked' ? BLOCK : event.kind === 'guard-break' ? BREAK : event.reason === 'deflect' ? DEFLECT : PARRY;
    if (slot) {
      slot.hitAt = time; slot.hx = this.towards.x; slot.hy = this.towards.y; slot.hz = this.towards.z; slot.kind = kind;
      this.colour.setHex(kind === DEFLECT ? elementFor(event.fighter, event.slot, false, event.chain ?? 0, event.branch).rim : kind === BREAK ? 0xffa060 : 0xdff4ff);
      slot.r = this.colour.r; slot.g = this.colour.g; slot.b = this.colour.b;
    }
    if (kind === BLOCK) {
      if (slot) slot.power = weight;
      this.surface(c, size, this.towards, .35, this.kit.n(3 + weight * 5, 2), 4 + weight * 3, .015 + weight * .005, time, BLOCK_EL, 1.4);
      if (defender.state.grounded) this.kit.dustSpray(defender.group.position.x, defender.group.position.y, defender.group.position.z, -this.towards.x, -this.towards.z,
        Math.round(2 + weight * 3), 1.6 + weight * 2, .3 + weight * .2, time, .4, .9);
      return;
    }
    if (kind === PARRY || kind === DEFLECT) {
      if (slot) { slot.power = 1; slot.flareAt = time; }
      const calm = this.reduced;
      this.surface(c, size, this.towards, 1.4, this.kit.n(calm ? 10 : 24, 6), 9, .022, time, PARRY_EL, 0);
      if (kind === DEFLECT) {
        const el = elementFor(event.fighter, event.slot, false, event.chain ?? 0, event.branch);
        this.surface(c, size, this.towards, .3, this.kit.n(calm ? 5 : 12, 3), 7, .024, time, el, 1.6);
      }
      this.kit.pulse(c.x + this.towards.x * size, c.y + .3, c.z + this.towards.z * size, 0xd8f6ff, calm ? 6 : 11, 8, time, .32, 2.5);
      return;
    }
    const integrity = slot?.integrity ?? 0;
    if (slot) { slot.power = 1.6; slot.shatterAt = time; slot.flareAt = time; slot.integrity = 0; }
    this.shards(c, size, integrity, time);
  }

  private surface(c: THREE.Vector3, size: number, towards: THREE.Vector3, spread: number, count: number, speed: number, width: number, time: number,
    el: { spike: number; rim: number }, lean: number) {
    const f = this.kit.sparks, sp = f.spec;
    for (let i = 0; i < count; i++) {
      let x = Math.random() * 2 - 1, y = (Math.random() * 2 - 1) * .7, z = Math.random() * 2 - 1;
      const pull = spread >= 1.3 ? 0 : 1 - spread / 1.3;
      x = x * (1 - pull) + towards.x * pull * 2.2; y = y * (1 - pull) + towards.y * pull * 2.2; z = z * (1 - pull) + towards.z * pull * 2.2;
      const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      const v = speed * (.55 + Math.random() * .75);
      const vx = (x + towards.x * lean) * v, vy = (y + towards.y * lean) * v + 1, vz = (z + towards.z * lean) * v;
      sp.reset(SPRITE.streak, time, .16 + Math.random() * .2).pos(c.x + x * size, c.y + .05 + y * size * 1.08, c.z + z * size).velocity(vx, vy, vz);
      sp.orient = ORIENT.velocity; sp.sized(width * (.7 + Math.random() * .6), width * .6, .6); sp.stretch = 2.5; sp.trail = .05;
      sp.drag = 3.5; sp.gravity = 6; sp.hot(el.spike, 1.7).cool(el.rim, 0); f.emit();
    }
  }

  private shards(c: THREE.Vector3, size: number, integrity: number, time: number) {
    const f = this.kit.sparks, sp = f.spec, calm = this.reduced, t = this.towards;
    const tint = integrity > .35 ? 0xffb35c : 0xff5a40;
    for (let i = 0, count = this.kit.n(calm ? 14 : 28, 8); i < count; i++) {
      let x = Math.random() * 2 - 1, y = (Math.random() - .35) * 1.3, z = Math.random() * 2 - 1;
      x += t.x * .6; z += t.z * .6;
      const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      const speed = 2.5 + Math.random() * 4.5;
      sp.reset(SPRITE.shard, time + Math.random() * .06, .5 + Math.random() * .35).pos(c.x + x * size, c.y + .05 + y * size * 1.08, c.z + z * size)
        .velocity(x * speed, y * speed * .6 + 2, z * speed);
      sp.sized(.09 + Math.random() * .1, .06, .5).hot(i % 3 ? 0xcfefff : tint, 1.3).cool(0xffffff, .4);
      sp.gravity = 9; sp.drag = 1.1; sp.spin = (Math.random() - .5) * 20; sp.rotation = Math.random() * 6.28; f.emit();
    }
    this.surface(c, size, t, 1.4, this.kit.n(calm ? 6 : 12, 4), 7, .02, time, BREAK_EL, .3);
    this.kit.pulse(c.x, c.y + .5, c.z, tint, calm ? 4 : 8, 7, time, .35, 2);
  }

  private flareOf(since: number) {
    if (since < 0 || since > FLARE_LIFE) return 0;
    const k = since < FLARE_RISE ? since / FLARE_RISE : Math.pow(1 - (since - FLARE_RISE) / (FLARE_LIFE - FLARE_RISE), 1.6);
    return k * (this.reduced ? .55 : 1);
  }
  private snapOf(since: number) {
    if (since < 0 || since > .6) return 0;
    if (this.reduced) return CALM_SNAP * (since < .05 ? since / .05 : Math.exp(-(since - .05) * 7));
    if (since < .05) return SNAP * Math.sin(since / .05 * Math.PI / 2);
    const t = since - .05;
    return SNAP * Math.exp(-t * 8) * Math.cos(t * 19);
  }

  update(time: number, dt: number, fighters: ReadonlyMap<string, Fighter>) {
    this.uniforms.uTime.value = time;
    this.uniforms.uCalm.value = this.reduced ? 1 : 0;
    const step = Math.min(.1, Math.max(0, dt));
    let count = 0;
    for (const fighter of fighters.values()) {
      const s = fighter.state;
      const up = s.alive && (s.guarding || s.action === 'guard');
      const known = this.byId.get(s.id);
      const busy = known !== undefined && (time - this.slots[known].shatterAt < SHATTER || time - this.slots[known].flareAt < FLARE_LIFE);
      if (!up && !busy && known === undefined) continue;
      const slot = this.slotOf(s.id, time);
      if (!slot) continue;
      slot.seenAt = time;
      const sinceShatter = time - slot.shatterAt, sinceFlare = time - slot.flareAt;
      const breaking = sinceShatter >= 0 && sinceShatter < SHATTER;
      const flaring = sinceFlare >= 0 && sinceFlare < FLARE_LIFE && slot.kind !== BREAK;
      const target = breaking ? 1 : up || flaring ? 1 : 0;
      slot.alpha += (target - slot.alpha) * (1 - Math.exp(-(target > slot.alpha ? FADE_IN : FADE_OUT) * step));
      if (breaking || flaring) slot.alpha = Math.max(slot.alpha, .9);
      const health = breaking ? 0 : THREE.MathUtils.clamp(s.stamina / Math.max(1, s.maxStamina ?? 100), 0, 1);
      slot.integrity += (health - slot.integrity) * (1 - Math.exp(-14 * step));
      if (!up && sinceShatter >= SHATTER && sinceShatter < SHATTER + 1.5) slot.alpha = 0;
      if (slot.alpha < .01) continue;
      const c = bodyCentre(fighter, this.centre);
      const swell = (flaring ? this.snapOf(sinceFlare) : 0) + (breaking ? sinceShatter / SHATTER * .16 : 0);
      const scale = RADIUS * (s.size ?? 1) * (1 + swell);
      this.matrix.makeScale(scale, scale * 1.08, scale).setPosition(c.x, c.y + .05, c.z);
      this.mesh.setMatrixAt(count, this.matrix);
      const g = this.guard.array as Float32Array, h = this.hit.array as Float32Array, fa = this.face.array as Float32Array, ti = this.tint.array as Float32Array, o = count * 4;
      g[o] = slot.integrity; g[o + 1] = slot.alpha; g[o + 2] = slot.seed; g[o + 3] = Math.max(0, time - slot.hitAt);
      h[o] = slot.hx; h[o + 1] = slot.hy; h[o + 2] = slot.hz; h[o + 3] = time - slot.hitAt < 1.2 ? slot.power : 0;
      fa[o] = Math.sin(s.yaw); fa[o + 1] = Math.cos(s.yaw);
      fa[o + 2] = this.flareOf(sinceFlare) * (slot.kind === BREAK ? .45 : 1);
      fa[o + 3] = breaking ? Math.min(1, sinceShatter / SHATTER) : 0;
      ti[o] = slot.r; ti[o + 1] = slot.g; ti[o + 2] = slot.b; ti[o + 3] = slot.kind;
      count++;
    }
    if (this.byId.size > count) { this.present = fighters; this.byId.forEach(this.letGo); this.present = undefined; }
    this.mesh.count = this.frontMesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.guard.needsUpdate = this.hit.needsUpdate = this.face.needsUpdate = this.tint.needsUpdate = true;
  }

  private present?: ReadonlyMap<string, Fighter>;
  private readonly letGo = (index: number, id: string) => {
    if (this.present?.has(id)) return;
    this.slots[index].id = null; this.slots[index].alpha = 0; this.byId.delete(id);
  };

  reset() {
    for (const s of this.slots) { s.id = null; s.alpha = 0; s.hitAt = s.flareAt = s.shatterAt = s.seenAt = -1e9; }
    this.byId.clear(); this.mesh.count = this.frontMesh.count = 0;
  }

  dispose() {
    this.reset();
    for (const mesh of [this.mesh, this.frontMesh]) { mesh.removeFromParent(); mesh.dispose(); }
    this.geometry.dispose(); this.back.dispose(); this.front.dispose();
  }
}

const BLOCK_EL = { spike: 0xeaf8ff, rim: 0x8fd8ff } as const;
const PARRY_EL = { spike: 0xffffff, rim: 0x6fd2ff } as const;
const BREAK_EL = { spike: 0xfff0d8, rim: 0xff8a3a } as const;
