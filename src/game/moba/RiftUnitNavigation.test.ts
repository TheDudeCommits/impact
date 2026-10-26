import {describe,expect,it} from 'vitest';
import {RiftUnitNavigation} from './RiftUnitNavigation';
import {RIFT_FOOTPRINTS,RIFT_SOLIDS,RIFT_GROVES,RIFT_CAMPS,laneProgress} from './map';
import {RIFT_LANES} from './model';
import {RiftMatch} from './RiftMatch';
const intersects=(point:{x:number;z:number},radius:number)=>RIFT_SOLIDS.find(b=>Math.max(0,Math.abs(point.x-b.x)-b.halfX)**2+Math.max(0,Math.abs(point.z-b.z)-b.halfZ)**2<radius**2);
describe('bounded lightweight army navigation',()=>{
 it('prepares every lane with clearance for the largest siege cart, including fountain guardians',()=>{
  const nav=new RiftUnitNavigation(),at={x:0,z:0};let overlap:string|undefined;
  for(const lane of RIFT_LANES)for(let d=0;d<=nav.laneLength(lane);d+=.2){nav.lanePoint(lane,d,at);overlap??=intersects(at,1.1)?.id;}
  expect(overlap).toBeUndefined();
 });
 it('takes a short detour around a plinth and rejects a knockback into it',()=>{
  const nav=new RiftUnitNavigation(),box=RIFT_FOOTPRINTS.find(b=>b.id==='rift-heroes-mid-tower-1')!,point={x:box.x,z:box.z-6};
  for(let i=0;i<240;i++)nav.move('test',point,box.x,box.z+6,.25,i*.05);
  expect(point.z).toBeGreaterThan(box.z+5);expect(intersects(point,1.1)).toBeUndefined();
  const before={...point};nav.push(point,box.x,box.z);expect(point).toEqual(before);nav.forget('test');
 });
 it('can leave each new wooded island and reach every neutral camp without entering scenery',()=>{
  const nav=new RiftUnitNavigation();
  for(const grove of RIFT_GROVES){const point={x:grove.x,z:grove.z-8};const target={x:grove.x,z:grove.z+8};for(let i=0;i<320;i++){nav.move(grove.id,point,target.x,target.z,.2,i*.05);expect(intersects(point,1.1),grove.id).toBeUndefined();}expect(Math.hypot(point.x-target.x,point.z-target.z),grove.id).toBeLessThan(1);}
  for(const camp of RIFT_CAMPS){const point={x:0,z:0};for(let i=0;i<500;i++){nav.move('camp',point,camp.x,camp.z,.2,i*.05);expect(intersects(point,1.1)).toBeUndefined();}expect(Math.hypot(point.x-camp.x,point.z-camp.z)).toBeLessThan(1);nav.forget('camp');}
 });
 it('gets complete waves past their own defenses without any body entering a plinth',()=>{
  const game=new RiftMatch({fillBots:false});game.add('hero','naruto','Hero');game.add('villain','dio','Villain');game.start();let overlap:string|undefined;
  try{for(let tick=0;tick<25*60;tick++){game.step();if(tick%3===0)for(const unit of game.view.units)if(unit.hp>0&&unit.team!=='neutral')overlap??=intersects(unit,unit.radius)?.id;}
   expect(overlap).toBeUndefined();for(const lane of RIFT_LANES){const wave=game.view.units.filter(u=>u.team==='heroes'&&u.lane===lane);expect(wave).toHaveLength(4);expect(Math.min(...wave.map(u=>laneProgress(lane,u)))).toBeGreaterThan(40);}
  }finally{game.dispose();}
 });
});
