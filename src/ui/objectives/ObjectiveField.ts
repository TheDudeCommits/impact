import {SiegeRoles} from '../../render/objectives/SiegeRoles';
import * as THREE from 'three';
import type {GameSnapshot} from '../../game/types';
import {objectiveOf,RULES} from '../../game/objectives/model';
import {VillageDefences} from '../../render/objectives/VillageDefences';
import {MARKS,BODY_FX} from '../../render/EnemyHorde';
import {RescueCue} from './RescueCue';
export class ObjectiveField {
  private lastEvent=0;private trails:{mesh:THREE.Line;until:number}[]=[];
  private bossMark='';
  private bossPhase=-1;
  private rescue:RescueCue;
  private defences?:VillageDefences;
  private roles?:SiegeRoles;
  private village(){if(!this.defences||!this.roles){this.defences=new VillageDefences();this.roles=new SiegeRoles();this.group.add(this.defences.root,this.roles.root);}return {defences:this.defences,roles:this.roles};}
  private group=new THREE.Group();private marks=new Map<string,THREE.Group>();
  constructor(scene:THREE.Scene,parent:HTMLElement){this.rescue=new RescueCue(parent);scene.add(this.group);this.group.visible=false;}
  prepare(){const {defences,roles}=this.village();return Promise.all([defences.prepare(),roles.prepare()]).then(()=>{});}
  private ring(radius:number,width:number,color:number){const m=new THREE.Mesh(new THREE.RingGeometry(radius-width,radius,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;return m;}
  private dispose(object:THREE.Object3D){object.removeFromParent();object.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
  private clearBoss(){if(this.bossMark){MARKS.delete(this.bossMark);BODY_FX.delete(this.bossMark);this.bossMark='';}this.bossPhase=-1;}
  reset(){this.roles?.reset();this.rescue.reset();this.clearBoss();this.group.visible=false;this.lastEvent=0;for(const t of this.trails){t.mesh.geometry.dispose();(t.mesh.material as THREE.Material).dispose();t.mesh.removeFromParent();}this.trails=[];for(const m of this.marks.values())this.dispose(m);this.marks.clear();}
  update(snapshot:GameSnapshot|undefined,now:number,ownId:string,camera:THREE.Camera){
    this.rescue.update(snapshot,ownId,camera);
    const v=objectiveOf(snapshot);this.group.visible=!!v&&v.phase==='active';if(!v||!snapshot||!this.group.visible){this.clearBoss();return;}
    const boss=v.village?.bossActor;
    if(this.bossMark!==boss)this.clearBoss();
    if(boss&&snapshot.players.some(p=>p.id===boss&&p.alive)){this.bossMark=boss;const phase=v.village?.bossPhase??0;if(phase!==this.bossPhase){this.bossPhase=phase;MARKS.set(boss,phase===2?0xf46555:phase===1?0xeaaa57:0xe9cb89);if(phase)BODY_FX.set(boss,{taunt:(v.village?.bossPhaseAt??0)+1.6});}}
    else this.clearBoss();
    if(v.village){const {defences,roles}=this.village();defences.root.visible=v.kind==='last-stand';roles.root.visible=true;defences.update(v.village,snapshot.serverTime);roles.update(v.village,snapshot);}
    else if(this.defences&&this.roles){this.defences.root.visible=v.kind==='last-stand';this.roles.root.visible=false;}
    const own=snapshot.players.find(p=>p.id===ownId),live=new Set<string>();
    if(v.kind==='last-stand'&&own){
      for(const event of snapshot.events){if(event.id<=this.lastEvent)continue;this.lastEvent=Math.max(event.id,this.lastEvent);
        if(event.actorId==='village-defence'&&event.kind==='hit'&&event.endpoint){
          const target=new THREE.Vector3(event.endpoint.x,event.endpoint.y,event.endpoint.z),tower=event.move==='Watchtower volley';
          const from=tower?new THREE.Vector3(target.x<0?-18:18,9.2,18):new THREE.Vector3(target.x,.08,target.z);
          const mesh=new THREE.Line(new THREE.BufferGeometry().setFromPoints([from,target]),new THREE.LineBasicMaterial({color:tower?0xffd278:0x7fedb9,transparent:true,opacity:1}));this.group.add(mesh);this.trails.push({mesh,until:now+.35});
        }
      }
    }
    for(const t of this.trails)(t.mesh.material as THREE.LineBasicMaterial).opacity=Math.max(0,(t.until-now)/.35);
    this.trails=this.trails.filter(t=>{if(t.until>now)return true;t.mesh.geometry.dispose();(t.mesh.material as THREE.Material).dispose();t.mesh.removeFromParent();return false;});
    for(const seat of v.seats){const p=snapshot.players.find(p=>p.id===seat.id);if(!p||p.id===ownId||!p.alive&&!seat.down)continue;live.add(p.id);let g=this.marks.get(p.id);if(!g){g=new THREE.Group();const arrow=new THREE.Mesh(new THREE.OctahedronGeometry(.115),new THREE.MeshBasicMaterial({color:0x80e8d3}));arrow.position.y=2.7;g.add(arrow,this.ring(RULES.rescueRadius,.065,0xffd75c));this.marks.set(p.id,g);this.group.add(g);}g.position.set(p.x,p.y+.05,p.z);const arrow=g.children[0] as THREE.Mesh<THREE.OctahedronGeometry,THREE.MeshBasicMaterial>;arrow.material.color.setHex(seat.down?0xffd75c:p.team===own?.team?0x80e8d3:0xff5068);arrow.position.y=seat.down?1.2:2.7;arrow.rotation.y=now*.8;g.children[1].visible=seat.down&&v.kind==='last-stand';}
    for(const [id,m] of this.marks)if(!live.has(id)){this.dispose(m);this.marks.delete(id);}
  }
}
