import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIGHTERS } from '../../config';
import type { CombatEvent, FighterId, GameSnapshot, PlayerState } from '../../game/types';
import { commandList } from '../commandList';
import { rankPlayers } from '../hudMath';
import { readEdge, stack, type EdgeRead } from './EdgeMarkers';
import { callName } from './mainHudKit';
import { MODE_HUDS } from './registry';
import { FallOrder, feedLine, finalCall } from './royaleField';
import { stickSector, STICK_ARROWS } from './trainingInputs';
import { ComboTracker, DEFENCE_TRIALS, defenceTrialOf, trialOf, trialsFor } from './trainingTrials';

const player = (id: string, extra: Partial<PlayerState> = {}) => ({ id, name: 'Fighter', fighter: 'naruto', isBot: false, alive: true, kills: 0, damageDealt: 0, ...extra }) as PlayerState;
const hit = (extra: Partial<CombatEvent>) => ({ id: 1, kind: 'hit', serverTime: 0, actorId: 'me', targetId: 'dummy', ...extra }) as CombatEvent;
const unescape = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

describe('WP2: the training move trials', () => {
  it('are the command list, row for row and press for press, for every fighter - DEFENCE included', () => {
    for (const id of Object.keys(FIGHTERS) as FighterId[]) {
      const html = commandList(id, 'keyboard', 'generic');
      const rows = [...html.matchAll(/<li class="cmd-row[^"]*">(.*?)<\/li>/g)].map(m => m[1]);
      const names = rows.map(row => unescape(/<span class="cmd-name">(.*?)<\/span>/.exec(row)![1]));
      const presses = rows.map(row => (row.match(/<kbd>/g) ?? []).length);
      const trials = trialsFor(id);
      expect([...trials.map(t => t.name), ...DEFENCE_TRIALS.map(t => t.name)], id).toEqual(names);
      expect([...trials.map(t => t.inputs.length), ...DEFENCE_TRIALS.map(t => t.keyed ? 1 : 0)], id).toEqual(presses);
    }
  });
  it('tick from what was pressed: the stage, the ender, the air, the awakening', () => {
    expect(trialOf(hit({ slot: 'light', chain: 0 }), false)).toBe('string-0');
    expect(trialOf(hit({ slot: 'light', chain: 3 }), false)).toBe('string-3');
    expect(trialOf(hit({ slot: 'light', chain: 1 }), true)).toBe('air-1');
    expect(trialOf(hit({ slot: 'heavy', branch: 'llh' }), false)).toBe('llh');
    expect(trialOf(hit({ slot: 'special', branch: 'airSpecial' }), true)).toBe('airSpecial');
    expect(trialOf(hit({ slot: 'heavy' }), false)).toBe('heavy');
    expect(trialOf(hit({ slot: 'ultimate' }), false)).toBe('ultimate');
    expect(trialOf(hit({ slot: 'area' }), false)).toBe('area');
    expect(trialOf(hit({ kind: 'awaken' }), false)).toBe('awaken');
    expect(trialOf(hit({ kind: 'blocked', slot: 'heavy' }), false)).toBeUndefined();
    expect(trialOf(hit({ slot: 'light' }), false)).toBeUndefined();
  });
  it('DEFENCE ticks on the player\'s own block, parry and guard break (PARRY\'s events)', () => {
    expect(DEFENCE_TRIALS.map(t => t.id)).toEqual(['block', 'parry', 'break']);
    expect(defenceTrialOf(hit({ kind: 'blocked', actorId: 'dummy', targetId: 'me' }), 'me')).toBe('block');
    expect(defenceTrialOf(hit({ kind: 'just-guard', actorId: 'dummy', targetId: 'me', reason: 'deflect' }), 'me')).toBe('parry');
    expect(defenceTrialOf(hit({ kind: 'guard-break', actorId: 'me', targetId: 'dummy' }), 'me')).toBe('break');
    expect(defenceTrialOf(hit({ kind: 'blocked', actorId: 'me', targetId: 'dummy' }), 'me')).toBeUndefined();
    expect(defenceTrialOf(hit({ kind: 'just-guard', actorId: 'me', targetId: 'dummy' }), 'me')).toBeUndefined();
    expect(defenceTrialOf(hit({ kind: 'guard-break', actorId: 'dummy', targetId: 'me' }), 'me')).toBeUndefined();
    expect(defenceTrialOf(hit({ kind: 'hit', actorId: 'dummy', targetId: 'me' }), 'me')).toBeUndefined();
  });
  it('every trial id is one a landed blow can produce', () => {
    const reachable = new Set(['heavy', 'special', 'area', 'ultimate', 'awaken', 'lh', 'llh', 'lllh', 'llls', 'airHeavy', 'airSpecial',
      ...[0, 1, 2, 3].flatMap(c => [`string-${c}`, `air-${c}`])]);
    for (const id of Object.keys(FIGHTERS) as FighterId[]) for (const t of trialsFor(id)) expect(reachable.has(t.id), `${id} ${t.id}`).toBe(true);
  });
});

describe('WP2: the combo readout', () => {
  it('follows the simulation\'s own strings, and keeps the best', () => {
    const c = new ComboTracker();
    c.hit(1, 30, 1); c.hit(2, 30, 1.2); c.hit(3, 50, 1.5);
    expect([c.hits, c.damage, c.bestHits, c.bestDamage]).toEqual([3, 110, 3, 110]);
    c.hit(1, 20, 5);
    expect([c.hits, c.damage, c.bestHits, c.bestDamage]).toEqual([1, 20, 3, 110]);
    c.hit(undefined, 7, 5.5); expect(c.damage).toBe(27);
    c.hit(undefined, 7, 9); expect(c.damage).toBe(27);
  });
});

describe('WP2: the battle royale field', () => {
  const players = [player('me', { fighter: 'naruto' }), player('bot1', { fighter: 'sasuke', isBot: true, name: 'Rival' }), player('p2', { fighter: 'luffy', name: 'Kirin' })];
  it('words the kill feed: bots by fighter, people by name, the player as YOU, a fall with no killer alone', () => {
    expect(feedLine({ id: 1, kind: 'eliminated', serverTime: 0, actorId: 'bot1', targetId: 'p2' }, players, 'me')).toEqual({ killer: 'SASUKE', victim: 'KIRIN', mine: false });
    expect(feedLine({ id: 2, kind: 'eliminated', serverTime: 0, actorId: 'me', targetId: 'bot1' }, players, 'me')).toEqual({ killer: 'YOU', victim: 'SASUKE', mine: true });
    expect(feedLine({ id: 3, kind: 'eliminated', serverTime: 0, actorId: 'water', targetId: 'me' }, players, 'me')).toEqual({ killer: '', victim: 'YOU', mine: true });
    expect(feedLine({ id: 4, kind: 'hit', serverTime: 0, actorId: 'me', targetId: 'bot1' }, players, 'me')).toBeUndefined();
  });
  it('calls FINAL 3 and FINAL 2 once each, from a field big enough', () => {
    expect(finalCall(4, 6, 9)).toBeUndefined();
    expect(finalCall(3, 6, 9)).toBe(3);
    expect(finalCall(3, 6, 3)).toBeUndefined();
    expect(finalCall(2, 6, 3)).toBe(2);
    expect(finalCall(2, 6, 2)).toBeUndefined();
    expect(finalCall(3, 3, 9)).toBeUndefined();
    expect(finalCall(2, 3, 9)).toBe(2);
    expect(finalCall(2, 2, 9)).toBeUndefined();
  });
  it('places a knocked-out player as the results card will', () => {
    const fall = new FallOrder();
    const snap = (alive: Record<string, boolean>, status = 'active') => ({ status, winnerId: null, players: ['me', 'a', 'b', 'c'].map(id => player(id, { alive: alive[id] ?? true, damageDealt: id.charCodeAt(0) })) }) as unknown as GameSnapshot;
    fall.update(snap({}));
    fall.update(snap({ a: false }));
    fall.update(snap({ a: false, me: false }));
    const later = snap({ a: false, me: false, b: false });
    fall.update(later);
    expect(fall.place(later, 'me')).toEqual({ place: 3, of: 4 });
    expect(rankPlayers(later.players, null, fall.fallen).findIndex(p => p.id === 'me') + 1).toBe(3);
    fall.update(snap({}, 'waiting')); expect(fall.fallen).toEqual([]);
  });
  it('names YOU, people and bots the same way everywhere', () => {
    const name = (id: string) => FIGHTERS[id as FighterId].name;
    expect(callName(player('me'), 'me', name)).toBe('YOU');
    expect(callName(player('x', { name: 'Fighter', fighter: 'zoro' }), 'me', name)).toBe('ZORO');
    expect(callName(player('x', { name: 'kai', fighter: 'zoro' }), 'me', name)).toBe('KAI');
    expect(callName(player('x', { name: 'Rival', fighter: 'zoro', isBot: true }), 'me', name)).toBe('ZORO');
  });
});

describe('WP2: edge markers', () => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 500);
  camera.position.set(0, 2, 6); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const read = (): EdgeRead => ({ onScreen: false, side: 1, height: .5, behind: false });
  it('reads a fighter in front as on screen, and one behind or far to a side as off it', () => {
    expect(readEdge(camera, 0, 1, 0, read()).onScreen).toBe(true);
    const behind = readEdge(camera, 1, 1, 14, read());
    expect(behind.onScreen).toBe(false); expect(behind.behind).toBe(true); expect(behind.side).toBe(1);
    const left = readEdge(camera, -30, 1, 0, read());
    expect(left.onScreen).toBe(false); expect(left.behind).toBe(false); expect(left.side).toBe(-1);
    expect(left.height).toBeGreaterThan(.2); expect(left.height).toBeLessThan(.8);
  });
  it('stacks markers on one edge without overlap, inside the band', () => {
    const tops = [100, 104, 300, 0], order = [0, 0, 0, 0];
    stack(tops, order, 3, 40, 80, 260);
    const placed = tops.slice(0, 3).sort((a, b) => a - b);
    expect(placed[0]).toBeGreaterThanOrEqual(80); expect(placed[2]).toBeLessThanOrEqual(260);
    expect(placed[1] - placed[0]).toBeGreaterThanOrEqual(40); expect(placed[2] - placed[1]).toBeGreaterThanOrEqual(40);
  });
});

describe('WP2: the input display and the modules', () => {
  it('reads the stick in eight ways, nothing inside the dead zone', () => {
    expect(stickSector(0, 0)).toBe(-1);
    expect(STICK_ARROWS[stickSector(1, 0)]).toBe('→');
    expect(STICK_ARROWS[stickSector(0, 1)]).toBe('↓');
    expect(STICK_ARROWS[stickSector(-1, 0)]).toBe('←');
    expect(STICK_ARROWS[stickSector(0, -1)]).toBe('↑');
    expect(STICK_ARROWS[stickSector(.7, -.7)]).toBe('↗');
  });
  it('builds the three main-game modules without touching the page', () => {
    for (const id of ['duel', 'royale', 'training'] as const) {
      const module = MODE_HUDS[id]();
      expect(typeof module.mount).toBe('function'); expect(typeof module.event).toBe(id === 'duel' ? 'undefined' : 'function');
    }
  });
});
