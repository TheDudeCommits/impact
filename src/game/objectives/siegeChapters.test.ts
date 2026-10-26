import {afterEach,expect,it} from 'vitest';
import {siegeChapter,MARINE_BOSSES,SIEGE_CHAPTERS} from './siegeChapters';
import {siegeArmy} from './siegeRoster';
import {siegeBoss} from './siegePacing';
import {SiegeTraps,TRAP_SITES} from './siegeTraps';
import {ArenaSimulation} from '../simulation';
import {ObjectiveMatch} from './ObjectiveMatch';
import {BOSSES} from '../../survival/bosses';
import {ENEMIES,kitOf} from '../../survival/enemies';

const clean:{dispose():void}[]=[];afterEach(()=>clean.splice(0).forEach(x=>x.dispose()));
it('keeps a seeded army and commander for ten waves, visits every ready chapter, and only escorts Marine bosses with Marines',()=>{
  const openings=new Set<string>();
  for(let seed=1;seed<=100;seed++){
    openings.add(siegeChapter(1,seed).definition.id);
    const cycle=new Set<string>();
    for(let start=1;start<=SIEGE_CHAPTERS.length*10;start+=10){
      const first=siegeChapter(start,seed);cycle.add(first.definition.id);
      for(let wave=start;wave<start+10;wave++){
        expect(siegeChapter(wave,seed)).toEqual(first);
        const army=siegeArmy(wave,seed),boss=siegeBoss(wave,seed);
        if(boss){expect(ENEMIES[boss].series).toBe(ENEMIES[army.fodder].series);if(army.fodder==='marine')expect(MARINE_BOSSES.has(boss)).toBe(true);}
      }
      expect(siegeBoss(start+9,seed)).toBe(first.commander);
      expect(siegeChapter(start+10,seed).definition.id).not.toBe(first.definition.id);
    }
    expect(cycle.size).toBe(SIEGE_CHAPTERS.length);
  }
  expect(openings.size).toBe(SIEGE_CHAPTERS.length);
});
function fixture(){
  const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,respawn:false});clean.push(sim);sim.status='active';
  const traps=new SiegeTraps(sim),site=TRAP_SITES[0],def=ENEMIES.marine;
  const enemy=(id:string,x:number=site.x,y=0)=>{sim.addCombatant(id,{enemy:def.id,team:'horde',kit:kitOf(def),maxHp:1000,spawn:{x,y,z:site.z}});return sim.actors.get(id)!.state;};
  return {sim,traps,enemy,site};
}
it('requires purchased fixtures and physical proximity, with a readable wind-up and one bounded burst',()=>{
  const {sim,traps,enemy}=fixture(),target=enemy('raider'),far=enemy('far',99),air=enemy('air',TRAP_SITES[0].x,8);
  sim.addPlayer('friend','goku','Friend',false,{x:TRAP_SITES[0].x,y:0,z:TRAP_SITES[0].z});const friend=sim.actors.get('friend')!.state;
  traps.update([target,far,air,friend],{traps:0,charges:0},'wire',1);expect(traps.sites[0].burstAt).toBe(0);
  traps.update([target,far,air,friend],{traps:1,charges:1},'wire',1);expect(target.hp).toBe(1000);expect(traps.sites[0].burstAt).toBeCloseTo(.8);
  sim.serverTime=.79;traps.update([target,far,air,friend],{traps:1,charges:1},'wire',1);expect(target.hp).toBe(1000);
  sim.serverTime=.81;traps.update([target,far,air,friend],{traps:1,charges:1},'wire',1);
  expect(target.hp).toBeLessThan(900);expect(far.hp).toBe(1000);expect(air.hp).toBe(1000);expect(friend.hp).toBe(1000);
  const hp=target.hp;for(let i=0;i<50;i++){sim.serverTime+=.05;traps.update([target],{traps:1,charges:1},'wire',1);}expect(target.hp).toBe(hp);
});
it('makes snares improve both charges and tower volleys, expires bindings, and clears state for the next chapter',()=>{
  const {sim,traps,enemy}=fixture(),p=enemy('bound');
  traps.update([p],{traps:2,charges:1},'purify',1);expect(traps.slow(p.id,0,2)).toBeCloseTo(.56);expect(traps.volleyMultiplier(p.id,0)).toBe(1.5);
  sim.serverTime=.81;traps.update([p],{traps:2,charges:1},'purify',1);const combo=1000-p.hp;
  traps.reset();p.hp=1000;sim.serverTime=10;traps.update([p],{traps:0,charges:1},'purify',1);sim.serverTime=10.81;traps.update([p],{traps:0,charges:1},'purify',1);
  expect(combo).toBeCloseTo((1000-p.hp)*1.65);expect(traps.slow(p.id,10,2)).toBe(1);expect(traps.volleyMultiplier(p.id,10)).toBe(1);
  const snapshot=traps.snapshot();snapshot[0].readyAt=999;expect(traps.sites[0].readyAt).not.toBe(999);
  traps.reset();expect(traps.sites.every(s=>s.burstAt===0&&s.readyAt===0)).toBe(true);
});
it('does not detonate a target that escapes the visible fixture before the burst',()=>{
  const {sim,traps,enemy}=fixture(),p=enemy('runner');traps.update([p],{traps:0,charges:1},'wire',1);
  p.x=99;sim.serverTime=1;traps.update([p],{traps:0,charges:1},'wire',1);expect(p.hp).toBe(1000);
});
it('purchases payloads from the shared wallet only at the shop, and snapshots isolate chapter and trap state',()=>{
  const g=new ObjectiveMatch('last-stand',undefined,4,'solo');clean.push(g);g.add('me','goku','Me');g.start();for(let i=0;i<240;i++)g.step();
  g.siege!.view.points=1000;expect(g.buy('me','charges')).toContain('quartermaster');expect(g.siege!.view.points).toBe(1000);
  g.sim.place('me',{x:-11,y:0,z:24});expect(g.buy('me','charges')).toBeUndefined();expect(g.siege!.view.upgrades.charges).toBe(1);expect(g.siege!.view.points).toBe(100);
  const snapshot=g.snapshot();snapshot.objective.village!.chapter!.title='changed';snapshot.objective.village!.traps![0].burstAt=555;
  expect(g.siege!.view.chapter!.title).not.toBe('changed');expect(g.siege!.view.traps![0].burstAt).not.toBe(555);
});

it('retains every prior Last Stand boss in a matching chapter',()=>{
 const old=BOSSES.filter(b=>b.universe!=='STAR WARS'&&b.id!=='kurama'&&ENEMIES[b.id]?.model&&!ENEMIES[b.id]?.rival).map(b=>b.id);
 const scheduled=new Set(SIEGE_CHAPTERS.flatMap(c=>[...c.commanders,...c.low,...c.mid]));
 for(const id of old)expect(scheduled.has(id),`Missing existing boss ${id}`).toBe(true);
});
