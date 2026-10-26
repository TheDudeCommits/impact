import * as THREE from 'three';
import { vi } from 'vitest';
import { EmperorEffects } from '../src/render/EmperorEffects';
import { comboMove, COMBO_SLOT, type ComboKey } from '../src/game/combos';
import type { Fighter } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';

const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'a', name: 'X', fighter: 'kaido', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 1, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
export function body(id: string, fighter: FighterId, props: Partial<PlayerState> = {}): Fighter {
  const state = player({ id, fighter, ...props });
  const group = new THREE.Group(); group.name = `fighter-${id}`; group.position.set(state.x, state.y, state.z);
  const model = new THREE.Group(); model.name = 'model'; group.add(model);
  const bone = (name: string, x: number, y: number, z: number, parent?: THREE.Object3D) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); (parent ?? model).add(b); return b; };
  const hips = bone('Hips', 0, 1, 0), spine = bone('Spine1', 0, .3, 0, hips), head = bone('Head', 0, .5, 0, spine);
  const handR = new THREE.Vector3(.25, 1.25, .45).add(group.position), handL = new THREE.Vector3(-.25, 1.25, .45).add(group.position);
  const joints = new Map<string, THREE.Object3D>([['Hips', hips], ['Spine1', spine], ['Head', head]]);
  return { state, group, model, velocity: new THREE.Vector3(), handR, handL, bones: new Map(), joints, clips: [], armed: true,
    chargePosition(out: THREE.Vector3) { return out.copy(handR); }, meleeContactPoint() { return false; }, strikePoint(out: THREE.Vector3) { return out.copy(handR).add(new THREE.Vector3(0, .2, .6)); },
    visualCenter(out: THREE.Vector3) { return out.copy(group.position).setY(group.position.y + 1.05); } } as unknown as Fighter;
}

export function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function fingerprint(scene: THREE.Scene) {
  let h = 0x811c9dc5;
  const mix = (n: number) => { h ^= n | 0; h = Math.imul(h, 0x01000193) >>> 0; };
  const num = (x: number) => mix(Number.isFinite(x) ? Math.round(x * 1e4) : 77777);
  const str = (s: string) => { for (let i = 0; i < s.length; i++) mix(s.charCodeAt(i)); };
  const value = (v: unknown, depth = 0): void => {
    if (depth > 3 || v === null || v === undefined) return;
    if (typeof v === 'number') return num(v);
    if (typeof v === 'boolean') return mix(v ? 1 : 2);
    if (v instanceof THREE.Color) { num(v.r); num(v.g); num(v.b); return; }
    if (v instanceof THREE.Vector2 || v instanceof THREE.Vector3 || v instanceof THREE.Vector4) { for (const x of v.toArray()) num(x); return; }
    if (v instanceof THREE.Matrix4 || v instanceof THREE.Matrix3) { for (const x of v.elements) num(x); return; }
    if (Array.isArray(v)) { for (const x of v) value(x, depth + 1); return; }
  };
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    str(o.name); mix(o.visible ? 1 : 0);
    if (!o.visible) return;
    for (const x of o.matrixWorld.elements) num(x);
    const mesh = o as THREE.Mesh & { count?: number };
    if (!mesh.isMesh) return;
    if (typeof mesh.count === 'number') mix(mesh.count);
    const g = mesh.geometry as THREE.BufferGeometry & { instanceCount?: number };
    if (g.instanceCount !== undefined && Number.isFinite(g.instanceCount)) mix(g.instanceCount);
    const limit = (attr: { count: number; itemSize: number }) => Math.min(attr.count, 4096) * attr.itemSize;
    for (const name of Object.keys(g.attributes)) {
      const a = g.attributes[name] as THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
      if (!(a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute && !(a as THREE.InstancedBufferAttribute).isInstancedBufferAttribute) continue;
      const array = ((a as THREE.InterleavedBufferAttribute).data?.array ?? (a as THREE.BufferAttribute).array) as ArrayLike<number>;
      str(name); for (let i = 0; i < Math.min(array.length, limit(a)); i++) num(array[i]);
    }
    const im = (mesh as unknown as THREE.InstancedMesh).instanceMatrix, ic = (mesh as unknown as THREE.InstancedMesh).instanceColor;
    const n = typeof mesh.count === 'number' ? mesh.count : 0;
    if (im) for (let i = 0; i < n * 16; i++) num(im.array[i]);
    if (ic) for (let i = 0; i < n * 3; i++) num(ic.array[i]);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of materials) {
      const u = (m as THREE.ShaderMaterial).uniforms;
      if (u) for (const key of Object.keys(u).sort()) { if (key === 'uTime' || key === 'uClock') continue; str(key); value(u[key].value); }
      const basic = m as THREE.MeshBasicMaterial;
      if (basic.color) value(basic.color);
      num(basic.opacity ?? 1);
    }
  });
  return h >>> 0;
}

export function run(fighter: FighterId, key: ComboKey, awakened = false) {
  vi.spyOn(Math, 'random').mockImplementation(seeded(fighter.length * 131 + key.length * 7));
  const scene = new THREE.Scene(), fx = new EmperorEffects(scene), move = comboMove(fighter, key, awakened)!;
  const actor = body('a', fighter, { action: COMBO_SLOT[key], branch: key, actionStarted: 1, actionDuration: move.duration, target: 'b', awakened, actionSeq: 4 });
  const victim = body('b', 'goku', { z: 1.6, yaw: Math.PI });
  scene.add(actor.group, victim.group);
  const fighters = new Map([['a', actor], ['b', victim]]);
  let folded = 0x811c9dc5, drawn = 0;
  try {
    for (let i = 0; i <= Math.ceil(move.duration * 30) + 6; i++) {
      const elapsed = i / 30, time = 1 + elapsed;
      if (elapsed <= move.duration) actor.state.actionTime = elapsed / move.duration; else { actor.state.action = 'idle'; actor.state.branch = undefined; }
      fx.update(time, fighters, 1);
      const f = fingerprint(scene);
      folded = Math.imul(folded ^ f, 0x01000193) >>> 0;
      drawn++;
    }
  } finally { fx.dispose(); vi.restoreAllMocks(); }
  return { folded, drawn };
}

