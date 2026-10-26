import {riftCombatHeight} from './armyIdentity';
import type {ExternalBody,ExternalTargets} from '../simulation';
import type {GameSnapshot,Vec3} from '../types';
import {RIFT_RULES,riftOf,type RiftTeam,type RiftUnit,type RiftStructure} from './model';
export interface RiftPredictionBody extends ExternalBody {team:RiftTeam|'neutral';vulnerable?:boolean}
interface Entry {body:RiftPredictionBody;revision:number}
export class RiftPredictionTargets implements ExternalTargets {
 private readonly bodies=new Map<string,Entry>();
 private ownerId='';private team:RiftTeam|undefined;private revision=0;
 get size(){return this.bodies.size;}
 update(snapshot:GameSnapshot,ownerId:string){
  const view=riftOf(snapshot),seat=view?.seats.find(s=>s.id===ownerId);
  if(!view||!seat||view.phase!=='active'){this.clear();return;}
  this.ownerId=ownerId;this.team=seat.team;const revision=++this.revision;
  const add=(source:{id:string;x:number;y:number;z:number;radius:number;team:RiftTeam|'neutral';kind:RiftUnit['kind']|RiftStructure['kind'];empowered?:boolean;vulnerable?:boolean})=>{
   let entry=this.bodies.get(source.id);
   if(!entry){entry={body:{id:source.id,x:0,y:0,z:0,radius:source.radius,height:riftCombatHeight(source),airborne:false,team:source.team},revision};this.bodies.set(source.id,entry);}
   const body=entry.body;body.x=source.x;body.y=source.y;body.z=source.z;body.radius=source.radius;body.height=riftCombatHeight(source);body.team=source.team;body.vulnerable=source.vulnerable;entry.revision=revision;
  };
  let count=0;for(const unit of view.units){if(unit.hp<=0)continue;add(unit);if(++count>=RIFT_RULES.unitCap)break;}
  count=0;for(const structure of view.structures){if(structure.hp<=0||structure.hidden)continue;add(structure);if(++count>=24)break;}
  for(const [id,entry] of this.bodies)if(entry.revision!==revision)this.bodies.delete(id);
 }
 hostile(attackerId:string,body:ExternalBody){const known=this.bodies.get(body.id);return attackerId===this.ownerId&&!!this.team&&!!known&&known.body.team!==this.team;}
 locate(id:string):RiftPredictionBody|undefined {return this.bodies.get(id)?.body;}
 query(a:Vec3,b:Vec3,radius:number,out:ExternalBody[]):number {
  let count=0;const minX=Math.min(a.x,b.x)-radius-4,maxX=Math.max(a.x,b.x)+radius+4,minZ=Math.min(a.z,b.z)-radius-4,maxZ=Math.max(a.z,b.z)+radius+4;
  for(const {body} of this.bodies.values())if(body.x>=minX&&body.x<=maxX&&body.z>=minZ&&body.z<=maxZ)out[count++]=body;
  out.length=count;return count;
 }
 receive(){return null;}
 freeze(){}
 clear(){this.ownerId='';this.team=undefined;this.bodies.clear();}
}
