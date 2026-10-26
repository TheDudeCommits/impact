import * as T from 'three';
import type { CombatEvent, PlayerState } from '../../game/types';
import { TOJI_MOVES } from '../../game/fighters/toji';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { MARK } from '../vfx/GroundMarks';
import { moveSource, slotFx } from '../../engine/client/forgeLive';
import { armoryDraws } from '../vfx/armory/drawn';
import { Roster96Batch, desertBladeGeometry } from './Roster96Batch';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { MoveStage, stageLook, type StageLook } from './MoveStage';
import { blowFloor, floorUnder } from './blowFloor';

export const TOJI_RESTRICTION_LIMITS = Object.freeze({ cuts: 96, chips: 96, pressure: 24, hits: 24, fangs: 12, kills: 6 });
export const TOJI_RESTRICTION_BEATS = Object.freeze({ confirm: TOJI_MOVES.ultimate.contacts[0], last: TOJI_MOVES.ultimate.contacts[4] });
const UP = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1), TAU = Math.PI * 2;
const INK = new T.Color(0x171d24), STEEL = new T.Color(0xe8f0ec), RED = new T.Color(0xb92a36), DUST = new T.Color(0xa89c84);
const STEEL_LOOK = stageLook(0xffffff, 0xc7d3cf, 0x38423f);
const SPARK_LOOK: StageLook = { ...STEEL_LOOK, main: STEEL_LOOK.main.clone().multiplyScalar(.5), core: STEEL_LOOK.core.clone().multiplyScalar(.8) };
const FLASH = new T.Color(1.62, 1.7, 1.67), BLOOD = new T.Color(1.9, .24, .3);
const HEAVY = TOJI_MOVES.heavy, SPECIAL = TOJI_MOVES.special, ULT = TOJI_MOVES.ultimate;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
type Hit = { area: boolean; ground: T.Vector3; actor: string; target: string; born: number; seed: number; yaw: number; final: boolean; p: T.Vector3 };
type Fang = { p: T.Vector3; yaw: number; born: number; life: number; size: number; count: number; seed: number; red: boolean; fan: number; live: boolean };
type Kill = { actor: string; target: string; seq: number; final: boolean };
type Dash = { seq: number; origin: T.Vector3 };

export function tojiPhysicalArea(state: Pick<PlayerState, 'fighter' | 'forge'>): boolean {
  return state.fighter === 'toji' && !slotFx(state, 'area') && !moveSource(state, 'area');
}

export class TojiHeavenlyRestriction {
  private readonly cuts: Roster96Batch; private readonly chips: Roster96Batch; private readonly pressure: Roster96Batch;
  private readonly stage: MoveStage; private readonly full?: VfxKit;
  private readonly hits: Hit[] = Array.from({ length: TOJI_RESTRICTION_LIMITS.hits }, () => ({ area: false, ground: new T.Vector3(), actor: '', target: '', born: -Infinity, seed: 0, yaw: 0, final: false, p: new T.Vector3() }));
  private readonly fangs: Fang[] = Array.from({ length: TOJI_RESTRICTION_LIMITS.fangs }, () => ({ p: new T.Vector3(), yaw: 0, born: -Infinity, life: 0, size: 0, count: 0, seed: 0, red: false, fan: .8, live: false }));
  private readonly kills: Kill[] = Array.from({ length: TOJI_RESTRICTION_LIMITS.kills }, () => ({ actor: '', target: '', seq: -1, final: false }));
  private readonly dashes = new Map<string, Dash>();
  private readonly seen = new Float64Array(128).fill(-1); private readonly seenTime = new Float64Array(128).fill(-1);
  private readonly bladeBases = new WeakMap<Fighter, T.Object3D | null>();
  private cursor = 0; private eventCursor = 0; private fangCursor = 0; private killCursor = 0; private disposed = false;
  private readonly p = new T.Vector3(); private readonly a = new T.Vector3(); private readonly b = new T.Vector3(); private readonly c = new T.Vector3();
  private readonly direction = new T.Vector3(); private readonly heading = new T.Vector3(); private readonly side = new T.Vector3(); private readonly ground = new T.Vector3();
  private readonly q = new T.Quaternion(); private readonly spin = new T.Quaternion();
  private readonly flat = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(scene: T.Scene, private readonly kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.cuts = new Roster96Batch(scene, 'toji-steel-cuts', desertBladeGeometry(), TOJI_RESTRICTION_LIMITS.cuts);
    this.chips = new Roster96Batch(scene, 'toji-contact-chips', new T.OctahedronGeometry(1, 0), TOJI_RESTRICTION_LIMITS.chips);
    this.pressure = new Roster96Batch(scene, 'toji-step-pressure', new T.RingGeometry(.96, 1, 28), TOJI_RESTRICTION_LIMITS.pressure);
    this.cuts.mesh.renderOrder = 6;
    this.stage = MoveStage.for(scene, kit);
    this.full = kit.sparks && kit.dust && kit.marks && kit.debris ? kit as VfxKit : undefined;
  }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'whiff' || e.kind === 'rejected' || e.kind === 'eliminated' || e.kind === 'respawn') {
      for (const h of this.hits) if (h.actor === e.actorId || h.target === e.actorId) h.actor = '';
      const gone = e.kind === 'eliminated' || e.kind === 'respawn';
      for (const k of this.kills) if (k.actor === e.actorId || gone && k.target === e.actorId && !k.final) k.actor = '';
      return;
    }
    const actor = fighters?.get(e.actorId), area = e.slot === 'area', seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (e.fighter !== 'toji') return;
    if (e.kind === 'confirm') {
      if (e.slot !== 'ultimate' || e.branch || !e.targetId || armoryDraws(e.fighter, e.slot, e.branch, e.actorId) || this.kills.some(k => k.actor === e.actorId && k.seq === seq)) return;
      Object.assign(this.kills[this.killCursor++ % this.kills.length], { actor: e.actorId, target: e.targetId, seq, final: false });
      return;
    }
    if (!e.endpoint || armoryDraws(e.fighter, e.slot, e.branch, e.actorId)) return;
    if (area ? e.kind !== 'impact' || !actor || !tojiPhysicalArea(actor.state) : e.kind !== 'hit') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const n = this.eventCursor++ % this.seen.length; this.seen[n] = e.id; this.seenTime[n] = e.serverTime;
    const h = this.hits[this.cursor++ % this.hits.length];
    h.area = area; h.actor = e.actorId; h.target = e.targetId ?? ''; h.born = e.serverTime; h.seed = e.id; h.yaw = fighters?.get(e.actorId)?.state.yaw ?? 0;
    h.final = e.slot === 'ultimate' && !e.branch && e.contactIndex === 4;
    if (area && actor) { actor.strikePoint(h.p); h.ground.copy(actor.group.position); }
    else h.p.set(e.endpoint.x, e.endpoint.y, e.endpoint.z);
    if (h.final && involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.34, h.p);
    if (!area && e.slot !== 'light') this.land(e, h, actor, e.targetId ? fighters?.get(e.targetId) : undefined, seq);
  }

  private land(e: CombatEvent, h: Hit, actor: Fighter | undefined, target: Fighter | undefined, seq: number) {
    const st = this.stage, kit = this.full, t = e.serverTime, point = h.p, dir = this.direction;
    const floor = blowFloor(actor, target, point.y - 1.2), ground = this.ground.set(point.x, floor, point.z);
    if (actor) dir.subVectors(point, actor.group.position).setY(0);
    if (!actor || dir.lengthSq() < .01) dir.set(Math.sin(h.yaw), 0, Math.cos(h.yaw));
    dir.normalize();
    if (e.slot === 'heavy') {
      this.fang(point, h.yaw, t, .32, e.branch ? 1.9 : 2.3, 2, e.id);
      st.burst(point, SPARK_LOOK, e.branch ? .9 : 1.05, t, { dir, floor, clean: true });
      st.shock(ground, STEEL_LOOK, 4.2, t, .42);
      kit?.groundImpact(point.x, floor, point.z, 0, 1, 0, 2, t, undefined, floor, dir);
      return;
    }
    if (e.slot === 'special') {
      const big = e.branch ? .7 : 1;
      this.fang(this.p.copy(point).addScaledVector(dir, .45), h.yaw, t, .5, 3.2 * big, e.branch ? 3 : 4, e.id, false, .4);
      st.burst(this.p.copy(point).addScaledVector(dir, .9), SPARK_LOOK, 1.45 * big, t, { dir, floor, clean: true });
      st.shock(ground, STEEL_LOOK, 6.5 * big, t, .5);
      if (!kit) return;
      kit.groundImpact(point.x, floor, point.z, 0, 1, 0, 3, t, undefined, floor, dir);
      this.dustCloud(ground, .75 * big, kit.n(6, 3), t, h.seed, dir);
      const dash = e.branch ? undefined : this.dashes.get(e.actorId);
      if (dash && dash.seq === seq) for (let i = 1; i <= 3; i++) {
        this.p.copy(dash.origin).lerp(ground, i / 4);
        if (kit.quality !== 'low') kit.marks.mark(MARK.crack, this.p.x, floor, this.p.z, 0, 1, 0, 1.5 + .3 * i, t, 2.6);
        if (i < 3) kit.dustSpray(this.p.x, floor, this.p.z, i % 2 ? dir.z : -dir.z, i % 2 ? -dir.x : dir.x, 3, 2.6, .42, t, .5, .9);
      }
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    const i = e.contactIndex ?? 0;
    if (!h.final) {
      this.fang(point, h.yaw + i * 1.3, t, .36, 2.2 + .25 * i, i ? 3 : 2, e.id + i);
      st.burst(point, SPARK_LOOK, .8 + .08 * i, t, { dir, floor, clean: true });
      if (i % 2) kit?.groundImpact(point.x, floor, point.z, 0, 1, 0, 2, t, undefined, floor, dir);
      return;
    }
    for (const kill of this.kills) if (kill.actor === e.actorId && kill.seq === seq) kill.final = true;
    this.fang(point, h.yaw, t, .7, 5.2, 5, e.id, true);
    st.burst(point, SPARK_LOOK, 2.4, t, { dir, floor, clean: true });
    st.shock(ground, STEEL_LOOK, 9, t, .6);
    st.shock(ground, STEEL_LOOK, 5.5, t + .12, .5);
    if (!kit) return;
    kit.groundImpact(point.x, floor, point.z, 0, 1, 0, 3, t, undefined, floor);
    for (let j = 0; j < 4; j++) {
      const ang = j * 1.571 + h.yaw + .6, r = 2.3 + .9 * hash(j + h.seed);
      this.p.set(ground.x + Math.cos(ang) * r, floor, ground.z + Math.sin(ang) * r);
      if (kit.quality !== 'low') kit.marks.mark(MARK.crack, this.p.x, floor, this.p.z, 0, 1, 0, 2.4, t + .04, 3);
      kit.debris.burst(kit.n(6, 2), this.p.x, floor, this.p.z, 0, 1, 0, 7, .8, .13, floor, 2);
    }
    this.dustCloud(ground, 1.7, kit.n(10, 4), t, h.seed);
  }
  private fang(p: T.Vector3, yaw: number, born: number, life: number, size: number, count: number, seed: number, red = false, fan = .8) {
    const fang = this.fangs[this.fangCursor++ % this.fangs.length];
    fang.p.copy(p); fang.yaw = yaw; fang.born = born; fang.life = life; fang.size = size; fang.count = count; fang.seed = seed; fang.red = red; fang.fan = fan; fang.live = true;
  }
  private dustCloud(ground: T.Vector3, size: number, count: number, born: number, seed: number, away?: T.Vector3) {
    const kit = this.full; if (!kit) return;
    const base = away ? Math.atan2(away.z, away.x) : 0;
    for (let i = 0; i < count; i++) {
      const ang = away ? base + (hash(i * 2.3 + seed) - .5) * 2.2 : i * 2.399963 + seed, v = 1.6 + 2.2 * hash(i * 3.3 + seed), r = size * (away ? 1.7 + 1.3 * hash(i + seed) : 1.1 + .7 * hash(i + seed));
      kit.smoke(ground.x + Math.cos(ang) * r, ground.y + size * (.25 + .3 * hash(i * 1.9 + seed)), ground.z + Math.sin(ang) * r, Math.cos(ang) * v, .5 + .9 * hash(i * 5.1 + seed), Math.sin(ang) * v, size * (.8 + .5 * hash(i * 7.7 + seed)), born + .03 * i, .8 + .45 * hash(i + 2.2));
    }
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, _flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    this.cuts.begin(time); this.chips.begin(time); this.pressure.begin(time);
    const st = this.stage.open(time), detail = this.kit.budget >= .65;
    for (const f of fighters.values()) {
      const s = f.state;
      if (s.fighter !== 'toji' || !s.alive || s.whiffedAt !== undefined) continue;
      const u = clamp(s.actionTime), fade = Math.sin(u * Math.PI);
      if (s.action === 'awaken') {
        const release = clamp((u - .40) / .35), opacity = Math.sin(release * Math.PI);
        this.p.copy(f.group.position); this.p.y += .025;
        const r = .25 + release * .85; this.pressure.add(this.p, this.flat, r, r, 1, INK, opacity * .65);
        for (let i = 0; i < (detail ? 8 : 4); i++) {
          const angle = i * 2.399 + s.yaw;
          this.p.copy(f.group.position); this.p.x += Math.sin(angle) * r; this.p.z += Math.cos(angle) * r; this.p.y += .03 + opacity * .13;
          this.q.setFromAxisAngle(UP, angle);
          this.chips.add(this.p, this.q, .024, .02, .05, DUST, opacity * .72);
        }
        continue;
      }
      const area = s.action === 'area' && tojiPhysicalArea(s);
      if (!area && s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate') continue;
      if (armoryDraws('toji', s.action, s.branch, s.id)) continue;
      if (s.action === 'ultimate' && s.confirmedAt === undefined && u * s.actionDuration > .62) continue;
      f.strikePoint(this.b); this.a.copy(f.handR);
      if (area) {
        const shown = f.shownBody ?? f;
        let base = this.bladeBases.get(shown);
        if (base === undefined) { base = shown.group.getObjectByName('TojiBladeBase') ?? null; this.bladeBases.set(shown, base); }
        base?.getWorldPosition(this.a);
      }
      this.p.lerpVectors(this.a, this.b, .7);
      this.direction.subVectors(this.b, this.a); const length = Math.max(.12, Math.min(.9, this.direction.length()));
      this.q.setFromAxisAngle(UP, s.yaw).multiply(this.spin.setFromAxisAngle(Z, (u - .4) * 4));
      const strength = s.action === 'light' ? .65 : .9;
      const trailFade = area ? Math.sin(clamp((u - .18) / .60) * Math.PI) : fade;
      this.cuts.add(this.p, this.q, length * .8, length * .30, 1, INK, trailFade * strength);
      this.cuts.add(this.p, this.q, length * .73, length * .20, 1, STEEL, trailFade * strength);
      if (s.action === 'special' && u > .15 && u < .76) {
        this.direction.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
        for (let i = 0; i < (detail ? 5 : 3); i++) {
          this.p.copy(f.group.position).addScaledVector(this.direction, -.30 - i * .12); this.p.y += .08 + i * .07;
          this.q.setFromUnitVectors(UP, this.direction);
          this.chips.add(this.p, this.q, .014, .24 + i * .04, .014, i % 2 ? INK : STEEL, fade * .65);
        }
      }
      if (area || s.action === 'light') continue;
      const elapsed = u * s.actionDuration, seed = (s.actionSeq ?? 0) * 7.3, hand = this.a, tip = this.b, feet = f.group.position;
      const heading = this.heading.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
      if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) this.edge(hand, tip, elapsed / contact, time);
        else if (elapsed < contact + .2) {
          const flare = 1 - (elapsed - contact) / .2;
          this.p.lerpVectors(hand, tip, .7).addScaledVector(heading, .35);
          this.q.setFromAxisAngle(UP, s.yaw).multiply(this.spin.setFromAxisAngle(Z, -.5 + (1 - flare) * 1.6));
          this.cuts.add(this.p, this.q, 1.58, .52, 1, INK, flare * .85); this.cuts.add(this.p, this.q, 1.5, .32, 1, FLASH, flare);
          st.light(this.p, 2.8, STEEL_LOOK, .32 * flare);
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        let dash = this.dashes.get(s.id);
        if (!dash || dash.seq !== (s.actionSeq ?? 0)) {
          if (!dash) this.dashes.set(s.id, dash = { seq: 0, origin: new T.Vector3() });
          dash.seq = s.actionSeq ?? 0; dash.origin.copy(feet);
          if (elapsed < .25 && this.full) { this.full.dustRing(feet.x, feet.y, feet.z, this.full.n(6, 3), .3, 3.2, .5, time); this.full.ring(feet.x, feet.y + .05, feet.z, .3, 2.6, time, .3, 0xffffff, 0xa89c84, .16, 'flat'); }
        }
        if (elapsed < release + .12) {
          const k = clamp(elapsed / release), left = clamp((release + .12 - elapsed) / .12), span = dash.origin.distanceTo(feet);
          this.edge(hand, tip, k, time);
          this.side.set(heading.z, 0, -heading.x);
          if (span > .3) {
            for (let i = 0, n = st.n(7, 4); i < n; i++) {
              const off = (hash(i * 3.1 + seed) - .5) * 1.2, h = .15 + 1.55 * hash(i * 5.7 + seed), lag = .5 * hash(i + seed);
              this.p.copy(dash.origin).addScaledVector(this.side, off); this.p.y += h;
              this.c.copy(feet).addScaledVector(this.side, off * .55).addScaledVector(heading, -.2 - lag); this.c.y += h;
              st.streak(this.p, this.c, .012 + .02 * hash(i * 1.3 + seed), STEEL_LOOK.main, (.5 + .5 * k) * left);
            }
            this.p.copy(dash.origin); this.p.y += .07; this.c.copy(feet).addScaledVector(heading, -.3); this.c.y += .07;
            st.streak(this.p, this.c, .34, STEEL_LOOK.main, .16 * left);
          }
          st.speed(.5 * k * left, s.id);
          if (st.tick && Math.floor(time * 30) % 3 === 0 && this.full && span > .3) this.full.puff(feet.x - heading.x * .8, feet.y + .1, feet.z - heading.z * .8, -heading.x * 1.2, .3, -heading.z * 1.2, .34, time, .4, .5);
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined) this.edge(hand, tip, elapsed / ULT.contacts[0], time);
    }
    for (const kill of this.kills) {
      if (!kill.actor) continue;
      const actor = fighters.get(kill.actor), victim = fighters.get(kill.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !kill.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== kill.seq || s.whiffedAt !== undefined) { kill.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (!kill.final && victim && elapsed < TOJI_RESTRICTION_BEATS.last) this.hunt(actor, victim, kill, elapsed, time);
    }
    for (const fang of this.fangs) {
      if (!fang.live) continue;
      const age = time - fang.born;
      if (age >= fang.life) { fang.live = false; continue; }
      if (age < 0) continue;
      const w = age / fang.life, fade = w < .45 ? 1 : 1 - (w - .45) / .55;
      for (let i = 0; i < fang.count; i++) {
        const since = age - i * (fang.red ? .012 : .03); if (since < 0) continue;
        const open = Math.min(1, since / (fang.red ? .03 : .05)), roll = fang.seed * 2.4 + i * Math.PI / fang.count + (i % 2 ? .35 : -.2), yaw = fang.yaw + ((i % 3) - 1) * fang.fan;
        const reach = fang.size * (.45 + .55 * open), thin = 1 - .5 * w;
        this.q.setFromAxisAngle(UP, yaw).multiply(this.spin.setFromAxisAngle(Z, roll));
        this.cuts.add(fang.p, this.q, reach * 1.05, reach * .3 * thin, 1, INK, fade * .88);
        this.cuts.add(fang.p, this.q, reach, reach * .18 * thin, 1, fang.red && i === 0 ? BLOOD : FLASH, fade);
        this.side.set(Math.cos(yaw) * Math.cos(roll), Math.sin(roll), -Math.sin(yaw) * Math.cos(roll));
        st.streak(this.p.copy(fang.p).addScaledVector(this.side, -reach * 1.25), this.c.copy(fang.p).addScaledVector(this.side, reach * 1.25), .03 + fang.size * .008, fang.red && i === 0 ? BLOOD : STEEL_LOOK.main, 1.15 * fade);
      }
      st.light(fang.p, 2 + fang.size, STEEL_LOOK, (fang.red ? .4 : .22) * fade * (1 - w));
    }
    for (const h of this.hits) {
      if (!h.actor) continue;
      const age = time - h.born, life = h.area ? .28 : h.final ? .34 : .22;
      if (age >= life || !fighters.get(h.actor)?.state.alive) { h.actor = ''; continue; }
      if (age < 0) continue;
      const fade = 1 - age / life, r = .26 + age * (h.final ? 2.8 : 1.7);
      if (h.area) {
        for (let i = 0; i < (detail ? 10 : 5); i++) {
          const angle = i * 2.399 + h.yaw;
          this.p.copy(h.ground); this.p.x += Math.sin(angle) * r; this.p.z += Math.cos(angle) * r;
          this.p.y += .025 + Math.sin(age / life * Math.PI) * .12;
          this.q.setFromAxisAngle(UP, angle);
          this.chips.add(this.p, this.q, .035 * fade, .025 * fade, .075 * fade, DUST, fade * .8);
        }
        continue;
      }
      for (let i = 0; i < (h.final ? 3 : 1); i++) {
        this.q.setFromAxisAngle(UP, h.yaw).multiply(this.spin.setFromAxisAngle(Z, .5 + i * 1.2 + h.seed * .31));
        this.cuts.add(h.p, this.q, r * 1.35, r * .55, 1, INK, fade);
        this.cuts.add(h.p, this.q, r * 1.22, r * .32, 1, h.final ? RED : STEEL, fade * .92);
      }
      for (let i = 0; i < (detail ? 7 : 3); i++) {
        const angle = i * 2.399 + h.seed;
        this.p.copy(h.p); this.p.x += Math.sin(angle) * r; this.p.y += Math.cos(angle) * r; this.p.z += Math.sin(i * 3.2) * r * .22;
        this.q.setFromAxisAngle(Z, -angle);
        this.chips.add(this.p, this.q, .012 * fade, .09 * fade, .012 * fade, i % 2 ? STEEL : INK, fade);
      }
    }
    this.cuts.end(); this.chips.end(); this.pressure.end(); st.close();
  }

  private edge(hand: T.Vector3, tip: T.Vector3, k: number, time: number) {
    k = clamp(k);
    this.stage.streak(hand, tip, .028, STEEL_LOOK.main, .45 + .65 * k);
    this.stage.glow(tip, .14 + .22 * k, STEEL_LOOK.core, .35 + .65 * k, STAR, .2, Math.floor(time * 24));
  }

  private hunt(actor: Fighter, victim: Fighter, kill: Kill, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - TOJI_RESTRICTION_BEATS.confirm) / (TOJI_RESTRICTION_BEATS.last - TOJI_RESTRICTION_BEATS.confirm));
    const centre = bodyCentre(victim, this.ground), floor = floorUnder(victim.group.position.x, victim.group.position.y, victim.group.position.z), radius = 3.2 - .9 * g, turn = time * (8 + 5 * g) + kill.seq;
    st.dim(.3 + .3 * g, kill.actor, kill.target);
    const links = st.n(13, 7);
    for (let arc = 0; arc < 2; arc++) {
      const head = turn + arc * Math.PI;
      for (let i = 0; i <= links; i++) {
        const a0 = head - i * .17, a1 = a0 - .1, wave = .55 * (1 - .4 * g);
        this.p.set(centre.x + Math.cos(a0) * radius, floor + 1.05 + wave * Math.sin(a0 * 2 + arc * 1.7), centre.z + Math.sin(a0) * radius);
        this.c.set(centre.x + Math.cos(a1) * radius, floor + 1.05 + wave * Math.sin(a1 * 2 + arc * 1.7), centre.z + Math.sin(a1) * radius);
        st.streak(this.p, this.c, .045 * (1 - i / (links * 1.6)), STEEL_LOOK.main, 1.05 * (1 - i / (links * 1.25)));
      }
      this.p.set(centre.x + Math.cos(head) * radius, floor + 1.05 + .55 * Math.sin(head * 2 + arc * 1.7) * (1 - .4 * g), centre.z + Math.sin(head) * radius);
      this.c.set(centre.x + Math.cos(head + .34) * radius, this.p.y, centre.z + Math.sin(head + .34) * radius);
      st.streak(this.p, this.c, .09, STEEL_LOOK.core, 1.2);
      st.glow(this.c, .3, STEEL_LOOK.core, .9, STAR, .2, Math.floor(time * 30) + arc);
      st.light(this.c, 2.6, STEEL_LOOK, .3);
    }
    for (let i = 0, n = st.n(5, 3); i < n; i++) {
      const a0 = -turn * .6 + i * TAU / n, r = radius + .5 + .35 * hash(i + kill.seq), y = floor + .25 + 1.7 * hash(i * 3.3 + kill.seq);
      this.p.set(centre.x + Math.cos(a0) * r, y, centre.z + Math.sin(a0) * r); this.c.set(centre.x + Math.cos(a0 + .7) * r, y, centre.z + Math.sin(a0 + .7) * r);
      st.streak(this.p, this.c, .16, STEEL_LOOK.main, .2 + .12 * g);
    }
    if (st.tick && this.full) {
      const ang = hash(time * 5.3 + kill.seq) * TAU, r = radius * (.85 + .3 * hash(time * 3.7));
      this.full.puff(centre.x + Math.cos(ang) * r, floor + .2, centre.z + Math.sin(ang) * r, -Math.sin(ang) * 2.4, .7 + .6 * hash(time * 2.1), Math.cos(ang) * 2.4, .7 + .3 * g, time, .5, .55);
    }
    st.speed(.25 + .3 * g, kill.actor, kill.target);
  }

  reset() {
    for (const h of this.hits) h.actor = ''; for (const fang of this.fangs) fang.live = false; for (const kill of this.kills) kill.actor = '';
    this.dashes.clear();
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.eventCursor = this.fangCursor = this.killCursor = 0;
    this.cuts.begin(0); this.chips.begin(0); this.pressure.begin(0); this.cuts.end(); this.chips.end(); this.pressure.end();
    this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.cuts.dispose(); this.chips.dispose(); this.pressure.dispose(); this.stage.release(); }
}
