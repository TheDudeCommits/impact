import {describe,it,expect,vi,afterEach} from 'vitest';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {bodyTextures,retainBodyMaps,bodyTexturePlugin} from '../src/render/horde/bodyTextures';

afterEach(()=>vi.unstubAllGlobals());

describe('enemy GPU texture budget',()=>{
  it('loads a real glTF without resolving images used only by discarded channels',async()=>{
    vi.stubGlobal('ProgressEvent',class {});
    const positions=new Float32Array([0,0,0,1,0,0,0,1,0]);
    const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],
      meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],
      accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],
      bufferViews:[{buffer:0,byteLength:positions.byteLength}],
      buffers:[{byteLength:positions.byteLength,uri:'data:application/octet-stream;base64,'+Buffer.from(positions.buffer).toString('base64')}],
      materials:[{normalTexture:{index:0},emissiveTexture:{index:0},occlusionTexture:{index:0},
        pbrMetallicRoughness:{baseColorFactor:[1,.5,.2,1],metallicRoughnessTexture:{index:0}}}],
      textures:[{source:0}],images:[{uri:'unused-map-must-not-load.png'}]};
    const gltf=await new GLTFLoader().register(bodyTexturePlugin).parseAsync(JSON.stringify(json),'');
    const mesh=gltf.scene.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
    expect(mesh.material.color.toArray()).toEqual([1,.5,.2]);
    expect(mesh.material.normalMap).toBeNull();expect(mesh.material.emissiveMap).toBeNull();
    expect(mesh.geometry.getAttribute('position').count).toBe(3);
  });
  it('leaves colour, alpha and UV transforms intact before resolving image dependencies',()=>{
    const colour={index:0,texCoord:1,extensions:{KHR_texture_transform:{offset:[.2,.4]}}};
    const material={name:'Face',alphaMode:'MASK',alphaCutoff:.4,doubleSided:true,
      normalTexture:{index:1},occlusionTexture:{index:2},emissiveTexture:{index:3},
      pbrMetallicRoughness:{baseColorTexture:colour,baseColorFactor:[1,.5,.2,.4],metallicRoughnessTexture:{index:4}}};
    const image={uri:'shared-colour-and-normal.webp'},json={materials:[material],images:[image]};
    retainBodyMaps(json);
    expect(material).toEqual({name:'Face',alphaMode:'MASK',alphaCutoff:.4,doubleSided:true,
      pbrMetallicRoughness:{baseColorTexture:colour,baseColorFactor:[1,.5,.2,.4]}});
    expect(material.pbrMetallicRoughness.baseColorTexture).toBe(colour);
    expect(json.images).toEqual([image]);
    expect(()=>retainBodyMaps({})).not.toThrow();
  });
  it('warms shared colour maps and hidden animation variants without uploading discarded PBR maps',()=>{
    const root=new THREE.Group(),colour=new THREE.Texture(),face=new THREE.Texture();
    const normal=new THREE.Texture(),roughness=new THREE.Texture(),metal=new THREE.Texture(),emissive=new THREE.Texture();
    const source=new THREE.MeshStandardMaterial({map:colour,normalMap:normal,roughnessMap:roughness,metalnessMap:metal,emissiveMap:emissive});
    root.add(new THREE.Mesh(undefined,source),new THREE.Mesh(undefined,source));
    const variant=new THREE.Mesh(undefined,[new THREE.MeshStandardMaterial({map:face}),source]);
    variant.visible=false;root.add(variant,new THREE.Mesh());
    expect(bodyTextures(root)).toEqual(new Set([colour,face]));
    expect(source.normalMap).toBe(normal);expect(variant.visible).toBe(false);
  });
});
