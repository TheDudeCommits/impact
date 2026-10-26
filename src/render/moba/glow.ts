import * as THREE from 'three';
import type {ThreatInk} from '../ThreatOutline';
import {addShaderPatch} from '../look/shaderPatch';

export function prepareRiftGlow(mesh:THREE.InstancedMesh,capacity:number){
  const data=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4);data.setUsage(THREE.DynamicDrawUsage);mesh.geometry.setAttribute('riftThreat',data);
  const material=mesh.material as THREE.Material;
  if(!material.userData.riftGlow){material.userData.riftGlow=true;
    addShaderPatch(material,'rift-instanced-threat',shader=>{
      shader.vertexShader='attribute vec4 riftThreat; varying vec4 vRiftThreat;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('void main() {','void main() { vRiftThreat = riftThreat;');
      shader.fragmentShader='varying vec4 vRiftThreat;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float riftRim = pow(1. - abs(dot(normalize(vNormal), normalize(vViewPosition))), 1.2);
        outgoingLight = mix(outgoingLight, vRiftThreat.rgb, vRiftThreat.a * (.12 + riftRim * .88));
        #include <opaque_fragment>`);
    });
  }
  return data;
}
export function writeRiftGlow(buffer:THREE.InstancedBufferAttribute,index:number,ink:ThreatInk|undefined){
  const c=ink?.color.value;buffer.setXYZW(index,c?.r??0,c?.g??0,c?.b??0,ink?.mix.value??0);
}
