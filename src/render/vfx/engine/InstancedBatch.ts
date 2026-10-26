import * as THREE from 'three';

export interface InstancedBatchOptions {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  capacity: number;
  tint?: string;
  data?: string;
  clock?: string;
  renderOrder?: number;
  minAlpha?: number;
  owns?: boolean;
}

export class InstancedBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly capacity: number;
  private readonly tint: THREE.InstancedBufferAttribute;
  private readonly data?: THREE.InstancedBufferAttribute;
  private readonly attributes: THREE.BufferAttribute[];
  private readonly ranges: { start: number; count: number }[];
  private readonly matrix = new THREE.Matrix4();
  private readonly size = new THREE.Vector3();
  private readonly clock?: THREE.IUniform;
  private readonly minAlpha: number;
  private readonly owns: boolean;
  private used = 0;
  private drawn = false;
  private disposed = false;
  constructor(parent: THREE.Object3D | null, options: InstancedBatchOptions) {
    const { geometry, material } = options;
    this.capacity = Math.max(1, Math.floor(options.capacity));
    this.minAlpha = options.minAlpha ?? .003;
    this.owns = options.owns ?? true;
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(options.tint ?? 'batchTint', this.tint);
    if (options.data) {
      this.data = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(options.data, this.data);
    }
    material.forceSinglePass = true;
    this.mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    this.mesh.name = options.name;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.renderOrder = options.renderOrder ?? 3;
    this.mesh.count = 0;
    this.mesh.castShadow = this.mesh.receiveShadow = false;
    this.mesh.onAfterRender = () => { this.drawn = true; };
    this.clock = options.clock ? material.uniforms[options.clock] : undefined;
    this.attributes = [this.mesh.instanceMatrix, this.tint, ...(this.data ? [this.data] : [])];
    this.ranges = this.attributes.map(() => ({ start: 0, count: 0 }));
    parent?.add(this.mesh);
  }

  get count() { return this.used; }
  get full() { return this.used >= this.capacity; }

  begin(time?: number) {
    this.used = 0;
    if (time !== undefined && this.clock) this.clock.value = time;
  }

  add(p: THREE.Vector3, q: THREE.Quaternion, sx: number, sy: number, sz: number, color: { r: number; g: number; b: number }, alpha: number, d0 = 0, d1 = 0, d2 = 0, d3 = 0) {
    if (this.used >= this.capacity || !(alpha >= this.minAlpha) || !(Math.min(sx, sy, sz) > 0)) return false;
    const i = this.used++;
    this.matrix.compose(p, q, this.size.set(sx, sy, sz));
    this.mesh.setMatrixAt(i, this.matrix);
    this.tint.setXYZW(i, color.r, color.g, color.b, alpha > 1 ? 1 : alpha);
    this.data?.setXYZW(i, d0, d1, d2, d3);
    return true;
  }

  addMatrix(matrix: THREE.Matrix4, color: { r: number; g: number; b: number }, alpha: number, d0 = 0, d1 = 0, d2 = 0, d3 = 0) {
    if (this.used >= this.capacity || !(alpha >= this.minAlpha)) return false;
    const i = this.used++;
    this.mesh.setMatrixAt(i, matrix);
    this.tint.setXYZW(i, color.r, color.g, color.b, alpha > 1 ? 1 : alpha);
    this.data?.setXYZW(i, d0, d1, d2, d3);
    return true;
  }

  end() {
    const count = this.used;
    this.mesh.count = count;
    this.mesh.visible = count > 0 || !this.drawn;
    if (count === 0) return;
    for (let i = 0; i < this.attributes.length; i++) {
      const attribute = this.attributes[i], range = this.ranges[i];
      range.start = 0; range.count = count * attribute.itemSize;
      attribute.clearUpdateRanges(); attribute.updateRanges.push(range); attribute.needsUpdate = true;
    }
  }

  clear() { this.begin(); this.end(); }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.dispose();
    if (this.owns) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
  }
}
