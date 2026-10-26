import {Group} from 'three';
import type {Fighter} from '../../render/Fighter';
import {threatInk,type ThreatInk} from '../../render/ThreatOutline';
import type {GameSnapshot,PlayerState} from '../types';
import {riftOf,RIFT_BODY_HEIGHT} from './model';
import {riftUnitName,riftUnitHeight} from './armyIdentity';
interface Proxy {state:PlayerState;group:Group;threatInk:ThreatInk;distance:number}
export class RiftTargets {
  readonly players:PlayerState[]=[];
  readonly crowd=new Map<string,Pick<Fighter,'state'|'group'>>();
  readonly glows=new Map<string,ThreatInk>();
  private bodies=new Map<string,Proxy>();
  private free:Proxy[]=[];
  private near:Proxy[]=[];
  get capacity(){return this.bodies.size+this.free.length;}
  update(snapshot:GameSnapshot,self:PlayerState){
    this.players.length=0;this.players.push(...snapshot.players);this.crowd.clear();this.near.length=0;
    for(const body of this.bodies.values())body.state.alive=false;
    const war=riftOf(snapshot);
    if(war)for(const list of [war.units,war.structures])for(const unit of list){
      if(('hidden' in unit&&unit.hidden)||unit.hp<=0||unit.team===self.team||'vulnerable' in unit&&!unit.vulnerable)continue;
      const dx=unit.x-self.x,dz=unit.z-self.z,distance=dx*dx+dz*dz;if(distance>3600)continue;
      let body=this.bodies.get(unit.id);
      if(!body){const i=this.free.findIndex(p=>p.threatInk.mix.value===0);body=i<0?this.make():this.free.splice(i,1)[0];this.bodies.set(unit.id,body);this.glows.set(unit.id,body.threatInk);}
      const p=body.state;p.id=unit.id;p.name='state' in unit?riftUnitName(unit):unit.kind==='core'?'Rift Core':unit.kind[0].toUpperCase()+unit.kind.slice(1);p.alive=true;p.team=unit.team;p.x=unit.x;p.y=unit.y;p.z=unit.z;p.yaw='yaw' in unit?unit.yaw:0;p.hp=unit.hp;p.maxHp=unit.maxHp;p.size='state' in unit?riftUnitHeight(unit)/1.8:RIFT_BODY_HEIGHT[unit.kind]/1.8;p.action=('state' in unit?unit.state==='attack':!!unit.target&&snapshot.serverTime-unit.attackAt<.7)?'light':'idle';p.target=unit.target;p.actionStarted=unit.attackAt;p.actionDuration=.7;p.actionTime=Math.min(1,Math.max(0,(snapshot.serverTime-unit.attackAt)/.7));
      body.distance=distance;body.group.position.set(p.x,p.y,p.z);this.players.push(p);this.near.push(body);
    }
    for(const [id,body] of this.bodies)if(!body.state.alive){this.bodies.delete(id);this.glows.delete(id);this.free.push(body);}
    this.near.sort((a,b)=>a.distance-b.distance);for(let i=0;i<Math.min(20,this.near.length);i++)this.crowd.set(this.near[i].state.id,this.near[i]);
    return this.players;
  }
  body(id:string){return this.bodies.get(id) as unknown as Fighter|undefined;}
  clear(){this.players.length=0;this.bodies.clear();this.free.length=0;this.near.length=0;this.crowd.clear();this.glows.clear();}
  private make():Proxy{return {group:new Group(),threatInk:threatInk(),distance:0,state:{id:'',name:'',fighter:'goku',enemy:'rift-unit',alive:true,isBot:true,x:0,y:0,z:0,yaw:0,hp:1,maxHp:1,stamina:100,ultimate:0,action:'idle',actionStarted:0,actionTime:0,actionDuration:0,target:null,grounded:true,guarding:false,cooldowns:{light:0,heavy:0,special:0,ultimate:0}}};}
}
