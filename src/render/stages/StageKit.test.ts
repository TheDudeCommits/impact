import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {StageKit} from './StageKit';
afterEach(()=>vi.restoreAllMocks());
async function kit(){
 vi.spyOn(GLTFLoader.prototype,'loadAsync').mockImplementation(async()=>{const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(10,4,10),new THREE.MeshStandardMaterial({name:'test stone'})));return {scene,parser:{json:{},associations:new Map()}} as never;});
 const root=new THREE.Group(),kit=new StageKit(root,'rift-war');await kit.load(['fixture']);for(const x of [27,35,71])kit.place('fixture',{x,z:0,shadow:false});return kit;
}
describe('optional spatial stage batching',()=>{
 it('culls by placement cell while retaining the full geometry across cell edges',async()=>{
  const source=await kit(),meshes=source.flush('rift-war',32);expect(meshes).toHaveLength(3);
  const bounds=meshes.map(m=>new THREE.Box3().setFromObject(m));expect(bounds.map(b=>[b.min.x,b.max.x])).toEqual([[22,32],[30,40],[66,76]]);
  expect(meshes.reduce((n,m)=>n+m.geometry.getAttribute('position').count,0)).toBe(72);source.dispose();meshes.forEach(m=>m.geometry.dispose());
 });
 it('keeps the existing one-batch behavior for stages that do not opt in',async()=>{
  const source=await kit(),meshes=source.flush();expect(meshes).toHaveLength(1);expect(new THREE.Box3().setFromObject(meshes[0]).min.x).toBe(22);expect(new THREE.Box3().setFromObject(meshes[0]).max.x).toBe(76);source.dispose();meshes.forEach(m=>m.geometry.dispose());
 });
});
