import * as T from 'three';
import type { CombatEvent } from '../../game/types';
import { USOPP_MOVES } from '../../game/fighters/usopp';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import type { VfxKit } from '../vfx/VfxKit';
import { armoryDraws } from '../vfx/armory/drawn';
import { versioned } from '../../loading/assetVersions';
import { Roster96Batch, popGreenLeafGeometry } from './Roster96Batch';
import { MoveStage, STAGE, SHEEN } from './MoveStage';
import { blowFloor } from './blowFloor';
import { SIGNATURE, involvesLocal } from './context';

export const USOPP_POP_GREEN_LIMITS = Object.freeze({ seeds: 144, leaves: 192, rings: 48, silhouettes: 12, impacts: 24, tracers: 16, barrages: 4, loadTimeoutMs: 4000 });
export const USOPP_POP_GREEN_TEXTURES = Object.freeze({ wolf: '/assets/vfx/usopp/impact-wolf.webp', bird: '/assets/vfx/usopp/firebird-star.webp' });
const UP = new T.Vector3(0, 1, 0), FORWARD = new T.Vector3(0, 0, 1);
const GREEN = new T.Color(0x719d2e), LIME = new T.Color(0xd7f093), SEED = new T.Color(0xbf8b49);
const RED = new T.Color(0xee4c20), GOLD = new T.Color(0xffbd43);
const BRIGHT = new T.Color(1.55, 1.55, 1.55);
const SOOT = new T.Color(.07, .05, .05);
const POP = STAGE.green, FIRE = STAGE.fire, IMPACT = STAGE.quake;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
type Kind = 'seed' | 'wolf' | 'bird';
type Burst = { actor: string; target: string; born: number; kind: Kind; final: boolean; seed: number; point: T.Vector3; yaw: number };
type Tracer = { actor: string; born: number; from: T.Vector3; to: T.Vector3 };
type Barrage = { actor: string; target: string; seq: number; born: number; at: T.Vector3; floor: number; live: boolean };
type TextureState = { texture?: T.Texture; ready: boolean; aspect: number; cancel?: () => void };
const kindOf = (slot?: string, branch?: string): Kind => branch ? 'seed' : slot === 'heavy' ? 'wolf' : slot === 'special' ? 'bird' : 'seed';
const ULT = USOPP_MOVES.ultimate;
const SKULL_LIFE = 1.15;

export function usoppMuzzle(f: Fighter, out: T.Vector3): boolean {
  f.strikePoint(out);
  return Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z);
}

function skullTexture(): T.DataTexture {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size * 2 - 1, v = (y + .5) / size * 2 - 1;
    const cranium = Math.hypot(u / .78, (v - .22) / .7) < 1, jaw = Math.abs(u) < .46 && v < -.2 && v > -.86;
    const socket = Math.hypot((Math.abs(u) - .34) / .23, (v - .2) / .25) < 1, nose = Math.abs(u) < .1 * (1 - (v + .1) / .3) && v > -.2 && v < .1;
    const teeth = v < -.5 && v > -.86 && Math.abs(((u + .46) / .23) % 1 - .5) < .1;
    const on = (cranium || jaw) && !socket && !nose && !teeth, o = (y * size + x) * 4;
    data[o] = data[o + 1] = data[o + 2] = 255; data[o + 3] = on ? 255 : 0;
  }
  const texture = new T.DataTexture(data, size, size, T.RGBAFormat); texture.magFilter = texture.minFilter = T.LinearFilter; texture.needsUpdate = true;
  return texture;
}

export class UsoppPopGreen {
  private readonly seeds: Roster96Batch;
  private readonly leaves: Roster96Batch;
  private readonly rings: Roster96Batch;
  private readonly wolf: Roster96Batch;
  private readonly bird: Roster96Batch;
  private readonly skull: Roster96Batch;
  private readonly skullMap: T.DataTexture;
  private readonly batches: readonly Roster96Batch[];
  private readonly stage: MoveStage;
  private readonly textures: Record<'wolf' | 'bird', TextureState> = { wolf: { ready: false, aspect: 1 }, bird: { ready: false, aspect: 1.5 } };
  private readonly bursts: Burst[] = Array.from({ length: USOPP_POP_GREEN_LIMITS.impacts }, () => ({ actor: '', target: '', born: -Infinity, kind: 'seed', final: false, seed: 0, point: new T.Vector3(), yaw: 0 }));
  private readonly tracers: Tracer[] = Array.from({ length: USOPP_POP_GREEN_LIMITS.tracers }, () => ({ actor: '', born: -Infinity, from: new T.Vector3(), to: new T.Vector3() }));
  private readonly barrages: Barrage[] = Array.from({ length: USOPP_POP_GREEN_LIMITS.barrages }, () => ({ actor: '', target: '', seq: -1, born: 0, at: new T.Vector3(), floor: 0, live: false }));
  private readonly seenIds = new Float64Array(128).fill(NaN);
  private readonly seenTimes = new Float64Array(128).fill(NaN);
  private readonly cancelled = Array.from({ length: 32 }, () => ({ actor: '', through: -Infinity }));
  private seenCursor = 0; private burstCursor = 0; private tracerCursor = 0; private cancelCursor = 0; private barrageCursor = 0;
  private disposed = false; private loading?: Promise<void>;
  private readonly p = new T.Vector3(); private readonly center = new T.Vector3(); private readonly direction = new T.Vector3(); private readonly ground = new T.Vector3();
  private readonly q = new T.Quaternion(); private readonly spin = new T.Quaternion(); private readonly identity = new T.Quaternion();
  private readonly flat = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2);

  constructor(scene: T.Scene, private readonly kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.seeds = new Roster96Batch(scene, 'usopp-seeds', new T.IcosahedronGeometry(1, 0), USOPP_POP_GREEN_LIMITS.seeds);
    this.leaves = new Roster96Batch(scene, 'usopp-leaves', popGreenLeafGeometry(), USOPP_POP_GREEN_LIMITS.leaves);
    this.rings = new Roster96Batch(scene, 'usopp-impact-rings', new T.RingGeometry(.90, 1, 28), USOPP_POP_GREEN_LIMITS.rings);
    this.wolf = this.silhouette(scene, 'usopp-impact-wolf'); this.bird = this.silhouette(scene, 'usopp-firebird'); this.skull = this.silhouette(scene, 'usopp-skull');
    this.skullMap = skullTexture(); this.skull.mesh.material.uniforms.map.value = this.skullMap;
    this.batches = [this.seeds, this.leaves, this.rings, this.wolf, this.bird, this.skull];
    this.stage = MoveStage.for(scene, kit);
  }
  private silhouette(scene: T.Scene, name: string): Roster96Batch {
    const batch = new Roster96Batch(scene, name, new T.PlaneGeometry(1, 1), USOPP_POP_GREEN_LIMITS.silhouettes);
    const material = batch.mesh.material;
    batch.mesh.renderOrder = 6;
    material.uniforms.map = { value: null };
    material.vertexShader = `attribute vec4 effectTint;varying vec4 tint;varying vec2 tex;
      void main(){tint=effectTint;tex=uv;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
      center.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*center;}`;
    material.fragmentShader = `uniform sampler2D map;varying vec4 tint;varying vec2 tex;
      void main(){vec4 c=texture2D(map,tex);float a=c.a*tint.a;if(a<.01)discard;gl_FragColor=vec4(c.rgb*tint.rgb,a);
      #include <colorspace_fragment>
      }`;
    return batch;
  }
  load(ids: readonly string[]): Promise<void> {
    if (this.disposed || !ids.includes('usopp')) return Promise.resolve();
    return this.loading ??= Promise.all([this.loadTexture('wolf', this.wolf), this.loadTexture('bird', this.bird)]).then(() => {});
  }
  private loadTexture(kind: 'wolf' | 'bird', batch: Roster96Batch): Promise<void> {
    const state = this.textures[kind];
    return new Promise(resolve => {
      let finished = false;
      const finish = (texture?: T.Texture) => {
        if (finished) { texture?.dispose(); return; }
        finished = true; clearTimeout(timer); state.cancel = undefined;
        if (texture && !this.disposed) {
          texture.colorSpace = T.SRGBColorSpace; state.texture = texture; state.ready = true;
          const image = texture.image as { width?: number; height?: number } | undefined;
          if (image?.width && image.height) state.aspect = image.width / image.height;
          batch.mesh.material.uniforms.map.value = texture;
        } else texture?.dispose();
        resolve();
      };
      const timer = setTimeout(() => finish(), USOPP_POP_GREEN_LIMITS.loadTimeoutMs);
      state.cancel = () => finish();
      try { new T.TextureLoader().load(versioned(USOPP_POP_GREEN_TEXTURES[kind]), finish, undefined, () => finish()); }
      catch { finish(); }
    });
  }
  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'winner') { this.reset(); return; }
    if (e.kind === 'rejected' || e.kind === 'whiff') {
      if (e.slot === 'ultimate' || e.slot === undefined) { for (const tracer of this.tracers) if (tracer.actor === e.actorId) tracer.actor = ''; for (const barrage of this.barrages) if (barrage.actor === e.actorId) barrage.live = false; }
      return;
    }
    if (e.kind === 'eliminated' || e.kind === 'respawn' || e.kind === 'projectile-clash') {
      this.cancel(e.actorId, e.serverTime);
      if (e.kind === 'projectile-clash' && e.targetId) this.cancel(e.targetId, e.serverTime);
      return;
    }
    if (e.fighter !== 'usopp' || !e.slot || e.slot === 'area' || armoryDraws(e.fighter, e.slot, e.branch, e.actorId)) return;
    if (e.kind === 'confirm' && e.slot === 'ultimate' && !e.branch && e.targetId) {
      const victim = fighters?.get(e.targetId), actor = fighters?.get(e.actorId), barrage = this.barrages[this.barrageCursor++ % this.barrages.length];
      barrage.actor = e.actorId; barrage.target = e.targetId; barrage.seq = e.actionSeq ?? actor?.state.actionSeq ?? -1; barrage.born = e.serverTime; barrage.live = !!victim;
      if (victim) { barrage.at.copy(victim.group.position); barrage.floor = blowFloor(actor, victim, victim.group.position.y); }
      return;
    }
    if (!e.endpoint) return;
    const hit = e.kind === 'hit' || e.kind === 'blocked' || e.kind === 'guard-break';
    const releasedUlt = e.kind === 'release' && e.slot === 'ultimate' && !e.branch;
    if (!hit && !releasedUlt) return;
    if (!Number.isFinite(e.id) || !Number.isFinite(e.serverTime) || !Number.isFinite(e.endpoint.x) || !Number.isFinite(e.endpoint.y) || !Number.isFinite(e.endpoint.z)) return;
    for (let i = 0; i < this.seenIds.length; i++) if (this.seenIds[i] === e.id && this.seenTimes[i] === e.serverTime) return;
    const index = this.seenCursor++ % this.seenIds.length; this.seenIds[index] = e.id; this.seenTimes[index] = e.serverTime;
    const actor = fighters?.get(e.actorId);
    if (releasedUlt || (hit && e.slot === 'ultimate' && !e.branch && (e.contactIndex ?? 0) > 0)) {
      const hasMuzzle = actor && usoppMuzzle(actor, this.center);
      if (hasMuzzle || e.origin) {
        const tracer = this.tracers[this.tracerCursor++ % this.tracers.length];
        tracer.actor = e.actorId; tracer.born = e.serverTime;
        if (hasMuzzle) tracer.from.copy(this.center); else tracer.from.set(e.origin!.x, e.origin!.y, e.origin!.z);
        tracer.to.set(e.endpoint.x, e.endpoint.y, e.endpoint.z);
      }
    }
    if (!hit) return;
    const burst = this.bursts[this.burstCursor++ % this.bursts.length];
    burst.actor = e.actorId; burst.target = e.targetId ?? ''; burst.born = e.serverTime; burst.kind = kindOf(e.slot, e.branch);
    burst.final = e.kind === 'hit' && e.slot === 'ultimate' && !e.branch && e.contactIndex === 2;
    burst.point.set(e.endpoint.x, e.endpoint.y, e.endpoint.z); burst.seed = e.id; burst.yaw = actor?.state.yaw ?? 0;
    if (e.kind === 'hit') this.land(e, burst, actor, e.targetId ? fighters?.get(e.targetId) : undefined);
  }
  private land(e: CombatEvent, burst: Burst, actor: Fighter | undefined, victim: Fighter | undefined) {
    const st = this.stage, point = burst.point, t = e.serverTime, floor = blowFloor(actor, victim, point.y - 1.2);
    const dir = this.direction.set(Math.sin(burst.yaw), 0, Math.cos(burst.yaw)), ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'ultimate' && !e.branch) {
      if (burst.final) {
        for (const barrage of this.barrages) if (barrage.actor === e.actorId) barrage.live = false;
        if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.45, point);
        st.burst(point, FIRE, 2.2, t, { floor });
        st.erupt(ground, UP, FIRE, 1, 8, t + .04, .7);
        st.shock(ground, FIRE, 8, t, .55);
        st.scar(ground, FIRE, 2.8, t + .2, 2.2);
      } else if (e.contactIndex) { st.burst(point, POP, 1.6, t, { dir, floor }); st.shock(ground, POP, 5, t, .45); }
      else st.burst(point, POP, 1.2, t, { dir, floor });
      return;
    }
    if (burst.kind === 'wolf') {
      st.burst(point, POP, 1, t, { dir, floor });
      st.dome(point, IMPACT, 2.2, t, .35);
      st.shock(ground, IMPACT, 4.6, t, .45);
    } else if (burst.kind === 'bird') {
      st.burst(point, FIRE, 2, t, { dir, floor });
      st.erupt(ground, UP, FIRE, .8, 5.5, t + .04, .75);
      st.scar(ground, FIRE, 2.2, t + .05, 2.6);
    } else st.burst(point, POP, e.branch ? .8 : .45, t, { dir, floor, clean: !e.branch });
  }
  private cancel(actor: string, time: number) {
    for (const burst of this.bursts) if (burst.actor === actor || burst.target === actor) burst.actor = '';
    for (const tracer of this.tracers) if (tracer.actor === actor) tracer.actor = '';
    for (const barrage of this.barrages) if (barrage.actor === actor || barrage.target === actor) barrage.live = false;
    let cancelled = this.cancelled.find(c => c.actor === actor);
    if (!cancelled) cancelled = this.cancelled[this.cancelCursor++ % this.cancelled.length];
    cancelled.actor = actor; cancelled.through = time;
  }
  private cancelledFlight(flight: Flight): boolean {
    for (const record of this.cancelled) if (record.actor === flight.actorId && flight.since <= record.through) return true;
    return false;
  }
  private crest(kind: 'wolf' | 'bird', point: T.Vector3, width: number, alpha: number) {
    const aspect = this.textures[kind].aspect, height = width / aspect;
    (kind === 'bird' ? this.bird : this.wolf).add(point, this.identity, height * aspect, height, 1, BRIGHT, alpha);
  }
  private flight(flight: Flight, time: number, detail: boolean) {
    const kind = kindOf(flight.slot, flight.branch), bird = kind === 'bird', wolf = kind === 'wolf', st = this.stage;
    this.direction.copy(flight.heading); if (this.direction.lengthSq() < 1e-8) this.direction.copy(FORWARD); else this.direction.normalize();
    this.q.setFromUnitVectors(UP, this.direction);
    const radius = bird ? .16 : wolf ? .18 : .09;
    this.seeds.add(flight.position, this.q, radius, radius * 1.45, radius, bird ? GOLD : SEED, 1);
    const travelled = flight.origin ? Math.max(0, this.center.subVectors(flight.position, flight.origin).dot(this.direction)) : 0;
    for (let i = 1; i <= (detail ? 3 : 2); i++) {
      const back = Math.min(travelled, i * .22); if (back < .025) continue;
      this.p.copy(flight.position).addScaledVector(this.direction, -back);
      const r = radius * (1 - i * .18); this.seeds.add(this.p, this.q, r, r * 1.2, r, bird ? RED : LIME, .7 - i * .12);
    }
    const grown = clamp(.3 + travelled / 3);
    if ((bird || wolf) && this.textures[bird ? 'bird' : 'wolf'].ready) {
      this.crest(bird ? 'bird' : 'wolf', flight.position, (bird ? 3.6 : 2.6) * grown, .95);
    } else if (bird) {
      this.q.setFromUnitVectors(FORWARD, this.direction);
      for (let i = -3; i <= 3; i++) {
        this.p.set(i * .22, .08 - Math.abs(i) * .05, -Math.abs(i) * .15).applyQuaternion(this.q).add(flight.position);
        this.spin.setFromAxisAngle(FORWARD, -i * .20).premultiply(this.q);
        this.leaves.add(this.p, this.spin, .5, .75 + Math.abs(i) * .12, 1, i % 2 ? RED : GOLD, .88);
      }
    } else {
      this.q.setFromUnitVectors(FORWARD, this.direction);
      const count = wolf ? (detail ? 5 : 3) : 2, wide = wolf ? 2.4 : 1.5;
      for (let i = 0; i < count; i++) {
        const a = i * Math.PI * 2 / count + time * 5;
        this.p.set(Math.cos(a) * .11 * wide, Math.sin(a) * .11 * wide, -.08).applyQuaternion(this.q).add(flight.position);
        this.spin.setFromAxisAngle(FORWARD, a).premultiply(this.q);
        this.leaves.add(this.p, this.spin, .10 * wide, .19 * wide, 1, GREEN, .84);
      }
    }
    const tail = Math.min(travelled, bird ? 3 : wolf ? 2.4 : 1.8);
    if (tail > .1) {
      this.p.copy(flight.position).addScaledVector(this.direction, -tail);
      st.streak(this.p, flight.position, bird ? .3 : wolf ? .26 : .16, bird ? FIRE.main : POP.main, .7);
      st.streak(this.p, flight.position, bird ? .1 : .07, bird ? FIRE.core : POP.core, 1.4);
    }
    if (bird) st.orb(flight.position, this.direction, .5 * grown, FIRE, flight.since);
    else { st.glow(flight.position, wolf ? 1.1 * grown : .42, POP.main, wolf ? .7 : .8); st.glow(flight.position, wolf ? .4 : .16, POP.core, 1); st.light(this.p.copy(flight.position).setY(flight.position.y + .2), wolf ? 5 : 3, POP, wolf ? .5 : .32); }
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    for (const batch of this.batches) batch.begin(time);
    const detail = this.kit.budget >= .65, st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state;
      if (s.fighter !== 'usopp' || !s.alive) continue;
      if (s.action === 'awaken') {
        const head = f.drawnJoint('Head'); if (!head) continue;
        const u = clamp(s.actionTime), alpha = Math.sin(u * Math.PI) * .58;
        head.getWorldPosition(this.center); this.center.x += Math.sin(s.yaw) * .11; this.center.z += Math.cos(s.yaw) * .11;
        this.q.setFromAxisAngle(UP, s.yaw);
        this.rings.add(this.center, this.q, .10 + u * .09, .07 + u * .04, 1, LIME, alpha);
        for (let i = -1; i <= 1; i += 2) {
          this.p.set(i * (.15 + u * .05), .01, -.03).applyQuaternion(this.q).add(this.center);
          this.rings.add(this.p, this.q, .07 + u * .06, .035, 1, GREEN, alpha * .65);
        }
        continue;
      }
      this.windup(f, time);
    }
    for (const flight of flights.values()) {
      if (flight.fighter !== 'usopp' || !flight.released || flight.slot === 'area' || flight.slot === 'ultimate'
        || !flight.actorId || !fighters.get(flight.actorId)?.state.alive || this.cancelledFlight(flight)
        || armoryDraws(flight.fighter, flight.slot, flight.branch, flight.actorId)) continue;
      this.flight(flight, time, detail);
    }
    for (const tracer of this.tracers) {
      if (!tracer.actor) continue;
      const age = time - tracer.born;
      if (!fighters.get(tracer.actor)?.state.alive || age >= .20) { tracer.actor = ''; continue; }
      if (age < 0) continue;
      this.direction.subVectors(tracer.to, tracer.from); if (this.direction.lengthSq() < 1e-8) continue;
      this.direction.normalize(); this.q.setFromUnitVectors(UP, this.direction);
      const fade = 1 - clamp((age - .13) / .07);
      for (let i = 0; i < (detail ? 3 : 2); i++) {
        const u = clamp(age / .13 - i * .14); if (u === 0) continue;
        this.p.copy(tracer.from).lerp(tracer.to, u);
        this.seeds.add(this.p, this.q, .09, .19, .09, i ? LIME : SEED, fade);
      }
      const head = clamp(age / .13);
      this.p.copy(tracer.from).lerp(tracer.to, head); this.center.copy(tracer.from).lerp(tracer.to, Math.max(0, head - .45));
      st.streak(this.center, this.p, .2, POP.main, .8 * fade); st.streak(this.center, this.p, .07, POP.core, 1.5 * fade);
      st.glow(tracer.from, .5, POP.core, .9 * fade * (1 - head)); st.light(this.p, 4, POP, .4 * fade);
    }
    for (const barrage of this.barrages) if (barrage.live) this.devil(barrage, fighters, time, detail);
    for (const burst of this.bursts) {
      if (!burst.actor) continue;
      const age = time - burst.born, life = burst.final ? .62 : burst.kind === 'seed' ? .32 : .5;
      if (!fighters.get(burst.actor)?.state.alive || (burst.target && fighters.get(burst.target)?.state.alive === false) || age >= (burst.final ? SKULL_LIFE : life)) { burst.actor = ''; continue; }
      if (age < 0) continue;
      if (burst.final) {
        const v = age / SKULL_LIFE;
        this.p.copy(burst.point); this.p.y += .5 + v * 1.5;
        this.skull.add(this.p, this.identity, 3 + v * 1.4, 3 + v * 1.4, 1, SOOT, Math.min(1, age / .1) * Math.min(1, (1 - v) * 1.6) * .92);
      }
      if (age >= life) continue;
      const u = age / life, fade = 1 - u, scale = burst.final ? 2.6 : burst.kind === 'seed' ? .6 : 1.9;
      this.q.setFromAxisAngle(UP, burst.yaw);
      const r = (.15 + u * .70) * scale;
      this.rings.add(burst.point, this.q, r, r, 1, burst.kind === 'bird' ? GOLD : LIME, fade * .8);
      if (burst.kind !== 'seed' && this.textures[burst.kind].ready) {
        this.crest(burst.kind, burst.point, scale * (1.2 + u * .45), fade * fade * .9);
      }
      const count = detail ? (burst.final ? 18 : 8) : (burst.final ? 9 : 4);
      for (let i = 0; i < count; i++) {
        const a = i * 2.39996 + burst.seed, radius = scale * (.10 + u * (.6 + (i % 3) * .12));
        this.p.set(Math.cos(a) * radius, Math.sin(a) * radius + age * .7 - age * age * 1.5, Math.sin(a * 1.7) * radius * .45).applyQuaternion(this.q).add(burst.point);
        this.spin.setFromAxisAngle(FORWARD, a + u * 3).premultiply(this.q);
        const leaf = .14 * Math.sqrt(scale) * fade;
        this.leaves.add(this.p, this.spin, leaf, (.28 + (i % 3) * .05) * Math.sqrt(scale) * fade, 1, burst.kind === 'bird' ? (i % 2 ? RED : GOLD) : (i % 3 ? GREEN : LIME), fade);
      }
      if (burst.final) {
        this.p.copy(burst.point); this.p.y -= .35;
        this.rings.add(this.p, this.flat, r * 1.1, r * 1.1, 1, GREEN, fade * .6);
      }
    }
    for (const batch of this.batches) batch.end();
    st.close();
  }
  private windup(f: Fighter, time: number) {
    const s = f.state, st = this.stage;
    if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) return;
    if (armoryDraws('usopp', s.action, s.branch, s.id) || !usoppMuzzle(f, this.center)) return;
    const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 3.1;
    if (s.action === 'ultimate') {
      if (s.branch) return;
      const next = ULT.contacts.findIndex(c => elapsed < c), from = next <= 0 ? 0 : ULT.contacts[next - 1];
      if (next < 0 || (next > 0 && s.confirmedAt === undefined)) return;
      const k = clamp((elapsed - from) / Math.max(.2, ULT.contacts[next] - from));
      st.charge(this.center, next === 2 ? FIRE : POP, next === 2 ? .4 : .3, next === 0 ? k : k * k, seed + next);
      return;
    }
    const release = s.branch ? s.actionDuration * .5 : USOPP_MOVES[s.action].contacts[0];
    if (elapsed >= release) {
      const flash = 1 - (elapsed - release) / .1;
      if (flash > 0) { const look = s.action === 'special' && !s.branch ? FIRE : POP; st.glow(this.center, s.action === 'light' ? .4 : .8, look.core, flash); st.light(this.center, 3.5, look, .5 * flash); }
      return;
    }
    const k = clamp(elapsed / release);
    if (s.action === 'light') { st.glow(this.center, .14 + .12 * k, POP.core, .5 + .5 * k); st.glow(this.center, .4, POP.main, .4 * k); }
    else st.charge(this.center, s.action === 'special' && !s.branch ? FIRE : POP, s.action === 'special' ? .32 : .26, k, seed + time * 0);
  }
  private devil(barrage: Barrage, fighters: ReadonlyMap<string, Fighter>, time: number, detail: boolean) {
    const actor = fighters.get(barrage.actor), s = actor?.state, victim = fighters.get(barrage.target);
    if (!s?.alive || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== barrage.seq || s.whiffedAt !== undefined || !victim?.state.alive) { barrage.live = false; return; }
    const elapsed = s.actionTime * s.actionDuration, st = this.stage;
    if (elapsed >= ULT.contacts[2]) { barrage.live = false; return; }
    barrage.at.x = victim.group.position.x; barrage.at.z = victim.group.position.z;
    const grow = clamp((time - barrage.born) / .5), snap = clamp((elapsed - ULT.contacts[1]) / .14), shut = snap * (1 - clamp((elapsed - ULT.contacts[1] - .5) / .4) * .6);
    const count = detail ? 12 : 8, radius = 1.9 - 1.05 * shut, tall = (1.5 + 1.1 * shut) * grow;
    for (let i = 0; i < count; i++) {
      const a = i * Math.PI * 2 / count + barrage.seq, lean = .5 - .95 * shut;
      this.p.set(barrage.at.x + Math.cos(a) * radius, barrage.floor + tall * .45, barrage.at.z + Math.sin(a) * radius);
      this.direction.set(Math.cos(a) * lean, 1, Math.sin(a) * lean).normalize();
      this.q.setFromUnitVectors(UP, this.direction); this.spin.setFromAxisAngle(UP, -a + Math.PI / 2).premultiply(this.q);
      this.leaves.add(this.p, this.spin, .85 * grow, tall, 1, i % 2 ? GREEN : LIME, .95);
    }
    this.ground.set(barrage.at.x, barrage.floor, barrage.at.z);
    st.disc(this.ground, 3.4 * grow, POP.main, .5 + .3 * shut, SHEEN, 1, barrage.seq);
    st.light(this.p.set(barrage.at.x, barrage.floor + .8, barrage.at.z), 5.5, POP, (.45 + .25 * shut) * grow);
    st.dim(.3 * grow, barrage.actor, barrage.target);
  }
  reset() {
    for (const burst of this.bursts) burst.actor = '';
    for (const tracer of this.tracers) tracer.actor = '';
    for (const barrage of this.barrages) barrage.live = false;
    for (const record of this.cancelled) { record.actor = ''; record.through = -Infinity; }
    this.seenIds.fill(NaN); this.seenTimes.fill(NaN); this.seenCursor = this.burstCursor = this.tracerCursor = this.cancelCursor = this.barrageCursor = 0;
    for (const batch of this.batches) { batch.begin(0); batch.end(); }
    this.stage.reset();
  }
  dispose() {
    if (this.disposed) return;
    this.reset(); this.disposed = true;
    for (const key of ['wolf', 'bird'] as const) { const state = this.textures[key]; state.cancel?.(); state.texture?.dispose(); state.texture = undefined; state.ready = false; }
    this.skullMap.dispose();
    for (const batch of this.batches) batch.dispose();
    this.stage.release();
  }
}
