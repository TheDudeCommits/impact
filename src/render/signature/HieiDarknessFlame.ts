import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { HIEI_MOVES } from '../../game/fighters/hiei';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { BLACK } from './FlameSprites';
import { STAR } from './GlowBatch';
import { MoveStage, STAGE, WAVE, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { Roster96Batch } from './Roster96Batch';
import { sweep } from './StageStrokes';

export const isHieiDarkness = (id: string | undefined) => id === 'hiei';
export const HIEI_DARKNESS_LIMITS = Object.freeze({ heads: 8, marks: 12, dragons: 6 });
const UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0);
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { v = clamp(v); return v * v * (3 - 2 * v); };
const FLAME: StageLook = { core: lin(2.3, 1.25, 3.1), main: lin(.95, .32, 1.95), rim: lin(.3, .08, .62), light: lin(.62, .28, 1.05), element: { spike: 0xe2c8ff, rim: 0x8240e5, light: 0x9a5cff, ink: 0x171020 }, shell: 0x6a2ac8, edge: 0x0c0616, flame: BLACK, dark: true, heart: 0, sphere: STAGE.dark.sphere };
const JAGAN: StageLook = { core: lin(2.9, 2.35, 3.3), main: lin(1.3, .48, 2.25), rim: lin(.36, .1, .8), light: lin(.92, .52, 1.38), element: { spike: 0xf4eaff, rim: 0x8240e5, light: 0xa878ff, ink: 0x171020 }, shell: 0x8240e5, edge: 0x2a0e5c, flame: BLACK, dark: false, heart: 0 };
const HEAD = new THREE.Color(1.3, 1.3, 1.3);
const HEAVY = HIEI_MOVES.heavy, SPECIAL = HIEI_MOVES.special, ULT = HIEI_MOVES.ultimate;
const FIRST = ULT.contacts[0], SECOND = ULT.contacts[1], LAST = ULT.contacts[2];
const ARC = .26, SEVER = .3, LAG = .042;
const CUT = 0, SEVERED = 1, RISE = 2;
type Dragon = { actor: string; target: string; seq: number; final: boolean; floor: number };
type Mark = { kind: number; born: number; life: number; size: number; seed: number; at: THREE.Vector3; dir: THREE.Vector3; floor: number; live: boolean };

export class HieiDarknessFlame {
  private readonly stage: MoveStage;
  private readonly heads: Roster96Batch;
  private texture?: THREE.Texture; private loading?: Promise<void>;
  private dragons: Dragon[] = Array.from({ length: HIEI_DARKNESS_LIMITS.dragons }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0 }));
  private marks: Mark[] = Array.from({ length: HIEI_DARKNESS_LIMITS.marks }, () => ({ kind: 0, born: -1e9, life: 0, size: 1, seed: 0, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), floor: 0, live: false }));
  private seen = new Float64Array(128).fill(-1); private seenAt = new Float64Array(128).fill(-1);
  private cursor = 0; private dragonCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private heading = new THREE.Vector3(); private side = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3();
  private root = new THREE.Vector3(); private tip = new THREE.Vector3(); private hand = new THREE.Vector3(); private prey = new THREE.Vector3();
  private q = new THREE.Quaternion();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit);
    this.heads = new Roster96Batch(scene, 'hiei-dragon-heads', new THREE.PlaneGeometry(1, 1), HIEI_DARKNESS_LIMITS.heads);
    const material = this.heads.mesh.material;
    this.heads.mesh.renderOrder = 6;
    material.uniforms.map = { value: null }; material.uniforms.ready = { value: 0 };
    material.vertexShader = `attribute vec4 effectTint;varying vec4 tint;varying vec2 tex;
      void main(){tint=effectTint;tex=uv;vec4 c=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
      vec2 axis=(modelViewMatrix*instanceMatrix*vec4(1.,0.,0.,0.)).xy;axis=length(axis)>.0001?normalize(axis):vec2(1.,0.);
      float sx=length(instanceMatrix[0].xyz),sy=length(instanceMatrix[1].xyz),flip=axis.x<0.?-1.:1.;
      c.xy+=axis*position.x*sx+vec2(-axis.y,axis.x)*position.y*sy*flip;gl_Position=projectionMatrix*c;}`;
    material.fragmentShader = `uniform sampler2D map;uniform float ready;varying vec4 tint;varying vec2 tex;
      void main(){vec4 c=texture2D(map,tex);float a=c.a*tint.a*ready;if(a<.02)discard;gl_FragColor=vec4(c.rgb*tint.rgb,a);
      #include <colorspace_fragment>
      }`;
  }
  load(ids: readonly string[]): Promise<void> {
    if (this.disposed || !ids.includes('hiei')) return Promise.resolve();
    return this.loading ??= new THREE.TextureLoader().loadAsync('/assets/vfx/hiei-darkness-dragon.webp').then(t => {
      if (this.disposed) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      this.texture = t; this.heads.mesh.material.uniforms.map.value = t; this.heads.mesh.material.uniforms.ready.value = 1;
    }).catch(e => { this.loading = undefined; throw e; });
  }
  private cancel(actor: string, victim = false) { for (const d of this.dragons) if (d.actor === actor || victim && d.target === actor && !d.final) d.actor = ''; }
  private mark(kind: number, at: THREE.Vector3, dir: THREE.Vector3, floor: number, born: number, life: number, size: number) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.kind = kind; m.at.copy(at); m.dir.copy(dir); m.floor = floor; m.born = born; m.life = life; m.size = size; m.seed = (Math.abs(at.x * 11.3 + at.z * 6.1 + born * 2.9)) % 47; m.live = true;
  }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isHieiDarkness(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'confirm' && e.kind !== 'hit') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenAt[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenAt[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), victim = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = blowFloor(actor, victim, Infinity);
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.dragons[this.dragonCursor++ % this.dragons.length], { actor: e.actorId, target: e.targetId, seq, final: false, floor: Number.isFinite(floor) ? floor : 0 });
      return;
    }
    if (!victim && !e.endpoint) return;
    const final = e.slot === 'ultimate' && !e.branch && e.contactIndex === ULT.contacts.length - 1, point = this.p, st = this.stage, t = e.serverTime;
    if (victim) bodyCentre(victim, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    if (!Number.isFinite(floor)) floor = point.y - 1.05;
    let confirmed = false;
    if (final) for (const d of this.dragons) if (d.actor === e.actorId && d.seq === seq) { d.final = true; floor = d.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'light') { st.burst(point, JAGAN, .45, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      this.mark(CUT, point, dir, floor, t, .32, 1.5 * big);
      st.burst(point, JAGAN, .62 * big, t, { dir, floor });
      st.scar(ground, FLAME, 1.7 * big, t + .05, 1.4);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, JAGAN, 2, t, { floor }); st.shock(ground, JAGAN, 4.5, t, .45); st.scar(ground, FLAME, 3.2, t, 1.8); return; }
      const big = e.branch ? .7 : 1;
      this.mark(SEVERED, point, dir, floor, t, .62, big);
      st.burst(point, JAGAN, 1.9 * big, t, { dir, floor });
      st.shock(ground, JAGAN, 5.5 * big, t, .45);
      st.erupt(ground, UP, FLAME, .8 * big, 4.8 * big, t + .06, .8);
      st.scar(ground, FLAME, 3.2 * big, t + .03, 1.9);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      st.burst(point, JAGAN, e.contactIndex ? 1.7 : 1, t, { dir, floor });
      if (e.contactIndex) { st.shock(ground, JAGAN, 5, t, .5); st.scar(ground, FLAME, 2.2, t + .05, 1.2); } else this.mark(CUT, point, dir, floor, t, .32, 1.4);
      return;
    }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.52, point);
    this.mark(RISE, ground, dir, floor, t, .75, 1);
    st.burst(point, JAGAN, 2.6, t, { dir, floor });
    st.erupt(ground, UP, FLAME, .85, 10, t + .03, .7);
    st.dome(point, JAGAN, 4.5, t, .5);
    st.shock(ground, JAGAN, 9, t, .6);
    for (let i = 0; i < 3; i++) { const ang = i * 2.094 + .9; st.erupt(this.a.set(ground.x + Math.cos(ang) * 3.4, floor, ground.z + Math.sin(ang) * 3.4), UP, FLAME, .5, 4.2, t + .14 + i * .05, .45); }
    st.scar(ground, FLAME, 4.8, t + .1, 2);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, _flights?: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time); this.heads.begin(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isHieiDarkness(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.awakening(f, time); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 4.7, feet = f.group.position, heading = this.face(f), side = this.side;
      if (s.action === 'light') {
        this.wreath(f, Math.sin(clamp(s.actionTime) * Math.PI), .5, seed);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) {
          const k = clamp(elapsed / contact);
          this.wreath(f, k, 1 + .6 * k, seed);
          st.charge(this.hand, JAGAN, .2, k, seed);
        } else if (elapsed < contact + ARC) {
          const u = (elapsed - contact) / ARC, cut = clamp(u / .35), fade = 1 - u * u;
          this.wreath(f, fade, 1.4, seed);
          this.p.copy(feet).addScaledVector(heading, .2).setY(feet.y + 1.05);
          this.c.copy(heading).multiplyScalar(.8).addScaledVector(side, .6).normalize(); this.d.copy(UP).addScaledVector(side, -.62).normalize();
          sweep(st, this.p, this.c, this.d, 2, -.6, -.6 + 2.2 * cut, .24, JAGAN, 1.4 * fade, 11);
          for (let i = 0, n = st.n(3, 2); i < n; i++) {
            const ang = .7 + .9 * cut * (i + .5) / n;
            this.a.copy(this.p).addScaledVector(this.c, Math.cos(ang) * 2).addScaledVector(this.d, Math.sin(ang) * 2); this.a.y += .2;
            st.tongue(this.a, UP, .3, .7 + .3 * fade, FLAME, fade * (.6 + .4 * i / n), seed + i);
          }
          st.light(this.a.copy(this.p).addScaledVector(heading, 1.2).setY(feet.y + .5), 4.5, JAGAN, .45 * fade);
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) {
          const k = clamp(elapsed / release);
          this.wreath(f, k, 1 + .5 * k, seed);
          st.charge(this.hand, JAGAN, .3, k, seed);
          for (let i = 1; i <= 3; i++) {
            const out = (i % 2 ? 1 : -1) * (.45 + .33 * i) * (.5 + .5 * k), ghost = k * (1 - i * .22);
            this.a.copy(feet).addScaledVector(heading, -.22 * i).addScaledVector(side, out).setY(feet.y + .12);
            this.b.copy(this.a).setY(feet.y + 1.5);
            st.streak(this.a, this.b, .2, JAGAN.main, .55 * ghost); st.streak(this.a, this.b, .06, JAGAN.core, .5 * ghost);
          }
          st.speed(.3 * k, s.id);
        } else if (elapsed < release + SEVER && !this.marked(SEVERED, time)) {
          const u = (elapsed - release) / SEVER;
          this.line(this.p.copy(feet).addScaledVector(heading, 2.1).setY(feet.y + 1.1), side, 3 * clamp(u / .15), 1 - u * u);
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        const k = clamp(elapsed / FIRST);
        this.wreath(f, k, 1.2, seed);
        st.charge(this.hand, JAGAN, .26, k, seed);
      }
    }
    for (const d of this.dragons) {
      if (!d.actor) continue;
      const actor = fighters.get(d.actor), victim = fighters.get(d.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !d.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== d.seq || s.whiffedAt !== undefined) { d.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { d.actor = ''; continue; }
      if (!d.final && elapsed < LAST && victim) this.dragon(actor, victim, d, elapsed, time);
    }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born;
      if (age >= m.life) { m.live = false; continue; }
      if (age >= 0) this.drawMark(m, age);
    }
    this.heads.end(); st.close();
  }

  private face(f: Fighter) {
    const yaw = f.state.yaw ?? f.group.rotation.y;
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    return this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
  }
  private marked(kind: number, time: number) { for (const m of this.marks) if (m.live && m.kind === kind && time - m.born < SEVER) return true; return false; }

  private blade(f: Fighter) {
    const joint = f.drawnJoint?.('Sword');
    if (joint) { joint.updateWorldMatrix(true, false); this.hand.setFromMatrixPosition(joint.matrixWorld); this.tip.set(0, .78, 0).applyMatrix4(joint.matrixWorld); }
    else { this.hand.copy(f.handR); this.tip.copy(f.handR).addScaledVector(this.heading, .6).addScaledVector(UP, .5); }
  }
  private wreath(f: Fighter, k: number, size: number, seed: number) {
    if (k <= .02) return;
    const st = this.stage; this.blade(f);
    st.streak(this.hand, this.tip, .09, JAGAN.main, .9 * k); st.streak(this.hand, this.tip, .03, JAGAN.core, k);
    this.d.subVectors(this.tip, this.hand).normalize();
    for (let i = 0, n = st.n(4, 2); i < n; i++) {
      const u = (i + .6) / n;
      this.a.copy(this.hand).lerp(this.tip, u); this.a.y += .12 * size;
      this.b.copy(this.d).multiplyScalar(.35).addScaledVector(UP, 1).normalize();
      st.tongue(this.a, this.b, .2 * size, (.34 + .2 * u) * size, FLAME, k * (.7 + .3 * u), seed + i);
    }
    st.glow(this.tip, .2 * size, JAGAN.main, .6 * k);
    st.light(this.p.copy(this.hand).lerp(this.tip, .5), 2 + size, JAGAN, .28 * k);
  }
  private line(at: THREE.Vector3, across: THREE.Vector3, reach: number, fade: number) {
    if (fade <= .02 || reach <= .05) return;
    const st = this.stage;
    this.a.copy(at).addScaledVector(across, -reach); this.b.copy(at).addScaledVector(across, reach);
    st.streak(this.a, this.b, .22 * (.4 + .6 * fade), JAGAN.main, 1.2 * fade); st.streak(this.a, this.b, .06 * (.4 + .6 * fade), JAGAN.core, 1.6 * fade);
    st.glow(at, .5, JAGAN.core, .7 * fade, STAR, .2, 3);
    st.light(at, 5.5, JAGAN, .55 * fade);
  }

  private flight(feet: THREE.Vector3, floor: number, e: number, out: THREE.Vector3) {
    const heading = this.heading, side = this.side, prey = this.prey;
    if (e <= SECOND) {
      const g = clamp((e - FIRST) / (SECOND - FIRST)), turn = -.9 + g * 7, r = .7 + 1.4 * Math.sin(Math.PI * Math.min(1, g * 1.15)), fore = Math.sin(turn);
      out.copy(feet).addScaledVector(side, Math.cos(turn) * r * 1.25).addScaledVector(heading, fore * r * (fore < 0 ? .5 : 1)).setY(floor + 1.3 + 1.9 * Math.sin(Math.PI * g * .62));
      return out.lerp(prey, smooth((g - .8) / .2));
    }
    const g = clamp((e - SECOND) / (LAST - SECOND)), lift = Math.sin(Math.PI * Math.pow(g, .8));
    out.copy(prey).addScaledVector(side, Math.sin(Math.PI * 2 * g) * 3.8).addScaledVector(heading, .9 * lift).setY(prey.y + 2.5 * lift);
    return out;
  }
  private dragon(actor: Fighter, victim: Fighter, d: Dragon, elapsed: number, time: number) {
    const st = this.stage, seed = d.seq * 3.1, feet = actor.group.position, g = clamp((elapsed - FIRST) / (LAST - FIRST));
    this.face(actor); bodyCentre(victim, this.prey); this.prey.y += .75;
    st.pool(this.p.copy(feet).setY(d.floor), 2.6 + 3 * g, FLAME, Math.min(1, .3 + g * 1.2), seed);
    this.blade(actor);
    st.charge(this.hand, JAGAN, .24 + .12 * g, Math.max(.4, g), seed);
    const grown = clamp((elapsed - FIRST) / .5), n = st.n(17, 9), length = n * LAG * grown;
    const head = this.flight(feet, d.floor, elapsed, this.root), a = this.a.copy(head), b = this.b, along = this.c;
    for (let i = 1; i <= n; i++) {
      const back = elapsed - length * i / n;
      if (back < FIRST) b.copy(this.hand); else this.flight(feet, d.floor, back, b);
      along.subVectors(b, a); const len = along.length();
      if (len > .02) {
        along.divideScalar(len);
        const s = i / n, girth = (.5 - .3 * s) * (.55 + .45 * grown);
        st.tongue(this.p.copy(a).lerp(b, .5), along, girth * 1.7, Math.max(.5, len * 2.6), FLAME, .95 - .4 * s, seed + i);
        st.streak(a, b, girth * .42, JAGAN.main, .8 * (1 - s * .6)); st.streak(a, b, girth * .12, JAGAN.core, .7 * (1 - s));
        if (i % 2 === 0) st.tongue(this.p.copy(b).setY(b.y + girth), UP, girth * 1.3, girth * 2.6, FLAME, .6 - .3 * s, seed + i * 3);
      }
      if (back < FIRST) break;
      a.copy(b);
    }
    this.flight(feet, d.floor, elapsed + .03, this.tip); along.subVectors(this.tip, head); if (along.lengthSq() < 1e-6) along.copy(this.heading); along.normalize();
    this.head(head, along, 1.5 + .9 * grown * (.6 + .4 * g), 1);
    st.glow(head, 1.1, JAGAN.main, .55); st.light(this.p.copy(head).setY(head.y - .4), 6, JAGAN, .6);
    if (g > .82) st.speed(.5 * (g - .82) / .18, d.actor, d.target);
  }
  private head(at: THREE.Vector3, along: THREE.Vector3, size: number, alpha: number) {
    this.q.setFromUnitVectors(RIGHT, along);
    this.heads.add(at, this.q, size, size, 1, HEAD, alpha);
  }

  private drawMark(m: Mark, age: number) {
    const st = this.stage, u = age / m.life, fade = (1 - u) * (1 - u);
    if (m.kind === CUT) {
      const reach = m.size * clamp(age / .05);
      this.d.set(m.dir.z, 0, -m.dir.x).multiplyScalar(.62).addScaledVector(UP, .78).normalize();
      this.a.copy(m.at).addScaledVector(this.d, -reach); this.b.copy(m.at).addScaledVector(this.d, reach);
      st.streak(this.a, this.b, .2 * (.4 + .6 * fade), JAGAN.main, 1.2 * fade); st.streak(this.a, this.b, .06 * (.4 + .6 * fade), JAGAN.core, 1.6 * fade);
      return;
    }
    if (m.kind === SEVERED) {
      this.d.set(m.dir.z, 0, -m.dir.x);
      this.line(m.at, this.d, 3 * m.size * clamp(age / .05), 1 - u);
      if (age > .1) for (let i = -2; i <= 2; i++) {
        if (!i) continue;
        const burn = clamp((age - .1 - Math.abs(i) * .03) / .08) * (1 - u);
        this.p.copy(m.at).addScaledVector(this.d, i * .9 * m.size); this.p.y += .35;
        st.tongue(this.p, UP, .55 * m.size, (1.5 - Math.abs(i) * .3) * m.size, FLAME, burn, m.seed + i);
      }
      return;
    }
    const climb = 1 + age * 5.5;
    this.p.set(m.at.x, m.floor + climb, m.at.z);
    this.head(this.p, UP, 2.9 - u * .6, 1 - u * u);
    st.glow(this.p, 2.3, JAGAN.main, 1 - u); st.glow(this.p, 1.1, JAGAN.core, .7 * (1 - u), STAR, .2, m.seed);
  }

  private awakening(f: Fighter, time: number) {
    const st = this.stage, phase = f.state.actionTime, fade = clamp(phase / .15) * clamp((1 - phase) / .17);
    if (fade <= .02) return;
    this.face(f); const hand = this.hand.copy(f.handR);
    for (let i = 0, n = st.n(7, 4); i < n; i++) {
      const u = i / n, turn = u * Math.PI * 4 + phase * 8, r = (.3 + .26 * (1 - phase)) * (1 - u * .6);
      this.p.set(hand.x + Math.sin(turn) * r, hand.y - .3 + u * .7, hand.z + Math.cos(turn) * r);
      st.tongue(this.p, UP, .16, .34, FLAME, fade * .8, i);
    }
    st.glow(hand, .42, JAGAN.main, .6 * fade); st.light(hand, 3, JAGAN, .4 * fade);
    if (phase > .4 && phase < .78) { this.a.copy(this.heading).setY(.3).normalize(); this.head(this.p.copy(hand).setY(hand.y + .1), this.a, .7 * (1 - clamp((phase - .61) / .17) * .6), fade); }
    const brow = f.drawnJoint?.('Head');
    if (brow) { brow.getWorldPosition(this.p); this.p.addScaledVector(this.heading, .09); this.p.y += .13; st.glow(this.p, .1, JAGAN.core, fade, STAR, .2, Math.floor(time * 24)); }
    if (phase > .55) st.disc(this.p.copy(f.group.position), .5 + (phase - .55) * 5, JAGAN.core, fade * .7, WAVE, .96);
  }
  reset() {
    for (const d of this.dragons) d.actor = ''; for (const m of this.marks) m.live = false;
    this.seen.fill(-1); this.seenAt.fill(-1); this.cursor = this.dragonCursor = this.markCursor = 0;
    this.heads.begin(0); this.heads.end(); this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.heads.dispose(); this.texture?.dispose(); this.texture = undefined; this.stage.release(); }
}
