import { describe, expect, it } from 'vitest';
import { FighterLibrary } from '../src/render/Fighter';
import { CombatAudio, cueFighter } from '../src/audio/CombatAudio';
import { LIBRARY_STRONG } from '../src/loading/retention';
import { AUDIO_CUES } from '../src/audio/cuePlan';


function libraryOf(ids: string[]) {
  const library = new FighterLibrary() as unknown as { sources: Map<string, unknown>; forms: Map<string, unknown>; rush: Map<string, unknown>; loaded: Set<string>; used: Map<string, number>; queue: { completed: Set<string> }; evict(keep: ReadonlySet<string>, most: number): void; has(id: string): boolean; loadedCount: number };
  ids.forEach((id, i) => { library.sources.set(id, { scene: { traverse() {} } }); library.loaded.add(id); library.queue.completed.add(id); library.used.set(id, i + 1); });
  return library;
}

describe('the fighter library between rooms', () => {
  const roster = Array.from({ length: 40 }, (_, i) => `f${i}`);
  it('a strong machine keeps this room and the last, and lets the longest unused go', () => {
    const library = libraryOf(roster);
    const room = new Set(roster.slice(28)), keep = new Set([...room, 'f0']);
    library.evict(keep, LIBRARY_STRONG);
    expect(library.loadedCount).toBe(LIBRARY_STRONG);
    for (const id of keep) expect(library.has(id), `${id} is in the room or selected`).toBe(true);
    expect(library.has('f1')).toBe(false);
    expect(library.has('f27')).toBe(true);
  });

  it('never lets go of the room, whatever the cap', () => {
    const library = libraryOf(roster);
    const keep = new Set(roster.slice(0, 30));
    library.evict(keep, 4);
    expect(library.loadedCount).toBe(30);
  });

  it('a rematch with the same fighters loads nothing: the second pass finds them all kept', () => {
    const library = libraryOf(roster.slice(0, 12));
    library.evict(new Set(roster.slice(0, 12)), LIBRARY_STRONG);
    expect(library.loadedCount).toBe(12);
    for (const id of roster.slice(0, 12)) { expect(library.has(id)).toBe(true); expect(library.queue.completed.has(id)).toBe(true); }
  });
});

describe('the sound of rooms past', () => {
  const owned = (Object.keys(AUDIO_CUES) as string[]).filter(cue => cueFighter(cue));
  const fighterA = cueFighter(owned[0])!, cuesA = owned.filter(cue => cueFighter(cue) === fighterA);
  const fighterB = owned.map(cueFighter).find(id => id && id !== fighterA)!, cuesB = owned.filter(cue => cueFighter(cue) === fighterB);
  const shared = (Object.keys(AUDIO_CUES) as string[]).find(cue => !cueFighter(cue))!;
  const bank = () => {
    const audio = new CombatAudio({ byRoom: true }) as unknown as { buffers: Map<string, unknown>; cueLoads: Map<string, Promise<void>>; wanted: Set<string>; retain(f: Iterable<string>): number };
    for (const cue of [...cuesA, ...cuesB, shared]) { audio.buffers.set(cue, {}); audio.cueLoads.set(cue, Promise.resolve()); }
    audio.wanted.add(fighterA); audio.wanted.add(fighterB);
    return audio;
  };

  it('lets go of the voices of fighters the new room does not have, keeping the room\'s and the match\'s own cues', () => {
    const audio = bank();
    const released = audio.retain([fighterA]);
    expect(released).toBe(cuesB.length);
    for (const cue of cuesA) { expect(audio.buffers.has(cue)).toBe(true); expect(audio.cueLoads.has(cue)).toBe(true); }
    for (const cue of cuesB) { expect(audio.buffers.has(cue)).toBe(false); expect(audio.cueLoads.has(cue)).toBe(false); }
    expect(audio.buffers.has(shared)).toBe(true);
    expect([...audio.wanted]).toEqual([fighterA]);
  });

  it('a rematch (the same fighters) releases nothing, and a returning fighter is asked for again', () => {
    const audio = bank();
    expect(audio.retain([fighterA, fighterB])).toBe(0);
    expect(audio.buffers.size).toBe(cuesA.length + cuesB.length + 1);
    audio.retain([fighterA]);
    expect(audio.wanted.has(fighterB)).toBe(false);
    for (const cue of cuesB) expect(audio.cueLoads.has(cue)).toBe(false);
  });

  it('a bank not opened by room (the tests\', whole) is never trimmed', () => {
    const whole = new CombatAudio() as unknown as { buffers: Map<string, unknown>; cueLoads: Map<string, Promise<void>>; retain(f: Iterable<string>): number };
    whole.buffers.set(cuesA[0], {}); whole.cueLoads.set(cuesA[0], Promise.resolve());
    expect(whole.retain([])).toBe(0);
    expect(whole.buffers.size).toBe(1);
  });
});
