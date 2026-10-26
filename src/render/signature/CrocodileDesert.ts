import * as T from 'three';
import type { CombatEvent } from '../../game/types';
import { CROCODILE_MOVES } from '../../game/fighters/crocodile';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import type { VfxKit } from '../vfx/VfxKit';
import { armoryDraws } from '../vfx/armory/drawn';
import { SIGNATURE, involvesLocal } from './context';
import { Roster96Batch, desertBladeGeometry } from './Roster96Batch';
import { MoveStage, SHEEN, stageLook, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const CROCODILE_DESERT_LIMITS = Object.freeze({ ribbons: 112, grains: 144, rings: 32, impacts: 24, confirms: 6 });
const UP = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1);
const INK = new T.Color(0x493221);
export const SAND: StageLook = stageLook(0xfff3d6, 0xd9b46a, 0x5e4020);
const DUNE = new T.Color(1.5, 1.02, .44), GOLD = new T.Color(2.15, 1.72, .86);
const DUST_LIT = 0xf2d9a0, DUST_SHADE = 0xa07a42;
const HEAVY = CROCODILE_MOVES.heavy, SPECIAL = CROCODILE_MOVES.special, ULT = CROCODILE_MOVES.ultimate;
const FINAL = ULT.contacts.length - 1;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
type Hit = { actor: string; target: string; born: number; seed: number; grade: number; final: boolean; point: T.Vector3; groundY: number; yaw: number };
type Confirm = { actor: string; target: string; seq: number; floor: number; final: boolean };

export class CrocodileDesert {
  private readonly stage: MoveStage;
  private readonly full?: VfxKit;
  private readonly ribbons: Roster96Batch;
  private readonly grains: Roster96Batch;
  private readonly rings: Roster96Batch;
  private readonly hits: Hit[] = Array.from({ length: CROCODILE_DESERT_LIMITS.impacts }, () => ({ actor: '', target: '', born: -Infinity, seed: 0, grade: 1, final: false, point: new T.Vector3(), groundY: .035, yaw: 0 }));
  private readonly confirms: Confirm[] = Array.from({ length: CROCODILE_DESERT_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, floor: 0, final: false }));
  private readonly seen = new Float64Array(128).fill(-1);
  private readonly seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private eventCursor = 0; private confirmCursor = 0; private disposed = false;
  private readonly p = new T.Vector3(); private readonly center = new T.Vector3(); private readonly a = new T.Vector3(); private readonly b = new T.Vector3();
  private readonly dir = new T.Vector3(); private readonly ground = new T.Vector3();
  private readonly q = new T.Quaternion(); private readonly spin = new T.Quaternion();
  private readonly flat = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(scene: T.Scene, private readonly kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit);
    this.full = (kit as VfxKit).smoke && (kit as VfxKit).dust ? kit as VfxKit : undefined;
    this.ribbons = new Roster96Batch(scene, 'crocodile-sand-ribbons', desertBladeGeometry(), CROCODILE_DESERT_LIMITS.ribbons, true);
    this.grains = new Roster96Batch(scene, 'crocodile-sand-grains', new T.OctahedronGeometry(1, 0), CROCODILE_DESERT_LIMITS.grains);
    this.rings = new Roster96Batch(scene, 'crocodile-ground-fracture', new T.RingGeometry(.94, 1, 32), CROCODILE_DESERT_LIMITS.rings, true);
  }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  private puffs(x: number, y: number, z: number, count: number, size: number, speed: number, born: number, life = .55, away?: T.Vector3) {
    const kit = this.full; if (!kit) return;
    const ax = away ? away.x : 0, az = away ? away.z : 0, spread = away ? .45 : 1;
    for (let i = 0, n = kit.n(count, 2); i < n; i++) {
      const ang = i * 2.399963 + born * 3.1, h = Math.abs(Math.sin(i * 7.31 + born)), c = Math.cos(ang) * spread, s = Math.sin(ang) * spread;
      kit.smoke(x + (c + ax * .6) * size * .3, y + h * size * .5, z + (s + az * .6) * size * .3, (c + ax) * speed, .6 + h * speed * .7, (s + az) * speed, size * (.7 + .5 * h), born, life * (.75 + .5 * h), DUST_LIT, DUST_SHADE);
    }
  }
  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'respawn' || e.kind === 'eliminated' || e.kind === 'whiff' || e.kind === 'rejected') {
      for (const hit of this.hits) if (hit.actor === e.actorId || hit.target === e.actorId) hit.actor = '';
      for (const c of this.confirms) if (c.actor === e.actorId || (e.kind === 'respawn' || e.kind === 'eliminated') && c.target === e.actorId && !c.final) c.actor = '';
      return;
    }
    if (e.fighter !== 'crocodile' || e.slot === 'area' || armoryDraws(e.fighter, e.slot, e.branch, e.actorId)) return;
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    const key = e.kind === 'confirm' ? -2 - e.id : e.id;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === key && this.seenTime[i] === e.serverTime) return;
    const index = this.eventCursor++ % this.seen.length; this.seen[index] = key; this.seenTime[index] = e.serverTime;
    const target = e.targetId ? fighters?.get(e.targetId) : undefined, actor = fighters?.get(e.actorId), seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.confirms[this.confirmCursor++ % this.confirms.length], { actor: e.actorId, target: e.targetId, seq, floor: blowFloor(actor, target, 0), final: false });
      return;
    }
    if (!e.endpoint) return;
    const hit = this.hits[this.cursor++ % this.hits.length];
    hit.actor = e.actorId; hit.target = e.targetId ?? ''; hit.born = e.serverTime; hit.seed = e.id;
    hit.final = e.slot === 'ultimate' && !e.branch && e.contactIndex === FINAL;
    hit.grade = hit.final ? 5 : e.slot === 'ultimate' ? 4 : e.slot === 'special' ? 3 : e.slot === 'heavy' ? 2 : 1;
    const floorY = (target?.state.grounded ? target.group.position.y : actor?.group.position.y) ?? e.endpoint.y - 1;
    hit.groundY = floorY + .035;
    hit.point.set(e.endpoint.x, e.endpoint.y, e.endpoint.z); hit.yaw = actor?.state.yaw ?? 0;
    const st = this.stage, t = e.serverTime, point = hit.point, dir = this.dir, big = actor?.state.awakened ? 1.15 : 1;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(hit.yaw), 0, Math.cos(hit.yaw)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floorY, point.z);
    if (e.slot === 'light') { st.burst(point, SAND, .42, t, { dir, floor: floorY, clean: true }); this.puffs(point.x, point.y - .2, point.z, 3, .5, 1.6, t, .35, dir); return; }
    if (e.slot === 'heavy') {
      const k = (e.branch ? .8 : 1) * big;
      st.burst(point, SAND, .85 * k, t, { dir, floor: floorY });
      st.shatter(this.a.copy(ground).setY(floorY + .05), UP, SAND, 2.8 * k, t, .55);
      st.shock(ground, SAND, 4.2 * k, t, .4);
      this.puffs(point.x + dir.x * .5, floorY + .2, point.z + dir.z * .5, 4, .7 * k, 2.6, t, .4, dir);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, SAND, 2, t, { floor: floorY }); st.shock(ground, SAND, 4.5, t, .45); st.scar(ground, SAND, 2.4, t + .05, 1.8); this.puffs(point.x, floorY + .2, point.z, 10, 1.3, 3.4, t); return; }
      const k = (e.branch ? .7 : 1) * big;
      st.burst(point, SAND, 1.9 * k, t, { dir, floor: floorY });
      st.erupt(ground, UP, SAND, .55 * k, 5 * k, t + .03, .55);
      st.shock(ground, SAND, 5 * k, t, .45);
      st.scar(ground, SAND, 2.3 * k, t + .05, 2);
      this.puffs(point.x, floorY + .3, point.z, 12, 1.5 * k, 3.6, t, .7);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!hit.final) { st.burst(point, SAND, e.contactIndex ? 1.25 : 1, t, { dir, floor: floorY }); if (e.contactIndex) { st.shock(ground, SAND, 5, t, .5); st.shatter(this.a.copy(ground).setY(floorY + .05), UP, SAND, 3.4, t, .6); } this.puffs(point.x + dir.x * .5, floorY + .2, point.z + dir.z * .5, 4, .8, 2.4, t, .45, dir); return; }
    let confirmed = false;
    for (const c of this.confirms) if (c.actor === e.actorId && c.seq === seq) { c.final = true; confirmed = true; }
    if (!confirmed) return;
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.48, point);
    st.shatter(this.a.copy(ground).setY(floorY + .06), UP, SAND, 9, t, 1.5);
    st.burst(point, SAND, 2.2, t, { dir, floor: floorY });
    st.erupt(ground, UP, SAND, .6, 9, t + .04, .6);
    st.shock(ground, SAND, 10, t, .6);
    st.scar(ground, SAND, 3.2, t + .1, 2.2);
    this.puffs(point.x, floorY + .3, point.z, 16, 2, 4.4, t, .9);
  }
  private vortex(center: T.Vector3, size: number, phase: number, opacity: number, detail: boolean) {
    const count = detail ? 9 : 5;
    for (let i = 0; i < count; i++) {
      const u = i / count, angle = phase * 7 + u * 9, radius = (.14 + u * .40) * size;
      this.p.copy(center); this.p.x += Math.sin(angle) * radius * .25; this.p.z += Math.cos(angle) * radius * .25;
      this.p.y += (u - .45) * size * 1.5;
      this.q.copy(this.flat).multiply(this.spin.setFromAxisAngle(Z, angle));
      this.ribbons.add(this.p, this.q, radius, radius, 1, i % 3 ? DUNE : GOLD, opacity * (.5 + .3 * u));
      if (i % 2 === 0) {
        this.p.x += Math.sin(angle) * radius; this.p.z += Math.cos(angle) * radius;
        this.grains.add(this.p, this.q, .035 * size, .045 * size, .028 * size, GOLD, opacity);
      }
    }
  }
  private twister(base: T.Vector3, height: number, radius: number, phase: number, opacity: number, detail: boolean, time: number) {
    const st = this.stage, count = detail ? 11 : 6;
    for (let i = 0; i < count; i++) {
      const u = (i + .5) / count, angle = phase * 6 + u * 11, r = radius * (.34 + .66 * u), lean = .18 * r;
      this.p.set(base.x + Math.sin(angle) * lean, base.y + (.06 + .94 * u) * height, base.z + Math.cos(angle) * lean);
      this.q.copy(this.flat).multiply(this.spin.setFromAxisAngle(Z, angle));
      this.ribbons.add(this.p, this.q, r * 1.04, r * 1.04, 1, INK, opacity * .5);
      this.ribbons.add(this.p, this.q, r, r, 1, i % 3 ? DUNE : GOLD, opacity * (.55 + .35 * u));
      if (i % 2 === 0) { this.a.set(this.p.x + Math.sin(angle + 1.3) * r * 1.2, this.p.y, this.p.z + Math.cos(angle + 1.3) * r * 1.2); this.grains.add(this.a, this.q, .05 * radius, .07 * radius, .04 * radius, GOLD, opacity); }
    }
    st.glow(this.p.set(base.x, base.y + height * .5, base.z), Math.max(radius * 1.5, height * .42), SAND.main, .34 * opacity);
    st.glow(this.p.set(base.x, base.y + height * .2, base.z), radius * .9, SAND.core, .3 * opacity);
    st.disc(this.p.set(base.x, base.y, base.z), radius * 2.6, SAND.main, .7 * opacity, SHEEN, 1, phase);
    st.light(this.p.set(base.x, base.y + height * .4, base.z), height * .9 + radius * 2 + 1.5, SAND, .75 * opacity);
    if (st.tick && this.full && opacity > .2) for (let j = 0; j < 2; j++) {
      const ang = time * 9 + j * 3.1, h = .15 + .7 * ((time * 1.7 + j * .5) % 1), r = radius * (.4 + .6 * h);
      this.full.smoke(base.x + Math.sin(ang) * r, base.y + h * height, base.z + Math.cos(ang) * r, Math.cos(ang) * 2.4, 1.4, -Math.sin(ang) * 2.4, radius * (.8 + .5 * h), time, .42, DUST_LIT, DUST_SHADE);
    }
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    this.ribbons.begin(time); this.grains.begin(time); this.rings.begin(time);
    const st = this.stage.open(time), detail = this.kit.budget >= .65;
    for (const f of fighters.values()) {
      const s = f.state;
      if (s.fighter !== 'crocodile' || !s.alive || s.whiffedAt !== undefined) continue;
      const u = clamp(s.actionTime), fade = Math.sin(u * Math.PI);
      if (s.action === 'awaken') {
        this.center.copy(f.group.position); this.center.y += .5;
        this.vortex(this.center, .8 + u * .6, u * 2, fade * .72, detail);
        this.p.copy(f.group.position); this.p.y += .035;
        const r = .5 + u * 1.1; this.rings.add(this.p, this.flat, r, r, 1, GOLD, fade * .7);
        continue;
      }
      if (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate') continue;
      if (armoryDraws('crocodile', s.action, s.branch, s.id)) continue;
      const elapsed = u * s.actionDuration, seed = (s.actionSeq ?? 0) * 4.7, big = s.awakened ? 1.15 : 1;
      if (s.action === 'ultimate' && s.confirmedAt === undefined && elapsed > .42) continue;
      if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) { const k = clamp(elapsed / release); this.center.copy(f.handR); this.vortex(this.center, .18 + u * .65, time, fade, detail); st.charge(f.handR, SAND, .34 * big, k, seed); st.disc(this.p.copy(f.group.position), 1.5 + 1.5 * k, SAND.main, .5 * k, SHEEN, 1, seed); }
        continue;
      }
      f.strikePoint(this.p);
      this.q.setFromAxisAngle(UP, s.yaw).multiply(this.spin.setFromAxisAngle(Z, -.9 + u * 3.4));
      const scale = s.action === 'light' ? .35 : .60;
      this.ribbons.add(this.p, this.q, scale, scale, 1, INK, fade * .85);
      this.ribbons.add(this.p, this.q, scale * .9, scale * .86, 1, GOLD, fade * .85);
      st.glow(this.p, scale * .9, SAND.main, .5 * fade); st.light(this.p, 2.2, SAND, .2 * fade);
      if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .5 : HEAVY.contacts[0];
        if (elapsed < contact) st.charge(f.handR, SAND, .22 * big, clamp(elapsed / contact), seed);
        else if (!s.branch && elapsed < contact + .3) {
          const advance = clamp((elapsed - contact) / .16), flare = 1 - (elapsed - contact) / .3, sin = Math.sin(s.yaw), cos = Math.cos(s.yaw);
          this.q.setFromAxisAngle(UP, s.yaw + Math.PI / 2);
          for (let i = 0; i < 3; i++) {
            const d = .9 + advance * (.5 + i * .62);
            this.p.set(f.group.position.x + sin * d, f.group.position.y + .32 * (1 - i * .14), f.group.position.z + cos * d);
            this.ribbons.add(this.p, this.q, .78 - i * .08, (1.25 - i * .2) * big, 1, INK, flare * .6);
            this.ribbons.add(this.p, this.q, .72 - i * .08, (1.15 - i * .2) * big, 1, i === 1 ? GOLD : DUNE, flare * .9);
            if (i < 2) this.ribbons.add(this.p, this.spin.setFromAxisAngle(UP, s.yaw), .34 - i * .06, (1.05 - i * .2) * big, 1, i ? DUNE : GOLD, flare * .8);
          }
          this.a.set(f.group.position.x + sin * .7, f.group.position.y + .06, f.group.position.z + cos * .7); this.b.set(f.group.position.x + sin * (.9 + advance * 1.9), f.group.position.y + .06, f.group.position.z + cos * (.9 + advance * 1.9));
          st.streak(this.a, this.b, .16, SAND.main, .6 * flare); st.streak(this.a, this.b, .05, SAND.core, 1.5 * flare);
          st.light(this.p.copy(this.b).setY(this.b.y + .5), 3.1, SAND, .44 * flare);
          if (st.tick && this.full) this.full.smoke(this.b.x, this.b.y + .3, this.b.z, sin * 1.5, 1.2, cos * 1.5, .6, time, .35, DUST_LIT, DUST_SHADE);
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined) st.charge(f.handR, SAND, .28, clamp(elapsed / ULT.contacts[0]), seed);
    }
    for (const flight of flights.values()) {
      if (flight.fighter !== 'crocodile' || !flight.released || armoryDraws(flight.fighter, flight.slot, flight.branch, flight.actorId)) continue;
      const big = flight.awakened ? 1.2 : 1, floor = (flight.actorId ? fighters.get(flight.actorId)?.group.position.y : undefined) ?? flight.position.y - 1.2, phase = time + flight.since;
      this.q.copy(this.flat).multiply(this.spin.setFromAxisAngle(Z, phase * 6));
      this.ribbons.add(flight.position, this.q, .62 * big, .62 * big, 1, GOLD, .9);
      if (flight.slot === 'special' && !flight.branch) this.twister(this.center.set(flight.position.x, floor, flight.position.z), 3.3 * big, 1.25 * big, phase, .92, detail, time);
      else this.vortex(flight.position, big, phase, .88, detail);
    }
    for (const c of this.confirms) {
      if (!c.actor) continue;
      const actor = fighters.get(c.actor), victim = fighters.get(c.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !c.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== c.seq || s.whiffedAt !== undefined) { c.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { c.actor = ''; continue; }
      if (!c.final && elapsed < ULT.contacts[FINAL]) this.gather(actor, c, elapsed, time, detail);
    }
    for (const hit of this.hits) {
      if (!hit.actor) continue;
      const age = time - hit.born, life = hit.final ? 1 : hit.grade === 3 ? .78 : .34;
      if (age >= life || !fighters.get(hit.actor)?.state.alive) { hit.actor = ''; continue; }
      if (age < 0) continue;
      const fade = 1 - age / life, radius = .18 + age * (hit.final ? 3.4 : 2.4);
      this.center.copy(hit.point);
      if (hit.final || hit.grade === 3) {
        const rise = clamp(age / .12), size = hit.final ? 1.5 : 1;
        this.twister(this.b.set(hit.point.x, hit.groundY, hit.point.z), (2.4 + 2.6 * rise) * size, (1.1 + .9 * age) * size, hit.seed + age * 1.4, Math.min(1, fade * 1.5) * .9, detail, time);
      }
      if (hit.final) {
        this.center.y = hit.groundY;
        this.rings.add(this.center, this.flat, radius, radius, 1, INK, fade * .9);
        this.rings.add(this.center, this.flat, radius * .85, radius * .85, 1, GOLD, fade * .8);
        const count = detail ? 7 : 4;
        for (let i = 0; i < count; i++) {
          const angle = i * Math.PI * 2 / count + hit.yaw;
          this.p.copy(this.center); this.p.x += Math.cos(angle) * radius * .65; this.p.z += Math.sin(angle) * radius * .65; this.p.y += .3 * fade;
          this.q.setFromAxisAngle(UP, angle).multiply(this.spin.setFromAxisAngle(Z, .45));
          this.ribbons.add(this.p, this.q, .32, (.5 + age) * fade, 1, DUNE, fade * .85);
        }
      }
      const count = detail ? 12 : 6;
      for (let i = 0; i < count; i++) {
        const angle = i * 2.399 + hit.seed * .13;
        this.p.copy(this.center); this.p.x += Math.sin(angle) * radius; this.p.z += Math.cos(angle) * radius; this.p.y += Math.sin(i * 4.1) * radius * .35 + age * .8;
        this.q.setFromAxisAngle(Z, angle + age * 5);
        this.grains.add(this.p, this.q, .025 * fade, (.04 + (hit.final ? .06 : 0)) * fade, .025 * fade, i % 2 ? GOLD : INK, fade);
      }
    }
    this.ribbons.end(); this.grains.end(); this.rings.end();
    st.close();
  }
  private gather(actor: Fighter, c: Confirm, elapsed: number, time: number, detail: boolean) {
    const st = this.stage, g = clamp((elapsed - ULT.contacts[0]) / (ULT.contacts[FINAL] - ULT.contacts[0])), seed = c.seq * 3.3;
    const feet = this.ground.copy(actor.group.position).setY(c.floor);
    st.dim(.25 + .4 * g, c.actor, c.target);
    st.pool(feet, 2.8 + 4 * g, SAND, .3 + .7 * g, seed);
    st.cracks(this.a.copy(feet).setY(c.floor + .05), UP, 2.6 + 5 * g, SAND, .3 + .7 * g, seed, .6 + .3 * g);
    for (let i = 0, n = detail ? 7 : 4; i < n; i++) {
      const ang = i * Math.PI * 2 / n + time * .7 + seed, r = 2.5 + .4 * g, h = .5 + 1.5 * g * (.6 + .4 * Math.abs(Math.sin(i * 2.3 + seed)));
      this.p.set(feet.x + Math.cos(ang) * r, c.floor + h * .5, feet.z + Math.sin(ang) * r);
      this.q.copy(this.flat).multiply(this.spin.setFromAxisAngle(Z, time * 5 + i * 1.7));
      this.ribbons.add(this.p, this.q, .5 + .3 * g, .5 + .3 * g, 1, i % 2 ? DUNE : GOLD, .5 + .35 * g);
      this.p.y += h * .5; this.ribbons.add(this.p, this.q, .38 + .25 * g, .38 + .25 * g, 1, GOLD, .4 + .3 * g);
      if (st.tick && this.full && i === Math.floor(time * 30) % n) this.full.smoke(this.p.x, c.floor + .3, this.p.z, -Math.sin(ang) * 1.6, 1.2 + 1.4 * g, Math.cos(ang) * 1.6, .7 + .5 * g, time, .5, DUST_LIT, DUST_SHADE);
    }
    st.light(this.p.copy(feet).setY(c.floor + 1), 5 + 3 * g, SAND, .3 + .4 * g);
    st.charge(actor.handR, SAND, .28 + .26 * g, Math.max(.4, g), seed);
    if (g > .8) st.speed(.5 * (g - .8) / .2, c.actor, c.target);
  }
  reset() {
    for (const h of this.hits) h.actor = ''; for (const c of this.confirms) c.actor = '';
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.eventCursor = this.confirmCursor = 0;
    this.ribbons.begin(0); this.grains.begin(0); this.rings.begin(0); this.ribbons.end(); this.grains.end(); this.rings.end(); this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.ribbons.dispose(); this.grains.dispose(); this.rings.dispose(); this.stage.release(); }
}
