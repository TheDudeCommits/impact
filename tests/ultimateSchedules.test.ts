import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import type { FighterId } from '../src/game/types';

const ROSTER = Object.keys(MOVES) as FighterId[];
const CONFIRM = ROSTER.filter(f => MOVES[f].ultimate.confirm);
const DT = 1 / 60;
const TOTALS: Record<FighterId, number> = { toji:290,usopp:290,crocodile:300,rengoku:290,'nico-robin':290,'kaiju-no-8':300,eren:259,asuka:290,netero:290,shinji:290,jolyne:290,'might-guy':300,akame:290,pikachu:300,garou:290,esdeath:290,mikasa:290,'alphonse-elric':300,'ken-kaneki':290,grimmjow:290,byakuya:290,yamamoto:300,pain:290,'edward-elric':300,minato:290,kenpachi:290,makima:290,tatsumaki:300,escanor:300,meliodas:290,sakura:290,hiei:290,aokiji:300,doflamingo:300,hisoka:290,blackbeard:300,nanami:300,josuke:290,tsunade:290,jiraiya:290,hinata:290,gintoki:290,kizaru:290,yamato:300,jinbe:300,enel:290, 'all-might':300,bakugo:290,deku:285,yuta:290, rukia:290, yuji:290, todoroki:290,endeavor:300,yoruichi:290, broly: 290, denji: 290, akainu: 299, 'boa-hancock': 282, nami: 290, mihawk: 290, zoro: 295, jotaro: 305, ichigo: 295, kakashi: 285, sasuke: 290, sanji: 290, vegeta: 290, goku: 285,
  luffy: 295, naruto: 270, ace: 290, law: 290, gojo: 315, dio: 310, guts: 331, killua: 225,
  kaido: 290, whitebeard: 290, shanks: 290, roger: 290, aizen: 290, sukuna: 290, griffith: 290, meruem: 290, 'goku-black': 290, jiren: 290, 'golden-frieza': 290, 'gohan-beast': 290, saitama: 290, akaza: 290, itachi: 290, madara: 290, tanjiro: 290, levi: 290, 'sung-jinwoo': 290, gon: 290 };

function landed(fighter: FighterId) {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 7 });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', fighter === 'goku' ? 'vegeta' : 'goku', 'B', false, { x: 0, y: 0, z: 2 });
  sim.actors.get('a')!.state.ultimate = 100;
  const blows: { t: number; damage: number; contact: number }[] = [];
  let confirm = Infinity;
  for (let i = 0; i < 60 * 5; i++) {
    sim.submitInput('a', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: i === 0 ? 'ultimate' : undefined });
    sim.step(DT);
    for (const e of sim.drainEvents()) {
      if (e.actorId !== 'a') continue;
      if (e.kind === 'hit' && e.targetId === 'b') blows.push({ t: (i + 1) * DT, damage: e.damage ?? 0, contact: e.contactIndex ?? 0 });
      if (e.kind === 'confirm') confirm = Math.min(confirm, (i + 1) * DT);
    }
  }
  sim.dispose();
  return { blows, confirm, damage: blows.map(b => b.damage), total: blows.reduce((sum, b) => sum + b.damage, 0) };
}
const ALL = Object.fromEntries(ROSTER.map(f => [f, landed(f)])) as Record<FighterId, ReturnType<typeof landed>>;

describe('each ultimate lands its own schedule', () => {
  it('no two hit-confirm ultimates land the same blows', () => {
    const seen = new Map<string, FighterId>();
    for (const f of CONFIRM) {
      const key = ALL[f].damage.join('/');
      expect(seen.get(key), `${f} lands ${key}, as ${seen.get(key)} does`).toBeUndefined();
      seen.set(key, f);
    }
  });

  it.each(ROSTER)('%s takes what it took off a standing opponent', f => {
    expect(ALL[f].total).toBe(TOTALS[f]);
  });

  it('finish across a spread of times, not all two seconds after the press', () => {
    const finish = CONFIRM.map(f => ALL[f].blows.at(-1)!.t);
    expect(Math.max(...finish) - Math.min(...finish)).toBeGreaterThan(.8);
    expect(new Set(finish.map(t => Math.round(t * 10))).size, 'at a tenth of a second, most of them apart').toBeGreaterThanOrEqual(8);
  });

  it.each(CONFIRM)('%s: a schedule for every contact, opening on its opener\'s damage', f => {
    const move = MOVES[f].ultimate;
    if (!move.schedule) return;
    expect(move.schedule).toHaveLength(move.contacts.length);
    expect(move.schedule[0]).toBe(move.damage);
  });

  it.each(CONFIRM)('%s: a side in arcade survival deals what it did', f => {
    const PLAIN: Partial<Record<FighterId, number>> = { toji:290,usopp:290,crocodile:300,rengoku:290,'nico-robin':290,'kaiju-no-8':300,eren:331,asuka:290,netero:290,shinji:290,jolyne:290,'might-guy':300,akame:290,pikachu:300,garou:290,esdeath:290,mikasa:290,'alphonse-elric':300,'ken-kaneki':290,grimmjow:290,byakuya:290,yamamoto:300,pain:290,'edward-elric':300,minato:290,kenpachi:290,makima:290,tatsumaki:300,escanor:300,meliodas:290,sakura:290,hiei:290,aokiji:300,doflamingo:300,hisoka:290,blackbeard:300,nanami:300,josuke:290,tsunade:290,jiraiya:290,hinata:290,gintoki:290,kizaru:290,yamato:300,jinbe:300,enel:290, 'all-might':300,bakugo:290,deku:285,yuta:290, rukia:290, yuji:290, todoroki:290,endeavor:300,yoruichi:290, broly: 290, denji: 290, akainu: 299, 'boa-hancock': 282, nami: 290, mihawk: 290, zoro: 375, jotaro: 565, ichigo: 375, kakashi: 361, sasuke: 368, sanji: 368, vegeta: 368, luffy: 320,
      law: 368, gojo: 433, dio: 579, guts: 454, killua: 348,
      kaido: 368, whitebeard: 368, shanks: 368, roger: 368, aizen: 368, sukuna: 368, griffith: 368, meruem: 368, 'goku-black': 368, jiren: 368, 'gohan-beast': 368, saitama: 368, akaza: 368, itachi: 368, madara: 368, tanjiro: 368, levi: 368, 'sung-jinwoo': 368, gon: 368 };
    const move = MOVES[f].ultimate, first = move.timeStop ? move.timeStop.contact + 1 : 0, last = move.contacts.length - 1;
    let sum = 0;
    for (let i = first; i <= last; i++) sum += i === last ? move.finisherDamage ?? move.damage : move.damage;
    expect(sum).toBe(PLAIN[f]);
  });

  it.each(CONFIRM)('%s: the owner\'s fast opener, and a cinematic long enough for its shot', f => {
    const move = MOVES[f].ultimate, open = move.contacts[0], finish = move.contacts.at(-1)!;
    expect(open, 'out by 0.6 s (the Domains, drawn from the cast, by 0.7)').toBeLessThanOrEqual(f === 'gojo' || f === 'sukuna' ? .7 : .6);
    expect(finish - open, 'a second at least from the opener to the finisher').toBeGreaterThanOrEqual(1.05);
    expect(move.duration - finish, 'and a follow-through after it').toBeGreaterThanOrEqual(.6);
  });
});

describe('true to the anime', () => {
  const gaps = (f: FighterId) => { const c = MOVES[f].ultimate.contacts; return c.slice(1).map((t, i) => t - c[i]); };
  it('Godspeed: Whirlwind is a barrage - many small blows, then the one that counts', () => {
    const { damage } = ALL.killua;
    expect(damage.length).toBeGreaterThanOrEqual(8);
    expect(Math.max(...gaps('killua').slice(1, -1))).toBeLessThanOrEqual(.15);
    expect(Math.max(...damage.slice(1, -1)), 'small').toBeLessThanOrEqual(15);
    expect(damage.at(-1)!).toBeGreaterThan(damage.slice(1, -1).reduce((a, b) => a + b, 0) * 1.5);
  });
  it('Final Flash pours through them: a stream of burns under the beam, and the blast', () => {
    const { damage } = ALL.vegeta;
    expect(damage.length).toBeGreaterThanOrEqual(10);
    expect(Math.max(...gaps('vegeta').slice(1, -1))).toBeLessThanOrEqual(.1);
    expect(damage.at(-1)!).toBeGreaterThan(150);
  });
  it('Mugetsu is one cut; King Kong Gun a wind-up and one colossal punch', () => {
    for (const f of ['ichigo', 'luffy'] as FighterId[]) {
      expect(ALL[f].damage, f).toHaveLength(2);
      expect(ALL[f].damage[1] / ALL[f].total, `${f}: nearly all of it in the one blow`).toBeGreaterThan(.8);
    }
    expect(gaps('luffy')[0], 'the fist blown up first').toBeGreaterThanOrEqual(1.4);
  });
  it('Kamui is a delayed rip: the blade\'s crackle, a long pull, the tear', () => {
    const { blows } = ALL.kakashi, last = blows.at(-1)!;
    expect(last.t - blows.at(-2)!.t, 'nothing lands for over a second before the rip').toBeGreaterThan(1);
    expect(last.damage).toBeGreaterThan(ALL.kakashi.total * .75);
  });
  it('Hell Memories is a building fire: each kick harder and sooner than the last, then the blaze', () => {
    const { damage } = ALL.sanji, kicks = damage.slice(1, -1), g = gaps('sanji').slice(0, -1);
    for (let i = 1; i < kicks.length; i++) expect(kicks[i], `kick ${i + 1}`).toBeGreaterThan(kicks[i - 1]);
    for (let i = 1; i < g.length; i++) expect(g[i], `gap ${i + 1}`).toBeLessThan(g[i - 1]);
    expect(damage.at(-1)!).toBeGreaterThan(kicks.reduce((a, b) => a + b, 0));
  });
  it('the Berserker rampage builds as well; Indra\'s Arrow and Counter Shock strike hard, few and late', () => {
    const swings = ALL.guts.damage.slice(2, -1);
    for (let i = 1; i < swings.length; i++) expect(swings[i]).toBeGreaterThan(swings[i - 1]);
    expect(ALL.sasuke.damage[0], 'the arrow itself lands hard').toBeGreaterThanOrEqual(100);
    expect(ALL.sasuke.damage).toHaveLength(2);
    expect(ALL.law.damage).toHaveLength(3);
    expect(ALL.law.blows[2].t - ALL.law.blows[1].t, 'two jolts, close together').toBeLessThan(.3);
  });
  it('the Asura\'s nine blades cut at once: a silence, then three sweeps in a sixth of a second', () => {
    const { blows } = ALL.zoro;
    expect(blows).toHaveLength(4);
    expect(blows[1].t - blows[0].t, 'the Asura rises').toBeGreaterThan(.8);
    expect(blows[3].t - blows[1].t).toBeLessThanOrEqual(.2);
  });
});
