import * as THREE from 'three';

const exact = THREE.SkinnedMesh.prototype.computeBoundingSphere;
let installed = false;

const _baseVector = new THREE.Vector4(), _skinIndex = new THREE.Vector4(), _skinWeight = new THREE.Vector4(), _vector4 = new THREE.Vector4(), _matrix4 = new THREE.Matrix4();
function applyBoneTransform(this: THREE.SkinnedMesh, index: number, target: THREE.Vector3 | THREE.Vector4) {
  const skeleton = this.skeleton, geometry = this.geometry;
  _skinIndex.fromBufferAttribute(geometry.attributes.skinIndex as THREE.BufferAttribute, index);
  _skinWeight.fromBufferAttribute(geometry.attributes.skinWeight as THREE.BufferAttribute, index);
  const four = (target as THREE.Vector4).isVector4 === true, out = target as THREE.Vector4;
  if (four) { _baseVector.copy(out); out.set(0, 0, 0, 0); } else { _baseVector.set(target.x, target.y, target.z, 1); (target as THREE.Vector3).set(0, 0, 0); }
  _baseVector.applyMatrix4(this.bindMatrix);
  for (let i = 0; i < 4; i++) {
    const weight = _skinWeight.getComponent(i);
    if (weight !== 0) {
      const boneIndex = _skinIndex.getComponent(i);
      _matrix4.multiplyMatrices(skeleton.bones[boneIndex].matrixWorld, skeleton.boneInverses[boneIndex]);
      out.addScaledVector(_vector4.copy(_baseVector).applyMatrix4(_matrix4), weight);
    }
  }
  if (four) out.w = _baseVector.w;
  return target.applyMatrix4(this.bindMatrixInverse);
}

export function installSkinnedBounds() {
  if (installed) return;
  installed = true;
  (THREE.SkinnedMesh.prototype as { applyBoneTransform: unknown }).applyBoneTransform = applyBoneTransform;
  THREE.SkinnedMesh.prototype.computeBoundingSphere = function (this: THREE.SkinnedMesh) {
    if (this.frustumCulled) return exact.call(this);
    const geometry = this.geometry;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    (this.boundingSphere ??= new THREE.Sphere()).copy(geometry.boundingSphere!);
  };
}
