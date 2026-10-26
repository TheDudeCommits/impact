import {expect,it} from 'vitest';
import * as THREE from 'three';
import {distantGeometry,useDistantMesh} from '../src/render/horde/meshDetail';
it('reduces a skinned mesh while retaining the exact surviving vertices and weights',async()=>{
 const source=new THREE.SphereGeometry(1,64,32),count=source.attributes.position.count;
 const joints=new Uint16Array(count*4),weights=new Float32Array(count*4);
 for(let i=0;i<count;i++){joints[i*4]=source.attributes.position.getY(i)>0?1:2;weights[i*4]=1;}
 source.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));source.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const original=Array.from(source.index!.array),far=await distantGeometry(source);
 expect(far).toBeDefined();expect(far!.index!.count).toBeLessThan(source.index!.count*.85);expect(Array.from(source.index!.array)).toEqual(original);
 for(const name of ['position','normal','uv','skinIndex','skinWeight']){expect(far!.attributes[name]).not.toBe(source.attributes[name]);expect(far!.attributes[name].array).toBe(source.attributes[name].array);}
 for(const index of far!.index!.array){expect(index).toBeLessThan(count);expect(far!.attributes.skinWeight.getX(index)).toBe(1);}
});
it('keeps small bodies intact and uses a stable distance band',async()=>{
 expect(await distantGeometry(new THREE.BoxGeometry())).toBeUndefined();
 expect(useDistantMesh(18,2,false)).toBe(true);expect(useDistantMesh(17,2,false)).toBe(false);expect(useDistantMesh(15,2,true)).toBe(true);expect(useDistantMesh(14,2,true)).toBe(false);
 expect(useDistantMesh(18,4,false)).toBe(false);
});
