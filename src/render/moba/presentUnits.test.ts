import {expect,it}from'vitest';
import {presentRift}from'./presentUnits';
import type{RiftUnit,RiftView}from'../../game/moba/model';
const unit=(id:string,x:number):RiftUnit=>({id,team:'heroes',kind:'melee',lane:'mid',x,y:0,z:0,yaw:3.1,hp:100,maxHp:100,state:'move',target:null,attackAt:0,radius:.6,empowered:false});
const view=(units:RiftUnit[])=>({units}as RiftView);
it('smooths 20 Hz unit movement and yaw without revealing new or departed fog members',()=>{
 const a=unit('a',0),hidden=unit('hidden',3),b={...unit('a',1),yaw:-3.1};
 const shown=presentRift(view([a]),view([b,hidden]),.5,1).units;
 expect(shown).toHaveLength(1);expect(shown[0].x).toBe(.5);expect(shown[0].yaw).toBeCloseTo(Math.PI);
 expect(a.x).toBe(0);expect(presentRift(view([a]),view([]),.5,1).units[0].x).toBe(0);
});
it('starts an attack at its known timestamp but does not anticipate a future attack or teleport',()=>{
 const a=unit('a',0),b={...unit('a',12),state:'attack' as const,attackAt:2};
 expect(presentRift(view([a]),view([b]),.5,1.9).units[0].state).toBe('move');
 const shown=presentRift(view([a]),view([b]),.7,2.1).units[0];expect(shown.state).toBe('attack');expect(shown.attackAt).toBe(2);expect(shown.x).toBe(0);
});
