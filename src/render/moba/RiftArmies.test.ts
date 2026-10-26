import {describe,expect,it,vi} from 'vitest';
import {PerspectiveCamera} from 'three';
import {RiftArmies,riftAttackPose} from './RiftArmies';
import type {GruntRenderer} from '../horde/GruntRenderer';
import {GS,GF} from '../../survival/horde/Horde';
import {GRUNTS} from '../../survival/horde/kinds';
import {riftGruntKind,riftUnitHeight,RIFT_TROOP_HEIGHTS} from '../../game/moba/armyIdentity';
import type {RiftUnit} from '../../game/moba/model';
const unit=(id:string,patch:Partial<RiftUnit>={}):RiftUnit=>({id,team:'heroes',lane:'mid',kind:'melee',x:1,y:0,z:2,yaw:0,hp:100,maxHp:100,radius:.6,state:'move',target:null,attackAt:0,empowered:false,...patch});
function fixture(){const crowd={pageInk:true,loadRift:vi.fn(async()=>{}),clear:vi.fn(),useRiftModels:vi.fn(),update:vi.fn(),threats:undefined as GruntRenderer['threats']};const armies=new RiftArmies(crowd as unknown as GruntRenderer);const update=(units:RiftUnit[],time:number)=>{armies.update(units,time,1/60,new PerspectiveCamera(),new Map());return crowd.update.mock.calls.at(-1)![0].around().a;};return{armies,crowd,update};}
describe('shared animated Rift armies',()=>{
 it('maps every faction and neutral role to an existing authored model and its combat height',()=>{
  for(const team of ['heroes','villains','neutral'] as const)for(const kind of ['melee','ranged','siege','super','camp','boss'] as const){const u=unit('a',{team,kind}),model=GRUNTS[riftGruntKind(u)];expect(model).toBeDefined();expect(riftUnitHeight(u)).toBe(RIFT_TROOP_HEIGHTS[model.id]??model.height);expect(riftUnitHeight({...u,empowered:true})).toBeCloseTo((RIFT_TROOP_HEIGHTS[model.id]??model.height)*1.15);}
 });
 it('keeps unit identity through reordered snapshots, chooses real attacks and retains a death animation',()=>{
  const {update}=fixture(),a=unit('a'),b=unit('b',{team:'villains',kind:'siege'});const first=update([a,b],2),serial=first.serial[0];
  const next=update([b,{...a,state:'attack',attackAt:2.1,empowered:true}],2.3);expect(next.serial[1]).toBe(serial);expect(next.state[1]).toBe(GS.ATTACK);expect(next.move[1]).toBe(1);expect(next.flags[1]&GF.ELITE).toBeTruthy();expect(next.phase[1]).toBeCloseTo(.2);
  expect(update([{...a,hp:50,state:'hurt'}],2.4).state[0]).toBe(GS.FLINCH);expect(update([{...a,hp:50,state:'hurt'}],2.5).phase[0]).toBeCloseTo(.1);
  expect(update([{...a,hp:0,state:'dead'}],2.6).state[0]).toBe(GS.DEAD);expect(update([{...a,hp:0,state:'dead'}],3).phase[0]).toBeCloseTo(.4);
 });
 it('bounds the crowd and clears shared state when returning to another mode',async()=>{
  const {armies,crowd,update}=fixture();await armies.load();expect(crowd.loadRift).toHaveBeenCalledOnce();expect(update(Array.from({length:220},(_,i)=>unit(String(i))),2).n).toBe(192);
  expect(crowd.pageInk).toBe(false);armies.clear();expect(crowd.pageInk).toBe(true);expect(crowd.clear).toHaveBeenCalledOnce();expect(update([unit('fresh')],0).serial[0]).toBe(1);expect(crowd.threats?.size).toBe(0);
 });
 it('retains a last-known fog pose briefly and preserves identity on re-entry, then releases it',()=>{
  const {update}=fixture();const serial=update([unit('a')],1).serial[0];update([unit('a')],1.3);
  const faded=update([],1.4);expect(faded.n).toBe(1);expect(faded.x[0]).toBe(1);
  expect(update([unit('a',{x:2})],1.45).serial[0]).toBe(serial);
  expect(update([],1.7).n).toBe(0);
 });
 it('finishes deaths after authority removal without keeping an unbounded corpse field',()=>{
  const {update}=fixture();update([unit('a')],1);update([unit('a',{hp:0,state:'dead'})],2);
  expect(update([],3.3).state[0]).toBe(GS.DEAD);expect(update([],4.8).n).toBe(0);
 });
 it('puts every role contact at the strike time and ends its recovery before the next attack',()=>{
  for(const [kind,contact,end]of [['melee',.3,.66],['ranged',.45,.81],['siege',.6,1.1],['boss',.75,1.25]] as const){
   expect(riftAttackPose(kind,contact)?.progress).toBeCloseTo(.46);expect(riftAttackPose(kind,end+.01)).toBeUndefined();
  }
 });
});
