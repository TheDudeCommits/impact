import type { StageId } from '../game/stages';
import MANIFEST from './data/ambience.json';

export type AmbienceFile = keyof typeof MANIFEST.files;
export interface AmbienceBed {
  file: AmbienceFile;
  gain: number;
  lowpass?: number; highpass?: number;
  rate?: number;
  wide?: boolean;
  crowd?: boolean;
}
export interface AmbienceAccent {
  files: AmbienceFile[];
  every: [number, number];
  gain: number;
  spread?: number;
  rate?: [number, number];
  excerpt?: number;
  lowpass?: number;
}
export interface AmbienceRecipe { beds: AmbienceBed[]; accents?: AmbienceAccent[] }

export const AMBIENCE_LEVEL = -10;
export const AMBIENCE_FADE = { in: 2.4, out: 1.2 };
export const CHEER = { blow: 7, win: 10, hold: .9, release: 2.6 } as const;

const BIRDS: AmbienceFile[] = ['bird-1', 'bird-2', 'bird-3', 'bird-4', 'bird-5', 'bird-6'];
const FLAGS: AmbienceFile[] = ['flag-1', 'flag-2', 'flag-3'];
const birds = (every: [number, number], gain: number, lowpass?: number): AmbienceAccent => ({ files: BIRDS, every, gain, spread: .85, rate: [.9, 1.12], ...(lowpass ? { lowpass } : {}) });
const flags = (every: [number, number], gain: number): AmbienceAccent => ({ files: FLAGS, every, gain, spread: .7, rate: [.85, 1.1] });
const crows = (every: [number, number], gain: number): AmbienceAccent => ({ files: ['crows'], every, gain, spread: .8, rate: [.92, 1.04], excerpt: 2.6 });
const stands = (gain: number): AmbienceBed => ({ file: 'crowd', gain, wide: true, crowd: true });

export const AMBIENCES: Partial<Record<StageId, AmbienceRecipe>> = {
  'chunin-exam-room': { beds: [{ file: 'room', gain: 0, wide: true }, { file: 'wind', gain: -11, lowpass: 650, rate: .9 }], accents: [birds([10, 22], -15, 4200)] },
  'blood-citadel': { beds: [{ file: 'wind', gain: -4, lowpass: 1300, wide: true }, { file: 'fire', gain: -9 }, { file: 'drone', gain: -15 }], accents: [crows([16, 32], -15)] },
  'chunin-final': { beds: [stands(-1), { file: 'wind', gain: -10, highpass: 120 }], accents: [flags([6, 13], -11), birds([14, 28], -16)] },
  'martial-arts-tournament': { beds: [stands(-1), { file: 'wind', gain: -12, highpass: 120 }], accents: [birds([10, 22], -15), flags([9, 18], -13)] },
  'galactic-arena': { beds: [{ file: 'drone', gain: -5 }, stands(-11)] },
  'valley-of-the-end': { beds: [{ file: 'water', gain: 0, wide: true }, { file: 'wind', gain: -9, highpass: 150 }], accents: [birds([8, 18], -12)] },
  harbor: { beds: [{ file: 'surf', gain: -1, wide: true }, { file: 'wind', gain: -7, highpass: 120 }], accents: [birds([12, 24], -15), flags([10, 20], -14)] },
  'enies-lobby': { beds: [{ file: 'surf', gain: -3, wide: true }, { file: 'wind', gain: -5, highpass: 120 }], accents: [flags([6, 12], -10), birds([10, 20], -15)] },
  'hidden-leaf': { beds: [{ file: 'wind', gain: -6, lowpass: 2400, wide: true }], accents: [birds([4, 11], -10)] },
  'kami-lookout': { beds: [{ file: 'wind', gain: -1, highpass: 260, rate: 1.15, wide: true }], accents: [birds([16, 30], -16)] },
  'hueco-mundo': { beds: [{ file: 'wind', gain: -2, lowpass: 900, rate: .85, wide: true }, { file: 'drone', gain: -12 }] },
  onigashima: { beds: [{ file: 'wind', gain: -6, wide: true }, { file: 'fire', gain: -10 }, { file: 'crackle', gain: -12 }], accents: [crows([20, 36], -17)] },
  shiganshina: { beds: [{ file: 'wind', gain: -6, wide: true }, { file: 'fire', gain: -10 }, { file: 'crackle', gain: -12 }], accents: [crows([14, 28], -15), flags([8, 15], -12)] },
  'malevolent-shrine': { beds: [{ file: 'hell', gain: -2, wide: true }, { file: 'drone', gain: -8 }, { file: 'fire', gain: -12 }], accents: [crows([16, 30], -16)] },
  'null-realm': { beds: [{ file: 'drone', gain: 0, wide: true }] },
  'pains-crater': { beds: [{ file: 'wind', gain: -3, lowpass: 1100, rate: .9, wide: true }, { file: 'crackle', gain: -12 }, { file: 'fire', gain: -15 },
    { file: 'drone', gain: -16 }], accents: [crows([12, 26], -15)] },
  marineford: { beds: [{ file: 'wind', gain: -5, highpass: 140, wide: true }, { file: 'crowd', gain: -16, lowpass: 800 }, { file: 'fire', gain: -13 },
    { file: 'surf', gain: -15, lowpass: 650 }], accents: [birds([9, 18], -14), flags([7, 14], -12)] },
  shibuya: { beds: [{ file: 'wind', gain: -7, lowpass: 1500, wide: true }, { file: 'drone', gain: -9, rate: .85 }, { file: 'fire', gain: -12 }, { file: 'crackle', gain: -14 }], accents: [crows([12, 26], -15)] },
  'infinity-castle': { beds: [{ file: 'room', gain: -2, wide: true, rate: .9 }, { file: 'drone', gain: -8, rate: .7 }, { file: 'wind', gain: -14, lowpass: 520, rate: .8 }] },
  'heavens-arena': { beds: [stands(-1), { file: 'room', gain: -9, wide: true }] },
};

export const ambienceUrl = (file: AmbienceFile) => `/assets/audio/ambience/${file}.m4a`;
export const SPLASHES_BIG = (['splash-big-1', 'splash-big-2'] as AmbienceFile[]).map(ambienceUrl);
export const SPLASHES = [...SPLASHES_BIG];
export const levelOf = (file: AmbienceFile) => 10 ** ((MANIFEST.level - MANIFEST.files[file].lufs) / 20);
export const loopOf = (file: AmbienceFile): [number, number] | undefined => (MANIFEST.files[file] as { loop?: [number, number] }).loop;
export const ambienceFor = (stage: StageId | undefined) => stage ? AMBIENCES[stage] : undefined;
export function filesOf(recipe: AmbienceRecipe) {
  return [...new Set([...recipe.beds.map(bed => bed.file), ...(recipe.accents ?? []).flatMap(accent => accent.files)])];
}
const db = (value: number) => 10 ** (value / 20);

interface Playing { fader: GainNode; sources: AudioBufferSourceNode[]; crowd: GainNode[]; timers: Set<ReturnType<typeof setTimeout>> }

export class StageAmbience {
  private stage?: StageId;
  private playing?: Playing;
  private generation = 0;
  constructor(private readonly context: BaseAudioContext, private readonly output: AudioNode, private readonly load: (url: string) => Promise<AudioBuffer | undefined>,
    private readonly random: () => number = Math.random, private readonly release?: (url: string) => void) {}
  get current() { return this.stage; }
  set(stage: StageId | undefined) {
    if (stage === this.stage) return;
    const before = ambienceFor(this.stage);
    this.stage = stage;
    const generation = ++this.generation;
    this.stop();
    const recipe = ambienceFor(stage);
    if (before && this.release) {
      const kept = new Set(recipe ? filesOf(recipe) : []), release = this.release;
      const gone = filesOf(before).filter(file => !kept.has(file));
      setTimeout(() => { if (generation === this.generation) for (const file of gone) release(ambienceUrl(file)); }, (AMBIENCE_FADE.out * 1.5 + .2) * 1000);
    }
    if (!recipe) return;
    void Promise.all(filesOf(recipe).map(async file => [file, await this.load(ambienceUrl(file))] as const)).then(loaded => {
      if (generation !== this.generation) return;
      this.start(recipe, new Map(loaded.filter((entry): entry is readonly [AmbienceFile, AudioBuffer] => !!entry[1])));
    });
  }
  cheer(worth = 1, win = false) {
    const playing = this.playing;
    if (!playing?.crowd.length) return;
    const now = this.context.currentTime, swell = db((win ? CHEER.win : CHEER.blow) * Math.max(.5, Math.min(1.4, worth)));
    for (const gain of playing.crowd) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(swell, now, .09);
      gain.gain.setTargetAtTime(1, now + (win ? CHEER.hold * 2.5 : CHEER.hold), CHEER.release / 3);
    }
  }
  dispose() { this.generation++; this.stage = undefined; this.stop(); }

  private start(recipe: AmbienceRecipe, buffers: Map<AmbienceFile, AudioBuffer>) {
    const ctx = this.context, now = ctx.currentTime, fader = ctx.createGain();
    fader.gain.value = 0; fader.connect(this.output);
    fader.gain.setTargetAtTime(db(AMBIENCE_LEVEL), now, AMBIENCE_FADE.in / 3);
    const playing: Playing = { fader, sources: [], crowd: [], timers: new Set() };
    this.playing = playing;
    for (const bed of recipe.beds) {
      const buffer = buffers.get(bed.file), loop = loopOf(bed.file);
      if (!buffer || !loop) continue;
      const level = ctx.createGain(), swell = ctx.createGain();
      level.gain.value = db(bed.gain) * levelOf(bed.file) * (bed.wide ? db(-3) : 1);
      let into: AudioNode = level;
      level.connect(swell).connect(fader);
      if (bed.crowd) playing.crowd.push(swell);
      for (const [type, frequency] of [['lowpass', bed.lowpass], ['highpass', bed.highpass]] as const) {
        if (!frequency || typeof ctx.createBiquadFilter !== 'function') continue;
        const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = frequency; filter.Q.value = .7;
        filter.connect(into); into = filter;
      }
      const copies = bed.wide ? [-.6, .6] : [0], span = loop[1] - loop[0];
      copies.forEach((pan, k) => {
        const source = ctx.createBufferSource(), panner = ctx.createStereoPanner();
        source.buffer = buffer; source.loop = true; source.loopStart = loop[0]; source.loopEnd = loop[1];
        source.playbackRate.value = bed.rate ?? 1; panner.pan.value = pan;
        source.connect(panner).connect(into);
        source.start(now, loop[0] + ((this.random() + k * .5) % 1) * span);
        playing.sources.push(source);
      });
    }
    for (const accent of recipe.accents ?? []) this.schedule(playing, accent, buffers, true);
  }
  private schedule(playing: Playing, accent: AmbienceAccent, buffers: Map<AmbienceFile, AudioBuffer>, first = false) {
    const [low, high] = accent.every, wait = (low + this.random() * (high - low)) * (first ? .5 : 1);
    const timer = setTimeout(() => {
      playing.timers.delete(timer);
      if (this.playing !== playing) return;
      this.accent(playing, accent, buffers);
      this.schedule(playing, accent, buffers);
    }, wait * 1000);
    playing.timers.add(timer);
  }
  private accent(playing: Playing, accent: AmbienceAccent, buffers: Map<AmbienceFile, AudioBuffer>) {
    const ctx = this.context;
    if ((ctx as AudioContext).state && (ctx as AudioContext).state !== 'running') return;
    const file = accent.files[Math.floor(this.random() * accent.files.length) % accent.files.length], buffer = buffers.get(file);
    if (!buffer) return;
    const now = ctx.currentTime, source = ctx.createBufferSource(), gain = ctx.createGain(), panner = ctx.createStereoPanner();
    const [slow, fast] = accent.rate ?? [1, 1], rate = slow + this.random() * (fast - slow);
    source.buffer = buffer; source.playbackRate.value = rate;
    panner.pan.value = (this.random() * 2 - 1) * (accent.spread ?? 0);
    const level = db(accent.gain) * levelOf(file);
    let into: AudioNode = gain;
    if (accent.lowpass && typeof ctx.createBiquadFilter === 'function') { const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = accent.lowpass; filter.connect(gain); into = filter; }
    source.connect(into); gain.connect(panner).connect(playing.fader);
    if (accent.excerpt) {
      const length = Math.min(accent.excerpt, buffer.duration), from = this.random() * Math.max(0, buffer.duration - length);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + .25);
      gain.gain.setValueAtTime(level, now + length / rate - .6); gain.gain.linearRampToValueAtTime(0, now + length / rate);
      source.start(now, from, length);
    } else {
      gain.gain.value = level;
      source.start(now);
    }
    source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); };
  }
  private stop() {
    const playing = this.playing;
    if (!playing) return;
    this.playing = undefined;
    for (const timer of playing.timers) clearTimeout(timer);
    const now = this.context.currentTime;
    playing.fader.gain.cancelScheduledValues(now);
    playing.fader.gain.setTargetAtTime(0, now, AMBIENCE_FADE.out / 3);
    for (const source of playing.sources) { try { source.stop(now + AMBIENCE_FADE.out * 1.5); } catch { } }
    setTimeout(() => playing.fader.disconnect(), (AMBIENCE_FADE.out * 1.5 + .1) * 1000);
  }
}
