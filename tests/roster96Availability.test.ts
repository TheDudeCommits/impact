import { describe, expect, it, vi } from 'vitest';
import { RELEASED_FIGHTERS, LABORATORY_FIGHTERS, isLaboratoryFighter, isReleasedFighter } from '../src/game/rosterAvailability';
import { mayPlay } from '../src/game/economy/fighters';
import { ownKit, encodeForge, forgeProblems } from '../src/engine/sim/forge';
import { libraryMoves } from '../src/ui/forge/studioLibrary';
import { ForgeSession } from '../src/engine/client/forgeSession';
import { roomKit } from '../src/server/forge/roomKit';
import { ForgeStore } from '../src/server/forge/ForgeStore';
import { HOME_ROSTER } from '../src/ui/MangaHome';
import { OWN_ENTRANCES } from '../src/game/powerUp';
import { AWAKENINGS } from '../src/game/awakening';
import { RUSH, MOVES } from '../src/game/moves';
import { comboMove } from '../src/game/combos';

const additions = ['usopp', 'crocodile', 'toji'] as const;
describe('roster96 admission and Pikachu retirement', () => {
  it('keeps retired Pikachu unavailable even to all-access accounts', () => {
    expect(isReleasedFighter('pikachu')).toBe(false);
    expect(isLaboratoryFighter('pikachu')).toBe(false);
    expect(mayPlay('pikachu', { items: {}, allAccess: true })).toBe(false);
    expect(HOME_ROSTER).not.toContain('pikachu');
  });
  it.each(additions)('%s is available through the normal game and homepage', id => {
    expect(LABORATORY_FIGHTERS).not.toContain(id);
    expect(isLaboratoryFighter(id)).toBe(false);
    expect(RELEASED_FIGHTERS).toContain(id);
    expect(isReleasedFighter(id)).toBe(true);
    expect(mayPlay(id, undefined)).toBe(true);
    expect(HOME_ROSTER).toContain(id);
  });
  it.each(['pikachu'] as const)('cannot borrow %s through a saved Forge kit or private-room code', source => {
    const kit = ownKit('goku', 'Borrowed move');
    kit.slots.special = { from: source, tune: { power: .5 } };
    expect(forgeProblems(kit, { sandbox: true, availability: 'released' }).errors).toContain("The special's source fighter is not available.");
    expect(libraryMoves('goku').some(row => row.id === source)).toBe(false);
    const session = new ForgeSession();
    try { expect(session.apply(kit).ok).toBe(false); } finally { session.restore(); }
    const code = encodeForge(kit);
    expect(() => roomKit(code, 'goku', true)).toThrow('not available');
    expect(() => new ForgeStore().save('owner', code)).toThrow('not available');
  });
  it('explicit laboratory Forge allows additions but never revives Pikachu', async () => {
    vi.stubEnv('MODE', 'fighter-lab');
    try {
      for (const source of additions) {
        expect(libraryMoves('goku').some(row => row.id === source)).toBe(true);
        expect(forgeProblems(ownKit(source), { sandbox: true, availability: 'laboratory' }).errors).toEqual([]);
      }
      expect(libraryMoves('goku').some(row => row.id === 'pikachu')).toBe(false);
      expect(forgeProblems(ownKit('pikachu'), { sandbox: true, availability: 'laboratory' }).errors).toContain('This fighter is not available.');
    } finally { vi.unstubAllEnvs(); }
  });
  it('keeps Toji physical entry with no shared energy aura or flame shell', () => {
    expect(OWN_ENTRANCES.has('toji')).toBe(true);
    expect(AWAKENINGS.toji.auraGlow).toBe(0);
    expect(AWAKENINGS.toji.flames).toBe(false);
    expect(AWAKENINGS.toji.kind).toBe('aura');
  });
  it('keeps Usopp native rush and ender releases ranged, with no lunge', () => {
    expect(MOVES.usopp.light.style).toBe('projectile');
    for (const move of RUSH.usopp) {
      expect(move.style).toBe('projectile');
      expect(move.lunge).toBe(0);
      expect(move.speed).toBeGreaterThan(0);
      expect(move.contacts).toHaveLength(1);
    }
    for (const branch of ['lh', 'llh', 'lllh', 'llls', 'airHeavy'] as const) {
      expect(comboMove('usopp', branch)?.style).toBe('projectile');
      expect(comboMove('usopp', branch)?.lunge).toBe(0);
    }
  });
});
