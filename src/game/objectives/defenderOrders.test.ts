import { describe, expect, it } from 'vitest';
import { ObjectiveMatch } from './ObjectiveMatch';
import { defenderOrders } from './defenderOrders';
import { Teamwork } from './teamwork';
import type { CombatEvent } from '../types';

describe('Last Stand squad duties', () => {
  it('commits one rescuer while covering separate lanes and respects a human already rescuing', () => {
    const game = new ObjectiveMatch('last-stand', undefined, 7, 'bots');
    try {
      game.add('you', 'naruto', 'You'); game.start(); for (let i = 0; i < 181; i++) game.step();
      const seat = game.seats.get('you')!; seat.down = true; game.sim.actors.get('you')!.state.alive = false;
      game.sim.addPlayer('west', 'dio', 'West', false, { x: -17, y: 0, z: 12 }); game.sim.setTeam('west', 'horde');
      game.sim.addPlayer('east', 'dio', 'East', false, { x: 17, y: 0, z: 12 }); game.sim.setTeam('east', 'horde');
      game.siege!.view.pressure = [{ lane: 0, level: 3, targets: ['west'], x: -17, z: 16, structure: 'village-west' }, { lane: 2, level: 3, targets: ['east'], x: 17, z: 16, structure: 'village-east' }];
      const orders = defenderOrders(game.sim.playerStates(), game.snapshot().objective);
      expect([...orders.values()].filter(o => o.role === 'rescue')).toHaveLength(1);
      expect(new Set([...orders.values()].filter(o => o.role === 'intercept').map(o => o.target)).size).toBe(2);
    } finally { game.dispose(); }
  });
  it('credits recent shared takedowns once, excluding the killer and stale damage', () => {
    const game = new ObjectiveMatch('bad-blood', undefined, 4, 'bots');
    try {
      game.add('you', 'naruto', 'You'); game.start(); const players = game.sim.playerStates();
      const ally = players.find(p => p.team === 'heroes' && p.id !== 'you')!, enemy = players.find(p => p.team === 'villains')!;
      const tracker = new Teamwork(), credits: string[] = [];
      const hit = (actorId: string, kind: CombatEvent['kind'] = 'hit'): CombatEvent => ({ id: 1, serverTime: 0, actorId, targetId: enemy.id, kind, damage: 20 });
      tracker.update([hit('you'), hit(ally.id)], players, 1, id => credits.push(id));
      tracker.update([hit(ally.id, 'eliminated'), hit(ally.id, 'eliminated')], players, 2, id => credits.push(id));
      expect(credits).toEqual(['you']);
      tracker.update([hit('you')], players, 3, id => credits.push(id));
      tracker.update([hit(ally.id, 'eliminated')], players, 20, id => credits.push(id)); expect(credits).toEqual(['you']);
    } finally { game.dispose(); }
  });
  it('chooses the reachable rescuer instead of the one across a solid gate wall', () => {
    const game = new ObjectiveMatch('last-stand', undefined, 7, 'host');
    try {
      game.add('fallen', 'naruto', 'Fallen');
      game.add('across-wall', 'goku', 'Across wall', 'defenders', true);
      game.add('same-side', 'vegeta', 'Same side', 'defenders', true);
      game.view.phase = 'active';
      game.sim.place('fallen', { x: 15, y: 0, z: 24 });
      game.sim.place('across-wall', { x: 15, y: 0, z: 16 });
      game.sim.place('same-side', { x: 0, y: 0, z: 24 });
      game.seats.get('fallen')!.down = true; game.sim.actors.get('fallen')!.state.alive = false;
      const orders = defenderOrders(game.sim.playerStates(), game.snapshot().objective);
      expect(orders.get('same-side')).toEqual({ role: 'rescue', target: 'fallen' });
      expect(orders.get('across-wall')?.role).not.toBe('rescue');
    } finally { game.dispose(); }
  });
  it('covers both endangered lanes when several distinct enemies share the nearer lane', () => {
    const game = new ObjectiveMatch('last-stand', undefined, 7, 'bots');
    try {
      game.add('you', 'naruto', 'You'); game.start(); game.view.phase = 'active';
      for (const seat of game.seats.values()) game.sim.place(seat.id, { x: 12, y: 0, z: 12 });
      for (const [id, x] of [['east-1', 16], ['east-2', 18], ['east-3', 20], ['west', -17]] as const) {
        game.sim.addPlayer(id, 'dio', id, false, { x, y: 0, z: 14 }); game.sim.setTeam(id, 'horde');
      }
      game.siege!.view.pressure = [
        { lane: 0, level: 3, targets: ['west'], x: -17, z: 16, structure: 'village-west' },
        { lane: 2, level: 3, targets: ['east-1', 'east-2', 'east-3'], x: 17, z: 16, structure: 'village-east' },
      ];
      const orders = defenderOrders(game.sim.playerStates(), game.snapshot().objective);
      expect(new Set([...orders.values()].map(order => order.lane))).toEqual(new Set([0, 2]));
    } finally { game.dispose(); }
  });
  it('keeps the committed rescuer when another bot becomes only slightly closer', () => {
    const game = new ObjectiveMatch('last-stand', undefined, 7, 'host');
    try {
      game.add('fallen', 'naruto', 'Fallen');
      game.add('committed', 'goku', 'Committed', 'defenders', true);
      game.add('passing', 'vegeta', 'Passing', 'defenders', true);
      game.view.phase = 'active';
      game.sim.place('fallen', { x: 0, y: 0, z: 10 });
      game.sim.place('committed', { x: 7, y: 0, z: 10 });
      game.sim.place('passing', { x: 6, y: 0, z: 10 });
      game.seats.get('fallen')!.down = true; game.sim.actors.get('fallen')!.state.alive = false;
      const orders = defenderOrders(game.sim.playerStates(), game.snapshot().objective, new Map([['committed', { role: 'rescue', target: 'fallen' }]]));
      expect(orders.get('committed')?.role).toBe('rescue');
      expect(orders.get('passing')?.role).not.toBe('rescue');
    } finally { game.dispose(); }
  });
  it('a nearby human on another floor does not cancel a rescue', () => {
    const game = new ObjectiveMatch('last-stand', undefined, 7, 'host');
    try {
      game.add('fallen', 'naruto', 'Fallen'); game.add('jumping', 'goku', 'Jumping');
      game.add('helper', 'vegeta', 'Helper', 'defenders', true);
      game.view.phase = 'active';
      game.sim.place('fallen', { x: 0, y: 0, z: 10 }); game.sim.place('jumping', { x: 0, y: 5, z: 10 });
      game.seats.get('fallen')!.down = true; game.sim.actors.get('fallen')!.state.alive = false;
      expect(defenderOrders(game.sim.playerStates(), game.snapshot().objective).get('helper')?.role).toBe('rescue');
    } finally { game.dispose(); }
  });
});
