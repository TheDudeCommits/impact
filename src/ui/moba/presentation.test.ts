import {describe,it,expect} from 'vitest';
import {canStartRift,riftResultAction,canShop,itemState} from './presentation';
import {riftItem} from '../../game/moba/items';
import type {RiftSeat} from '../../game/moba/model';
import type {PlayerState} from '../../game/types';
const seat={team:'heroes',gold:1200,inventory:['spirit-blade']} as RiftSeat;
describe('Rift forge feedback',()=>{
  it('agrees with component credit and rejects rebuying evolved foundations',()=>{expect(itemState(seat,riftItem('void-edge')!).cost).toBe(1200);expect(itemState(seat,riftItem('void-edge')!).disabled).toBe(false);expect(itemState({...seat,inventory:['void-edge']},riftItem('spirit-blade')!).label).toBe('UPGRADED');});
  it('allows a component replacement in a full six-slot build but not another relic',()=>{const full={...seat,gold:9999,inventory:['spirit-blade','focus-charm','vital-seal','iron-ward','swift-sandals','soul-fang']} as RiftSeat;expect(itemState(full,riftItem('void-edge')!).disabled).toBe(false);expect(itemState({...full,inventory:['void-edge','sage-scroll','titan-heart','guardian-oath','storm-step','blood-moon']},riftItem('soul-fang')!).disabled).toBe(true);});
  it('shows the full price for a second evolution after its foundation is consumed',()=>{const other={...seat,gold:2000,inventory:['titan-heart']} as RiftSeat;expect(itemState(other,riftItem('dawn-oath')!).cost).toBe(1550);expect(itemState(other,riftItem('dawn-oath')!).disabled).toBe(false);});
  it('only offers purchases inside the fountain or during respawn',()=>{const p={alive:true,x:-66,z:66} as PlayerState;expect(canShop(p,seat)).toBe(true);expect(canShop({...p,x:0},seat)).toBe(false);expect(canShop({...p,x:0,alive:false},seat)).toBe(true);});
});

import {nextObjective,wardPressure} from './presentation';
import {riftStructures} from '../../game/moba/map';
import type {RiftView} from '../../game/moba/model';
const own={...seat,id:'h',gold:550,inventory:[],lane:'mid'} as RiftSeat;
const home={id:'h',team:'heroes',alive:true,x:-62,z:62} as PlayerState;
const war=()=>({phase:'active',seats:[own],structures:riftStructures(),units:[],wave:0,startedAt:0,nextWaveAt:5,buffs:{heroes:0,villains:0}} as unknown as RiftView);
describe('Rift first-minute orders and ward warnings',()=>{
  it('guides the first affordable relic only at the fountain, then the chosen wave',()=>{const view=war();expect(nextObjective(view,own,1,home).title).toBe('Visit the relic shop');expect(nextObjective(view,{...own,inventory:['spirit-blade']},1,home).title).toBe('RIVER WAVE · 4s TO DEPLOY');expect(nextObjective(view,own,1,{...home,x:0,z:0}).title).not.toBe('Visit the relic shop');});
  it('warns only for visible hostile living wards that actually target this player',()=>{const view=war(),tower=view.structures.find(s=>s.team==='villains'&&s.kind==='tower')!;const p={...home,x:tower.x+3,z:tower.z};tower.target='h';expect(nextObjective(view,own,70,p).tone).toBe('danger');tower.hidden=true;expect(wardPressure(view,own,p)?.targeting??false).toBe(false);tower.hidden=false;tower.hp=0;expect(wardPressure(view,own,p)?.targeting??false).toBe(false);});
  it('explains fortification until a living friendly wave reaches the ward',()=>{const view=war(),tower=view.structures.find(s=>s.team==='villains'&&s.kind==='tower'&&s.tier===1)!;const p={...home,x:tower.x+3,z:tower.z};expect(nextObjective(view,own,70,p).detail).toContain('18%');view.units.push({team:'heroes',hp:1,x:tower.x,z:tower.z} as RiftView['units'][number]);expect(wardPressure(view,own,p)?.fortified).toBe(false);expect(nextObjective(view,own,70,p).detail).not.toContain('18%');});
  it('never promises partial damage against a still-sealed inner defense',()=>{const view=war(),tower=view.structures.find(s=>s.team==='villains'&&s.kind==='tower'&&s.tier===2)!;const p={...home,x:tower.x+3,z:tower.z};expect(nextObjective(view,own,70,p).title).toBe('DEFENSE SEALED');});
});


describe('Rift private host controls',()=>{
  const lobby=()=>({...war(),phase:'lobby',hostId:'h',access:'host',autoStart:false} as RiftView);
  it('only allows the private host to open the lobby',()=>{expect(canStartRift(lobby(),'h')).toBe(true);expect(canStartRift(lobby(),'guest')).toBe(false);});
  it('never exposes manual start to the first public entrant or auto-start parties',()=>{expect(canStartRift({...lobby(),access:'quick'},'h')).toBe(false);expect(canStartRift({...lobby(),autoStart:true},'h')).toBe(false);});
  it('removes start and fill controls once countdown has begun',()=>{expect(canStartRift({...lobby(),phase:'countdown'},'h')).toBe(false);expect(canStartRift({...lobby(),phase:'active'},'h')).toBe(false);});
});


describe('Rift results actions',()=>{
  const result=()=>({...war(),phase:'over',access:'host',hostId:'h'} as RiftView);
  it('lets every public player find a new match without waiting for the first entrant',()=>{for(const id of ['h','guest'])expect(riftResultAction({...result(),access:'quick'},id)).toEqual({command:'rift-requeue',label:'FIND NEXT WAR',enabled:true});});
  it('preserves private host rematches and guest waiting',()=>{expect(riftResultAction(result(),'h')).toEqual({command:'rift-rematch',label:'RUN IT BACK',enabled:true});expect(riftResultAction(result(),'guest')).toEqual({command:'rift-rematch',label:'WAITING FOR HOST',enabled:false});});
  it('keeps offline runbacks and never enables either command before results',()=>{expect(riftResultAction({...result(),access:'bots'},'h').command).toBe('rift-rematch');expect(riftResultAction({...result(),access:'quick',phase:'active'},'guest').enabled).toBe(false);});
});


describe('Rift immediate threat priority',()=>{
  it('does not let a distant boss or team buff conceal a nearby sealed defense',()=>{
    const view=war(),tower=view.structures.find(s=>s.team==='villains'&&s.kind==='tower'&&s.tier===2)!;
    view.units.push({id:'boss',kind:'boss',hp:100,x:20,z:20} as RiftView['units'][number]);view.buffs.heroes=200;
    expect(nextObjective(view,own,70,{...home,x:tower.x+3,z:tower.z}).title).toBe('DEFENSE SEALED');
  });
  it('keeps the bring-your-wave warning over the global boss announcement',()=>{
    const view=war(),tower=view.structures.find(s=>s.team==='villains'&&s.kind==='tower'&&s.tier===1)!;
    view.units.push({id:'boss',kind:'boss',hp:100,x:20,z:20,team:'neutral'} as RiftView['units'][number]);
    expect(nextObjective(view,own,70,{...home,x:tower.x+3,z:tower.z}).tone).toBe('caution');
  });
});
