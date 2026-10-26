import type {Vec3} from '../types';
import type {RiftLane,RiftStructure,RiftTeam} from './model';
export interface RiftPoint {x:number;z:number}
export const RIFT_BOUNDS={halfX:84,halfZ:84} as const;
export const RIFT_BASES:Record<RiftTeam,Vec3>={heroes:{x:-66,y:0,z:66},villains:{x:66,y:0,z:-66}};
export const RIFT_PATHS:Record<RiftLane,readonly RiftPoint[]>={
  top:[{x:-62,z:58},{x:-64,z:24},{x:-64,z:-32},{x:-52,z:-59},{x:-22,z:-64},{x:24,z:-64},{x:58,z:-62}],
  mid:[{x:-60,z:60},{x:-38,z:38},{x:0,z:0},{x:38,z:-38},{x:60,z:-60}],
  bot:[{x:-58,z:62},{x:-24,z:64},{x:22,z:64},{x:52,z:59},{x:64,z:32},{x:64,z:-24},{x:62,z:-58}],
};
export const RIFT_BOSS={x:25,y:0,z:23};
export const RIFT_CAMPS=[{x:-32,y:0,z:3},{x:-3,y:0,z:32},{x:32,y:0,z:-3},{x:3,y:0,z:-32}] as const;
export const RIFT_RUNES=[{x:-17,y:0,z:-17},{x:17,y:0,z:17}] as const;
export const RIFT_LANE_WIDTH=9;
export function pathLength(lane:RiftLane):number {const p=RIFT_PATHS[lane];let n=0;for(let i=1;i<p.length;i++)n+=Math.hypot(p[i].x-p[i-1].x,p[i].z-p[i-1].z);return n;}
export const RIFT_LENGTHS:Record<RiftLane,number>={top:pathLength('top'),mid:pathLength('mid'),bot:pathLength('bot')};
export function lanePoint(lane:RiftLane,distance:number,out:RiftPoint={x:0,z:0}):RiftPoint {
  const path=RIFT_PATHS[lane];if(distance>=RIFT_LENGTHS[lane]){Object.assign(out,path[path.length-1]);return out;}let remaining=Math.max(0,Math.min(RIFT_LENGTHS[lane],distance));
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(remaining<=length){const t=remaining/length;out.x=a.x+(b.x-a.x)*t;out.z=a.z+(b.z-a.z)*t;return out;}remaining-=length;}
  Object.assign(out,path[path.length-1]);return out;
}
export function laneProgress(lane:RiftLane,point:RiftPoint):number {
  const path=RIFT_PATHS[lane];let walked=0,best=Infinity,progress=0;
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(length*length))),d=Math.hypot(point.x-a.x-dx*t,point.z-a.z-dz*t);if(d<best){best=d;progress=walked+length*t;}walked+=length;}
  return progress;
}
export function riftStructures():RiftStructure[]{
  const out:RiftStructure[]=[];
  for(const team of ['heroes','villains'] as const){
    const make=(kind:RiftStructure['kind'],lane:RiftStructure['lane'],tier:number,at:RiftPoint,hp:number,radius:number)=>out.push({id:`rift-${team}-${lane}-${kind}-${tier}`,team,lane,kind,tier,x:at.x,y:0,z:at.z,hp,maxHp:hp,radius,vulnerable:kind==='tower'&&tier===1,target:null,attackAt:0});
    for(const lane of ['top','mid','bot'] as const){const length=RIFT_LENGTHS[lane];for(const [kind,tier,t,hp,radius] of [['tower',1,.34,2100,2.2],['tower',2,.2,2500,2.4],['barracks',3,.105,1650,2.5]] as const){const d=length*(team==='heroes'?t:1-t),point=lanePoint(lane,d),a=lanePoint(lane,d-1),b=lanePoint(lane,d+1),len=Math.hypot(b.x-a.x,b.z-a.z),side=team==='heroes'?1:-1;point.x-=(b.z-a.z)/len*6*side;point.z+=(b.x-a.x)/len*6*side;make(kind,lane,tier,point,hp,radius);}}
    const b=RIFT_BASES[team],sign=team==='heroes'?1:-1;
    make('guardian','base',4,{x:b.x+sign*11,z:b.z-sign*5},2400,2.1);
    make('guardian','base',5,{x:b.x+sign*5,z:b.z-sign*11},2400,2.1);
    make('core','base',6,b,4200,4);
  }
  return out;
}

export const RIFT_FOOTPRINTS=Object.freeze(riftStructures().map(s=>{
  const half=s.kind==='core'?3.2:s.kind==='guardian'?1.65:s.kind==='barracks'?1.7:1.7;
  return Object.freeze({id:s.id,x:s.x,y:.25,z:s.z,halfX:half,halfY:.25,halfZ:half});
}));

export const RIFT_GROVES=Object.freeze([
  [-34,-23],[-18,-35],
].flatMap(([x,z],i)=>[1,-1].map(sign=>Object.freeze({id:`rift-grove-${i}-${sign}`,x:x*sign,z:z*sign,y:2.4,halfX:4.8,halfY:2.4,halfZ:4.8}))));
const ridgePieces=[
  {x:-49,z:-25,halfX:3,halfZ:24}, {x:-49,z:25.5,halfX:3,halfZ:9.5},
  {x:-31,z:-49,halfX:18,halfZ:3}, {x:18.5,z:-49,halfX:16.5,halfZ:3},
  ...Array.from({length:22},(_,i)=>-49+i*4).filter(x=>!(x>=-33&&x<=-21)&&!(x>=7&&x<=19)).map(x=>({x,z:-14-x,halfX:3,halfZ:3})),
];
export const RIFT_RIDGES=Object.freeze(ridgePieces.flatMap((b,i)=>[1,-1].map(sign=>Object.freeze({...b,id:`rift-ridge-${i}-${sign}`,x:b.x*sign,z:b.z*sign,y:4.8,halfY:4.8}))));
export const RIFT_OUTPOSTS=Object.freeze([
  [-76,28],[-76,-32],[-30,-76],
].flatMap(([x,z],i)=>[1,-1].map(sign=>Object.freeze({id:`rift-outpost-${i}-${sign}`,x:x*sign,z:z*sign,y:2.7,halfX:3.3,halfY:2.7,halfZ:3.3}))));
export const RIFT_GATES=Object.freeze(Object.entries(RIFT_BASES).map(([team,b])=>{const sign=team==='heroes'?1:-1;return{id:`rift-gate-${team}`,x:b.x+18*sign,z:b.z-18*sign};}));
export const RIFT_LANDSCAPE=Object.freeze([...RIFT_RIDGES,...RIFT_GROVES,...RIFT_OUTPOSTS,...RIFT_GATES.flatMap(g=>[-1,1].map(side=>Object.freeze({id:g.id+side,x:g.x+side*4.5,z:g.z+side*4.5,y:3.5,halfX:.45,halfY:3.5,halfZ:.45})))]);
export const RIFT_SOLIDS=Object.freeze([...RIFT_FOOTPRINTS,...RIFT_LANDSCAPE]);

export function riftClearShot(a:RiftPoint,b:RiftPoint):boolean {
  const dx=b.x-a.x,dz=b.z-a.z;
  for(const box of RIFT_LANDSCAPE){
    if(Math.max(a.x,b.x)<box.x-box.halfX||Math.min(a.x,b.x)>box.x+box.halfX||Math.max(a.z,b.z)<box.z-box.halfZ||Math.min(a.z,b.z)>box.z+box.halfZ)continue;
    let low=0,high=1;
    for(const [origin,delta,centre,half] of [[a.x,dx,box.x,box.halfX],[a.z,dz,box.z,box.halfZ]]){
      if(Math.abs(delta)<1e-8){if(origin<centre-half||origin>centre+half){low=2;break;}}
      else{const t1=(centre-half-origin)/delta,t2=(centre+half-origin)/delta;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));}
    }
    if(low<=high)return false;
  }
  return true;
}
