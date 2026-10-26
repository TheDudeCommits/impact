import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {VillageView} from '../../game/objectives/lastStand';
import {ObjectiveAmbience} from './ObjectiveAmbience';
import {VillageTargets} from './VillageTargets';
import {VillageTraps} from './VillageTraps';
import {installCameraCutaway} from '../CameraCutaway';

export class VillageDefences {
  readonly root=new THREE.Group();
  private targets=new VillageTargets();
  private towers:THREE.Group[]=[];private reinforcement:THREE.Mesh;
  private ward:THREE.Mesh<THREE.SphereGeometry,THREE.MeshBasicMaterial>;
  private traps=new VillageTraps();
  private prepared?:Promise<void>;
  private wallMaterial=new THREE.MeshStandardMaterial({color:0xb69a74,roughness:.9,metalness:.05});
  private damage=new ObjectiveAmbience('leaf');
  constructor(){
    this.root.add(this.targets.root,this.traps.root);
    const wood=new THREE.MeshStandardMaterial({color:0x6c422b,roughness:.9});
    const iron=new THREE.MeshStandardMaterial({color:0x35434b,roughness:.58,metalness:.65});
    const brass=new THREE.MeshStandardMaterial({color:0xb29c5b,roughness:.55,metalness:.6});
    for(const material of [wood,iron,brass,this.wallMaterial])installCameraCutaway(material);
    const cube=(x:number,y:number,z:number,w:number,h:number,d:number)=>new THREE.BoxGeometry(w,h,d).translate(x,y,z);
    const panels:THREE.BufferGeometry[]=[];
    for(const side of [-1,1])for(let i=0;i<4;i++){
      panels.push(cube(side*(12+i*8),2.1,18.92,5.8,3.4,.12));
    }
    this.reinforcement=new THREE.Mesh(mergeGeometries(panels)!,this.wallMaterial);this.reinforcement.receiveShadow=true;panels.forEach(g=>g.dispose());this.root.add(this.reinforcement);
    for(const x of [-18,18,-30,30]){
      const group=new THREE.Group();group.position.set(x,8,20);
      const stock=new THREE.Mesh(cube(0,.95,0,.45,.45,3),wood);
      const stand=new THREE.Mesh(cube(0,.35,0,1.4,.7,1.4),iron);group.add(stock,stand);
      const bow=new THREE.CatmullRomCurve3([new THREE.Vector3(-2.3,.95,.8),new THREE.Vector3(-1.2,.95,0),new THREE.Vector3(0,.95,-.3),new THREE.Vector3(1.2,.95,0),new THREE.Vector3(2.3,.95,.8)]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(bow,12,.12,5,false),wood));
      const string=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2.3,.95,.8),new THREE.Vector3(0,.95,1.5),new THREE.Vector3(2.3,.95,.8)]),new THREE.LineBasicMaterial({color:0xd4cab2}));group.add(string);
      const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,3,5),brass);bolt.rotation.x=Math.PI/2;bolt.position.set(0,1.21,-.4);group.add(bolt);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.16,.48,4),iron);tip.rotation.x=-Math.PI/2;tip.position.set(0,1.21,-2);group.add(tip);
      group.traverse(o=>{if(o instanceof THREE.Mesh)o.receiveShadow=true;});this.towers.push(group);this.root.add(group);
    }
    this.ward=new THREE.Mesh(new THREE.SphereGeometry(7,32,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshBasicMaterial({color:0xa6e4da,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    this.ward.position.set(0,.1,24);this.root.add(this.ward);
    this.damage.fire([
      {x:-13,y:8.15,z:20,size:1.1,smoke:.5,seed:.1,from:.4},
      {x:21,y:8.15,z:20,size:1.4,smoke:.6,seed:.3,from:.55},
      {x:-33,y:8.15,z:20,size:1.8,smoke:.7,seed:.7,from:.75},
      {x:35,y:8.15,z:20,size:1.5,smoke:.65,seed:.9,from:.8},
    ]);this.damage.root.visible=false;this.root.add(this.damage.root);
  }
  prepare(){
    return this.prepared??=new THREE.TextureLoader().loadAsync('/assets/environment/objectives/gate-reinforcement.webp').then(texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
      this.wallMaterial.map=texture;this.wallMaterial.bumpMap=texture;this.wallMaterial.bumpScale=.035;
      this.wallMaterial.color.setHex(0xe4ded6);this.wallMaterial.needsUpdate=true;
    }).catch(()=>{ });
  }
  update(v:VillageView,now:number){
    this.targets.update(v.structures??[],now);
    this.traps.update(v,now);
    this.reinforcement.visible=v.upgrades.walls>0;
    this.towers.forEach((t,i)=>t.visible=i<v.upgrades.ballista);
    this.ward.visible=v.upgrades.seals>0&&v.underAttackUntil>now;
    this.ward.material.opacity=.035+Math.max(0,v.underAttackUntil-now)/2.5*.1;
    const damage=1-v.hp/v.maxHp;this.damage.root.visible=damage>.25;
    if(this.damage.root.visible){this.damage.fireLevel(damage);this.damage.update(now);}
  }
}
