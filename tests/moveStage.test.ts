import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MoveStage, SHEEN, STAGE, STAGE_LIMITS, stageLook } from '../src/render/signature/MoveStage';
import { SIGNATURE } from '../src/render/signature/context';
import { blowFloor } from '../src/render/signature/blowFloor';
import type { Fighter } from '../src/render/Fighter';

const at = (x = 0, y = 1, z = 0) => new THREE.Vector3(x, y, z);
const FORWARD = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);
function setup(budget = 1) { const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }); return { scene, stage }; }
const total = (stage: MoveStage) => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.lights + c.discs + c.shells; };

describe('the shared move stage (docs/engine/VFX_BAR.md)', () => {
  it('is one set of pools a scene, shared by its users and let go by the last of them', () => {
    const scene = new THREE.Scene(), a = MoveStage.for(scene, { budget: 1 }), b = MoveStage.for(scene, { budget: 1 });
    expect(a).toBe(b);
    const pools = scene.children.length;
    expect(pools).toBeGreaterThan(0);
    a.release();
    expect(scene.children.length).toBe(pools);
    b.release();
    expect(scene.children.length).toBe(0);
    const c = MoveStage.for(scene, { budget: 1 });
    expect(c).not.toBe(a);
    c.release();
    expect(scene.children.length).toBe(0);
  });

  it('draws what is asked this frame and nothing the next, whoever opens it first', () => {
    const { stage } = setup();
    try {
      stage.open(1).charge(at(), STAGE.fire, .3, 1); stage.close();
      const one = total(stage);
      expect(one).toBeGreaterThan(0);
      stage.open(1).charge(at(2), STAGE.fire, .3, 1); stage.close();
      expect(total(stage)).toBe(one * 2);
      stage.open(1.016); stage.close();
      expect(total(stage)).toBe(0);
    } finally { stage.release(); }
  });

  it('stages each beat of a special and an ultimate with light on the room', () => {
    const { stage } = setup();
    try {
      const lit = (draw: () => unknown) => { stage.open(stage.time + .016); draw(); stage.close(); expect(stage.counts.lights).toBeGreaterThan(0); return stage.counts; };
      expect(lit(() => stage.charge(at(), STAGE.fire, .3, .6)).bolts).toBeGreaterThan(0);
      expect(lit(() => stage.orb(at(), FORWARD, .5, STAGE.fire)).flames).toBeGreaterThan(0);
      expect(lit(() => stage.beam(at(), at(0, 1, 8), .5, STAGE.fire, .4)).glows).toBeGreaterThan(0);
      expect(lit(() => stage.column(at(0, 0, 0), UP, 1, 8, STAGE.fire, 1)).flames).toBeGreaterThan(4);
      expect(lit(() => stage.bubble(at(), .6, STAGE.quake, 1)).shells).toBe(1);
      expect(lit(() => stage.pool(at(0, 0, 0), 4, STAGE.dark, .8)).discs).toBe(1);
      expect(lit(() => stage.ring(at(0, 0, 0), 2, 1.5, STAGE.fire, 1)).flames).toBeGreaterThan(3);
      expect(lit(() => stage.cracks(at(), FORWARD, 3, STAGE.quake, 1, 7)).bolts).toBeGreaterThan(20);
    } finally { stage.release(); }
  });

  it('keeps a one-shot for its own life and no longer', () => {
    const { stage } = setup();
    try {
      stage.open(2);
      stage.burst(at(), STAGE.fire, 1.5, 2, { floor: 0 }); stage.scar(at(0, 0, 0), STAGE.fire, 1.5, 2, 1.5); stage.shock(at(0, 0, 0), STAGE.fire, 5, 2, .5);
      stage.shatter(at(), FORWARD, STAGE.quake, 3, 2, .7); stage.erupt(at(0, 0, 0), UP, STAGE.fire, 1, 8, 2.1, .6);
      stage.close();
      expect(stage.counts.shots).toBe(5);
      stage.open(2.2); stage.close();
      expect(stage.counts.flames).toBeGreaterThan(0); expect(stage.counts.discs).toBeGreaterThan(0); expect(stage.counts.bolts).toBeGreaterThan(0); expect(stage.counts.lights).toBeGreaterThan(0);
      stage.open(2.8); stage.close();
      expect(stage.counts.shots).toBe(1);
      stage.open(4); stage.close();
      expect(stage.counts.shots).toBe(0); expect(total(stage)).toBe(0);
    } finally { stage.release(); }
  });

  it('never overruns a pool, however much a crowd asks of it', () => {
    const { stage } = setup();
    try {
      stage.open(1);
      for (let i = 0; i < 300; i++) {
        stage.charge(at(i), STAGE.fire, .5, 1, i); stage.column(at(i, 0, 0), UP, 1, 12, STAGE.fire, 1, i); stage.cracks(at(i), FORWARD, 3, STAGE.quake, 1, i);
        stage.bubble(at(i), 1, STAGE.quake); stage.pool(at(i, 0, 0), 3, STAGE.dark, 1, i); stage.orb(at(i), FORWARD, .6, STAGE.dark, i);
        stage.burst(at(i), STAGE.fire, 2, 1, { floor: 0 }); stage.scar(at(i, 0, 0), STAGE.fire, 2, 1);
      }
      stage.close();
      const c = stage.counts;
      for (const pool of ['flames', 'glows', 'bolts', 'lights', 'discs', 'shells', 'shots'] as const) expect(c[pool], pool).toBeLessThanOrEqual(STAGE_LIMITS[pool]);
      expect(c.flames).toBe(STAGE_LIMITS.flames);
      stage.reset();
      expect(stage.counts.shots).toBe(0); expect(total(stage)).toBe(0);
    } finally { stage.release(); }
  });

  it('draws less at a lower budget, and no scars at the lowest', () => {
    const high = setup(1), low = setup(.3);
    try {
      for (const { stage } of [high, low]) { stage.open(1); stage.column(at(0, 0, 0), UP, 1, 10, STAGE.fire, 1); stage.charge(at(), STAGE.fire, .4, 1); stage.scar(at(0, 0, 0), STAGE.fire, 2, 1); stage.close(); }
      expect(low.stage.counts.flames).toBeLessThan(high.stage.counts.flames);
      expect(low.stage.counts.bolts).toBeLessThan(high.stage.counts.bolts);
      expect(high.stage.counts.shots).toBe(1); expect(low.stage.counts.shots).toBe(0);
      const tier = MoveStage.for(new THREE.Scene(), { budget: .5, quality: 'low' });
      try { tier.open(1); tier.scar(at(0, 0, 0), STAGE.fire, 2, 1); tier.burst(at(), STAGE.fire, 1, 1); tier.close(); expect(tier.counts.shots).toBe(1); } finally { tier.release(); }
    } finally { high.stage.release(); low.stage.release(); }
  });

  it('makes a look that blooms from a casting\'s palette, and keeps darkness dark', () => {
    const look = stageLook(0xfff7d0, 0xff6418, 0x9b2815);
    expect(Math.max(look.main.r, look.main.g, look.main.b)).toBeGreaterThan(1.5);
    expect(Math.max(look.core.r, look.core.g, look.core.b)).toBeGreaterThan(2.5);
    expect(look.dark).toBe(false);
    const { scene, stage } = setup();
    try {
      stage.open(1).charge(at(), STAGE.dark, .4, 1); stage.close();
      expect(scene.children.some(o => o.name === 'stage-sphere' && o.visible && o.scale.x > .1)).toBe(true);
      expect(STAGE.dark.dark).toBe(true);
    } finally { stage.release(); }
  });

  it('lays what lies on the floor on the room\'s own floor, whatever height it is handed (blowFloor.ts)', () => {
    const { scene, stage } = setup();
    const discY = (i = 0) => (scene.getObjectByName('stage-discs') as THREE.Mesh).geometry.getAttribute('aP').getY(i);
    const flameY = (i: number) => { const m = new THREE.Matrix4(); (scene.getObjectByName('stage-flames') as THREE.InstancedMesh).getMatrixAt(i, m); return m.elements[13]; };
    try {
      stage.open(1).disc(at(40, 2), 2, STAGE.fire.main, 1, SHEEN, 1); stage.close();
      expect(discY()).toBeCloseTo(2.02, 5);
      SIGNATURE.floor = (_x, y) => y > -.5 && y < 6 ? 0 : undefined;
      for (const [i, handed] of [-.05, .12, 2].entries()) {
        stage.open(2 + i).disc(at(50 + i * 3, handed), 2, STAGE.fire.main, 1, SHEEN, 1); stage.close();
        expect(discY()).toBeCloseTo(.03, 5);
      }
      stage.open(6).disc(at(70, 9), 2, STAGE.fire.main, 1, SHEEN, 1); stage.close();
      expect(discY()).toBeCloseTo(9.02, 5);
      stage.open(7); stage.shock(at(80, -.05), STAGE.fire, 3, 7); stage.close();
      stage.open(7.1); stage.close();
      expect(stage.counts.discs).toBe(1);
      expect(discY()).toBeCloseTo(.03, 5);
      stage.open(8); stage.scar(at(84, -.05), STAGE.fire, 2, 8); stage.close();
      stage.open(8.2); stage.close();
      expect(stage.counts.discs).toBe(1);
      expect(discY()).toBeCloseTo(.03, 5);
      stage.open(9); const first = stage.counts.flames; stage.ring(at(90, .01), 2, 1.5, STAGE.fire, 1, 3, 6); const n = stage.counts.flames - first; stage.ring(at(90, 2.2), 2, 1.5, STAGE.fire, 1, 3, 6); stage.close();
      expect(n).toBeGreaterThan(0);
      expect(stage.counts.flames).toBe(first + n * 2);
      for (let i = 0; i < n; i++) expect(flameY(first + n + i)).toBeCloseTo(flameY(first + i), 5);
    } finally { SIGNATURE.floor = undefined; stage.release(); }
  });

  it('finds the floor under a blow: the room\'s where the room can say, else a standing body\'s', () => {
    const body = (x: number, y: number, grounded: boolean) => ({ state: { grounded }, group: { position: new THREE.Vector3(x, y, 0) } }) as unknown as Fighter;
    const thrower = body(100, .01, true), struck = body(103, -.053, false), launched = body(103, 2.4, false);
    expect(blowFloor(thrower, struck, 0)).toBe(.01);
    expect(blowFloor(body(100, 3, false), launched, 0)).toBe(2.4);
    expect(blowFloor(undefined, undefined, .4)).toBe(.4);
    SIGNATURE.floor = (x, y) => y > -.5 && y < 6 ? (x > 102 ? .2 : 0) : undefined;
    try {
      expect(blowFloor(thrower, struck, 0)).toBeCloseTo(.21, 5);
      expect(blowFloor(body(100, 3, false), launched, 0)).toBeCloseTo(.21, 5);
    } finally { SIGNATURE.floor = undefined; }
  });
});
