import type {RiftUnit,RiftView} from '../../game/moba/model';
export function presentRift(before:RiftView,after:RiftView|undefined,weight:number,time:number):RiftView {
 if(!after||weight<=0)return before;
 const later=new Map(after.units.map(u=>[u.id,u]));
 const units=before.units.map(unit=>{
  const next=later.get(unit.id);if(!next||unit.hp<=0)return unit;
  const out:RiftUnit={...unit};
  if(Math.hypot(next.x-unit.x,next.z-unit.z)<8){out.x=unit.x+(next.x-unit.x)*weight;out.y=unit.y+(next.y-unit.y)*weight;out.z=unit.z+(next.z-unit.z)*weight;out.yaw=unit.yaw+Math.atan2(Math.sin(next.yaw-unit.yaw),Math.cos(next.yaw-unit.yaw))*weight;}
  if(next.state==='attack'&&next.attackAt>unit.attackAt&&next.attackAt<=time){out.attackAt=next.attackAt;out.state='attack';out.target=next.target;}
  return out;
 });return {...before,units};
}
