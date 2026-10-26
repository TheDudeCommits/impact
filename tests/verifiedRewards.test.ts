import { describe, expect, it, vi } from 'vitest';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Economy } from '../src/server/economy/api';
import { RoomRewards } from '../src/server/economy/RoomRewards';
import { ArenaSimulation } from '../src/game/simulation';
import { ObjectiveMatch } from '../src/game/objectives/ObjectiveMatch';
import type { MatchReport } from '../src/game/economy/earn';

const report = (id = 'verified-match-one'): MatchReport => ({ id, mode: 'duel', fighter: 'naruto', seconds: 35, place: 1, players: 2, kos: 2 });
const guest = (e: Economy) => e.hello(undefined) as unknown as { token: string; account: { pk: string; balance: number } };
describe('verified completion ledger', () => {
  it('rejects invented results of every mode, ignores changed totals, and isolates receipts by account', () => {
    const e = new Economy({ dir: false }); try {
      const a = guest(e), b = guest(e);
      for (const mode of ['duel', 'match', 'bots', 'private', 'last-stand', 'bad-blood', 'survival']) expect(() => e.report(a.token, { ...report(), mode } as never)).toThrow(/No completed server match/);
      const receipt = e.complete(a.account.pk, report())!;
      const response = e.report(a.token, { ...report(), kos: 999, place: 2 }) as unknown as { settlement: unknown };
      expect(response.settlement).toEqual(receipt.settlement);
      expect(() => e.report(b.token, report())).toThrow(/No completed/);
      const before = e.book.find(a.token)!.balance;
      e.complete(a.account.pk, { ...report(), kos: 999 }); e.report(a.token, report());
      expect(e.book.find(a.token)!.balance).toBe(before);
    } finally { e.close(); }
  });
  it('keeps duplicate protection beyond the recent-results window and across ledger replay', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jump-receipts-'));
    let first: Economy | undefined, replay: Economy | undefined;
    try {
      first = new Economy({ dir }); const a = guest(first);
      const receipt = first.complete(a.account.pk, report())!;
      for (let i = 0; i < 45; i++) first.complete(a.account.pk, report(`another-match-${i}`));
      const before = first.book.find(a.token)!.balance;
      replay = new Economy({ dir });
      expect(replay.complete(a.account.pk, report())).toEqual(receipt);
      expect(replay.book.find(a.token)!.balance).toBe(before);
      expect((replay.report(a.token, report()) as unknown as {settlement: unknown}).settlement).toEqual(receipt.settlement);
    } finally { replay?.close(); first?.close(); rmSync(dir, { recursive: true, force: true }); }
  });
  it('does not publish a credit or a receipt if its durable write fails', () => {
    const e = new Economy({ dir: false }); try {
      const a = guest(e), before = structuredClone(e.book.find(a.token));
      const write = vi.spyOn(e.book, 'record').mockImplementationOnce(() => { throw new Error('disk unavailable'); });
      expect(() => e.complete(a.account.pk, report())).toThrow('disk unavailable');
      expect(e.book.find(a.token)).toEqual(before); expect(e.book.completions.size).toBe(0);
      write.mockRestore(); expect(e.complete(a.account.pk, report())!.settlement.total).toBeGreaterThan(0);
    } finally { e.close(); }
  });
  it('repairs an interrupted ledger tail before appending the next completion', () => {
    const dir=mkdtempSync(join(tmpdir(),'jump-tail-'));let e:Economy|undefined;
    try {
      e=new Economy({dir});const a=guest(e);e.complete(a.account.pk,report());e.close();e=undefined;
      appendFileSync(join(dir,'ledger.jsonl'),'{"seq":999,"completion":');
      e=new Economy({dir});const next=e.complete(a.account.pk,report('after-interruption'))!;e.close();e=undefined;
      e=new Economy({dir});expect(e.complete(a.account.pk,report('after-interruption'))).toEqual(next);
      expect(e.book.completions.size).toBe(2);
    } finally {e?.close();rmSync(dir,{recursive:true,force:true});}
  });
  it('derives actual room completion, requires participation, and refuses rebinding after combat begins', () => {
    const e = new Economy({ dir: false }), sim = new ArenaSimulation({ roomMode: 'match' }); try {
      const a = guest(e), b = guest(e), r = new RoomRewards(() => e);
      sim.addPlayer('a', 'naruto', 'A'); sim.addPlayer('b', 'goku', 'B'); r.bind('a', a.token); r.bind('b', b.token);
      sim.startMatch(); r.observe(sim.snapshot()); r.bind('a', b.token);
      r.input('a', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 });
      sim.serverTime = 35; sim.damage('b', 1e6, 'a', 'KO'); sim.step(); r.observe(sim.snapshot());
      const own = r.forOwner(sim.snapshot(), 'a'), inactive = r.forOwner(sim.snapshot(), 'b');
      expect(own.reward?.report.id).toBe(r.matchId); expect(own.reward?.settlement.total).toBeGreaterThan(0);
      expect(inactive.reward).toBeUndefined(); expect(e.book.find(b.token)!.balance).toBe(0);
      const before = e.book.find(a.token)!.balance; r.observe(sim.snapshot()); expect(e.book.find(a.token)!.balance).toBe(before);
    } finally { sim.dispose(); e.close(); }
  });
  it('settles actual Last Stand rescues and repairs without requiring movement inputs', () => {
    const e=new Economy({dir:false}), game=new ObjectiveMatch('last-stand',undefined,7,'host');
    try {
      const a=guest(e), r=new RoomRewards(()=>e); game.add('a','naruto','A');game.add('b','goku','B'); r.bind('a',a.token);
      game.start(); while(game.view.phase!=='active')game.step();r.observe(game.snapshot());
      game.sim.place('a',{x:-11,y:0,z:24});game.sim.place('b',{x:-10,y:0,z:24});game.sim.damage('b',1e6,'qa','Downed');
      for(let i=0;i<610;i++)game.step();
      expect(game.seats.get('a')!.revives).toBe(1);
      game.sim.damage('village-west',1800,'qa','Raid damage');game.siege!.structures.sync();game.siege!.view.hp=game.siege!.structures.hp;game.siege!.view.points=1000;
      expect(game.buy('a','repair')).toBeUndefined();
      const repaired=game.snapshot().objective.seats.find(s=>s.id==='a')!.repairs;expect(repaired).toBeGreaterThanOrEqual(1800);
      for(const id of ['a','b'])game.sim.damage(id,1e6,'qa','Wipe');game.step();r.observe(game.snapshot());
      const receipt=r.forOwner(game.snapshot(),'a').reward;expect(receipt?.report).toMatchObject({mode:'last-stand',revives:1,repairs:repaired});
      expect(receipt?.settlement.lines.some(l=>l.label.includes('teammate rescue'))).toBe(true);
      expect(receipt?.settlement.lines.some(l=>l.label.includes('village health repaired'))).toBe(true);
      const balance=e.book.find(a.token)!.balance;r.observe(game.snapshot());expect(e.book.find(a.token)!.balance).toBe(balance);
      const oldId=r.matchId;r.next(2);expect(r.matchId).not.toBe(oldId);expect(r.forOwner(game.snapshot(),'a').reward).toBeUndefined();
    } finally { game.dispose();e.close(); }
  });
});
