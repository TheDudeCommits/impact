import {expect,it} from 'vitest';
import {UnitGrid} from './UnitGrid';
it('preserves exhaustive range queries and insertion ties across cell boundaries and movement',()=>{
 const units=Array.from({length:192},(_,id)=>({id,x:(id*37%167)-83,z:(id*61%167)-83}));
 const grid=new UnitGrid<(typeof units)[number]>(),out:typeof units=[];grid.rebuild(units);
 let candidates=0,all=0;
 for(let step=0;step<40;step++){
  const mover=units[step];mover.x+=13.5;mover.z-=9.5;grid.moved(mover);
  for(const origin of units){
   const radius=step%2?11:14,within=(u:(typeof units)[number])=>Math.hypot(u.x-origin.x,u.z-origin.z)<radius;
   const nearby=grid.query(origin.x,origin.z,radius,out);candidates+=nearby.length;all+=units.length;
   expect(nearby.filter(within).sort((a,b)=>a.id-b.id)).toEqual(units.filter(within));
  }
 }
 expect(candidates/all).toBeLessThan(.1);
 expect(grid.before(units[0],units[1])).toBe(true);expect(grid.before(units[1],units[0])).toBe(false);
 grid.rebuild(units.slice(100));expect(grid.query(0,0,200,out).sort((a,b)=>a.id-b.id)).toEqual(units.slice(100));
 grid.clear();expect(grid.query(0,0,200,out)).toEqual([]);
});
