import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { holdAt } from '../src/audio/holdParam';
import { planVoice, resetVoiceMemory } from '../src/audio/voicePlan';
import type { CueLayer } from '../src/audio/cuePlan';
import { AWAKENING_ENTRY } from '../src/game/awakening';
import type { CombatEvent } from '../src/game/types';

class FirefoxParam { value = .8; events: unknown[][] = []; setValueAtTime(...x: unknown[]) { this.events.push(['set', ...x]); } linearRampToValueAtTime(...x: unknown[]) { this.events.push(['ramp', ...x]); } setTargetAtTime(...x: unknown[]) { this.events.push(['target', ...x]); } cancelScheduledValues(...x: unknown[]) { this.events.push(['cancel', ...x]); } }
class ChromeParam extends FirefoxParam { cancelAndHoldAtTime(...x: unknown[]) { this.events.push(['hold', ...x]); } }

describe('holdAt', () => {
  it('uses cancelAndHoldAtTime where the engine has it', () => {
    const p = new ChromeParam(); holdAt(p as unknown as AudioParam, 3);
    expect(p.events).toEqual([['hold', 3]]);
  });
  it('cancels and pins the present value where it does not (Firefox)', () => {
    const p = new FirefoxParam(); holdAt(p as unknown as AudioParam, 3);
    expect(p.events).toEqual([['cancel', 3], ['set', .8, 3]]);
  });
});

let nextId = 1;
const cast = (props: Partial<CombatEvent>): CombatEvent => { const id = nextId++; return { id, actionSeq: id, kind: 'cast', serverTime: 1, actorId: 'g', fighter: 'goku', slot: 'light', chain: 0, ...props }; };
const voices = (layers: CueLayer[]) => layers.filter(l => l.bus === 'voice');

async function firefoxAudio() {
  const { CombatAudio } = await import('../src/audio/CombatAudio');
  const lengths = JSON.parse(readFileSync('src/audio/data/voiceDurations.json', 'utf8')) as Record<string, number>;
  class Node { gain = new FirefoxParam(); pan = new FirefoxParam(); connect() { return this; } disconnect() {} }
  class Source extends Node { buffer?: { url: string; duration: number }; out?: Node; playbackRate = new FirefoxParam(); loop = false; loopStart = 0; loopEnd = 0; onended?: () => void; starts = 0; stops: number[] = []; start() { this.starts++; } stop(t: number) { this.stops.push(t); } }
  const urls = new WeakMap<ArrayBuffer, string>();
  class Context {
    static last: Context; currentTime = 10; state = 'running'; destination = new Node(); sources: Source[] = []; pending?: Source;
    constructor() { Context.last = this; }
    createGain() { const node = new Node(); if (this.pending) { this.pending.out = node; this.pending = undefined; } return node; }
    createStereoPanner() { return new Node(); }
    createBufferSource() { const x = new Source(); this.sources.push(x); this.pending = x; return x; }
    createDynamicsCompressor() { return Object.assign(new Node(), { threshold: new FirefoxParam(), knee: new FirefoxParam(), ratio: new FirefoxParam(), attack: new FirefoxParam(), release: new FirefoxParam() }); }
    resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
    decodeAudioData(bytes: ArrayBuffer) { const url = urls.get(bytes)!, cue = url.split('/').pop()!.replace('.wav', ''); return Promise.resolve({ url, duration: lengths[cue] ?? 1 }); }
  }
  const g = globalThis as unknown as Record<string, unknown>, saved = { AudioContext: g.AudioContext, fetch: g.fetch };
  g.AudioContext = Context;
  g.fetch = async (url: string) => ({ ok: true, headers: { get: () => 'audio/wav' }, arrayBuffer: async () => { const b = new ArrayBuffer(8); urls.set(b, url); return b; } });
  const audio = new CombatAudio(); await audio.unlock();
  return { audio, ctx: () => Context.last, restore: () => { audio.dispose(); g.AudioContext = saved.AudioContext; g.fetch = saved.fetch; } };
}

describe('CombatAudio without cancelAndHoldAtTime (Firefox)', () => {
  const goku = { id: 'g', name: 'G', fighter: 'goku', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'awaken', actionStarted: 1, actionTime: 0, actionDuration: AWAKENING_ENTRY, target: null, alive: true, isBot: false, grounded: true, guarding: false, awakened: true, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } } as const;

  it('ducks a released line under a call without throwing, and stopping really stops every sound', async () => {
    const { audio, ctx, restore } = await firefoxAudio();
    try {
      let seq = 1; while (!voices(planVoice(cast({ actionSeq: seq, id: seq, serverTime: 50 }))).length) seq++;
      resetVoiceMemory();
      audio.handle([cast({ id: 2_000_000_000 + seq, actionSeq: seq, serverTime: 50 })], 'g', [{ ...goku, action: 'light', awakened: false }]);
      audio.handle([{ id: 2_000_100_000, kind: 'awaken', serverTime: 50.5, actorId: 'g', fighter: 'goku', move: 'SUPER SAIYAN' }], 'g', [goku]);
      const line = ctx().sources.find(x => x.buffer?.url.endsWith('voice/vo-goku-super-saiyan.wav'));
      expect(line?.starts, 'the line was scheduled').toBe(1);
      expect(() => audio.handle([cast({ id: 2_000_300_000, actionSeq: 9002, slot: 'special', serverTime: 52 })], 'g', [{ ...goku, action: 'special', actionStarted: 52 }])).not.toThrow();
      expect(ctx().sources.filter(x => x.buffer?.url.endsWith('voice/vo-goku-kamehameha.wav')).map(x => x.starts), 'the call speaks').toEqual([1]);
      expect(line!.out!.gain.events.some(e => e[0] === 'cancel'), 'the line is held where it was, then ducked').toBe(true);
      const now = ctx().currentTime, started = [...(audio as unknown as { sounds: Set<{ source: ReturnType<typeof ctx>['sources'][number] }> }).sounds].map(x => x.source);
      expect(started.length).toBeGreaterThan(1);
      audio.reset();
      for (const s of started) {
        expect(s.stops.some(t => t <= now + .1), `${s.buffer?.url}: stopped within its fade`).toBe(true);
        expect(s.out!.gain.events.some(e => e[0] === 'ramp' && e[1] === 0), `${s.buffer?.url}: faded to silence`).toBe(true);
      }
    } finally { restore(); }
  });
});
