import * as THREE from 'three';

let stale = false;
export function sceneShown() { stale = true; }

export class EmptyInstances {
  enabled = true;
  private readonly meshes: THREE.Mesh[] = [];
  private readonly met = new WeakSet<THREE.Object3D>();
  private readonly held: THREE.Object3D[] = [];
  private readonly masks: number[] = [];
  private frames = 0;
  constructor(private readonly root: THREE.Object3D, private readonly every = 60) {}

  hold() {
    if (!this.enabled) return 0;
    if (this.frames++ % this.every === 0 || stale) { stale = false; this.collect(); }
    for (const mesh of this.meshes) {
      if (!mesh.visible || mesh.layers.mask === 0 || !isEmpty(mesh) || !plain(mesh)) continue;
      if (!this.met.has(mesh)) { if (shownAllTheWay(mesh)) this.met.add(mesh); continue; }
      this.held.push(mesh); this.masks.push(mesh.layers.mask); mesh.layers.mask = 0;
    }
    return this.held.length;
  }

  release() {
    for (let i = 0; i < this.held.length; i++) this.held[i].layers.mask = this.masks[i];
    this.held.length = 0; this.masks.length = 0;
  }

  private collect() {
    this.meshes.length = 0;
    this.walk(this.root);
  }
  private walk(parent: THREE.Object3D) {
    const children = parent.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child.visible || (child as THREE.Bone).isBone) continue;
      if (isInstanced(child)) this.meshes.push(child);
      if (child.children.length) this.walk(child);
    }
  }
}

const isInstanced = (object: THREE.Object3D): object is THREE.Mesh =>
  (object as THREE.InstancedMesh).isInstancedMesh === true || ((object as THREE.Mesh).isMesh === true && ((object as THREE.Mesh).geometry as THREE.InstancedBufferGeometry | undefined)?.isInstancedBufferGeometry === true);

export function isEmpty(mesh: THREE.Mesh) {
  if ((mesh as THREE.InstancedMesh).isInstancedMesh) return (mesh as THREE.InstancedMesh).count === 0;
  return (mesh.geometry as THREE.InstancedBufferGeometry).instanceCount === 0;
}

function shownAllTheWay(object: THREE.Object3D) {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

const before = THREE.Object3D.prototype.onBeforeRender, after = THREE.Object3D.prototype.onAfterRender;
const plain = (mesh: THREE.Object3D) => mesh.onBeforeRender === before && mesh.onAfterRender === after;
