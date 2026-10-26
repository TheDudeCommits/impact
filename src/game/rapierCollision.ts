import RAPIER from '@dimforge/rapier3d-compat';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from './moves';
import { BRIDGE_DECK_HALF_WIDTH, BRIDGE_DECK_PROFILE, BRIDGE_DECK_THICKNESS, HARBOR_BRIDGES, STONE_ARCH,
  stageColliders, type EnvironmentCollider } from './environmentLayout';
import stoneArch from './data/stoneArchCollider.json';
import stageCeilings from './data/stageCeilings.json';
import type { StageId } from './stages';
import type { CollisionWorld, Vec3 } from './types';

let initialization: Promise<void> | undefined;

function bridgeDeckMesh(scale: number): { vertices: Float32Array; indices: Uint32Array } {
  const sections = [...BRIDGE_DECK_PROFILE.slice(1).reverse().map(([z, y]) => [-z, y]), ...BRIDGE_DECK_PROFILE];
  const vertices: number[] = [], indices: number[] = [];
  for (const [z, y] of sections) {
    for (const height of [y, y - BRIDGE_DECK_THICKNESS]) {
      for (const x of [-BRIDGE_DECK_HALF_WIDTH, BRIDGE_DECK_HALF_WIDTH]) vertices.push(x * scale, height * scale, z * scale);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    const a = i * 4, b = a + 4;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
    indices.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
    indices.push(a, a + 2, b, a + 2, b + 2, b);
    indices.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3);
  }
  const last = (sections.length - 1) * 4;
  indices.push(0, 1, 2, 1, 3, 2, last, last + 2, last + 1, last + 1, last + 2, last + 3);
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

export interface RapierCollisionWorld extends CollisionWorld {
  penetration(position: Vec3, margin?: number): number;
  boxes: readonly EnvironmentCollider[];
  meshes: number;
  ceilings: number;
}

export async function createRapierCollision(stage: StageId = 'harbor'): Promise<RapierCollisionWorld> {
  await initRapier();
  return buildCollision(stage);
}

export async function initRapier() {
  await (initialization ??= RAPIER.init());
  return RAPIER;
}

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const OVERLAP = .02;
const MESH_PUSH = .3;
const SKIN = .01;
const SINK_REACH = .25;
const SKIN_CLEAR = .001;
const DOWN = { x: 0, y: -1, z: 0 };
const CEILING_HALF = .15;

export function buildCollision(stage: StageId): RapierCollisionWorld {
  const world = new RAPIER.World({ x: 0, y: -23, z: 0 });
  const fixedHandles = new Set<number>();
  const players = new Map<string, RAPIER.Collider>();
  const { floor, walls, landmarks } = stageColliders(stage);
  const boxes = [...floor, ...walls, ...landmarks];
  for (const c of boxes) {
    const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(c.halfX, c.halfY, c.halfZ).setTranslation(c.x, c.y, c.z));
    fixedHandles.add(collider.handle);
  }
  const roofHandles = new Set<number>();
  for (const c of (stageCeilings as Partial<Record<StageId, { x: number; z: number; halfX: number; halfZ: number; y: number }[]>>)[stage] ?? []) {
    const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(c.halfX, CEILING_HALF, c.halfZ).setTranslation(c.x, c.y + CEILING_HALF, c.z));
    roofHandles.add(collider.handle);
  }
  const ceilings = roofHandles.size;
  let meshes = 0;
  if (stage === 'harbor') {
    for (const bridge of HARBOR_BRIDGES) {
      const deck = bridgeDeckMesh(bridge.scale);
      const collider = world.createCollider(RAPIER.ColliderDesc.trimesh(deck.vertices, deck.indices,
        RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setTranslation(bridge.x, 0, bridge.z));
      fixedHandles.add(collider.handle);
      meshes++;
    }
    if (stoneArch.indices.length) {
      const archCollider = world.createCollider(RAPIER.ColliderDesc.trimesh(
        new Float32Array(stoneArch.vertices.map(v => v * STONE_ARCH.scale)), new Uint32Array(stoneArch.indices),
        RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setTranslation(STONE_ARCH.x, STONE_ARCH.y, STONE_ARCH.z)
        .setRotation({ x: 0, y: Math.sin(STONE_ARCH.rotation / 2), z: 0, w: Math.cos(STONE_ARCH.rotation / 2) }));
      fixedHandles.add(archCollider.handle);
      meshes++;
    }
  }
  const controller = world.createCharacterController(SKIN);
  controller.enableAutostep(0.3, 0.2, false);
  controller.setMaxSlopeClimbAngle(Math.PI / 4);
  controller.setMinSlopeSlideAngle(Math.PI / 3);
  controller.enableSnapToGround(.2);
  const halfSegment = PLAYER_HEIGHT / 2 - PLAYER_RADIUS;
  const isFixed = (c: RAPIER.Collider) => fixedHandles.has(c.handle);
  const isFixedOrRoof = (c: RAPIER.Collider) => fixedHandles.has(c.handle) || roofHandles.has(c.handle);
  world.step();

  function overlaps(translation: RAPIER.Vector, shape: RAPIER.Shape) {
    const found: { collider: RAPIER.Collider; contact: RAPIER.ShapeContact }[] = [];
    world.intersectionsWithShape(translation, IDENTITY, shape, other => {
      const contact = other.contactShape(shape, translation, IDENTITY, 0);
      if (contact && contact.distance < -OVERLAP) found.push({ collider: other, contact });
      return true;
    }, undefined, undefined, undefined, undefined, isFixed);
    return found;
  }

  function depenetrate(collider: RAPIER.Collider): Vec3 {
    const push = { x: 0, y: 0, z: 0 };
    for (let round = 0; round < 3; round++) {
      const t = collider.translation();
      const hits = overlaps(t, collider.shape);
      if (!hits.length) break;
      let moved = false;
      for (const { collider: other, contact } of hits) {
        const shape = other.shape;
        let dx = 0, dy = 0, dz = 0;
        if (shape.type === RAPIER.ShapeType.Cuboid) {
          const half = (shape as RAPIER.Cuboid).halfExtents, o = other.translation();
          const outX = half.x + PLAYER_RADIUS - Math.abs(t.x - o.x);
          const outZ = half.z + PLAYER_RADIUS - Math.abs(t.z - o.z);
          const outUp = o.y + half.y - (t.y - PLAYER_HEIGHT / 2) + OVERLAP;
          if (outX <= 0 || outZ <= 0) continue;
          const shortest = Math.min(outX, outZ, outUp);
          if (shortest === outUp) dy = outUp;
          else if (shortest === outX) dx = Math.sign(t.x - o.x || 1) * (outX + OVERLAP);
          else dz = Math.sign(t.z - o.z || 1) * (outZ + OVERLAP);
        } else {
          const n = contact.normal1;
          if (n.y < -.5) continue;
          const depth = Math.min(MESH_PUSH, -contact.distance + OVERLAP);
          dx = n.x * depth; dy = n.y * depth; dz = n.z * depth;
        }
        if (!dx && !dy && !dz) continue;
        push.x += dx; push.y += dy; push.z += dz;
        collider.setTranslation({ x: t.x + dx, y: t.y + dy, z: t.z + dz });
        moved = true;
        break;
      }
      if (!moved) break;
    }
    return push;
  }

  function unsink(collider: RAPIER.Collider): number {
    const t = collider.translation(), feet = t.y - PLAYER_HEIGHT / 2;
    const hit = world.castRayAndGetNormal(new RAPIER.Ray({ x: t.x, y: feet + SINK_REACH, z: t.z }, DOWN),
      SINK_REACH + SKIN + SKIN_CLEAR, true, undefined, undefined, undefined, undefined, isFixed);
    if (!hit || hit.timeOfImpact < 1e-4 || hit.normal.y < .7) return 0;
    const lift = SINK_REACH + SKIN + SKIN_CLEAR - hit.timeOfImpact;
    if (lift <= 0) return 0;
    collider.setTranslation({ x: t.x, y: t.y + lift, z: t.z });
    return lift;
  }

  function intoWall(collider: RAPIER.Collider, step: Vec3): boolean {
    const t = collider.translation();
    for (const { contact } of overlaps({ x: t.x + step.x, y: t.y + step.y, z: t.z + step.z }, collider.shape))
      if (Math.abs(contact.normal1.y) < .7) return true;
    return false;
  }

  return {
    boxes, meshes, ceilings,
    move(id, position, displacement) {
      let collider = players.get(id);
      if (!collider) {
        collider = world.createCollider(RAPIER.ColliderDesc.capsule(halfSegment, PLAYER_RADIUS));
        players.set(id, collider);
      }
      collider.setTranslation({ x: position.x, y: position.y + PLAYER_HEIGHT / 2, z: position.z });
      const push = depenetrate(collider);
      push.y += unsink(collider);
      controller.computeColliderMovement(collider, displacement, undefined, undefined, displacement.y > 0 ? isFixedOrRoof : isFixed);
      const movement = controller.computedMovement();
      let x = movement.x, y = movement.y, z = movement.z, grounded = controller.computedGrounded();
      const along = Math.hypot(displacement.x, displacement.z);
      if (displacement.y < 0 && along > .002 && Math.hypot(x, z) < along * .25) {
        controller.computeColliderMovement(collider, { x: displacement.x, y: 0, z: displacement.z }, undefined, undefined, isFixed);
        const flat = controller.computedMovement();
        if (Math.hypot(flat.x, flat.z) > Math.hypot(x, z) + 1e-4 && !intoWall(collider, flat)) { x = flat.x; y = flat.y; z = flat.z; grounded = controller.computedGrounded() || grounded; }
      }
      return { x: x + push.x, y: y + push.y, z: z + push.z, grounded };
    },
    penetration(position, margin = 0) {
      const shape = new RAPIER.Capsule(halfSegment, PLAYER_RADIUS + margin);
      const translation = { x: position.x, y: position.y + PLAYER_HEIGHT / 2 + margin, z: position.z };
      let deepest = 0;
      for (const { contact } of overlaps(translation, shape)) deepest = Math.max(deepest, -contact.distance);
      return deepest;
    },
    raycast(origin, endpoint) {
      const delta = { x: endpoint.x - origin.x, y: endpoint.y - origin.y, z: endpoint.z - origin.z };
      const length = Math.hypot(delta.x, delta.y, delta.z);
      if (length < 0.001) return { ...endpoint };
      const direction = { x: delta.x / length, y: delta.y / length, z: delta.z / length };
      const ray = new RAPIER.Ray(origin, direction);
      const hit = world.castRay(ray, length, true, undefined, undefined, undefined, undefined, isFixed);
      return hit ? ray.pointAt(hit.timeOfImpact) : { ...endpoint };
    },
    remove(id) {
      const collider = players.get(id);
      if (collider) world.removeCollider(collider, true);
      players.delete(id);
    },
    dispose() { players.clear(); world.removeCharacterController(controller); world.free(); },
  };
}
