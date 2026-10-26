import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatAudio } from '../src/audio/CombatAudio';
import type { CombatEvent, PlayerState } from '../src/game/types';

class Param { value = 1; setValueAtTime() { return this; } linearRampToValueAtTime() { return this; } setTargetAtTime() { return this; } cancelScheduledValues() { return this; } cancelAndHoldAtTime() { return this; } }
class Node { gain = new Param(); pan = new Param(); frequency = new Param(); Q = new Param(); type = ''; connect(to: Node) { return to; } disconnect() {} }
class Source extends Node { buffer?: unknown; playbackRate = new Param(); loop = false; loopStart = 0; loopEnd = 0; onended?: () => void; start() {} stop() {} }
class Context {
  static last: Context; currentTime = 5; state = 'running'; destination = new Node(); sampleRate = 48000;
  constructor() { Context.last = this; }
  createGain() { return new Node(); } createStereoPanner() { return new Node(); } createBufferSource() { return new Source(); }
  createDynamicsCompressor() { return Object.assign(new Node(), { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() }); }
  resume() { return Promise.resolve(); } close() { return Promise.resolve(); } decodeAudioData() { return Promise.resolve({ duration: 1 }); }
}
const body = (over: Partial<PlayerState> = {}): PlayerState => ({ id: 'foe', name: 'Foe', fighter: 'naruto', x: 2, y: 0, z: 0, yaw: 0, hp: 800, maxHp: 1000, stamina: 100, ultimate: 0,
  action: 'idle', actionStarted: 1, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: true, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...over } as PlayerState);
const self = body({ id: 'self', x: 0 });

describe('a body thrown down meets the floor', () => {
  afterEach(() => vi.unstubAllGlobals());
  const make = async () => {
    vi.stubGlobal('AudioContext', Context);
    vi.stubGlobal('fetch', async () => ({ ok: true, headers: { get: () => 'audio/wav' }, arrayBuffer: async () => new ArrayBuffer(8), json: async () => ({}) }));
    const audio = new CombatAudio();
    await audio.unlock();
    const play = vi.spyOn(audio as unknown as { play: (...x: unknown[]) => void }, 'play');
    const cues = () => play.mock.calls.map(call => (call[0] as { cue: string }).cue);
    return { audio, play, cues };
  };
  const fall = (audio: CombatAudio, events: CombatEvent[] = []) => {
    audio.handle([], 'self', [self, body({ action: 'launched', grounded: true, y: 0 })]);
    audio.handle([], 'self', [self, body({ action: 'launched', grounded: false, y: 1.8 })]);
    Context.last.currentTime += .6;
    audio.handle(events, 'self', [self, body({ action: 'knockdown', grounded: true, y: 0 })]);
  };
  it('lands a launched body with a heavy fall and its cloth', async () => {
    const { audio, cues } = await make();
    fall(audio);
    expect(cues()).toContain('fx-land-heavy');
    expect(cues()).toContain('cloth');
    audio.dispose();
  });
  it('leaves a landing the simulation already voiced to its own sound', async () => {
    const { audio, cues } = await make();
    fall(audio, [{ id: 77, kind: 'ground-bounce', serverTime: 6, actorId: 'foe', fighter: 'naruto', origin: { x: 2, y: 0, z: 0 } } as CombatEvent]);
    expect(cues().filter(cue => cue === 'cloth')).toHaveLength(0);
    audio.dispose();
  });
  it('does not hear a jump\'s landing as a body thrown down', async () => {
    const { audio, cues } = await make();
    audio.handle([], 'self', [self, body({ action: 'jump', grounded: true })]);
    audio.handle([], 'self', [self, body({ action: 'jump', grounded: false, y: 1.4, actionStarted: 2 })]);
    Context.last.currentTime += .6;
    audio.handle([], 'self', [self, body({ action: 'idle', grounded: true, y: 0 })]);
    expect(cues()).not.toContain('fx-land-heavy');
    audio.dispose();
  });
});
