import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { MOVES } from '../src/game/moves';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { MoveStage, STAGE } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';
import { CastBook, Cuts, Rifts, Strikes } from '../src/render/signature/StageCraft';
import { KenpachiReiatsu } from '../src/render/signature/KenpachiReiatsu';
import { ByakuyaSenbonzakura } from '../src/render/signature/ByakuyaSenbonzakura';
import { GrimmjowPantera } from '../src/render/signature/GrimmjowPantera';
import { RukiaShirayuki } from '../src/render/signature/RukiaShirayuki';
import { YamamotoJakka } from '../src/render/signature/YamamotoJakka';
import { YoruichiShunko } from '../src/render/signature/YoruichiShunko';
import { BrolyBerserker } from '../src/render/signature/BrolyBerserker';
import { GarouWaterStream } from '../src/render/signature/GarouWaterStream';
import { TatsumakiPsychic } from '../src/render/signature/TatsumakiPsychic';
import { ErenTitan } from '../src/render/signature/ErenTitan';
import { MikasaODM } from '../src/render/signature/MikasaODM';

function body(id: string, fighter: FighterId, z = 0): Fighter {
  const group = new THREE.Group(); group.position.z = z;
  const head = new THREE.Object3D(); head.position.set(0, 1.7, z);
  return { group, handR: new THREE.Vector3(.3, 1.3, z + .2), handL: new THREE.Vector3(-.3, 1.3, z + .2), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.3, z + .6), drawnJoint: () => head,
    state: { id, fighter, alive: true, action: 'idle', actionSeq: 2, actionTime: 0, actionDuration: 1, yaw: 0 } as PlayerState } as unknown as Fighter;
}
type Module = { handle(e: CombatEvent, f?: ReadonlyMap<string, Fighter>): void; update(t: number, f: ReadonlyMap<string, Fighter>, fl: ReadonlyMap<string, Flight>): void; reset(): void; dispose(): void };
const MODULES: readonly (readonly [FighterId, (scene: THREE.Scene) => Module])[] = [
  ['kenpachi', scene => new KenpachiReiatsu(scene, { budget: 1 })],
  ['byakuya', scene => new ByakuyaSenbonzakura(scene, { budget: 1 })],
  ['grimmjow', scene => new GrimmjowPantera(scene, { budget: 1 })],
  ['rukia', scene => new RukiaShirayuki(scene, { budget: 1 })],
  ['yamamoto', scene => new YamamotoJakka(scene, { budget: 1 })],
  ['yoruichi', scene => new YoruichiShunko(scene, { budget: 1 })],
  ['broly', scene => new BrolyBerserker(scene, { budget: 1 })],
  ['garou', scene => new GarouWaterStream(scene, { budget: 1 })],
  ['tatsumaki', scene => new TatsumakiPsychic(scene, { budget: 1 })],
  ['eren', scene => new ErenTitan(scene, { budget: 1 })],
  ['mikasa', scene => new MikasaODM(scene, { budget: 1 })],
];
const hit = (fighter: FighterId, patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'hit', fighter, actorId: 'a', targetId: 'v', actionSeq: 2, slot: 'ultimate', contactIndex: 0, serverTime: 10, endpoint: { x: 0, y: 1.2, z: 2.2 }, ...patch });

describe('StageCraft: the cast book', () => {
  const fighters = () => new Map([['a', body('a', 'kenpachi')], ['v', body('v', 'goku', 2.2)]]);
  it('hands a blow back once, with where it landed, the floor under it and the way it travelled', () => {
    const book = new CastBook('kenpachi', 2), all = fighters(), blow = book.take(hit('kenpachi', { slot: 'heavy' }), all)!;
    expect(blow.point.z).toBeCloseTo(2.2, 5); expect(blow.ground.y).toBe(0); expect(blow.dir.z).toBeCloseTo(1, 5); expect(blow.side.x).toBeCloseTo(1, 5); expect(blow.final).toBe(false);
    expect(book.take(hit('kenpachi', { slot: 'heavy' }), all), 'the same event delivered twice').toBeUndefined();
    expect(book.take(hit('goku', { id: 2 }), all), 'another fighter\'s').toBeUndefined();
    expect(book.take(hit('kenpachi', { id: 3, kind: 'cast' }), all)).toBeUndefined();
  });
  it('keeps an ultimate\'s confirm until its last blow, and lets go of it on a whiff, a death or a new action', () => {
    const book = new CastBook('kenpachi', 2), all = fighters(), actor = all.get('a')!, seen: number[] = [], draw = (_a: Fighter, _g: unknown, elapsed: number) => { seen.push(elapsed); };
    Object.assign(actor.state, { action: 'ultimate', actionDuration: 3.6, actionTime: .5 });
    book.each(all, 3.6, draw); expect(seen, 'nothing stands before the confirm').toHaveLength(0);
    book.take(hit('kenpachi', { id: 1, kind: 'confirm' }), all); book.each(all, 3.6, draw); expect(seen).toEqual([1.8]);
    expect(book.take(hit('kenpachi', { id: 2, contactIndex: 0 }), all)!.final).toBe(false);
    expect(book.take(hit('kenpachi', { id: 3, contactIndex: 1 }), all)!.final, 'its last contact').toBe(true);
    expect(book.take(hit('kenpachi', { id: 4, contactIndex: 1, branch: 'lh' }), all)!.final, 'never a combo ender').toBe(false);
    actor.state.actionSeq = 3; book.each(all, 3.6, draw); expect(seen, 'a new action lets go of it').toHaveLength(1);
    actor.state.actionSeq = 2; book.take(hit('kenpachi', { id: 5, kind: 'confirm' }), all); book.take(hit('kenpachi', { id: 6, kind: 'whiff' }), all); book.each(all, 3.6, draw); expect(seen).toHaveLength(1);
    book.take(hit('kenpachi', { id: 7, kind: 'confirm' }), all); book.take({ ...hit('goku', { id: 8, kind: 'eliminated' }), actorId: 'v' }, all); book.each(all, 3.6, draw); expect(seen, 'its victim\'s death lets go of it').toHaveLength(1);
  });
});

describe('StageCraft: what a blade and the sky leave', () => {
  it('a cut, a rift and a strike are drawn through the shared stage for their own lives and no longer', () => {
    const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget: 1 }), look = STAGE.quake;
    const cuts = new Cuts(4, look), rifts = new Rifts(4, look), strikes = new Strikes(4, look), at = new THREE.Vector3(0, 1.2, 2), floor = new THREE.Vector3(0, 0, 2);
    try {
      cuts.add(at, new THREE.Vector3(1, 0, 0), undefined, 1.5, .1, look, 10, .3); rifts.add(floor, new THREE.Vector3(0, 0, 1), 6, look, 10, 1.5); rifts.add(floor, new THREE.Vector3(1, 0, 0), 6, look, 10, 1.5, 1, .1, false); strikes.add(floor, 6, .1, look, 10, .25);
      const draw = (t: number) => { stage.open(t); cuts.draw(stage, t); rifts.draw(stage, t); strikes.draw(stage, t); stage.close(); return stage.counts; };
      const early = draw(10.1); expect(early.bolts).toBeGreaterThan(30); expect(early.lights, 'the cut, the lit rift and the strike').toBeGreaterThanOrEqual(3); expect(early.discs, 'the stone glowing along the lit rift only').toBeGreaterThan(0);
      expect([cuts.live, rifts.live, strikes.live]).toEqual([1, 2, 1]);
      const later = draw(10.6); expect([cuts.live, rifts.live, strikes.live], 'the cut and the strike are spent').toEqual([0, 2, 0]); expect(later.bolts).toBeGreaterThan(0);
      const done = draw(12); expect([cuts.live, rifts.live, strikes.live]).toEqual([0, 0, 0]); expect(done.bolts).toBe(0); expect(done.lights).toBe(0);
    } finally { stage.release(); }
  });
});

describe.each(MODULES)('%s staged on the shared stage', (fighter, make) => {
  const move = MOVES[fighter].ultimate, last = move.contacts.length - 1;
  it('is named in STAGED_BY_MODULE, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(fighter)).toBe(true); });
  it('draws no gather for an ultimate nobody confirmed, stages its last blow once, and leaves nothing behind', () => {
    const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget: 1 }), fx = make(scene), actor = body('a', fighter), foe = body('v', 'goku', 2.2), fighters = new Map([['a', actor], ['v', foe]]), flights = new Map<string, Flight>();
    const at = (t: number, more: object = {}) => Object.assign(actor.state, { action: 'ultimate', actionDuration: move.duration, actionTime: t / move.duration, ...more });
    try {
      const mid = (move.contacts[0] + move.contacts[last]) / 2;
      at(mid); fx.update(10 + mid, fighters, flights);
      expect(stage.counts.lights, 'no light without a confirm').toBe(0); expect(stage.counts.bolts).toBe(0); expect(stage.counts.flames).toBe(0); expect(stage.counts.discs).toBe(0);
      fx.handle(hit(fighter, { id: 1, kind: 'confirm', serverTime: 10 + move.contacts[0] }), fighters); fx.handle(hit(fighter, { id: 2, serverTime: 10 + move.contacts[0] }), fighters);
      at(mid, { confirmedAt: 10 + move.contacts[0] }); fx.update(10 + mid, fighters, flights);
      expect(stage.counts.lights, 'the gather lights the room').toBeGreaterThan(0);
      const final = hit(fighter, { id: 9, contactIndex: last, serverTime: 10 + move.contacts[last] });
      fx.handle(final, fighters); at(move.contacts[last] + .05); fx.update(10 + move.contacts[last] + .05, fighters, flights); const once = stage.counts.shots;
      fx.handle(final, fighters); fx.update(10 + move.contacts[last] + .05, fighters, flights);
      expect(once).toBeGreaterThan(2); expect(stage.counts.shots, 'the same event again adds nothing').toBe(once);
      Object.assign(actor.state, { action: 'idle', actionTime: 0, confirmedAt: undefined }); fx.update(10 + move.duration + 4, fighters, flights);
      expect(stage.counts.shots).toBe(0); expect(stage.counts.bolts).toBe(0); expect(stage.counts.lights).toBe(0);
    } finally { fx.dispose(); stage.release(); }
  });
  it('stages every blow of every slot and every combo ender, awakened or not, and is spent four seconds on', () => {
    for (const awakened of [false, true]) {
      const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget: 1 }), fx = make(scene), actor = body('a', fighter), foe = body('v', 'goku', 2.2), fighters = new Map([['a', actor], ['v', foe]]), flights = new Map<string, Flight>();
      try {
        actor.state.awakened = awakened; let id = 100, t = 30;
        for (const [slot, branch] of [['light', undefined], ['heavy', undefined], ['heavy', 'lh'], ['heavy', 'llh'], ['heavy', 'lllh'], ['heavy', 'airHeavy'], ['special', undefined], ['special', 'llls'], ['special', 'airSpecial']] as const) {
          const move = MOVES[fighter][slot];
          for (const at of [move.contacts[0] * .5, move.contacts[0] + .05]) { Object.assign(actor.state, { action: slot, branch, actionSeq: id, actionDuration: move.duration, actionTime: at / move.duration, confirmedAt: undefined, whiffedAt: undefined }); fx.update(t + at, fighters, flights); }
          fx.handle(hit(fighter, { id: id++, slot, branch, actionSeq: actor.state.actionSeq, contactIndex: 0, serverTime: t + move.contacts[0] }), fighters);
          for (let frame = 0; frame < 12; frame++) fx.update(t + move.contacts[0] + frame / 30, fighters, flights);
          expect(stage.counts.lights + stage.counts.glows + stage.counts.bolts + stage.counts.flames, `${slot} ${branch ?? 'plain'} awakened=${awakened}`).toBeGreaterThan(0);
          t += 6; Object.assign(actor.state, { action: 'idle', branch: undefined, actionTime: 0 }); fx.update(t - .5, fighters, flights);
          expect(stage.counts.shots, `${slot} ${branch ?? 'plain'} awakened=${awakened} spent`).toBe(0); expect(stage.counts.bolts).toBe(0); expect(stage.counts.lights).toBe(0);
        }
      } finally { fx.dispose(); stage.release(); }
    }
  });
  it('stops a special\'s wind-up at a whiff', () => {
    const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget: 1 }), fx = make(scene), actor = body('a', fighter), fighters = new Map([['a', actor]]), flights = new Map<string, Flight>(), special = MOVES[fighter].special;
    try {
      Object.assign(actor.state, { action: 'special', actionDuration: special.duration, actionTime: special.contacts[0] * .7 / special.duration });
      fx.update(20, fighters, flights); expect(stage.counts.lights + stage.counts.glows, 'something in the hands through the wind-up').toBeGreaterThan(0);
      actor.state.whiffedAt = 20; fx.update(20.02, fighters, flights);
      expect(stage.counts.lights).toBe(0); expect(stage.counts.glows).toBe(0); expect(stage.counts.bolts).toBe(0);
    } finally { fx.dispose(); stage.release(); }
  });
});
