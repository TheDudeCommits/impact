import * as THREE from 'three';
import { InstancedBatch } from '../InstancedBatch';
import type { EffectLayer } from '../Effect';
import { crystalGeometry, shardGeometry, floorQuad, cardQuad } from './geometry';
import { crystalMaterial, floorMaterial, mistMaterial } from './materials';

/** The ICE kit's batches: four draws for every ice effect in the scene, whoever casts it.
 *
 *  | batch    | shape                                       | cap | draws |
 *  | -------- | ------------------------------------------- | --- | ----- |
 *  | crystals | every crystal, the lance, the frozen shell  | 384 | 1     |
 *  | shards   | chips, feathers, rime needles               | 768 | 1     |
 *  | floor    | frozen floor discs and strips               | 6   | 1     |
 *  | mist     | cold mist cards                             | 40  | 1     |
 *
 *  The caps are the hard ceiling for the whole scene (a dozen fighters): an effect that finds a batch full draws
 *  less, never more. Built once per scene and shared (`IceKit.for`), so a second ice fighter costs no draw call. */
export const ICE_CAPS = Object.freeze({ crystals: 384, shards: 768, floor: 6, mist: 40 });

const kits = new WeakMap<THREE.Scene, IceKit>();

export class IceKit implements EffectLayer {
  /** The scene's kit, built by the first to ask; each `for` is matched by a `dispose`. */
  static for(scene: THREE.Scene) {
    let kit = kits.get(scene);
    if (!kit) { kit = new IceKit(scene); kits.set(scene, kit); }
    kit.refs++;
    return kit;
  }
  readonly crystals: InstancedBatch;
  readonly shards: InstancedBatch;
  readonly floor: InstancedBatch;
  readonly mist: InstancedBatch;
  private readonly batches: InstancedBatch[];
  private refs = 0;
  /** Who has begun drawing since the batches were last emptied. */
  private readonly begun = new Set<object>();
  private constructor(private readonly scene: THREE.Scene) {
    const crystals = crystalMaterial('IceCrystal'), shards = crystalMaterial('IceShard');
    this.crystals = new InstancedBatch(scene, { name: 'ice-crystals', geometry: crystalGeometry(), material: crystals, capacity: ICE_CAPS.crystals, tint: 'iceTint', data: 'iceData', clock: 'uTime', renderOrder: 3 });
    this.shards = new InstancedBatch(scene, { name: 'ice-shards', geometry: shardGeometry(), material: shards, capacity: ICE_CAPS.shards, tint: 'iceTint', data: 'iceData', clock: 'uTime', renderOrder: 3 });
    this.floor = new InstancedBatch(scene, { name: 'ice-floor', geometry: floorQuad(), material: floorMaterial('IceFloor'), capacity: ICE_CAPS.floor, tint: 'iceTint', data: 'iceData', clock: 'uTime', renderOrder: 2 });
    this.mist = new InstancedBatch(scene, { name: 'ice-mist', geometry: cardQuad(), material: mistMaterial('IceMist'), capacity: ICE_CAPS.mist, tint: 'iceTint', data: 'iceData', clock: 'uTime', renderOrder: 5 });
    this.batches = [this.crystals, this.shards, this.floor, this.mist];
  }
  /** Emptied once a frame however many owners draw into it: by the first owner to begin a second time since it was
   *  last emptied, which is the start of a new frame (whatever the clock says: a paused clock repeats its time). */
  begin(time: number, owner: object = this) {
    if (this.begun.size === 0 || this.begun.has(owner)) {
      this.begun.clear();
      for (const b of this.batches) b.begin(time);
    }
    this.begun.add(owner);
  }
  /** Every owner's end publishes what has been added so far; the last one in a frame leaves the full count. */
  end(_owner?: object) { for (const b of this.batches) b.end(); }
  reset() { this.begun.clear(); for (const b of this.batches) b.clear(); }
  /** Let go: the last owner disposes every batch. */
  dispose() {
    if (--this.refs > 0) return;
    kits.delete(this.scene);
    for (const b of this.batches) b.dispose();
  }
  /** Draw calls the kit adds while every batch has something in it. */
  static readonly DRAWS = 4;
}
