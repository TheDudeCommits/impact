import { describe, expect, it } from 'vitest';
import { BOT_OFFER_SECONDS, dockText } from './WaitingDock';

const frame = (lobby: Record<string, unknown>, players: { id: string; isBot?: boolean }[], serverTime = 10) =>
  ({ phase: 'waiting', self: { id: 'me' }, snapshot: { roomMode: 'match', serverTime, lobby: { startsAt: null, ...lobby }, players } }) as never;

describe('the waiting dock (round 5 corrections)', () => {
  it("calls a friend's room PRIVATE ROOM for the guest, YOUR ROOM for the host", () => {
    const players = [{ id: 'host' }, { id: 'me' }];
    expect(dockText(frame({ visibility: 'private', hostId: 'host', code: '123456', size: 4 }, players), 0)!.title).toBe('PRIVATE ROOM · 123456');
    expect(dockText(frame({ visibility: 'private', hostId: 'me', code: '123456', size: 4 }, players), 0)!.title).toBe('YOUR ROOM · 123456');
  });
  it('a bot duel is YOUR BOT RIVAL, never OPPONENT FOUND', () => {
    expect(dockText(frame({ duel: true, startsAt: 12 }, [{ id: 'me' }, { id: 'bot', isBot: true }]), 0)!.title).toBe('YOUR BOT RIVAL');
    expect(dockText(frame({ duel: true, startsAt: 12 }, [{ id: 'me' }, { id: 'them' }]), 0)!.title).toBe('OPPONENT FOUND');
  });
  it('once the countdown has run out and the room still loads, it says so, never STARTING IN 0s', () => {
    const text = dockText(frame({ visibility: 'private', hostId: 'me', code: '123456', size: 4, startsAt: 9 }, [{ id: 'me' }, { id: 'b' }], 10), 0)!;
    expect(text.detail).toBe("LOADING EVERYONE'S FIGHTERS…");
    expect(JSON.stringify(text)).not.toMatch(/IN 0s/);
  });
  it('a lone online Duel queue offers a bot on this device after 30 s, beside CANCEL', () => {
    const queue = frame({ duel: true, visibility: 'public' }, [{ id: 'me' }]);
    expect(BOT_OFFER_SECONDS).toBe(30);
    expect(dockText(queue, 29.9)).toEqual({ title: 'FINDING AN OPPONENT · 0:29', detail: 'REAL PLAYERS ONLY · NEVER A BOT', cancel: 'CANCEL' });
    const offer = dockText(queue, 30)!;
    expect(offer).toMatchObject({ title: 'FINDING AN OPPONENT · 0:30', cancel: 'CANCEL' });
    expect(offer.detail).toMatch(/NOBODY'S QUEUED/);
    expect(offer.bot).toBe('FIGHT A BOT');
    expect(offer.detail).toMatch(/ON THIS DEVICE/);
    expect(`${offer.bot} ${offer.detail}`).not.toMatch(/SUMI|REWARD|PAY|XP/);
    expect(dockText(queue, 95)!.title).toBe('FINDING AN OPPONENT · 1:35');
  });
  it('a pad that said KEEP WAITING is offered again only from its new time', () => {
    const queue = frame({ duel: true, visibility: 'public' }, [{ id: 'me' }]);
    expect(dockText(queue, 45, 62)!.bot).toBeUndefined();
    expect(dockText(queue, 62, 62)!.bot).toBeDefined();
  });
  it('never offers a bot once an opponent is in, in a friends Duel room, or in a royale', () => {
    expect(dockText(frame({ duel: true, startsAt: 12 }, [{ id: 'me' }, { id: 'them' }]), 90)!.bot).toBeUndefined();
    expect(dockText(frame({ duel: true, visibility: 'private', hostId: 'me', code: '123456' }, [{ id: 'me' }]), 90)!.bot).toBeUndefined();
    expect(dockText(frame({ visibility: 'public' }, [{ id: 'me' }]), 90)!.bot).toBeUndefined();
  });
});
