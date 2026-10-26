import type {RiftUnitKind} from './model';
export const WARFRONTS=[
 {tier:0,at:0,name:'First contact',hint:'Escort your infantry. Win the first exchanges.',melee:3,ranged:1,siegeEvery:3},
 {tier:1,at:120,name:'Siege march',hint:'Siege guardians join every second wave.',melee:4,ranged:2,siegeEvery:2},
 {tier:2,at:300,name:'Warfront',hint:'Every wave carries siege support. Control the jungle passes.',melee:5,ranged:2,siegeEvery:1},
 {tier:3,at:480,name:'Total war',hint:'Elite vanguards and double siege columns are marching.',melee:5,ranged:2,siegeEvery:1},
] as const;
export function warfrontAt(elapsed:number){return WARFRONTS[elapsed>=480?3:elapsed>=300?2:elapsed>=120?1:0];}
export function waveComposition(elapsed:number,wave:number,breached:boolean):RiftUnitKind[]{
 const front=warfrontAt(elapsed),kinds:RiftUnitKind[]=Array.from({length:front.melee},()=>breached?'super':'melee');
 for(let i=0;i<front.ranged;i++)kinds.push('ranged');
 if(wave%front.siegeEvery===0)kinds.push('siege');
 if(front.tier===3){kinds.push('siege');kinds[0]='super';}
 return kinds;
}
