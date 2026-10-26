import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import type { AttackSlot, CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { MOVES } from '../src/game/moves';
import { CORE_SLOTS, FIGHTER_IDS, encodeForge, ownKit, type ForgeKit } from '../src/engine/sim';
import { forgetForgeKits, rememberForgeKits, shortForgeHash } from '../src/engine/sim/forgedKits';
import { setActiveKit } from '../src/engine/client/forgeLive';
import {
  borrowedAction, borrowedEvent, presentEvent, presentEvents, presentFighters, presentPlayers, presentSnapshot, slotNames, steadyBodies, transplantDonors, transplantKey,
} from '../src/engine/client/transplant';
import { resetTakes, setTakes, takeSlotOf, transplantFor } from '../src/engine/client/transplantTakes';
import { rigOf } from '../src/engine/client/retarget';
import { planCombatAudio } from '../src/audio/cuePlan';
import { cueFighter } from '../src/audio/CombatAudio';
import type { Fighter } from '../src/render/Fighter';

const kit = (body: FighterId, picks: Partial<Record<AttackSlot, ForgeKit['slots']['light']>>): ForgeKit =>
  ({ ...ownKit(body, 'Transplant'), slots: { ...ownKit(body).slots, ...picks } });
const player = (fighter: FighterId, patch: Partial<PlayerState> = {}): PlayerState => ({
  id: 'p1', name: 'P1', fighter, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle',
  actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...patch,
});
const event = (patch: Partial<CombatEvent>): CombatEvent => ({ id: 1, serverTime: 10, actorId: 'p1', kind: 'cast', fighter: 'endeavor', slot: 'special', origin: { x: 0, y: 1, z: 0 }, endpoint: { x: 0, y: 1, z: 8 }, ...patch });

afterEach(() => { setActiveKit(undefined, 'endeavor'); setActiveKit(undefined, 'saitama'); forgetForgeKits(); });

describe('the move transplant: events', () => {
  it("names a borrowed move's own fighter and slot on every event of the move, and the body that threw it", () => {
    setActiveKit(kit('endeavor', { special: { from: 'ace' }, heavy: { from: 'ace', fromSlot: 'ultimate' } }));
    const players = [player('endeavor'), player('luffy', { id: 'p2' })];
    for (const kind of ['cast', 'release', 'hit', 'blocked', 'guard-break', 'just-guard', 'confirm', 'whiff', 'projectile-clash'] as const) {
      const shown = presentEvent(event({ kind, fighter: kind === 'blocked' || kind === 'guard-break' ? undefined : 'endeavor' }), players);
      expect(shown, kind).toMatchObject({ fighter: 'ace', slot: 'special', body: 'endeavor' });
      expect(borrowedEvent(shown), kind).toBe(true);
    }
    expect(presentEvent(event({ slot: 'heavy' }), players)).toMatchObject({ fighter: 'ace', slot: 'ultimate', body: 'endeavor' });
    const cast = event({});
    expect(presentEvent(cast, players)).toBe(presentEvent(cast, players));
  });

  it("leaves the body's own moves, enders, later rush stages, other players and the other body's events alone", () => {
    setActiveKit(kit('endeavor', { light: { from: 'zoro' }, special: { from: 'ace' } }));
    const players = [player('endeavor'), player('luffy', { id: 'p2' })];
    const same = (e: CombatEvent) => expect(presentEvent(e, players)).toBe(e);
    same(event({ slot: 'heavy' }));
    same(event({ slot: 'special', branch: 'lllh' as CombatEvent['branch'] }));
    same(event({ slot: 'light', chain: 2 }));
    same(event({ actorId: 'p2', fighter: 'luffy' }));
    same(event({ kind: 'vanish' }));
    same(event({ kind: 'status', slot: undefined }));
    same(event({ kind: 'land', slot: 'ultimate' }));
    expect(presentEvent(event({ slot: 'light', chain: 0 }), players)).toMatchObject({ fighter: 'zoro', slot: 'light', chain: 0 });
    expect(presentEvent(event({ kind: 'land', slot: 'special', drop: 2 }), players)).toMatchObject({ fighter: 'ace' });
    const events = [event({ slot: 'heavy' }), event({ id: 2, actorId: 'p2', fighter: 'luffy' })];
    expect(presentEvents(events, players)).toBe(events);
  });

  it('plays a kit online by its hash, for that player only', () => {
    const forged = kit('endeavor', { special: { from: 'gojo', fromSlot: 'ultimate' } }), hash = shortForgeHash(forged);
    expect(rememberForgeKits({ [hash]: encodeForge(forged) })).toBe(1);
    const players = [player('endeavor', { forge: hash }), player('endeavor', { id: 'p2' })];
    expect(presentEvent(event({}), players)).toMatchObject({ fighter: 'gojo', slot: 'ultimate', body: 'endeavor' });
    expect(presentEvent(event({ actorId: 'p2' }), players).fighter).toBe('endeavor');
    const snapshot = { events: [event({})], players } as unknown as Parameters<typeof presentSnapshot>[0];
    expect(presentSnapshot(snapshot)).toBe(presentSnapshot(snapshot));
    expect(presentSnapshot(snapshot)!.events[0]).toMatchObject({ fighter: 'gojo' });
    expect(snapshot!.events[0].fighter).toBe('endeavor');
  });
});

describe('the move transplant: players, bodies and names', () => {
  it("reads a body throwing another slot's move in that slot for the audio, and nothing else", () => {
    setActiveKit(kit('endeavor', { heavy: { from: 'ace', fromSlot: 'ultimate' }, special: { from: 'ace' } }));
    const heavy = player('endeavor', { action: 'heavy' }), special = player('endeavor', { action: 'special' });
    const list = [heavy, special];
    const shown = presentPlayers(list);
    expect(shown[0]).toMatchObject({ fighter: 'endeavor', action: 'ultimate' });
    expect(shown[1]).toBe(special);
    expect(borrowedAction(heavy)).toEqual({ slot: 'heavy', fighter: 'ace', fromSlot: 'ultimate' });
    expect(borrowedAction(player('endeavor', { action: 'heavy', branch: 'lllh' as PlayerState['branch'] }))).toBeUndefined();
    expect(presentPlayers([special])).toEqual([special]);
  });

  it("shows the effect modules the move's fighter on the body's own joints, and the body's methods on its own state", () => {
    setActiveKit(kit('endeavor', { special: { from: 'zoro', fromSlot: 'heavy' } }));
    const model = { visible: true }, body = {
      state: player('endeavor', { action: 'special', awakened: true }), model, group: { children: [model] },
      joints: new Map([['RightHand', 'hand']]), whose() { return (this as { state: PlayerState }).state.fighter; },
    } as unknown as Fighter;
    const map = new Map<string, Fighter>([['p1', body]]);
    const view = presentFighters(map).get('p1')!;
    expect(view).not.toBe(body);
    expect(view.state).toMatchObject({ fighter: 'zoro', action: 'heavy', awakened: false });
    expect(view.joints).toBe(body.joints);
    expect((view as unknown as { whose(): string }).whose()).toBe('endeavor');
    view.model.visible = false;
    (body as { state: PlayerState }).state = player('endeavor', { action: 'idle' });
    expect(presentFighters(map).get('p1')!.state.fighter).toBe('endeavor');
    expect(model.visible).toBe(true);
    setActiveKit(undefined, 'endeavor');
    expect(presentFighters(map)).toBe(map);
  });

  it("lets a body leave the effects' per-frame updates for the one frame its borrowed move begins or ends", () => {
    setActiveKit(kit('endeavor', { special: { from: 'jotaro' } }));
    const model = { visible: true }, body = { state: player('endeavor', { action: 'idle' }), model, group: { children: [model] } } as unknown as Fighter;
    const other = { state: player('luffy', { id: 'p2' }) } as unknown as Fighter;
    const map = new Map<string, Fighter>([['p1', body], ['p2', other]]);
    const steady = () => [...steadyBodies(presentFighters(map)).keys()];
    expect(steady()).toEqual(['p1', 'p2']);
    (body as { state: PlayerState }).state = player('endeavor', { action: 'special' });
    expect(steady()).toEqual(['p2']);
    expect(steady()).toEqual(['p1', 'p2']);
    (body as { state: PlayerState }).state = player('endeavor', { action: 'idle' });
    expect(steady()).toEqual(['p2']);
    expect(steady()).toEqual(['p1', 'p2']);
  });

  it("names the HUD's cards after the move each slot carries, and lists the fighters to load", () => {
    setActiveKit(kit('endeavor', { special: { from: 'ace' }, ultimate: { from: 'gojo', fromSlot: 'special' } }));
    const me = player('endeavor');
    expect(slotNames(me, 'special')).toMatchObject({ from: 'ace', fromSlot: 'special', name: 'Hiken' });
    expect(slotNames(me, 'ultimate')).toMatchObject({ from: 'gojo', fromSlot: 'special', name: 'Hollow Purple' });
    expect(slotNames(me, 'heavy')).toBeUndefined();
    expect(transplantDonors([me, player('luffy', { id: 'p2' })]).sort()).toEqual(['ace', 'gojo']);
    expect(transplantDonors([me], ['ace'])).toEqual(['gojo']);
    expect(transplantKey([me])).toBe('+ace,gojo');
    expect(transplantKey([player('luffy')])).toBe('');
  });
});

describe('the move transplant: the area slot (docs/engine/AREA.md)', () => {
  it("draws a borrowed area move with its fighter's take for it: the core slot its area move names, the special's by default", () => {
    for (const slot of CORE_SLOTS) expect(takeSlotOf('goku', slot)).toBe(slot);
    expect(takeSlotOf('goku', 'area')).toBe(MOVES.goku.area.area?.anim ?? 'special');
    for (const id of FIGHTER_IDS) expect(CORE_SLOTS, id).toContain(takeSlotOf(id, 'area'));
    const was = MOVES.goku.area.area!;
    try { MOVES.goku.area.area = { ...was, anim: 'heavy' }; expect(takeSlotOf('goku', 'area')).toBe('heavy'); } finally { MOVES.goku.area.area = was; }
  });

  it("presents a borrowed area move as its own fighter's: the action, its cast, release and strikes, its name, its donor", () => {
    setActiveKit(kit('endeavor', { area: { from: 'goku' } }));
    const me = player('endeavor', { action: 'area', actionDuration: .62 }), players = [me, player('luffy', { id: 'p2' })];
    expect(borrowedAction(me)).toEqual({ slot: 'area', fighter: 'goku', fromSlot: 'area' });
    for (const kind of ['cast', 'release', 'impact', 'hit'] as const)
      expect(presentEvent(event({ kind, slot: 'area' }), players), kind).toMatchObject({ fighter: 'goku', slot: 'area', body: 'endeavor' });
    expect(slotNames(me, 'area')).toMatchObject({ from: 'goku', fromSlot: 'area', name: MOVES.goku.area.name });
    expect(transplantDonors(players)).toEqual(['goku']);
    setActiveKit(kit('endeavor', { special: { from: 'ace' } }));
    expect(borrowedAction(me)).toBeUndefined();
    expect(presentEvent(event({ kind: 'impact', slot: 'area' }), players)).toMatchObject({ fighter: 'endeavor', slot: 'area' });
  });

  it("plays the source's take for its area move on the body, paced as the area move", () => {
    const scene = new THREE.Group(), rig = rigOf(scene);
    const takes = Object.fromEntries(CORE_SLOTS.map(slot => [slot, { open: { clip: new THREE.AnimationClip(`goku ${slot}`, 1, []), rig, linear: false } }]));
    const body = { take: () => ({ scene, clips: [], clip: undefined, form: undefined }) } as unknown as Fighter;
    resetTakes(); setTakes('goku', takes as Parameters<typeof setTakes>[1]);
    const was = MOVES.goku.area.area!;
    try {
      setActiveKit(kit('endeavor', { area: { from: 'goku' } }));
      const state = player('endeavor', { action: 'area', actionDuration: .62, actionTime: .4 });
      const swap = transplantFor(body, state);
      expect(swap?.clip.name).toBe(`goku ${takeSlotOf('goku', 'area')}`);
      expect(swap?.slot).toBe('area');
      expect(swap?.move.area).toBeTruthy();
      expect(swap?.paced(state)).toMatchObject({ fighter: 'goku', action: 'area' });
      MOVES.goku.area.area = { ...was, anim: 'ultimate' };
      expect(transplantFor(body, state)?.clip.name).toBe('goku ultimate');
    } finally { MOVES.goku.area.area = was; resetTakes(); }
  });
});

describe('the move transplant: sound', () => {
  const owned = (layers: ReturnType<typeof planCombatAudio>, bus: 'voice' | 'sfx') => layers.filter(l => (l.bus ?? 'sfx') === bus).map(l => cueFighter(l.cue));
  it("sounds a borrowed move's effects, in the body's own voice: nothing of the other fighter's voice, no move name", () => {
    setActiveKit(kit('endeavor', { special: { from: 'ace' }, ultimate: { from: 'jotaro' }, heavy: { from: 'goku', fromSlot: 'special' } }));
    const players = [player('endeavor')];
    for (const [slot, id] of [['special', 11], ['ultimate', 12], ['heavy', 13]] as const) {
      const cast = presentEvent(event({ id, slot, actionSeq: id }), players), layers = planCombatAudio(cast, false);
      expect(layers.length, slot).toBeGreaterThan(0);
      for (const owner of owned(layers, 'voice')) expect(owner, `${slot} voice`).toBe('endeavor');
      expect(owned(planCombatAudio({ ...cast, body: undefined }, false), 'voice').some(owner => owner && owner !== 'endeavor'), slot).toBe(true);
    }
  });

  it("keeps the body's own voice for its own moves, and for another of its own slots", () => {
    setActiveKit(kit('saitama', { heavy: { from: 'saitama', fromSlot: 'ultimate' } }));
    const shown = presentEvent(event({ fighter: 'saitama', slot: 'heavy', actionSeq: 4 }), [player('saitama')]);
    expect(shown).toMatchObject({ fighter: 'saitama', slot: 'ultimate', body: 'saitama' });
    expect(borrowedEvent(shown)).toBe(false);
    expect(planCombatAudio(shown, false)).toEqual(planCombatAudio({ ...shown, body: undefined }, false));
  });
});
