import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {installCameraCutaway} from '../CameraCutaway';
import {lookStageMaterial} from '../look/stageMaterials';
import type {StageId} from '../../game/stages';

interface Part {geometry:THREE.BufferGeometry;material:THREE.Material}
interface Template {parts:Part[];size:THREE.Vector3}
export class ObjectiveScenery {
  private loader=new GLTFLoader();
  private templates=new Map<string,Template>();
  private placements=new Map<string,THREE.Matrix4[]>();
  private textures=new Map<string,THREE.Texture>();
  constructor(readonly root:THREE.Group,private stage:StageId){}

  async load(names:string[]) {
    const pending=[...names];
    await Promise.all(Array.from({length:3},async()=>{while(pending.length){const name=pending.shift()!;await this.loadOne(name);}}));
  }
  private async loadOne(name:string){
    const path=name==='citadel-keep'?'kokura-keep/keep':name.startsWith('harbor/')?name:`asian/${name==='garden-tree'?'sakura':name}`;
    const gltf=await this.loader.loadAsync(`/assets/environment/${path}.glb`);
    gltf.scene.updateMatrixWorld(true);
    const parts:Part[]=[],bounds=new THREE.Box3(),materials=new Map<THREE.Material,THREE.Material>();
    gltf.scene.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const material=Array.isArray(object.material)?object.material[0]:object.material;
      let looked=materials.get(material);
      if(!looked){
        looked=lookStageMaterial(material,this.stage,object.name);
        materials.set(material,looked);
        if(looked instanceof THREE.MeshStandardMaterial){
          looked.roughness=.86;looked.metalness=0;looked.normalScale.multiplyScalar(.45);
          if(/Wood/.test(looked.name)&&!/Red/.test(looked.name))looked.color.multiplyScalar(.72);
          if(/Roof/.test(looked.name))looked.color.multiply(new THREE.Color(0x829da7));
          if(/Sakura/.test(looked.name))looked.alphaTest=.45;
          if(name==='garden-tree'&&/Sakura/.test(looked.name)){
            const previous=looked.onBeforeCompile.bind(looked);
            looked.onBeforeCompile=(shader,renderer)=>{previous(shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
              float leafValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
              diffuseColor.rgb=mix(vec3(.025,.065,.025),vec3(.19,.3,.075),smoothstep(.04,.6,leafValue));`);};
            const previousKey=looked.customProgramCacheKey.bind(looked);looked.customProgramCacheKey=()=>previousKey()+'green-leaf';
          }
        }
        for(const [key,value] of Object.entries(looked))if(value instanceof THREE.Texture){
          const id=`${path.startsWith('asian/')?'asian':'harbor'}:${value.name}:${value.colorSpace}:${value.wrapS}:${value.wrapT}:${value.channel}:${value.repeat.toArray()}:${value.offset.toArray()}:${value.rotation}`;
          const shared=value.name?this.textures.get(id):undefined;
          if(shared)(looked as unknown as Record<string,unknown>)[key]=shared;
          else {value.anisotropy=4;this.textures.set(id,value);}
        }
        installCameraCutaway(looked);
      }
      const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
      geometry.computeBoundingBox();bounds.union(geometry.boundingBox!);parts.push({geometry,material:looked});
      object.geometry.dispose();
    });
    if(!parts.length)throw new Error(`Empty objective scenery: ${name}`);
    const center=bounds.getCenter(new THREE.Vector3());
    for(const part of parts)part.geometry.translate(-center.x,-bounds.min.y,-center.z);
    const merged:Part[]=[],byMaterial=new Map<THREE.Material,THREE.BufferGeometry[]>();
    for(const p of parts){const list=byMaterial.get(p.material)??[];list.push(p.geometry);byMaterial.set(p.material,list);}
    for(const [material,geometries] of byMaterial){
      if(geometries.length===1){merged.push({geometry:geometries[0],material});continue;}
      const geometry=mergeGeometries(geometries);
      if(geometry){for(const g of geometries)g.dispose();merged.push({geometry,material});}
      else for(const g of geometries)merged.push({geometry:g,material});
    }
    this.templates.set(name,{parts:merged,size:bounds.getSize(new THREE.Vector3())});
  }

  place(name:string,x:number,z:number,width:number,rotation=0,y=0,height?:number,depth?:number){
    const t=this.templates.get(name);if(!t)throw new Error(`Scenery not loaded: ${name}`);
    const scale=width/t.size.x;
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),rotation),new THREE.Vector3(scale,height===undefined?scale:height/t.size.y,depth===undefined?scale:depth/t.size.z));
    const list=this.placements.get(name)??[];list.push(matrix);this.placements.set(name,list);
  }
  material(name:string,pattern:RegExp){
    const material=this.templates.get(name)?.parts.find(p=>pattern.test(p.material.name))?.material;
    if(!material)throw new Error(`Missing ${name} material ${pattern}`);return material;
  }
  flush(){
    for(const [name,matrices] of this.placements){
      const blocks=spatialInstances(matrices);
      for(const [block,placements] of blocks)for(const part of this.templates.get(name)!.parts){
        const mesh=new THREE.InstancedMesh(part.geometry,part.material,placements.length);
        placements.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
        mesh.name=`${this.stage}:${name}`;mesh.receiveShadow=true;
        mesh.userData.block=block;mesh.matrixAutoUpdate=false;
        mesh.castShadow=!['sakura','garden-tree','bush','ivy','citadel-keep'].includes(name)&&!(this.stage==='blood-citadel'&&name==='pagoda');
        mesh.computeBoundingBox();mesh.computeBoundingSphere();this.root.add(mesh);
      }
    }
    this.placements.clear();
  }
}

export function spatialInstances(matrices:readonly THREE.Matrix4[],size=32){
  const blocks=new Map<string,THREE.Matrix4[]>();
  for(const matrix of matrices){
    const e=matrix.elements,key=`${Math.floor(e[12]/size)}:${Math.floor(e[14]/size)}`;
    const list=blocks.get(key);if(list)list.push(matrix);else blocks.set(key,[matrix]);
  }
  return blocks;
}
