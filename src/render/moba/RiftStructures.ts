import * as THREE from 'three';
import {StageKit} from '../stages/StageKit';
import {RIFT_STAGE,type RiftStructure} from '../../game/moba/model';
import type {ThreatInk} from '../ThreatOutline';
import {prepareRiftGlow,writeRiftGlow} from './glow';
import {RIFT_INK} from './palette';
import {installCameraCutaway} from '../CameraCutaway';
import {addShaderPatch} from '../look/shaderPatch';

const frustum=new THREE.Frustum(),vp=new THREE.Matrix4(),sphere=new THREE.Sphere();
const CAP=24, at=new THREE.Object3D(),color=new THREE.Color();
type Kind=RiftStructure['kind'];
interface Part {mesh:THREE.InstancedMesh;glow:THREE.InstancedBufferAttribute}
const SPAN={tower:4.5,guardian:3.8,core:6.6,barracks:5.2} as const;
export const RIFT_STRUCTURE_HEIGHT={tower:8.8,guardian:7.7,core:11.6,barracks:3.4} as const;
const structureModel=(team:string,kind:Kind)=>`/assets/moba/structures/${team==='heroes'?kind==='core'?'dawn-nexus':'dawn-sunspire':kind==='core'?'eclipse-nexus':'eclipse-obelisk'}.glb`;
export class RiftStructures {
  readonly root=new THREE.Group();
  private readonly source=new THREE.Group();
  private readonly kit=new StageKit(this.source,RIFT_STAGE);
  private readonly batches=new Map<string,Part[]>();
  private readonly rubble:Part[]=[];
  private loading?:Promise<void>;
  private readonly time={value:0};
  private readonly banners:THREE.InstancedMesh;
  private readonly charge:THREE.InstancedMesh;
  private readonly standards:THREE.InstancedMesh;
  constructor(){
    this.root.name='Rift defenses · village architecture';
    const cloth=new THREE.MeshStandardMaterial({map:bannerTexture(),color:0xffffff,side:THREE.DoubleSide,roughness:1});
    installCameraCutaway(cloth);
    addShaderPatch(cloth,'rift-banners',shader=>{shader.uniforms.riftClothTime=this.time;shader.vertexShader='uniform float riftClothTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z += sin(position.y*3. + riftClothTime*2.2 + instanceMatrix[3].x)*.07*(1.-uv.y);');});
    this.banners=new THREE.InstancedMesh(new THREE.PlaneGeometry(.7,1.6,2,6),cloth,CAP*2);
    this.standards=new THREE.InstancedMesh(new THREE.CylinderGeometry(.035,.045,3.1,5),new THREE.MeshStandardMaterial({color:0x4d4140,roughness:1}),CAP*2);
    this.charge=new THREE.InstancedMesh(new THREE.SphereGeometry(.16,10,6),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),CAP);
    for(const mesh of [this.banners,this.charge,this.standards]){mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.root.add(mesh);}
  }
  load(){return this.loading??=this.build();}
  private async build(){
    await this.kit.load(['asian/building-courtyard','br/rock-d','/assets/survival/motion/prop-ruin.glb',...['heroes','villains'].flatMap(team=>[structureModel(team,'tower'),structureModel(team,'core')])]);
    for(const team of ['heroes','villains'] as const)for(const kind of ['tower','guardian','core','barracks'] as const){
      if(kind==='guardian')continue;
      const piece=kind==='barracks'?(team==='heroes'?'asian/building-courtyard':'/assets/survival/motion/prop-ruin.glb'):structureModel(team,kind);
      const size=this.kit.size(piece),span=SPAN[kind],scale=span/Math.max(size.x,size.z);
      this.kit.place(piece,{x:0,z:0,scale,sy:RIFT_STRUCTURE_HEIGHT[kind]/(size.y*scale),shadow:false});
      const made=this.kit.flush();
      const parts=made.map(source=>{
        const geometry=source.geometry.clone(),material=source.material as THREE.Material;
        const mesh=new THREE.InstancedMesh(geometry,material,CAP);mesh.name=`Rift ${kind} · ${material.name}`;
        mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=kind!=='barracks';mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.root.add(mesh);source.removeFromParent();source.geometry.dispose();return{mesh,glow:prepareRiftGlow(mesh,CAP)};
      });this.batches.set(`${team}:${kind}`,parts);
    }
    this.kit.place('br/rock-d',{x:0,z:0,width:3.1,sy:.45,shadow:false});
    for(const source of this.kit.flush()){
      const mesh=new THREE.InstancedMesh(source.geometry.clone(),source.material as THREE.Material,CAP);mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;this.root.add(mesh);source.removeFromParent();this.rubble.push({mesh,glow:prepareRiftGlow(mesh,CAP)});
    }
  }
  update(structures:readonly RiftStructure[],time:number,glows:ReadonlyMap<string,ThreatInk>,camera:THREE.Camera){
    this.time.value=time;camera.updateMatrixWorld();vp.multiplyMatrices((camera as THREE.PerspectiveCamera).projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(vp);let banners=0,charges=0,ruins=0;
    for(const [key,parts] of this.batches){const [team,rawKind]=key.split(':'),template=rawKind as Kind;let count=0;
      for(const s of structures){const kind=s.kind,sharesTower=template==='tower'&&kind==='guardian';if((kind!==template&&!sharesTower)||s.team!==team||s.hidden)continue;
        sphere.center.set(s.x,RIFT_STRUCTURE_HEIGHT[kind]*.5,s.z);sphere.radius=Math.hypot(RIFT_STRUCTURE_HEIGHT[kind]*.5,SPAN[kind]*.71)+.5;if(!frustum.intersectsSphere(sphere))continue;
        at.position.set(s.x,s.y,s.z);at.rotation.set(0,0,0);at.scale.set(SPAN[kind]/SPAN[template],RIFT_STRUCTURE_HEIGHT[kind]/RIFT_STRUCTURE_HEIGHT[template],SPAN[kind]/SPAN[template]);at.updateMatrix();
        if(s.hp<=0){at.scale.setScalar(kind==='core'?1.5:1);at.updateMatrix();for(const part of this.rubble)part.mesh.setMatrixAt(ruins,at.matrix);ruins++;continue;}
        for(const part of parts){part.mesh.setMatrixAt(count,at.matrix);color.setHex(s.team==='heroes'?0xfff0da:0xb2a8c2);part.mesh.setColorAt(count,color);writeRiftGlow(part.glow,count,glows.get(s.id));}count++;
        const h=RIFT_STRUCTURE_HEIGHT[kind],width=kind==='core'?2.7:kind==='barracks'?2.2:1.4,front=kind==='core'?3.4:kind==='barracks'?2.65:2.2;
        for(const side of [-1,1]){
          const x=s.x+side*width,z=s.z+front;
          at.position.set(x,s.y+1.55,z);at.rotation.set(0,0,0);at.scale.setScalar(1);at.updateMatrix();this.standards.setMatrixAt(banners,at.matrix);
          at.position.set(x+.3,s.y+2.2,z+.015);at.scale.setScalar(.86);at.updateMatrix();this.banners.setMatrixAt(banners,at.matrix);color.setHex(s.team==='heroes'?0xe9ddbd:0xd96a6b);this.banners.setColorAt(banners++,color);
        }
        if(kind==='tower'||kind==='guardian'||kind==='core'){
          const pulse=s.fireAt&&s.fireAt>time?Math.max(0,1-(s.fireAt-time)/.6):0;at.position.set(s.x,s.y+h*.76,s.z);at.rotation.set(0,0,0);at.scale.setScalar(1+pulse*4);at.updateMatrix();this.charge.setMatrixAt(charges,at.matrix);color.setHex(s.team==='heroes'?0xffd46e:0xc87bff).multiplyScalar(1+pulse*2);this.charge.setColorAt(charges++,color);
        }
      }
      for(const p of parts){p.mesh.count=count;p.mesh.instanceMatrix.needsUpdate=true;p.glow.needsUpdate=true;if(p.mesh.instanceColor)p.mesh.instanceColor.needsUpdate=true;}
    }
    for(const {mesh} of this.rubble){mesh.count=ruins;mesh.instanceMatrix.needsUpdate=true;}
    for(const [mesh,count] of [[this.banners,banners],[this.standards,banners],[this.charge,charges]] as const){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  }
  clear(){for(const parts of this.batches.values())for(const p of parts)p.mesh.count=0;for(const p of this.rubble)p.mesh.count=0;this.banners.count=this.charge.count=this.standards.count=0;}
  dispose(){this.kit.dispose();for(const parts of [...this.batches.values(),this.rubble])for(const p of parts){p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();p.mesh.dispose();}for(const mesh of [this.banners,this.charge,this.standards]){mesh.geometry.dispose();(mesh.material as THREE.MeshStandardMaterial).map?.dispose();(mesh.material as THREE.Material).dispose();mesh.dispose();}this.root.removeFromParent();}
}
function bannerTexture(){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;const c=canvas.getContext('2d')!;c.fillStyle='#f7f0df';c.fillRect(0,0,128,256);c.strokeStyle='#28212b';c.lineWidth=5;c.strokeRect(7,9,114,236);c.lineWidth=8;c.beginPath();c.arc(64,106,28,.3,Math.PI*2.4);c.stroke();c.beginPath();c.moveTo(64,105);c.lineTo(77,89);c.lineTo(77,125);c.lineTo(44,155);c.stroke();for(let i=0;i<12;i++){c.globalAlpha=.12;c.fillRect(10+(i*47)%108,0,1,256);}const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;}
