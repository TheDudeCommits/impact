import {NavGrid} from '../botNav';
import {RIFT_STAGE,RIFT_LANES,type RiftLane} from './model';
import {RIFT_SOLIDS,RIFT_PATHS} from './map';
interface Point {x:number;z:number}
interface Route {cells:number[]|null;until:number;x:number;z:number}
export class RiftUnitNavigation {
 private static grid?:NavGrid;
 private readonly nav=RiftUnitNavigation.grid??=RiftUnitNavigation.build();
 private static lanes=new Map<RiftLane,{points:(Point&{distance:number})[];length:number}>();
 private readonly routes=new Map<string,Route>();
 constructor(){for(const lane of RIFT_LANES)this.lane(lane);}
 private static build(){
  const nav=NavGrid.build(RIFT_STAGE);
  for(const box of RIFT_SOLIDS)for(let z=box.z-box.halfZ-2;z<=box.z+box.halfZ+2;z++)for(let x=box.x-box.halfX-2;x<=box.x+box.halfX+2;x++){
   const cell=nav.cellOf(x,z);if(cell<0)continue;const dx=Math.max(0,Math.abs(nav.centreX(cell)-box.x)-box.halfX),dz=Math.max(0,Math.abs(nav.centreZ(cell)-box.z)-box.halfZ);
   if(dx*dx+dz*dz<1.85**2)nav.open[cell]=0;
  }
  return nav;
 }
 private lane(lane:RiftLane){
  let known=RiftUnitNavigation.lanes.get(lane);if(known)return known;
  const nav=this.nav,cells:number[]=[],path=RIFT_PATHS[lane];
  for(let i=1;i<path.length;i++){
   const start=nav.nearestOpen(nav.cellOf(path[i-1].x,path[i-1].z),6),end=nav.nearestOpen(nav.cellOf(path[i].x,path[i].z),6);
   const segment=nav.path(nav.centreX(start),nav.centreZ(start),nav.centreX(end),nav.centreZ(end));if(segment)cells.push(...segment.slice(i===1?0:1));
  }
  const points:(Point&{distance:number})[]=[];let index=0,distance=0;
  while(index<cells.length){
   const x=nav.centreX(cells[index]),z=nav.centreZ(cells[index]),last=points.at(-1);if(last)distance+=Math.hypot(x-last.x,z-last.z);points.push({x,z,distance});
   if(index===cells.length-1)break;
   let next=index+1;for(let i=Math.min(cells.length-1,index+16);i>index+1;i--)if(nav.clear(x,z,nav.centreX(cells[i]),nav.centreZ(cells[i]))){next=i;break;}index=next;
  }
  known={points,length:distance};RiftUnitNavigation.lanes.set(lane,known);return known;
 }
 laneLength(lane:RiftLane){return this.lane(lane).length;}
 lanePoint(lane:RiftLane,distance:number,out:Point):Point {
  const path=this.lane(lane),points=path.points,d=Math.max(0,Math.min(path.length,distance));let low=0,high=points.length-1;
  while(low+1<high){const mid=(low+high)>>1;if(points[mid].distance<d)low=mid;else high=mid;}
  const a=points[low],b=points[high],t=(d-a.distance)/(b.distance-a.distance||1);out.x=a.x+(b.x-a.x)*t;out.z=a.z+(b.z-a.z)*t;return out;
 }
 place(point:Point){
  if(this.nav.walkable(point.x,point.z))return;
  const cell=this.nav.nearestOpen(this.nav.cellOf(point.x,point.z),4);
  if(cell>=0){point.x=this.nav.centreX(cell);point.z=this.nav.centreZ(cell);}
 }
 move(id:string,point:Point,x:number,z:number,step:number,now:number){
  const nav=this.nav;
  if(nav.clear(point.x,point.z,x,z))this.routes.delete(id);
  else{
   let route=this.routes.get(id);
   if(!route||now>=route.until||Math.hypot(route.x-x,route.z-z)>3){const cell=nav.nearestOpen(nav.cellOf(x,z),6);route={cells:cell>=0?nav.path(point.x,point.z,nav.centreX(cell),nav.centreZ(cell)):null,until:now+1,x,z};this.routes.set(id,route);}
   if(route.cells?.length){const at=nav.steer(route.cells,point.x,point.z,5);x=at.x;z=at.z;}
  }
  const dx=x-point.x,dz=z-point.z,d=Math.hypot(dx,dz);if(d<.001)return;
  const scale=Math.min(d,step)/d,nextX=point.x+dx*scale,nextZ=point.z+dz*scale;
  if(nav.walkable(nextX,nextZ)){point.x=nextX;point.z=nextZ;}
  else if(nav.walkable(nextX,point.z))point.x=nextX;
  else if(nav.walkable(point.x,nextZ))point.z=nextZ;
 }
 push(point:Point,x:number,z:number){if(this.nav.walkable(x,z)){point.x=x;point.z=z;}}
 forget(id:string){this.routes.delete(id);}
 clear(){this.routes.clear();}
}
