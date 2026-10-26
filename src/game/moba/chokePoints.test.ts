import {expect,it} from 'vitest';
import {NavGrid} from '../botNav';
import {RIFT_BASES,RIFT_CAMPS,RIFT_BOSS,RIFT_RUNES,riftClearShot} from './map';
import {RIFT_STAGE} from './model';
it('blocks direct cross-lane fire but preserves the authored jungle entrances',()=>{
 expect(riftClearShot({x:-61,z:-24},{x:-35,z:-24})).toBe(false);
 expect(riftClearShot({x:-61,z:7},{x:-35,z:7})).toBe(true);
 expect(riftClearShot({x:-25,z:25},{x:-35,z:10})).toBe(true);
 expect(riftClearShot({x:0,z:0},{x:20,z:-20})).toBe(true);
});
it('keeps both bases connected to all camps and runes while forcing lane rotations through passes',()=>{
 const nav=NavGrid.build(RIFT_STAGE);
 for(const base of Object.values(RIFT_BASES))for(const goal of [...RIFT_CAMPS,RIFT_BOSS,...RIFT_RUNES]){
  const start=nav.nearestOpen(nav.cellOf(base.x+5,base.z-5),8),route=nav.path(nav.centreX(start),nav.centreZ(start),goal.x,goal.z);
  expect(route,`${base.x},${base.z} to ${goal.x},${goal.z}`).not.toBeNull();
 }
 const route=nav.path(-61,-24,-35,-15)!;expect(route).not.toBeNull();
 expect(route.some(cell=>nav.centreZ(cell)>0)).toBe(true);
 for(const cell of route)expect(nav.open[cell]).toBe(1);
});
