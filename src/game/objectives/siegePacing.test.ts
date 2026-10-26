import {afterEach,expect,it} from 'vitest';
import {ObjectiveMatch} from './ObjectiveMatch';
import {siegeBoss,siegeBossTier} from './siegePacing';
import {siegeChapter} from './siegeChapters';
import {siegeArmy} from './siegeRoster';
import {ENEMIES,kitOf} from '../../survival/enemies';
import {ArenaSimulation} from '../simulation';
import {SiegeBrain} from './SiegeBrain';
const clean:{dispose():void}[]=[];afterEach(()=>clean.splice(0).forEach(g=>g.dispose()));
it('uses distinct low/mid/high bosses at 3/5/10, with the strongest milestone winning overlaps',()=>{
 const expected=[null,null,'low',null,'mid','low',null,null,'low','high',null,'low',null,null,'mid'];
 expect(expected.map((_,i)=>siegeBossTier(i+1))).toEqual(expected);
 expect(siegeBossTier(30)).toBe('high');
 for(let seed=1;seed<20;seed++)for(const wave of [3,5,10,15,30]){
  const id=siegeBoss(wave,seed)!,chapter=siegeChapter(wave,seed),tier=siegeBossTier(wave)!;
  expect(tier==='high'?[chapter.commander]:chapter.definition[tier]).toContain(id);
  expect(ENEMIES[id].model).toBeTruthy();expect(ENEMIES[id].rival).toBeFalsy();expect(id).not.toBe('kurama');
 }
 expect(new Set(Array.from({length:10},(_,i)=>siegeBoss(3,i))).size).toBeGreaterThan(3);
});
it('brings a mixed opening horde quickly, bounded even with defeated bodies waiting to expire',()=>{
 const g=new ObjectiveMatch('last-stand',undefined,3,'bots');clean.push(g);g.add('me','goku','Me');g.start();
 for(let i=0;i<7.2*60;i++)g.step();expect(g.siege!.view.wave).toBe(1);expect(g.siege!.view.plan!.total).toBe(50);
 for(let i=0;i<10*60;i++)g.step();const enemies=g.sim.playerStates().filter(p=>p.team==='horde');
 const army=siegeArmy(1,3);expect(enemies.length).toBeGreaterThanOrEqual(25);expect(new Set(enemies.map(p=>p.enemy))).toEqual(new Set([army.fodder,army.gunner,army.brute,army.specialists.captain]));
 for(let i=0;i<45*60&&g.siege!.view.wave<3;i++){for(const e of g.sim.playerStates().filter(p=>p.team==='horde'&&p.alive))g.sim.damage(e.id,1e6,'me','clear');g.step();expect(g.sim.actors.size).toBeLessThanOrEqual(60);}
 expect(g.siege!.view.wave).toBe(3);expect(g.sim.serverTime).toBeLessThan(65);
});
it('riflemen fire only every 8–10 seconds at range while still fighting at close quarters',()=>{
 const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,respawn:false});clean.push(sim);sim.status='active';sim.addPlayer('target','goku','Target',false,{x:0,y:0,z:10});sim.setMaxHp('target',100000);
 const def=ENEMIES['marine-rifleman'];sim.addCombatant('gunner',{enemy:def.id,team:'horde',kit:kitOf(def),maxHp:500,spawn:{x:0,y:0,z:0}});sim.setTeam('target','defenders');
 const p=sim.actors.get('gunner')!.state,target=sim.actors.get('target')!.state,brain=new SiegeBrain(p.id,def,0,.5),shots:number[]=[];
 for(let i=0;i<40*60;i++){sim.place('target',{x:0,y:0,z:10});sim.command(p.id,brain.command(sim,p,target,sim.serverTime));sim.step(1/60);for(const e of sim.drainEvents())if(e.kind==='cast'&&e.actorId===p.id)shots.push(sim.serverTime);}
 expect(shots.length).toBeGreaterThanOrEqual(3);expect(shots.length).toBeLessThanOrEqual(5);for(let i=1;i<shots.length;i++)expect(shots[i]-shots[i-1]).toBeGreaterThanOrEqual(8);
 sim.place('target',{x:p.x,y:0,z:p.z+2});let melee=false;for(let i=0;i<5*60;i++){sim.command(p.id,brain.command(sim,p,target,sim.serverTime,1,false));sim.step(1/60);melee||=sim.drainEvents().some(e=>e.kind==='cast'&&e.actorId===p.id&&e.slot==='light');}expect(melee).toBe(true);
});
