import type { AttackSlot, CombatEvent, FighterId, GameSnapshot, PlayerState } from '../../game/types';
import type { Fighter } from '../../render/Fighter';
import { MOVES } from '../../game/moves';
import { FIGHTERS } from '../../config';
import { ATTACK_SLOTS } from '../sim/spec';
import { areaAnimOf, areaCardOf } from '../sim/areaMoves';
import { forgedMoveFor } from '../sim/forgedKits';
import { moveSource, onKitChange, presentationKit, registerTransplant } from './forgeLive';
import { fitAhead, installTakes, knownTakes, onTakeWanted, setTakes } from './transplantTakes';
import { loadTakePack } from './takePacks';

export interface Borrowed { readonly slot: AttackSlot; readonly fighter: FighterId; readonly fromSlot: AttackSlot }

const SLOTS: ReadonlySet<string> = new Set(ATTACK_SLOTS);

export const forged = (state: { fighter: FighterId; forge?: string; enemy?: string }) => !state.enemy && !!presentationKit(state);

export function borrowedAction(state: PlayerState): Borrowed | undefined {
  const slot = state.action;
  if (state.enemy || !SLOTS.has(slot)) return undefined;
  if (slot === 'light' ? (state.chain ?? 0) > 0 : !!state.branch && (slot === 'heavy' || slot === 'special')) return undefined;
  const source = moveSource(state, slot as AttackSlot);
  return source ? { slot: slot as AttackSlot, fighter: source.fighter, fromSlot: source.slot } : undefined;
}
export function areaAnimBorrowed(state: PlayerState): Borrowed | undefined {
  if (state.enemy || state.action !== 'area' || moveSource(state, 'area')) return undefined;
  const anim = areaAnimOf(state.fighter, forgedMoveFor(state) ?? MOVES[state.fighter]?.area);
  return anim.fighter !== state.fighter ? { slot: 'area', fighter: anim.fighter, fromSlot: anim.slot } : undefined;
}
const areaAnimDonor = (p: PlayerState): FighterId | undefined => {
  if (p.enemy || moveSource(p, 'area')) return undefined;
  const from = areaAnimOf(p.fighter, forgedMoveFor(p) ?? MOVES[p.fighter]?.area).fighter;
  return from !== p.fighter ? from : undefined;
};
export const borrowedEvent = (event: CombatEvent) => !!event.body && event.body !== event.fighter;


const MOVE_EVENTS: ReadonlySet<CombatEvent['kind']> = new Set(['cast', 'release', 'hit', 'blocked', 'guard-break', 'just-guard', 'confirm', 'whiff', 'projectile-clash', 'land', 'impact'] as CombatEvent['kind'][]);
const presented = new WeakMap<CombatEvent, CombatEvent>();

export function presentEvent(event: CombatEvent, players: readonly PlayerState[]): CombatEvent {
  if (!event.slot || event.body || event.enemy || !MOVE_EVENTS.has(event.kind)) return event;
  const known = presented.get(event);
  if (known) return known;
  if (event.branch || (event.slot === 'light' && (event.chain ?? 0) > 0) || (event.kind === 'land' && event.drop === undefined)) return event;
  const actor = players.find(p => p.id === event.actorId);
  if (!actor || actor.enemy || (event.fighter !== undefined && event.fighter !== actor.fighter)) return event;
  const source = moveSource(actor, event.slot);
  if (!source) return event;
  const shown: CombatEvent = { ...event, fighter: source.fighter, slot: source.slot, body: actor.fighter };
  if (source.slot === 'light') shown.chain = 0; else delete shown.chain;
  presented.set(event, shown);
  return shown;
}
export function presentEvents<T extends CombatEvent>(events: readonly T[], players: readonly PlayerState[]): T[] {
  let out: T[] | undefined;
  if (players.some(forged)) for (let i = 0; i < events.length; i++) {
    const shown = presentEvent(events[i], players) as T;
    if (shown !== events[i]) (out ??= events.slice())[i] = shown;
  }
  return out ?? events as T[];
}
const snapshots = new WeakMap<GameSnapshot, GameSnapshot>();
export function presentSnapshot<T extends GameSnapshot | undefined>(snapshot: T): T {
  if (!snapshot) return snapshot;
  let shown = snapshots.get(snapshot);
  if (!shown) {
    const events = presentEvents(snapshot.events, snapshot.players);
    shown = events === snapshot.events ? snapshot : { ...snapshot, events };
    snapshots.set(snapshot, shown);
  }
  return shown as T;
}


const players = new WeakMap<PlayerState, PlayerState>();
export function presentPlayers(list: PlayerState[]): PlayerState[] {
  let out: PlayerState[] | undefined;
  for (let i = 0; i < list.length; i++) {
    const p = list[i], move = p.enemy ? undefined : borrowedAction(p);
    if (!move || move.fromSlot === move.slot) continue;
    let shown = players.get(p);
    if (!shown || shown.action !== move.fromSlot) {
      shown = { ...p, action: move.fromSlot, chain: move.fromSlot === 'light' ? 0 : undefined, branch: undefined };
      players.set(p, shown);
    }
    (out ??= list.slice())[i] = shown;
  }
  return out ?? list;
}


interface View {
  readonly proxy: Fighter;
  shown?: PlayerState;
  frame: number;
  readonly bound: Map<PropertyKey, { raw: unknown; fn: unknown }>;
  borrowing: boolean;
}
const views = new WeakMap<Fighter, View>();
let frame = 0;
const shownFighters = new Map<string, Fighter>();

function stateOf(fighter: Fighter, view: View): PlayerState {
  if (view.frame !== frame) {
    view.frame = frame;
    const real = fighter.state, move = borrowedAction(real);
    view.shown = move ? { ...real, fighter: move.fighter, action: move.fromSlot, chain: move.fromSlot === 'light' ? 0 : undefined, branch: undefined, awakened: false } : undefined;
    if (view.borrowing && !move) restoreVisibility(fighter);
    view.borrowing = !!move;
  }
  return view.shown ?? fighter.state;
}
function restoreVisibility(fighter: Fighter) {
  if (fighter.model.visible) return;
  const form = fighter.group.children.some(child => child !== fighter.model && child.visible && child.name.startsWith('fighter-'));
  if (!form) fighter.model.visible = true;
}
function viewOf(fighter: Fighter): Fighter {
  let view = views.get(fighter);
  if (!view) {
    const made: View = { frame: -1, bound: new Map(), borrowing: false } as unknown as View;
    (made as { proxy: Fighter }).proxy = new Proxy(fighter, {
      get(target, key) {
        if (key === 'state') return stateOf(target, made);
        const value = Reflect.get(target, key, target);
        if (typeof value !== 'function') return value;
        let bound = made.bound.get(key);
        if (!bound || bound.raw !== value) { bound = { raw: value, fn: (value as (...args: unknown[]) => unknown).bind(target) }; made.bound.set(key, bound); }
        return bound.fn;
      },
      set(target, key, value) { return Reflect.set(target, key, value, target); },
    });
    views.set(fighter, view = made);
  }
  return view.proxy;
}
const shownAs = new Map<string, FighterId>();
const turned = new Set<string>();
const steadyFighters = new Map<string, Fighter>();
export function presentFighters(fighters: Map<string, Fighter>): Map<string, Fighter> {
  frame++;
  turned.clear();
  let any = false;
  for (const fighter of fighters.values()) if (forged(fighter.state)) { any = true; break; }
  if (any) {
    shownFighters.clear();
    for (const [id, fighter] of fighters) shownFighters.set(id, forged(fighter.state) ? viewOf(fighter) : fighter);
  }
  const shown = any ? shownFighters : fighters;
  for (const [id, fighter] of shown) {
    const as = fighter.state.fighter, was = shownAs.get(id);
    if (was !== undefined && was !== as) turned.add(id);
    shownAs.set(id, as);
  }
  if (shownAs.size > shown.size) for (const id of shownAs.keys()) if (!shown.has(id)) shownAs.delete(id);
  return shown;
}
export function steadyBodies(shown: Map<string, Fighter>): Map<string, Fighter> {
  if (!turned.size) return shown;
  steadyFighters.clear();
  for (const [id, fighter] of shown) if (!turned.has(id)) steadyFighters.set(id, fighter);
  return steadyFighters;
}


const INDEX: Readonly<Record<AttackSlot, number>> = { light: 0, heavy: 1, special: 2, ultimate: 3, area: -1 };
export function slotNames(state: { fighter: FighterId; forge?: string }, slot: AttackSlot): { short: string; name: string; from: FighterId; fromSlot: AttackSlot } | undefined {
  const source = moveSource(state, slot);
  if (!source) return undefined;
  const card = FIGHTERS[source.fighter], i = INDEX[source.slot];
  const move = i < 0 ? MOVES[source.fighter]?.[source.slot] : undefined;
  const name = (move ? move.name : card.moves[i]) ?? source.slot;
  return { short: move ? areaCardOf(move).toUpperCase() : card.shortMoves?.[i] ?? name.toUpperCase(), name, from: source.fighter, fromSlot: source.slot };
}


export function transplantDonors(list: readonly PlayerState[], have: readonly FighterId[] = []): FighterId[] {
  const out = new Set<FighterId>();
  for (const p of list) {
    const animated = areaAnimDonor(p);
    if (animated && !have.includes(animated)) out.add(animated);
    if (!forged(p)) continue;
    for (const slot of ATTACK_SLOTS) { const source = moveSource(p, slot); if (source && !have.includes(source.fighter)) out.add(source.fighter); }
  }
  return [...out];
}
export const transplantKey = (list: readonly PlayerState[]) => { const donors = transplantDonors(list); return donors.length ? `+${donors.sort().join(',')}` : ''; };
const recent: FighterId[] = [];
const RECENT = 6;
const remember = (from: FighterId) => { const at = recent.indexOf(from); if (at >= 0) recent.splice(at, 1); recent.push(from); if (recent.length > RECENT) recent.shift(); };
export function effectDonors(list: readonly PlayerState[], have: readonly FighterId[] = []): FighterId[] {
  return [...new Set([...transplantDonors(list, have), ...recent.filter(id => !have.includes(id))])];
}

export interface TransplantHost {
  ensure(ids: readonly FighterId[]): Promise<void>;
  donor(state: PlayerState): Fighter | undefined;
  bodies(): Iterable<Fighter>;
  effects(donors: readonly FighterId[]): Promise<void>;
  compile(): Promise<void>;
}
let host: TransplantHost | undefined;
const preparing = new Map<string, Promise<void>>();
const standing = (fighter: FighterId): PlayerState => ({ id: `transplant-${fighter}`, name: 'Transplant', fighter, x: 0, y: -1000, z: 0, yaw: 0, hp: 1, maxHp: 1,
  stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 1, actionTime: 0, target: null, alive: true, isBot: true, grounded: true,
  guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
function fitFor(body: FighterId, from: FighterId, fromSlot: AttackSlot, steps?: Record<string, number>) {
  if (!host) return;
  let at = performance.now();
  const lap = (name: string) => { if (steps) { const now = performance.now(); steps[name] = (steps[name] ?? 0) + Math.round(now - at); at = now; } };
  const live = [...host.bodies()].filter(each => each.state.fighter === body), made = live.length ? undefined : host.donor(standing(body));
  lap('body');
  try { fitAhead(from, fromSlot, made ? [made] : live, id => { const donor = host?.donor(standing(id)); lap('donor'); return donor; }); } finally { made?.dispose(); }
  lap('fit');
}

const timings: { move: string; steps: Record<string, number>; total: number }[] = [];
const recorded = (move: string, started: number, steps: Record<string, number>) => {
  timings.push({ move, steps, total: Math.round(performance.now() - started) });
  if (timings.length > 32) timings.shift();
};
export const prepareTimings = () => timings;
if (typeof navigator === 'object' && navigator.webdriver && typeof window === 'object') (window as unknown as { __transplantTimings?: typeof timings }).__transplantTimings = timings;

export const EFFECTS_GRACE = 100;
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const getting = new Map<FighterId, Promise<void>>();
function takesFor(from: FighterId, steps?: Record<string, number>) {
  let pending = getting.get(from);
  if (!pending) {
    pending = (async () => {
      if (knownTakes(from)) return;
      const started = performance.now(), packed = await loadTakePack(from);
      if (packed?.light && packed.heavy && packed.special && packed.ultimate) { setTakes(from, packed as Required<typeof packed>); if (steps) steps.pack = Math.round(performance.now() - started); return; }
      await host?.ensure([from]);
      if (steps) steps.files = Math.round(performance.now() - started);
    })();
    getting.set(from, pending);
    pending.catch(() => getting.delete(from));
  }
  return pending;
}
const linking = new Map<FighterId, Promise<void>>();
function effectsFor(from: FighterId) {
  let pending = linking.get(from);
  if (!pending) {
    pending = (async () => { if (!host) return; await host.effects([from]); await host.compile(); })();
    linking.set(from, pending);
    pending.catch(() => linking.delete(from));
  }
  return pending;
}

export function prepare(body: FighterId, from: FighterId, fromSlot: AttackSlot): Promise<void> {
  const key = `${body}:${from}:${fromSlot}`;
  let ready = preparing.get(key);
  if (!ready) {
    const work = async () => {
      if (!host || body === from) return;
      remember(from);
      const started = performance.now(), steps: Record<string, number> = {};
      const effects = effectsFor(from).then(() => { steps.effects = Math.round(performance.now() - started); });
      effects.catch(error => console.warn(`Transplant: ${from}'s effects could not be loaded`, error));
      await Promise.all([takesFor(from, steps), host.ensure([body])]);
      let at = performance.now();
      fitFor(body, from, fromSlot, steps);
      steps.take = Math.round((at = performance.now()) - started);
      await Promise.race([effects, wait(EFFECTS_GRACE)]).catch(() => {});
      recorded(key, started, steps);
    };
    ready = work().catch(error => { preparing.delete(key); console.warn(`Transplant: ${from}'s ${fromSlot} could not be readied for ${body}`, error); });
    preparing.set(key, ready);
  }
  return ready;
}
export function prefetch(from: FighterId) {
  if (!host) return;
  void takesFor(from).catch(() => {});
}
function prepareKit(body: FighterId) {
  const state = { fighter: body };
  for (const slot of ATTACK_SLOTS) { const source = moveSource(state, slot); if (source) void prepare(body, source.fighter, source.slot); }
}

export function installTransplant(page: TransplantHost) {
  host = page;
  installTakes();
  registerTransplant({ prepare, prefetch });
  onKitChange((body, kit) => { if (kit) prepareKit(body); });
  onTakeWanted((body, from, fromSlot) => { if (knownTakes(from)) fitFor(body, from, fromSlot); else void prepare(body, from, fromSlot); });
}

export function resetTransplant() { host = undefined; preparing.clear(); getting.clear(); linking.clear(); recent.length = 0; }
