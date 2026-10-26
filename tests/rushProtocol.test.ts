import { describe, expect, it } from 'vitest';
import { healthReport, MOVEMENT_PROTOCOL } from '../src/server/health';
import { LIGHT_CHASE_WINDOW, MOVES, RUSH, RUSH_STAGES, RUSH_WINDOW } from '../src/game/moves';
import type { FighterId } from '../src/game/types';

describe('the rush protocol', () => {
  it('is a new movement protocol', () => {
    expect(MOVEMENT_PROTOCOL).toBe('omni-sequenced-input-v76-duel-seats');
    expect(healthReport().movementProtocol).toBe(MOVEMENT_PROTOCOL);
    expect(healthReport().lightChaseWindow).toBe(LIGHT_CHASE_WINDOW);
    expect(healthReport()).toMatchObject({riftWar:true,riftProtocol:3,riftSnapshotHz:20});
  });

  it('still reports every move\'s timing, and now every rush stage\'s', () => {
    const health = JSON.parse(JSON.stringify(healthReport('test')));
    expect(health.revision).toBe('test');
    expect(health.rushStages).toBe(RUSH_STAGES);
    expect(health.rushWindow).toBe(RUSH_WINDOW);
    for (const fighter of Object.keys(MOVES) as FighterId[]) {
      for (const [slot, move] of Object.entries(MOVES[fighter])) {
        expect(health.combatTimings[fighter][slot], `${fighter} ${slot}`).toEqual({ duration: move.duration, contacts: move.contacts });
      }
      expect(health.combatTimings[fighter].rush).toEqual(RUSH[fighter].map(move => ({ duration: move.duration, contacts: move.contacts })));
      expect(health.combatTimings[fighter].rush).toHaveLength(RUSH_STAGES - 1);
    }
  });
});
