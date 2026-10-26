import * as THREE from 'three';
import type { AttackSlot, CombatEvent, FighterId } from '../../../game/types';
import { MOVES, type MoveDefinition } from '../../../game/moves';
import { FIGHTERS } from '../../../config';
import type { FighterCasting, SlotCasting } from '../../../engine/vfx/casting';
import { ARMORY_CASTINGS, type RuntimeCasting } from './vendor/castings';
import type { ForgeFx } from '../../../engine/sim/forge';
import { splitSettings, type Macros } from './macros';
import { auraFx } from './fxLookup';
import type { Fighter } from '../../Fighter';
import type { Flight } from '../../CombatEffects';
import type { VfxKit } from '../VfxKit';
import { bodyCentre } from '../VfxKit';
import { EffectRegistry, type CueContext, type EffectAnchor, type EffectFrame, type EffectInstance, type EffectType, type Tier } from '../engine/Effect';
import { CueDirector, type Cue, type CueAnchorSpec, type CueTrack } from '../engine/cues';
import { registerIce, definePreset, presetFromPalette, ICE, type CrystalFieldParams, type FreezeOnHitParams, type IceLanceParams, type FloorFreezeParams, type IcePheasantParams } from '../engine/ice';
import { involvesLocal } from '../../signature/context';
import { FITS } from './fits';
import { armoryRollout, CAST } from './rollout';
import { clearArmoryDrawn, markArmoryDrawn, markArmoryHit, markArmoryOnly } from './drawn';
import type { ArmoryParams } from './effect';


export type MoveSlot = Exclude<AttackSlot, 'body'>;
const NATIVE = new Set<string>(Object.values(ICE));
const isNative = (id: string) => id.includes('/');
type Casting = Pick<FighterCasting, 'palette'> & { readonly slots?: Partial<FighterCasting['slots']> };
const MOVE_SLOTS: readonly MoveSlot[] = ['light', 'heavy', 'special', 'ultimate'] as MoveSlot[];
export const SCALE = Object.freeze({ small: .62, medium: .82, large: 1, huge: 1.25 });
export const AURA_SCALE = Object.freeze({ small: .95, medium: 1.05, large: 1.15, huge: 1.3 });

export interface BodyAura { readonly effect: string; readonly when: 'awakened' | 'always'; readonly params: ArmoryParams }
export interface CastingTrack {
  readonly cues: CueTrack;
  readonly slots: Readonly<Partial<Record<MoveSlot | 'body', string | null>>>;
  readonly body?: BodyAura;
  readonly armory: readonly string[];
  readonly native: readonly string[];
}

export function resolvePick(slot: SlotCasting | undefined, available: (id: string) => boolean): string | null {
  for (const id of slot?.pick ? [slot.pick, ...(slot.alt ?? [])] : []) {
    if (isNative(id)) { if (NATIVE.has(id)) return id; continue; }
    if (available(id)) return id;
  }
  return null;
}

const heightOf = (fighter: FighterId) => (FIGHTERS as Record<string, { height?: number }>)[fighter]?.height ?? 1.7;

function timing(cast: Pick<SlotCasting, 'on'>, slot: MoveSlot, move: Pick<MoveDefinition, 'contacts' | 'duration'>) {
  const on = cast.on ?? (slot === 'light' ? 'hit' : 'release');
  const contacts = move.contacts.length ? move.contacts : [0];
  const first = contacts[0], last = contacts[contacts.length - 1];
  switch (on) {
    case 'cast': return { start: 0, finisher: last, release: false, cue: { on: 'cast' as const } };
    case 'release': return { start: first, finisher: last, release: true, cue: { on: 'cast' as const, at: first } };
    case 'hit': return { start: last, finisher: last, release: true, cue: { on: 'hit' as const, ...(contacts.length > 1 ? { contact: contacts.length - 1 } : {}) } };
    case 'confirm': return { start: first, finisher: last, release: false, cue: { on: 'confirm' as const, life: 'move' as const } };
    case 'land': return { start: last, finisher: last, release: true, cue: { on: 'land' as const } };
  }
}

function placement(cast: Pick<SlotCasting, 'anchor'>, move: Pick<MoveDefinition, 'style'>, on: string): { lay: ArmoryParams['lay']; anchor: CueAnchorSpec } {
  const melee = move.style === 'melee';
  switch (cast.anchor) {
    case 'target': return { lay: on === 'hit' || on === 'confirm' ? 'target' : 'line', anchor: on === 'hit' || on === 'confirm' ? { of: 'target', socket: 'centre', follow: false } : { socket: 'hand', follow: false } };
    case 'ground': return { lay: 'zone', anchor: on === 'hit' || on === 'confirm' ? { of: 'target', socket: 'floor', follow: false } : { socket: 'endpoint', follow: false } };
    case 'weapon': return { lay: 'line', anchor: { socket: 'strike', follow: false } };
    case 'feet': return { lay: 'line', anchor: { socket: 'floor', follow: false } };
    case 'body': return { lay: 'body', anchor: { socket: 'centre', follow: true } };
    case 'hand': return { lay: 'line', anchor: { socket: 'hand', follow: false } };
    default: return { lay: 'line', anchor: { socket: melee ? 'strike' : 'hand', follow: false } };
  }
}

export interface FxLook { scale?: number; hue?: number; macros?: Macros; sound?: ArmoryParams['sound'] }

function armoryCues(fighter: FighterId, slot: MoveSlot, cast: Omit<SlotCasting, 'why'>, pick: string, move: MoveDefinition, palette: FighterCasting['palette'] | undefined, own: boolean, look?: FxLook): Cue[] {
  const when = timing(cast, slot, move), place = placement(cast, move, when.cue.on), fit = FITS[pick] ?? {};
  const height = heightOf(fighter), size = SCALE[cast.scale ?? 'medium'] * height / 1.8 * (look?.scale ?? 1);
  const reach = Math.max(1.5, move.range + .5);
  const projectile = move.style === 'projectile' || move.style === 'beam' || move.style === 'bomb';
  const after = Math.max(.2, move.duration - when.start);
  const zone = fit.radius, wanted = move.radius ? move.radius * (cast.scale === 'huge' ? 1.5 : 1.2) : undefined;
  const params: ArmoryParams = {
    lay: place.lay, reach, size, height, ...(palette ? { palette: { core: palette.core, main: palette.main, rim: palette.rim } } : {}),
    ...(look?.hue ? { hue: look.hue } : {}), ...(look?.macros ? { macros: look.macros } : {}),
    release: when.release, past: projectile ? 1.6 : 1.1,
    speed: projectile ? move.speed ?? 30 : Math.max(40, reach / .05),
    sustain: Math.min(1.6, Math.max(.25, after - .2)),
    hold: after + .8,
    radius: wanted === undefined ? zone?.[0] : zone ? Math.min(zone[1], Math.max(zone[0], wanted)) : Math.max(1.5, wanted),
    ...(fit.pace && fit.peak ? { pace: fit.peak / Math.max(.35, when.finisher - when.start) } : {}),
    set: cast.settings,
    light: .35,
    impactFrame: slot === 'ultimate' && !own ? .42 : 0,
  };
  if (slot === 'ultimate' && place.lay === 'line') { params.reach = Math.max(reach, 7); params.past = 4; }
  const fan = Math.max(1, Math.min(7, Math.round(cast.fan ?? 1))), spread = (cast.spread ?? 26) * Math.PI / 180, sound = look ? look.sound : soundOf(cast);
  return Array.from({ length: fan }, (_, i): Cue => ({ ...when.cue, slot, type: `armory/${pick}`, preset: `armory/${fighter}`, anchor: place.anchor,
    params: { ...params, ...(fan > 1 ? { yaw: (i / (fan - 1) - .5) * spread } : {}), ...(sound && i === fan >> 1 ? { sound } : {}) } }));
}

export const soundOf = (cast: Pick<SlotCasting, 'sound'>): ArmoryParams['sound'] => cast.sound === false ? undefined : cast.sound ? 'full' : 'bed';

export function fxCues(body: FighterId, moveFighter: FighterId, slot: MoveSlot, fx: ForgeFx): Cue[] {
  const move = MOVES[moveFighter]?.[slot] ?? MOVES[body]?.[slot];
  if (!move) return [];
  const { macros, own } = splitSettings(fx.settings);
  const cast = { pick: fx.effect, settings: Object.keys(own).length ? own : undefined };
  if (isNative(fx.effect)) return NATIVE.has(fx.effect) ? nativeCues(body, slot, cast, fx.effect, move) : [];
  return armoryCues(body, slot, cast, fx.effect, move, undefined, false, { scale: fx.scale, hue: fx.hue, macros, sound: 'bed' });
}

const VICTIM_FLOOR: CueAnchorSpec = { of: 'target', socket: 'floor', follow: false };
const FLIGHT: CueAnchorSpec = { socket: 'flight', follow: true };

function nativeCues(fighter: FighterId, slot: MoveSlot, cast: Omit<SlotCasting, 'why'>, pick: string, move: MoveDefinition): Cue[] {
  const preset = `ice/${fighter}`, when = timing(cast, slot, move), s = SCALE[cast.scale ?? 'medium'] / .82;
  const contacts = move.contacts.length ? move.contacts : [0], last = contacts.length - 1;
  const projectile = move.style === 'projectile' || move.style === 'beam';
  const cue = <T extends object>(type: string, base: Omit<Cue, 'type' | 'preset' | 'params'>, params: T): Cue => ({ ...base, type, preset, params, slot });
  switch (pick) {
    case ICE.field: {
      if (projectile && cast.anchor === 'line') return [cue<CrystalFieldParams>(ICE.field, { on: 'cast', anchor: FLIGHT }, {
        layout: 'line', reach: move.range, width: [.35 * s, 1.1 * s], count: { low: 22, medium: 38, high: 56 }, height: [1.1 * s, 2.1 * s], radius: .24 * s,
        rubble: .35, lean: .32, rise: .12, hold: .8, sink: .5, end: 'shatter', chips: { low: 0, medium: 1, high: 1 }, bias: 1.35 })];
      if (slot === 'ultimate' || cast.scale === 'huge') return [cue<CrystalFieldParams>(ICE.field, { on: 'hit', contact: contacts.length > 1 ? last : undefined, anchor: VICTIM_FLOOR }, {
        layout: 'disc', reach: 4.6 * s, clear: .9, count: { low: 28, medium: 48, high: 72 }, height: [2.3 * s, .45 * s], radius: .34 * s, rubble: .3,
        spread: 13, spokes: 8, rise: .14, hold: .85, sink: .55, lean: .55, end: 'shatter', chips: { low: 0, medium: 1, high: 2 }, impactFrame: .42 })];
      return [cue<CrystalFieldParams>(ICE.field, { on: 'hit', contact: contacts.length > 1 ? last : undefined, anchor: VICTIM_FLOOR }, {
        layout: 'ring', reach: 1.1 * s, clear: .6, count: { low: 6, medium: 9, high: 12 }, height: [1.4 * s, .75 * s], radius: .22 * s, rubble: .2,
        spread: 0, rise: .1, hold: .35, sink: .3, lean: .5, end: 'shatter', chips: { low: 1, medium: 1, high: 2 } })];
    }
    case ICE.freeze: return [cue<FreezeOnHitParams>(ICE.freeze, { on: 'hit', contact: contacts.length > 1 ? last : undefined, anchor: { of: 'target', joint: 'Hips', follow: true } },
      slot === 'light' || cast.scale === 'small'
        ? { grow: .05, hold: .18, shatter: .2, bulk: 1.18, spikes: { low: 0, medium: 0, high: 1 } }
        : { grow: .09, hold: .7, shatter: .42, bulk: 1.55, spikes: { low: 0, medium: 1, high: 2 } })];
    case ICE.lance: return [cue<IceLanceParams>(ICE.lance, { on: 'cast', anchor: FLIGHT }, { length: 3.1 * s, girdle: .42 * s, charge: contacts[0], speed: move.speed ?? 27, wake: { low: 6, medium: 12, high: 18 } })];
    case ICE.floor: return [cue<FloorFreezeParams>(ICE.floor, projectile ? { on: 'cast', anchor: FLIGHT } : { ...when.cue, anchor: { socket: 'floor', follow: false } },
      projectile ? { shape: 'strip', reach: move.range, width: 1.05 * s, hold: 1.1, thaw: .5 } : { shape: 'disc', reach: 4 * s, grow: .62, hold: 1.25, thaw: .6 })];
    case ICE.pheasant: return [cue<IcePheasantParams>(ICE.pheasant, { on: 'cast', anchor: FLIGHT }, { span: 4.6 * s, charge: contacts[0], speed: move.speed ?? 27, wake: { low: 6, medium: 12, high: 20 } })];
  }
  return [];
}

export function trackFor(fighter: FighterId, casting: Casting, available: (id: string) => boolean, own = true): CastingTrack {
  const cues: Cue[] = [], slots: Partial<Record<MoveSlot | 'body', string | null>> = {}, armory = new Set<string>(), native = new Set<string>();
  for (const slot of MOVE_SLOTS) {
    const cast = casting.slots?.[slot], move = MOVES[fighter]?.[slot];
    const pick = move ? resolvePick(cast, available) : null;
    slots[slot] = pick;
    if (!pick || !cast || !move) continue;
    if (isNative(pick)) { cues.push(...nativeCues(fighter, slot, cast, pick, move)); native.add(pick); }
    else { cues.push(...armoryCues(fighter, slot, cast, pick, move, casting.palette, own)); armory.add(pick); }
  }
  let body: BodyAura | undefined;
  const aura = casting.slots?.body, pick = aura && aura.when !== 'never' ? resolvePick(aura, available) : null;
  slots.body = pick && !isNative(pick) ? pick : null;
  if (pick && !isNative(pick) && aura) {
    const height = heightOf(fighter);
    body = { effect: pick, when: aura.when === 'always' ? 'always' : 'awakened', params: {
      lay: 'body', size: AURA_SCALE[aura.scale ?? 'small'] * height / 1.8, height, palette: { core: casting.palette.core, main: casting.palette.main, rim: casting.palette.rim },
      set: aura.settings, light: .25, ...(soundOf(aura) ? { sound: soundOf(aura) } : {}) } };
    armory.add(pick);
  }
  return { cues: Object.freeze(cues), slots, body, armory: [...armory], native: [...native] };
}

export function capacityOf(id: string, castings: Partial<Record<FighterId, Casting>> = ARMORY_CASTINGS, fighters: readonly FighterId[] = CAST, available: (id: string) => boolean = () => true) {
  let uses = 0;
  for (const fighter of fighters) {
    const casting = castings[fighter];
    if (!casting) continue;
    const track = trackFor(fighter, casting, available);
    uses += track.cues.filter(c => c.type === `armory/${id}`).length + (track.body?.effect === id ? 1 : 0);
  }
  return Math.min(8, Math.max(2, uses * 2));
}

interface Signature {
  load(ids: readonly FighterId[]): Promise<unknown>;
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>): void;
  prepareContact?(event: CombatEvent, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>): void;
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>): void;
  reset(): void;
  dispose(): void;
}
type Kit = Pick<VfxKit, 'budget' | 'quality' | 'density' | 'lights'>;

const _p = new THREE.Vector3();
const STILL_ELEMENT = Object.freeze({ spike: 0xffffff, rim: 0xffffff, light: 0xffffff, ink: 0 });

class AuraDriver {
  private readonly worn = new Map<string, { instance: EffectInstance<ArmoryParams>; ctx: CueContext & { anchor: EffectAnchor }; born: number; off: boolean }>();
  private readonly frame: EffectFrame & { time: number; fighters: ReadonlyMap<string, Fighter>; flights: ReadonlyMap<string, Flight> };
  private last?: number;
  constructor(private readonly fighter: FighterId, private readonly type: EffectType<ArmoryParams>, private readonly aura: BodyAura, private readonly kit: Kit) {
    const light = kit.lights ? (x: number, y: number, z: number, hex: number, intensity: number, distance: number) => kit.lights!.request(x, y, z, hex, intensity, distance, 1.2) : undefined;
    this.frame = { time: 0, fighters: new Map(), flights: new Map(), locate: (anchor, out) => { const f = anchor.fighter ? this.frame.fighters.get(anchor.fighter) : undefined; if (!f) { out.copy(anchor.point); return false; } bodyCentre(f, out); return true; }, light };
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    const dt = this.last === undefined ? 0 : Math.max(0, Math.min(.1, time - this.last));
    this.last = time;
    this.frame.time = time; this.frame.fighters = fighters; this.frame.flights = flights;
    for (const [id, f] of fighters) {
      if (f.state?.fighter !== this.fighter) continue;
      const wanted = f.state.alive !== false && (this.aura.when === 'always' || !!f.state.awakened) && !auraFx(f);
      const worn = this.worn.get(id);
      if (wanted && !worn) {
        const instance = this.type.acquire();
        if (!instance) continue;
        const ctx = this.context(id, f);
        instance.start(this.aura.params, ctx);
        this.worn.set(id, { instance, ctx, born: time, off: false });
      } else if (!wanted && worn && !worn.off) { worn.off = true; worn.instance.cancel(f.state.alive === false ? 'despawn' : 'interrupt'); }
    }
    for (const [id, worn] of this.worn) {
      let alive = fighters.has(id);
      if (alive) { try { alive = worn.instance.update(time - worn.born, dt, this.frame); } catch (error) { console.warn('armory aura failed', error); alive = false; } }
      if (!alive) { worn.instance.release(); this.worn.delete(id); }
    }
  }
  private context(id: string, f: Fighter): CueContext & { anchor: EffectAnchor } {
    bodyCentre(f, _p);
    const yaw = f.state?.yaw ?? 0;
    return {
      seed: [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7), palette: STILL_ELEMENT, preset: `armory/${this.fighter}`,
      anchor: { point: _p.clone(), fighter: id, socket: 'centre', follow: true, floor: f.group.position.y },
      tier: (this.kit.quality ?? 'high') as Tier, density: this.kit.density ?? 1, local: involvesLocal(id), actorId: id,
      heading: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)),
    };
  }
  reset() { for (const worn of this.worn.values()) { worn.instance.cancel('despawn'); worn.instance.release(); } this.worn.clear(); this.last = undefined; }
}

export class CastingSignature implements Signature {
  private director?: CueDirector;
  private aura?: AuraDriver;
  private track?: CastingTrack;
  private loading?: Promise<void>;
  private disposed = false;
  private pump?: () => void;
  private room?: ReadonlyMap<string, Fighter>;
  constructor(readonly fighter: FighterId, private readonly scene: THREE.Scene, private readonly kit: Kit, readonly base?: Signature) {}

  load(ids: readonly FighterId[]) {
    this.loading ??= this.prepare().catch(error => { console.warn(`armory casting for ${this.fighter} not loaded`, error); });
    return Promise.all([this.base?.load(ids), this.loading]);
  }

  private async prepare() {
    const casting: RuntimeCasting | undefined = ARMORY_CASTINGS[this.fighter];
    if (!casting?.slots) return;
    const runtime = await import('./runtime');
    if (this.disposed) return;
    const track = trackFor(this.fighter, casting, runtime.vendored, !!this.base);
    const registry = new EffectRegistry();
    const { host, types } = await runtime.armoryTypes(this.scene, track.armory, id => capacityOf(id, ARMORY_CASTINGS, CAST, runtime.vendored));
    if (this.disposed) { host.dispose(); return; }
    registry.layer(host);
    for (const type of types) registry.register(type);
    if (track.native.length) {
      registerIce(registry, this.scene);
      if (track.native.some(id => id.startsWith('ice/'))) definePreset(presetFromPalette(`ice/${this.fighter}`, casting.palette));
    }
    registry.prewarm(this.scene);
    const tier = (this.kit.quality ?? 'high') as Tier;
    for (const cue of track.cues) {
      const p = cue.params as ArmoryParams | undefined, type = types.find(t => t.id === cue.type);
      if (!type || (!p?.set && !p?.macros)) continue;
      try { type.warmWith((p.set ?? {}) as Record<string, number | string | boolean>, p.macros ?? {}, tier); } catch (error) { console.warn(`armory: ${cue.type} for ${this.fighter} was not warmed with its casting's values`, error); }
    }
    runtime.prepareSound(track);
    this.pump = runtime.pumpSound;
    this.track = track;
    const formOf = (slot?: string) => (casting.slots as Partial<Record<string, { form?: 'base' | 'awakened' }>> | undefined)?.[slot ?? '']?.form;
    const base = track.cues.filter(c => formOf(c.slot) !== 'awakened'), awake = track.cues.filter(c => formOf(c.slot) !== 'base');
    this.director = new CueDirector({
      registry,
      tracks: (fighter: FighterId, event: CombatEvent) => fighter !== this.fighter ? undefined : this.room?.get(event.actorId)?.state?.awakened ? awake : base,
      tier: () => (this.kit.quality ?? 'high') as Tier,
      density: () => this.kit.density ?? 1,
      light: this.kit.lights ? (x, y, z, hex, intensity, distance) => this.kit.lights!.request(x, y, z, hex, intensity, distance, 1.5) : undefined,
    });
    if (track.body) {
      const aura = types.find(t => t.effectId === track.body!.effect);
      if (aura) this.aura = new AuraDriver(this.fighter, aura, track.body, this.kit);
    }
    const drawn = MOVE_SLOTS.filter(slot => track.slots[slot]);
    markArmoryDrawn(this.fighter, drawn);
    if (!this.base) markArmoryHit(this.fighter, drawn.filter(slot => timing(casting.slots?.[slot] ?? {}, slot, MOVES[this.fighter]?.[slot] ?? { contacts: [0], duration: 1 }).cue.on === 'hit'));
  }

  get slots() { return this.track?.slots; }
  get armoryIds(): readonly string[] { return this.track?.armory ?? []; }
  get live() { return this.director?.liveEffects() ?? []; }

  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    this.base?.handle(event, fighters);
    if (fighters) this.room = fighters;
    this.director?.handle(event, fighters);
  }
  prepareContact(event: CombatEvent, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) { this.base?.prepareContact?.(event, fighters, flights); }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    this.base?.update(time, fighters, flights);
    this.director?.update(time, fighters, flights);
    this.aura?.update(time, fighters, flights);
    this.pump?.();
  }
  reset() { this.base?.reset(); this.director?.reset(); this.aura?.reset(); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.base?.dispose();
    this.aura?.reset();
    this.director?.dispose();
    clearArmoryDrawn(this.fighter);
  }
}

type Factory = (scene: THREE.Scene, kit: VfxKit) => Signature;

export function wireArmory(factories: Partial<Record<FighterId, Factory>>, rollout: ReadonlySet<FighterId> = armoryRollout()) {
  if (!rollout.size) return factories;
  for (const id of rollout) {
    if (!ARMORY_CASTINGS[id]?.slots) continue;
    const base = factories[id];
    if (!base) markArmoryOnly(id);
    factories[id] = (scene, kit) => new CastingSignature(id, scene, kit, base?.(scene, kit));
  }
  return factories;
}
