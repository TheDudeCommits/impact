import * as THREE from 'three';

export function jointInAncestor(joint: THREE.Object3D, ancestor: THREE.Object3D, out: THREE.Vector3) {
  out.set(0, 0, 0);
  let node: THREE.Object3D | null = joint;
  while (node && node !== ancestor) {
    if (node.matrixAutoUpdate) node.updateMatrix();
    out.applyMatrix4(node.matrix);
    node = node.parent;
  }
  return out;
}

export class CrowdGroup extends THREE.Group {
  override updateMatrixWorld(force?: boolean) {
    if (!this.visible) return;
    super.updateMatrixWorld(force);
  }
}

export class HiddenPoseClock {
  private pending = 0;
  private key = '';
  step(dt: number, visible: boolean, key: string): number | undefined {
    this.pending += dt;
    if (!visible && key === this.key && this.pending < .25) return undefined;
    const elapsed = this.pending;
    this.pending = 0;
    this.key = key;
    return elapsed;
  }
}
