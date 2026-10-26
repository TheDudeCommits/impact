import * as THREE from 'three';
import type { Fighter } from '../../Fighter';
import { spaceOfContext, type SpaceBodies } from './host';


const BODY_RADIUS = .35;
const NO_BONES: ReadonlyMap<string, THREE.Object3D> = new Map();

class StandIn {
  readonly root = new THREE.Group();
  state: 'alive' | 'gone' = 'alive';
  facing = 0;
  height = 1.8;
  timer = 0;
  dissolve = 0;
  sliced = false;
  readonly cutPoint = new THREE.Vector3();
  _searchDistance = 0;
  get alive() { return this.state === 'alive'; }
  get finished() { return this.state === 'gone'; }
  get position() { return this.root.position; }
  get model() { return this.root; }
  get bones() { return NO_BONES; }
  see(f: Fighter) {
    this.root.position.set(f.group.position.x, 0, f.group.position.z);
    this.facing = (f.state as { yaw?: number } | undefined)?.yaw ?? 0;
    this.state = (f.state as { alive?: boolean } | undefined)?.alive === false ? 'gone' : 'alive';
  }
  place() { return this; }
  kill() { return false; }
  freeze() { return false; }
  skinnedMeshes(out: THREE.SkinnedMesh[] = []) { out.length = 0; return out; }
  vanish() {}
  bodyPoint() { return null; }
  bodyVelocity() { return null; }
  carry() {}
  sink() {}
  release() {}
  consume() { return 0; }
  corrode() { return 0; }
  update() {}
  dispose() {}
}

class GameField {
  readonly group = new THREE.Group();
  environment: unknown = null;
  private readonly bodies = new Map<string, StandIn>();
  constructor(private readonly space: { readonly bodies?: SpaceBodies }) {
    this.group.name = 'Dummies';
    this.group.visible = false;
  }
  private refresh() {
    const at = this.space.bodies;
    for (const [id, body] of this.bodies) if (!at?.fighters.has(id) || id === at.actor) { body.state = 'gone'; this.bodies.delete(id); }
    if (!at) return;
    for (const [id, f] of at.fighters) {
      if (id === at.actor) continue;
      let body = this.bodies.get(id);
      if (!body) { body = new StandIn(); this.bodies.set(id, body); }
      body.see(f);
    }
  }
  get aliveCount() { this.refresh(); let n = 0; for (const body of this.bodies.values()) if (body.alive) n++; return n; }
  findTargets(x: number, z: number, radius: number, out: StandIn[]) {
    out.length = 0;
    this.refresh();
    const reach = (radius + BODY_RADIUS) ** 2;
    for (const body of this.bodies.values()) {
      if (!body.alive) continue;
      const dx = body.position.x - x, dz = body.position.z - z, d = dx * dx + dz * dz;
      if (d > reach) continue;
      body._searchDistance = d;
      out.push(body);
    }
    return out.sort((a, b) => a._searchDistance - b._searchDistance);
  }
  findBodies(x: number, z: number, radius: number, out: StandIn[]) { return this.findTargets(x, z, radius, out); }
  reset() {}
  update() {}
  applyHits() {}
  dispose() { this.bodies.clear(); }
}

const fields = new WeakMap<object, GameField>();

export function preloadDummies(): Promise<void> { return Promise.resolve(); }

export function ensureField(ctx: object) {
  const space = spaceOfContext(ctx) ?? {};
  let field = fields.get(space);
  if (!field) { field = new GameField(space); fields.set(space, field); }
  return field;
}

export function trackCast() {}
export function untrackCast() {}
