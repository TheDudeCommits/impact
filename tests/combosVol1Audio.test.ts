import { describe, expect, it } from 'vitest';
import { AUDIO_CUES } from '../src/audio/cuePlan';
import { planSfx } from '../src/audio/sfxPlan';
import { planVoice, resetVoiceMemory } from '../src/audio/voicePlan';
import { VOICE_CUES } from '../src/audio/voiceCues';
import { COMBO_KEYS, COMBO_SLOT, comboMove, type ComboKey } from '../src/game/combos';
import { HOME_FIGHTERS } from '../src/ui/MangaHome';
import type { CombatEvent, FighterId } from '../src/game/types';

const VOL1 = HOME_FIGHTERS as readonly FighterId[];
const cast = (fighter: FighterId, branch: ComboKey, id: number, actionSeq = id): CombatEvent =>
  ({ id, kind: 'cast', serverTime: id * 3, actorId: `a-${fighter}`, fighter, slot: COMBO_SLOT[branch], branch, actionSeq, move: comboMove(fighter, branch)!.name });

describe('the main game\'s enders on the voice bus', () => {
  it('voices a few of each fighter\'s enders, now and then, in the fighter\'s own recorded cries', () => {
    for (const fighter of VOL1) {
      resetVoiceMemory();
      const voiced = new Map<ComboKey, number>();
      for (const key of COMBO_KEYS) for (let i = 0; i < 60; i++) {
        const layers = planVoice(cast(fighter, key, 100 + i * 7));
        for (const layer of layers) {
          expect(layer.bus, `${fighter} ${key}`).toBe('voice');
          expect(layer.cue in VOICE_CUES, `${fighter} ${key}: ${layer.cue}`).toBe(true);
          expect(String(layer.cue).startsWith(`vo-${fighter}-`), `${fighter} ${key}: ${layer.cue} is another's`).toBe(true);
        }
        if (layers.length) voiced.set(key, (voiced.get(key) ?? 0) + 1);
      }
      expect(voiced.size, `${fighter}: enders voiced`).toBeGreaterThan(0);
      expect(voiced.size, `${fighter}: enders voiced`).toBeLessThanOrEqual(2);
      for (const [key, count] of voiced) expect(count / 60, `${fighter} ${key}`).toBeLessThan(.8);
    }
  });

  it('never voices an ender with its slot\'s own call (Sukuna\'s Light + Heavy is not Hachi)', () => {
    for (const fighter of VOL1) for (const key of COMBO_KEYS) {
      resetVoiceMemory();
      const slot = COMBO_SLOT[key];
      const plans = Array.from({ length: 10 }, (_, i) => planVoice({ id: 40 + i, kind: 'cast', serverTime: 40 + i * 5, actorId: `s-${i}`, fighter, slot, actionSeq: 40 + i, move: 'x' }).map(l => String(l.cue)));
      const call = plans.every(p => p.length === 1 && p[0] === plans[0][0]) ? plans[0][0] : undefined;
      if (!call) continue;
      for (let i = 0; i < 30; i++) for (const layer of planVoice(cast(fighter, key, 500 + i))) expect(layer.cue, `${fighter} ${key}`).not.toBe(call);
    }
  });
});

describe('the main game\'s enders in the sound effects', () => {
  it('casts every ender, in a form or out of it, with registered effects only, on the cast or charge phase', () => {
    for (const fighter of VOL1) for (const awakened of [false, true]) for (const key of COMBO_KEYS) {
      const layers = planSfx(cast(fighter, key, 9), awakened);
      expect(layers.length, `${fighter} ${key}`).toBeGreaterThan(0);
      for (const layer of layers) {
        expect(layer.bus, `${fighter} ${key}`).not.toBe('voice');
        expect(layer.cue in AUDIO_CUES, `${fighter} ${key}: ${layer.cue}`).toBe(true);
        expect(['cast', 'charge'], `${fighter} ${key}: ${layer.cue}`).toContain(layer.phase);
      }
    }
  });

  it('hears a snare or a blast as itself: not the style\'s ki charge and fire, nor every fighter the same', () => {
    const defaults = new Set(['fx-ki-charge', 'fx-fire-ignite', 'fx-ki-blast-1', 'fx-ki-blast-2', 'fx-ki-blast-3']);
    const heard = new Set<string>();
    for (const fighter of VOL1) for (const key of COMBO_KEYS) {
      const move = comboMove(fighter, key)!;
      if (key === 'airSpecial' || move.style === 'melee') continue;
      const cues = planSfx(cast(fighter, key, 11)).map(l => String(l.cue));
      if (fighter !== 'vegeta') expect(cues.some(cue => !defaults.has(cue)), `${fighter} ${key}: ${cues.join(', ')}`).toBe(true);
      heard.add(cues.sort().join('+'));
    }
    expect(heard.size).toBeGreaterThan(15);
  });

  it('lands each ground smash in its fighter\'s element over the shared thud', () => {
    const elements = new Set<string>();
    for (const fighter of VOL1) {
      const release: CombatEvent = { ...cast(fighter, 'airSpecial', 13), kind: 'release', contactIndex: 0 };
      const cues = planSfx(release).map(l => String(l.cue));
      expect(cues, fighter).toContain('fx-land-heavy');
      const own = cues.filter(cue => cue !== 'fx-land-heavy' && cue !== 'fx-ground-bounce');
      expect(own.length, `${fighter}: its element`).toBeGreaterThan(0);
      elements.add(own.join('+'));
    }
    expect(elements.size).toBeGreaterThan(10);
  });
});
