import { describe, expect, it } from 'vitest';
import { LONE_NOTICE, loneQueue } from './loneQueue';

const snap = (over: Record<string, unknown>, players: { id: string; isBot?: boolean; enemy?: boolean; fighter?: string }[] = [{ id: 'me' }]) =>
  ({ roomMode: 'match', status: 'waiting', serverTime: 10, players, events: [], ...over }) as never;
const publicRoom = (startsAt: number | null, players?: { id: string; isBot?: boolean }[]) => snap({ lobby: { visibility: 'public', hostId: null, canStart: false, startsAt, expiresAt: null } }, players);

describe('a lone player in a public quick room', () => {
  it('keeps a lone Rift War local but never switches an active fog-filtered match',()=>{
    const war=(phase:string,players?:{id:string;isBot?:boolean}[])=>snap({rift:{kind:'rift-war',phase,startsAt:11}},players);
    expect(loneQueue(war('lobby'),'me',{kind:'rift-war',access:'quick'})).toEqual({kind:'rift-war',access:'bots'});
    expect(loneQueue(war('lobby',[{id:'me'},{id:'other'}]),'me',{kind:'rift-war',access:'quick'})).toBeUndefined();
    expect(loneQueue(war('active'),'me',{kind:'rift-war',access:'quick'})).toBeUndefined();
    expect(loneQueue(war('lobby'),'me',{kind:'rift-war',access:'host'})).toBeUndefined();
  });
  it('plays the royale on the device, six fighters, a second before the bots would fill the room', () => {
    expect(loneQueue(publicRoom(11), 'me', { kind: 'public' })).toEqual({ kind: 'bots', players: 6, lone: true });
    expect(loneQueue(publicRoom(12), 'me', { kind: 'public' })).toBeUndefined();
    expect(loneQueue(publicRoom(null), 'me', { kind: 'public' })).toBeUndefined();
  });
  it('stays online when another human is in the room at that moment; bots never count', () => {
    expect(loneQueue(publicRoom(10.5, [{ id: 'me' }, { id: 'them' }]), 'me', { kind: 'public' })).toBeUndefined();
    expect(loneQueue(publicRoom(10.5, [{ id: 'me' }, { id: 'bot-1', isBot: true }]), 'me', { kind: 'public' })).toEqual({ kind: 'bots', players: 6, lone: true });
  });
  it("plays where the room was dealt, against the bots it drafted for its kickoff (their files fetched while it waited)", () => {
    const room = snap({ stage: 'shibuya', lobby: { visibility: 'public', hostId: null, canStart: false, startsAt: 11, expiresAt: null } }, [{ id: 'me', fighter: 'gojo' }]);
    const planned = ['naruto', 'luffy', 'ichigo', 'vegeta', 'tanjiro'] as never[];
    expect(loneQueue(room, 'me', { kind: 'public' }, planned)).toEqual({ kind: 'bots', players: 6, lone: true, place: 'shibuya', field: planned });
    expect(loneQueue(room, 'me', { kind: 'public' }, planned.slice(0, 3))).toEqual({ kind: 'bots', players: 6, lone: true, place: 'shibuya' });
    expect(loneQueue(room, 'me', { kind: 'public' }, ['gojo', ...planned.slice(0, 4)] as never[])).toEqual({ kind: 'bots', players: 6, lone: true, place: 'shibuya' });
  });
  it('plays an operation with bots once its quick lobby is about to start, as the same fighter', () => {
    const lobby = (serverTime: number, access = 'quick') => snap({ serverTime, objective: { kind: 'last-stand', phase: 'lobby', access, seats: [], startsAt: null } });
    expect(loneQueue(lobby(11), 'me', { kind: 'objective', objective: 'last-stand', access: 'quick', fighter: 'gojo' })).toEqual({ kind: 'objective', objective: 'last-stand', access: 'bots', fighter: 'gojo' });
    expect(loneQueue(lobby(9), 'me', { kind: 'objective', objective: 'last-stand', access: 'quick' })).toBeUndefined();
    expect(loneQueue(snap({ serverTime: 30, objective: { kind: 'bad-blood', phase: 'countdown', access: 'quick', seats: [], startsAt: 32 } }), 'me', { kind: 'objective', objective: 'bad-blood', access: 'quick' })).toBeUndefined();
  });
  it("plays the arcade's solo run when the co-op quick lobby is about to start", () => {
    const quick = (startsAt: number) => snap({ lobby: { visibility: 'private', code: 'QUICK', hostId: 'me', canStart: true, startsAt, expiresAt: null } }, [{ id: 'me' }, { id: 'oni-1', enemy: true }]);
    expect(loneQueue(quick(10.5), 'me', { kind: 'coop-join', code: '', quick: true })).toEqual({ kind: 'survival' });
    expect(loneQueue(quick(20), 'me', { kind: 'coop-join', code: '', quick: true })).toBeUndefined();
  });
  it('never touches private rooms, codes, parties, duels, training or a fight already on', () => {
    expect(loneQueue(snap({ lobby: { visibility: 'private', code: '123456', hostId: 'me', canStart: true, startsAt: 10, expiresAt: 900 } }), 'me', { kind: 'create-private', players: 8 })).toBeUndefined();
    expect(loneQueue(snap({ lobby: { visibility: 'private', code: '123456', hostId: 'me', canStart: true, startsAt: 10, expiresAt: null } }), 'me', { kind: 'coop-join', code: '123456' })).toBeUndefined();
    expect(loneQueue(snap({ lobby: { duel: true, visibility: 'public', hostId: null, canStart: false, startsAt: 10, expiresAt: null } }), 'me', { kind: 'public' })).toBeUndefined();
    expect(loneQueue(snap({ roomMode: 'training', lobby: { visibility: 'public', hostId: null, canStart: false, startsAt: 10, expiresAt: null } }), 'me', { kind: 'public' })).toBeUndefined();
    expect(loneQueue(snap({ status: 'active', lobby: { visibility: 'public', hostId: null, canStart: false, startsAt: 10, expiresAt: null } }), 'me', { kind: 'public' })).toBeUndefined();
    expect(loneQueue(publicRoom(10), 'me', { kind: 'party', travel: {} as never })).toBeUndefined();
    expect(loneQueue(publicRoom(10), 'someone-else', { kind: 'public' })).toBeUndefined();
  });
  it('says so without naming rewards', () => { expect(LONE_NOTICE).toMatch(/YOUR DEVICE/); expect(LONE_NOTICE).not.toMatch(/SUMI|REWARD|XP|PAY/i); });
});
