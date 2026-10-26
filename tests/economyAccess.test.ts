import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'colyseus';
import { BUNDLES, ITEM, ITEMS, released, type Item } from '../src/game/economy/catalog';
import { HELD, LOCKED, lockedOut, mayPlay } from '../src/game/economy/fighters';
import { buy, cannotBuy, cannotBuyBundle, gate, merge, newAccount, owns, unlocked, wear } from '../src/game/economy/account';
import { RARITY } from '../src/game/economy/rarity';
import { ArenaRoom } from '../src/server/ArenaRoom';
import { SurvivalRoom } from '../src/server/SurvivalRoom';
import { mountEconomy } from '../src/server/economy/api';
import type { FighterId } from '../src/game/types';

afterEach(() => vi.restoreAllMocks());
const client = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client);
const everything = () => ({ ...newAccount('all', 0), allAccess: true });
const LIVE = ITEMS.filter(released);

describe('all access', () => {
  it('owns every released item and passes every gate, with nothing listed on the account', () => {
    const account = everything(), plain = newAccount('plain', 0);
    for (const item of LIVE) {
      expect(owns(account, item.id), item.id).toBe(true);
      expect(unlocked(account, item.id), item.id).toBe(true);
      expect(gate(account, item), item.id).toBeUndefined();
    }
    expect(Object.keys(account.items).sort()).toEqual(Object.keys(plain.items).sort());
    for (const item of ITEMS.filter(each => !released(each))) expect(owns(account, item.id), item.id).toBe(false);
    expect(owns(account, 'no-such-item')).toBe(false);
    const legendary = ITEM.get('skin-gold-leaf')!;
    expect(owns(plain, legendary.id)).toBe(false);
    expect(unlocked(plain, legendary.id)).toBe(true); expect(gate(plain, legendary)).toBeUndefined();
    expect(RARITY.legendary.level).toBe(1);
    expect(owns(undefined, legendary.id)).toBe(false);
  });

  it('owns what is added to the game later, the day it ships', () => {
    const account = everything(), plain = newAccount('plain', 0);
    const fresh: Item = { id: 'skin-added-later', name: 'Added Later', kind: 'skin', rarity: 'mythic', blurb: 'A test item.', stage: 'next', feat: 'author' };
    const fighter: Item = { id: 'fighter-added-later', name: 'Added Later', kind: 'fighter', rarity: 'legendary', blurb: 'A test fighter.', stage: 'live', fighter: 'goku', price: 20000, feat: 's-rank' };
    const items = ITEM as Map<string, Item>, locked = LOCKED as Map<FighterId, string>;
    try {
      items.set(fresh.id, fresh);
      expect(owns(account, fresh.id)).toBe(false);
      fresh.stage = 'live';
      expect(owns(account, fresh.id)).toBe(true); expect(unlocked(account, fresh.id)).toBe(true);
      expect(owns(plain, fresh.id)).toBe(false); expect(unlocked(plain, fresh.id)).toBe(false);
      items.set(fighter.id, fighter); locked.set(fighter.fighter!, fighter.id);
      expect(mayPlay(fighter.fighter!, account)).toBe(true); expect(lockedOut(fighter.fighter!, account)).toBeUndefined();
      expect(mayPlay(fighter.fighter!, plain)).toBe(false);
    } finally { items.delete(fresh.id); items.delete(fighter.id); locked.delete(fighter.fighter!); }
  });

  it('plays every fighter on sale and wears anything out, but buys nothing and takes no numbered copy', () => {
    const account = everything();
    account.balance = 1e6;
    for (const [fighter] of LOCKED) { expect(mayPlay(fighter, account), fighter).toBe(true); expect(lockedOut(fighter, account), fighter).toBeUndefined(); }
    for (const fighter of HELD) expect(mayPlay(fighter, account), fighter).toBe(false);
    expect(cannotBuy(account, 'fighter-roger', 0)).toBe('You already own it.');
    expect(buy(account, 'fighter-roger', 0, 1)).toEqual({ refused: 'You already own it.' });
    expect(account.items['fighter-roger']).toBeUndefined(); expect(account.balance).toBe(1e6);
    expect(owns(account, 'skin-authors-hand')).toBe(true); expect(buy(account, 'skin-authors-hand', 7, 1)).toHaveProperty('refused');
    expect(account.items['skin-authors-hand']).toBeUndefined();
    for (const bundle of BUNDLES) expect(cannotBuyBundle(account, bundle.id), bundle.id).toBe('You own all of it already.');
    for (const [kind, id] of [['skin', 'skin-authors-hand'], ['aura', 'aura-hundred-seals'], ['form', 'form-oni'], ['kill', 'kill-kintsugi'], ['outfit', 'outfit-luffy-gear5']] as const)
      expect(wear(account, kind, id), id).not.toHaveProperty('refused');
    expect(account.worn.skin).toBe('skin-authors-hand'); expect(account.worn.outfits?.luffy).toBe('outfit-luffy-gear5');
    expect(wear(account, 'aura', 'aura-ink-dragon')).toEqual({ refused: 'You do not own it.' });
  });

  it('goes with the account when a guest is folded into it, either way round', () => {
    const login = newAccount('login', 0), guest = { ...newAccount('guest', 0), allAccess: true };
    merge(login, guest);
    expect(login.allAccess).toBe(true);
    const other = everything(); merge(other, newAccount('g2', 0));
    expect(other.allAccess).toBe(true);
  });
});

describe('the match server honours all access', () => {
  async function arena(mode: 'match' | 'training') {
    const room = new ArenaRoom();
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(() => {});
    await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, mode });
    return room;
  }
  it('lets an all-access account into a match and a co-op run with any fighter on sale', async () => {
    const economy = mountEconomy({ use: () => undefined, post: () => undefined }, { dir: false });
    const match = await arena('match');
    const coop = new SurvivalRoom();
    vi.spyOn(coop, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(coop, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(coop, 'broadcast').mockImplementation(() => {}); vi.spyOn(coop, 'lock').mockResolvedValue(undefined); vi.spyOn(coop, 'unlock').mockResolvedValue(undefined);
    vi.spyOn(coop, 'setFixedTimestep').mockImplementation(() => {});
    await coop.onCreate({rosterProtocol:ROSTER_PROTOCOL, creationToken: '01234567-89ab-cdef-0123-456789abcdef' });
    try {
      const hello = economy.hello(undefined) as unknown as { token: string; account: { pk: string } };
      const code = coop.roomId.replace('coop-', '');
      for (const [fighter] of LOCKED) {
        expect(() => match.onAuth(client('a'), {rosterProtocol:ROSTER_PROTOCOL, fighter, account: hello.token, mode: 'match' }), fighter).toThrow(/locked/);
        expect(() => coop.onAuth(client('b'), {rosterProtocol:ROSTER_PROTOCOL, code, fighter, account: hello.token }), fighter).toThrow(/locked/);
      }
      economy.book.accounts.get(hello.account.pk)!.allAccess = true;
      for (const [fighter] of LOCKED) {
        expect(match.onAuth(client('a'), {rosterProtocol:ROSTER_PROTOCOL, fighter, account: hello.token, mode: 'match' }), fighter).toBe(true);
        expect(coop.onAuth(client('b'), {rosterProtocol:ROSTER_PROTOCOL, code, fighter, account: hello.token }), fighter).toBe(true);
      }
    } finally { match.onDispose(); coop.onDispose(); economy.close(); }
  });
});
