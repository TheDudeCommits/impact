import * as THREE from 'three';
import type { Fighter } from '../../Fighter';
import type { VfxKit } from '../VfxKit';
import { SPRITE, ORIENT } from '../SparkField';
import { MARK } from '../GroundMarks';
import { ElectricKit } from '../../signature/ElectricKit';
import { STAR, GLOW } from '../../signature/GlowBatch';
import { KiAura, kiColours, SHEETS, type KiColours } from './KiAura';
import { AuraBurst, BURST } from './AuraBurst';
import { HakiBolts, HAKI, hakiEdge } from './HakiBolts';
import type { PowerKind } from '../../awakenedPower';
import { emitMote, MOTE_EVERY, type MoteKind } from './Motes';
import { SIGNATURE } from '../../signature/context';

export const POWER = {
  peak: 3.5,
  column: 6.2, slim: .3,
  burn: .4,
  settle: .85,
} as const;

export type { PowerKind };
export interface HakiStyle { glow: THREE.Color; deep: THREE.Color; hex: number; level: number }
export interface PowerStyle { kind: PowerKind; colours: KiColours; bolt: THREE.Color; electric: boolean; haki?: HakiStyle; motes?: { kind: MoteKind; core: number; rim: number };
  tint?: number; shade?: number; cover?: number;
  arcs?: boolean }
export function reiatsuColours(coreHex: number, rimHex: number): KiColours {
  const out = kiColours(coreHex, rimHex);
  if (darkHex(coreHex)) { out.core.setHex(coreHex); out.deep.setHex(coreHex); out.hot.setHex(rimHex).multiplyScalar(1.25); out.hotness = 1.5; }
  return out;
}
const darkHex = (hex: number) => ((hex >> 16 & 255) * .3 + (hex >> 8 & 255) * .59 + (hex & 255) * .11) < 28;
export function powerTint(coreHex: number, rimHex: number) {
  const dark = darkHex(coreHex);
  return { tint: dark ? rimHex : coreHex, shade: dark ? coreHex : rimHex, cover: dark ? .75 : .3 };
}
export function hakiStyle(edge: number | undefined, conqueror: boolean): HakiStyle {
  const colours = edge === undefined ? HAKI : hakiEdge(edge);
  return { glow: colours.glow, deep: colours.deep, hex: edge ?? 0xff2a3a, level: conqueror ? 1 : .6 };
}
const hue = new THREE.Color(), hsl = { h: 0, s: 0, l: 0 };
export function boltFor(coreHex: number, out = new THREE.Color()) {
  hue.setHex(coreHex).getHSL(hsl);
  if (hsl.s < .15) return out.setRGB(.7, .85, 2.2);
  const h = hsl.h * 360;
  if (h >= 165 && h < 300) return out.setRGB(1.9, .38, 1.5);
  if (h >= 30 && h < 165) return out.setRGB(.42, .8, 2.4);
  return out.setRGB(2.2, .55, .9);
}

interface Entry {
  id: string; born: number; swap: number; entry: number; burst: boolean; lifted: boolean; cracked: boolean; rung: number;
  style: PowerStyle; seed: number; local: boolean; flames: boolean; scale: number;
  bare: boolean;
}
export interface Burning { style: PowerStyle; scale: number; strength: number; local: boolean }
interface Burn { flareUntil: number; lastStart: number; nextCrackle: number; crackleUntil: number; seed: number; nextHaze: number; nextMote: number; nextRing: number }
interface Glint { x: number; y: number; z: number; born: number; life: number; size: number; streak: boolean }

const ease = (t: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
const FLARES: ReadonlySet<string> = new Set(['light', 'heavy', 'special', 'ultimate', 'dash']);
const TAU = Math.PI * 2;
const HAKI_JOINTS = ['Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand', 'Spine2', 'Hips', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'] as const;
const CURSED_SPARK: HakiStyle = { glow: new THREE.Color(1.7, .1, .16), deep: new THREE.Color(.4, .02, .05), hex: 0xff2a3a, level: .6 };
const HAZE_LIT = 0x3a0c1c, HAZE_SHADE = 0x07030a;

export class PowerUp {
  readonly ki: KiAura;
  private burst: AuraBurst;
  private electric: ElectricKit;
  private haki: HakiBolts;
  private entries = new Map<string, Entry>();
  private burns = new Map<Fighter, Burn>();
  private entering = new Set<Fighter>();
  private glints: Glint[] = [];
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3();
  private right = new THREE.Vector3();
  private tint = new THREE.Color();
  private eye = new THREE.Vector3();
  private tick = 0;
  constructor(scene: THREE.Scene, private kit: VfxKit) {
    this.ki = new KiAura(scene);
    this.burst = new AuraBurst(scene);
    this.electric = new ElectricKit(scene, 'power-up-electric', 1600);
    this.haki = new HakiBolts(scene);
  }

  begin(actor: Fighter, time: number, swap: number, entry: number, style: PowerStyle, flames: boolean, scale: number, local: boolean, bare = false) {
    const id = actor.state.id;
    this.entries.set(id, { id, born: time, swap, entry, burst: false, lifted: bare, cracked: bare, rung: 0, style, seed: hashSeed(id), local, flames, scale, bare });
  }

  break(actor: Fighter, time: number) {
    const e = this.entries.get(actor.state.id);
    if (!e || e.burst) return;
    e.burst = true;
    const p = actor.group.position, s = e.style, kit = this.kit;
    kit.debris.blast(p.x, p.y, p.z, 4.5 * e.scale, s.kind === 'haki' ? 9 : 7.5);
    kit.dustRing(p.x, p.y, p.z, kit.n(14, 6), .7, 6.5 * e.scale, .7, time, .55);
    if (s.kind === 'ki') {
      this.burst.fire(p, time, s.colours.hot, s.colours.core, s.colours.deep, e.scale, actor.group);
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2, r = .6 + Math.random() * 1.1;
        this.glints.push({ x: p.x + Math.cos(a) * r, y: p.y + 1.2 + Math.random() * 1.8 * e.scale, z: p.z + Math.sin(a) * r, born: time + i * .05, life: .32, size: .7 + Math.random() * .5, streak: i === 0 });
      }
    } else if (s.kind === 'reiatsu') {
      this.burst.fire(p, time, s.colours.hot, s.colours.core, s.colours.deep, e.scale, actor.group, BURST.pillar | BURST.vortex);
      const tint = s.tint ?? 0xffffff, shade = s.shade ?? 0x202028;
      kit.ring(p.x, p.y + .08, p.z, .5, 8.5 * e.scale, time, .5, tint, shade, .14, 'flat');
      kit.ring(p.x, p.y + .08, p.z, .4, 5.5 * e.scale, time + .09, .45, tint, shade, .1, 'flat');
    } else if (s.kind === 'chakra' || s.kind === 'nen' || s.kind === 'cursed') {
      const tint = s.tint ?? 0xffffff, shade = s.shade ?? 0x202028;
      if (s.kind === 'chakra') this.burst.fire(p, time, s.colours.hot, s.colours.core, s.colours.deep, Math.min(1, e.scale) * .75, actor.group, BURST.vortex);
      kit.ring(p.x, p.y + .08, p.z, .5, 7.5 * e.scale, time, .5, tint, shade, .14, 'flat');
      if (s.kind === 'cursed') this.hakiCrackle(actor, e.seed, 1, e.scale, 6, true, CURSED_SPARK);
    } else if (s.kind === 'haki') {
      const hex = s.haki?.hex ?? 0xff2a3a;
      kit.ring(p.x, p.y + 1.1, p.z, .5, 9 * e.scale, time, .5, hex, 0x14020a, .1);
      kit.ring(p.x, p.y + .2, p.z, .4, 7 * e.scale, time + .05, .45, hex, 0x0c0206, .07);
    }
  }

  end(id: string) { this.entries.delete(id); }

  update(time: number, dt: number, fighters: ReadonlyMap<string, Fighter>, camera: THREE.Camera | undefined, density: number,
    burning: (f: Fighter) => Burning | null) {
    const d = Math.max(.35, density);
    this.ki.begin(time, camera);
    this.electric.begin(time, density);
    this.haki.begin();
    this.tick = Math.floor(time * 24);
    if (camera) { camera.getWorldPosition(this.eye); this.right.setFromMatrixColumn(camera.matrixWorld, 0); }
    const entering = this.entering; entering.clear();
    for (const [id, e] of this.entries) {
      const actor = fighters.get(id);
      const inEntry = actor?.state.action === 'awaken';
      const elapsed = actor && inEntry ? actor.state.actionTime * actor.state.actionDuration : time - e.born;
      if (!actor || !actor.state.alive || elapsed > e.entry + POWER.settle || elapsed < -.5) { this.entries.delete(id); continue; }
      entering.add(actor);
      this.entry(actor, e, time, elapsed, d);
    }
    for (const fighter of fighters.values()) {
      if (entering.has(fighter)) continue;
      const burn = burning(fighter);
      if (!burn) { this.burns.delete(fighter); continue; }
      this.sustain(fighter, burn, time, d);
    }
    if (import.meta.env?.DEV) this.preview(fighters);
    this.drawGlints(time);
    this.burst.update(time, dt, camera ? this.eye : undefined);
    this.ki.end();
    this.electric.end();
    this.haki.end();
  }

  private entry(actor: Fighter, e: Entry, time: number, elapsed: number, d: number) {
    const kit = this.kit, p = actor.group.position, s = e.style;
    const floor = p.y, gather = elapsed < e.swap, u = elapsed / Math.max(.05, e.swap);
    if (!e.lifted) {
      e.lifted = true;
      kit.debris.lift(kit.n(s.kind === 'plain' ? 10 : 16, 5), p.x, p.z, .7 * e.scale, 2.6 * e.scale, .12, floor, 2.4, 1.5);
    }
    if (!e.cracked && elapsed > .06 && kit.quality !== 'low') {
      e.cracked = true;
      kit.marks.mark(MARK.crack, p.x, floor, p.z, 0, 1, 0, 3.4 * e.scale, time, 3.6, s.kind === 'haki' ? s.haki?.hex ?? 0xff1f30 : s.tint ?? colourHex(s.colours.core), s.kind === 'plain' ? .6 : 1.4);
    }
    const own = s.kind === 'plain' ? .6 : .85;
    const night = (e.local ? own : own * .45 * (1 - THREE.MathUtils.smoothstep(this.eye.distanceTo(p), 7, 12)))
      * (gather ? ease(u * 1.4) : 1 - THREE.MathUtils.smoothstep(elapsed, e.swap + .25, e.entry + POWER.settle * .7));
    if (night > .01 && !e.bare) SIGNATURE.screen?.powerDim?.(night);
    const after = gather ? 0 : elapsed - e.swap;
    if (s.kind === 'ki') this.kiEntry(actor, e, time, elapsed, d);
    else if (s.kind === 'reiatsu') this.reiatsuEntry(actor, e, time, elapsed, d);
    else if (s.kind === 'chakra' || s.kind === 'nen') this.windEntry(actor, e, time, elapsed, d, s.kind === 'chakra');
    else if (s.kind === 'cursed') this.cursedEntry(actor, e, time, elapsed, d);
    if (s.arcs) this.arcSkin(actor, e.seed, gather ? .4 + .6 * u : Math.max(0, 1 - after / .5), e.scale, 4, s.bolt);
    if (s.kind === 'haki') {
      const power = gather ? .5 + .5 * u : Math.max(0, 1 - after / .7);
      this.hakiCrackle(actor, e.seed, power, e.scale, Math.round((2 + 5 * power) * d), true, s.haki);
      this.hakiSkin(actor, e.seed, power, e.scale, 3, s.haki);
      if (kit.quality !== 'low' && Math.random() < (gather ? .5 : .8 * power) * d) this.hakiHaze(actor, time, e.scale, gather ? .7 : 1, gather ? 0 : 2.2 * power);
    }
  }

  private reiatsuEntry(actor: Fighter, e: Entry, time: number, elapsed: number, d: number) {
    const kit = this.kit, p = actor.group.position, s = e.style, tall = POWER.column * e.scale;
    const tint = s.tint ?? 0xffffff, shade = s.shade ?? 0x202028;
    let size: number, strength: number, flare: number, clear = 0;
    if (elapsed < e.swap) {
      const u = elapsed / Math.max(.05, e.swap);
      size = tall * (.3 + .7 * ease(u)); strength = Math.min(1, elapsed / .06); flare = 1;
      const rung = u < .25 ? 0 : u < .7 ? 1 : 2;
      if (rung > e.rung) { e.rung = rung; kit.ring(p.x, p.y + .06, p.z, .3, (3.2 + 1.6 * rung) * e.scale, time, .42, tint, shade, .12, 'flat'); }
    } else {
      const k = elapsed - e.swap, out = e.entry + POWER.settle - e.swap, settle = THREE.MathUtils.smoothstep(k, .22, out);
      size = THREE.MathUtils.lerp(tall * (1 + .22 * Math.exp(-k * 6)), tall * .55, settle);
      strength = 1 - settle; flare = 1 - .5 * settle;
      clear = e.local ? settle : 0;
    }
    this.ki.draw({ x: p.x, y: p.y, z: p.z, size, aspect: POWER.slim, strength, flare, heart: THREE.MathUtils.lerp(.5, .08, clear), body: THREE.MathUtils.lerp(.8, .28, clear),
      colours: s.colours, seed: e.seed, sheets: this.sheets(SHEETS.body | SHEETS.flare) });
    this.c.set(p.x, p.y + .4, p.z);
    this.electric.lights.add(this.c, 3 * e.scale + size * .2, this.tint.setHex(tint), .8 * strength);
    kit.lights.request(p.x, p.y + 2.4, p.z, tint, 5 * strength, 7, e.local ? 3 : 1);
    for (let i = 0, n = Math.round(2 * d * strength + Math.random()); i < n; i++) {
      const sp = kit.sparks.spec, a = Math.random() * TAU, r = (.15 + Math.random() * .55) * e.scale;
      sp.reset(SPRITE.streak, time, .22 + Math.random() * .2).pos(p.x + Math.cos(a) * r, p.y + Math.random() * size * .45, p.z + Math.sin(a) * r).velocity(0, 9 + Math.random() * 7, 0);
      sp.orient = ORIENT.velocity; sp.sized(.06, .02, .5); sp.stretch = 5; sp.trail = .05; sp.drag = .4; sp.hot(tint, 1.7).cool(shade, s.cover ?? .3); kit.sparks.emit();
    }
  }

  private windEntry(actor: Fighter, e: Entry, time: number, elapsed: number, d: number, winds: boolean) {
    const kit = this.kit, p = actor.group.position, s = e.style, tint = s.tint ?? 0xffffff, shade = s.shade ?? 0x202028;
    const power = elapsed < e.swap ? .35 + .65 * ease(elapsed / Math.max(.05, e.swap)) : Math.max(0, 1 - (elapsed - e.swap) / .7);
    if (power < .03) return;
    for (let i = 0, n = Math.round((1 + 3 * power) * d + Math.random() - .5); i < n; i++) {
      const sp = kit.sparks.spec, a = Math.random() * TAU, r = (.4 + Math.random() * .55) * e.scale, turn = winds ? 6 + 4 * power : 0;
      if (winds) {
        sp.reset(SPRITE.streak, time, .2 + Math.random() * .14).pos(p.x + Math.cos(a) * r, p.y + Math.random() * 1.7 * power, p.z + Math.sin(a) * r).velocity(-Math.sin(a) * turn, 1.2 + 2 * power, Math.cos(a) * turn);
        sp.orient = ORIENT.velocity; sp.sized(.045, .016, .5); sp.stretch = 5; sp.trail = .07; sp.drag = .8; sp.hot(tint, 1.15).cool(shade, s.cover ?? .25);
      } else {
        if (i > 1) continue;
        sp.reset(SPRITE.glow, time, .35 + Math.random() * .2).pos(p.x + Math.cos(a) * r * .8, p.y + .2 + Math.random() * 1.3, p.z + Math.sin(a) * r * .8).velocity(0, 1.6 + 2 * power, 0);
        sp.orient = ORIENT.axial; sp.axis(0, 1, 0); sp.sized(.07, .12, .5); sp.stretch = 3; sp.hot(tint, .32 * power).cool(shade, 0);
      }
      kit.sparks.emit();
    }
    this.c.set(p.x, p.y + .4, p.z);
    this.electric.lights.add(this.c, 3 * e.scale, this.tint.setHex(tint), .7 * power);
    kit.lights.request(p.x, p.y + 2.2, p.z, tint, 4 * power, 6.5, e.local ? 3 : 1);
  }

  private cursedEntry(actor: Fighter, e: Entry, time: number, elapsed: number, d: number) {
    const p = actor.group.position, s = e.style, peak = POWER.peak * .82 * e.scale;
    let size: number, strength: number, power: number, clear = 0;
    if (elapsed < e.swap) { const u = elapsed / Math.max(.05, e.swap); size = peak * (.4 + .6 * ease(u)); strength = Math.min(1, elapsed / .07); power = .5 + .5 * u; }
    else {
      const k = elapsed - e.swap, settle = THREE.MathUtils.smoothstep(k, .2, e.entry + POWER.settle - e.swap);
      size = THREE.MathUtils.lerp(peak * (1 + .15 * Math.exp(-k * 7)), peak * .6, settle); strength = 1 - settle; power = Math.max(0, 1 - k / .6);
      clear = e.local ? settle : 0;
    }
    this.ki.draw({ x: p.x, y: p.y, z: p.z, size, aspect: .8, strength, flare: .8, heart: THREE.MathUtils.lerp(.62, .08, clear), body: THREE.MathUtils.lerp(.88, .28, clear),
      colours: s.colours, seed: e.seed, sheets: this.sheets(SHEETS.body | SHEETS.flare) });
    this.hakiSkin(actor, e.seed, power * strength, e.scale, 3, CURSED_SPARK);
    this.hakiCrackle(actor, e.seed, .6 * power * strength, e.scale * .7, Math.round((1 + 3 * power) * d), false, CURSED_SPARK);
    this.c.set(p.x, p.y + .4, p.z);
    this.electric.lights.add(this.c, 2.8 * e.scale, this.tint.setHex(s.tint ?? 0x3a6cff), .7 * strength);
  }

  private kiEntry(actor: Fighter, e: Entry, time: number, elapsed: number, d: number) {
    const kit = this.kit, p = actor.group.position, s = e.style, peak = POWER.peak * e.scale;
    let size: number, strength: number, flare: number, bolts: number, clear = 0;
    if (elapsed < e.swap) {
      const u = elapsed / Math.max(.05, e.swap);
      size = peak * (.4 + .55 * ease(u)); strength = Math.min(1, elapsed / .07); flare = 1; bolts = .45 + .55 * u;
    } else {
      const k = elapsed - e.swap, out = e.entry + POWER.settle - e.swap;
      const settle = THREE.MathUtils.smoothstep(k, .3, out);
      size = THREE.MathUtils.lerp(peak * (1 + .2 * Math.exp(-k * 7)), peak * .7, settle);
      strength = 1 - settle; flare = 1 - .6 * settle; bolts = Math.max(0, 1 - k / .8);
      clear = e.local ? settle : 0;
    }
    this.ki.draw({ x: p.x, y: p.y, z: p.z, size, strength, flare, heart: THREE.MathUtils.lerp(.8, .08, clear), body: THREE.MathUtils.lerp(.94, .28, clear),
      colours: s.colours, seed: e.seed, sheets: this.sheets(clear > .99 ? SHEETS.body | SHEETS.flare : SHEETS.all) });
    this.c.set(p.x, p.y + .4, p.z);
    this.electric.lights.add(this.c, 3.2 * e.scale + size * .35, s.colours.core, .9 * strength);
    kit.lights.request(p.x, p.y + 2.4, p.z, colourHex(s.colours.core), 6 * strength, 7, e.local ? 3 : 1);
    this.crackle(actor, e.seed, bolts * strength, size, s.bolt, Math.round((1 + 3 * bolts) * d));
    if (Math.random() < .55 * d) {
      const sp = kit.sparks.spec, a = Math.random() * Math.PI * 2, r = .3 + Math.random() * size * .32;
      sp.reset(SPRITE.streak, time, .45 + Math.random() * .3).pos(p.x + Math.cos(a) * r, p.y + .1 + Math.random() * size * .5, p.z + Math.sin(a) * r).velocity(0, 2.5 + Math.random() * 3, 0);
      sp.orient = ORIENT.velocity; sp.sized(.035, .015, .5); sp.stretch = 2.5; sp.drag = .8; sp.hot(0xffffff, 2).cool(colourHex(s.colours.core), 0); kit.sparks.emit();
    }
    if (elapsed < e.swap && Math.random() < .05) this.glints.push({ x: p.x + (Math.random() - .5) * 2, y: p.y + 1 + Math.random() * 2, z: p.z + (Math.random() - .5) * 2, born: time, life: .2, size: .45, streak: false });
  }

  private sustain(fighter: Fighter, burn: Burning, time: number, d: number) {
    let state = this.burns.get(fighter);
    if (!state) { state = { flareUntil: 0, lastStart: fighter.state.actionStarted, nextCrackle: time + .3, crackleUntil: 0, seed: hashSeed(fighter.state.id), nextHaze: 0, nextMote: 0, nextRing: time + .8 }; this.burns.set(fighter, state); }
    if (fighter.state.actionStarted !== state.lastStart) {
      if (FLARES.has(fighter.state.action)) { state.flareUntil = time + .38; if (burn.style.kind === 'haki') state.crackleUntil = Math.max(state.crackleUntil, time + .22); }
      state.lastStart = fighter.state.actionStarted;
    }
    const flaring = Math.max(0, (state.flareUntil - time) / .38);
    const p = fighter.group.position, s = burn.style;
    if (s.motes && time >= state.nextMote && burn.strength > .05 && this.kit.quality !== 'low') {
      state.nextMote = time + MOTE_EVERY[s.motes.kind] * (.7 + Math.random() * .6) / d;
      emitMote(this.kit, s.motes.kind, fighter, time, burn.strength, s.motes.core, s.motes.rim);
    }
    if (s.kind === 'haki') {
      const haki = s.haki, level = haki?.level ?? 1, strength = burn.strength;
      if (time >= state.nextCrackle) { state.crackleUntil = Math.max(state.crackleUntil, time + .12 + Math.random() * .14); state.nextCrackle = time + (.55 + Math.random() * 1.1) / level; }
      const discharge = time < state.crackleUntil;
      this.hakiSkin(fighter, state.seed, (discharge ? 1 : .7) * strength, burn.scale, discharge ? 4 : level >= 1 ? 3 : 2, haki);
      this.hakiRise(fighter, state.seed, (discharge ? 1 : .75) * strength, burn.scale, level >= 1 ? 2 : 1, haki);
      if (discharge) this.hakiCrackle(fighter, state.seed, (.6 + .3 * level) * strength, burn.scale, Math.max(2, Math.round((2 + 3 * level) * d)), true, haki);
      if (flaring > 0) this.hakiStrike(fighter, state.seed, strength * Math.min(1, flaring * 1.6), burn.scale, haki);
      if (time >= state.nextHaze && strength > .05 && this.kit.quality !== 'low') {
        state.nextHaze = time + (.05 + Math.random() * .06) / (d * level);
        this.hakiHaze(fighter, time, burn.scale, strength * (.55 + .45 * level), 0);
      }
      return;
    }
    if (s.arcs) this.arcSkin(fighter, state.seed, burn.strength * (.75 + .25 * flaring), burn.scale, flaring > 0 ? 6 : 4, s.bolt);
    if (s.kind === 'cursed') {
      if (time >= state.nextCrackle) { state.crackleUntil = Math.max(state.crackleUntil, time + .1 + Math.random() * .1); state.nextCrackle = time + .7 + Math.random() * 1.3; }
      if (time < state.crackleUntil) this.hakiSkin(fighter, state.seed, .7 * burn.strength, burn.scale, 3, CURSED_SPARK);
      if (flaring > 0) this.hakiStrike(fighter, state.seed, burn.strength * Math.min(1, flaring * 1.6) * .8, burn.scale * .8, CURSED_SPARK);
      this.c.set(p.x, p.y + .3, p.z);
      this.electric.lights.add(this.c, 2 * burn.scale, this.tint.setHex(s.tint ?? 0x3a6cff), .3 * burn.strength * (1 + flaring));
      return;
    }
    if (s.kind === 'chakra' || s.kind === 'nen') {
      this.c.set(p.x, p.y + .3, p.z);
      this.electric.lights.add(this.c, 2 * burn.scale, this.tint.setHex(s.tint ?? 0xffffff), .3 * burn.strength * (1 + flaring));
      return;
    }
    if (s.kind === 'reiatsu') {
      const kit = this.kit, strength = burn.strength, scale = burn.scale, tint = s.tint ?? 0xffffff, shade = s.shade ?? 0x202028;
      if (time >= state.nextHaze && strength > .05) {
        state.nextHaze = time + (.05 - .025 * flaring) / d;
        const sp = kit.sparks.spec, a = Math.random() * TAU, r = (.16 + Math.random() * .3) * scale;
        sp.reset(SPRITE.streak, time, .28 + Math.random() * .24).pos(p.x + Math.cos(a) * r, p.y + (.25 + Math.random() * 1.5) * scale, p.z + Math.sin(a) * r).velocity(Math.cos(a) * .3, 4.5 + Math.random() * 3.5, Math.sin(a) * .3);
        sp.orient = ORIENT.velocity; sp.sized(.05, .018, .5); sp.stretch = 4; sp.trail = .05; sp.drag = .6; sp.hot(tint, 1.5 * strength).cool(shade, s.cover ?? .3); kit.sparks.emit();
      }
      if (time >= state.nextRing && fighter.state.grounded !== false && strength > .3) {
        state.nextRing = time + 1.5 + Math.random() * 1.2;
        kit.ring(p.x, p.y + .05, p.z, .35 * scale, 2.7 * scale, time, .55, tint, shade, .16, 'flat');
        if (kit.quality !== 'low') kit.debris.lift(kit.n(4, 2), p.x, p.z, .5 * scale, 1.3 * scale, .055, p.y, 1.3, 1.1);
      }
      this.c.set(p.x, p.y + .3, p.z);
      this.electric.lights.add(this.c, 2.2 * scale, this.tint.setHex(tint), .4 * strength * (1 + flaring));
      if (s.electric) {
        if (time >= state.nextCrackle) { state.crackleUntil = time + .1 + Math.random() * .12; state.nextCrackle = time + .4 + Math.random() * .9; }
        if (time < state.crackleUntil) this.crackle(fighter, state.seed, .7 * strength, POWER.peak * POWER.burn * scale, s.bolt, Math.max(1, Math.round(2 * d)));
      }
      return;
    }
    if (s.kind !== 'ki') return;
    const size = POWER.peak * POWER.burn * burn.scale * (1 + .14 * flaring);
    this.c.set(p.x, p.y + .3, p.z);
    this.electric.lights.add(this.c, 2.2 * burn.scale, s.colours.core, .45 * burn.strength * (1 + flaring));
    if (s.electric) {
      if (time >= state.nextCrackle) { state.crackleUntil = time + .1 + Math.random() * .12; state.nextCrackle = time + .45 + Math.random() * 1.1; }
      if (time < state.crackleUntil) this.crackle(fighter, state.seed, .7 * burn.strength, size, s.bolt, Math.max(1, Math.round(2 * d)));
    }
  }

  private sheets(wanted: number) {
    const q = this.kit.quality;
    return wanted & (q === 'low' ? SHEETS.body : q === 'medium' ? SHEETS.body | SHEETS.flare : SHEETS.all);
  }

  private crackle(actor: Fighter, seed: number, power: number, size: number, colour: THREE.Color, count: number) {
    if (power < .03) return;
    const ek = this.electric, rng = ek.painter.rng, p = actor.group.position;
    for (let i = 0; i < count; i++) {
      rng.seed(ek.tick * 977 + i * 131 + seed);
      if (rng.next() < .25) continue;
      const a = rng.next() * Math.PI * 2, h = .5 + rng.next() * 1.2;
      this.a.set(p.x + Math.cos(a) * .2, p.y + h, p.z + Math.sin(a) * .2);
      const out = size * (.3 + .4 * rng.next()), up = size * (rng.next() * .45 - .1);
      this.b.set(this.a.x + Math.cos(a + rng.signed() * .8) * out, this.a.y + up, this.a.z + Math.sin(a + rng.signed() * .8) * out);
      ek.arc(this.a, this.b, ek.tick * 31 + i * 7 + seed, .05 * Math.min(1.3, power + .3), colour, Math.min(1, power + .25), 2, 4, .36);
    }
  }

  private hakiCrackle(actor: Fighter, seed: number, power: number, scale: number, count: number, floor: boolean, haki?: HakiStyle) {
    if (power < .03) return;
    const rng = this.haki.painter.rng, p = actor.group.position, s = scale, edge = haki?.glow ?? HAKI.glow;
    for (let i = 0; i < count; i++) {
      rng.seed(this.tick * 613 + i * 97 + seed);
      if (rng.next() < .3) continue;
      const a = rng.next() * Math.PI * 2;
      if (floor && i % 3 === 2) {
        this.a.set(p.x + Math.cos(a) * .25 * s, p.y + (.5 + rng.next() * .6) * s, p.z + Math.sin(a) * .25 * s);
        const far = (.9 + rng.next() * 1.6) * s;
        this.b.set(p.x + Math.cos(a) * far, p.y + .02, p.z + Math.sin(a) * far);
      } else {
        this.a.set(p.x + Math.cos(a) * .18 * s, p.y + (.7 + rng.next() * .9) * s, p.z + Math.sin(a) * .18 * s);
        const out = (.6 + rng.next() * 1.1) * s * (.6 + .4 * power), up = (rng.next() * 1.1 - .2) * s;
        this.b.set(this.a.x + Math.cos(a + rng.signed() * .7) * out, this.a.y + up, this.a.z + Math.sin(a + rng.signed() * .7) * out);
      }
      this.haki.bolt(this.a, this.b, this.tick * 41 + i * 13 + seed, (.045 + .03 * power) * s, Math.min(1, .45 + power), 2, edge);
      if (floor && i % 3 === 2) {
        const turn = a + rng.signed() * 1.1, run = (.5 + rng.next() * .9) * s;
        this.c.set(this.b.x + Math.cos(turn) * run, p.y + .02, this.b.z + Math.sin(turn) * run);
        this.haki.bolt(this.b, this.c, this.tick * 43 + i * 19 + seed, (.034 + .02 * power) * s, Math.min(1, .4 + power), 1, edge, 3);
      }
    }
    this.c.set(p.x, p.y + .3, p.z);
    this.electric.lights.add(this.c, 2.4 * s, haki?.deep ?? HAKI.deep, .7 * power);
  }

  private hakiSkin(actor: Fighter, seed: number, power: number, scale: number, count: number, haki?: HakiStyle) {
    if (power < .03 || typeof actor.drawnJoint !== 'function') return;
    const rng = this.haki.painter.rng, edge = haki?.glow ?? HAKI.glow, n = HAKI_JOINTS.length;
    for (let i = 0; i < count; i++) {
      rng.seed(this.tick * 389 + i * 71 + seed);
      if (rng.next() < .3) continue;
      const from = actor.drawnJoint(HAKI_JOINTS[Math.floor(rng.next() * n) % n]);
      if (!from) continue;
      from.getWorldPosition(this.a);
      const to = rng.next() < .45 ? actor.drawnJoint(HAKI_JOINTS[Math.floor(rng.next() * n) % n]) : undefined;
      if (to && to !== from) to.getWorldPosition(this.b);
      else {
        const turn = rng.next() * TAU, out = (.3 + .45 * rng.next()) * scale;
        this.b.set(this.a.x + Math.cos(turn) * out, this.a.y + (rng.next() * .8 - .15) * scale, this.a.z + Math.sin(turn) * out);
      }
      this.haki.bolt(this.a, this.b, this.tick * 53 + i * 17 + seed, (.034 + .016 * power) * scale, Math.min(1, .5 + .5 * power), 1, edge, 3);
    }
  }

  private hakiRise(actor: Fighter, seed: number, power: number, scale: number, count: number, haki?: HakiStyle) {
    if (power < .03) return;
    const rng = this.haki.painter.rng, p = actor.group.position, edge = haki?.glow ?? HAKI.glow;
    for (let i = 0; i < count; i++) {
      rng.seed(Math.floor((this.tick + i * 3) / 5) * 911 + i * 67 + seed);
      if (rng.next() < (count > 1 ? .3 : .2)) continue;
      const turn = rng.next() * TAU, near = (.4 + rng.next() * .45) * scale, lean = rng.signed() * .6;
      const far = near + (.3 + rng.next() * .7) * scale, tall = (1.2 + rng.next() * 1.2) * scale * (.7 + .3 * power);
      this.a.set(p.x + Math.cos(turn) * near, p.y + .02, p.z + Math.sin(turn) * near);
      this.b.set(p.x + Math.cos(turn + lean) * far, p.y + tall, p.z + Math.sin(turn + lean) * far);
      if (rng.seed(this.tick * 613 + i * 31 + seed).next() < .2) continue;
      this.haki.bolt(this.a, this.b, this.tick * 47 + i * 29 + seed, (.05 + .03 * power) * scale, Math.min(1, .55 + .5 * power), 2, edge);
    }
  }

  private arcSkin(actor: Fighter, seed: number, power: number, scale: number, count: number, colour: THREE.Color) {
    if (power < .03 || typeof actor.drawnJoint !== 'function') return;
    const ek = this.electric, rng = ek.painter.rng, n = HAKI_JOINTS.length;
    for (let i = 0; i < count; i++) {
      rng.seed(ek.tick * 467 + i * 83 + seed);
      if (rng.next() < .33) continue;
      const from = actor.drawnJoint(HAKI_JOINTS[Math.floor(rng.next() * n) % n]);
      if (!from) continue;
      from.getWorldPosition(this.a);
      const to = rng.next() < .5 ? actor.drawnJoint(HAKI_JOINTS[Math.floor(rng.next() * n) % n]) : undefined;
      if (to && to !== from) to.getWorldPosition(this.b);
      else {
        const turn = rng.next() * TAU, out = (.25 + .4 * rng.next()) * scale;
        this.b.set(this.a.x + Math.cos(turn) * out, this.a.y + (rng.next() * .7 - .2) * scale, this.a.z + Math.sin(turn) * out);
      }
      ek.arc(this.a, this.b, ek.tick * 59 + i * 19 + seed, (.03 + .02 * power) * scale, colour, Math.min(1, .55 + .5 * power), 1, 3, .34);
    }
    this.c.copy(actor.group.position).y += 1;
    ek.lights.add(this.c, 2 * scale, colour, .25 * power);
  }

  private hakiStrike(actor: Fighter, seed: number, power: number, scale: number, haki?: HakiStyle) {
    if (power < .05 || typeof actor.strikePoint !== 'function') return;
    const rng = this.haki.painter.rng.seed(this.tick * 733 + seed), edge = haki?.glow ?? HAKI.glow;
    actor.strikePoint(this.c);
    this.haki.bolt(rng.next() < .5 ? actor.handR : actor.handL, this.c, this.tick * 59 + seed, (.036 + .024 * power) * scale, Math.min(1, .55 + power), 1, edge, 3);
    for (let i = 0; i < 2; i++) {
      const turn = rng.next() * TAU, out = (.35 + .5 * rng.next()) * scale;
      this.b.set(this.c.x + Math.cos(turn) * out, this.c.y + rng.signed() * .4 * scale, this.c.z + Math.sin(turn) * out);
      this.haki.bolt(this.c, this.b, this.tick * 61 + i * 23 + seed, (.03 + .02 * power) * scale, Math.min(1, .5 + power), 1, edge, 3);
    }
  }

  private hakiHaze(actor: Fighter, time: number, scale: number, strength: number, out: number) {
    const sp = this.kit.dust.spec, p = actor.group.position, turn = Math.random() * TAU, r = (.28 + Math.random() * .4) * scale;
    const size = (.2 + Math.random() * .14) * scale, c = Math.cos(turn), sn = Math.sin(turn);
    sp.reset(SPRITE.puff, time, .45 + Math.random() * .3).pos(p.x + c * r, p.y + .06 + Math.random() * .3 * scale, p.z + sn * r);
    sp.velocity(c * (.2 + out), .7 + Math.random() * .8, sn * (.2 + out)); sp.drag = 1.4; sp.gravity = -.5;
    sp.sized(size * .45, size, .6).hot(HAZE_LIT, 1).cool(HAZE_SHADE, Math.min(.8, .62 * strength)); sp.bias = size * .4;
    this.kit.dust.emit();
  }

  private drawGlints(time: number) {
    const ek = this.electric;
    for (let i = this.glints.length - 1; i >= 0; i--) {
      const g = this.glints[i], age = time - g.born;
      if (age > g.life) { this.glints.splice(i, 1); continue; }
      if (age < 0) continue;
      const k = age / g.life, pop = Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k * .3);
      this.c.set(g.x, g.y, g.z);
      ek.glows.add(this.c, g.size * pop, this.tint.setRGB(1.6, .55, 1.4), 1, STAR, .18, 7);
      ek.halos.add(this.c, g.size * 1.4 * pop, this.tint.setRGB(.5, .18, .45), .5 * pop, GLOW, .1);
      if (g.streak) {
        this.a.copy(this.c).addScaledVector(this.right, -3.2 * pop); this.b.copy(this.c).addScaledVector(this.right, 3.2 * pop);
        ek.bolts.segment(this.a, this.b, .022 * pop + .004, this.tint.setRGB(1.5, .3, 1.1), pop, .3);
      }
    }
  }

  private preview(fighters: ReadonlyMap<string, Fighter>) {
    const p = (globalThis as unknown as { __kiPreview?: { size: number; strength: number; flare: number; heart: number; body?: number; sheets: number; push?: number; core: number; rim?: number; only?: string; local?: string } }).__kiPreview;
    if (!p) return;
    for (const f of fighters.values()) {
      if (p.only && (p.only === 'self') !== (f.state.id === p.local)) continue;
      const b = f.group.position;
      this.ki.draw({ x: b.x, y: b.y, z: b.z, size: p.size, strength: p.strength, flare: p.flare, heart: p.heart, body: p.body, sheets: p.sheets, push: p.push,
        colours: kiColours(p.core, p.rim ?? p.core, this.previewColours), seed: hashSeed(f.state.id) });
    }
  }
  private previewColours = kiColours(0xffffff, 0xffffff);

  reset() { this.entries.clear(); this.burns.clear(); this.entering.clear(); this.glints.length = 0; this.burst.reset(); this.electric.reset(); this.haki.begin(); this.haki.end(); }
  dispose() { this.reset(); this.ki.dispose(); this.burst.dispose(); this.electric.dispose(); this.haki.dispose(); }
}

function hashSeed(id: string) { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973; return h * .37; }
const _c = new THREE.Color();
function colourHex(c: THREE.Color) { return _c.copy(c).getHex(); }
export { kiColours };
