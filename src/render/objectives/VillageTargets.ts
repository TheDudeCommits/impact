import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {VILLAGE_STRUCTURES,type VillageStructure} from '../../game/objectives/villageStructures';
import {installCameraCutaway} from '../CameraCutaway';

export class VillageTargets {
  readonly root=new THREE.Group();
  private posts=new Map<string,{root:THREE.Group;wood:THREE.MeshStandardMaterial;bar:THREE.Mesh;rubble:THREE.Group;intact:THREE.Group}>();
  constructor(){
    const iron=new THREE.MeshStandardMaterial({color:0x29383a,roughness:.6,metalness:.45});
    const stone=new THREE.MeshStandardMaterial({color:0x8b8a7e,roughness:1});
    const roof=new THREE.MeshStandardMaterial({color:0x254b49,roughness:.85});
    const paper=new THREE.MeshStandardMaterial({color:0xe9dcc1,roughness:1,side:THREE.DoubleSide});
    [iron,stone,roof,paper].forEach(m=>installCameraCutaway(m));
    for(const post of VILLAGE_STRUCTURES){
      const group=new THREE.Group(),intact=new THREE.Group(),rubble=new THREE.Group();group.position.set(post.x,0,post.z);group.add(intact,rubble);this.root.add(group);
      const wood=new THREE.MeshStandardMaterial({color:0x835a3b,roughness:.92});installCameraCutaway(wood);
      const timber:THREE.BufferGeometry[]=[],metal:THREE.BufferGeometry[]=[];
      const beam=(x:number,y:number,z:number,w:number,h:number,d:number,angle=0)=>new THREE.BoxGeometry(w,h,d).rotateZ(angle).translate(x,y,z);
      for(const x of [-1.1,1.1]){timber.push(beam(x,1.5,0,.3,3,.4));metal.push(beam(x,.28,0,.36,.35,.46),beam(x,2.4,0,.36,.2,.46));}
      for(let i=0;i<7;i++)timber.push(beam(-1.14+i*.38,1.55,-.15,.33,2.65+(i%2)*.12,.21));
      for(const z of [-.34,.23])timber.push(beam(0,1,z,2.75,.19,.22),beam(0,2.05,z,2.75,.19,.22),beam(0,1.6,z,2.6,.16,.16,.6));
      const base=new THREE.Mesh(new THREE.BoxGeometry(3.05,.32,2.8),stone);base.position.y=.16;group.add(base);
      for(const x of [-1.12,1.12]){const brace=new THREE.Mesh(new THREE.BoxGeometry(.25,2.5,.25),wood);brace.rotation.x=-.65;brace.position.set(x,1,1);intact.add(brace);}
      const core=post.id==='village-keep';
      if(core){const awning=new THREE.Mesh(new THREE.ConeGeometry(2.45,1.1,4),roof);awning.rotation.y=Math.PI/4;awning.scale.z=.8;awning.position.y=3.45;intact.add(awning);for(const x of [-1.3,1.3])for(const z of [-1,1])timber.push(beam(x,1.9,z,.2,3.8,.2));}
      for(const [geos,material] of [[timber,wood],[metal,iron]] as const){const mesh=new THREE.Mesh(mergeGeometries(geos)!,material);mesh.castShadow=true;mesh.receiveShadow=true;intact.add(mesh);geos.forEach(g=>g.dispose());}
      const flag=new THREE.Mesh(new THREE.PlaneGeometry(.8,1.25),paper);flag.position.set(0,2.12,-.39);flag.rotation.y=Math.PI;intact.add(flag);
      const crest=new THREE.Shape();crest.moveTo(-.22,-.12);crest.bezierCurveTo(-.48,.25,.28,.52,.27,.08);crest.bezierCurveTo(.28,-.18,-.11,-.23,-.06,.1);crest.lineTo(.02,.1);crest.bezierCurveTo(-.04,-.05,.19,-.1,.16,.1);crest.bezierCurveTo(.16,.29,-.26,.22,-.15,-.05);crest.lineTo(.05,-.27);crest.lineTo(-.23,-.27);
      const emblem=new THREE.Mesh(new THREE.ShapeGeometry(crest),iron);emblem.position.set(0,2.17,-.405);emblem.rotation.y=Math.PI;intact.add(emblem);
      for(let i=0;i<9;i++){const plank=new THREE.Mesh(new THREE.BoxGeometry(.26,.15,1.1+(i%3)*.35),wood);plank.position.set(Math.sin(i*2.3)*1.6,.32+i%3*.1,Math.cos(i*1.7)*1.2);plank.rotation.set(0,i*1.23,(i%2-.5)*.25);rubble.add(plank);}
      const track=new THREE.Mesh(new THREE.BoxGeometry(2.8,.085,.075),iron);track.position.set(0,core?4.2:3.22,0);group.add(track);
      const bar=new THREE.Mesh(new THREE.BoxGeometry(2.72,.055,.09),new THREE.MeshBasicMaterial({color:0xe8c488}));bar.position.copy(track.position);group.add(bar);
      this.posts.set(post.id,{root:group,wood,bar,rubble,intact});
    }
  }
  update(states:readonly VillageStructure[],now:number){
    for(const s of states){const post=this.posts.get(s.id);if(!post)continue;const share=s.hp/s.maxHp,hit=Math.max(0,1-(now-s.hitAt)/.22);
      post.intact.visible=s.hp>0;post.rubble.visible=s.hp<=0;post.bar.scale.x=Math.max(.001,share);post.bar.position.x=-(1-share)*1.36;
      post.wood.emissive.setHex(0xb63417);post.wood.emissiveIntensity=hit*.6;post.intact.rotation.z=Math.sin(now*65)*hit*.018;post.root.position.set(s.x,0,s.z);
      (post.bar.material as THREE.MeshBasicMaterial).color.setHex(share<.3?0xf34049:0xe8c488);
    }
  }
}
