import { STAGES, type StageId } from '../game/stages';
import { propBox, riftLayout } from '../game/riftLayouts';
import type { HordeWorld } from './horde/Horde';

const WORLDS = new Map<StageId, HordeWorld>();
export function riftWorld(stage: StageId): HordeWorld {
  let world = WORLDS.get(stage);
  if (!world) {
    const { halfX, halfZ } = STAGES[stage];
    const circles: { x: number; z: number; r: number }[] = [], boxes: { x: number; z: number; hx: number; hz: number }[] = [];
    for (const p of riftLayout(stage).props) {
      if (!p.solid) continue;
      if (p.round) circles.push({ x: p.x, z: p.z, r: p.w / 2 });
      else { const b = propBox(p); boxes.push({ x: b.x, z: b.z, hx: b.halfX, hz: b.halfZ }); }
    }
    world = { halfX, halfZ, circles, boxes };
    WORLDS.set(stage, world);
  }
  return world;
}
