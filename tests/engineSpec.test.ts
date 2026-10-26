import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { AWAKENINGS, moveFor, rushMove } from '../src/game/awakening';
import { COMBO_KEYS, comboMove } from '../src/game/combos';
import { CONTACT_GAP, MOVES, RUSH } from '../src/game/moves';
import { FIGHTER_SERIES } from '../src/game/stages';
import { FIGHTERS } from '../src/config';
import {
  ATTACK_SLOTS, BODY_TYPES, ELEMENT_KITS, FIGHTER_IDS, bodyTypeOf, canonicalJson, deriveSimSpec, elementKitsOf, membersOfKit,
  moveProblems, sha256, simRegistry, simSpec, simSpecHash, specHash, specProblems, type SimFighterSpec,
} from '../src/engine/sim';
import { presentationProblems, registry } from '../src/engine/client';

describe('the fighter registry', () => {
  it('has a spec for every fighter the game knows, and each one is valid', () => {
    expect(FIGHTER_IDS.length).toBeGreaterThanOrEqual(93);
    expect(new Set(FIGHTER_IDS)).toEqual(new Set(Object.keys(FIGHTERS)));
    expect(new Set(FIGHTER_IDS)).toEqual(new Set(Object.keys(AWAKENINGS)));
    expect([...simRegistry().keys()]).toEqual([...FIGHTER_IDS]);
    for (const [id, spec] of simRegistry()) expect(specProblems(spec), id).toEqual({ errors: [], warnings: [] });
  });

  it('is what the simulation runs: every slot, rush stage, combo ender and awakened move', () => {
    for (const id of FIGHTER_IDS) {
      const { kit, body, series } = simSpec(id)!;
      expect(series, id).toBe(FIGHTER_SERIES[id]); expect(body.contactGap, id).toBe(CONTACT_GAP[id]);
      expect(kit.awakening, id).toEqual(AWAKENINGS[id]);
      for (const slot of ATTACK_SLOTS) {
        expect(kit.slots[slot], `${id} ${slot}`).toEqual(moveFor(id, slot, false));
        expect(kit.awakened.slots[slot] ?? kit.slots[slot], `${id} awakened ${slot}`).toEqual(moveFor(id, slot, true));
      }
      expect(rushMove(id, 0, false), `${id} rush 0`).toEqual(kit.slots.light);
      expect(kit.rush.length, id).toBe(RUSH[id].length);
      kit.rush.forEach((move, i) => {
        expect(move, `${id} rush ${i + 1}`).toEqual(rushMove(id, i + 1, false));
        expect(kit.awakened.rush[i] ?? move, `${id} awakened rush ${i + 1}`).toEqual(rushMove(id, i + 1, true));
      });
      for (const key of COMBO_KEYS) {
        expect(kit.combos[key], `${id} ${key}`).toEqual(comboMove(id, key));
        expect(kit.awakened.combos[key] ?? kit.combos[key], `${id} awakened ${key}`).toEqual(comboMove(id, key, true));
      }
    }
  });

  it('is a frozen snapshot: reading a spec can never move a blow', () => {
    const spec = simSpec('endeavor')!;
    expect(Object.isFrozen(spec.kit.slots.special)).toBe(true); expect(Object.isFrozen(spec.kit.slots.special.contacts)).toBe(true);
    expect(() => { (spec.kit.slots.special as { damage: number }).damage = 9999; }).toThrow();
    expect(spec.kit.slots.special).not.toBe(MOVES.endeavor.special);
    expect(MOVES.endeavor.special.damage).not.toBe(9999);
  });

  it('names each fighter by its content: the same spec, the same hash, on any machine', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const text = canonicalJson(simSpec('zoro'));
    expect(sha256(text)).toBe(createHash('sha256').update(text).digest('hex'));
    expect(sha256('Ōkiji ❄ 青雉')).toBe(createHash('sha256').update('Ōkiji ❄ 青雉').digest('hex'));
    expect(canonicalJson({ b: 1, a: [1, undefined, { d: undefined, c: 2 }] })).toBe('{"a":[1,null,{"c":2}],"b":1}');
    expect(() => canonicalJson({ a: Number.NaN })).toThrow();
    expect(simSpecHash('zoro')).toBe(specHash(deriveSimSpec('zoro')));
    expect(new Set(FIGHTER_IDS.map(simSpecHash)).size).toBe(FIGHTER_IDS.length);
    const changed = structuredClone(simSpec('zoro')!) as SimFighterSpec;
    (changed.kit.slots.light as { damage: number }).damage += 1;
    expect(specHash(changed)).not.toBe(simSpecHash('zoro'));
  });

  it('refuses what the simulation could not run, and says where', () => {
    const light = MOVES.endeavor.light;
    expect(moveProblems(light, 'x').errors).toEqual([]);
    const errors = (patch: object) => moveProblems({ ...light, ...patch } as typeof light, 'kit.slots.light').errors;
    expect(errors({ contacts: [.3, .2] })[0]).toMatch(/^kit\.slots\.light: contact 1 \(0\.2\) lands before contact 0/);
    expect(errors({ contacts: [.9] })[0]).toMatch(/lands after the move ends/);
    expect(errors({ contacts: [] })[0]).toMatch(/has no contacts/);
    expect(errors({ schedule: [1, 2] })[0]).toMatch(/schedule has 2 entries for 1 contacts/);
    expect(errors({ style: 'laser' })[0]).toMatch(/style "laser" is not one of/);
    expect(errors({ damage: 5000 })[0]).toMatch(/damage 5000 is outside 0\.\.400/);
    expect(errors({ range: Number.NaN })[0]).toMatch(/range is not a number/);
    expect(errors({ outcome: 'explode' })[0]).toMatch(/outcome "explode"/);
    expect(errors({ name: ' ' })[0]).toMatch(/has no name/);
    const spec = structuredClone(simSpec('endeavor')!) as unknown as { kit: { slots: Partial<Record<string, unknown>> } };
    delete spec.kit.slots.ultimate;
    Object.assign(spec, { id: 'Not An Id', archetype: { body: 'tentacles', elements: ['plasma'] } });
    const problems = specProblems(spec as unknown as SimFighterSpec).errors;
    expect(problems).toEqual(expect.arrayContaining([expect.stringMatching(/^id "Not An Id"/), expect.stringMatching(/^body type "tentacles"/),
      expect.stringMatching(/^element kit "plasma"/), 'kit.slots.ultimate: missing']));
  });
});

describe('the archetype map', () => {
  it('gives every fighter one body type and at least one element kit', () => {
    for (const id of FIGHTER_IDS) {
      expect(BODY_TYPES[bodyTypeOf(id)!], id).toBeDefined();
      expect(elementKitsOf(id).length, id).toBeGreaterThan(0);
      for (const kit of elementKitsOf(id)) expect(ELEMENT_KITS[kit], `${id} ${kit}`).toBeDefined();
    }
  });

  it("keeps each world's own power look: Haki for One Piece only (the owner, 10 October 2026)", () => {
    for (const id of membersOfKit('haki')) expect(FIGHTER_SERIES[id], id).toBe('One Piece');
  });
});

describe('the whole fighter, with its card, look and palette', () => {
  it('joins every simulation spec to its presentation without an error', () => {
    expect(registry().size).toBe(simRegistry().size);
    for (const [id, spec] of registry()) {
      expect(spec.kit).toEqual(simSpec(id)!.kit);
      expect(spec.card.name, id).toBe(FIGHTERS[id].name); expect(spec.look.model, id).toBe(FIGHTERS[id].model);
      expect(presentationProblems(spec).errors, id).toEqual([]);
      for (const slot of ATTACK_SLOTS) expect(spec.palette.slots[slot].rim, `${id} ${slot}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps the simulation half free of the page: no three.js, no DOM, nothing from render, ui or config', () => {
    for (const name of fs.readdirSync('src/engine/sim')) {
      const source = fs.readFileSync(`src/engine/sim/${name}`, 'utf8');
      expect(source, name).not.toMatch(/from '(three|.*\/(render|ui|audio)\/|.*\/config)'/);
      expect(source, name).not.toMatch(/\b(window|document|localStorage)\./);
    }
  });
});
