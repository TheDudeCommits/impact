import { describe, expect, it } from 'vitest';
import { leaderCalled } from './PartyUI';

const view = (name: string) => ({ leader: 'a', members: [{ id: 'a', name }, { id: 'b', name: 'Bea' }] }) as never;

describe("the party's lines about its leader (overnight UX, 8 October 2026)", () => {
  it('names a leader who chose a name', () => {
    expect(leaderCalled(view('Kirin'))).toBe('Kirin');
  });
  it("says THE LEADER while the leader kept the name box's default, never FIGHTER CHOOSES", () => {
    expect(leaderCalled(view('Fighter'))).toBe('The leader');
    expect(leaderCalled(view('  '))).toBe('The leader');
    expect(leaderCalled(view('Fighter'), 'your leader')).toBe('your leader');
  });
});
