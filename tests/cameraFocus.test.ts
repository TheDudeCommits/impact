import { describe, expect, it } from 'vitest';
import { CameraFocus, DWELL, PINGPONG, REST, URGENT_DWELL } from '../src/render/CameraFocus';
import { castMove } from '../src/render/ThreatOutline';
import type { ActionKind, CombatEvent, FighterId, PlayerState } from '../src/game/types';


const DT = 1 / 60;
const p = (id: string, x = 0, z = 0, extras: Partial<PlayerState> = {}): PlayerState => ({ id, name: id, fighter: 'luffy', x, y: 0, z, yaw: 0, hp: 1000, maxHp: 1000,
  stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionTime: 0, actionDuration: 0, target: null, alive: true, isBot: false,
  grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...extras });
function attack(who: PlayerState, slot: ActionKind, seconds: number) {
  who.action = slot; who.target = 'me';
  const move = castMove(who as never)!;
  who.actionDuration = move.duration; who.actionTime = seconds / move.duration;
}
const idle = (who: PlayerState) => { who.action = 'idle'; who.actionTime = 0; who.target = null; };
function run(f: CameraFocus, list: PlayerState[], me: PlayerState, seconds: number, each?: (t: number) => void, view = { yaw: 0 }, follow = true, events: CombatEvent[] = [], lock: string | null = null) {
  const seen: (string | null)[] = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    each?.(t);
    const id = f.update(DT, list, me, view.yaw, events, lock);
    if (follow && id) { const q = list.find(x => x.id === id)!; view.yaw = Math.atan2(q.x - me.x, q.z - me.z); }
    seen.push(id);
  }
  return seen;
}
const changes = (seen: (string | null)[]) => seen.filter((id, i) => i > 0 && id !== seen[i - 1]).length;

describe('the camera\'s focus: who the shot is about', () => {
  it('takes the nearest opponent in front of the view, and keeps it', () => {
    const me = p('me'), near = p('near', .5, 3), far = p('far', -6, 9), list = [me, near, far];
    const seen = run(new CameraFocus(), list, me, 2);
    expect(seen.at(-1)).toBe('near'); expect(changes(seen)).toBe(0);
  });
  it('fighters taking turns at the player do not hand the shot back and forth with every swing', () => {
    const me = p('me'), a = p('a', -1.6, 1.4), b = p('b', 1.6, 1.4), list = [me, a, b];
    const f = new CameraFocus();
    const seen = run(f, list, me, 12, t => {
      const turn = Math.floor(t / .9) % 2, into = t % .9;
      const [on, off] = turn ? [b, a] : [a, b];
      attack(on, 'light', Math.min(into, .3)); idle(off);
    });
    expect(changes(seen), seen.filter((id, i) => !i || id !== seen[i - 1]).join(' > ')).toBeLessThanOrEqual(3);
  });
  it('a challenger has to matter more for DWELL seconds, and never within REST of the last change', () => {
    const me = p('me'), a = p('a', 0, 3), b = p('b', 2.2, 2.4), list = [me, a, b];
    const f = new CameraFocus();
    run(f, list, me, 1);
    expect(f.id).toBe('a');
    const seen = run(f, list, me, DWELL * .8, () => attack(b, 'heavy', .05));
    expect(seen.at(-1), 'not yet').toBe('a');
    expect(f.pending).toBe('b'); expect(f.pendingShare).toBeGreaterThan(.5);
    run(f, list, me, DWELL * .5, () => attack(b, 'heavy', .05));
    expect(f.id).toBe('b');
    idle(b);
    const back = run(f, list, me, REST * .9, () => attack(a, 'heavy', .05));
    expect(back.every(id => id === 'b'), 'not straight back').toBe(true);
  });
  it('a blow about to land from somebody out of the view takes the shot at once', () => {
    const me = p('me'), front = p('front', 0, 4), behind = p('behind', -.8, -1.8), list = [me, front, behind];
    const f = new CameraFocus(), view = { yaw: 0 };
    run(f, list, me, 1.5, undefined, view, false);
    expect(f.id).toBe('front');
    const heavy = castMove({ fighter: 'luffy', action: 'heavy', actionTime: 0, actionDuration: 1 } as never)!;
    const seen = run(f, list, me, URGENT_DWELL + 3 * DT, () => attack(behind, 'heavy', Math.max(0, heavy.contacts[0] - .1)), view, false);
    expect(seen.at(-1)).toBe('behind'); expect(f.urgent).toBe(true);
  });
  it('mid-string on the one framed, an attacker in view does not take the shot; one that cannot be blocked, unseen, does', () => {
    const me = p('me', 0, 0, { action: 'light', target: 'a' }), a = p('a', 0, 1.6), b = p('b', 1.5, 1.5), c = p('c', .5, -2), list = [me, a, b, c];
    const f = new CameraFocus(), view = { yaw: 0 };
    run(f, list, me, .5, undefined, view, false);
    expect(f.id).toBe('a');
    const heavy = castMove({ fighter: 'luffy', action: 'heavy', actionTime: 0, actionDuration: 1 } as never)!;
    expect(run(f, list, me, 2, () => attack(b, 'heavy', heavy.contacts[0] - .05), view, false).every(id => id === 'a')).toBe(true);
    idle(b);
    c.fighter = 'ace';
    run(f, list, me, URGENT_DWELL + 3 * DT, () => attack(c, 'special', .1), view, false);
    expect(f.id).toBe('c');
  });
  it('a finishing opportunity outweighs a fresher opponent the same distance off', () => {
    const me = p('me'), fresh = p('fresh', -1.4, 3.2), weak = p('weak', 1.4, 3.2, { hp: 90 }), list = [me, fresh, weak];
    const f = new CameraFocus();
    run(f, list, me, 1);
    expect(f.id).toBe('weak');
    expect(f.scores.get('weak')!).toBeGreaterThan(f.scores.get('fresh')!);
  });
  it('whoever has just hit the player matters for a few seconds', () => {
    const me = p('me'), a = p('a', -1, 3), b = p('b', 2.5, 3), list = [me, a, b];
    const f = new CameraFocus();
    run(f, list, me, 1);
    const before = f.scores.get('b')!;
    const hit: CombatEvent = { id: 1, kind: 'hit', actorId: 'b', targetId: 'me', serverTime: 1 } as CombatEvent;
    f.update(DT, list, me, 0, [hit], null);
    expect(f.scores.get('b')!).toBeGreaterThan(before + .5);
  });
  it('a Tab lock is the shot whatever the scores; the one framed falling hands it on at once', () => {
    const me = p('me'), a = p('a', 0, 3), b = p('b', 3, 3), list = [me, a, b];
    const f = new CameraFocus();
    run(f, list, me, .5);
    expect(f.update(DT, list, me, 0, [], 'b')).toBe('b');
    a.alive = false;
    expect(run(new CameraFocus(), list, me, DT * 2).at(-1)).toBe('b');
    const g = new CameraFocus(); a.alive = true; run(g, list, me, .5); a.alive = false;
    expect(g.update(DT, list, me, 0, [], null)).toBe('b');
  });
  it('the scores change nothing allocated: the same maps every frame', () => {
    const me = p('me'), list = [me, p('a', 0, 3), p('b', 2, 3)], f = new CameraFocus();
    run(f, list, me, .2);
    const scores = f.scores;
    run(f, list, me, .2);
    expect(f.scores).toBe(scores);
    expect(PINGPONG).toBeGreaterThan(REST);
  });
  it('never selects a defender or village post, and expires retired wave histories', () => {
    const me=p('me',0,0,{team:'defenders'}),ally=p('ally',0,1,{team:'defenders'}),f=new CameraFocus();
    for(let i=0;i<5000;i++){
      const foe=p(`wave-${i}`,0,2,{team:'horde'});attack(foe,'light',.05);
      const events=[{id:i*2+1,kind:'hit',actorId:foe.id,targetId:me.id},{id:i*2+2,kind:'hit',actorId:me.id,targetId:foe.id}] as CombatEvent[];
      expect(f.update(.25,[me,ally,foe],me,0,events,null)).toBe(foe.id);
      expect(f.scores.has(ally.id)).toBe(false);
    }
    expect(f.historyEntries).toBeLessThan(120);
    for(let i=0;i<60;i++)f.update(.25,[me,ally],me,0,[],null);
    expect(f.historyEntries).toBe(0);expect(f.id).toBe(null);
  });
});
