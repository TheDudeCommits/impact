import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Debris } from '../src/render/vfx/Debris';
import { kiColours } from '../src/render/vfx/sparking/KiAura';
import { boltFor } from '../src/render/vfx/sparking/PowerUp';
import { auraRoar } from '../src/audio/CombatAudio';
import { OWN_ENTRANCES } from '../src/game/powerUp';
import { awakeningSwapAt } from '../src/game/awakening';
import * as anime from '../src/render/look/sparkingLook';
import { SPARK, setAnimeFinish, sparkingLook, sparkProfile } from '../src/render/look/sparkingLook';
import { lookFor } from '../src/render/look/stageLooks';
import { CLOUD_FLOOR, GROUND_BUDGET } from '../src/render/look/roanPass';
import type { PlayerState } from '../src/game/types';

describe('the ki flame\'s colours', () => {
  const hsl = { h: 0, s: 0, l: 0 };
  it('burns its body at the hue\'s full strength, under the bloom\'s knee, with a white-hot edge', () => {
    const blue = kiColours(0x9ff2ff, 0x1d63ff), pale = { ...hsl };
    new THREE.Color(0x9ff2ff).getHSL(pale);
    blue.core.getHSL(hsl);
    expect(hsl.l).toBeLessThan(pale.l - .1);
    expect(hsl.s).toBeGreaterThanOrEqual(pale.s - .3);
    expect(Math.max(blue.core.r, blue.core.g, blue.core.b)).toBeLessThanOrEqual(.821);
    expect(blue.hot.r + blue.hot.g + blue.hot.b).toBeGreaterThan(blue.core.r + blue.core.g + blue.core.b);
  });
  it('keeps a gold aura\'s heart orange, not brown', () => {
    const gold = kiColours(0xffe37a, 0xffa227);
    gold.deep.getHSL(hsl);
    expect(hsl.s).toBeGreaterThan(.8);
    expect(hsl.h * 360).toBeGreaterThan(20); expect(hsl.h * 360).toBeLessThan(50);
  });
  it('throws pink-white lightning out of a blue flame and blue-white out of a gold one', () => {
    const pink = boltFor(0x9ff2ff), blue = boltFor(0xffe37a);
    expect(pink.r).toBeGreaterThan(pink.g); expect(pink.b).toBeGreaterThan(pink.g);
    expect(blue.b).toBeGreaterThan(blue.r);
  });
});

describe('the power-up\'s roar', () => {
  const player = (fighter: PlayerState['fighter'], over: Partial<PlayerState> = {}) => ({
    id: 'p', fighter, alive: true, action: 'idle', actionTime: 0, actionDuration: 1, awakened: false, ...over,
  } as unknown as PlayerState);
  it('swells through the gather to its loudest on the break', () => {
    const swap = awakeningSwapAt('goku');
    const early = auraRoar(player('goku', { action: 'awaken', actionDuration: .9, actionTime: .02 / .9 }));
    const late = auraRoar(player('goku', { action: 'awaken', actionDuration: .9, actionTime: (swap - .02) / .9 }));
    const after = auraRoar(player('goku', { action: 'awaken', actionDuration: .9, actionTime: (swap + .1) / .9 }));
    expect(early).toBeGreaterThan(0); expect(late).toBeGreaterThan(early); expect(after).toBeGreaterThanOrEqual(late);
  });
  it('holds low under the fight while a flame burns, and not for a form with a body of its own', () => {
    const burning = auraRoar(player('goku', { awakened: true }));
    expect(burning).toBeGreaterThan(0); expect(burning).toBeLessThan(auraRoar(player('goku', { action: 'awaken', actionDuration: .9, actionTime: .9 })));
    expect(auraRoar(player('naruto', { awakened: true }))).toBe(0);
  });
  it('leaves the transformations heard by their own layers alone', () => {
    for (const id of OWN_ENTRANCES) expect(auraRoar(player(id, { action: 'awaken', actionDuration: .9, actionTime: .5 }))).toBe(0);
  });
});

describe('rubble a power-up lifts', () => {
  it('rises and hangs, then is thrown out and falls when the power breaks', () => {
    const debris = new Debris(new THREE.Scene(), 16);
    try {
      debris.lift(8, 0, 0, .5, 1.5, .12, 0, 3, 1.5);
      expect(debris.count).toBe(8);
      for (let i = 0; i < 30; i++) debris.update(1 / 60);
      const heights = () => { const m = new THREE.Matrix4(), p = new THREE.Vector3(); return Array.from({ length: debris.count }, (_, i) => { debris.mesh.getMatrixAt(i, m); return p.setFromMatrixPosition(m).y; }); };
      const lifted = heights();
      expect(Math.min(...lifted)).toBeGreaterThan(.1);
      debris.blast(0, 0, 0, 4, 8);
      for (let i = 0; i < 120; i++) debris.update(1 / 60);
      expect(Math.max(...heights())).toBeLessThan(Math.max(...lifted) + 3);
    } finally { debris.dispose(); }
  });
});

describe('the anime finish', () => {
  const hsl = { h: 0, s: 0, l: 0 };
  it('is the one look: no ?look= switch, no options to choose from', () => {
    for (const gone of ['LOOKS', 'PROFILES', 'chooseLook', 'currentLook']) expect(anime).not.toHaveProperty(gone);
    expect(sparkProfile()).toBe(SPARK);
  });
  it('draws the fighters with a fine line tinted by the cloth, a cloth-coloured shade and the painted folds kept', () => {
    expect(SPARK.ink.px).toBeGreaterThanOrEqual(1.6); expect(SPARK.ink.px).toBeLessThanOrEqual(1.8);
    expect(SPARK.ink.tint).toBeGreaterThan(0);
    expect(SPARK.shade.anime).toBeGreaterThan(.5);
    expect(SPARK.cel.crease).toBe(0);
    expect(SPARK.rim.px).toBeGreaterThan(2);
  });
  it('lights every stage\'s fighters with the rig: a key toward the lens, a warm and a cool rim from behind', () => {
    for (const stage of ['kami-lookout', 'onigashima', 'valley-of-the-end', 'malevolent-shrine', 'hueco-mundo'] as const) {
      const { rig, finish } = lookFor(stage);
      expect(rig, stage).toBeDefined(); expect(finish, stage).toBeDefined();
      expect(rig!.key).toBeGreaterThan(.3); expect(rig!.key).toBeLessThan(1);
      const warm = new THREE.Color(rig!.warm), cool = new THREE.Color(rig!.cool);
      expect(warm.r, stage).toBeGreaterThan(warm.b); expect(cool.b, stage).toBeGreaterThan(cool.r);
      expect(rig!.warmStrength).toBeGreaterThan(0); expect(rig!.coolStrength).toBeGreaterThan(0);
    }
  });
  it('grades the frame toward deep blue-violet darks and warm highlights, and pushes the background back', () => {
    const f = lookFor('kami-lookout').finish!;
    new THREE.Color(f.lift).getHSL(hsl);
    expect(hsl.h * 360).toBeGreaterThan(220); expect(hsl.h * 360).toBeLessThan(280);
    const warm = new THREE.Color(f.warm); expect(warm.r).toBeGreaterThan(warm.b);
    expect(f.curve).toBeGreaterThan(0); expect(f.diffusion.strength).toBeGreaterThan(0);
    expect(f).not.toHaveProperty('dof'); expect(f.haze.most).toBeGreaterThan(0); expect(f.ground).toBeGreaterThan(0);
    expect(f.ground).toBeLessThanOrEqual(1 - GROUND_BUDGET.keep / CLOUD_FLOOR + 1e-9);
    expect(lookFor('kami-lookout').bloom.threshold).toBe(f.diffusion.threshold);
  });
  it('turned off (a DEV still\'s other half), leaves the stage\'s look exactly as it was', () => {
    setAnimeFinish(false);
    try {
      const base = lookFor('kami-lookout');
      expect(base.rig).toBeUndefined(); expect(base.finish).toBeUndefined();
      expect(sparkingLook('kami-lookout', base)).toBe(base);
      expect(sparkProfile()).toBeUndefined();
    } finally { setAnimeFinish(true); }
  });
});
