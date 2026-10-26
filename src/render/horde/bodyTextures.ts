import type * as THREE from 'three';
import type {GLTFLoaderPlugin,GLTFParser} from 'three/addons/loaders/GLTFLoader.js';

interface BodyMaterial {
  normalTexture?:unknown;occlusionTexture?:unknown;emissiveTexture?:unknown;
  pbrMetallicRoughness?:{metallicRoughnessTexture?:unknown};
}

export function retainBodyMaps(json:{materials?:BodyMaterial[]}){
  for(const material of json.materials??[]){
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
    if(material.pbrMetallicRoughness)delete material.pbrMetallicRoughness.metallicRoughnessTexture;
  }
}

export function bodyTexturePlugin(parser:GLTFParser):GLTFLoaderPlugin{
  return {name:'JUMP_enemy_body_maps',beforeRoot:()=>{retainBodyMaps(parser.json);return null;}};
}

export function bodyTextures(root:THREE.Object3D):Set<THREE.Texture>{
  const textures=new Set<THREE.Texture>();
  root.traverse(node=>{
    const material=(node as THREE.Mesh).material;
    for(const each of Array.isArray(material)?material:material?[material]:[]){
      const map=(each as THREE.MeshStandardMaterial).map;
      if(map?.isTexture)textures.add(map);
    }
  });
  return textures;
}
