import type { CombatEvent, PlayerState, Vec3 } from '../game/types';
import { AUDIO_CUES, planCombatAudio, type AudioCue, type CueLayer } from './cuePlan';
import CUE_ONSETS from './data/cueOnsets.json';
import { FIGHTERS } from '../config';
import { SFX_PEAKS } from './sfxCues';
import { impulseResponse, spaceFor, spaceName, VOICE_SHARE, type SpaceName } from './space';
import { StageAmbience } from './ambience';
import { LIQUID_FLOORS, onLiquid, type LiquidFloor } from '../game/footing';
import { SPLASHES, SPLASHES_BIG } from './ambience';
import { QuipDirector } from './QuipDirector';
import { FIGHTER_QUIPS } from './quipCues';
import { SITUATION_RULES, isRift, lineSeconds, riftUrl, situationLayer, situationLines, situationSamples, type SituationLine, type VoiceSituation } from './voiceSituations';
import type { FighterId } from '../game/types';
const FALLS = new Set<PlayerState['action']>(['launched', 'knockdown']);
import type { StageId } from '../game/stages';
import { AWAKENINGS, awakeningSwapAt } from '../game/awakening';
import { OWN_ENTRANCES } from '../game/powerUp';
import { POWER_SOUNDS, powerVoice } from './powerSound';
import { holdAt } from './holdParam';
import { trimAac } from './aacTrim';
import { wakeOnReturn } from './wake';
import { byNeed, fighterCues } from './roomCues';
import { GIANT, STEPS, surfaceAt, weightGain, weightNow, weightRate } from './floors';

export function auraVoice(p: PlayerState): { cue: AudioCue; level: number; rate: number } | undefined {
  if (!p.alive || p.enemy || !AWAKENINGS[p.fighter]) return undefined;
  const voice = powerVoice(p.fighter);
  if (!voice) return undefined;
  const sound = POWER_SOUNDS[voice.kind];
  let level = 0;
  if (p.action === 'awaken') {
    if (OWN_ENTRANCES.has(p.fighter)) return undefined;
    const t = p.actionTime * p.actionDuration, swap = awakeningSwapAt(p.fighter);
    level = sound.entry * (t < swap ? .3 + .7 * Math.pow(t / Math.max(.05, swap), 1.5) : 1);
  } else if (p.awakened && voice.stands) level = sound.hold;
  return level > 0 ? { cue: sound.loop, level: level * voice.level, rate: voice.rate } : undefined;
}
export const auraRoar = (p: PlayerState) => auraVoice(p)?.level ?? 0;
const AURA_VOICES = 4, AURA_RANGE = 30;
const STEP_RANGE = 16, STEP_GAP = .16;

const CAST_MATCH = .3;
const CAST_CONFIRM = 1.2;
const NEUTRAL = new Set(['idle', 'run', 'jump', 'guard']);

const FIGHTER_IDS = Object.keys(FIGHTERS).sort((a, b) => b.length - a.length);
export function cueFighter(cue: string): string | undefined {
  const name = cue.startsWith('vo-') ? cue.slice(3) : cue;
  return FIGHTER_IDS.find(id => name.startsWith(id + '-'));
}
type PackedBank = Record<string, [number, number]>;
const VOICE_DUCK = .72, DUCK_DOWN = .04, DUCK_UP = .18, DUCK_LEAD = .08;

interface ActiveSound { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; priority: number; owner: string; bus: 'sfx' | 'voice'; phase?: CueLayer['phase']; stopping: boolean; sequence?:number; start: number; level: number; end: number }
export interface AudioMix { master: number; sfx: number; voice: number }

export class CombatAudio {
  onVoiceActivity?: (active: boolean) => void;
  private context?: AudioContext;
  private master?: GainNode;
  private musicSources=new Map<HTMLAudioElement,MediaElementAudioSourceNode>();
  private sfx?: GainNode;
  private speech?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private reverb?: { sfx: GainNode; speech: GainNode; convolver: ConvolverNode; out: GainNode };
  private irs = new Map<SpaceName, AudioBuffer>();
  private stage?: StageId;
  private ambienceBus?: GainNode;
  private ambience?: StageAmbience;
  private ambienceStage?: StageId;
  private loading?: Promise<void>;
  private mix: AudioMix = { master: .5, sfx: .85, voice: 1 };
  private buffers = new Map<AudioCue, AudioBuffer>();
  private samples = new Map<string, AudioBuffer>();
  private sampleLoads = new Map<string, Promise<void>>();
  private sounds = new Set<ActiveSound>();
  private seen = new Set<number>();
  private dashStates = new Map<string, number>();
  private casts = new Map<string, { started?: number; before: number; announced: number; slot: string; released: boolean }>();
  private latestPlayers: PlayerState[] = [];
  private selfId = '';
  private dead = false;
  private voiceActive = false;
  private duckAt?: number;
  private duckTimer?: ReturnType<typeof setTimeout>;
  private abort = new AbortController();
  constructor(private readonly options: { byRoom?: boolean } = {}) {}
  private wanted = new Set<string>();
  private needed = new Set<AudioCue>();
  private cueLoads = new Map<AudioCue, Promise<void>>();
  private packed?: Promise<PackedBank | null>;
  private wavOnly = false;
  private quips = new QuipDirector();
  private held: Promise<void> | undefined;
  holdFetches(until: Promise<unknown>, cap: number) {
    const hold = Promise.race([until.then(() => {}, () => {}), new Promise<void>(done => setTimeout(done, cap))]);
    this.held = hold;
    void hold.then(() => { if (this.held === hold) this.held = undefined; });
  }
  private async download(url: string, init: RequestInit, what: string): Promise<ArrayBuffer> {
    if (this.held) await this.held;
    const response = await fetch(url, init);
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error(`Could not load sound: ${what}`);
    return await response.arrayBuffer();
  }

  async unlock(): Promise<void> {
    if (this.dead) return;
    if (!this.context) {
      if (!globalThis.AudioContext) throw new Error('Web Audio is unavailable in this browser');
      this.context = new AudioContext({ latencyHint: 'interactive' });
      wakeOnReturn(() => this.context, () => !this.dead);
      this.master = this.context.createGain(); this.sfx = this.context.createGain(); this.speech = this.context.createGain();
      this.master.gain.value = this.mix.master; this.sfx.gain.value = this.mix.sfx; this.speech.gain.value = this.mix.voice;
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -9; this.compressor.knee.value = 10; this.compressor.ratio.value = 4;
      this.compressor.attack.value = .003; this.compressor.release.value = .18;
      this.sfx.connect(this.master); this.speech.connect(this.master); this.master.connect(this.compressor).connect(this.context.destination);
      this.ambienceBus = this.context.createGain(); this.ambienceBus.gain.value = this.mix.sfx; this.ambienceBus.connect(this.master);
      this.ambience = new StageAmbience(this.context, this.ambienceBus, url => this.loadSample(url).then(() => this.samples.get(url)), Math.random,
        url => { this.samples.delete(url); this.sampleLoads.delete(url); });
      if (this.ambienceStage) this.ambience.set(this.ambienceStage);
      if (this.liquid) this.preload(SPLASHES);
      const ctx = this.context;
      if (typeof ctx.createConvolver === 'function' && typeof ctx.createBiquadFilter === 'function') {
        const high = ctx.createBiquadFilter(), low = ctx.createBiquadFilter();
        high.type = 'highpass'; high.frequency.value = 180; high.Q.value = .7;
        low.type = 'lowpass'; low.frequency.value = 6500; low.Q.value = .7;
        const reverb = { sfx: ctx.createGain(), speech: ctx.createGain(), convolver: ctx.createConvolver(), out: ctx.createGain() };
        reverb.convolver.normalize = false; reverb.sfx.gain.value = reverb.speech.gain.value = reverb.out.gain.value = 0;
        this.sfx.connect(reverb.sfx).connect(high); this.speech.connect(reverb.speech).connect(high);
        high.connect(low).connect(reverb.convolver).connect(reverb.out).connect(this.master);
        this.reverb = reverb; this.applySpace();
      }
    }
    const resume = this.context.resume();
    this.loading ??= this.load().catch(error => { this.loading = undefined; throw error; });
    await Promise.all([resume, this.loading]);
  }
  private async load() {
    this.preload(situationSamples(this.wanted));
    await this.loadCues((Object.keys(AUDIO_CUES) as AudioCue[]).filter(cue => {
      if (!this.options.byRoom) return true;
      const owner = cueFighter(cue);
      return owner ? this.wanted.has(owner) : !byNeed(cue) || this.needed.has(cue);
    }));
  }
  prepare(fighters: Iterable<string>): Promise<void> {
    const fresh = [...fighters].filter(id => !this.wanted.has(id)), shared = new Set<AudioCue>();
    for (const id of fresh) {
      this.wanted.add(id);
      for (const cue of fighterCues(id as FighterId)) if (!this.needed.has(cue)) { this.needed.add(cue); shared.add(cue); }
    }
    if (!this.context || this.dead || !fresh.length || !this.options.byRoom) return Promise.resolve();
    this.preload(situationSamples(fresh));
    return this.loadCues((Object.keys(AUDIO_CUES) as AudioCue[]).filter(cue => fresh.includes(cueFighter(cue) ?? '') || shared.has(cue)));
  }
  private loadCues(cues: AudioCue[]) {
    cues = [...cues.filter(byNeed), ...cues.filter(cue => !byNeed(cue))];
    const batches: AudioCue[][] = [];
    for (let i = 0; i < cues.length; i += 40) batches.push(cues.slice(i, i + 40));
    const asked = Promise.all(batches.map((batch, n) => new Promise<void>(next => setTimeout(next, n * 16)).then(() => Promise.all(batch.map(cue => this.loadCue(cue)))))).then(() => {});
    this.asking.add(asked); void asked.finally(() => this.asking.delete(asked));
    return asked;
  }
  private asking = new Set<Promise<void>>();
  private bank() {
    return this.packed ??= fetch('/assets/audio/v2/packed.json', { signal: this.abort.signal, priority: 'low' })
      .then(async response => response.ok && response.headers.get('content-type')?.includes('json') ? ((await response.json()) as { files?: PackedBank }).files ?? null : null)
      .catch(() => null);
  }
  private loadCue(cue: AudioCue): Promise<void> {
    let loading = this.cueLoads.get(cue);
    if (loading) return loading;
    loading = (async () => {
      try {
        const file = AUDIO_CUES[cue], frames = this.wavOnly ? undefined : (await this.bank())?.[file];
        if (frames && !this.wavOnly) {
          try {
            const decoded = await this.decode(`/assets/audio/v2/${file.replace(/\.wav$/, '.m4a')}`, cue);
            if (this.dead) return;
            const buffer = trimAac(this.context!, decoded, frames);
            if (buffer) { this.buffers.set(cue, buffer); return; }
            if (!this.wavOnly) console.warn(`Sound bank: this browser decodes AAC to another length (${cue}: ${decoded.duration.toFixed(4)} s, not ${(frames[0] / frames[1]).toFixed(4)}); the WAVs from here on`);
            this.wavOnly = true;
          } catch (error) {
            if (this.dead) return;
            if (error instanceof DOMException && error.name !== 'AbortError') this.wavOnly = true;
            console.warn(`Sound bank: ${cue}'s AAC copy failed; its WAV instead`, error);
          }
        }
        const buffer = await this.decode(`/assets/audio/v2/${file}`, cue);
        if (!this.dead) this.buffers.set(cue, buffer);
      } catch (error) { if (!this.dead) console.warn(error); }
    })();
    this.cueLoads.set(cue, loading);
    return loading;
  }
  private async decode(url: string, cue: AudioCue): Promise<AudioBuffer> {
    return this.context!.decodeAudioData(await this.download(url, { signal: this.abort.signal, priority: 'low' }, cue));
  }
  setVolume(value: number) { this.setMix({ master: value }); }
  getMix(): AudioMix { return { ...this.mix }; }
  setMix(values: Partial<AudioMix>) {
    for (const key of ['master', 'sfx', 'voice'] as const) {
      const value = values[key]; if (value !== undefined && Number.isFinite(value)) this.mix[key] = Math.max(0, Math.min(1, value));
    }
    if (this.context) {
      this.master?.gain.setTargetAtTime(this.mix.master, this.context.currentTime, .025);
      this.speech?.gain.setTargetAtTime(this.mix.voice, this.context.currentTime, .025);
      this.ambienceBus?.gain.setTargetAtTime(this.mix.sfx, this.context.currentTime, .06);
    }
    this.updateVoiceActivity(.06);
  }
  captureOutput(musicElements:HTMLAudioElement[]=[]) {
    if (!this.context || !this.compressor || this.context.state !== 'running') throw new Error('Enter the arena to enable game audio before recording');
    const output = this.context.createMediaStreamDestination(), compressor = this.compressor; compressor.connect(output);
    const sources=musicElements.map(audio=>{let source=this.musicSources.get(audio);if(!source){source=this.context!.createMediaElementSource(audio);source.connect(this.context!.destination);this.musicSources.set(audio,source);}source.connect(output);return source;});
    return { stream: output.stream, dispose: () => {for(const source of sources)source.disconnect(output); compressor.disconnect(output); output.stream.getTracks().forEach(track => track.stop()); } };
  }
  step(at: { x: number; y: number; z: number }, speed: number, local: boolean) {
    if (this.dead) return;
    if (!local) {
      const here = this.here(), now = this.context?.currentTime ?? 0;
      if (Math.hypot(at.x - here.x, at.z - here.z) > STEP_RANGE || now - this.otherStep < STEP_GAP) return;
      this.otherStep = now;
    }
    const pace = Math.min(1, speed / 9), body = this.bodyAt(at), weight = body ? weightNow(body) : .2;
    const n = this.steps++;
    const wobble = Math.sin(n * 2.399963) * .5 + Math.sin(n * 5.083203) * .5;
    const floor = STEPS[surfaceAt(this.ambienceStage, this.liquid, at.y)];
    const gain = floor.gain * (local ? 1 : .55) * (.5 + pace * .5) * (1 + wobble * .25) * weightGain(weight);
    this.play({ cue: floor.takes[n & 1], gain, rate: (.92 + pace * .16) * (1 + wobble * .06) * weightRate(weight), phase: 'impact' }, at, local ? 1 : 0, 'step');
    if (weight >= GIANT) this.play({ cue: 'ground', gain: gain * (.9 + weight), rate: 1 - .25 * weight, phase: 'impact' }, at, local ? 1 : 0, 'step');
  }
  private bodyAt(at: Vec3): PlayerState | undefined {
    let best: PlayerState | undefined, nearest = 1.5 * 1.5;
    for (const p of this.latestPlayers) {
      if (p.enemy) continue;
      const d = (p.x - at.x) ** 2 + (p.z - at.z) ** 2;
      if (d < nearest) { nearest = d; best = p; }
    }
    return best;
  }
  private otherStep = -Infinity;
  private steps = 0;
  private movement(players: PlayerState[], selfId: string) {
    if (this.movesOf !== selfId) { this.moves.clear(); this.movesOf = selfId; }
    for (const p of players) {
      if (p.enemy) continue;
      const seen = this.moves.get(p.id);
      if (!seen) {
        this.moves.set(p.id, { action: p.action, grounded: p.grounded, y: p.y, airFrom: 0, peak: p.y,
          jump: p.action === 'jump' ? p.actionStarted : -Infinity, guard: p.action === 'guard' ? p.actionStarted : -Infinity });
        continue;
      }
      const now = this.context?.currentTime ?? 0;
      if (seen.grounded && !p.grounded) { seen.airFrom = now; seen.peak = p.y; }
      if (!p.grounded) seen.peak = Math.max(seen.peak, p.y);
      const heavy = weightNow(p), floor = STEPS[surfaceAt(this.ambienceStage, this.liquid, p.y)];
      if (!seen.grounded && p.grounded && FALLS.has(seen.action) && now - seen.airFrom > .25 && !(now - (this.voicedLandings.get(p.id) ?? -9) < .35)) {
        const priority = p.id === selfId ? 3 : 0, weight = Math.min(1, .5 + Math.max(0, seen.peak - p.y) * .22);
        if (!this.splashAt(p, .32 + .3 * weight, priority, p.id)) {
          this.play({ cue: 'fx-land-heavy', gain: .34 * weight * weightGain(heavy), rate: (1.12 - weight * .14) * weightRate(heavy), phase: 'impact' }, p, priority, p.id);
          this.play({ cue: floor.takes[0], gain: floor.gain * 2.2 * weight, rate: .7 * weightRate(heavy), delay: .008, phase: 'impact' }, p, priority, p.id);
        }
        this.play({ cue: 'cloth', gain: .2 * weight, rate: .9, delay: .015, phase: 'impact' }, p, priority, p.id);
      }
      else if (!seen.grounded && p.grounded && !FALLS.has(seen.action) && !FALLS.has(p.action) && now - seen.airFrom > .25 && !(now - (this.voicedLandings.get(p.id) ?? -9) < .35)) {
        const priority = p.id === selfId ? 3 : 0, drop = Math.min(1, .45 + Math.max(0, seen.peak - p.y) * .2);
        this.play({ cue: floor.takes[0], gain: floor.gain * 1.7 * drop * weightGain(heavy), rate: .84 * weightRate(heavy), phase: 'impact' }, p, priority, p.id);
        this.play({ cue: floor.takes[1], gain: floor.gain * 1.3 * drop * weightGain(heavy), rate: .8 * weightRate(heavy), delay: .028, phase: 'impact' }, p, priority, p.id);
        if (heavy >= GIANT) this.play({ cue: 'ground', gain: .3 * drop * heavy, rate: 1 - .25 * heavy, phase: 'impact' }, p, priority, p.id);
      }
      const priority = p.id === selfId ? 3 : 0;
      if (p.action === 'jump' && p.actionStarted > seen.jump) {
        seen.jump = p.actionStarted;
        if ((seen.grounded && p.y > seen.y) || seen.action === 'jump') {
          this.play({ cue: 'fx-tech', gain: .3, rate: 1.06 * weightRate(heavy), phase: 'release' }, p, priority, p.id);
          this.play({ cue: floor.takes[1], gain: floor.gain * 1.5 * weightGain(heavy), rate: 1.15 * weightRate(heavy), phase: 'release' }, p, priority, p.id);
        }
      }
      if (p.action === 'guard' && p.actionStarted > seen.guard) {
        seen.guard = p.actionStarted;
        if (seen.action !== 'guard') {
          this.play({ cue: 'fx-tech', gain: .2, rate: 1.3, phase: 'release' }, p, priority, p.id);
          this.play({ cue: 'cloth', gain: .1, rate: 1.15, delay: .012, phase: 'release' }, p, priority, p.id);
        }
      }
      seen.action = p.action; seen.grounded = p.grounded; seen.y = p.y;
    }
    if (this.moves.size > players.length) for (const id of this.moves.keys()) if (!players.some(p => p.id === id)) this.moves.delete(id);
  }
  private moves = new Map<string, { action: PlayerState['action']; grounded: boolean; y: number; airFrom: number; peak: number; jump: number; guard: number }>();
  private voicedLandings = new Map<string, number>();
  private movesOf = '';
  handle(events: CombatEvent[], selfId: string, players: PlayerState[]) {
    if (this.dead) return;
    if (this.selfId && this.selfId !== selfId) this.reset();
    this.selfId = selfId; this.latestPlayers = players;
    const self = players.find(p => p.id === selfId);
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id); if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!);
      const actor = players.find(p => p.id === event.actorId), target = players.find(p => p.id === event.targetId);
      const resolved = { ...event, fighter: event.fighter ?? actor?.fighter };
      const local = event.actorId === selfId || event.targetId === selfId;
      const at = event.kind === 'cast' || event.kind === 'release' ? (event.kind === 'release' && event.slot === 'area' && event.endpoint || event.origin || actor) : (event.endpoint ?? target ?? event.origin ?? actor);
      if (event.kind === 'cast' && actor && event.slot) {
        this.cancelOwner(actor.id, true);
        const shown = actor.action === event.slot && actor.actionStarted > event.serverTime - CAST_MATCH;
        this.casts.set(actor.id, { started: shown ? actor.actionStarted : undefined, before: actor.actionStarted,
          announced: performance.now() / 1000, slot: event.slot, released: false });
      } else if (event.kind === 'release') {
        const cast = this.casts.get(event.actorId); if (cast) cast.released = true;
        for(const sound of this.sounds)if(sound.owner===event.actorId&&sound.bus==='voice'&&sound.phase==='cast')sound.phase='release';
        this.cancelOwner(event.actorId, false);
      }
      if (local && (event.kind === 'just-guard' || event.kind === 'projectile-clash')) this.hush();
      const scene = { actor: actor && !actor.enemy ? actor.fighter : undefined, target: target && !target.enemy ? target.fighter : undefined,
        targetHealth: target && target.maxHp > 0 ? target.hp / target.maxHp : undefined };
      if (at) for (const layer of planCombatAudio(resolved, !!actor?.awakened, scene))
        this.play(layer, (layer.speaker ? players.find(p => p.id === layer.speaker) : undefined) ?? at, local ? 4 : 1, layer.speaker ?? event.actorId, event.id);
      if (self) {
        const quip = this.quips.plan(event, self, () => {
          const kit = FIGHTER_QUIPS[self.fighter];
          if (this.context?.state !== 'running' || this.mix.master <= 0 || this.mix.voice <= 0
            || (kit.advantage !== undefined && !this.buffers.has(kit.advantage))) return false;
          for (const sound of this.sounds) if (sound.bus === 'voice' && !sound.stopping) return false;
          return true;
        });
        if (quip) this.play(quip, self, 1, self.id, event.id);
      }
      if (event.kind === 'land' || event.kind === 'ground-bounce') this.voicedLandings.set(event.actorId, this.context?.currentTime ?? 0);
      if (at && (event.kind === 'land' || event.kind === 'ground-bounce')) this.splashAt(at, event.kind === 'land' ? .6 : .5, local ? 4 : 1, event.actorId);
    }
    const now = performance.now() / 1000;
    for (const [id, cast] of this.casts) {
      const player = players.find(p => p.id === id);
      if (!player) { this.cancelOwner(id, !cast.released); this.casts.delete(id); continue; }
      if (cast.started === undefined) {
        if (player.action === cast.slot && player.actionStarted > cast.before) { cast.started = player.actionStarted; continue; }
        const overruled = player.actionStarted > cast.before && !NEUTRAL.has(player.action);
        if (overruled || now - cast.announced > CAST_CONFIRM) { this.cancelOwner(id, !cast.released); this.casts.delete(id); }
        continue;
      }
      if (player.actionStarted !== cast.started || player.action !== cast.slot) {
        this.cancelOwner(id, !cast.released); this.casts.delete(id);
      }
    }
    this.movement(players, selfId);
    this.holdAuras(players, selfId);
    for (const player of players) {
      if (player.action === 'dash' && this.dashStates.get(player.id) !== player.actionStarted) {
        this.dashStates.set(player.id, player.actionStarted);
        const heavy = weightNow(player), priority = player.id === selfId ? 3 : 0;
        this.play({ cue: 'swing-b', gain: .35 * weightGain(heavy), rate: .82 * weightRate(heavy), phase: 'release' }, player, priority, player.id);
        this.play({ cue: 'cloth', gain: .18, delay: .035, phase: 'release' }, player, priority, player.id);
        if (player.grounded) { const floor = STEPS[surfaceAt(this.ambienceStage, this.liquid, player.y)]; this.play({ cue: floor.takes[0], gain: floor.gain * 1.2 * weightGain(heavy), rate: 1.3 * weightRate(heavy), phase: 'release' }, player, priority, player.id); }
      }
    }
    for (const id of this.dashStates.keys()) if (!players.some(p => p.id === id)) this.dashStates.delete(id);
  }
  private hush(depth = .35, seconds = .2) {
    const ctx = this.context;
    if (!ctx) return;
    const now = ctx.currentTime, back = now + seconds;
    for (const sound of this.sounds) {
      if (sound.bus !== 'sfx' || sound.stopping || sound.start > now || sound.owner === 'ui' || sound.owner.startsWith('aura:')) continue;
      const g = sound.gain.gain;
      try {
        g.cancelScheduledValues(now); g.setValueAtTime(sound.level, now); g.linearRampToValueAtTime(sound.level * depth, now + .015);
        if (sound.end > back + .04) {
          const tail = Math.min(.09, (sound.end - sound.start) * .2);
          g.setValueAtTime(sound.level * depth, back - .05); g.linearRampToValueAtTime(sound.level, back);
          g.setValueAtTime(sound.level, Math.max(back, sound.end - tail)); g.linearRampToValueAtTime(0, sound.end);
        } else g.linearRampToValueAtTime(0, sound.end);
      } catch { }
    }
  }
  cue(cue: CueLayer['cue'], at: Vec3, gain: number, rate = 1, owner = 'survival', priority = 1, delay = 0) {
    if (this.dead) return;
    this.play({ cue, gain, rate, delay, phase: 'impact' }, at, priority, owner);
  }
  private here(): Vec3 { return this.latestPlayers.find(p => p.id === this.selfId) ?? { x: 0, y: 0, z: 0 }; }
  ui(cue: CueLayer['cue'], gain: number, at = 0, rate = 1) {
    if (this.dead) return;
    const peak = (SFX_PEAKS[cue] ?? 0) / rate;
    this.play({ cue, gain, rate, delay: Math.max(0, at - peak), phase: 'impact' }, this.here(), 6, 'ui');
  }
  announce(url: string, gain: number, delay = 0) { this.sample(url, this.here(), gain, 1, 'announcer', 8, delay, 'voice'); }
  quote(url: string, gain: number, delay = 0) { this.sample(url, this.here(), gain, 1, 'victory', 7, delay, 'voice'); }
  say(kind: VoiceSituation, id: string, wait = 0): number | undefined {
    const who = this.latestPlayers.find(p => p.id === id);
    if (this.dead || !who || who.enemy || !who.alive) return;
    const now = performance.now() / 1000, key = `${id}:${kind}`;
    if (now - (this.saidAt.get(key) ?? -Infinity) < SITUATION_RULES[kind].rest) return;
    const line = this.turn(who.fighter, kind, false);
    if (!line || !this.play(situationLayer(kind, line, id, wait), who, id === this.selfId ? 4 : 1, id)) return;
    this.turn(who.fighter, kind); this.saidAt.set(key, now);
    if (this.saidAt.size > 64) this.saidAt.delete(this.saidAt.keys().next().value!);
    return lineSeconds(line);
  }
  bell(after = .9) {
    const self = this.latestPlayers.find(p => p.id === this.selfId);
    if (this.dead || !self) return;
    const mine = this.say('bell', self.id, after);
    let foe: PlayerState | undefined, nearest = Infinity;
    for (const p of this.latestPlayers) {
      if (p.id === self.id || p.enemy || !p.alive || (self.team && p.team === self.team)) continue;
      const distance = Math.hypot(p.x - self.x, p.z - self.z);
      if (distance < nearest) { nearest = distance; foe = p; }
    }
    if (!foe) return;
    const id = foe.id;
    clearTimeout(this.bellTimer);
    this.bellTimer = setTimeout(() => { this.bellTimer = undefined; this.say('bell', id); }, (after + (mine ? mine + .25 : 0)) * 1000);
  }
  winLine(winner: FighterId, delay = 0): number | undefined {
    if (this.dead) return;
    const line = this.turn(winner, 'win', false);
    if (!line) return;
    const { speaker: _speaker, ...layer } = situationLayer('win', line, '', delay);
    if (!this.play(layer, this.here(), 7, 'victory')) return;
    this.turn(winner, 'win'); this.wonWith = { fighter: winner, line };
    return lineSeconds(line);
  }
  winSeconds(fighter: FighterId): number | undefined {
    const line = this.wonWith?.fighter === fighter ? this.wonWith.line : this.turn(fighter, 'win', false);
    return line && (isRift(line) ? this.samples.has(riftUrl(line)) : this.buffers.has(line)) ? lineSeconds(line) : undefined;
  }
  private wonWith?: { fighter: FighterId; line: SituationLine };
  lossLine(delay = 0) {
    const self = this.latestPlayers.find(p => p.id === this.selfId);
    if (this.dead || !self || self.enemy) return;
    const line = this.turn(self.fighter, 'loss');
    if (!line) return;
    const { speaker: _speaker, ...layer } = situationLayer('loss', line, '', delay);
    this.play(layer, this.here(), 6, 'defeat');
  }
  private turn(fighter: FighterId, kind: VoiceSituation, advance = true): SituationLine | undefined {
    const lines = situationLines(fighter, kind), key = `${fighter}:${kind}`, n = this.turns.get(key) ?? 0;
    if (!lines.length) return;
    if (advance) this.turns.set(key, n + 1);
    return lines[n % lines.length];
  }
  private saidAt = new Map<string, number>();
  private turns = new Map<string, number>();
  private bellTimer?: ReturnType<typeof setTimeout>;
  sampleSeconds(url: string) { return this.samples.get(url)?.duration; }
  bigBlow(at: Vec3, owner: string, worth = 1) {
    if (this.dead) return;
    const level = Math.max(.6, Math.min(1.15, worth));
    this.play({ cue: 'fx-land-heavy', gain: .46 * level, rate: .84, phase: 'impact' }, at, 5, owner);
    this.play({ cue: 'crack', gain: .3 * level, rate: .78, delay: .012, phase: 'impact' }, at, 5, owner);
    this.ambience?.cheer(worth);
  }
  setAmbience(stage: StageId | undefined) {
    this.ambienceStage = stage; this.ambience?.set(stage);
    const liquid = stage ? LIQUID_FLOORS[stage] : undefined;
    if (liquid !== this.liquid) { this.liquid = liquid; if (liquid && this.context) this.preload(SPLASHES); }
  }
  private liquid?: LiquidFloor;
  private splashAt(at: Vec3, gain: number, priority: number, owner: string) {
    if (!onLiquid(this.liquid, at.y)) return false;
    const url = SPLASHES_BIG[Math.floor(Math.random() * SPLASHES_BIG.length)];
    this.sample(url, at, gain, .92 + Math.random() * .12, owner, priority);
    return true;
  }
  cheer(worth = 1, win = false) { this.ambience?.cheer(worth, win); }
  setSpace(stage: StageId | undefined) {
    if (spaceName(stage) === spaceName(this.stage) && this.reverbReady(stage)) { this.stage = stage; return; }
    this.stage = stage; this.applySpace();
  }
  private reverbReady(stage: StageId | undefined) { return !this.reverb || !spaceFor(stage) || !!this.reverb.convolver.buffer; }
  private applySpace() {
    const ctx = this.context, reverb = this.reverb;
    if (!ctx || !reverb || this.dead) return;
    const space = spaceFor(this.stage), name = spaceName(this.stage), now = ctx.currentTime;
    if (!space || !name) { reverb.out.gain.setTargetAtTime(0, now, .12); reverb.sfx.gain.setTargetAtTime(0, now, .12); reverb.speech.gain.setTargetAtTime(0, now, .12); return; }
    let buffer = this.irs.get(name);
    if (!buffer) {
      const [left, right] = impulseResponse(space, ctx.sampleRate);
      buffer = ctx.createBuffer(2, left.length, ctx.sampleRate);
      buffer.copyToChannel(left, 0); buffer.copyToChannel(right, 1);
      this.irs.set(name, buffer);
    }
    if (reverb.convolver.buffer !== buffer) reverb.convolver.buffer = buffer;
    reverb.sfx.gain.setTargetAtTime(space.wet, now, .05); reverb.speech.gain.setTargetAtTime(space.wet * VOICE_SHARE, now, .05);
    reverb.out.gain.setTargetAtTime(1, now, .2);
  }
  retain(fighters: Iterable<string>): number {
    if (!this.options.byRoom) return 0;
    const keep = new Set(fighters), stay = new Set<AudioCue>();
    for (const id of keep) for (const cue of fighterCues(id as FighterId)) stay.add(cue);
    let released = 0;
    for (const cue of [...this.cueLoads.keys()]) {
      const owner = cueFighter(cue);
      if (owner ? keep.has(owner) : !byNeed(cue) || stay.has(cue)) continue;
      if (!this.buffers.has(cue)) continue;
      this.buffers.delete(cue); this.cueLoads.delete(cue); released++;
    }
    const gone = [...this.wanted].filter(id => !keep.has(id));
    if (gone.length) { const kept = new Set(situationSamples(keep)); this.release(situationSamples(gone).filter(url => !kept.has(url))); }
    for (const id of gone) this.wanted.delete(id);
    for (const cue of [...this.needed]) if (!stay.has(cue)) this.needed.delete(cue);
    return released;
  }
  release(urls: readonly string[]) { for (const url of urls) { this.samples.delete(url); this.sampleLoads.delete(url); } }
  preload(urls: readonly string[]) { for (const url of urls) void this.loadSample(url); }
  async ready(cap = 4000): Promise<void> {
    const all = [this.loading, ...this.asking, ...this.cueLoads.values(), ...this.sampleLoads.values()].filter((p): p is Promise<void> => !!p);
    if (!all.length || this.dead) return;
    await Promise.race([Promise.allSettled(all), new Promise<void>(done => setTimeout(done, cap))]);
  }
  private loadSample(url: string): Promise<void> {
    let loading = this.sampleLoads.get(url);
    if (loading) return loading;
    if (!this.context || this.dead) return Promise.resolve();
    loading = (async () => {
      const ctx = this.context;
      if (!ctx || this.dead) { this.sampleLoads.delete(url); return; }
      try {
        const buffer = await ctx.decodeAudioData(await this.download(url, { signal: this.abort.signal }, url));
        if (!this.dead) this.samples.set(url, buffer);
      } catch (error) { if (!this.dead) console.warn(error); }
    })();
    this.sampleLoads.set(url, loading);
    return loading;
  }
  sample(url: string, at: Vec3, gain: number, rate = 1, owner = 'horde', priority = 0, delay = 0, bus: 'sfx' | 'voice' = 'sfx') {
    if (this.dead) return;
    const buffer = this.samples.get(url);
    if (!buffer) { void this.loadSample(url); return; }
    this.play({ cue: 'swing-a', gain, rate, delay, phase: 'impact', bus }, at, priority, owner, undefined, buffer);
  }
  private play(layer: CueLayer, at: Vec3, priority: number, owner: string,sequence?:number, override?: AudioBuffer): ActiveSound | undefined {
    const ctx = this.context, buffer = override ?? (layer.url ? this.samples.get(layer.url) : this.buffers.get(layer.cue)), bus = layer.bus ?? 'sfx';
    if (!buffer && ctx && !this.dead && layer.url) void this.loadSample(layer.url);
    else if (!buffer && ctx && !this.dead && !this.cueLoads.has(layer.cue) && layer.cue in AUDIO_CUES) void this.loadCue(layer.cue);
    if (!ctx || ctx.state !== 'running' || !buffer || !this.master || this.mix.master <= 0 || this.mix[bus] <= 0 || this.dead) return;
    const listener = this.latestPlayers.find(p => p.id === this.selfId);
    const dx = listener ? at.x - listener.x : 0, dz = listener ? at.z - listener.z : 0, distance = Math.hypot(dx, dz);
    if (distance > (bus === 'voice' ? 25 : 48)) return;
    const sameBus = [...this.sounds].filter(sound => sound.bus === bus && !sound.stopping);
    if(bus==='voice'){
      if(layer.yields&&(sameBus.some(sound=>sound.owner===owner)||(layer.yields==='all'&&new Set(sameBus.map(sound=>sound.owner)).size>=2)))return;
      priority+=layer.voicePriority??1;
      const previous=sameBus.filter(sound=>sound.owner===owner&&(sequence===undefined||sound.sequence!==sequence));
      if(previous.some(sound=>sound.phase==='release'&&sound.priority>=priority))return;
      for(const old of previous){if(old.phase==='release'){holdAt(old.gain.gain,ctx.currentTime);old.gain.gain.setTargetAtTime(old.gain.gain.value*.65,ctx.currentTime,.12);}else this.stop(old,.08);}
    }
    const count = sameBus.filter(sound => !sound.stopping);
    const groups=bus==='voice'
      ? [...new Set(count.map(sound=>sound.owner))].map(actor=>count.filter(sound=>sound.owner===actor))
      : count.map(sound=>[sound]);
    const continuingOwner=bus==='voice'&&groups.some(group=>group[0].owner===owner);
    if (!continuingOwner&&groups.length >= (bus === 'voice' ? 2 : 20)) {
      const weakest=groups.filter(group=>bus!=='voice'||!group.some(sound=>sound.owner===this.selfId&&sound.phase==='release'))
        .sort((a,b)=>Math.max(...a.map(s=>s.priority))-Math.max(...b.map(s=>s.priority)))[0];
      if(!weakest||Math.max(...weakest.map(s=>s.priority))>priority)return;
      for(const sound of weakest)this.stop(sound,.08);
    }
    const source = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
    source.buffer = buffer; source.playbackRate.value = layer.rate ?? 1; source.loop = layer.loop ?? false;
    if (source.loop) { source.loopStart = Math.min(.08, buffer.duration * .1); source.loopEnd = Math.max(source.loopStart + .03, buffer.duration - .08); }
    const onset = override || layer.url ? 0 : Math.max(0, ((CUE_ONSETS as Record<string, number>)[layer.cue] ?? 0) - .015);
    const start = ctx.currentTime + (layer.delay ?? 0);
    const duration = layer.duration ?? (buffer.duration - onset) / source.playbackRate.value;
    const attenuation = 1 / (1 + distance * distance / (bus === 'voice' ? 75 : 120)), level = layer.gain * attenuation;
    gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + (source.loop ? .075 : .004));
    const tail = Math.min(bus === 'voice' ? .04 : source.loop ? .1 : .09, duration * .2);
    gain.gain.setValueAtTime(level, start + Math.max(.005, duration - tail)); gain.gain.linearRampToValueAtTime(0, start + duration);
    const side = listener ? dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw) : 0;
    pan.pan.value = Math.max(-.8, Math.min(.8, side / (bus === 'voice' ? 20 : 12)));
    source.connect(gain).connect(pan).connect(bus === 'voice' ? this.speech! : this.sfx!);
    const sound: ActiveSound = { source, gain, pan, priority, owner, bus, phase: layer.phase, stopping: false,sequence, start, level, end: start + duration };
    this.sounds.add(sound);
    source.onended = () => { this.sounds.delete(sound); source.disconnect(); gain.disconnect(); pan.disconnect(); this.updateVoiceActivity(); };
    source.start(start, onset); source.stop(start + duration + .005); this.updateVoiceActivity();
    return sound;
  }
  private auras = new Map<string, { sound: ActiveSound; cue: AudioCue }>();
  private holdAuras(players: PlayerState[], selfId: string) {
    const ctx = this.context;
    if (!ctx) return;
    const listener = players.find(p => p.id === selfId);
    const rows: { id: string; voice: NonNullable<ReturnType<typeof auraVoice>>; near: number }[] = [];
    for (const p of players) {
      const voice = auraVoice(p);
      if (!voice) continue;
      const own = p.id === selfId, distance = listener ? Math.hypot(p.x - listener.x, p.z - listener.z) : 0;
      if (own || distance <= AURA_RANGE) rows.push({ id: p.id, voice, near: own ? -1 : distance - (this.auras.has(p.id) ? 2 : 0) });
    }
    rows.sort((a, b) => a.near - b.near);
    const heard = new Map(rows.slice(0, AURA_VOICES).map(row => [row.id, row.voice]));
    for (const p of players) {
      const own = p.id === selfId, voice = heard.get(p.id);
      let held = this.auras.get(p.id);
      if (held?.sound.stopping) { this.auras.delete(p.id); held = undefined; }
      if (held && (!voice || held.cue !== voice.cue)) { this.stop(held.sound, .7); this.auras.delete(p.id); held = undefined; }
      if (!voice) continue;
      const level = voice.level * (own ? 1 : .65);
      if (!held) {
        const sound = this.play({ cue: voice.cue, gain: level, loop: true, duration: 3600, phase: 'release', ...(voice.rate !== 1 ? { rate: voice.rate } : {}) }, p, own ? 2 : 0, `aura:${p.id}`);
        if (sound) this.auras.set(p.id, { sound, cue: voice.cue });
        continue;
      }
      const dx = listener ? p.x - listener.x : 0, dz = listener ? p.z - listener.z : 0;
      const attenuation = 1 / (1 + (dx * dx + dz * dz) / 120), side = listener ? dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw) : 0;
      held.sound.gain.gain.setTargetAtTime(level * attenuation, ctx.currentTime, .12);
      held.sound.pan.pan.setTargetAtTime(Math.max(-.8, Math.min(.8, side / 12)), ctx.currentTime, .1);
    }
    for (const [id, held] of this.auras) if (!players.some(p => p.id === id)) { this.stop(held.sound, .4); this.auras.delete(id); }
  }
  private updateVoiceActivity(levelTau?: number) {
    const now = this.context?.currentTime ?? 0;
    const voices = this.mix.master > 0 && this.mix.voice > 0 ? [...this.sounds].filter(sound => sound.bus === 'voice' && !sound.stopping) : [];
    const active = voices.some(sound => sound.start - DUCK_LEAD <= now + .001);
    const next = active || !voices.length ? undefined : Math.min(...voices.map(sound => sound.start)) - DUCK_LEAD;
    if (next !== this.duckAt || (next !== undefined && this.duckTimer === undefined)) {
      clearTimeout(this.duckTimer); this.duckTimer = undefined;
      if (next !== undefined && !this.dead) this.duckTimer = setTimeout(() => { this.duckTimer = undefined; this.updateVoiceActivity(); }, Math.max(10, (next - now) * 1000 + 5));
    }
    const flipped = active !== this.voiceActive;
    if (!flipped && next === this.duckAt && levelTau === undefined) return;
    this.voiceActive = active; this.duckAt = next;
    const gain = this.sfx?.gain;
    if (this.context && gain) {
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(this.mix.sfx * (active ? VOICE_DUCK : 1), now, levelTau ?? (active ? DUCK_DOWN : DUCK_UP));
      if (next !== undefined) gain.setTargetAtTime(this.mix.sfx * VOICE_DUCK, next, DUCK_DOWN);
    }
    if (flipped) this.onVoiceActivity?.(active);
  }
  private cancelOwner(owner: string, interrupted: boolean) {
    for (const sound of this.sounds) if (sound.owner === owner && (sound.phase === 'charge' || (interrupted && sound.phase === 'cast'))) this.stop(sound, .06);
  }
  private stop(sound: ActiveSound, fade = .035) {
    if (sound.stopping) return; sound.stopping = true;
    try { const now = this.context?.currentTime ?? 0; holdAt(sound.gain.gain, now); sound.gain.gain.linearRampToValueAtTime(0, now + fade); sound.source.stop(now + fade + .005); } catch { }
    this.updateVoiceActivity();
  }
  reset() { for (const sound of this.sounds) this.stop(sound); this.auras.clear(); this.seen.clear(); this.dashStates.clear(); this.casts.clear(); this.quips.reset(); clearTimeout(this.bellTimer); this.bellTimer = undefined; this.saidAt.clear(); }
  dispose() { this.dead = true; clearTimeout(this.duckTimer); clearTimeout(this.bellTimer); this.abort.abort(); this.ambience?.dispose(); this.ambienceBus?.disconnect(); this.reset(); this.buffers.clear(); this.samples.clear(); this.reverb?.out.disconnect(); this.irs.clear(); this.master?.disconnect(); this.sfx?.disconnect(); this.speech?.disconnect(); this.compressor?.disconnect();for(const source of this.musicSources.values())source.disconnect();this.musicSources.clear(); void this.context?.close().catch(() => {}); }
}
