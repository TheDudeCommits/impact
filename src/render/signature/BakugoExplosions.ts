import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { BAKUGO_AWAKENING, BAKUGO_MOVES } from '../../game/fighters/bakugo';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { armoryDraws } from '../vfx/armory/drawn';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { MoveStage, STAGE, stageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const BAKUGO_EXPLOSION_ASSETS: readonly string[] = Object.freeze([]);
export const BAKUGO_EXPLOSION_LIMITS = Object.freeze({ blasts: 64, smoke: 96, rings: 64, streaks: 128, impacts: 24, howitzers: 8 });
export const BAKUGO_EXPLOSION_BEATS = Object.freeze({ spinStart: .816, spinEnd: 1.904, blast: 2.652, end: 3.05, cluster: BAKUGO_AWAKENING.beats.release });
export const isBakugoExplosions = (id: string | undefined) => id === 'bakugo';
const SIDES = ['Left', 'Right'] as const;
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1), TAU = Math.PI * 2;
const ORANGE = new THREE.Color(0xff6e14), GOLD = new THREE.Color(0xffc85d), WHITE = new THREE.Color(0xfff6d8), INK = new THREE.Color(0x35282c), SMOKE = new THREE.Color(0xc2b9ac);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const BLAST = STAGE.fire, STUN = stageLook(0xffffff, 0xfff0b4, 0xff9a1f), SMOKE_LIT = 0xc2b9ac, SMOKE_SHADE = 0x55463e;
const HEAVY = BAKUGO_MOVES.heavy, SPECIAL = BAKUGO_MOVES.special, ULT = BAKUGO_MOVES.ultimate;
export function bakugoPalm(fighter: Fighter, side: 'Left' | 'Right', out: THREE.Vector3): THREE.Vector3 {
  const body = fighter.shownBody ?? fighter;
  const hand = body.joints?.get(`${side}Hand`);
  return hand ? hand.getWorldPosition(out) : out.copy(side === 'Left' ? fighter.handL : fighter.handR);
}

const otherPalm = new THREE.Vector3();
export function bakugoContact(fighter: Fighter, index: number, out: THREE.Vector3, clip?: string): boolean {
  if (!isBakugoExplosions(fighter.state.fighter)) return false;
  const both = clip === 'Stun Grenade' || clip === 'Gauntlet Cannon' || clip === 'Aerial Detonation' || clip === 'Blast Landing' ||
    fighter.state.action === 'ultimate' && index >= 2;
  bakugoPalm(fighter, clip === 'Rush 1' || clip === 'Blast Cross' ? 'Left' : 'Right', out);
  if (both) out.lerp(bakugoPalm(fighter, 'Left', otherPalm), .5);
  return true;
}

class BlastBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tint: THREE.InstancedBufferAttribute;
  private object = new THREE.Object3D();
  private count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, readonly capacity: number, smoke = false) {
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('blastTint', this.tint);
    const billboard = smoke || name === 'blasts';
    const material = new THREE.ShaderMaterial({ name: `Bakugo-${name}`, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      vertexShader: billboard ? `attribute vec4 blastTint;varying vec4 vTint;varying vec2 vUv;
        void main(){vTint=blastTint;vUv=uv;vec4 p=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));${smoke ? '' : 'p.z+=length(instanceMatrix[0].xyz)*.7;'}gl_Position=projectionMatrix*p;}`
        : `attribute vec4 blastTint;varying vec4 vTint;varying float vLight;
        void main(){vTint=blastTint;vLight=dot(normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal),normalize(vec3(-.3,.8,.4)));gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: smoke ? `varying vec4 vTint;varying vec2 vUv;
        void main(){vec2 p=vUv*2.-1.;float r=min(length(p-vec2(-.25,-.05))/.75,min(length(p-vec2(.27,.03))/.72,length(p-vec2(0.,.32))/.73));float a=(1.-smoothstep(.4,1.,r))*vTint.a;if(a<.005)discard;gl_FragColor=vec4(vTint.rgb*(1.-.4*smoothstep(.5,.93,r))*(.93+.07*p.y),a);
        #include <colorspace_fragment>
        }`
        : name === 'blasts' ? `varying vec4 vTint;varying vec2 vUv;
        void main(){vec2 p=vUv*2.-1.;float angle=atan(p.y,p.x);float r=length(p);
          float edge=.62+.23*pow(abs(cos(angle*7.)),12.)+.045*sin(angle*17.);
          float shape=1.-smoothstep(edge-.018,edge+.014,r);if(shape*vTint.a<.005)discard;
          float ink=smoothstep(edge-.055,edge-.018,r);
          float hot=1.-smoothstep(.30,.38,r+.035*sin(angle*9.));
          vec3 col=mix(vTint.rgb,vec3(1.,.92,.67),hot);
          col=mix(col,vec3(.10,.035,.025),ink*.65);
          gl_FragColor=vec4(col,shape*vTint.a);
          #include <colorspace_fragment>
        }`
        : `varying vec4 vTint;varying float vLight;void main(){if(vTint.a<.005)discard;float cel=vLight>.35?1.:(vLight>-.25?.82:.51);gl_FragColor=vec4(vTint.rgb*cel,vTint.a);
        #include <colorspace_fragment>
        }` });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity); this.mesh.name = `bakugo-explosions-${name}`;
    this.mesh.frustumCulled = false; this.mesh.renderOrder = smoke ? 4 : 3; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.scale.setScalar(0); this.object.updateMatrix(); this.mesh.setMatrixAt(0, this.object.matrix); this.mesh.count = 1; scene.add(this.mesh);
  }
  begin() { this.count = 0; }
  add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, color: THREE.Color, alpha = 1) {
    if (this.count >= this.capacity || alpha < .005 || Math.min(x, y, z) <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, z); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.object.matrix); this.tint.setXYZW(this.count++, color.r, color.g, color.b, clamp(alpha));
  }
  end() { this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; this.tint.needsUpdate = true; }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
type Impact = { actor: string; born: number; seed: number; grade: number; point: THREE.Vector3; floor: number };
type Howitzer = { actor: string; target: string; seq: number; final?: boolean };
export class BakugoExplosions {
  private stage?: MoveStage; private full?: VfxKit;
  private heading = new THREE.Vector3(); private ground = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private blasts: BlastBatch; private smoke: BlastBatch; private rings: BlastBatch; private streaks: BlastBatch;
  private batches: BlastBatch[];
  private impacts: Impact[] = Array.from({ length: BAKUGO_EXPLOSION_LIMITS.impacts }, () => ({ actor: '', born: -1e9, seed: 0, grade: 0, point: new THREE.Vector3(), floor: 0 }));
  private howitzers: Howitzer[] = Array.from({ length: BAKUGO_EXPLOSION_LIMITS.howitzers }, () => ({ actor: '', target: '', seq: -1 }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private impactCursor = 0; private howitzerCursor = 0; private eventCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private direction = new THREE.Vector3();
  private q = new THREE.Quaternion(); private flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(private scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.full = kit.sparks && kit.dust && kit.marks && kit.debris ? kit as VfxKit : undefined;
    this.blasts = new BlastBatch(scene, 'blasts', new THREE.PlaneGeometry(2, 2), BAKUGO_EXPLOSION_LIMITS.blasts);
    this.smoke = new BlastBatch(scene, 'smoke', new THREE.PlaneGeometry(1, 1), BAKUGO_EXPLOSION_LIMITS.smoke, true);
    this.rings = new BlastBatch(scene, 'rings', new THREE.RingGeometry(.89, 1, 32), BAKUGO_EXPLOSION_LIMITS.rings);
    this.streaks = new BlastBatch(scene, 'streaks', new THREE.ConeGeometry(.13, 1, 4), BAKUGO_EXPLOSION_LIMITS.streaks);
    this.batches = [this.blasts, this.smoke, this.rings, this.streaks];
  }
  load(ids: readonly string[]): Promise<void> {
    const wanted = !this.disposed && ids.some(isBakugoExplosions);
    if (wanted && !this.stage) this.stage = MoveStage.for(this.scene, this.kit);
    else if (!wanted && this.stage) { this.stage.release(); this.stage = undefined; }
    return Promise.resolve();
  }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isBakugoExplosions(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'hit' && event.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenTime[i] === event.serverTime) return;
    const index = this.eventCursor++ % this.seen.length; this.seen[index] = event.id; this.seenTime[index] = event.serverTime;
    const actor = fighters?.get(event.actorId), victim = event.targetId ? fighters?.get(event.targetId) : undefined;
    if (event.kind === 'confirm') {
      if (event.slot !== 'ultimate' || event.branch || !event.targetId) return;
      Object.assign(this.howitzers[this.howitzerCursor++ % this.howitzers.length], { actor: event.actorId, target: event.targetId, seq: event.actionSeq ?? actor?.state.actionSeq ?? -1, final: false }); return;
    }
    const impact = this.impacts[this.impactCursor++ % this.impacts.length];
    impact.actor = event.actorId; impact.born = event.serverTime; impact.seed = event.id;
    impact.grade = event.slot === 'ultimate' && (event.contactIndex ?? 0) >= 2 ? 2 : event.slot === 'light' ? 0 : 1;
    if (event.endpoint) impact.point.set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
    else if (victim) bodyCentre(victim, impact.point); else if (actor) bakugoPalm(actor, 'Right', impact.point); else { impact.actor = ''; return; }
    impact.floor = blowFloor(actor, victim, 0);
    if (this.stage && !armoryDraws(event.fighter, event.slot, event.branch, event.actorId)) this.land(this.stage, event, impact.point, actor, victim);
  }
  private land(st: MoveStage, e: CombatEvent, point: THREE.Vector3, actor: Fighter | undefined, victim: Fighter | undefined) {
    const t = e.serverTime, dir = this.heading, yaw = actor?.state.yaw ?? actor?.group.rotation.y ?? 0;
    const floor = blowFloor(actor, victim, point.y - 1.05), ground = this.ground.set(point.x, floor, point.z);
    if (actor) dir.subVectors(point, actor.group.position).setY(0);
    if (!actor || dir.lengthSq() < .01) dir.set(Math.sin(yaw), 0, Math.cos(yaw));
    dir.normalize();
    if (e.slot === 'light') { st.burst(point, BLAST, .45, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      st.burst(this.c.copy(point).addScaledVector(dir, .35), STUN, .88 * big, t, { dir, floor, clean: true });
      st.burst(this.c.copy(point).addScaledVector(dir, .9), BLAST, .65 * big, t + .05, { dir, floor, clean: true });
      this.plume(this.c.copy(ground).addScaledVector(dir, 1.9), .6 * big, 2, t + .08, e.id, dir);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, BLAST, 2.1, t, { floor }); st.shock(ground, BLAST, 4.6, t, .45); st.scar(ground, BLAST, 2.4, t + .05, 2.2); this.plume(ground, 1, 5, t + .1, e.id); return; }
      const big = e.branch ? .7 : 1;
      st.burst(this.c.copy(point).addScaledVector(dir, .4), BLAST, 1.9 * big, t, { dir, floor });
      st.erupt(this.c.copy(point).addScaledVector(dir, .5), this.d.copy(dir).setY(.1).normalize(), BLAST, .4 * big, 4.6 * big, t, .4);
      st.shock(ground, BLAST, 5.5 * big, t, .45);
      st.scar(this.c.copy(ground).addScaledVector(dir, 1.2), BLAST, 2 * big, t + .05, 2.3);
      if (!e.branch) st.scar(this.c.copy(ground).addScaledVector(dir, 3.6), BLAST, 1.3, t + .1, 1.8);
      this.plume(this.c.copy(ground).addScaledVector(dir, 1.6), .9 * big, 5, t + .1, e.id, dir);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    const index = e.contactIndex ?? 0;
    if (index < 2) {
      st.burst(point, BLAST, index ? 1.45 : 1.05, t, { dir, floor });
      if (index) st.shock(ground, BLAST, 5, t, .5);
      return;
    }
    for (const row of this.howitzers) if (row.actor === e.actorId && row.target === e.targetId) row.final = true;
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.45, point);
    st.burst(point, BLAST, 2.6, t, { dir, floor });
    st.erupt(ground, UP, BLAST, 1.25, 11, t + .04, .7);
    for (let i = 0; i < 3; i++) {
      const ang = yaw + .8 + i * 2.094; this.c.set(ground.x + Math.cos(ang) * 2.5, floor + .9, ground.z + Math.sin(ang) * 2.5);
      st.burst(this.c, BLAST, 1.3, t + .1 + i * .08, { floor });
    }
    st.shock(ground, BLAST, 10, t, .6);
    st.scar(ground, BLAST, 3.2, t + .2, 2.2);
    st.scar(this.c.copy(ground).addScaledVector(dir, 3.2), BLAST, 1.9, t + .25, 1.8);
    this.plume(ground, 1.5, 8, t + .25, e.id);
  }
  private plume(ground: THREE.Vector3, size: number, count: number, born: number, seed: number, away?: THREE.Vector3) {
    const kit = this.full; if (!kit) return;
    const base = away ? Math.atan2(away.z, away.x) : 0;
    for (let i = 0, n = kit.n(count, 2); i < n; i++) {
      const ang = away ? base + (hash(i * 2.3 + seed) - .5) * 1.8 : i * 2.399963 + seed, r = size * (away ? .4 + .9 * hash(i + seed) : 1 + .8 * hash(i + seed)), v = .6 + 1.2 * hash(i * 3.3 + seed);
      kit.smoke(ground.x + Math.cos(ang) * r, ground.y + size * (.5 + .6 * hash(i * 1.9 + seed)), ground.z + Math.sin(ang) * r, Math.cos(ang) * v, 1.1 + 1.2 * hash(i * 5.1 + seed), Math.sin(ang) * v, size * (.75 + .5 * hash(i * 7.7 + seed)), born + .05 * i, 1 + .5 * hash(i + 2.2), SMOKE_LIT, SMOKE_SHADE);
    }
  }
  private cancel(actor: string, target = false) {
    for (const row of this.howitzers) if (row.actor === actor || target && row.target === actor) row.actor = '';
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    for (const batch of this.batches) batch.begin();
    const detail = this.kit.budget >= .55;
    if (!this.stage) for (const f of fighters.values()) if (isBakugoExplosions(f.state.fighter)) { this.stage = MoveStage.for(this.scene, this.kit); break; }
    const st = this.stage?.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!s.alive || !isBakugoExplosions(s.fighter)) continue;
      const age = s.actionTime * s.actionDuration;
      if (st && s.whiffedAt === undefined && (s.action === 'light' || s.action === 'heavy' || s.action === 'special' || s.action === 'ultimate') && !armoryDraws('bakugo', s.action, s.branch, s.id)) this.windup(st, f, age, time);
      if (s.action === 'awaken') {
        const beat = age - BAKUGO_EXPLOSION_BEATS.cluster;
        if (beat >= 0 && beat < .4) for (const side of SIDES) {
          bakugoPalm(f, side, this.a); this.burst(this.a, beat, 1, side === 'Left' ? 31 : 47, detail);
        }
      } else if (s.action === 'special' && !s.branch && age >= .24 && age < BAKUGO_MOVES.special.contacts[0]) {
        bakugoPalm(f, 'Right', this.a); this.q.identity(); const k = (age - .24) / .36;
        this.blasts.add(this.a, this.q, .055 + .06 * k, .045 + .05 * k, .07 + .07 * k, GOLD, .5 + .4 * k);
      }
      if (s.awakened && s.action !== 'awaken' && s.action !== 'hurt' && s.action !== 'knockdown' && s.action !== 'defeated') {
        for (const side of SIDES) {
          bakugoPalm(f, side, this.a); this.q.identity(); const k = .028 + .012 * Math.sin(time * 16 + (side === 'Left' ? 1 : 3));
          this.blasts.add(this.a, this.q, k, k, k, ORANGE, .8);
        }
      }
    }
    for (const flight of flights.values()) {
      if (!isBakugoExplosions(flight.fighter) || flight.slot !== 'special' || !flight.released) continue;
      this.direction.copy(flight.heading); if (this.direction.lengthSq() < 1e-9) this.direction.copy(FRONT); this.direction.normalize();
      this.q.setFromUnitVectors(UP, this.direction); this.a.copy(flight.position);
      this.streaks.add(this.a, this.q, .95, 1.35, .95, ORANGE, .7); this.streaks.add(this.a, this.q, .45, 1.7, .45, WHITE);
      this.q.setFromUnitVectors(FRONT, this.direction);
      for (let i = 0; i < (detail ? 3 : 2); i++) {
        this.p.copy(this.a).addScaledVector(this.direction, -.3 - i * .42); const radius = .18 + i * .08;
        this.rings.add(this.p, this.q, radius, radius, radius, i ? GOLD : WHITE, .7 - i * .14);
      }
      if (!st || flight.branch || armoryDraws('bakugo', 'special', undefined, flight.actorId)) continue;
      st.orb(this.a, this.direction, .5, BLAST, (flight.since ?? 0) * 3.3);
      if (flight.origin) { st.streak(flight.origin, this.a, .16, BLAST.main, .55); st.streak(flight.origin, this.a, .05, BLAST.core, 1.3); st.light(this.p.copy(flight.origin).lerp(this.a, .5).setY(flight.origin.y + .3), 5, BLAST, .5); }
      if (st.tick && this.full) this.full.smoke(this.a.x - this.direction.x * .8, this.a.y + .1, this.a.z - this.direction.z * .8, 0, .8, 0, .5, time, .7, SMOKE_LIT, SMOKE_SHADE);
    }
    for (const row of this.howitzers) {
      if (!row.actor) continue; const actor = fighters.get(row.actor), target = fighters.get(row.target), s = actor?.state;
      if (!actor || !s?.alive || s.action !== 'ultimate' || s.branch || s.actionSeq !== row.seq || !target?.state.alive) { row.actor = ''; continue; }
      const age = s.actionTime * s.actionDuration;
      if (st && !row.final && age < BAKUGO_EXPLOSION_BEATS.blast && s.whiffedAt === undefined && !armoryDraws('bakugo', 'ultimate', undefined, row.actor)) this.howitzer(st, actor, row, age, time);
      if (age < BAKUGO_EXPLOSION_BEATS.spinStart || age > BAKUGO_EXPLOSION_BEATS.spinEnd) continue;
      bodyCentre(actor, this.a); const k = (age - BAKUGO_EXPLOSION_BEATS.spinStart) / (BAKUGO_EXPLOSION_BEATS.spinEnd - BAKUGO_EXPLOSION_BEATS.spinStart);
      this.q.identity();
      for (let i = 0; i < (detail ? 14 : 7); i++) {
        const along = i / (detail ? 14 : 7), angle = k * TAU * 2 - along * TAU * 1.3, r = .49 + along * .43;
        this.p.copy(this.a).add(this.b.set(Math.cos(angle) * r, .58 - along * 1.15, Math.sin(angle) * r));
        const size = .34 + along * .28; this.smoke.add(this.p, this.q, size, size, size, SMOKE, (1 - along * .75) * .65);
        if (i % 3 === 0) this.blasts.add(this.p, this.q, .09, .11, .09, ORANGE, .8 * (1 - along));
      }
    }
    for (const impact of this.impacts) {
      if (!impact.actor) continue; const age = time - impact.born; if (age < 0 || age > .68) { if (age > .68) impact.actor = ''; continue; }
      const strong = involvesLocal(impact.actor);
      this.burst(impact.point, age, impact.grade === 2 ? 2.35 : impact.grade === 1 ? 1.2 : .6, impact.seed, detail && strong);
      if (impact.grade === 2 && age < .5) {
        this.p.copy(impact.point); this.p.y = impact.floor + .05; const radius = .7 + age * 6;
        this.rings.add(this.p, this.flat, radius, radius, radius, age < .1 ? WHITE : ORANGE, (1 - age / .5) * .85);
      }
    }
    for (const batch of this.batches) batch.end(); st?.close();
  }
  private windup(st: MoveStage, f: Fighter, age: number, time: number) {
    const s = f.state, seed = (s.actionSeq ?? 0) * 7.3;
    if (s.action === 'light') {
      const k = Math.sin(clamp(s.actionTime) * Math.PI); bakugoPalm(f, 'Right', this.c);
      st.glow(this.c, .24, BLAST.main, .6 * k); st.glow(this.c, .1, BLAST.core, .8 * k); st.glow(this.c, .3, BLAST.core, .5 * k, STAR, .2, Math.floor(time * 24)); st.light(this.c, 2, BLAST, .22 * k);
    } else if (s.action === 'heavy') {
      const contact = s.branch ? s.actionDuration * .52 : HEAVY.contacts[0];
      bakugoPalm(f, 'Right', this.c).lerp(bakugoPalm(f, 'Left', this.d), .5);
      if (age < contact) st.charge(this.c, STUN, .2, age / contact, seed);
      else if (age < contact + .16) { const flare = 1 - (age - contact) / .16; st.glow(this.c, .45, STUN.main, .7 * flare); st.glow(this.c, .9, STUN.core, .8 * flare, STAR, .2, Math.floor(time * 30)); st.light(this.c, 3.6, STUN, .45 * flare); }
    } else if (s.action === 'special' && !s.branch) {
      if (age < SPECIAL.contacts[0]) { bakugoPalm(f, 'Right', this.c); st.charge(this.c, BLAST, .34, age / SPECIAL.contacts[0], seed); }
    } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && age < ULT.contacts[0] + .1) {
      bakugoPalm(f, 'Right', this.c); st.charge(this.c, BLAST, .28, age / ULT.contacts[0], seed);
    }
  }
  private howitzer(st: MoveStage, actor: Fighter, row: Howitzer, age: number, time: number) {
    const B = BAKUGO_EXPLOSION_BEATS, g = clamp((age - ULT.contacts[0]) / (B.blast - ULT.contacts[0])), spin = clamp((age - B.spinStart) / (B.spinEnd - B.spinStart)), feet = actor.group.position, seed = row.seq * 3.1;
    st.dim(.3 + .45 * g, row.actor, row.target);
    st.pool(this.c.copy(feet), 2.2 + 2.6 * g, BLAST, .3 + .7 * g, seed);
    st.ring(feet, 2.4 + .4 * g, 1 + 2 * g, BLAST, .5 + .5 * g, seed + time * (.4 + 1.6 * spin), 6);
    bakugoPalm(actor, 'Right', this.c).lerp(bakugoPalm(actor, 'Left', this.d), .5);
    st.charge(this.c, BLAST, .2 + .2 * g, Math.max(.4, g), seed);
    if (st.tick && Math.floor(time * 30) % 3 === 0 && this.full && spin > 0 && spin < 1) {
      const ang = time * 9 + seed, r = 2.5 + .6 * hash(time * 3.1);
      this.full.smoke(feet.x + Math.cos(ang) * r, feet.y + .5 + 1.4 * hash(time * 5.3), feet.z + Math.sin(ang) * r, -Math.sin(ang) * 2.2, .9, Math.cos(ang) * 2.2, .5, time, .6, SMOKE_LIT, SMOKE_SHADE);
    }
    if (g > .75) st.speed(.5 * (g - .75) / .25, row.actor, row.target);
  }
  private burst(point: THREE.Vector3, age: number, scale: number, seed: number, detail: boolean) {
    if (age < .25) {
      const fade = 1 - age / .25, radius = scale * (.14 + Math.sin(age / .25 * Math.PI * .7) * .45);
      this.q.setFromAxisAngle(UP, seed * 1.71 + age * 2);
      this.blasts.add(point, this.q, radius, radius * .83, radius, ORANGE, fade);

    }
    const n = detail ? 8 : 4;
    for (let i = 0; i < n; i++) {
      const angle = i * TAU / n + seed * .83, rise = (i % 3) * .32;
      this.direction.set(Math.cos(angle), .25 + rise, Math.sin(angle)).normalize();
      this.p.copy(point).addScaledVector(this.direction, age * scale * 3.4);
      if (age < .33) {
        this.q.setFromUnitVectors(UP, this.direction); const fade = 1 - age / .33;
        this.streaks.add(this.p, this.q, scale * .4 * fade, scale * (.14 + age * .6), scale * .4 * fade, i % 2 ? GOLD : ORANGE, fade);
      }
      if (age > .045 && i % 2 === 0) {
        this.p.y += age * .4; this.q.identity(); const radius = scale * (.22 + age * .65);
        this.smoke.add(this.p, this.q, radius, radius, radius, age < .15 ? INK : SMOKE, clamp(1 - age / .68) * .43);
      }
    }
  }
  reset() { for (const row of this.impacts) row.actor = ''; for (const row of this.howitzers) row.actor = ''; this.seen.fill(-1); this.seenTime.fill(-1); this.impactCursor = 0; this.howitzerCursor = 0; this.eventCursor = 0; for (const batch of this.batches) { batch.begin(); batch.end(); } this.stage?.reset(); }
  dispose() { if (this.disposed) return; this.disposed = true; this.reset(); for (const batch of this.batches) batch.dispose(); this.stage?.release(); this.stage = undefined; }
}
