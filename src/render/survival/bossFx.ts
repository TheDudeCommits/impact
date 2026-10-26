import * as THREE from 'three';
import { VfxKit } from '../vfx/VfxKit';
import { energyOrbMaterial } from '../vfx/EnergyOrbMaterial';
import { crater } from './crater';
import type { Element } from '../vfx/palette';
import type { FeedItem } from '../../survival/SurvivalGame';
import { awakeningOf } from '../../survival/signatures';
import { ENEMIES } from '../../survival/enemies';
import { BODY_FX, LIVING, type BodyFx } from '../EnemyHorde';
import { INK_ON, inkFlood } from '../rift/ink';


const E = (spike: number, rim: number, light = rim, ink = 0x10131a): Element => ({ spike, rim, light, ink });
export const SIG_ELEMENTS: Record<string, Element> = {
  steel: E(0xf4f8ff, 0xb8c8d8, 0xdfe8f0), fire: E(0xfff1b0, 0xff4a1e, 0xff7a2a, 0x1c0a04), magma: E(0xffe0a0, 0xff3a0a, 0xff5a1e, 0x1c0602),
  light: E(0xfffbe0, 0xffd21e, 0xfff09a), ice: E(0xf0fbff, 0x7fd8ff, 0xbfefff), lightning: E(0xf2fbff, 0x5aa8ff, 0x9fd0ff, 0x0c1426),
  dark: E(0xf0e0ff, 0x7a3cff, 0x9a6cff, 0x0c0420), ki: E(0xe8f6ff, 0x3a9cff, 0x7fc8ff), sound: E(0xffffff, 0xffe9b0, 0xffffff), blood: E(0xffd2d8, 0xe0142e, 0xff3048, 0x050103),
  cero: E(0xffe0e4, 0xff1e3c, 0xff4a5e, 0x14020a), jade: E(0xe8fff0, 0x2ee88a, 0x7affb8, 0x021408),
};
const GOLD = E(0xfff3b0, 0xffb21e, 0xffc84a);
const RED = E(0xffe0e0, 0xff1e2e, 0xff4a4a, 0x140204);
const el = (name?: string) => SIG_ELEMENTS[name ?? 'steel'] ?? SIG_ELEMENTS.steel;
const SMOKE: Record<number, readonly [number, number]> = { 0: [0x4a1c10, 0x100402], 1: [0xd8ecf4, 0x6a8494], 2: [0x3a1860, 0x08020e], 3: [0x3a5a44, 0x0a140e] };
const POOL_KIND: Record<string, number> = { magma: 0, fire: 0, blood: 0, cero: 0, ice: 1, dark: 2, lightning: 2, jade: 3, light: 3, steel: 3, ki: 3, sound: 3 };

const FLAT_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
const NOISE = `
float bfxHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float bfxNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( bfxHash( i ), bfxHash( i + vec2( 1, 0 ) ), f.x ), mix( bfxHash( i + vec2( 0, 1 ) ), bfxHash( i + vec2( 1, 1 ) ), f.x ), f.y ); }`;
const POOL_FRAGMENT = `
uniform vec3 uCore; uniform vec3 uRim; uniform float uTime; uniform float uAlpha; uniform float uKind; uniform float uSeed;
varying vec2 vUv;
${NOISE}
void main() {
	vec2 p = vUv * 2.0 - 1.0; float r = length( p ), a = atan( p.y, p.x );
	float edge = .84 + .12 * bfxNoise( vec2( a * 2.6 + uSeed, uSeed * .3 + uTime * .25 ) );
	if ( r > edge ) discard;
	float t = uTime;
	float flow = bfxNoise( p * 3.2 + vec2( t * .35, -t * .22 ) + uSeed ) * .6 + bfxNoise( p * 7.5 - vec2( t * .5, t * .3 ) ) * .4;
	float rim = smoothstep( edge - .16, edge, r );
	vec3 col; float alpha;
	if ( uKind < .5 ) {
		float cracks = smoothstep( .5, .6, flow );
		col = mix( uRim * .18, uCore * 2.4, cracks ) + uRim * rim * 1.4; alpha = .94;
	} else if ( uKind < 1.5 ) {
		float cracks = 1.0 - smoothstep( .015, .05, abs( flow - .5 ) );
		col = mix( uCore * .85, uRim * 1.5, cracks * .8 ) + uRim * rim * .9; alpha = .8;
	} else if ( uKind < 2.5 ) {
		float swirl = bfxNoise( vec2( a * 3.0 + t * 1.3, r * 4.5 - t * .9 ) + uSeed );
		col = mix( vec3( .012, .0, .02 ), uRim * 1.4, smoothstep( .58, .92, swirl ) * ( 1.0 - r * .7 ) ) + uRim * rim; alpha = .88;
	} else {
		float bubble = smoothstep( .66, .72, bfxNoise( p * 6.0 + vec2( 0.0, t * .7 ) + uSeed ) );
		col = mix( uRim * .45, uCore * 1.7, flow * .6 + bubble * .6 ) + uRim * rim; alpha = .84;
	}
	gl_FragColor = vec4( col, alpha * uAlpha );
}`;
const RING_FRAGMENT = `
uniform vec3 uColor; uniform float uAlpha; uniform float uTime; uniform float uWidth; uniform float uSpin;
varying vec2 vUv;
${NOISE}
void main() {
	vec2 p = vUv * 2.0 - 1.0; float r = length( p ), a = atan( p.y, p.x );
	float band = 1.0 - smoothstep( 0.0, uWidth, abs( r - .9 ) );
	float dash = step( .32, fract( a / 6.2831853 * 20.0 - uTime * uSpin ) );
	float inner = ( 1.0 - smoothstep( .0, .9, r ) ) * .1 * ( .6 + .4 * bfxNoise( p * 4.0 + uTime ) );
	float alpha = ( band * ( .5 + .5 * dash ) + inner ) * uAlpha;
	if ( alpha < .01 ) discard;
	gl_FragColor = vec4( uColor * 1.6, alpha );
}`;
const VORTEX_FRAGMENT = `
uniform vec3 uColor; uniform float uAlpha; uniform float uTime;
varying vec2 vUv;
${NOISE}
void main() {
	vec2 p = vUv * 2.0 - 1.0; float r = length( p ), a = atan( p.y, p.x );
	if ( r > 1.0 ) discard;
	float arms = sin( a * 4.0 + log( r + .02 ) * 6.0 + uTime * 5.0 ) * .5 + .5;
	float core = 1.0 - smoothstep( .0, .28, r );
	float body = ( 1.0 - smoothstep( .6, 1.0, r ) );
	vec3 col = mix( uColor * 1.5 * arms, vec3( 0.0 ), core );
	float alpha = ( body * ( .35 + .65 * arms ) + core ) * uAlpha * .9;
	gl_FragColor = vec4( col, alpha );
}`;
const WAVE_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
const WAVE_FRAGMENT = `
uniform vec3 uColor; uniform float uAlpha; uniform float uTime;
varying vec2 vUv;
void main() {
	float foot = 1.0 - vUv.y;
	float streak = .55 + .45 * sin( vUv.x * 90.0 + uTime * 14.0 );
	float alpha = foot * foot * streak * uAlpha;
	if ( alpha < .01 ) discard;
	gl_FragColor = vec4( uColor * ( .75 + foot * .85 ), alpha );
}`;

const flatPlane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
const waveBand = new THREE.CylinderGeometry(1, 1, 1, 72, 1, true).translate(0, .5, 0);
const orb = new THREE.SphereGeometry(1, 20, 14);

interface PoolSlot { mesh: THREE.Mesh; u: Record<string, THREE.IUniform>; forms: number; until: number; x: number; z: number; radius: number; el: Element; kind: number; next: number }
interface WaveSlot { mesh: THREE.Mesh; u: Record<string, THREE.IUniform>; x: number; y: number; z: number; start: number; speed: number; reach: number; el: Element; dust: number }
interface Gather { mesh: THREE.Mesh; material: THREE.ShaderMaterial; actor: string; start: number; until: number; radius: number; at: THREE.Vector3; el: Element }
interface Homies { zeus: THREE.Mesh; sun: THREE.Mesh; mats: THREE.ShaderMaterial[]; born: number }
interface Decal { mesh: THREE.Mesh; u: Record<string, THREE.IUniform>; actor: string; until: number; radius: number }
interface Timer { at: number; run: (time: number) => void }

type Screen = { impactFrame(strength: number, at?: THREE.Vector3): void; techniqueGrade(color: number, strength: number, seconds: number): void };

export class BossFx {
  private kit: VfxKit;
  private pools: PoolSlot[] = [];
  private waves: WaveSlot[] = [];
  private gathers: Gather[] = [];
  private homies = new Map<string, Homies>();
  private auras = new Map<string, Decal>();
  private vortices = new Map<string, Decal>();
  private brinks = new Map<string, Decal>();
  private awakened = new Map<string, { core: number; rim: number; since: number; height: number }>();
  private timers: Timer[] = [];
  bodyOf?: (id: string) => { x: number; y: number; z: number; height: number } | undefined;
  screen?: Screen;

  constructor(private readonly scene: THREE.Scene) {
    this.kit = VfxKit.for(scene);
    for (let i = 0; i < 20; i++) {
      const u = { uCore: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uTime: { value: 0 }, uAlpha: { value: 0 }, uKind: { value: 0 }, uSeed: { value: i * 3.7 } };
      const mesh = new THREE.Mesh(flatPlane, new THREE.ShaderMaterial({ uniforms: u, vertexShader: FLAT_VERTEX, fragmentShader: POOL_FRAGMENT, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false }));
      mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.name = 'boss-pool';
      scene.add(mesh);
      this.pools.push({ mesh, u, forms: 0, until: -1, x: 0, z: 0, radius: 1, el: el(), kind: 0, next: 0 });
    }
    for (let i = 0; i < 6; i++) {
      const u = { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 }, uTime: { value: 0 } };
      const mesh = new THREE.Mesh(waveBand, new THREE.ShaderMaterial({ uniforms: u, vertexShader: WAVE_VERTEX, fragmentShader: WAVE_FRAGMENT, transparent: true, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
      mesh.visible = false; mesh.frustumCulled = false; mesh.name = 'boss-wave';
      scene.add(mesh);
      this.waves.push({ mesh, u, x: 0, y: 0, z: 0, start: -1, speed: 1, reach: 0, el: el(), dust: 0 });
    }
  }

  private fx(actor: string): BodyFx { let fx = BODY_FX.get(actor); if (!fx) { fx = {}; BODY_FX.set(actor, fx); } return fx; }

  feed(item: FeedItem, time: number) {
    switch (item.kind) {
      case 'pool': return this.pool(item, time);
      case 'fissure': return this.fissure(item, time);
      case 'wave': return this.wave(item);
      case 'charge': return this.charge(item, time);
      case 'charge-end': return this.chargeEnd(item, time);
      case 'orbit': if (item.actor) this.orbit(item.actor, time); return;
      case 'aura': if (item.actor) this.aura(item); return;
      case 'pull': if (item.actor) this.pull(item); return;
      case 'iron': if (item.actor) this.fx(item.actor).iron = item.value ?? time + 2.4; return;
      case 'shatter': return this.shatter(item, time);
      case 'signature': if (item.actor) this.fx(item.actor).taunt = Math.max(this.fx(item.actor).taunt ?? 0, time + .75); return;
      case 'enraged': if (item.value === 3) this.awaken(item, time); return;
      case 'finish': return this.finish(item, time);
      case 'finisher': return this.finisher(item, time);
      case 'team': return this.team(item, time);
      case 'spawn': if (item.sub === 'illusion' && item.actor && item.text) {
        const real = BODY_FX.get(item.text), aura = this.awakened.get(item.text);
        if (real?.awakened) this.fx(item.actor).awakened = { ...real.awakened, at: time };
        if (aura) this.awakened.set(item.actor, { ...aura, since: time });
      } return;
      default: return;
    }
  }

  private pool(item: FeedItem, time: number) {
    const slot = this.pools.reduce((oldest, p) => p.until < oldest.until ? p : oldest, this.pools[0]);
    const e = el(item.element);
    slot.x = item.x ?? 0; slot.z = item.z ?? 0; slot.radius = item.radius ?? 2; slot.forms = item.value ?? time; slot.until = item.until ?? slot.forms + 6; slot.el = e;
    slot.kind = POOL_KIND[item.element ?? ''] ?? 3; slot.next = slot.forms;
    (slot.u.uCore.value as THREE.Color).setHex(e.spike); (slot.u.uRim.value as THREE.Color).setHex(e.rim); slot.u.uKind.value = slot.kind;
    slot.mesh.position.set(slot.x, (item.y ?? 0) + .03, slot.z);
    slot.mesh.scale.set(slot.radius, 1, slot.radius);
    if (slot.forms > time + .05) this.timers.push({ at: time, run: t => this.kit.ring(slot.x, (item.y ?? 0) + .05, slot.z, slot.radius * .9, slot.radius * 1.05, t, Math.max(.2, slot.forms - t), 0xffffff, e.rim, .1, 'flat') });
    this.timers.push({ at: slot.forms, run: t => {
      const k = this.kit, y = item.y ?? 0;
      crater(k, slot.x, y, slot.z, slot.radius > 2.2, t, e);
      k.pulse(slot.x, y + 1, slot.z, e.light, 10, slot.radius * 4, t, .45, 2);
      const [lit, shade] = SMOKE[slot.kind] ?? SMOKE[3];
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; k.smoke(slot.x + Math.cos(a) * slot.radius * .6, y + .3, slot.z + Math.sin(a) * slot.radius * .6, Math.cos(a), 2.4, Math.sin(a), 1.2, t, .8, lit, shade); }
    } });
  }

  private fissure(item: FeedItem, time: number) {
    const [a, b] = item.points ?? [];
    if (!a || !b) return;
    const e = el(item.element), width = item.radius ?? 1, lands = item.value ?? time + 1;
    const from = new THREE.Vector3(a.x, .05, a.z), to = new THREE.Vector3(b.x, .05, b.z);
    const length = from.distanceTo(to), yaw = Math.atan2(to.x - from.x, to.z - from.z);
    if (!item.hero) this.warnLine?.(from.x, 0, from.z, yaw, width * .5 + .2, length, time, lands, e.rim);
    const steps = Math.max(3, Math.round(length / 2.2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.timers.push({ at: lands + t * .12, run: now => {
        const k = this.kit, x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
        if (i % 2 === 0) crater(k, x, 0, z, false, now, e);
        k.hitSpark(x, .4, z, e, 1, now);
        k.pulse(x, .8, z, e.light, 5, 5, now, .3, 1);
        k.smoke(x, .3, z, (Math.random() - .5), 1.8 + Math.random(), (Math.random() - .5), .8 + width * .4, now, .7, e.rim, e.ink);
      } });
    }
    this.timers.push({ at: lands, run: now => this.kit.scorch(from.x + (to.x - from.x) * .5, .02, from.z + (to.z - from.z) * .5, 0, 1, 0, Math.min(3, width * 2), now, .6) });
  }
  warnLine?: (x: number, y: number, z: number, yaw: number, width: number, length: number, born: number, due: number, color: number) => void;
  warnRing?: (x: number, y: number, z: number, radius: number, born: number, due: number, color: number) => void;

  private wave(item: FeedItem) {
    const slot = this.waves.reduce((oldest, w) => w.start + w.reach / w.speed < oldest.start + oldest.reach / oldest.speed ? w : oldest, this.waves[0]);
    const e = el(item.element);
    slot.x = item.x ?? 0; slot.y = item.y ?? 0; slot.z = item.z ?? 0; slot.start = item.value ?? item.at; slot.speed = Number(item.sub ?? 10) || 10; slot.reach = item.radius ?? 10; slot.el = e; slot.dust = 0;
    (slot.u.uColor.value as THREE.Color).setHex(e.rim);
    if (!item.hero) this.warnRing?.(slot.x, slot.y, slot.z, slot.reach, item.at, slot.start, e.rim);
    this.kit.pulse(slot.x, slot.y + 1.2, slot.z, e.light, 8, 8, item.at, Math.max(.2, slot.start - item.at), 1);
  }

  private charge(item: FeedItem, time: number) {
    if (!item.actor) return;
    const e = el(item.element), material = energyOrbMaterial();
    material.uniforms.uTint.value.setHex(e.rim);
    const mesh = new THREE.Mesh(orb, material); mesh.frustumCulled = false; mesh.visible = false;
    this.scene.add(mesh);
    const at = new THREE.Vector3(item.x ?? 0, item.y ?? 0, item.z ?? 0);
    this.gathers.push({ mesh, material, actor: item.actor, start: time, until: item.value ?? time + 3.5, radius: item.radius ?? 8, at, el: e });
    this.fx(item.actor).taunt = item.value ?? time + 3.5;
    this.warnRing?.(at.x, at.y, at.z, item.radius ?? 8, time, item.value ?? time + 3.5, e.rim);
  }
  private chargeEnd(item: FeedItem, time: number) {
    const i = this.gathers.findIndex(g => g.actor === item.actor);
    const gather = i >= 0 ? this.gathers.splice(i, 1)[0] : undefined;
    const k = this.kit, e = el(item.element);
    if (gather) { gather.mesh.removeFromParent(); gather.material.dispose(); }
    if (item.actor) { const fx = this.fx(item.actor); fx.taunt = time; if (item.value === 1) fx.stun = time + 2.4; }
    if (item.value === 1) {
      const p = gather?.mesh.position ?? new THREE.Vector3(item.x ?? 0, 3, item.z ?? 0);
      k.hitSpark(p.x, p.y, p.z, e, 3, time); k.ring(p.x, p.y, p.z, .5, 7, time, .5, 0xffffff, e.rim, .12);
      k.streaks(p.x, p.y, p.z, e, 24, 12, .08, time);
      this.screen?.impactFrame(.6);
      return;
    }
    const x = item.x ?? 0, y = item.y ?? 0, z = item.z ?? 0, r = item.radius ?? 8;
    crater(k, x, y, z, true, time, e);
    k.ring(x, y + .08, z, .5, r * 2.2, time, .7, 0xffffff, e.rim, .25, 'flat');
    k.pulse(x, y + 2, z, e.light, 24, r * 3, time, .9, 3);
    k.hitSpark(x, y + 1, z, e, 3, time);
    for (let j = 0; j < 10; j++) { const a = j / 10 * Math.PI * 2; k.smoke(x + Math.cos(a) * r * .5, y + .5, z + Math.sin(a) * r * .5, Math.cos(a) * 4, 3 + Math.random() * 2, Math.sin(a) * 4, 2.4, time + j * .02, 1.1, e.rim, e.ink); }
    this.screen?.impactFrame(.98);
    this.screen?.techniqueGrade(e.rim, .6, .9);
  }

  private orbit(actor: string, time: number) {
    if (this.homies.has(actor)) return;
    const zeusMat = energyOrbMaterial(), sunMat = energyOrbMaterial();
    zeusMat.uniforms.uTint.value.setHex(0x9fc4ff); sunMat.uniforms.uTint.value.setHex(0xffb030);
    const zeus = new THREE.Mesh(orb, zeusMat), sun = new THREE.Mesh(orb, sunMat);
    for (const mesh of [zeus, sun]) { mesh.frustumCulled = false; mesh.visible = false; this.scene.add(mesh); }
    this.homies.set(actor, { zeus, sun, mats: [zeusMat, sunMat], born: time });
  }
  private aura(item: FeedItem) {
    const actor = item.actor!, e = el(item.element);
    let decal = this.auras.get(actor);
    if (!decal) { decal = this.decal(RING_FRAGMENT, actor, 'boss-aura'); this.auras.set(actor, decal); }
    decal.radius = item.radius ?? 3; decal.until = Infinity;
    (decal.u.uColor.value as THREE.Color).setHex(e.rim); decal.u.uWidth.value = item.value === 2 ? .09 : .06; decal.u.uSpin.value = item.value === 2 ? 1.2 : .6;
  }
  private pull(item: FeedItem) {
    const actor = item.actor!;
    let decal = this.vortices.get(actor);
    if (!decal) { decal = this.decal(VORTEX_FRAGMENT, actor, 'boss-vortex'); this.vortices.set(actor, decal); }
    decal.radius = item.radius ?? 12; decal.until = item.value ?? item.at + 2.4;
    (decal.u.uColor.value as THREE.Color).setHex(el(item.element).rim);
    this.fx(actor).taunt = decal.until;
  }
  private decal(fragment: string, actor: string, name: string): Decal {
    const u = { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 }, uTime: { value: 0 }, uWidth: { value: .06 }, uSpin: { value: .6 } };
    const mesh = new THREE.Mesh(flatPlane, new THREE.ShaderMaterial({ uniforms: u, vertexShader: FLAT_VERTEX, fragmentShader: fragment, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, toneMapped: false, blending: fragment === VORTEX_FRAGMENT ? THREE.NormalBlending : THREE.AdditiveBlending }));
    mesh.frustumCulled = false; mesh.visible = false; mesh.name = name; mesh.renderOrder = 2;
    this.scene.add(mesh);
    return { mesh, u, actor, until: 0, radius: 1 };
  }
  private shatter(item: FeedItem, time: number) {
    const k = this.kit, x = item.x ?? 0, y = item.y ?? 0, z = item.z ?? 0, h = item.radius ?? 2;
    const glass = E(0xffffff, 0xd8c8ff, 0xf0e8ff);
    k.hitSpark(x, y + h * .5, z, glass, 2, time);
    k.streaks(x, y + h * .5, z, glass, 30, 9, .05, time);
    k.ring(x, y + h * .5, z, .3, 3.2, time, .35, 0xffffff, 0xb898ff, .1);
    k.pulse(x, y + h * .6, z, 0xe8dcff, 8, 7, time, .3, 1);
  }

  private awaken(item: FeedItem, time: number) {
    if (!item.actor || !item.enemy) return;
    const def = ENEMIES[item.enemy], form = awakeningOf(item.enemy, def?.color ?? 0xffffff);
    const burst = item.at + .6, height = def?.height ?? 2.2;
    this.fx(item.actor).awakened = { tint: form.tint ?? 0xffffff, scale: form.scale ?? 1.06, rim: form.aura[1], at: burst };
    this.awakened.set(item.actor, { core: form.aura[0], rim: form.aura[1], since: burst, height });
    const e = E(form.aura[0], form.aura[1]);
    for (let i = 0; i < 6; i++) this.timers.push({ at: item.at + i * .09, run: t => {
      const body = this.bodyOf?.(item.actor!);
      if (!body) return;
      const k = this.kit;
      for (let j = 0; j < 4; j++) {
        const a = Math.random() * Math.PI * 2, r = 3.5 + Math.random() * 2;
        k.smoke(body.x + Math.cos(a) * r, body.y + .4 + Math.random() * height, body.z + Math.sin(a) * r, -Math.cos(a) * r * 2.2, .4, -Math.sin(a) * r * 2.2, .5, t, .42, form.aura[1], e.ink);
      }
      k.pulse(body.x, body.y + height * .6, body.z, form.aura[0], 6 + i * 2, 6, t, .15, 1);
    } });
    this.timers.push({ at: burst, run: t => {
      const body = this.bodyOf?.(item.actor!);
      const x = body?.x ?? item.x ?? 0, y = body?.y ?? item.y ?? 0, z = body?.z ?? item.z ?? 0, k = this.kit;
      k.ring(x, y + .08, z, .4, (item.radius ?? 6.5) * 2.2, t, .6, 0xffffff, form.aura[1], .22, 'flat');
      k.ring(x, y + height * .6, z, .4, 9, t, .45, 0xffffff, form.aura[0], .12);
      crater(k, x, y, z, true, t, e);
      k.hitSpark(x, y + height * .6, z, e, 3, t);
      k.pulse(x, y + height * .7, z, form.aura[0], 22, 16, t, .8, 3);
      this.screen?.impactFrame(.97);
      this.screen?.techniqueGrade(form.aura[1], .55, .8);
    } });
  }

  private finish(item: FeedItem, time: number) {
    if (!item.actor) return;
    const until = item.value ?? time + 5.5;
    this.fx(item.actor).brink = until;
    let decal = this.brinks.get(item.actor);
    if (!decal) { decal = this.decal(RING_FRAGMENT, item.actor, 'boss-brink'); this.brinks.set(item.actor, decal); }
    decal.until = until; decal.radius = 2.6;
    (decal.u.uColor.value as THREE.Color).setHex(0xff1e2e); decal.u.uWidth.value = .12; decal.u.uSpin.value = 2.2;
    const body = this.bodyOf?.(item.actor);
    if (body) { this.kit.ring(body.x, body.y + body.height * .6, body.z, .4, 6, time, .4, 0xffffff, RED.rim, .12); this.kit.pulse(body.x, body.y + 1.5, body.z, 0xff3040, 12, 9, time, .5, 2); }
    this.screen?.techniqueGrade(0xff1e2e, .4, .7);
  }

  private finisher(item: FeedItem, time: number) {
    if (item.actor) { this.fx(item.actor).brink = time; const decal = this.brinks.get(item.actor); if (decal) decal.until = time; }
    const x = item.x ?? 0, y = item.y ?? 0, z = item.z ?? 0, k = this.kit, team = item.value === 2;
    const e = team ? E(0xffffff, 0xff3a9a, 0xffa0d0) : GOLD;
    crater(k, x, y, z, true, time, e);
    k.ring(x, y + .08, z, .5, 18, time, .8, 0xffffff, e.rim, .3, 'flat');
    k.ring(x, y + 2, z, .5, 10, time + .05, .5, 0xffffff, e.rim, .15);
    k.hitSpark(x, y + 1.6, z, e, 3, time);
    k.streaks(x, y + 1.6, z, e, 40, 16, .07, time);
    k.pulse(x, y + 2.5, z, 0xffffff, 30, 20, time, 1.1, 3);
    for (let j = 0; j < 12; j++) { const a = j / 12 * Math.PI * 2; k.smoke(x + Math.cos(a) * 2, y + .5, z + Math.sin(a) * 2, Math.cos(a) * 5, 4 + Math.random() * 2, Math.sin(a) * 5, 2.2, time + j * .015, 1.2, e.rim, e.ink); }
    this.screen?.impactFrame(1);
    this.screen?.techniqueGrade(e.rim, .7, 1.2);
  }

  private team(item: FeedItem, time: number) {
    const [a, b] = item.points ?? [];
    const x = item.x ?? 0, y = item.y ?? 0, z = item.z ?? 0, k = this.kit;
    const e = E(0xffffff, 0x40e0ff, 0xa0f0ff);
    const to = new THREE.Vector3(x, y + 1.4, z);
    for (const [i, p] of [a, b].entries()) {
      if (!p) continue;
      const from = new THREE.Vector3(p.x, p.y + 1.2, p.z);
      for (let f = 0; f < 8; f++) this.timers.push({ at: time + f * .05, run: t => k.beams.draw(from, to, Math.min(.999, .1 + f * .12), (item.id * 13 + i) | 0, .5, e.rim, e.spike, 1 - f / 8, 1, 1) });
    }
    this.timers.push({ at: time + .3, run: t => {
      crater(k, x, y, z, true, t, e);
      k.ring(x, y + .08, z, .5, 16, t, .7, 0xffffff, e.rim, .28, 'flat');
      k.hitSpark(x, y + 1.4, z, e, 3, t);
      k.pulse(x, y + 2, z, 0xffffff, 26, 18, t, .9, 3);
      this.screen?.impactFrame(.99);
      this.screen?.techniqueGrade(e.rim, .6, .9);
    } });
  }

  update(time: number) {
    const k = this.kit;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (time < this.timers[i].at) continue;
      const timer = this.timers[i]; this.timers.splice(i, 1);
      timer.run(time);
    }
    for (const pool of this.pools) {
      if (time > pool.until + .6 || time < pool.forms - .05) { pool.mesh.visible = false; continue; }
      const fadeIn = Math.min(1, (time - pool.forms) / .3), fadeOut = Math.max(0, Math.min(1, (pool.until + .6 - time) / .9));
      pool.u.uAlpha.value = Math.max(0, fadeIn) * fadeOut; pool.u.uTime.value = time;
      pool.mesh.visible = true;
      if (time >= pool.next) {
        pool.next = time + .18;
        const a = Math.random() * Math.PI * 2, r = Math.random() * pool.radius * .8;
        const [lit, shade] = SMOKE[pool.kind] ?? SMOKE[3];
        if (pool.kind === 0) {
          k.smoke(pool.x + Math.cos(a) * r, .2, pool.z + Math.sin(a) * r, 0, 1.3 + Math.random(), 0, .7, time, .8, lit, shade);
          if (Math.random() < .5) k.streaks(pool.x + Math.cos(a) * r, .1, pool.z + Math.sin(a) * r, pool.el, 2, 3.5, .025, time, undefined, .9, 3);
        } else if (pool.kind === 1) k.puff(pool.x + Math.cos(a) * r, .2, pool.z + Math.sin(a) * r, 0, .5, 0, .6, time, .7, .3);
        else k.smoke(pool.x + Math.cos(a) * r, .2, pool.z + Math.sin(a) * r, 0, .9, 0, .5, time, .6, lit, shade);
      }
    }
    for (const wave of this.waves) {
      const r = (time - wave.start) * wave.speed;
      if (wave.start < 0 || r < 0 || r > wave.reach + .6) { wave.mesh.visible = false; continue; }
      wave.mesh.visible = true;
      wave.mesh.position.set(wave.x, wave.y + .02, wave.z);
      wave.mesh.scale.set(Math.max(.2, r), 1.25, Math.max(.2, r));
      wave.u.uAlpha.value = Math.min(1, r / 1.2) * Math.max(0, 1 - Math.max(0, r - wave.reach * .8) / (wave.reach * .2 + .6));
      wave.u.uTime.value = time;
      if (time >= wave.dust) { wave.dust = time + .08; k.dustRing(wave.x, wave.y, wave.z, 10, r, 2, .7, time, .35); }
    }
    for (const gather of this.gathers) {
      const body = this.bodyOf?.(gather.actor);
      const share = Math.min(1, (time - gather.start) / Math.max(.1, gather.until - gather.start));
      if (!body) { gather.mesh.visible = false; continue; }
      gather.mesh.visible = true;
      gather.mesh.position.set(body.x, body.y + body.height * 1.25 + share * 1.2, body.z);
      gather.mesh.scale.setScalar(.35 + share * Math.min(2.6, gather.radius * .22));
      gather.material.uniforms.uTime.value = time;
      if (Math.random() < .5) { const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 3, p = gather.mesh.position;
        k.smoke(p.x + Math.cos(a) * r, p.y - 1 + Math.random() * 2, p.z + Math.sin(a) * r, -Math.cos(a) * r * 1.6, 0, -Math.sin(a) * r * 1.6, .4, time, .5, gather.el.rim, gather.el.ink); }
      k.pulse(gather.mesh.position.x, gather.mesh.position.y, gather.mesh.position.z, gather.el.light, 4 + share * 8, 6 + share * 6, time, .05, 1);
    }
    for (const [actor, homies] of this.homies) {
      const body = this.bodyOf?.(actor);
      if (!body || !LIVING.has(actor)) { if (!body) { homies.zeus.removeFromParent(); homies.sun.removeFromParent(); homies.mats.forEach(m => m.dispose()); this.homies.delete(actor); } else { homies.zeus.visible = homies.sun.visible = false; } continue; }
      const t = time - homies.born, r = 2.5 + body.height * .3;
      homies.zeus.position.set(body.x + Math.cos(t * 1.4) * r, body.y + body.height * .72 + Math.sin(t * 2.1) * .3, body.z + Math.sin(t * 1.4) * r);
      homies.sun.position.set(body.x + Math.cos(t * 1.4 + Math.PI) * r, body.y + body.height * .76 + Math.cos(t * 1.9) * .3, body.z + Math.sin(t * 1.4 + Math.PI) * r);
      const pulse = 1 + Math.sin(t * 6) * .06;
      homies.zeus.scale.setScalar(.95 * pulse); homies.sun.scale.setScalar(.88 * pulse);
      homies.zeus.visible = homies.sun.visible = true;
      this.kit.lights.request(homies.zeus.position.x, homies.zeus.position.y, homies.zeus.position.z, 0x8fb8ff, 30, 8, 1.2);
      this.kit.lights.request(homies.sun.position.x, homies.sun.position.y, homies.sun.position.z, 0xffa030, 34, 8, 1.2);
      for (const m of homies.mats) m.uniforms.uTime.value = time;
      if (Math.random() < .08) k.crackle(homies.zeus.position, homies.zeus.position.clone().add(new THREE.Vector3((Math.random() - .5) * 2, -Math.random() * 1.5, (Math.random() - .5) * 2)), .05, SIG_ELEMENTS.lightning, 2, time);
      if (Math.random() < .3) k.smoke(homies.sun.position.x, homies.sun.position.y, homies.sun.position.z, 0, .8, 0, .35, time, .4, 0xff7a1e, 0x1c0a04);
    }
    this.decals(this.auras, time, 1);
    this.decals(this.vortices, time, 1);
    this.decals(this.brinks, time, 1);
    for (const [actor, vortex] of this.vortices) {
      if (time > vortex.until) continue;
      const body = this.bodyOf?.(actor);
      if (!body) continue;
      if (Math.random() < .6) { const a = Math.random() * Math.PI * 2, r = vortex.radius * (.5 + Math.random() * .5);
        k.smoke(body.x + Math.cos(a) * r, .3 + Math.random(), body.z + Math.sin(a) * r, -Math.cos(a) * r * 1.2 + Math.sin(a) * 3, .2, -Math.sin(a) * r * 1.2 - Math.cos(a) * 3, .32, time, .55, 0x3a1a66, 0x06000c); }
    }
    let flood: number | undefined;
    for (const [actor, aura] of this.awakened) {
      const body = this.bodyOf?.(actor);
      if (!body) { this.awakened.delete(actor); continue; }
      if (!LIVING.has(actor) || time < aura.since) continue;
      flood ??= aura.rim;
      if (Math.random() < .55) {
        const a = Math.random() * Math.PI * 2, r = .35 + Math.random() * .4 * (aura.height / 2.2);
        k.smoke(body.x + Math.cos(a) * r, body.y + .2 + Math.random() * aura.height, body.z + Math.sin(a) * r, Math.cos(a) * .25, 1.6 + Math.random(), Math.sin(a) * .25, .16 + Math.random() * .12, time, .5, aura.rim, 0x05030a);
      }
      if (Math.random() < .03) k.ring(body.x, body.y + .06, body.z, .6, 2.6, time, .5, aura.core, aura.rim, .08, 'flat');
    }
    if (INK_ON) { inkFlood(flood, Math.min(.1, Math.max(0, time - this.floodAt))); this.floodAt = time; }
  }
  private floodAt = 0;
  private decals(map: Map<string, Decal>, time: number, fade: number) {
    for (const [actor, decal] of map) {
      const body = this.bodyOf?.(actor);
      const on = !!body && LIVING.has(actor) && time < decal.until;
      decal.u.uAlpha.value += ((on ? fade : 0) - decal.u.uAlpha.value) * .15;
      decal.u.uTime.value = time;
      if (!body) { if (decal.u.uAlpha.value < .02) { decal.mesh.removeFromParent(); (decal.mesh.material as THREE.Material).dispose(); map.delete(actor); } continue; }
      decal.mesh.visible = decal.u.uAlpha.value > .02;
      decal.mesh.position.set(body.x, body.y + .04, body.z);
      decal.mesh.scale.set(decal.radius, 1, decal.radius);
    }
  }

  reset() {
    for (const pool of this.pools) { pool.until = -1; pool.mesh.visible = false; }
    for (const wave of this.waves) { wave.start = -1; wave.mesh.visible = false; }
    for (const gather of this.gathers) { gather.mesh.removeFromParent(); gather.material.dispose(); }
    this.gathers.length = 0;
    for (const homies of this.homies.values()) { homies.zeus.removeFromParent(); homies.sun.removeFromParent(); homies.mats.forEach(m => m.dispose()); }
    this.homies.clear();
    for (const map of [this.auras, this.vortices, this.brinks]) { for (const decal of map.values()) { decal.mesh.removeFromParent(); (decal.mesh.material as THREE.Material).dispose(); } map.clear(); }
    this.awakened.clear(); this.timers.length = 0; BODY_FX.clear();
    if (INK_ON) inkFlood(undefined, 10);
  }
}
