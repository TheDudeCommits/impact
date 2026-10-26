import { describe, expect, it } from 'vitest';
import { GamepadControls, padFamily, padLabel, type PadState } from '../src/input/gamepad';
import { padCombatHints, padKey, padName } from '../src/input/glyphs';
import { Rumble, pulseFor } from '../src/input/rumble';
import { nearest, type Box } from '../src/ui/spatialFocus';
import type { CombatEvent } from '../src/game/types';

const DUALSENSE = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
function pad(pressed: number[] = [], axes = [0, 0, 0, 0], id = DUALSENSE): PadState {
  return { index: 0, id, mapping: 'standard', connected: true, axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) };
}

describe('PlayStation controllers', () => {
  it('knows a PlayStation pad by the name any browser gives it', () => {
    for (const id of [DUALSENSE, 'DualSense Wireless Controller', '054c-0ce6-DualSense Wireless Controller',
      'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)', 'DualSense Edge Wireless Controller']) expect(padFamily(id)).toBe('playstation');
    expect(padFamily('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)')).toBe('xbox');
    expect(padFamily('8BitDo Pro 2')).toBe('generic');
    expect(padLabel(DUALSENSE)).toBe('DualSense');
    expect(padLabel('DualSense Edge Wireless Controller')).toBe('DualSense Edge');
    expect(padLabel('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)')).toBe('DualShock 4');
    const frame = new GamepadControls().read(pad(), false);
    expect(frame).toMatchObject({ family: 'playstation', label: 'DualSense' });
  });

  it('wakes on the press that reveals the pad without acting on it', () => {
    const controls = new GamepadControls();
    const first = controls.read(pad([0]), false);
    expect(first.active).toBe(true);
    expect(first.ui).toEqual([]);
    const combat = new GamepadControls().read(pad([2]), true);
    expect(combat.active).toBe(true);
    expect(combat.attack).toBeUndefined();
  });

  it('repeats a held menu direction after a beat, as a console menu does', () => {
    const controls = new GamepadControls();
    controls.read(pad(), false, 0);
    expect(controls.read(pad([15]), false, 100).ui).toEqual(['right']);
    expect(controls.read(pad([15]), false, 300).ui).toEqual([]);
    expect(controls.read(pad([15]), false, 490).ui).toEqual(['right']);
    expect(controls.read(pad([15]), false, 560).ui).toEqual([]);
    expect(controls.read(pad([15]), false, 610).ui).toEqual(['right']);
    const plain = new GamepadControls();
    plain.read(pad(), false);
    expect(plain.read(pad([13]), false).ui).toEqual(['next']);
    expect(plain.read(pad([13]), false).ui).toEqual([]);
  });

  it('never repeats a direction that was already held when the menu opened', () => {
    const controls = new GamepadControls();
    controls.read(pad([], [0, 1, 0, 0]), true, 0);
    for (const now of [16, 500, 1000, 2000]) expect(controls.read(pad([], [0, 1, 0, 0]), false, now).ui).toEqual([]);
    controls.read(pad(), false, 2100);
    expect(controls.read(pad([], [0, 1, 0, 0]), false, 2200).ui).toEqual(['next']);
  });

  it('names buttons the way each pad prints them', () => {
    expect(['south', 'east', 'west', 'north', 'l1', 'r2', 'start'].map(c => padName('playstation', c as never))).toEqual(['✕', '○', '□', '△', 'L1', 'R2', 'OPTIONS']);
    expect(['south', 'east', 'west', 'north', 'l1', 'r2', 'start'].map(c => padName('xbox', c as never))).toEqual(['A', 'B', 'X', 'Y', 'LB', 'RT', 'MENU']);
    expect(padName('generic', 'south')).toBe('A / ✕');
    expect(padKey('playstation', 'south')).toContain('ps-south');
    expect(padKey('playstation', 'r1')).not.toContain('ps-face');
    expect(padKey('xbox', 'south')).not.toContain('ps-face');
    const hints = padCombatHints('playstation');
    for (const words of ['JUMP', 'DASH', 'GUARD', 'LOCK ON', 'PAUSE', '✕', '○', 'L1', 'R3', 'OPTIONS']) expect(hints).toContain(words);
  });
});

describe('menu navigation by position', () => {
  const at = (x: number, y: number, w: number, h: number): Box => ({ left: x, top: y, right: x + w, bottom: y + h });
  const home: Record<string, Box> = {
    players: at(35, 22, 362, 403), bots: at(408, 25, 286, 397), four: at(478, 394, 24, 24), six: at(510, 394, 24, 24), eight: at(542, 394, 24, 24),
    ten: at(574, 394, 24, 24), twelve: at(606, 394, 24, 24), private: at(706, 22, 252, 403), host: at(774, 397, 41, 24), join: at(841, 397, 40, 24),
    training: at(963, 22, 299, 403), arcade: at(1273, 22, 285, 403),
    goku: at(37, 477, 161, 167), naruto: at(204, 477, 158, 167), luffy: at(370, 477, 158, 167), zoro: at(532, 477, 167, 167),
    sanji: at(37, 652, 161, 167), vegeta: at(204, 652, 158, 167), kakashi: at(370, 652, 158, 167), sasuke: at(532, 652, 167, 167),
    jotaro: at(904, 477, 161, 167), ichigo: at(1072, 477, 158, 167), ace: at(1238, 477, 158, 167), law: at(1399, 477, 167, 167),
    gojo: at(904, 652, 161, 167), dio: at(1072, 652, 158, 167), guts: at(1238, 652, 158, 167), killua: at(1399, 652, 167, 167),
    controls: at(1202, 836, 88, 42), options: at(1322, 836, 78, 42), play: at(1432, 828, 129, 56),
  };
  const names = Object.keys(home), boxes = Object.values(home);
  const go = (from: string, direction: 'up' | 'down' | 'left' | 'right') => names[nearest(home[from], boxes, direction)] ?? 'nowhere';

  it('moves between the cards the way they sit on screen', () => {
    expect(go('naruto', 'up')).toBe('players');
    expect(go('players', 'right')).toBe('bots');
    expect(go('bots', 'right')).toBe('private');
    expect(go('arcade', 'right')).toBe('nowhere');
    expect(go('arcade', 'down')).toBe('law');
    expect(go('zoro', 'right')).toBe('jotaro');
    expect(go('jotaro', 'left')).toBe('zoro');
    expect(go('sasuke', 'right')).toBe('gojo');
    expect(go('naruto', 'down')).toBe('vegeta');
    expect(go('killua', 'down')).toBe('play');
    expect(go('play', 'left')).toBe('options');
    expect(go('play', 'up')).toBe('killua');
  });

  it('reaches the controls nested inside a card, and back out of them', () => {
    expect(go('bots', 'down')).toBe('eight');
    expect(go('eight', 'left')).toBe('six');
    expect(go('eight', 'right')).toBe('ten');
    expect(go('eight', 'up')).toBe('bots');
    expect(go('eight', 'down')).toBe('zoro');
    expect(['host', 'join']).toContain(go('private', 'down'));
    expect(go('host', 'right')).toBe('join');
  });
});

describe('controller vibration', () => {
  const event = (kind: CombatEvent['kind'], extra: Partial<CombatEvent> = {}): CombatEvent =>
    ({ id: 1, kind, serverTime: 0, actorId: 'foe', targetId: 'me', ...extra } as CombatEvent);

  it('shakes by what a blow taken was worth, and ticks by what a blow landed was', () => {
    const small = pulseFor(event('hit', { damage: 20 }), 'me')!, big = pulseFor(event('hit', { damage: 240 }), 'me')!;
    expect(big.strong).toBeGreaterThan(small.strong);
    expect(big.ms).toBeGreaterThan(small.ms);
    const jab = pulseFor(event('hit', { actorId: 'me', targetId: 'foe', slot: 'light' }), 'me')!;
    const ultimate = pulseFor(event('hit', { actorId: 'me', targetId: 'foe', slot: 'ultimate' }), 'me')!;
    expect(ultimate.strong).toBeGreaterThan(jab.strong);
    expect(ultimate.weak).toBeGreaterThan(jab.weak);
    expect(pulseFor(event('hit', { actorId: 'a', targetId: 'b' }), 'me')).toBeUndefined();
  });

  it('marks the turns of a fight, and a fall hardest of all', () => {
    expect(pulseFor(event('just-guard'), 'me')).toBeDefined();
    expect(pulseFor(event('guard-break'), 'me')!.strong).toBeGreaterThan(pulseFor(event('blocked'), 'me')!.strong);
    expect(pulseFor(event('awaken', { actorId: 'me', targetId: undefined }), 'me')).toBeDefined();
    expect(pulseFor(event('cast', { actorId: 'me', slot: 'ultimate' }), 'me')).toBeDefined();
    expect(pulseFor(event('cast', { actorId: 'me', slot: 'light' }), 'me')).toBeUndefined();
    expect(pulseFor(event('eliminated'), 'me')).toEqual({ strong: 1, weak: 1, ms: 700 });
    const enemy = (id: string) => id.startsWith('e');
    expect(pulseFor(event('eliminated', { actorId: 'me', targetId: 'e12' }), 'me', enemy)).toBeUndefined();
    expect(pulseFor(event('eliminated', { actorId: 'me', targetId: 'bot-3' }), 'me', enemy)).toBeDefined();
  });

  it('sends one effect per window, and never cuts a big one short with a small one', () => {
    const sent: { duration: number; strongMagnitude: number; weakMagnitude: number }[] = [];
    const actuator = { playEffect: (_type: string, params: { duration: number; strongMagnitude: number; weakMagnitude: number }) => { sent.push(params); return Promise.resolve(); } };
    const rumble = new Rumble();
    rumble.add({ strong: 0, weak: .22, ms: 40 }); rumble.add({ strong: .6, weak: .75, ms: 130 }); rumble.add({ strong: .25, weak: .4, ms: 70 });
    expect(rumble.flush(1000, actuator)).toEqual({ strong: .6, weak: .75, ms: 130 });
    expect(sent).toHaveLength(1);
    rumble.add({ strong: 1, weak: 1, ms: 700 });
    expect(rumble.flush(1020, actuator)).toBeUndefined();
    expect(rumble.flush(1050, actuator)).toEqual({ strong: 1, weak: 1, ms: 700 });
    rumble.add({ strong: 0, weak: .22, ms: 40 });
    expect(rumble.flush(1200, actuator)).toBeUndefined();
    expect(sent).toHaveLength(2);
    rumble.scale = .5; rumble.add({ strong: .8, weak: .8, ms: 100 });
    rumble.flush(3000, actuator);
    expect(sent[2]).toMatchObject({ strongMagnitude: .4, weakMagnitude: .4 });
    rumble.scale = 0; rumble.add({ strong: 1, weak: 1, ms: 100 });
    expect(rumble.flush(4000, actuator)).toBeUndefined();
    expect(sent).toHaveLength(3);
  });

  it('does nothing on a pad or browser that cannot rumble', () => {
    const rumble = new Rumble();
    rumble.add({ strong: 1, weak: 1, ms: 100 });
    expect(rumble.flush(0, undefined)).toBeUndefined();
    expect(rumble.flush(100, {})).toBeUndefined();
  });
});
