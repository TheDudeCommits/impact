import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { MOVES } from '../../game/moves';
import type { Fighter } from '../Fighter';
import { chargeWasCancelled } from '../CombatEffects';
import { VfxKit } from '../vfx/VfxKit';
import type { Element } from '../vfx/palette';
import { Crescents, crescentGeometry, CRESCENT } from './Crescent';
import { FloorGashes } from './FloorGash';
import { ScreenWipe } from './ScreenWipe';
import { GlowBatch, GLOW, RING, STAR } from './GlowBatch';
import { LightVolumes } from './LightVolumes';
import { ABYSS, flamePalette, flameSpriteGeometry, flameSpriteMaterial } from './FlameSprites';
import { SIGNATURE, involvesLocal, gradeOnce, gradeLocal, GRADE } from './context';
import { bodyCenter } from './body';
import { castAge, noteRelease } from './castClock';

const GETSUGA = MOVES.ichigo.special, MUGETSU = MOVES.ichigo.ultimate;
const RELEASE = GETSUGA.contacts[0], SPEED = GETSUGA.speed ?? 30;
const SIZE = 2.1, ARC = 1.1, LEAN = .42, SINK = .1;
const WALL_LEAD = .32, WALL_SPAN = .36, CLEAVE_LEAD = .1, CLEAVE_SPEED = 26, CLEAVE_SIZE = 6.8;
const WAVE = 1.5;
const RED: Element = { spike: 0xffd2c4, rim: 0xff2414, light: 0xff3a22, ink: 0x14010a };
const HALO = new THREE.Color(.55, .03, .02), HOT = new THREE.Color(1.6, .18, .1), DARK_HALO = new THREE.Color(.35, .01, .05);
const RED_LIGHT = new THREE.Color(1.5, .2, .12), RED_GLOW = new THREE.Color(2.6, .35, .15);
const UP = new THREE.Vector3(0, 1, 0);
type Cast = { event: CombatEvent; floor: number; hitAt?: number; hitPoint?: THREE.Vector3; released?: THREE.Vector3; flashed?: boolean; graded?: boolean; burst?: boolean; hold?: number; releasedAt?: number; drawn?: number; confirmed?: boolean; cleaved?: THREE.Vector3; burnt?: boolean };

export class BankaiEffects {
  private crescents: Crescents;
  private gashes: FloorGashes;
  private wipe: ScreenWipe;
  private glows = new GlowBatch(64, 'bankai-glow', true);
  private lights = new LightVolumes(6, 'bankai-light');
  private flameGeometry = flameSpriteGeometry();
  private flameMaterial = flameSpriteMaterial();
  private flames = new THREE.InstancedMesh(this.flameGeometry, this.flameMaterial, 640);
  private flameCount = 0;
  private casts: Cast[] = [];
  private seen = new Set<number>();
  private kit: VfxKit;
  private transform = new THREE.Object3D();
  private basis = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private dir = new THREE.Vector3(); private side = new THREE.Vector3(); private tilt = new THREE.Vector3();
  private head = new THREE.Vector3(); private center = new THREE.Vector3(); private tip = new THREE.Vector3(); private start = new THREE.Vector3();
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3();
  private tint = new THREE.Color();
  private body = new THREE.Vector3();
  private nextRock = 0;
  constructor(private scene: THREE.Scene) {
    this.crescents = new Crescents(scene, crescentGeometry(ARC, .36, .68), 8, 'getsuga-crescent');
    this.gashes = new FloorGashes(scene, 8, 'getsuga-floor-gash');
    this.wipe = new ScreenWipe(scene);
    this.kit = VfxKit.for(scene);
    this.flames.count = 0; this.flames.setColorAt(0, new THREE.Color(0, 0, flamePalette(ABYSS))); this.flames.frustumCulled = false;
    this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.flames.name = 'bankai-reiatsu'; this.flames.renderOrder = 3;
    scene.add(this.flames, this.glows.mesh, this.lights.mesh);
  }
  handle(events: readonly CombatEvent[]) {
    for (const e of events) {
      if (this.seen.has(e.id)) continue; this.seen.add(e.id); if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
      if (e.fighter !== 'ichigo' && e.kind === 'cast') continue;
      if (e.kind === 'release' && e.fighter === 'ichigo') noteRelease(this.casts, e);
      if (e.kind === 'cast' && e.origin && e.endpoint && (e.slot === 'special' && !e.branch || e.slot === 'ultimate')) {
        this.casts.push({ event: e, floor: e.origin.y - 1.05 }); if (this.casts.length > 12) this.casts.shift();
      }
      if ((e.kind === 'hit' || e.kind === 'blocked' || e.kind === 'guard-break') && e.endpoint)
        for (const c of this.casts) if (c.event.actorId === e.actorId && c.event.slot === e.slot && e.serverTime > c.event.serverTime && c.hitAt === undefined) { c.hitAt = e.serverTime; c.hitPoint = new THREE.Vector3(e.endpoint.x, e.endpoint.y, e.endpoint.z); }
    }
  }
  private flame(heat: number, seed: number) {
    if (this.flameCount >= 640) return;
    this.transform.updateMatrix(); this.flames.setMatrixAt(this.flameCount, this.transform.matrix);
    this.flames.setColorAt(this.flameCount++, this.tint.setRGB(heat, seed % 1, flamePalette(ABYSS)));
  }
  private aura(f: Fighter, strength: number, time: number, count: number, tall: number, radius: number) {
    const p = bodyCenter(f, this.body); p.y = f.group.position.y;
    for (let i = 0; i < count; i++) {
      const phase = (time * (1.1 + (i % 3) * .25) + i * .618) % 1, a = i * 2.399 + time * .9, r = radius * (.75 + .35 * ((i * .37) % 1)) * (1 + phase * .5);
      this.transform.position.set(p.x + Math.cos(a) * r, p.y + .15 + tall * (((i * .53) % 1) * .75 + phase * .35), p.z + Math.sin(a) * r);
      this.transform.quaternion.setFromUnitVectors(UP, this.a.set(Math.cos(a) * .3, 1, Math.sin(a) * .3).normalize());
      const grow = Math.sin(Math.PI * Math.min(1, phase * 1.2)) * strength;
      this.transform.scale.set(2.8 * grow, 2.6 * grow * (.8 + .4 * ((i * .71) % 1)), 1); this.flame(.2 + .6 * (1 - phase), i * .137);
    }
  }
  private blade(f: Fighter, strength: number, time: number, count: number) {
    f.strikePoint(this.b); this.a.copy(f.handR);
    if (this.a.distanceToSquared(this.b) < .04) this.b.copy(this.a).addScaledVector(UP, 1.1);
    for (let i = 0; i < count; i++) {
      const t = (i + .5) / count, phase = (time * 3.1 + i * .618) % 1;
      this.transform.position.copy(this.a).lerp(this.b, t); this.transform.position.y += phase * .18;
      this.transform.quaternion.setFromUnitVectors(UP, this.c.set(Math.sin(i * 1.7) * .3, 1, Math.cos(i * 1.3) * .3).normalize());
      const grow = (1 - phase * .7) * strength * (.7 + .5 * t);
      this.transform.scale.set(2.6 * grow, 1.9 * grow, 1); this.flame(.8 - phase * .5, i * .31 + .5);
    }
    this.c.copy(this.a).lerp(this.b, .6);
    this.glows.add(this.c, 1.1 * strength, HALO, .5 * strength, GLOW, 0);
    this.lights.add(this.c, 2.2, RED_LIGHT, .4 * strength);
  }
  private hand(f: Fighter, strength: number, time: number, count: number) {
    for (let i = 0; i < count; i++) {
      const phase = (time * 3.4 + i * .618) % 1, a = i * 2.399 + time * 4;
      this.transform.position.copy(f.handR).add(this.c.set(Math.cos(a) * .12, phase * .45, Math.sin(a) * .12));
      this.transform.quaternion.setFromUnitVectors(UP, this.c.set(Math.cos(a) * .3, 1, Math.sin(a) * .3).normalize());
      const grow = (1 - phase * .6) * strength;
      this.transform.scale.set(2.4 * grow, 2 * grow, 1); this.flame(.7 - phase * .4, i * .31 + .2);
    }
    this.glows.add(f.handR, .8 * strength, HALO, .45 * strength, GLOW, .0001);
    this.lights.add(f.handR, 2.2, RED_LIGHT, .45 * strength);
  }
  private orient(size: number, lean: number, floor: number) {
    this.side.crossVectors(this.dir, UP).normalize();
    this.tilt.copy(UP).multiplyScalar(Math.cos(lean)).addScaledVector(this.side, Math.sin(lean));
    this.c.crossVectors(this.dir, this.tilt);
    this.basis.makeBasis(this.dir, this.tilt, this.c); this.q.setFromRotationMatrix(this.basis);
    const rise = size * Math.sin(ARC) * Math.cos(lean) - SINK * size / SIZE;
    this.center.copy(this.head).addScaledVector(this.dir, -size); this.center.y = floor + rise;
    this.tip.copy(this.center).addScaledVector(this.dir, size * Math.cos(ARC)).addScaledVector(this.tilt, -size * Math.sin(ARC)); this.tip.y = floor;
  }
  private getsuga(c: Cast, e: CombatEvent, actor: Fighter | undefined, age: number, release: number, time: number, d: number, scale: number) {
    if (age < release - .02) return;
    const flying = age - release, reach = Math.min(GETSUGA.range, flying * SPEED);
    const after = c.hitAt !== undefined ? time - c.hitAt : -1, fade = after >= 0 ? 1 - THREE.MathUtils.smoothstep(after, .22, .46) : 1 - THREE.MathUtils.smoothstep(reach, GETSUGA.range - 3, GETSUGA.range);
    if (fade <= .01) return;
    const grow = .35 + .65 * THREE.MathUtils.smoothstep(flying, 0, .1), size = SIZE * scale * grow * (after >= 0 ? 1 + after * .5 : 1);
    this.head.set(e.origin!.x, c.floor, e.origin!.z).addScaledVector(this.dir, reach + 1.1);
    this.orient(size, LEAN, c.floor);
    if (!c.released) c.released = this.tip.clone();
    this.crescents.add(this.center, this.q, size, size, size, CRESCENT.getsuga, fade, e.id * 7, time, 1 + .15 * Math.sin(time * 37), .045);
    for (let k = 0; k < 5; k++) {
      const th = (k / 4 * 2 - 1) * ARC * .8;
      this.a.copy(this.center).addScaledVector(this.dir, Math.cos(th) * size * .86).addScaledVector(this.tilt, Math.sin(th) * size * .86);
      this.glows.add(this.a, size * .5, HALO, .14 * fade, GLOW, 0);
    }
    const tongues = Math.round(18 * d);
    for (let k = 0; k < tongues; k++) {
      const th = ((k + .5) / tongues * 2 - 1) * ARC * .85, phase = (time * 4 + k * .618) % 1, body = 1 - Math.pow(th / ARC, 2);
      this.transform.position.copy(this.center).addScaledVector(this.dir, Math.cos(th) * size * (.72 - phase * .35)).addScaledVector(this.tilt, Math.sin(th) * size * .8);
      this.transform.quaternion.setFromUnitVectors(UP, this.a.copy(this.dir).negate().addScaledVector(this.tilt, Math.sin(th) * .4).normalize());
      this.transform.scale.set(2.2 * body * fade, (2.6 + 1.6 * phase) * body * fade, 1); this.flame(.9 - phase * .6, k * .29);
    }
    this.gashes.add(c.released, this.tip, .26 * Math.min(1, grow + .2), fade, RED_GLOW, e.id);
    this.lights.add(this.a.copy(this.center).addScaledVector(this.dir, size * .7), 3.5, RED_LIGHT, .35 * fade);
    this.lights.add(this.tip, 2, RED_LIGHT, .5 * fade);
    if (time >= this.nextRock && after < 0 && fade > .5) {
      this.nextRock = time + .05;
      this.kit.debris.burst(this.kit.n(2, 1), this.tip.x, c.floor, this.tip.z, 0, 1, 0, 5, .7, .09, c.floor, 1.2);
      this.kit.streaks(this.tip.x, c.floor + .1, this.tip.z, RED, this.kit.n(3, 1), 7, .02, time, this.a.copy(this.dir).negate(), .6, 9);
    }
    if (c.hitPoint && !c.burst) { c.burst = true; this.kit.streaks(c.hitPoint.x, c.hitPoint.y, c.hitPoint.z, RED, this.kit.n(14, 4), 12, .03, time, this.dir, .7); this.kit.groundImpact(c.hitPoint.x, c.floor, c.hitPoint.z, 0, 1, 0, 2, time, RED, c.floor); }
    if (c.hitPoint && after >= 0 && after < .3) {
      const k = 1 - after / .3;
      this.glows.add(c.hitPoint, 1.6 * (1 + after * 2), HOT, .9 * k, STAR, .2, e.id);
      this.glows.add(c.hitPoint, 1.4 * (1 + after * 3), HALO, .7 * k, RING, .06, e.id, .5 + after);
      this.lights.add(c.hitPoint, 5, RED_LIGHT, 1.3 * k);
    }
  }
  update(time: number, dt: number, fighters: ReadonlyMap<string, Fighter>, density: number) {
    this.crescents.begin(); this.gashes.begin(); this.glows.begin(time); this.lights.begin(); this.flameCount = 0;
    this.flameMaterial.uniforms.uTime.value = time;
    const d = Math.max(.35, density);
    let wipe = 0;
    for (let i = this.casts.length - 1; i >= 0; i--) {
      const c = this.casts[i], e = c.event, actor = fighters.get(e.actorId), ultimate = e.slot === 'ultimate', move = ultimate ? MUGETSU : GETSUGA;
      const finish = MUGETSU.contacts[MUGETSU.contacts.length - 1], wallFrom = finish - WALL_LEAD, cleaveFrom = finish - CLEAVE_LEAD;
      if (ultimate && actor?.state.action === 'ultimate' && actor.state.confirmedAt !== undefined) c.confirmed = true;
      const life = ultimate ? (c.confirmed ? finish + 1 : MUGETSU.contacts[0] + 1) : Math.max(move.duration, RELEASE + move.range / SPEED) + .25;
      const release = ultimate ? MUGETSU.contacts[0] : RELEASE;
      const age = castAge(c, time, actor, release, true);
      if (age > life || age < -.2 || (c.hitAt === undefined && age < release && chargeWasCancelled(e, release, actor?.state, time))) { this.casts.splice(i, 1); continue; }
      if (actor && age < .1) c.floor = actor.group.position.y;
      this.dir.set(e.endpoint!.x - e.origin!.x, 0, e.endpoint!.z - e.origin!.z); if (this.dir.lengthSq() < 1e-6) this.dir.set(0, 0, 1); this.dir.normalize();
      if (ultimate && age < release + .6) this.getsuga(c, e, actor, age, release, time, d, WAVE);
      if (!ultimate) {
        gradeLocal(e.actorId, e.id, GRADE.getsuga, .45, RELEASE + .9, actor?.group.position, e.actorId, actor?.state.target ?? undefined);
        if (actor && age < RELEASE + .05) {
          const gather = THREE.MathUtils.smoothstep(age, .05, RELEASE - .15) * (1 - THREE.MathUtils.smoothstep(age, RELEASE, RELEASE + .05));
          this.blade(actor, .3 + .7 * gather, time, Math.round(9 * d));
          this.aura(actor, .15 + .35 * gather, time, Math.round(5 * d), 1.7, .3);
        }
        if (age < RELEASE - .02) continue;
        this.getsuga(c, e, actor, age, RELEASE, time, d, 1);
        continue;
      }
      const foe = actor?.state.target ? fighters.get(actor.state.target) : undefined;
      if (actor && age < release) {
        const gather = THREE.MathUtils.smoothstep(age, .02, release - .1);
        this.blade(actor, .4 + .6 * gather, time, Math.round(10 * d));
        this.aura(actor, .2 + .4 * gather, time, Math.round(8 * d), 1.8, .3);
      }
      if (!c.confirmed) continue;
      if (actor && age < cleaveFrom + .1) {
        const swell = THREE.MathUtils.smoothstep(age, release, wallFrom) * (1 - THREE.MathUtils.smoothstep(age, cleaveFrom, cleaveFrom + .1));
        const surge = THREE.MathUtils.smoothstep(age, wallFrom - .45, wallFrom);
        this.aura(actor, .35 + .65 * swell, time, Math.round((16 + 12 * surge) * d), 1.9 + .5 * surge, .3 + .12 * surge);
        this.hand(actor, .4 + .8 * swell, time, Math.round(8 * d));
        this.glows.add(bodyCenter(actor, this.a).addScaledVector(UP, .3), 2.4 + 1.2 * surge, DARK_HALO, .5 * swell, GLOW, .0001);
        if (!c.graded) { c.graded = true; if (involvesLocal(e.actorId, actor.state.target ?? undefined)) SIGNATURE.screen?.techniqueGrade?.(GRADE.getsuga, .7, Math.max(.3, wallFrom + .8 - age)); }
      }
      if (actor && age >= wallFrom && age < wallFrom + WALL_SPAN && involvesLocal(e.actorId, actor.state.target ?? undefined)) {
        wipe = Math.max(wipe, (age - wallFrom) / WALL_SPAN);
        bodyCenter(actor, this.wipe.from).addScaledVector(UP, .2);
        if (foe) this.wipe.toward.copy(foe.group.position).addScaledVector(UP, 1); else this.wipe.toward.copy(this.wipe.from).addScaledVector(this.dir, 4);
      }
      if (age >= cleaveFrom) {
        const flying = age - cleaveFrom, reach = Math.min(MUGETSU.range, flying * CLEAVE_SPEED), fade = 1 - THREE.MathUtils.smoothstep(flying, .5, .8);
        if (fade > .01) {
          const origin = e.origin!;
          this.head.set(origin.x, c.floor, origin.z).addScaledVector(this.dir, reach + 1.5);
          this.orient(CLEAVE_SIZE, .12, c.floor);
          if (!c.cleaved) c.cleaved = this.tip.clone();
          this.crescents.add(this.center, this.q, CLEAVE_SIZE, CLEAVE_SIZE, CLEAVE_SIZE * .9, CRESCENT.mugetsu, fade, e.id * 3, time, 1.2, .03);
          this.gashes.add(c.cleaved, this.tip, .75, fade, RED_GLOW, e.id + 5);
          this.lights.add(this.a.copy(this.center).addScaledVector(this.dir, CLEAVE_SIZE * .8), 9, RED_LIGHT, .9 * fade);
          if (time >= this.nextRock && fade > .5) { this.nextRock = time + .04; this.kit.debris.burst(this.kit.n(4, 2), this.tip.x, c.floor, this.tip.z, 0, 1, 0, 8, .9, .14, c.floor, 1.6); }
        }
        const at = c.hitPoint ?? (foe ? foe.group.position : undefined), burn = age - finish;
        if (at && burn >= 0 && burn < .75) {
          const k = 1 - THREE.MathUtils.smoothstep(burn, .35, .75), rise = THREE.MathUtils.smoothstep(burn, 0, .12), n = Math.round(46 * d);
          const floor = foe ? foe.group.position.y : c.floor;
          for (let j = 0; j < n; j++) {
            const phase = (time * 1.8 + j * .618) % 1, a = j * 2.399 + time, r = (.35 + .75 * ((j * .41) % 1)) * (.7 + .5 * burn);
            this.transform.position.set(at.x + Math.cos(a) * r, floor + (.3 + phase * 3.2) * rise, at.z + Math.sin(a) * r);
            this.transform.quaternion.setFromUnitVectors(UP, this.b.set(Math.cos(a) * .25, 1, Math.sin(a) * .25).normalize());
            this.transform.scale.set(2.2 * k * (1 - phase * .4), (2.8 + 2 * phase) * k, 1); this.flame(.5 + .5 * (1 - phase), j * .137);
          }
          this.b.set(at.x, floor + 1.4, at.z);
          this.glows.add(this.b, 3 * (1 + burn), HALO, .55 * k, GLOW, .03);
          this.lights.add(this.b, 6, RED_LIGHT, 1.2 * k);
          if (!c.burnt) { c.burnt = true; this.kit.groundImpact(at.x, floor, at.z, 0, 1, 0, 3, time, RED, floor); }
        }
      }
    }
    this.wipe.set(wipe, time);
    this.crescents.end(); this.gashes.end(); this.glows.end(); this.lights.end();
    this.flames.count = this.flameCount; this.flames.instanceMatrix.needsUpdate = true; if (this.flames.instanceColor) this.flames.instanceColor.needsUpdate = true;
  }
  reset() { this.casts = []; this.seen.clear(); this.wipe.set(0, 0); this.flames.count = 0; this.crescents.begin(); this.crescents.end(); this.gashes.begin(); this.gashes.end(); this.glows.begin(0); this.glows.end(); this.lights.begin(); this.lights.end(); }
  dispose() { this.reset(); this.crescents.dispose(); this.gashes.dispose(); this.wipe.dispose(); this.glows.dispose(); this.lights.dispose(); this.flames.removeFromParent(); this.flames.dispose(); this.flameGeometry.dispose(); this.flameMaterial.dispose(); }
}
