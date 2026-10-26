import type * as THREE from 'three';
import type { EffectRegistry } from '../Effect';
import { IceKit, ICE_CAPS } from './IceKit';
import { crystalFieldType } from './CrystalField';
import { floorFreezeType } from './FloorFreeze';
import { iceLanceType } from './IceLance';
import { icePheasantType } from './IcePheasant';
import { freezeOnHitType } from './FreezeOnHit';

export { ICE_PRESETS, icePreset, definePreset, presetFromPalette, type IcePreset, type IcePresetId } from './preset';
export type { CrystalFieldParams } from './CrystalField';
export type { FloorFreezeParams } from './FloorFreeze';
export type { IceLanceParams } from './IceLance';
export type { IcePheasantParams } from './IcePheasant';
export type { FreezeOnHitParams } from './FreezeOnHit';
export { IceKit, ICE_CAPS };

/** The ICE element kit's effect ids. */
export const ICE = Object.freeze({ field: 'ice/crystal-field', floor: 'ice/floor-freeze', lance: 'ice/lance', pheasant: 'ice/pheasant', freeze: 'ice/freeze' } as const);

/** Every ICE effect type into `registry`, drawing into the scene's shared kit (built now, its meshes in the scene for
 *  the load-time compile), each type's pool made. */
export function registerIce(registry: EffectRegistry, scene: THREE.Scene) {
  const kit = IceKit.for(scene);
  registry.layer(kit)
    .register(crystalFieldType(kit))
    .register(floorFreezeType(kit))
    .register(iceLanceType(kit))
    .register(icePheasantType(kit))
    .register(freezeOnHitType(kit));
  registry.prewarm(scene);
  return kit;
}
