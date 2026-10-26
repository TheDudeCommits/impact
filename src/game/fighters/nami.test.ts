import { afterEach, describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../simulation';
import { AIR_RUSH, CHIP, MOVES } from '../moves';
import { AWAKENINGS } from '../awakening';
import { COMBO_KEYS, comboMove } from '../combos';
import type { AttackSlot, PlayerInput } from '../types';

const simulations: ArenaSimulation[] = [];
afterEach(() => simulations.splice(0).forEach(sim => sim.dispose()));
function fixture(distance = 1.8) {
  const sim = new ArenaSimulation({ trainingBot: false, maxStamina: 225 }); simulations.push(sim);
  sim.addPlayer('navigator', 'nami', 'Nami', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('opponent', 'goku', 'Opponent', false, { x: 0, y: 0, z: distance });
  const player = sim.actors.get('navigator')!.state, opponent = sim.actors.get('opponent')!.state;
  player.ultimate = 100;
  let seq = 0;
  const input = (id: string, data: Partial<PlayerInput>) => sim.submitInput(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: id === 'opponent' ? Math.PI : 0, ...data });
  const step = (seconds: number, during?: () => void) => { for (let n = 0; n < Math.ceil(seconds * 60); n++) { during?.(); sim.step(); } };
  return { sim, player, opponent, input, step };
}

describe('Nami laboratory combat authority', () => {
  it('has four distinct authored weather techniques and six manual combo branches', () => {
    expect(new Set(Object.values(MOVES.nami).filter(move => !move.area).map(move => move.name)).size).toBe(4);
    for (const key of COMBO_KEYS) expect(comboMove('nami', key)?.name).toBeTruthy();
    expect(AWAKENINGS.nami.kind).toBe('aura');
    expect(AWAKENINGS.nami.name).toBe('WEATHERIA: WEATHER MASTERY');
    expect(AWAKENINGS.nami.formScale).toBeUndefined();
  });
  it('causes no damage without a manual attack, including while awakened', () => {
    const { player, opponent, input, step } = fixture();
    step(3); expect(opponent.hp).toBe(opponent.maxHp);
    player.awakening = 100; input('navigator', { awaken: true }); step(5);
    expect(player.awakened).toBe(true); expect(opponent.hp).toBe(opponent.maxHp);
  });
  it.each(['light', 'heavy', 'special', 'ultimate'] as AttackSlot[])('%s hits only after its contact and spends its resource', slot => {
    const { sim, player, opponent, input, step } = fixture(slot === 'special' ? 6 : 1.8);
    const move = MOVES.nami[slot], hp = opponent.hp;
    expect(input('navigator', { attack: slot, targetId: 'opponent' })).toBe(true);
    step(Math.max(.02, move.contacts[0] - .04)); expect(opponent.hp).toBe(hp);
    step(move.duration + 1); expect(opponent.hp).toBeLessThan(hp);
    const casts = sim.snapshot().events.filter(event => event.actorId === 'navigator' && event.kind === 'cast');
    expect(casts).toHaveLength(1);
    if (slot === 'ultimate') expect(player.ultimate).toBeLessThan(100);
  });
  it.each(['light', 'heavy', 'special', 'ultimate'] as AttackSlot[])('%s can whiff out of range without remote damage', slot => {
    const { opponent, input, step } = fixture(60);
    input('navigator', { attack: slot, targetId: 'opponent' }); step(MOVES.nami[slot].duration + 2);
    expect(opponent.hp).toBe(opponent.maxHp);
  });
  it('announces three manual aerial staff strikes, without an automatic follow-up', () => {
    const { sim, player, opponent, input } = fixture(1.5);
    for (let frame = 0; frame < 135; frame++) {
      for (const id of ['navigator', 'opponent']) {
        const actor = sim.actors.get(id)!; actor.state.y = 3; actor.state.grounded = false; actor.vy = 0;
      }
      input('navigator', { attack: frame % 4 === 0 && frame < 100 ? 'light' : undefined, targetId: 'opponent' });
      input('opponent', { targetId: 'navigator' }); sim.step();
    }
    const casts = sim.snapshot().events.filter(event => event.kind === 'cast' && event.actorId === player.id);
    expect(casts.slice(0, 3).map(event => event.chain)).toEqual([0, 1, 2]);
    expect(casts.slice(0, 3).map(event => event.move)).toEqual(AIR_RUSH.nami);
    expect(opponent.hp).toBeLessThan(opponent.maxHp);
  });
  it('a held guard can stop an ordinary Clima-Tact Thrust', () => {
    const { sim, opponent, input, step } = fixture();
    step(.4, () => input('opponent', { guard: true }));
    input('navigator', { attack: 'light', targetId: 'opponent' });
    step(1.2, () => input('opponent', { guard: true }));
    expect(opponent.hp).toBe(opponent.maxHp - Math.round(MOVES.nami.light.damage * CHIP.light));
    expect(sim.snapshot().events.some(event => event.kind === 'blocked' && event.targetId === 'opponent')).toBe(true);
  });
});
