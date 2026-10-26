import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, FixedTimestepCallback, Room } from 'colyseus';
import { ArenaRoom } from '../src/server/ArenaRoom';
import { ObjectiveRoom } from '../src/server/objectives/ObjectiveRoom';
import { SurvivalRoom } from '../src/server/SurvivalRoom';
import { CLEAN_SECONDS, FAULT_CLOSE_CODE, FAULT_MESSAGE, FAULT_SECONDS } from '../src/server/RoomFaults';

const TOKEN = '01234567-89ab-cdef-0123-456789abcdef';
type Mock = Client & { send: ReturnType<typeof vi.fn>; sendBytes: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
const client = (sessionId: string) => ({ sessionId, send: vi.fn(), sendBytes: vi.fn(), error: vi.fn(), leave: vi.fn() } as unknown as Mock);
let now = 0;
afterEach(() => vi.restoreAllMocks());

async function fixture<R extends ArenaRoom | ObjectiveRoom | SurvivalRoom>(room: R, options: Record<string, unknown>) {
  let step!: FixedTimestepCallback, tick = 0;
  const base = room as unknown as Room;
  now = 1000; vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(base, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(base, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(base, 'broadcast').mockImplementation(() => {}); vi.spyOn(base, 'lock').mockResolvedValue(undefined); vi.spyOn(base, 'unlock').mockResolvedValue(undefined);
  vi.spyOn(base, 'setFixedTimestep').mockImplementation(callback => { step = callback; });
  const disconnect = vi.spyOn(base, 'disconnect').mockResolvedValue(undefined as never);
  await room.onCreate({rosterProtocol:ROSTER_PROTOCOL,...options} as never);
  const advance = (n = 1) => { for (let i = 0; i < n; i++) { now += 1000 / 60; step({ dt: 1 / 60, dtMs: 1000 / 60, tick: tick++, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); } };
  return { room, advance, disconnect };
}
const snapshots = (c: Mock) => c.send.mock.calls.filter(([type]) => type === 'snapshot').length + c.sendBytes.mock.calls.filter(([type]) => type === 'frame').length;

describe('a room that faults', () => {
  it('logs the first fault, keeps its clock and its snapshots going, and closes with a message only if it keeps faulting', async () => {
    const { room, advance, disconnect } = await fixture(new ArenaRoom(), { mode: 'training' });
    try {
      const c = client('a'); room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, fighter: 'goku', name: 'Tester' });
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const step = vi.spyOn(room.simulation, 'step').mockImplementation(() => { throw new Error('planted tick fault'); });
      let before = snapshots(c);
      expect(() => advance(60)).not.toThrow();
      expect(errors).toHaveBeenCalledTimes(1);
      expect(String(errors.mock.calls[0][0])).toMatch(/step failed; the room keeps running/);
      expect(step).toHaveBeenCalledTimes(60);
      expect(snapshots(c) - before).toBeGreaterThan(0);
      expect(disconnect).not.toHaveBeenCalled();
      advance(Math.ceil((FAULT_SECONDS - 1) * 60) + 2);
      expect(disconnect).toHaveBeenCalledWith(FAULT_CLOSE_CODE);
      expect(c.error).toHaveBeenCalledWith(FAULT_CLOSE_CODE, FAULT_MESSAGE);
      const calls = step.mock.calls.length; before = snapshots(c);
      advance(30);
      expect(step.mock.calls.length).toBe(calls); expect(snapshots(c)).toBe(before);
    } finally { room.onDispose(); }
  });

  it('carries on through faults now and then: a clean half second between them starts the count again', async () => {
    const { room, advance, disconnect } = await fixture(new ArenaRoom(), { mode: 'training' });
    try {
      const c = client('a'); room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, fighter: 'goku', name: 'Tester' });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const real = room.simulation.step.bind(room.simulation);
      let n = 0;
      vi.spyOn(room.simulation, 'step').mockImplementation((...args) => { if (n++ % Math.ceil((CLEAN_SECONDS + .1) * 60) === 0) throw new Error('planted'); return real(...args); });
      const before = room.simulation.tick;
      advance(FAULT_SECONDS * 60 * 3);
      expect(disconnect).not.toHaveBeenCalled();
      expect(room.simulation.tick - before).toBeGreaterThan(FAULT_SECONDS * 60 * 2);
    } finally { room.onDispose(); }
  });

  it('contains a throw in a message handler (onUncaughtException) without closing the room', async () => {
    const { room, advance, disconnect } = await fixture(new ArenaRoom(), { mode: 'training' });
    try {
      const c = client('a'); room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, fighter: 'goku', name: 'Tester' });
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(room.simulation, 'trainingCommand').mockImplementation(() => { throw new Error('planted handler fault'); });
      const events = (room as unknown as { onMessageEvents: { emit(type: string, ...args: unknown[]): void } }).onMessageEvents;
      for (let i = 0; i < 20; i++) expect(() => events.emit('training', c, 'boom')).not.toThrow();
      expect(errors.mock.calls.length).toBeGreaterThan(0); expect(errors.mock.calls.length).toBeLessThan(20);
      expect(String(errors.mock.calls[0][0])).toMatch(/onMessage 'training' threw; contained/);
      expect((errors.mock.calls[0][1] as Error).message).toBe('planted handler fault');
      const before = snapshots(c);
      advance(FAULT_SECONDS * 60 + 10);
      expect(disconnect).not.toHaveBeenCalled(); expect(snapshots(c)).toBeGreaterThan(before);
    } finally { room.onDispose(); }
  });

  it('guards the team modes\' step and snapshots the same way', async () => {
    const { room, advance, disconnect } = await fixture(new ObjectiveRoom(), { objective: 'last-stand', access: 'host', creationToken: TOKEN });
    try {
      const c = client('a'); room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, objective: 'last-stand', creationToken: TOKEN, fighter: 'goku', name: 'Tester' });
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(room.game, 'step').mockImplementation(() => { throw new Error('planted tick fault'); });
      expect(() => advance(30)).not.toThrow();
      expect(errors).toHaveBeenCalledTimes(1);
      vi.spyOn(room.game, 'snapshot').mockImplementation(() => { throw new Error('planted snapshot fault'); });
      expect(() => advance(FAULT_SECONDS * 60)).not.toThrow();
      expect(disconnect).toHaveBeenCalledWith(FAULT_CLOSE_CODE); expect(c.error).toHaveBeenCalledWith(FAULT_CLOSE_CODE, FAULT_MESSAGE);
    } finally { room.onDispose(); }
  });

  it('keeps a co-op run\'s frames going through a fault in its rules', async () => {
    const { room, advance, disconnect } = await fixture(new SurvivalRoom(), { creationToken: TOKEN });
    try {
      const c = client('a'); room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, code: room.roomId.replace('coop-', ''), fighter: 'zoro', name: 'Tester' });
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(room.game, 'step').mockImplementation(() => { throw new Error('planted tick fault'); });
      const before = snapshots(c);
      expect(() => advance(30)).not.toThrow();
      expect(errors).toHaveBeenCalledTimes(1); expect(snapshots(c)).toBeGreaterThan(before); expect(disconnect).not.toHaveBeenCalled();
      advance(FAULT_SECONDS * 60);
      expect(disconnect).toHaveBeenCalledWith(FAULT_CLOSE_CODE);
    } finally { room.onDispose(); }
  });
});
