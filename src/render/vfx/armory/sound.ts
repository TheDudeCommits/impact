import { ARMORY_SOUND_NAMES, ARMORY_SOUND_PROFILES, loadRecipes } from './vendor/sounds';
import type { ArmorySoundLayer, ArmorySoundName, ArmorySoundProfile } from './types';
import { armorySoundOut, type ArmorySoundOut, type SoundAt } from './soundOut';


export type SoundMode = 'bed' | 'full';

export const ARMORY_TO_GAME = 1.3;
export const LEVEL: Readonly<Record<SoundMode, number>> = Object.freeze({ bed: .5, full: .7 });
const JITTER = .06;
const PRIORITY = -1;
const OWNER = 'armory';
export const SEGMENT = .9, OVERLAP = .2;
const LOOKAHEAD = .12;
const SEGMENTABLE = new Set(['fire', 'wind', 'static', 'surf', 'hiss', 'rustle']);
const VARIANTS = 3, LOOP_VARIANTS = 3;
const RATE = 48000;
export const CHUNK = 8;
const START = .05, GAP = .25;
const SLICE_MS = 4, RUSH_SLICE_MS = 12;
const BLOCK = 16384;
export const PACE = 4, RUSH_PACE = 24, PACE_GAP = .03;
export const RETRY = 2;
const clock = () => (typeof performance === 'object' ? performance.now() : Date.now()) / 1000;
const ms = () => (typeof performance === 'object' ? performance.now() : Date.now());
const soon = () => new Promise<void>(resolve => setTimeout(resolve, 0));
export const idle = () => new Promise<void>(resolve => {
  const ric = (globalThis as { requestIdleCallback?: (done: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === 'function') { ric(() => resolve(), { timeout: 120 }); return; }
  let done = false;
  const go = () => { if (!done) { done = true; resolve(); } };
  const raf = (globalThis as { requestAnimationFrame?: (fn: () => void) => number }).requestAnimationFrame;
  if (typeof raf === 'function') raf(() => setTimeout(go, 0));
  setTimeout(go, 120);
});

export class Slices {
  private since = ms();
  constructor(private readonly rushing: () => boolean = () => false, private readonly pause?: () => Promise<void>) {}
  async tick() {
    const rush = this.rushing();
    if (ms() - this.since < (rush ? RUSH_SLICE_MS : SLICE_MS)) return;
    await (this.pause ? this.pause() : rush ? soon() : idle());
    this.since = ms();
  }
}

export const segmentable = (name: ArmorySoundName | undefined) => !!name && name.loop && (name.type === 'sample' || SEGMENTABLE.has(name.recipe));

export function voicedLayers(profile: ArmorySoundProfile, mode: SoundMode, names: Readonly<Record<string, ArmorySoundName>> = ARMORY_SOUND_NAMES): ArmorySoundLayer[] {
  const loop = (profile.loop?.layers ?? []).filter(l => segmentable(names[l.sound]));
  if (mode === 'bed') return [...loop, ...(profile.tail ?? [])];
  return [...(profile.cast ?? []), ...(profile.charge ?? []), ...loop, ...(profile.impacts ?? []).flatMap(i => i.layers), ...(profile.tail ?? [])];
}

const keyOf = (layer: ArmorySoundLayer, name: ArmorySoundName) => name.type === 'synth' ? JSON.stringify([layer.sound, layer.gain, layer.pitch ?? 1, layer.params ?? {}]) : layer.sound;

interface Variants { readonly urls: readonly string[]; readonly gains: readonly number[]; last: number }

type Recipes = Awaited<ReturnType<NonNullable<typeof loadRecipes>>>;
type Kit = ReturnType<Recipes['makeKit']>;
type SynthJob = [string, ArmorySoundLayer, Extract<ArmorySoundName, { type: 'synth' }>];
interface Piece { readonly key: string; readonly layer: ArmorySoundLayer; readonly recipe: string; readonly loop: boolean; readonly at: number; readonly length: number }

export function planRenders(jobs: readonly SynthJob[], recipes: Pick<Recipes, 'RECIPES' | 'RECIPE_INFO'>, limit = CHUNK): Piece[][] {
  const plan: Piece[][] = [];
  let chunk: Piece[] = [], t = START;
  for (const [key, layer, name] of jobs) {
    if (!recipes.RECIPES[name.recipe]) continue;
    const dur = Number(layer.params?.dur ?? name.params.dur ?? recipes.RECIPE_INFO[name.recipe]?.params.dur ?? 1);
    const length = name.loop ? LOOP_VARIANTS * SEGMENT + .4 : dur * 1.25 + .35, variants = name.loop ? 1 : VARIANTS;
    if (chunk.length && t + variants * (length + GAP) > limit) { plan.push(chunk); chunk = []; t = START; }
    for (let v = 0; v < variants; v++) { chunk.push({ key, layer, recipe: name.recipe, loop: name.loop, at: t, length }); t += length + GAP; }
  }
  if (chunk.length) plan.push(chunk);
  return plan;
}

export class SoundBank {
  private readonly made = new Map<string, Variants>();
  private readonly asked = new Map<string, { layer: ArmorySoundLayer; name: ArmorySoundName }>();
  private work: Promise<void> = Promise.resolve();
  private format?: Promise<'ogg' | 'mp3'>;
  private readonly urls = new Set<string>();
  private pumpedAt = -Infinity;
  private loaded = false;
  private kit?: Kit;
  private readonly handed = new Map<string, number>();
  private backlog = false;
  rushing = 0;

  constructor(private readonly options: { readonly pause?: () => Promise<void> } = {}) {}

  need(effectId: string, mode: SoundMode) {
    const profile = ARMORY_SOUND_PROFILES[effectId];
    if (!profile) return;
    for (const layer of voicedLayers(profile, mode)) {
      const name = ARMORY_SOUND_NAMES[layer.sound];
      if (!name) continue;
      const key = keyOf(layer, name);
      if (!this.made.has(key)) this.asked.set(key, { layer, name });
    }
  }

  prepare() {
    this.work = this.work.then(() => this.make()).catch(error => console.warn('armory sound: could not prepare', error));
    return this.work;
  }

  private async make() {
    const jobs = [...this.asked]; this.asked.clear();
    if (!jobs.length || typeof OfflineAudioContext !== 'function') return;
    const slices = new Slices(() => this.rushing > 0, this.options.pause);
    const synth: SynthJob[] = [];
    for (const [key, { layer, name }] of jobs) {
      if (this.made.has(key)) continue;
      if (name.type === 'synth') { synth.push([key, layer, name]); continue; }
      const format = await (this.format ??= probeFormat(name));
      if (!name.loop) { this.add(key, name.files.map(f => `${f}.${format}`), name.files.map(() => 1)); continue; }
      const data = await decode(`${name.files[0]}.${format}`);
      if (data) this.add(key, ...await encode(segments(data, true), slices));
    }
    if (synth.length && loadRecipes) await this.renderSynth(synth, await loadRecipes(), slices);
  }

  private async renderSynth(jobs: readonly SynthJob[], recipes: Recipes, slices: Slices) {
    for (const chunk of planRenders(jobs, recipes)) {
      const last = chunk[chunk.length - 1];
      const ctx = new OfflineAudioContext(1, Math.ceil((last.at + last.length + GAP) * RATE), RATE);
      const base = (this.kit ??= recipes.makeKit(ctx)), kit = base.ac === ctx ? base : { ...base, ac: ctx };
      await slices.tick();
      for (const piece of chunk) {
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        const voice = recipes.RECIPES[piece.recipe](kit, gain, piece.at, { ...piece.layer.params, g: piece.layer.gain, pitch: piece.layer.pitch ?? 1, ...(piece.loop ? { fadeIn: .01 } : {}) });
        voice.stop?.(piece.at + piece.length, .02);
        await slices.tick();
      }
      const data = (await ctx.startRendering()).getChannelData(0);
      const out = new Map<string, Float32Array[]>();
      for (const piece of chunk) {
        const a = Math.round(piece.at * RATE), list = out.get(piece.key) ?? [];
        if (piece.loop) list.push(...segments(data, false, a + Math.round(.3 * RATE)));
        else {
          let end = a + Math.round(piece.length * RATE);
          while (end > a + 1 && Math.abs(data[end - 1]) < 1e-4) end--;
          const one = data.slice(a, Math.min(end + Math.round(.01 * RATE), data.length));
          const tail = Math.min(one.length, Math.round(.005 * RATE));
          for (let i = 0; i < tail; i++) one[one.length - 1 - i] *= i / tail;
          list.push(one);
        }
        out.set(piece.key, list);
        await slices.tick();
      }
      for (const [key, pieces] of out) this.add(key, ...await encode(pieces, slices));
    }
  }

  provide(layer: ArmorySoundLayer, urls: readonly string[], gains: readonly number[] = urls.map(() => 1)) {
    const name = ARMORY_SOUND_NAMES[layer.sound];
    if (name) this.add(keyOf(layer, name), urls, gains);
  }

  private add(key: string, urls: readonly string[], gains: readonly number[]) {
    if (!urls.length) return;
    this.made.set(key, { urls, gains, last: -1 });
    for (const url of urls) this.urls.add(url);
    this.loaded = false;
  }

  pump(out: ArmorySoundOut, now = clock()) {
    if (this.loaded || now - this.pumpedAt < (this.backlog ? PACE_GAP : .5)) return;
    this.pumpedAt = now;
    const missing = [...this.urls].filter(url => out.sampleSeconds(url) === undefined);
    if (!missing.length) { this.loaded = this.urls.size > 0; this.backlog = false; return; }
    const waiting = missing.filter(url => now - (this.handed.get(url) ?? -Infinity) >= RETRY), give = waiting.slice(0, this.rushing > 0 ? RUSH_PACE : PACE);
    for (const url of give) this.handed.set(url, now);
    if (give.length) out.preload(give);
    this.backlog = give.length < waiting.length;
  }

  retain(keep: Iterable<string>): string[] {
    const wanted = new Set<string>();
    for (const id of keep) {
      const profile = ARMORY_SOUND_PROFILES[id];
      if (!profile) continue;
      for (const mode of ['bed', 'full'] as const) for (const layer of voicedLayers(profile, mode)) { const name = ARMORY_SOUND_NAMES[layer.sound]; if (name) wanted.add(keyOf(layer, name)); }
    }
    const released: string[] = [];
    for (const [key, variants] of [...this.made]) {
      if (wanted.has(key)) continue;
      this.made.delete(key);
      for (const url of variants.urls) { this.urls.delete(url); this.handed.delete(url); released.push(url); if (url.startsWith('blob:')) { try { URL.revokeObjectURL(url); } catch { } } }
    }
    for (const key of [...this.asked.keys()]) if (!wanted.has(key)) this.asked.delete(key);
    return released;
  }

  settled(out: ArmorySoundOut) { return !this.asked.size && [...this.urls].every(url => out.sampleSeconds(url) !== undefined); }

  pick(layer: ArmorySoundLayer, out: ArmorySoundOut): { url: string; gain: number } | undefined {
    const name = ARMORY_SOUND_NAMES[layer.sound];
    const v = name && this.made.get(keyOf(layer, name));
    if (!v) return undefined;
    const n = v.urls.length;
    let i = Math.floor(Math.random() * n);
    if (n > 1 && i === v.last) i = (i + 1) % n;
    for (let k = 0; k < n; k++, i = (i + 1) % n) {
      if (out.sampleSeconds(v.urls[i]) === undefined) continue;
      v.last = i;
      return { url: v.urls[i], gain: v.gains[i] };
    }
    return undefined;
  }

  get addresses(): readonly string[] { return [...this.urls]; }
  get pending() { return this.asked.size; }
}

let bank: SoundBank | undefined;
export const soundBank = () => (bank ??= new SoundBank());

async function probeFormat(name: Extract<ArmorySoundName, { type: 'sample' }>): Promise<'ogg' | 'mp3'> {
  if (!name.formats.includes('ogg')) return 'mp3';
  if (!name.formats.includes('mp3')) return 'ogg';
  return (await decode(`${name.files[0]}.ogg`)) ? 'ogg' : 'mp3';
}

async function decode(url: string): Promise<Float32Array | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const buffer = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(await response.arrayBuffer());
    return buffer.getChannelData(0).slice();
  } catch { return undefined; }
}

export function segments(data: Float32Array, wrap: boolean, from = 0): Float32Array[] {
  const n = Math.round(SEGMENT * RATE), fade = Math.round(OVERLAP * RATE), out: Float32Array[] = [];
  for (let v = 0; v < LOOP_VARIANTS; v++) {
    const start = wrap ? Math.floor(Math.random() * data.length) : from + v * n;
    const piece = new Float32Array(n);
    for (let i = 0; i < n; i++) piece[i] = data[(start + i) % data.length] ?? 0;
    for (let i = 0; i < fade; i++) {
      const k = Math.sin(Math.PI / 2 * i / fade);
      piece[i] *= k; piece[n - 1 - i] *= k;
    }
    out.push(piece);
  }
  return out;
}

async function encode(pieces: readonly Float32Array[], slices?: Slices): Promise<[string[], number[]]> {
  const urls: string[] = [], gains: number[] = [];
  for (const piece of pieces) {
    let peak = 0;
    for (let from = 0; from < piece.length; from += BLOCK) {
      for (let i = from, to = Math.min(piece.length, from + BLOCK); i < to; i++) { const x = Math.abs(piece[i]); if (x > peak) peak = x; }
      await slices?.tick();
    }
    if (peak < 1e-5) continue;
    const k = .98 / peak;
    urls.push(URL.createObjectURL(await wavSliced(piece, RATE, k, slices)));
    gains.push(1 / k);
  }
  return [urls, gains];
}

const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

function wavFrame(n: number, rate: number) {
  const buffer = new ArrayBuffer(44 + n * 2), v = new DataView(buffer);
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, n * 2, true);
  return { buffer, v, pcm: LITTLE_ENDIAN ? new Int16Array(buffer, 44, n) : undefined };
}

function wavFill({ v, pcm }: ReturnType<typeof wavFrame>, data: Float32Array, k: number, from: number, to: number) {
  if (pcm) for (let i = from; i < to; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, data[i] * k)) * 0x7fff);
  else for (let i = from; i < to; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, data[i] * k)) * 0x7fff), true);
}

export function wav(data: Float32Array, rate: number, k = 1) {
  const frame = wavFrame(data.length, rate);
  wavFill(frame, data, k, 0, data.length);
  return new Blob([frame.buffer], { type: 'audio/wav' });
}

async function wavSliced(data: Float32Array, rate: number, k: number, slices?: Slices) {
  const frame = wavFrame(data.length, rate);
  for (let from = 0; from < data.length; from += BLOCK) { wavFill(frame, data, k, from, Math.min(data.length, from + BLOCK)); await slices?.tick(); }
  return new Blob([frame.buffer], { type: 'audio/wav' });
}

interface Sent { t: number; effect: string; sound: string; url: string; gain: number; rate: number; delay: number }
const SENT_CAP = 600;

export class CastSound {
  private loops: { layer: ArmorySoundLayer; next: number }[] | null = null;
  private loopAt = 0;
  private lastImpact = -Infinity;
  private fired = 0;
  private pending = 0;
  private released = false;
  private tailDone = false;
  private phaseImpactAt = 0;
  private ended = false;

  constructor(private readonly player: ArmorySound, readonly effectId: string, readonly profile: ArmorySoundProfile, readonly mode: SoundMode, private at: SoundAt, now = clock()) {
    if (mode === 'full') { this.cue(profile.cast, 1); this.cue(profile.charge, 1); }
    if (profile.loop?.at === 'cast') this.startLoop(now);
  }

  phase(phase: string, now = clock()) {
    const loop = this.profile.loop;
    if (phase === 'impact') {
      this.phaseImpactAt = now;
      if (loop?.at === 'impact') this.startLoop(now);
      if (loop?.until === 'impact') this.stopLoop(now);
    } else if (phase === 'fade') {
      if (loop?.until === 'fade' || loop?.until === 'impact') this.stopLoop(now);
      this.tail();
    }
  }

  event(intensity: number) { if (intensity > this.pending) this.pending = intensity; }

  tick(at: SoundAt, now = clock()) {
    if (this.ended) return;
    this.at = at;
    const P = this.profile;
    if (this.pending > 0) {
      const hit = P.impacts?.find(i => i.on === 'hit'), gap = hit?.gap ?? .09;
      if ((now - this.lastImpact >= gap || this.pending > .85) && this.pending >= (hit?.min ?? .06)) this.impact(this.pending, now);
      this.pending = 0;
    }
    if (this.phaseImpactAt && now - this.phaseImpactAt > .07) {
      if (now - this.lastImpact > .3) this.impact(.6, now);
      this.phaseImpactAt = 0;
    }
    if (P.tail && !this.tailDone && this.fired > 0 && now - this.lastImpact > .9) this.tail();
    if (this.loops?.length && P.loop && now - this.loopAt > P.loop.max) this.stopLoop(now);
    this.lay(now);
  }

  end(now = clock()) { this.stopLoop(now); this.ended = true; }

  get looping() { return !!this.loops?.length; }
  get hits() { return this.fired; }

  private impact(intensity: number, now: number) {
    this.lastImpact = now; this.fired++;
    const P = this.profile, first = P.impacts?.find(i => i.on === 'first'), hit = P.impacts?.find(i => i.on === 'hit');
    if (!this.released) {
      this.released = true;
      if (P.loop?.at === 'release') this.startLoop(now);
      if (first) { if (this.mode === 'full') this.cue(first.layers, Math.max(.6, intensity)); return; }
    }
    if (this.fired > 12 && this.fired % 2 === 1 && intensity < .7) return;
    if (this.mode === 'full' && hit) this.cue(hit.layers, intensity);
  }

  private tail() {
    if (this.tailDone) return;
    this.tailDone = true;
    this.cue(this.profile.tail, 1);
  }

  private cue(layers: readonly ArmorySoundLayer[] | undefined, intensity: number) {
    const scale = .45 + .55 * Math.min(1.1, intensity);
    for (const layer of layers ?? []) {
      if (layer.minIntensity && intensity < layer.minIntensity) continue;
      if (layer.maxIntensity && intensity > layer.maxIntensity) continue;
      this.player.play(this.effectId, layer, scale * LEVEL[this.mode], this.at);
    }
  }

  private startLoop(now: number) {
    if (this.loops || this.ended) return;
    this.loopAt = now;
    this.loops = (this.profile.loop?.layers ?? []).filter(l => segmentable(ARMORY_SOUND_NAMES[l.sound])).map(layer => ({ layer, next: now + (layer.delay ?? 0) }));
    this.lay(now);
  }

  private stopLoop(now = clock()) {
    const loops = this.loops, fade = this.profile.loop?.fade ?? 0;
    this.loops = [];
    if (!loops?.length || fade <= SEGMENT - OVERLAP) return;
    for (const loop of loops) {
      for (let at = Math.max(loop.next, now); at < now + fade; at += SEGMENT - OVERLAP) {
        const k = 1 - (at - now) / fade;
        if (k < .08) break;
        this.player.segment(this.effectId, loop.layer, LEVEL[this.mode] * k, this.at, Math.max(0, at - now));
      }
    }
  }

  private lay(now: number) {
    for (const loop of this.loops ?? []) {
      if (loop.next < now - SEGMENT) loop.next = now;
      while (loop.next - now < LOOKAHEAD) {
        this.player.segment(this.effectId, loop.layer, LEVEL[this.mode], this.at, Math.max(0, loop.next - now));
        loop.next += SEGMENT - OVERLAP;
      }
    }
  }
}

export class ArmorySound {
  readonly sent: Sent[] = [];
  constructor(readonly out: ArmorySoundOut, readonly bank: SoundBank = soundBank()) {}

  begin(effectId: string, mode: SoundMode, at: SoundAt, now = clock()): CastSound | undefined {
    const profile = ARMORY_SOUND_PROFILES[effectId];
    if (!profile || !soundWanted()) return undefined;
    this.bank.pump(this.out, now);
    return new CastSound(this, effectId, profile, mode, at, now);
  }

  play(effectId: string, layer: ArmorySoundLayer, level: number, at: SoundAt) {
    const voice = this.bank.pick(layer, this.out);
    if (!voice) return;
    const sample = ARMORY_SOUND_NAMES[layer.sound]?.type === 'sample';
    const rate = sample ? (layer.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * JITTER) : 1;
    this.send(effectId, layer.sound, voice.url, at, layer.gain * level * voice.gain * ARMORY_TO_GAME, rate, layer.delay ?? 0);
  }

  segment(effectId: string, layer: ArmorySoundLayer, level: number, at: SoundAt, delay: number) {
    const voice = this.bank.pick(layer, this.out);
    if (!voice) return;
    const sample = ARMORY_SOUND_NAMES[layer.sound]?.type === 'sample';
    this.send(effectId, layer.sound, voice.url, at, layer.gain * level * voice.gain * ARMORY_TO_GAME, sample ? layer.pitch ?? 1 : 1, delay);
  }

  private send(effect: string, sound: string, url: string, at: SoundAt, gain: number, rate: number, delay: number) {
    this.out.sample(url, at, gain, rate, OWNER, PRIORITY, delay);
    this.sent.push({ t: clock(), effect, sound, url, gain, rate, delay });
    if (this.sent.length > SENT_CAP) this.sent.splice(0, this.sent.length - SENT_CAP);
  }
}

let player: ArmorySound | undefined;
export function armorySound(): ArmorySound | undefined {
  const out = armorySoundOut();
  if (!out) return undefined;
  if (!player || player.out !== out) {
    player = new ArmorySound(out);
    if (typeof window === 'object' && window) (window as unknown as { __armorySound?: unknown }).__armorySound = player;
  }
  return player;
}

function soundWanted() {
  let dev = false;
  try { dev = import.meta.env.DEV === true; } catch { dev = false; }
  if (!dev || typeof location !== 'object' || !location) return true;
  try { return new URLSearchParams(location.search).get('armory-sound') !== 'off'; } catch { return true; }
}
