import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatAudio } from '../src/audio/CombatAudio';
import { AUDIO_CUES } from '../src/audio/cuePlan';
import type { PlayerState } from '../src/game/types';

class Param { value = 1; setValueAtTime() {} linearRampToValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} cancelAndHoldAtTime() {} }
class Node { gain = new Param(); pan = new Param(); connect() { return this; } disconnect() {} }
class Source extends Node { buffer?: { file: string }; playbackRate = new Param(); loop = false; loopStart = 0; loopEnd = 0; onended?: () => void; start() {} stop() {} }
class Context {
  static last: Context; currentTime = 10; state = 'running'; destination = new Node(); sources: Source[] = [];
  constructor() { Context.last = this; }
  createGain() { return new Node(); } createStereoPanner() { return new Node(); }
  createBufferSource() { const x = new Source(); this.sources.push(x); return x; }
  createDynamicsCompressor() { return Object.assign(new Node(), { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() }); }
  resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
  decodeAudioData(bytes: ArrayBuffer) { return Promise.resolve({ duration: 1, file: new TextDecoder().decode(bytes) }); }
}
async function create() {
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal('fetch', async (url: string) => ({ ok: true, headers: { get: () => 'audio/wav' }, arrayBuffer: async () => new TextEncoder().encode(url).buffer }));
  const audio = new CombatAudio(); await audio.unlock(); return audio;
}
afterEach(() => vi.unstubAllGlobals());
const file = (cue: keyof typeof AUDIO_CUES) => `/assets/audio/v2/${AUDIO_CUES[cue]}`;
const JUMP = [file('fx-tech'), file('fx-step-stone-2')], GUARD = [file('fx-tech'), file('cloth')];
const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'self', name: 'Me', fighter: 'goku', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000,
  stamina: 100, ultimate: 0, action: 'idle', actionStarted: 1, actionTime: 0, actionDuration: 0, target: null, alive: true, isBot: false,
  grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
function show(audio: CombatAudio, ...frames: PlayerState[][]) {
  const from = Context.last.sources.length;
  for (const players of frames) audio.handle([], 'self', players);
  return Context.last.sources.slice(from).map(s => s.buffer!.file);
}

describe('jumps and guards are heard', () => {
  it('sounds a take-off once, seen through both the newest snapshot and the one presented behind it', async () => {
    const a = await create();
    const standing = player({ action: 'run', actionStarted: 2 });
    const newest = player({ action: 'jump', actionStarted: 3, grounded: false, y: .3 });
    const presented = player({ action: 'jump', actionStarted: 3, grounded: true, y: .05 });
    expect(show(a, [standing], [standing], [newest], [standing], [presented], [newest])).toEqual(JUMP);
    a.dispose();
  });

  it('keeps the fall after an air attack or an air dash, and a step off an edge, silent', async () => {
    const a = await create();
    const aloft = { grounded: false, y: 2 };
    expect(show(a, [player({ action: 'light', actionStarted: 2, ...aloft })], [player({ action: 'jump', actionStarted: 2.6, ...aloft, y: 1.9 })])).toEqual([]);
    show(a, [player({ action: 'dash', actionStarted: 3, ...aloft })]);
    expect(show(a, [player({ action: 'jump', actionStarted: 3.3, ...aloft, y: 2.1 })])).toEqual([]);
    const down = show(a, [player({ action: 'run', actionStarted: 4, y: 1 })], [player({ action: 'jump', actionStarted: 4.5, grounded: true, y: .98 })]);
    expect(down).toEqual([file('fx-step-stone-1'), file('fx-step-stone-2')]);
    expect(down).not.toContain(file('fx-tech'));
    a.dispose();
  });

  it('hears a hop straight off the landing, too quick for a snapshot to show the floor', async () => {
    const a = await create();
    expect(show(a, [player({ action: 'jump', actionStarted: 2, grounded: false, y: .2 })], [player({ action: 'jump', actionStarted: 2.9, grounded: false, y: .1 })])).toEqual(JUMP);
    a.dispose();
  });

  it('sounds the guard coming up, not each blow it takes, and again when it is raised again', async () => {
    const a = await create();
    const guard = (started: number) => player({ action: 'guard', actionStarted: started, guarding: true });
    expect(show(a, [player()], [guard(2)])).toEqual(GUARD);
    expect(show(a, [player({ action: 'guard', actionStarted: 2, guarding: false })], [guard(2)])).toEqual([]);
    expect(show(a, [player({ action: 'idle', actionStarted: 3 })], [guard(3.4)])).toEqual(GUARD);
    a.dispose();
  });

  it('says nothing for a fighter it has only just seen, or for the arcade horde', async () => {
    const a = await create();
    expect(show(a, [player({ action: 'guard', actionStarted: 2 }), player({ id: 'bot', action: 'jump', actionStarted: 2, grounded: false, y: 1 })])).toEqual([]);
    expect(show(a, [player({ id: 'grunt', enemy: 'grunt' })], [player({ id: 'grunt', enemy: 'grunt', action: 'guard', actionStarted: 2 })])).toEqual([]);
    a.dispose();
  });

  it('plays the dash as before, through the swing-b key (and, off the floor, the scuff of the push)', async () => {
    const a = await create();
    expect(show(a, [player()], [player({ action: 'dash', actionStarted: 2 })])).toEqual([file('swing-b'), file('cloth'), file('fx-step-stone-1')]);
    a.dispose();
  });
});
