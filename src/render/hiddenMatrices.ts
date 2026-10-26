import * as THREE from 'three';


const always = new WeakSet<THREE.Object3D>();

function passShown(this: THREE.Object3D, force?: boolean) {
  if (this.matrixAutoUpdate) this.updateMatrix();
  if (this.matrixWorldNeedsUpdate || force) {
    if (this.matrixWorldAutoUpdate === true) {
      if (this.parent === null) this.matrixWorld.copy(this.matrix);
      else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    }
    this.matrixWorldNeedsUpdate = false;
    force = true;
  }
  const children = this.children;
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i];
    if (child.visible === false && !always.has(child)) { child.matrixWorldNeedsUpdate = true; continue; }
    child.updateMatrixWorld(force);
  }
}

export function skipHiddenChildren<T extends THREE.Object3D>(parent: T): T {
  if (parent.updateMatrixWorld === passShown) return parent;
  if (parent.updateMatrixWorld !== THREE.Object3D.prototype.updateMatrixWorld) throw new Error(`hiddenMatrices: '${parent.name || parent.type}' has a matrix pass of its own`);
  parent.updateMatrixWorld = passShown;
  return parent;
}

export function passWhileHidden<T extends THREE.Object3D>(object: T): T { always.add(object); return object; }

export function skipsHiddenChildren(parent: THREE.Object3D) { return parent.updateMatrixWorld === passShown; }
