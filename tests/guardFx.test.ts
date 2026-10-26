import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GuardFx, GUARD_FRAGMENT, GUARD_VERTEX } from '../src/render/vfx/GuardFx';
import { VfxKit } from '../src/render/vfx/VfxKit';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, PlayerState } from '../src/game/types';


const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'b', name: 'B', fighter: 'goku', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000,
  stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionTime: 0, actionDuration: 0, target: null, alive: true, isBot: false, grounded: true,
  guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
const body = (state: PlayerState) => ({ state, group: new THREE.Group(), velocity: new THREE.Vector3() }) as unknown as Fighter;
const event = (props: Partial<CombatEvent>): CombatEvent => ({ id: 1, kind: 'blocked', serverTime: 1, actorId: 'a', targetId: 'b', slot: 'light',
  origin: { x: 0, y: 1, z: 2 }, endpoint: { x: 0, y: 1, z: 0 }, ...props });

function setup(state: Partial<PlayerState> = {}) {
  const scene = new THREE.Scene(), kit = VfxKit.for(scene), fx = new GuardFx(scene, kit);
  const fighters = new Map<string, Fighter>([['b', body(player(state))], ['a', body(player({ id: 'a', z: 2 }))]]);
  const mesh = scene.getObjectByName('guard-aura') as THREE.InstancedMesh;
  const attr = (name: string) => mesh.geometry.getAttribute(name).array as Float32Array;
  let time = 1;
  const run = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) { time += 1 / 60; fx.update(time, 1 / 60, fighters); } };
  return { scene, kit, fx, fighters, mesh, attr, run, at: () => time, dispose: () => { fx.dispose(); kit.release(); } };
}

describe('the guard aura', () => {
  it('draws its far walls and then its near walls as three\'s two passes did, without flipping a material\'s side', () => {
    const { scene, fighters, run, dispose } = setup({ guarding: true });
    const back = scene.getObjectByName('guard-aura') as THREE.InstancedMesh, front = scene.getObjectByName('guard-aura-front') as THREE.InstancedMesh;
    const bm = back.material as THREE.ShaderMaterial, fm = front.material as THREE.ShaderMaterial;
    expect([bm.side, fm.side]).toEqual([THREE.BackSide, THREE.FrontSide]);
    for (const m of [bm, fm]) expect([m.transparent, m.depthWrite, m.toneMapped, m.vertexShader, m.fragmentShader]).toEqual([true, false, false, GUARD_VERTEX, GUARD_FRAGMENT]);
    expect(fm.uniforms).toBe(bm.uniforms);
    expect(front.geometry).toBe(back.geometry);
    expect(front.instanceMatrix).toBe(back.instanceMatrix);
    run(.5);
    expect(back.count).toBeGreaterThan(0);
    expect(front.count).toBe(back.count);
    expect([back.renderOrder, front.renderOrder]).toEqual([2, 2]);
    expect([back.frustumCulled, front.frustumCulled]).toEqual([false, false]);
    expect(front.parent).toBe(back.parent);
    expect(front.id).toBe(back.id + 1);
    expect(front.matrixWorld.equals(back.matrixWorld)).toBe(true);
    for (const m of [bm, fm]) expect(m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass).toBe(false);
    void fighters; dispose();
  });
  it('uses no word GLSL ES reserves', () => {
    const reserved = ['flat', 'smooth', 'noperspective', 'centroid', 'sample', 'patch', 'invariant', 'precise', 'coherent', 'half', 'fixed', 'input',
      'output', 'long', 'short', 'double', 'unsigned', 'superp', 'sizeof', 'cast', 'namespace', 'using', 'public', 'static', 'extern', 'external',
      'interface', 'class', 'union', 'enum', 'typedef', 'template', 'this', 'packed', 'goto', 'inline', 'noinline', 'volatile', 'asm', 'filter',
      'common', 'partition', 'active', 'resource', 'buffer', 'shared'];
    for (const source of [GUARD_VERTEX, GUARD_FRAGMENT]) {
      const words = new Set(source.replace(/\/\/.*$/gm, '').match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []);
      for (const word of reserved) expect(words.has(word), word).toBe(false);
    }
  });

  it('stands round a fighter whose guard is up, and only then: one instance, faded in', () => {
    const g = setup({ guarding: true });
    try {
      g.run(.3);
      expect(g.mesh.count).toBe(1);
      expect(g.attr('aGuard')[1], 'faded in').toBeGreaterThan(.95);
      g.fighters.get('b')!.state.guarding = false;
      g.run(.8);
      expect(g.mesh.count, 'and gone once it is down').toBe(0);
    } finally { g.dispose(); }
  });

  it('is the guard\'s health: whole on a full bar, cracked and dim on an empty one', () => {
    const full = setup({ guarding: true, stamina: 100 }), spent = setup({ guarding: true, stamina: 12 });
    try {
      full.run(.5); spent.run(.5);
      expect(full.attr('aGuard')[0]).toBeGreaterThan(.97);
      expect(spent.attr('aGuard')[0]).toBeLessThan(.15);
    } finally { full.dispose(); spent.dispose(); }
  });

  it('holds up through a blockstun (the guard pose without the button)', () => {
    const g = setup({ guarding: false, action: 'guard' });
    try { g.run(.3); expect(g.mesh.count).toBe(1); } finally { g.dispose(); }
  });

  it('ripples where a blow lands, flashes on a parry, and shatters on a break', () => {
    const g = setup({ guarding: true });
    try {
      g.run(.2);
      g.fx.event(event({ kind: 'blocked', serverTime: g.at() }), g.fighters);
      g.run(1 / 60);
      const hit = g.attr('aHit');
      expect(hit[3], 'the ripple has weight').toBeGreaterThan(0);
      expect(hit[2], 'and comes from the blow\'s side').toBeGreaterThan(.8);
      g.fx.event(event({ id: 2, kind: 'just-guard', serverTime: g.at() }), g.fighters);
      g.run(2 / 60);
      expect(g.attr('aFace')[2], 'the parry\'s flare').toBeGreaterThan(.5);
      g.fx.event(event({ id: 3, kind: 'guard-break', serverTime: g.at(), slot: 'special' }), g.fighters);
      g.fighters.get('b')!.state.guarding = false;
      g.run(1 / 60);
      expect(g.attr('aGuard')[0], 'cracked through').toBeLessThan(.5);
      expect(g.attr('aFace')[3], 'shattering').toBeGreaterThanOrEqual(0);
      g.run(.6);
      expect(g.mesh.count, 'and gone').toBe(0);
    } finally { g.dispose(); }
  });

  it('throws its bursts from the shared sprite pools, more for a parry than for a jab on the guard', () => {
    const g = setup({ guarding: true });
    try {
      g.run(.2);
      const emit = vi.spyOn(g.kit.sparks, 'emit');
      g.fx.event(event({ kind: 'blocked', serverTime: g.at() }), g.fighters);
      const block = emit.mock.calls.length;
      emit.mockClear();
      g.fx.event(event({ id: 2, kind: 'just-guard', serverTime: g.at() }), g.fighters);
      const parry = emit.mock.calls.length;
      expect(block).toBeGreaterThan(0);
      expect(parry).toBeGreaterThan(block);
      emit.mockClear();
      g.fx.event(event({ id: 3, kind: 'just-guard', serverTime: g.at(), reason: 'deflect', origin: { x: 0, y: 1, z: 14 } }), g.fighters);
      const xs = (g.kit.sparks as unknown as { spec: { z: number } }).spec.z;
      expect(Math.abs(xs), 'drawn at the guard').toBeLessThan(2);
    } finally { g.dispose(); }
  });

  it('lets go of a fighter who leaves', () => {
    const g = setup({ guarding: true });
    try {
      g.run(.2); expect(g.mesh.count).toBe(1);
      g.fighters.delete('b'); g.run(1 / 60);
      expect(g.mesh.count).toBe(0);
    } finally { g.dispose(); }
  });
});
