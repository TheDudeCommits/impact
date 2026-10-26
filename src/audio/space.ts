import type { StageId } from '../game/stages';

export interface Space {
  seconds: number;
  predelay: number;
  wet: number;
  damping: number;
  early: number;
}

export const VOICE_SHARE = .45;

const SPACES = {
  hall: { seconds: 1.25, predelay: .012, wet: .17, damping: .55, early: .8 },
  keep: { seconds: 1.9, predelay: .025, wet: .14, damping: .5, early: .6 },
  stadium: { seconds: 1.7, predelay: .035, wet: .1, damping: .6, early: .3 },
  canyon: { seconds: 2.4, predelay: .045, wet: .15, damping: .55, early: .5 },
  open: { seconds: .8, predelay: .02, wet: .07, damping: .7, early: .2 },
  void: { seconds: 2.8, predelay: .05, wet: .16, damping: .72, early: 0 },
} as const satisfies Record<string, Space>;
export type SpaceName = keyof typeof SPACES;

export const STAGE_SPACES: Partial<Record<StageId, SpaceName>> = {
  'chunin-exam-room': 'hall',
  'blood-citadel': 'keep',
  'chunin-final': 'stadium',
  'martial-arts-tournament': 'stadium',
  'galactic-arena': 'stadium',
  'valley-of-the-end': 'canyon',
  harbor: 'open',
  'enies-lobby': 'open',
  'hidden-leaf': 'open',
  'kami-lookout': 'open',
  'hueco-mundo': 'open',
  onigashima: 'open',
  shiganshina: 'open',
  'malevolent-shrine': 'void',
  'null-realm': 'void',
  marineford: 'open',
  shibuya: 'stadium',
  'infinity-castle': 'keep',
  'pains-crater': 'canyon',
  'heavens-arena': 'keep',
};

export function spaceFor(stage: StageId | undefined): Space | undefined {
  const name = stage ? STAGE_SPACES[stage] : undefined;
  return name ? SPACES[name] : undefined;
}
export function spaceName(stage: StageId | undefined): SpaceName | undefined { return stage ? STAGE_SPACES[stage] : undefined; }

function random(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function impulseResponse(space: Space, rate: number, seed = 1): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const length = Math.max(1, Math.ceil(rate * (space.predelay + space.seconds)));
  const out: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [new Float32Array(length), new Float32Array(length)];
  const start = Math.round(space.predelay * rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = out[channel], next = random(seed * 7919 + channel * 104729 + Math.round(space.seconds * 1000));
    let low = 0;
    for (let i = start; i < length; i++) {
      const t = (i - start) / rate, age = t / space.seconds;
      const envelope = Math.pow(10, -3 * age);
      const close = Math.min(.96, space.damping * age * 1.4);
      low = low * close + (next() * 2 - 1) * (1 - close);
      data[i] = low * envelope * Math.min(1, (t + 1e-4) / .004);
    }
    const taps = Math.round(space.early * 9);
    for (let k = 0; k < taps; k++) {
      const at = start + Math.round((.004 + next() * .055) * rate);
      if (at < length) data[at] += (next() < .5 ? -1 : 1) * (.55 + next() * .45) * space.early * Math.pow(10, -3 * ((at - start) / rate) / space.seconds);
    }
  }
  let energy = 0;
  for (const data of out) for (let i = 0; i < data.length; i++) energy += data[i] * data[i];
  const scale = energy > 0 ? 1 / Math.sqrt(energy) : 0;
  for (const data of out) for (let i = 0; i < data.length; i++) data[i] *= scale;
  return out;
}
