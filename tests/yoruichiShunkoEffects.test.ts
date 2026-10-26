import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import { YoruichiShunko, YORUICHI_SHUNKO_LIMITS } from '../src/render/signature/YoruichiShunko';
const FIGHTER = 'yoruichi' as FighterId;
function body(id: string): Fighter {
  const group = new THREE.Group(); group.position.z = id === 'foe' ? 2 : 0;
  return { group, joints: new Map(), handR: new THREE.Vector3(.3, 1.4, .2), handL: new THREE.Vector3(-.3, 1.4, .2), state: { id, fighter: id === 'foe' ? 'goku' : FIGHTER, alive: true, action: 'idle', actionSeq: 2, actionTime: 0, actionDuration: 3 } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', actorId: 'me', targetId: 'foe', fighter: FIGHTER, slot: 'ultimate', serverTime: 10, actionSeq: 2, ...patch });
function harness(budget = 1) {
  const scene = new THREE.Scene(), fx = new YoruichiShunko(scene, { budget }), me = body('me'), foe = body('foe');
  const fighters = new Map([['me', me], ['foe', foe]]);
  const count = (name: string) => (scene.getObjectByName('yoruichi-shunko-' + name) as THREE.InstancedMesh).count;
  return { scene, fx, me, foe, fighters, count };
}
describe('Yoruichi bounded manual Shunko presentation', () => {
  it('does no idle work, alters no simulation state, and draws a distinct activation', () => {
    const h = harness(); try {
      h.fx.update(10, h.fighters); expect(h.count('bolts')).toBe(0); expect(h.count('rings')).toBe(0);
      Object.assign(h.me.state, { action: 'awaken', actionDuration: .9, actionTime: .62 }); const before = JSON.stringify(h.me.state);
      h.fx.update(10.5, h.fighters); expect(h.count('rings')).toBeGreaterThan(6); expect(JSON.stringify(h.me.state)).toBe(before);
    } finally { h.fx.dispose(); }
  });
  it('requires an actual confirm before the thunder-drum ultimate appears', () => {
    const h = harness(); try {
      Object.assign(h.me.state, { action: 'ultimate', actionTime: 2.4 / 3 });
      h.fx.update(12.4, h.fighters); expect(h.count('bolts')).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.update(12.4, h.fighters); expect(h.count('bolts')).toBeGreaterThan(0); expect(h.count('rings')).toBe(12);
    } finally { h.fx.dispose(); }
  });
  it.each(['interrupt', 'whiff', 'new action', 'target gone', 'reset'])('cancels the confirmed sequence on %s', reason => {
    const h = harness(); try {
      Object.assign(h.me.state, { action: 'ultimate', actionTime: 2.4 / 3 }); h.fx.handle(event(), h.fighters);
      h.fx.update(12.4, h.fighters); expect(h.count('bolts')).toBeGreaterThan(0);
      if (reason === 'interrupt') h.me.state.action = 'hurt';
      if (reason === 'whiff') h.fx.handle(event({ kind: 'whiff', id: 2 }), h.fighters);
      if (reason === 'new action') h.me.state.actionSeq = 3;
      if (reason === 'target gone') h.fighters.delete('foe');
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.42, h.fighters); expect(h.count('bolts')).toBe(0); expect(h.count('rings')).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('keeps the authoritative lethal endpoint only through its short finisher tail', () => {
    const h = harness(); try {
      Object.assign(h.me.state, { action: 'ultimate', actionTime: 2.4 / 3 }); h.fx.handle(event(), h.fighters);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 3, serverTime: 12.34 }), h.fighters); h.fighters.delete('foe');
      h.fx.update(12.4, h.fighters); expect(h.count('rings')).toBeGreaterThan(0);
      h.me.state.actionTime = 2.8 / 3; h.fx.update(12.8, h.fighters); expect(h.count('bolts')).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('retains bounded pools under crowded receipts and halves low-detail corona cost', () => {
    const h = harness(.3); try {
      Object.assign(h.me.state, { action: 'awaken', actionDuration: .9, actionTime: .7 }); h.fx.update(10, h.fighters); expect(h.count('rings')).toBe(7);
      Object.assign(h.me.state, { action: 'ultimate', actionDuration: 3, actionTime: .8 });
      for (let i = 0; i < 200; i++) h.fx.handle(event({ id: i + 2, kind: 'hit', contactIndex: 3, serverTime: 12.34 }), h.fighters);
      h.fx.update(12.4, h.fighters); expect(h.count('bolts')).toBeLessThanOrEqual(YORUICHI_SHUNKO_LIMITS.bolts); expect(h.count('rings')).toBeLessThanOrEqual(YORUICHI_SHUNKO_LIMITS.rings);
    } finally { h.fx.dispose(); h.fx.dispose(); expect(h.scene.children).toHaveLength(0); }
  });
});
