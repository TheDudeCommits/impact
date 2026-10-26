import * as THREE from 'three';
import { energyOrbMaterial, energyHaloMaterial, energyImpactMaterial, pressureWaveMaterial, groundDustMaterial } from '../vfx/EnergyOrbMaterial';
import { fireFistMaterial, fireTongueMaterial } from '../vfx/FireFistMaterial';
import { windBladeMaterial } from '../vfx/WindBlade';

export function signatureWarmup(scene: THREE.Scene) {
  const group = new THREE.Group(); group.name = 'signature-warmup';
  const speck = new THREE.SphereGeometry(.002, 4, 3), materials: THREE.Material[] = [];
  const add = (material: THREE.Material, instanced = false, colored = false) => {
    materials.push(material);
    const mesh = instanced ? new THREE.InstancedMesh(speck, material, 1) : new THREE.Mesh(speck, material);
    if (colored) (mesh as THREE.InstancedMesh).setColorAt(0, new THREE.Color(1, 1, 1));
    mesh.frustumCulled = false; mesh.onAfterRender = () => { mesh.visible = false; };
    group.add(mesh);
  };
  add(energyOrbMaterial());
  const tinted = energyOrbMaterial(); tinted.fragmentShader = tinted.fragmentShader.replace('vec3(.012,.25,1.0)', 'uTint*1.5').replace('vec3(.05,.2,.7)', 'uTint*.7'); add(tinted);
  add(energyHaloMaterial()); add(energyImpactMaterial()); add(pressureWaveMaterial()); add(groundDustMaterial(), true);
  add(fireFistMaterial()); add(fireTongueMaterial(), true, true); add(windBladeMaterial());
  group.position.set(0, -50, 0);
  scene.add(group);
  return { group, dispose() { group.removeFromParent(); speck.dispose(); for (const m of materials) m.dispose(); for (const c of group.children) (c as THREE.InstancedMesh).dispose?.(); } };
}
