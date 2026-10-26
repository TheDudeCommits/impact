import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { impulseResponse, spaceFor, STAGE_SPACES, VOICE_SHARE } from '../src/audio/space';
import { STAGES, type StageId } from '../src/game/stages';
import { VS_BEATS } from '../src/ui/VsSplash';

describe('the stage reverb (audio/space.ts)', () => {
  it('gives every main-game stage a space and leaves arcade survival\'s rift stages dry', () => {
    for (const stage of Object.keys(STAGES) as StageId[]) {
      if (stage.startsWith('rift-')) expect(spaceFor(stage), stage).toBeUndefined();
      else expect(spaceFor(stage), stage).toBeDefined();
    }
    expect(spaceFor(undefined)).toBeUndefined();
    expect(STAGE_SPACES['chunin-exam-room']).toBe('hall');
    expect(STAGE_SPACES['valley-of-the-end']).toBe('canyon');
    expect(VOICE_SHARE).toBeLessThan(.6);
  });
  it('builds the same normalised, decorrelated impulse response every time, silent through its predelay', () => {
    const space = spaceFor('chunin-exam-room')!, rate = 48000;
    const [left, right] = impulseResponse(space, rate), [again] = impulseResponse(space, rate);
    expect(left.length).toBe(Math.ceil(rate * (space.predelay + space.seconds)));
    expect(Array.from(left.subarray(0, 4000))).toEqual(Array.from(again.subarray(0, 4000)));
    let energy = 0; for (const data of [left, right]) for (const v of data) energy += v * v;
    expect(energy).toBeCloseTo(1, 4);
    const start = Math.round(space.predelay * rate);
    expect(left.subarray(0, start).every(v => v === 0)).toBe(true);
    let dot = 0, l2 = 0, r2 = 0;
    for (let i = start; i < left.length; i++) { dot += left[i] * right[i]; l2 += left[i] ** 2; r2 += right[i] ** 2; }
    expect(Math.abs(dot / Math.sqrt(l2 * r2))).toBeLessThan(.3);
  });
  it('falls about 60 dB over its length, and a canyon rings longer than an open roof', () => {
    const rate = 24000;
    for (const stage of ['chunin-exam-room', 'valley-of-the-end', 'harbor'] as StageId[]) {
      const space = spaceFor(stage)!, [left] = impulseResponse(space, rate), start = Math.round(space.predelay * rate);
      const rms = (from: number, to: number) => { let e = 0; for (let i = from; i < to; i++) e += left[i] ** 2; return Math.sqrt(e / Math.max(1, to - from)); };
      const w = Math.round(.03 * rate), head = rms(start + Math.round(.02 * rate), start + Math.round(.02 * rate) + w);
      const tail = rms(left.length - w, left.length);
      const fall = 20 * Math.log10(head / tail);
      expect(fall, stage).toBeGreaterThan(40); expect(fall, stage).toBeLessThan(75);
    }
    expect(spaceFor('valley-of-the-end')!.seconds).toBeGreaterThan(spaceFor('harbor')!.seconds * 2);
    expect(spaceFor('harbor')!.wet).toBeLessThan(spaceFor('chunin-exam-room')!.wet);
  });
});

describe('the VS splash\'s beats, for the sound', () => {
  const css = fs.readFileSync('src/ui/vsSplash.css', 'utf8');
  const delay = (selector: string, keyframes: string) => {
    const rule = css.slice(css.indexOf(selector)), body = rule.slice(0, rule.indexOf('}'));
    const m = body.match(new RegExp(`${keyframes} ([\\d.]+)s ([\\d.]+)s`));
    expect(m, `${selector} ${keyframes}`).not.toBeNull();
    return { length: Number(m![1]), delay: Number(m![2]) };
  };
  it('stamps the VS as its keyframe lands, and slams the FIGHT! word as it does', () => {
    const stamp = delay('.vs-go .vs-mark{', 'vs-stamp');
    expect(VS_BEATS.stamp).toBeCloseTo(stamp.delay, 3);
    const word = delay('.vs-on .vs-fight-word{', 'vs-word-in');
    expect(VS_BEATS.fightSlam).toBeGreaterThanOrEqual(word.delay + word.length * .7);
    expect(VS_BEATS.fightSlam).toBeLessThanOrEqual(word.delay + word.length + .02);
    expect(VS_BEATS.panels).toBe(0); expect(VS_BEATS.fight).toBe(0);
  });
});

describe('the ultimate\'s name card (ui/CutIn.ts)', async () => {
  const { cutInSide, awakeningCutIn, cutInKey, chooseSpot } = await import('../src/ui/CutIn');
  const { MOVES } = await import('../src/game/moves');
  const ids = Object.keys(MOVES) as (keyof typeof MOVES)[];
  const confirming = ids.find(id => !!MOVES[id].ultimate.confirm)!, plain = ids.find(id => !MOVES[id].ultimate.confirm)!;
  const at = (fighter: keyof typeof MOVES, over: object = {}) => ({ id: 'a', fighter, action: 'ultimate', alive: true, awakened: false, confirmedAt: undefined, target: 'b', ...over }) as Parameters<typeof cutInSide>[0];
  it('names the player\'s own ultimate at its cast - a hit-confirmed one too: the card is the move\'s call, in a corner', () => {
    expect(confirming).toBeDefined(); expect(plain).toBeDefined();
    expect(cutInSide(at(plain), 'a')).toBe('mine');
    expect(cutInSide(at(confirming), 'a')).toBe('mine');
    expect(cutInSide(at(confirming, { confirmedAt: 3 }), 'a')).toBe('mine');
  });
  it('names an opponent\'s only when it has confirmed on the player - never one the player could still dodge', () => {
    expect(cutInSide(at(plain), 'b')).toBeUndefined();
    expect(cutInSide(at(confirming), 'b')).toBeUndefined();
    expect(cutInSide(at(confirming, { confirmedAt: 3 }), 'b')).toBe('theirs');
    expect(cutInSide(at(confirming, { confirmedAt: 3, target: 'c' }), 'b')).toBeUndefined();
  });
  it('names none for another action, a body that is down, or the horde', () => {
    expect(cutInSide(at(plain, { action: 'special' }), 'a')).toBeUndefined();
    expect(cutInSide(at(plain, { alive: false }), 'a')).toBeUndefined();
    expect(cutInSide({ ...at(plain), enemy: 'grunt' }, 'a')).toBeUndefined();
  });
  it('gives the player\'s own transformation one too, and nobody else\'s', () => {
    expect(awakeningCutIn({ id: 'a', action: 'awaken', alive: true }, 'a')).toBe(true);
    expect(awakeningCutIn({ id: 'b', action: 'awaken', alive: true }, 'a')).toBe(false);
    expect(awakeningCutIn({ id: 'a', action: 'ultimate', alive: true }, 'a')).toBe(false);
  });
  it('keys each cast and each transformation apart - a transformation straight after an ultimate keeps its sequence', () => {
    const ult = cutInKey({ action: 'ultimate', actionSeq: 5, actionStarted: 10 }), awaken = cutInKey({ action: 'awaken', actionSeq: 5, actionStarted: 14 });
    expect(awaken).not.toBe(ult);
    expect(cutInKey({ action: 'ultimate', actionSeq: 6, actionStarted: 20 })).not.toBe(ult);
    expect(cutInKey({ action: 'ultimate', actionSeq: 5, actionStarted: 10.2 })).toBe(ult);
  });
  it('stands the card in the first corner clear of the fighters, or the one that covers least of them', () => {
    const box = (left: number, top: number, w = 300, h = 70) => ({ left, top, right: left + w, bottom: top + h });
    const spots = [{ spot: 'll', box: box(50, 760) }, { spot: 'lr', box: box(1250, 640) }, { spot: 'ul', box: box(50, 150) }] as const;
    expect(chooseSpot(spots, [])).toBe('ll');
    expect(chooseSpot(spots, [box(200, 300, 260, 520)])).toBe('lr');
    expect(chooseSpot(spots, [box(200, 300, 260, 520), box(1200, 200, 300, 520)])).toBe('ul');
    expect(chooseSpot(spots, [box(0, 0, 1600, 900), box(40, 750, 100, 40)])).toBe('lr');
  });
});
