import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { CombatEvent } from '../../game/types';
import { MOVES } from '../../game/moves';
import type { Fighter } from '../Fighter';
import { chargeWasCancelled } from '../CombatEffects';
import { VfxKit } from '../vfx/VfxKit';
import type { Element } from '../vfx/palette';
import { Crescents, crescentGeometry, CRESCENT } from './Crescent';
import { GhostShell } from './GhostShell';
import { BoltBatch } from './BoltBatch';
import { GlowBatch, GLOW, RING, STAR } from './GlowBatch';
import { LightVolumes } from './LightVolumes';
import { bodyCenter } from './body';
import { gradeOnce, gradeLocal, GRADE } from './context';
import { castAge, noteRelease } from './castClock';
import { OPENER_FEED } from './ultimateClock';

export const ASURA_ASSET = '/assets/fighters/zoro-asura-br1.glb';
const PHOENIX = MOVES.zoro.special, WORLD = MOVES.zoro.ultimate;
const GREEN: Element = { spike: 0xe6ffe0, rim: 0x3fe070, light: 0x62ff8a, ink: 0x06200c };
const WIND = new THREE.Color(.35, 1.6, .55), HALO = new THREE.Color(.08, .5, .16), LIGHT = new THREE.Color(.4, 1.3, .5);
const UP = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
const ASURA_BODY = new THREE.Color(.06, .8, .22);
const ASURA_CUT = .5085;
type Cast = { event: CombatEvent; floor: number; hitAt?: number; burst?: boolean; hold?: number; releasedAt?: number; drawn?: number; confirmed?: boolean };
type Phantom = { root: THREE.Group; mixer: THREE.AnimationMixer; action?: THREE.AnimationAction; shell: GhostShell; busy: boolean; shown: boolean };

export class SantoryuEffects {
  private crescents: Crescents;
  private cuts: Crescents;
  private bolts = new BoltBatch(600, 'santoryu-wind');
  private glows = new GlowBatch(48, 'santoryu-glow', true);
  private lights = new LightVolumes(4, 'santoryu-light');
  private kit: VfxKit;
  private source?: GLTF;
  private unit = 1;
  private phantoms: Phantom[] = [];
  private live = new Map<string, Phantom>();
  private casts: Cast[] = [];
  private seen = new Set<number>();
  private dir = new THREE.Vector3(); private side = new THREE.Vector3(); private head = new THREE.Vector3(); private at = new THREE.Vector3();
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private center = new THREE.Vector3();
  private q = new THREE.Quaternion(); private roll = new THREE.Quaternion(); private basis = new THREE.Matrix4();
  constructor(private scene: THREE.Scene) {
    this.crescents = new Crescents(scene, crescentGeometry(1.05, .3, .34), 14, 'santoryu-crescent');
    this.cuts = new Crescents(scene, crescentGeometry(.95, .08, .1), 9, 'asura-nine-cuts');
    scene.add(this.bolts.mesh, this.glows.mesh, this.lights.mesh);
    this.kit = VfxKit.for(scene);
  }
  async load() {
    this.source = await new GLTFLoader().loadAsync(ASURA_ASSET);
    this.source.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.source.scene), height = box.max.y - box.min.y;
    this.unit = height > .01 ? 1.81 / height : 1;
    const warm = this.make(); warm.root.visible = false;
  }
  private make(): Phantom {
    const model = clone(this.source!.scene), root = new THREE.Group();
    root.name = 'asura-phantom'; root.add(model); model.scale.setScalar(this.unit); root.visible = false; this.scene.add(root);
    model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.frustumCulled = false; m.castShadow = m.receiveShadow = false; } });
    const shell = new GhostShell(model, ASURA_BODY, 0x8dffae, .55, 0x02140a, 2.4); shell.enabled = true;
    const chest = new THREE.Object3D(); chest.position.set(0, 1.2, 0); root.add(chest); shell.fadeNear(chest, 2.6, 4.6);
    const mixer = new THREE.AnimationMixer(model), take = this.source!.animations.find(c => c.name === 'Billion Fold World Trichiliocosm') ?? this.source!.animations.find(c => c.name === '_Idle');
    const clip = take ? new THREE.AnimationClip(take.name + '-phantom', take.duration, take.tracks.filter(t => !t.name.endsWith('.position'))) : undefined;
    const action = clip ? mixer.clipAction(clip).play() : undefined;
    if (action) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
    const p: Phantom = { root, mixer, action, shell, busy: false, shown: false }; this.phantoms.push(p); return p;
  }
  handle(events: readonly CombatEvent[]) {
    for (const e of events) {
      if (this.seen.has(e.id)) continue; this.seen.add(e.id); if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
      if (e.kind === 'cast' && e.fighter === 'zoro' && e.origin && e.endpoint && (e.slot === 'special' && !e.branch || e.slot === 'ultimate')) { this.casts.push({ event: e, floor: e.origin.y - 1.05 }); if (this.casts.length > 12) this.casts.shift(); }
      if (e.kind === 'release' && e.fighter === 'zoro') noteRelease(this.casts, e);
      if ((e.kind === 'hit' || e.kind === 'blocked' || e.kind === 'guard-break') && e.fighter !== undefined)
        for (const c of this.casts) if (c.event.actorId === e.actorId && c.event.slot === e.slot && e.serverTime > c.event.serverTime && c.hitAt === undefined) c.hitAt = e.serverTime;
    }
  }
  private crescent(head: THREE.Vector3, dir: THREE.Vector3, size: number, roll: number, fade: number, seed: number, time: number) {
    this.side.crossVectors(dir, UP); if (this.side.lengthSq() < 1e-6) this.side.set(1, 0, 0); this.side.normalize();
    this.a.crossVectors(this.side, dir).normalize();
    this.basis.makeBasis(dir, this.a, this.b.crossVectors(dir, this.a)); this.q.setFromRotationMatrix(this.basis);
    this.roll.setFromAxisAngle(X, roll); this.q.multiply(this.roll);
    this.center.copy(head).addScaledVector(dir, -size);
    this.crescents.add(this.center, this.q, size, size, size, CRESCENT.zoro, fade, seed, time, 1.1, .035);
  }
  update(time: number, dt: number, fighters: ReadonlyMap<string, Fighter>, density: number) {
    this.crescents.begin(); this.cuts.begin(); this.bolts.begin(); this.glows.begin(time); this.lights.begin();
    for (const p of this.live.values()) p.shown = false;
    const d = Math.max(.35, density);
    for (let i = this.casts.length - 1; i >= 0; i--) {
      const c = this.casts[i], e = c.event, actor = fighters.get(e.actorId), ultimate = e.slot === 'ultimate';
      const release = ultimate ? WORLD.contacts[0] : PHOENIX.contacts[0], finish = ultimate ? WORLD.contacts[WORLD.contacts.length - 1] : release;
      const life = ultimate ? (c.confirmed ? finish + .6 : release + 1) : release + PHOENIX.range / (PHOENIX.speed ?? 28) + .5;
      const age = castAge(c, time, actor, release, true);
      if (ultimate && actor?.state.action === 'ultimate' && actor.state.confirmedAt !== undefined) c.confirmed = true;
      if (age > life || age < -.2 || (c.hitAt === undefined && age < release && chargeWasCancelled(e, release, actor?.state, time))) { this.casts.splice(i, 1); continue; }
      if (actor && age < .1) c.floor = actor.group.position.y;
      if (ultimate && c.confirmed) gradeOnce(e.actorId, e.id, GRADE.wind, .55, finish - age + .7, e.actorId, actor?.state.target ?? undefined);
      else gradeLocal(e.actorId, e.id, GRADE.wind, .35, release + (ultimate ? OPENER_FEED : .7), actor?.group.position, e.actorId, actor?.state.target ?? undefined);
      this.dir.set(e.endpoint!.x - e.origin!.x, 0, e.endpoint!.z - e.origin!.z); if (this.dir.lengthSq() < 1e-6) this.dir.set(0, 0, 1); this.dir.normalize();
      if (!ultimate) {
        if (actor && age < release) {
          const gather = THREE.MathUtils.smoothstep(age, .05, release - .1);
          bodyCenter(actor, this.at);
          const n = Math.round(22 * d);
          for (let k = 0; k < n; k++) {
            const phase = (time * (1.4 + gather * 2) + k * .618) % 1, a = k * 2.399 + time * (4 + gather * 8), r = (1.3 - .8 * phase) * (.7 + .3 * gather), h = (k % 5) * .28 - .4;
            this.a.set(this.at.x + Math.cos(a) * r, this.at.y + h + phase * .3, this.at.z + Math.sin(a) * r);
            this.b.set(this.at.x + Math.cos(a + .5) * r * .95, this.a.y + .05, this.at.z + Math.sin(a + .5) * r * .95);
            this.bolts.segment(this.a, this.b, .02 + .02 * gather, WIND, (.3 + .7 * gather) * Math.sin(Math.PI * phase), .25);
          }
          this.glows.add(actor.handR, .7 * gather, HALO, .7 * gather, GLOW, .0001);
          this.lights.add(this.at, 3.5, LIGHT, .5 * gather);
          continue;
        }
        const flying = age - release, reach = Math.min(PHOENIX.range, flying * (PHOENIX.speed ?? 28));
        const after = c.hitAt !== undefined ? time - Math.max(c.hitAt, e.serverTime + (c.hold ?? 0) + release) : -1, fade = after >= 0 ? 1 - THREE.MathUtils.smoothstep(after, .25, .5) : 1 - THREE.MathUtils.smoothstep(reach, PHOENIX.range - 3, PHOENIX.range);
        if (fade <= .01) continue;
        const grow = .4 + .6 * THREE.MathUtils.smoothstep(flying, 0, .1);
        this.head.set(e.origin!.x, e.origin!.y + .25, e.origin!.z).addScaledVector(this.dir, reach + .9);
        this.side.crossVectors(this.dir, UP).normalize();
        for (let k = 0; k < 3; k++) {
          const turn = k * 2.094 + flying * 7;
          this.at.copy(this.head).addScaledVector(this.side, Math.cos(turn) * .45).addScaledVector(UP, Math.sin(turn) * .45).addScaledVector(this.dir, -k * .25);
          this.crescent(this.at, this.dir, 1.6 * grow, turn + 1.57, fade, e.id * 3 + k, time);
        }
        this.glows.add(this.head, 1.6, HALO, .5 * fade, GLOW, .0001);
        this.lights.add(this.head, 5, LIGHT, .8 * fade);
        continue;
      }
      if (!c.confirmed) continue;
      if (actor && age < finish + .45) this.asura(actor, age, release, finish, time);
      const after = age - finish;
      if (after >= -.04 && after < .5) {
        const foe = actor?.state.target ? fighters.get(actor.state.target) : undefined;
        if (foe) this.at.copy(foe.group.position).addScaledVector(UP, 1.1); else this.at.set(e.origin!.x, e.origin!.y + .2, e.origin!.z).addScaledVector(this.dir, 2.2);
        const open = THREE.MathUtils.smoothstep(after, -.04, .12), fade = 1 - THREE.MathUtils.smoothstep(after, .25, .5);
        this.side.crossVectors(this.dir, UP).normalize();
        for (let k = 0; k < 9; k++) {
          const roll = k * Math.PI / 9 + .15, size = (2.1 + .5 * open) * (1 + (k % 3) * .1);
          this.a.copy(this.side).multiplyScalar(Math.cos(roll)).addScaledVector(UP, Math.sin(roll));
          this.b.crossVectors(this.dir, this.a).normalize();
          this.basis.makeBasis(this.a, this.b, this.dir); this.q.setFromRotationMatrix(this.basis);
          this.center.copy(this.at).addScaledVector(this.a, -size).addScaledVector(this.dir, -.2 + k * .05);
          this.cuts.add(this.center, this.q, size, size, size, CRESCENT.zoro, fade * open, e.id * 9 + k, time, 1.3, .03);
        }
        this.glows.add(this.at, 2.2 * (1 + after), WIND, .8 * fade, STAR, .2, e.id);
        this.glows.add(this.at, 2.5 + after * 12, WIND, .6 * fade, RING, .05, e.id, .6);
        this.lights.add(this.at, 5.5, LIGHT, .8 * fade);
        if (!c.burst && after >= 0) { c.burst = true; this.kit.streaks(this.at.x, this.at.y, this.at.z, GREEN, this.kit.n(20, 6), 14, .035, time, this.dir, .6); }
      }
    }
    for (const [id, p] of this.live) if (!p.shown) { p.busy = false; p.root.visible = false; this.live.delete(id); }
    this.crescents.end(); this.cuts.end(); this.bolts.end(); this.glows.end(); this.lights.end();
  }
  private asura(f: Fighter, age: number, open: number, release: number, time: number) {
    if (!this.source) return;
    let p = this.live.get(f.state.id);
    if (!p) { p = this.phantoms.find(q => !q.busy) ?? this.make(); p.busy = true; this.live.set(f.state.id, p); }
    p.shown = true;
    const rise = THREE.MathUtils.smoothstep(age, open + .05, open + .5), flare = THREE.MathUtils.smoothstep(age, release - .35, release), gone = 1 - THREE.MathUtils.smoothstep(age, release + .1, release + .4);
    const s = f.state, back = 1.5 + .3 * flare;
    bodyCenter(f, this.a);
    p.root.position.set(this.a.x - Math.sin(s.yaw) * back, f.group.position.y + .45 * rise - .6 * (1 - rise), this.a.z - Math.cos(s.yaw) * back);
    p.root.rotation.set(0, s.yaw, 0); p.root.scale.setScalar(1.55 + .2 * flare);
    p.root.visible = rise * gone > .01;
    if (p.action) { const L = p.action.getClip().duration, u = Math.max(0, (age - open) / Math.max(.05, release - open)); p.action.time = Math.min(L - .001, u <= 1 ? u * ASURA_CUT * L : ASURA_CUT * L + (u - 1) * (release - open)); p.mixer.update(0); }
    p.shell.opacity = .55 * rise * gone * (1 + .4 * flare);
    p.shell.setColors(ASURA_BODY, flare > .5 ? 0xd8ffe0 : 0x8dffae);
    this.lights.add(this.a, 3.5, LIGHT, (.25 + .4 * flare) * rise * gone);
  }
  reset() { this.casts = []; this.seen.clear(); for (const p of this.live.values()) { p.busy = false; p.root.visible = false; } this.live.clear(); this.crescents.begin(); this.crescents.end(); this.cuts.begin(); this.cuts.end(); this.bolts.begin(); this.bolts.end(); this.glows.begin(0); this.glows.end(); this.lights.begin(); this.lights.end(); }
  dispose() { this.reset(); for (const p of this.phantoms) { p.shell.dispose(); p.mixer.stopAllAction(); p.root.removeFromParent(); } this.phantoms = []; this.crescents.dispose(); this.cuts.dispose(); this.bolts.dispose(); this.glows.dispose(); this.lights.dispose(); }
}
