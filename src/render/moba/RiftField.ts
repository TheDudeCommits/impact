import * as THREE from 'three';
import type {GameSnapshot} from '../../game/types';
import {riftOf,RIFT_RULES,type RiftStructure,type RiftUnit} from '../../game/moba/model';
import type {GruntRenderer} from '../horde/GruntRenderer';
import {riftUnitHeight} from '../../game/moba/armyIdentity';
import {RiftArmies} from './RiftArmies';
import {RiftStructures,RIFT_STRUCTURE_HEIGHT} from './RiftStructures';
import {RiftRunes} from './RiftRunes';
import {RIFT_INK} from './palette';
import type {ThreatInk} from '../ThreatOutline';

const transform=new THREE.Object3D(),tint=new THREE.Color(),white=new THREE.Color(0xfff4d9);
const BAR_CAP=RIFT_RULES.unitCap+24,BOLT_CAP=64;
interface Bolt {x:number;y:number;z:number;tx:number;ty:number;tz:number;until:number;color:number;width:number;born?:number;ward?:boolean}
export class RiftField {
  readonly root=new THREE.Group();
  glows:ReadonlyMap<string,ThreatInk>=new Map();
  private armies:RiftArmies;
  private structures=new RiftStructures();
  private runes=new RiftRunes();
  private back:THREE.InstancedMesh;
  private health:THREE.InstancedMesh;
  private bolts:THREE.InstancedMesh;
  private halos:THREE.InstancedMesh;
  private impacts:THREE.InstancedMesh;
  private boltSlots:Bolt[]=Array.from({length:BOLT_CAP},()=>({x:0,y:0,z:0,tx:0,ty:0,tz:0,until:0,color:0,width:.045}));
  private cursor=0;private lastEvent=-1;private lastTime=-1;
  private target=new THREE.Mesh(new THREE.RingGeometry(.84,1,40).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xffdb8d,transparent:true,opacity:.9,depthWrite:false}));
  private range=new THREE.Mesh(new THREE.RingGeometry(RIFT_RULES.towerRange-.15,RIFT_RULES.towerRange,72).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xef7562,transparent:true,opacity:.25,depthWrite:false}));
  private readonly focus=new THREE.Vector3();
  private selected='';
  constructor(scene:THREE.Scene,private readonly crowd:GruntRenderer){
    this.armies=new RiftArmies(crowd);
    this.root.name='Rift War · armies and objectives';scene.add(this.root);this.root.visible=false;this.root.add(this.armies.root,this.structures.root,this.runes.root,this.target,this.range);
    const bar=new THREE.PlaneGeometry(1,.085),backMat=new THREE.MeshBasicMaterial({color:0x182321,depthWrite:false}),hpMat=new THREE.MeshBasicMaterial({color:0xffffff,depthWrite:false});
    this.back=new THREE.InstancedMesh(bar,backMat,BAR_CAP);this.health=new THREE.InstancedMesh(bar,hpMat,BAR_CAP);
    for(const m of [this.back,this.health]){m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.renderOrder=8;this.root.add(m);}
    this.bolts=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false}),BOLT_CAP);this.bolts.count=0;this.bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.bolts.frustumCulled=false;this.bolts.name='Rift pooled ward tracers';this.root.add(this.bolts);
    this.halos=new THREE.InstancedMesh(new THREE.CylinderGeometry(.2,1,1,8).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.24,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),BOLT_CAP);
    this.impacts=new THREE.InstancedMesh(new THREE.RingGeometry(.65,1,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),BOLT_CAP);
    for(const m of [this.halos,this.impacts]){m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.root.add(m);}
  }
  async load(){await Promise.all([this.armies.load(),this.structures.load()]);}
  setTarget(id:string|null|undefined){this.selected=id??'';}
  update(snapshot:GameSnapshot|undefined,selfId:string,camera:THREE.Camera,_dt:number){
    const v=riftOf(snapshot);this.root.visible=!!v;
    if(!v||!snapshot){if(this.lastTime>=0)this.clear();return;}
    const time=snapshot.serverTime;
    if(time<this.lastTime){this.lastEvent=-1;this.cursor=0;for(const bolt of this.boltSlots)bolt.until=0;}
    this.lastTime=time;
    const player=snapshot.players.find(p=>p.id===selfId);this.crowd.focus=player?.alive?this.focus.set(player.x,player.y+1.1,player.z):undefined;
    this.armies.update(v.units,time,_dt,camera,this.glows);this.structures.update(v.structures,time,this.glows,camera);
    const own=snapshot.players.find(p=>p.id===selfId),seat=v.seats.find(p=>p.id===selfId);
    this.runes.update(v.runes,time,own);
    let bars=0;let nearest:RiftStructure|undefined;let distance=Infinity;
    const healthBar=(u:RiftUnit|RiftStructure,height:number,width:number)=>{
      if(u.hp<=0||bars>=BAR_CAP||('hidden'in u&&u.hidden))return;
      if(own&&(own.x-u.x)**2+(own.z-u.z)**2>42*42)return;
      if(u.hp===u.maxHp&&'state' in u&&u.id!==this.selected&&u.team===seat?.team)return;
      const ratio=Math.max(0,Math.min(1,u.hp/u.maxHp));
      transform.position.set(u.x,u.y+height,u.z);transform.quaternion.copy(camera.quaternion);transform.scale.set(width,1,1);transform.updateMatrix();this.back.setMatrixAt(bars,transform.matrix);
      transform.translateX(-(1-ratio)*width/2);transform.scale.x=width*ratio;transform.updateMatrix();this.health.setMatrixAt(bars,transform.matrix);tint.setHex(RIFT_INK[u.team]);this.health.setColorAt(bars,tint);bars++;
    };
    for(const u of v.units)healthBar(u,riftUnitHeight(u)+.25,u.kind==='boss'?3.2:1.15);
    for(const s of v.structures){
      healthBar(s,RIFT_STRUCTURE_HEIGHT[s.kind]+.35,s.kind==='core'?4:2.4);
      if(own&&!s.hidden&&s.hp>0&&s.team!==seat?.team&&(s.kind==='tower'||s.kind==='guardian')){const d=(s.x-own.x)**2+(s.z-own.z)**2;if(!nearest||(s.target===selfId&&nearest.target!==selfId)||(s.target===selfId)===(nearest.target===selfId)&&d<distance){distance=d;nearest=s;}}
    }
    for(const mesh of [this.back,this.health]){mesh.count=bars;mesh.instanceMatrix.needsUpdate=true;}if(this.health.instanceColor)this.health.instanceColor.needsUpdate=true;
    this.range.visible=!!nearest&&distance<20*20;if(nearest){this.range.position.set(nearest.x,.039,nearest.z);this.range.material.opacity=nearest.target===selfId ? .6 : .25;this.range.material.color.setHex(nearest.target===selfId?0xffb27a:0xef7562);}
    const selected=this.selected?v.units.find(u=>u.id===this.selected)??v.structures.find(s=>s.id===this.selected):undefined;
    this.target.visible=!!selected&&selected.hp>0;if(selected){this.target.position.set(selected.x,.055,selected.z);this.target.scale.setScalar(selected.radius+1);}
    for(const event of v.events){if(event.id<=this.lastEvent)continue;this.lastEvent=event.id;if(event.hidden||event.kind!=='bolt')continue;
      const actor=v.structures.find(s=>s.id===event.actorId)??v.units.find(s=>s.id===event.actorId),target=v.units.find(s=>s.id===event.targetId)??snapshot.players.find(p=>p.id===event.targetId)??v.structures.find(s=>s.id===event.targetId);
      if(!actor||!target)continue;const ward='tier'in actor,slot=this.boltSlots[this.cursor++%BOLT_CAP];slot.x=actor.x;slot.y=actor.y+(ward?RIFT_STRUCTURE_HEIGHT[actor.kind as RiftStructure['kind']]*.76:riftUnitHeight(actor as RiftUnit)*.68);slot.z=actor.z;slot.tx=target.x;slot.ty=target.y+.8;slot.tz=target.z;slot.until=time+(ward ? .42 : .26);slot.born=time;slot.ward=ward;slot.color=event.team==='heroes'?0xffd471:event.team==='villains'?0xc26aff:0xef8d54;slot.width=ward ? .24 : .09;
    }
    let count=0;for(const b of this.boltSlots){if(b.until<=time)continue;const length=Math.hypot(b.tx-b.x,b.ty-b.y,b.tz-b.z);if(length<.01)continue;const fade=Math.min(1,(b.until-time)/.2),width=b.width*fade;
      transform.position.set((b.x+b.tx)/2,(b.y+b.ty)/2,(b.z+b.tz)/2);transform.lookAt(b.tx,b.ty,b.tz);transform.scale.set(width,width,length);transform.updateMatrix();this.bolts.setMatrixAt(count,transform.matrix);tint.setHex(b.color).lerp(white,.72);this.bolts.setColorAt(count,tint);
      transform.scale.set(width*3,width*3,length);transform.updateMatrix();this.halos.setMatrixAt(count,transform.matrix);tint.setHex(b.color);this.halos.setColorAt(count,tint);
      const radius=(b.ward?1.2:.5)+(time-(b.born??time))*5;transform.position.set(b.tx,.06,b.tz);transform.rotation.set(0,time*2,0);transform.scale.set(radius,fade,radius);transform.updateMatrix();this.impacts.setMatrixAt(count,transform.matrix);this.impacts.setColorAt(count,tint.multiplyScalar(fade));count++;
    }
    for(const m of [this.bolts,this.halos,this.impacts]){m.count=count;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
  }
  clear(){this.root.visible=false;this.armies.clear();this.structures.clear();this.runes.clear();this.back.count=this.health.count=this.bolts.count=this.halos.count=this.impacts.count=0;for(const b of this.boltSlots)b.until=0;this.lastEvent=-1;this.lastTime=-1;this.selected='';}
  dispose(){this.clear();this.armies.dispose();this.structures.dispose();this.runes.dispose();this.back.geometry.dispose();for(const m of [this.back,this.health]){(m.material as THREE.Material).dispose();m.dispose();}for(const m of [this.target,this.range,this.bolts,this.halos,this.impacts]){m.geometry.dispose();(m.material as THREE.Material).dispose();}for(const m of [this.bolts,this.halos,this.impacts])m.dispose();this.root.removeFromParent();}
}
