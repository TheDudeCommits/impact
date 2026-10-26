import * as THREE from 'three';
import { propColliders } from '../../../game/stageProps';
import { LIQUID_FLOORS } from '../../../game/footing';
import { modelTriangles, type GroundPlan } from '../build';
import { box, DENSITY } from '../mask';
import { wallsFromModel, WaterSurface, type WaterPlan } from '../water';
import { splashImpulse, subscribeSplashes } from '../splashes';

const LAKE = /^Domain_Blood$/;
const notLake = (mesh: THREE.Mesh) => !LAKE.test((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name);

export const SHRINE_WATER: Omit<WaterPlan, 'walls' | 'look' | 'source'> = {
  name: 'shrine blood',
  level: LIQUID_FLOORS['malevolent-shrine']!.level,
  sim: { x0: -44, z0: -50, x1: 44, z1: 48 },
  open: [true, true, true, true],
  speed: 5, damping: .5,
  slope: 2.5,
};

export const SHRINE_GROUND: GroundPlan = {
  async water(c) {
    const plan: WaterPlan = {
      ...SHRINE_WATER,
      walls: field => {
        wallsFromModel(field, modelTriangles(c.model, notLake), SHRINE_WATER.level, .12);
        for (const p of propColliders('malevolent-shrine')) field.paint(DENSITY, box(p.x, p.z, p.halfX, p.halfZ), 1, 'max', .3);
      },
      source: findLake(c.model),
      look: { crest: 0xe0505a, foam: 0xf3a6ae },
    };
    if (!plan.source) throw new Error('malevolent shrine: the lake (Domain_Blood) was not found');
    const water = new WaterSurface(c.frame, plan);
    c.own(water);
    c.own({ dispose: subscribeSplashes((x, z, size, dx, dz) => water.push(splashImpulse(x, z, size, dx, dz))) });
  },
};

function findLake(model: THREE.Object3D) {
  let found: THREE.Mesh | undefined;
  model.traverse(o => {
    const m = o as THREE.Mesh;
    if (!found && m.isMesh && !notLake(m)) found = m;
  });
  return found;
}
