import { describe, expect, it } from 'vitest';
import { Targeting } from '../src/game/Targeting';
import type { PlayerState } from '../src/game/types';

const p = (id: string, x = 0, z = 0, extras: Partial<PlayerState> = {}): PlayerState => ({ id, name: id, fighter: 'goku', x, y: 0, z, yaw: 0, hp: 1000, maxHp: 1000,
  stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionTime: 0, actionDuration: 0, target: null, alive: true, isBot: false,
  grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...extras });
const press = (t: Targeting, list: PlayerState[], self: PlayerState, yaw: number, now: number) => { const id = t.cycle(list, self, yaw, now); return t.locked ? id : 'release'; };
const framing = (q: PlayerState, self: PlayerState) => Math.atan2(q.x - self.x, q.z - self.z) + .5;
function run(t: Targeting, list: PlayerState[], self: PlayerState, presses: number, gap = .6, yaw = 0, now = 10) {
  const seen: (string | null)[] = [];
  for (let i = 0; i < presses; i++) {
    seen.push(press(t, list, self, yaw, now += gap));
    const q = list.find(x => x.id === t.id);
    if (t.locked && q) yaw = framing(q, self);
  }
  return seen;
}

describe('Tab: every candidate, round and round', () => {
  it('a fighter at the side of the view and one behind it are both reached, the camera turning to each', () => {
    const self = p('self'), bot = p('bot', .2, 1.1), A = p('A', -2.7, .2), B = p('B', 0, -7), list = [self, bot, A, B];
    const seen = run(new Targeting(), list, self, 6);
    expect(seen[0], 'the middle of the view first').toBe('bot');
    expect(new Set(seen.slice(0, 3)), seen.join(' > ')).toEqual(new Set(['bot', 'A', 'B']));
    expect(seen, 'never a release').not.toContain('release');
  });

  it('a lock held since long ago goes on to everybody else, then round again', () => {
    const self = p('self'), a = p('a', -2, 5), b = p('b', 0, 6), c = p('c', 2.5, 5), list = [self, a, b, c];
    const t = new Targeting();
    let now = 0;
    for (let i = 0; i < 4; i++) press(t, list, self, 0, now += .5);
    const from = t.id!;
    now += 20;
    const next = [1, 2, 3, 4, 5].map(() => press(t, list, self, 0, now += .7));
    expect(new Set(next.slice(0, 2))).toEqual(new Set(['a', 'b', 'c'].filter(x => x !== from)));
    expect(next, 'never a release').not.toContain('release');
    expect(new Set(next)).toEqual(new Set(['a', 'b', 'c']));
    for (let i = 1; i < next.length; i++) expect(next[i]).not.toBe(next[i - 1]);
  });

  it('six presses and more over three opponents: each once, then each once again - never a release', () => {
    const self = p('self'), bot = p('bot', 2.1, 7.1), A = p('A', -3.3, 2.7), B = p('B', .8, .75), list = [self, bot, A, B];
    for (const gap of [.5, .9, 1.8, 4]) {
      const seen = run(new Targeting(), list, self, 9, gap, 0, 100);
      expect(seen, `gap ${gap}: ${seen.join(' > ')}`).not.toContain('release');
      expect(new Set(seen.slice(0, 3)), `gap ${gap}: ${seen.join(' > ')}`).toEqual(new Set(['bot', 'A', 'B']));
      expect(new Set(seen.slice(3, 6)), `gap ${gap}: ${seen.join(' > ')}`).toEqual(new Set(['bot', 'A', 'B']));
      for (let i = 1; i < seen.length; i++) expect(seen[i], 'every press switches').not.toBe(seen[i - 1]);
    }
  });

  it('a fighter who falls mid-run is skipped, and one who arrives joins it', () => {
    const self = p('self'), a = p('a', 0, 4), b = p('b', 2, 4), c = p('c', -2, 4), list = [self, a, b, c];
    const t = new Targeting();
    let now = 0;
    expect(press(t, list, self, 0, now += .5)).toBe('a');
    c.alive = false;
    expect(press(t, list, self, 0, now += .5)).toBe('b');
    const late = p('late', -1, 5);
    list.push(late);
    expect(press(t, list, self, 0, now += .5), 'here now, so in the run').toBe('late');
    expect(press(t, list, self, 0, now += .5), 'c is down: round again').toBe('a');
    c.alive = true;
    const seen = [1, 2, 3, 4, 5].map(() => press(t, list, self, 0, now += .5));
    expect(seen).not.toContain('release');
    expect(seen).toContain('c');
  });

  it('a lone opponent behind the player, or 45 m off, is locked; Tab on the only one there is lets go', () => {
    for (const [x, z] of [[0, -6], [-5, -3], [5, -3], [0, 45]] as const) {
      const self = p('self'), lone = p('lone', x, z), list = [self, lone];
      const t = new Targeting();
      expect(press(t, list, self, 0, 1), `${x},${z}`).toBe('lone');
      expect(press(t, list, self, 0, 1.5), 'the press can only mean off').toBe('release');
      expect(press(t, list, self, 0, 2)).toBe('lone');
    }
    const self = p('self'), near = p('near', 0, 2), far = p('far', 3, 45), list = [self, near, far];
    expect(run(new Targeting(), list, self, 4)).toEqual(['near', 'far', 'near', 'far']);
  });

  it('release() ends the run: the next press starts in the middle', () => {
    const self = p('self'), a = p('a', 0, 4), b = p('b', 3, 4), list = [self, a, b];
    const t = new Targeting();
    expect(press(t, list, self, 0, 1)).toBe('a');
    t.release();
    expect(press(t, list, self, 0, 1.2)).toBe('a');
    expect(press(t, list, self, 0, 1.4)).toBe('b');
  });
});
