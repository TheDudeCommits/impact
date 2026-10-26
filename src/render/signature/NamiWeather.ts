import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { VfxKit } from '../vfx/VfxKit';
import { SPRITE } from '../vfx/SparkField';
import { BoltBatch } from './BoltBatch';
import { LightningPainter, type BoltStyle } from './Lightning';
import { NAMI_MOVES } from '../../game/fighters/nami';
import { bodyCentre } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { whiffGone } from './ultimateClock';
import { STAR } from './GlowBatch';
import { MoveStage, SHEEN, stageLook, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

const TAU = Math.PI * 2;
const COLD = new THREE.Color(0x6fcce9), HOT = new THREE.Color(0xffd666);
export const NAMI_STORM_ASSET = '/assets/fighters/nami-storm.webp';
const MAX_STORMS = 8;
export const THUNDERBOLT: StageLook = stageLook(0xfffbea, 0xffe57a, 0x3a4d8c, { heart: .5 });
export const CYCLONE: StageLook = stageLook(0xf2fcff, 0x7fd2f2, 0x1c5a8a);
const UP = new THREE.Vector3(0, 1, 0);
const HEAVY = NAMI_MOVES.heavy, SPECIAL = NAMI_MOVES.special, ULT = NAMI_MOVES.ultimate, FINAL = ULT.contacts.length - 1;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const chargeOf = (fighter: Fighter, out: THREE.Vector3) => typeof fighter.chargePosition === 'function' ? fighter.chargePosition(out) : out.copy(fighter.handR);
type Gust = { live: boolean; born: number; seed: number; floor: number; at: THREE.Vector3 };

export class NamiWeather {
  private stage?: MoveStage;
  private gusts: Gust[] = Array.from({ length: 4 }, () => ({ live: false, born: 0, seed: 0, floor: 0, at: new THREE.Vector3() }));
  private gustCursor = 0; private seen = new Float64Array(96).fill(-1); private seenTime = new Float64Array(96).fill(-1); private seenCursor = 0;
  private blow = new THREE.Vector3(); private ground = new THREE.Vector3(); private tip = new THREE.Vector3(); private c = new THREE.Vector3(); private point = new THREE.Vector3();
  private cloudTexture?: THREE.Texture;
  private cloudLoad?: Promise<void>;
  private disposed = false;
  private clouds = Array.from({ length: 16 }, () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, depthWrite: false, toneMapped: false }));
    sprite.name = 'nami-weather-cloud'; sprite.visible = false; return sprite;
  });
  private windGeometry = new THREE.TorusGeometry(1, .017, 4, 28, Math.PI * 1.65);
  private windMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { clock: { value: 0 } },
    vertexShader: `varying vec2 vUv;uniform float clock;void main(){vUv=uv;vec3 p=position+normal*.009*sin(uv.x*45.-clock*9.);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float clock;void main(){float tail=pow(max(0.,sin(vUv.x*3.14159)),.7);float edge=sin(vUv.y*3.14159);float flow=.62+.38*sin(vUv.x*24.-clock*7.);gl_FragColor=vec4(mix(vec3(.23,.7,.86),vec3(.8,.98,1.),edge),tail*edge*flow*.8);}`,
  });
  private wind = new THREE.InstancedMesh(this.windGeometry, this.windMaterial, 96);
  private bolts = new BoltBatch(512, 'nami-weather-lightning');
  private painter = new LightningPainter(this.bolts, 0);
  private style: BoltStyle = { width: .035, color: HOT, intensity: .85, levels: 4, jag: .2, branches: 2, branchLength: .23 };
  private storms = Array.from({ length: MAX_STORMS }, () => ({ actor: '', target: '', seq: -1, born: -1e9, seed: 0, p: new THREE.Vector3() }));
  private flashes = Array.from({ length: 12 }, () => ({ born: -1e9, seed: 0, big: false, from: new THREE.Vector3(), to: new THREE.Vector3() }));
  private stormCursor = 0;
  private flashCursor = 0;
  private cloudCount = 0;
  private windCount = 0;
  private object = new THREE.Object3D();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private nextMote = new WeakMap<Fighter, number>();
  constructor(private scene: THREE.Scene, private kit: VfxKit) {
    this.wind.name = 'nami-weather-currents';
    for (const mesh of [this.wind]) {
      mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.object.scale.setScalar(0); this.object.updateMatrix(); mesh.setMatrixAt(0, this.object.matrix); mesh.count = 1;
    }
    scene.add(...this.clouds, this.wind, this.bolts.mesh);
  }
  load(ids: readonly string[]) {
    if (!this.disposed) { if (ids.includes('nami')) this.stage ??= MoveStage.for(this.scene, this.kit); else if (this.stage) { this.stage.release(); this.stage = undefined; } }
    if (this.disposed || !ids.includes('nami')) return Promise.resolve();
    return this.cloudLoad ??= new THREE.TextureLoader().loadAsync(NAMI_STORM_ASSET).then(texture => {
      if (this.disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace; this.cloudTexture = texture;
      for (const cloud of this.clouds) { cloud.material.map = texture; cloud.material.needsUpdate = true; }
    }).catch(error => { this.cloudLoad = undefined; throw error; });
  }
  private cloud(p: THREE.Vector3, width: number, opacity = 1, tint = 0xffffff) {
    if (!this.cloudTexture || this.cloudCount >= this.clouds.length) return;
    const cloud = this.clouds[this.cloudCount++]; cloud.visible = true;
    cloud.position.copy(p); cloud.scale.set(width, width * .5, 1); cloud.material.opacity = opacity; cloud.material.color.setHex(tint);
  }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (event.fighter !== 'nami') return;
    this.land(event, fighters);
    if (event.branch) return;
    const actor = fighters?.get(event.actorId);
    if (event.kind === 'cast' && event.slot === 'ultimate' && event.endpoint) {
      const storm = this.storms[this.stormCursor++ % MAX_STORMS];
      storm.actor = event.actorId; storm.target = ''; storm.born = event.serverTime;
      storm.seq = event.actionSeq ?? actor?.state.actionSeq ?? -1; storm.seed = event.id;
      storm.p.set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
    }
    if (event.slot === 'ultimate' && (event.kind === 'confirm' || event.kind === 'release' || event.kind === 'hit')) {
      const storm = this.storms.find(s => s.actor === event.actorId && (event.actionSeq === undefined || s.seq === event.actionSeq));
      if (storm) { if (event.targetId) storm.target = event.targetId; if (event.endpoint) storm.p.set(event.endpoint.x, event.endpoint.y, event.endpoint.z); }
      if (event.kind === 'hit' && event.endpoint) {
        const flash = this.flashes[this.flashCursor++ % this.flashes.length];
        flash.born = event.serverTime; flash.seed = event.id; flash.big = (event.contactIndex ?? 0) > 0;
        flash.to.set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
        if (flash.big) flash.from.copy(flash.to).y += this.stage ? 4.2 : 1.8;
        else if (actor) chargeOf(actor, flash.from);
        else flash.from.copy(flash.to).y += 1.6;
        if (flash.big) {
          this.kit.ring(flash.to.x, flash.to.y, flash.to.z, .3, 2.1, event.serverTime, .34, 0xffffe0, 0x76cee8, .09);
          this.kit.pulse(flash.to.x, flash.to.y + 1.8, flash.to.z, 0xffdf86, 5, 6, event.serverTime, .28);
          if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.6, flash.to);
        }
      }
    }
  }
  private land(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const st = this.stage; if (!st || this.disposed || event.kind !== 'hit') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenTime[i] === event.serverTime) return;
    const index = this.seenCursor++ % this.seen.length; this.seen[index] = event.id; this.seenTime[index] = event.serverTime;
    const actor = fighters?.get(event.actorId), victim = event.targetId ? fighters?.get(event.targetId) : undefined;
    if (!victim && !event.endpoint) return;
    const point = this.point, t = event.serverTime, big = actor?.state.awakened ? 1.15 : 1, dir = this.blow;
    if (victim) bodyCentre(victim, point); else point.set(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    const floor = blowFloor(actor, victim, point.y - 1);
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.group.rotation.y), 0, Math.cos(actor.group.rotation.y)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (event.slot === 'light') { st.burst(point, THUNDERBOLT, .42, t, { dir, floor, clean: true }); return; }
    if (event.slot === 'heavy') {
      const k = (event.branch ? .8 : 1) * big;
      st.burst(point, THUNDERBOLT, .85 * k, t, { dir, floor });
      st.erupt(ground, UP, THUNDERBOLT, .28 * k, 6.5 * k, t, .3);
      st.shock(ground, THUNDERBOLT, 4.2 * k, t, .42);
      this.bolt(ground, t, 8 * k, false);
      return;
    }
    if (event.slot === 'special') {
      if (event.branch) { st.burst(point, CYCLONE, 1.6, t, { dir, floor }); st.shock(ground, CYCLONE, 4.2, t, .45); return; }
      st.burst(point, CYCLONE, 1.9 * big, t, { dir, floor });
      st.shock(ground, CYCLONE, 5.2 * big, t, .45);
      st.dome(point, CYCLONE, 2.6 * big, t, .4);
      const gust = this.gusts[this.gustCursor++ % this.gusts.length]; gust.live = true; gust.born = t; gust.seed = event.id; gust.floor = floor; gust.at.copy(ground);
      return;
    }
    if (event.slot !== 'ultimate' || event.branch) return;
    if ((event.contactIndex ?? 0) < FINAL) { st.burst(point, THUNDERBOLT, 1, t, { dir, floor }); return; }
    st.erupt(ground, UP, THUNDERBOLT, 1.1, 12, t, .55);
    st.shatter(point, dir, THUNDERBOLT, 6.5, t, .7);
    st.dome(point, THUNDERBOLT, 4.6, t, .45);
    st.burst(point, THUNDERBOLT, 2.2, t, { dir, floor });
    st.shock(ground, THUNDERBOLT, 10, t, .6);
    st.scar(ground, THUNDERBOLT, 3, t + .1, 2);
  }
  private bolt(at: THREE.Vector3, born: number, height: number, big: boolean) {
    const flash = this.flashes[this.flashCursor++ % this.flashes.length];
    flash.born = born; flash.seed = Math.floor(Math.abs(at.x * 31 + at.z * 17 + born * 7)); flash.big = big; flash.to.copy(at); flash.from.copy(at); flash.from.y += height;
  }
  private arc(p: THREE.Vector3, radius: number, yaw: number, tilt: number, y = 0) {
    if (this.windCount >= this.wind.count) return;
    this.object.position.copy(p); this.object.position.y += y;
    this.object.rotation.set(Math.PI / 2 + tilt, 0, yaw); this.object.scale.setScalar(radius);
    this.object.updateMatrix(); this.wind.setMatrixAt(this.windCount++, this.object.matrix);
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    this.cloudCount = 0; this.windCount = 0; this.wind.count = 96; this.bolts.begin(); this.windMaterial.uniforms.clock.value = time;
    for (const cloud of this.clouds) cloud.visible = false;
    const tick = Math.floor(time * 24), budget = this.kit.budget;
    let st = this.stage?.open(time);
    for (const fighter of fighters.values()) {
      const s = fighter.state;
      if (s.fighter !== 'nami' || !s.alive) continue;
      st ??= (this.stage = MoveStage.for(this.scene, this.kit)).open(time);
      const entry = s.action === 'awaken', age = s.actionTime * s.actionDuration;
      this.swing(st, fighter, age, time);
      const active = s.awakened && (!entry || age > .18);
      if (!active && s.action !== 'special' && s.action !== 'ultimate') continue;
      chargeOf(fighter, this.a);
      if (active) {
        const k = entry ? Math.min(1, age / .65) : Math.min(1, Math.max(0, (s.awakenedUntil ?? time) - time));
        this.arc(this.a, .24 + .08 * k, time * 2, .25);
        this.arc(this.a, .36 * k, -time * 2.4, -.3);
        if (entry) this.arc(this.a, .48 * k, -time * 3, 1.1);
        this.b.copy(fighter.group.position).y += 2.0;
        this.cloud(this.b, 1.35 * k, .8 * k);
        if (tick % 3 !== 0) {
          this.style.color = COLD; this.style.width = .018; this.style.intensity = .6 * k;
          this.style.levels = 3; this.style.branches = 1;
          this.painter.bolt(this.b, this.a, tick * 7, this.style);
        }

      }
      if (time >= (this.nextMote.get(fighter) ?? 0)) {
        this.nextMote.set(fighter, time + .09 / Math.max(.35, budget));
        const spec = this.kit.sparks.spec;
        for (let i = 0; i < 2; i++) {
          const a = time * 3 + i * Math.PI;
          spec.reset(SPRITE.glow, time, .24).pos(this.a.x + Math.cos(a) * .22, this.a.y + Math.sin(a) * .15, this.a.z + Math.sin(a) * .22)
            .sized(.12, .04, .4).hot(i ? 0xffc464 : 0x79daff, .7).cool(i ? 0xe68938 : 0x2c9fda, 0);
          this.kit.sparks.emit();
        }
      }
    }
    for (const flight of flights.values()) {
      if (flight.fighter !== 'nami' || flight.slot !== 'special' || flight.branch) continue;
      const born = time - flight.since, grow = flight.released ? 1.7 : .25;
      for (let i = 0; i < this.kit.n(7, 3); i++) {
        this.a.copy(flight.position).addScaledVector(flight.heading, (i - 3) * .19);
        this.arc(this.a, (.25 + i * .075) * grow, born * 12 + i * .8, .4 + i * .13, (i - 3) * .12 * grow);
      }
      if (st && flight.released) {
        const owner = flight.actorId ? fighters.get(flight.actorId) : undefined, floor = owner?.group.position.y ?? flight.position.y - 1.2;
        const away = owner ? clamp((Math.hypot(flight.position.x - owner.group.position.x, flight.position.z - owner.group.position.z) - .6) / 1.6) : 1, grown = .45 + .55 * away;
        this.funnel(st, this.c.set(flight.position.x, floor, flight.position.z), 3.2 * (flight.awakened ? 1.15 : 1) * grown, 1.15 * grown, born * 9, .3 + .7 * away, time);
      }
      if (flight.awakened) {
        this.a.copy(flight.position).addScaledVector(flight.heading, -.45);
        this.cloud(this.a, flight.released ? 1.1 : .5, .72);
        this.style.color = HOT; this.style.width = .025; this.style.intensity = .65;
        this.style.levels = 3; this.style.branches = budget < .5 ? 0 : 1;
        for (let i = 0; i < this.kit.n(3, 1); i++) {
          const a = time * 8 + i * TAU / 3;
          this.a.copy(flight.position).add(this.direction.set(Math.cos(a) * .65, Math.sin(a) * .65, 0));
          this.b.copy(flight.position).addScaledVector(flight.heading, -.75);
          this.painter.bolt(this.a, this.b, tick * 17 + i, this.style);
        }
      }
    }
    for (const storm of this.storms) {
      if (!storm.actor) continue;
      const actor = fighters.get(storm.actor), s = actor?.state;
      if (!s || !s.alive || s.action !== 'ultimate' || (s.actionSeq ?? -1) !== storm.seq || s.actionTime * s.actionDuration >= whiffGone(s)) { storm.actor = ''; continue; }
      const age = s.actionTime * s.actionDuration;
      const target = fighters.get(storm.target);
      if (target) storm.p.copy(target.group.position).y += 1;
      const grow = Math.min(1, age / .5) * Math.min(1, Math.max(0, (s.actionDuration - age) / .45));
      if (st && s.confirmedAt !== undefined && age < ULT.contacts[FINAL]) this.gather(st, actor!, storm, age, time, tick);
      this.a.copy(storm.p).y += 1.8;
      this.cloud(this.a, 2.8 * grow, grow);
      this.arc(this.a, 1.2 * grow, -time, .06, -.1);
      if (s.confirmedAt !== undefined && age < 1.95 && tick % 3 !== 0) {
        this.b.copy(this.a).add(this.direction.set(Math.sin(tick) * 1.1, -.15, Math.cos(tick) * .65));
        this.style.color = COLD; this.style.width = .012; this.style.intensity = .45; this.style.levels = 3; this.style.branches = 0;
        this.painter.bolt(this.a, this.b, tick + storm.seed, this.style);
      }
    }
    for (const flash of this.flashes) {
      const age = time - flash.born;
      if (age < 0 || age > .32) continue;
      this.style.color = flash.big ? THUNDERBOLT.main : HOT; this.style.width = flash.big ? .2 : .04;
      this.style.intensity = (flash.big ? 1.5 : 1.1) * (1 - age / .32); this.style.levels = budget < .5 ? 3 : 4; this.style.branches = flash.big ? 3 : 1;
      this.painter.bolt(flash.from, flash.to, flash.seed + tick * 7, this.style);
      if (st) { st.glow(flash.to, flash.big ? 1.6 : .7, THUNDERBOLT.core, .9 * (1 - age / .32), STAR, .2, tick); st.light(this.a.copy(flash.to).setY(flash.to.y + 1), flash.big ? 7 : 4, THUNDERBOLT, .6 * (1 - age / .32)); }
    }
    for (const gust of this.gusts) {
      if (!gust.live) continue; const age = time - gust.born; if (age >= .68) { gust.live = false; continue; } if (age < 0 || !st) continue;
      this.funnel(st, gust.at, 2.6 + 2.2 * clamp(age / .12), 1.3 + 1.2 * age, gust.seed + age * 9, 1 - age / .68, time);
    }
    this.wind.count = this.windCount; this.wind.instanceMatrix.needsUpdate = true;
    this.bolts.end();
    st?.close();
  }
  private swing(st: MoveStage, fighter: Fighter, age: number, time: number) {
    const s = fighter.state;
    if (s.whiffedAt !== undefined || s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate') return;
    const seed = (s.actionSeq ?? 0) * 5.7, big = s.awakened ? 1.15 : 1;
    const tip = typeof fighter.strikePoint === 'function' ? fighter.strikePoint(this.tip) : chargeOf(fighter, this.tip);
    if (s.action === 'light') {
      const k = Math.sin(clamp(s.actionTime) * Math.PI);
      st.glow(tip, .28, THUNDERBOLT.main, .55 * k); st.glow(tip, .32, THUNDERBOLT.core, .5 * k, STAR, .2, Math.floor(time * 24)); st.light(tip, 2.2, THUNDERBOLT, .22 * k);
    } else if (s.action === 'heavy') {
      const contact = s.branch ? s.actionDuration * .5 : HEAVY.contacts[0];
      if (age < contact) st.charge(tip, THUNDERBOLT, .22 * big, clamp(age / contact), seed);
      else if (age < contact + .2) { const flare = 1 - (age - contact) / .2; st.glow(tip, .6, THUNDERBOLT.core, .7 * flare, STAR, .2, Math.floor(time * 30)); st.glow(tip, .7, THUNDERBOLT.main, .5 * flare); st.light(tip, 3, THUNDERBOLT, .42 * flare); }
    } else if (s.action === 'special' && !s.branch) {
      const release = SPECIAL.contacts[0];
      if (age < release) {
        const k = clamp(age / release); chargeOf(fighter, this.tip);
        for (let i = 0, n = st.n(8, 4); i < n; i++) {
          const phase = (time * 1.8 + i * .618) % 1, ang = i * 2.399963 + time * 5, r = .5 + 2.2 * (1 - phase) * (1 - phase);
          this.a.set(this.tip.x + Math.cos(ang) * r, this.tip.y + (i % 3 - 1) * .3 * r, this.tip.z + Math.sin(ang) * r);
          this.b.set(this.tip.x + Math.cos(ang + .7) * r * .8, this.a.y, this.tip.z + Math.sin(ang + .7) * r * .8);
          st.streak(this.a, this.b, .05, CYCLONE.main, Math.sin(Math.PI * phase) * k);
        }
        st.glow(this.tip, .5 + .5 * k, CYCLONE.main, .3 * k); st.light(this.a.copy(this.tip).setY(this.tip.y + .3), 3.5 + 2 * k, CYCLONE, .2 + .35 * k);
      }
    } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && age < ULT.contacts[0]) { chargeOf(fighter, this.tip); st.charge(this.tip, THUNDERBOLT, .28, clamp(age / ULT.contacts[0]), seed); }
  }
  private funnel(st: MoveStage, base: THREE.Vector3, height: number, radius: number, phase: number, fade: number, time: number) {
    for (let strand = 0; strand < 3; strand++) for (let i = 0, n = st.n(6, 4); i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, a0 = phase + strand * 2.094 + u0 * 5, a1 = phase + strand * 2.094 + u1 * 5, r0 = radius * (.25 + .75 * u0), r1 = radius * (.25 + .75 * u1);
      this.a.set(base.x + Math.cos(a0) * r0, base.y + .1 + u0 * height, base.z + Math.sin(a0) * r0); this.b.set(base.x + Math.cos(a1) * r1, base.y + .1 + u1 * height, base.z + Math.sin(a1) * r1);
      st.streak(this.a, this.b, .09 + .08 * u0, CYCLONE.main, .55 * fade); st.streak(this.a, this.b, .03, CYCLONE.core, 1.1 * fade * (.5 + .5 * u0));
    }
    st.glow(this.a.set(base.x, base.y + height * .5, base.z), Math.max(radius * 1.4, height * .4), CYCLONE.main, .3 * fade);
    st.disc(this.a.set(base.x, base.y, base.z), radius * 2.4, CYCLONE.main, .6 * fade, SHEEN, 1, phase);
    st.light(this.a.set(base.x, base.y + height * .4, base.z), height * .9 + radius * 2 + 1.5, CYCLONE, .7 * fade);
    if (st.tick && fade > .3) { const ang = time * 9; this.kit.smoke(base.x + Math.cos(ang) * radius * .5, base.y + .2, base.z + Math.sin(ang) * radius * .5, -Math.sin(ang) * 2.4, 1.2, Math.cos(ang) * 2.4, radius * .7, time, .4); }
  }
  private gather(st: MoveStage, actor: Fighter, storm: { actor: string; target: string; seed: number; p: THREE.Vector3 }, age: number, time: number, tick: number) {
    const g = clamp((age - ULT.contacts[0]) / (ULT.contacts[FINAL] - ULT.contacts[0])), floor = Math.min(actor.group.position.y, storm.p.y - 1);
    st.dim(.3 + .45 * g, storm.actor, storm.target);
    const cloud = this.c.set(storm.p.x, floor + 4.6, storm.p.z), wide = 3.4 + 2.6 * g;
    for (let i = 0; i < 4; i++) { const ang = i * 1.571 + time * .2; this.a.set(cloud.x + Math.cos(ang) * wide * .28, cloud.y + (i % 2) * .35, cloud.z + Math.sin(ang) * wide * .28); this.cloud(this.a, wide * (.75 + .1 * i), .92, 0x4a5578); }
    this.cloud(cloud, wide, .95, 0x6a7598);
    const flick = .5 + .5 * Math.sin(tick * 12.9898);
    st.glow(this.a.set(cloud.x + Math.sin(tick * 3.1) * wide * .25, cloud.y - .2, cloud.z + Math.cos(tick * 1.7) * wide * .25), wide * .45, THUNDERBOLT.core, .5 * flick * (.4 + .6 * g));
    st.light(this.a.set(cloud.x, cloud.y - 1.4, cloud.z), wide + 2, THUNDERBOLT, (.25 + .3 * g) * (.6 + .4 * flick));
    if (tick % 3 !== 0) {
      const h = Math.floor(tick / 3) * 7.31 + storm.seed, ang = h * 2.399963, r = 1.4 + 2.2 * Math.abs(Math.sin(h * 1.9));
      this.b.set(storm.p.x + Math.cos(ang) * r, floor + .03, storm.p.z + Math.sin(ang) * r); this.a.set(cloud.x + Math.cos(ang) * wide * .2, cloud.y - .4, cloud.z + Math.sin(ang) * wide * .2);
      this.style.color = THUNDERBOLT.main; this.style.width = .05 + .04 * g; this.style.intensity = 1.2; this.style.levels = 4; this.style.branches = 1;
      this.painter.bolt(this.a, this.b, tick * 5 + storm.seed, this.style);
      st.glow(this.b, .45, THUNDERBOLT.core, .8, STAR, .2, tick);
    }
    st.disc(this.a.set(storm.p.x, floor, storm.p.z), 2.6 + 2.2 * g, THUNDERBOLT.main, .25 + .2 * g, SHEEN, 1, storm.seed);
    chargeOf(actor, this.tip); st.charge(this.tip, THUNDERBOLT, .26 + .2 * g, Math.max(.4, g), storm.seed);
    if (g > .8) st.speed(.5 * (g - .8) / .2, storm.actor, storm.target);
  }
  reset() {
    for (const storm of this.storms) storm.actor = '';
    for (const flash of this.flashes) flash.born = -1e9;
    for (const cloud of this.clouds) cloud.visible = false;
    for (const gust of this.gusts) gust.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.seenCursor = 0;
    this.wind.count = 0;
    this.bolts.begin(); this.bolts.end(); this.nextMote = new WeakMap();
    this.stage?.reset();
  }
  dispose() {
    this.disposed = true;
    this.reset();
    this.stage?.release(); this.stage = undefined;
    for (const cloud of this.clouds) { cloud.removeFromParent(); cloud.material.dispose(); }
    this.cloudTexture?.dispose(); this.wind.removeFromParent(); this.windGeometry.dispose(); this.windMaterial.dispose(); this.bolts.dispose();
  }
}
