import { PINNED_RELEASED } from '../../tests/rosterPin';
import { afterEach, describe, expect, it } from 'vitest';
import { ROSTER_PROTOCOL } from './rosterProtocol';
import type { Client } from 'colyseus';
import { FIGHTERS } from '../config';
import { MOVES } from './moves';
import { RELEASED_FIGHTERS, LABORATORY_FIGHTERS, isReleasedFighter, isLaboratoryFighter, requireReleasedFighter } from './rosterAvailability';
import type { Owner } from './economy/account';
import { lockedOut, mayPlay } from './economy/fighters';
import { draftBots } from './matchmaking';
import { ArenaSimulation } from './simulation';
import { LocalDuel } from './duel/LocalDuel';
import { LocalRoyale } from './LocalRoyale';
import { LocalObjective } from './objectives/LocalObjective';
import { LocalRift } from './moba/LocalRift';
import { ObjectiveMatch } from './objectives/ObjectiveMatch';
import { RiftMatch } from './moba/RiftMatch';
import { RIFT_PROTOCOL } from './moba/model';
import { ArenaRoom } from '../server/ArenaRoom';
import { SurvivalRoom } from '../server/SurvivalRoom';
import { ObjectiveRoom } from '../server/objectives/ObjectiveRoom';
import { RiftRoom } from '../server/moba/RiftRoom';
import { PartyRoom } from '../server/social/PartyRoom';
import { publicRiftOptions } from '../server/moba/publicMatchmaker';
import { LocalTraining, Network } from '../network';
import type { FighterId } from './types';

const disposed: { dispose(): void }[] = [];
afterEach(() => { disposed.splice(0).forEach(value => value.dispose()); });
const own = <T extends { dispose(): void }>(value: T) => { disposed.push(value); return value; };
const candidate = 'future-fighter' as FighterId;
const client = { sessionId: 'review-test' } as Client;

describe('fighter review availability precedes ownership and mode', () => {
  it('preserves the pinned released roster while keeping future candidates unavailable', () => {
    expect(RELEASED_FIGHTERS).toHaveLength(PINNED_RELEASED);
    expect(new Set(RELEASED_FIGHTERS).size).toBe(PINNED_RELEASED);
    expect(RELEASED_FIGHTERS).toEqual(expect.arrayContaining(['mihawk', 'nami']));
    expect(LABORATORY_FIGHTERS).not.toContain('mihawk');
    expect(FIGHTERS.mihawk.name).toBe('Dracule Mihawk');
    expect(MOVES.mihawk.special.name).toBe('Black Blade: Night');
    for (const id of RELEASED_FIGHTERS) { expect(FIGHTERS[id]).toBeDefined(); expect(MOVES[id]).toBeDefined(); }
    for (const id of LABORATORY_FIGHTERS) expect(isReleasedFighter(id)).toBe(false);
  });
  it('retires Pikachu from ordinary games, the laboratory and owned-account access', async () => {
    expect(isReleasedFighter('pikachu')).toBe(false);
    expect(isLaboratoryFighter('pikachu')).toBe(false);
    expect(LABORATORY_FIGHTERS).not.toContain('pikachu');
    expect(mayPlay('pikachu', { items: {}, allAccess: true })).toBe(false);
    expect(mayPlay('pikachu', { items: { 'fighter-pikachu': { at: 0 } } })).toBe(false);
    expect(() => requireReleasedFighter('pikachu')).toThrow('not available');
    const practice = new LocalTraining();
    await expect(practice.connect('pikachu', 'Retired')).rejects.toThrow('not available');
    expect(() => new SurvivalRoom().onAuth(client, { rosterProtocol: ROSTER_PROTOCOL, fighter: 'pikachu' })).toThrow('not available');
    expect(draftBots([], 400, ids => [...ids])).not.toContain('pikachu');
  });
  it.each([undefined, null, '', '__proto__', 'constructor', 'future-fighter'])('fails closed for %s', value => {
    expect(isReleasedFighter(value)).toBe(false);
    expect(() => requireReleasedFighter(value)).toThrow('not available');
  });
  it('all-access, a fabricated owned item and no catalog item cannot promote a fighter', () => {
    const owners: (Owner | undefined)[] = [undefined, { items: {} }, { items: {}, allAccess: true }, { items: { 'fighter-future-fighter': { at: 0 } } }];
    for (const account of owners) {
      expect(mayPlay(candidate, account)).toBe(false);
      expect(lockedOut(candidate, account)).toMatch(/not available/);
    }
    expect(mayPlay('goku', undefined)).toBe(true);
  });
  it('never drafts a candidate as a BR or Training opponent', () => {
    expect(draftBots([], 400, ids => [...ids]).every(isReleasedFighter)).toBe(true);
    for (let seed = 1; seed <= 40; seed++) {
      const sim = own(new ArenaSimulation({ roomMode: 'training', seed }));
      sim.addPlayer('you', 'goku');
      expect(isReleasedFighter(sim.getPlayer('sparring-bot')?.fighter)).toBe(true);
      expect(sim.trainingCommand('you', { lab: 'opponent', value: candidate })).toBe(false);
    }
  });
  it.each([candidate, undefined])('rejects ordinary local Training and client network admission for %s', async value => {
    const practice = new LocalTraining(), network = new Network('https://test.invalid');
    await expect(practice.connect(value as FighterId, 'Candidate')).rejects.toThrow('not available');
    await expect(network.connect(value as FighterId, 'training', 'Candidate')).rejects.toThrow('not available');
    expect(practice.sim).toBeNull();
  });
  it('rejects direct offline Duel player/rival and BR requests before starting a match', async () => {
    const duel = new LocalDuel(), royale = new LocalRoyale();
    await expect(duel.connect(candidate, 'Candidate')).rejects.toThrow('not available');
    await expect(duel.connect('goku', 'Player', candidate)).rejects.toThrow('not available');
    await expect(royale.connect(candidate, 'Candidate')).rejects.toThrow('not available');
    expect(duel.sim).toBeNull(); expect(royale.sim).toBeNull();
  });
  it('rejects offline operation and Rift requests before loading or creating a match', async () => {
    const operation = new LocalObjective(), rift = new LocalRift();
    await expect(operation.connect(candidate, 'Candidate', 'last-stand', 'bots')).rejects.toThrow('not available');
    await expect(rift.connect(candidate, 'Candidate')).rejects.toThrow('not available');
    expect(operation.match).toBeNull(); expect(rift.match).toBeNull();
  });
  it.each(['last-stand', 'bad-blood'] as const)('rejects %s seats before mutation', kind => {
    const game = own(new ObjectiveMatch(kind));
    expect(() => game.add('candidate', candidate, 'Candidate')).toThrow('not available');
    expect(game.seats.size).toBe(0);
  });
  it('filters the Rift faction pool and rejects direct candidate seats', () => {
    const game = own(new RiftMatch({ fillBots: true }));
    expect(() => game.add('candidate', candidate, 'Candidate')).toThrow('not available');
    game.add('human', 'goku', 'Player'); game.start();
    expect(game.seats.size).toBe(10);
    expect([...game.seats.values()].every(seat => isReleasedFighter(seat.fighter))).toBe(true);
  });
  it.each(['training', 'match'] as const)('rejects raw ArenaRoom %s admission', mode => {
    const room = new ArenaRoom(); Object.assign(room, { simulation: { roomMode: mode } });
    expect(() => room.onAuth(client, { rosterProtocol: ROSTER_PROTOCOL, fighter: candidate })).toThrow('not available');
  });
  it('rejects raw co-op, objective, Rift and public queue admission', () => {
    expect(() => new SurvivalRoom().onAuth(client, { rosterProtocol: ROSTER_PROTOCOL, fighter: candidate })).toThrow('not available');
    const objective = new ObjectiveRoom(); Object.assign(objective, { kind: 'last-stand', game: { view: { phase: 'lobby' } } });
    expect(() => objective.onAuth(client, { rosterProtocol: ROSTER_PROTOCOL, objective: 'last-stand', fighter: candidate })).toThrow('not available');
    const rift = new RiftRoom(); Object.assign(rift, { game: { view: { phase: 'lobby' } } });
    expect(() => rift.onAuth(client, { rosterProtocol: ROSTER_PROTOCOL, fighter: candidate, riftProtocol: RIFT_PROTOCOL })).toThrow('available fighter');
    expect(() => publicRiftOptions({ rosterProtocol: ROSTER_PROTOCOL, fighter: candidate, riftProtocol: RIFT_PROTOCOL })).toThrow('available fighter');
  });
  it('rejects a party join even with the correct room code', () => {
    const room = new PartyRoom(); Object.assign(room, { view: { code: '123456', members: [], launching: false } });
    expect(() => room.onAuth(client, { rosterProtocol: ROSTER_PROTOCOL, code: '123456', fighter: candidate })).toThrow('Choose a fighter');
  });
});
