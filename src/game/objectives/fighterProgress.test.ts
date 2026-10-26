import {afterEach,expect,it} from 'vitest';
import {ObjectiveMatch} from './ObjectiveMatch';
import {ENEMIES,kitOf} from '../../survival/enemies';
const matches:ObjectiveMatch[]=[];afterEach(()=>matches.splice(0).forEach(g=>g.dispose()));
function match(){const g=new ObjectiveMatch('last-stand',undefined,3,'host');matches.push(g);g.add('a','goku','A');g.add('b','naruto','B');g.start();for(let i=0;i<181;i++)g.step();const d=ENEMIES.marine;g.sim.addCombatant('dummy',{enemy:d.id,team:'horde',kit:kitOf(d),maxHp:50000,spawn:{x:35,y:0,z:-40}});return g;}
const progress=(g:ObjectiveMatch,id='a')=>g.snapshot().objective.seats.find(s=>s.id===id)!.progress!;
it('credits actual individual damage and kills once, including split damage, with no XP from shared funds',()=>{
 const g=match();g.sim.damage('dummy',1200,'a','attack');g.sim.damage('dummy',400,'b','attack');g.step();
 expect(progress(g).total).toBe(120);expect(progress(g,'b').total).toBe(40);
 g.sim.actors.get('dummy')!.state.hp=100;g.sim.damage('dummy',999999,'b','finisher');g.step();
 expect(progress(g).total).toBe(120);expect(progress(g,'b').total).toBe(70);
 g.step();expect(progress(g,'b').total).toBe(70);
 g.siege!.view.points=99999;g.sim.place('a',{x:-11,y:0,z:24});g.buy('a','walls');g.step();expect(progress(g).total).toBe(120);
});
it('grows stats automatically, keeps health share on ordinary levels and fully heals at levels 5 and 10',()=>{
 const g=match(),p=g.sim.actors.get('a')!.state;p.hp=250;
 g.sim.damage('dummy',2400,'a','attack');g.step();expect(progress(g).level).toBe(2);
 expect(p.maxHp).toBe(1080);expect(p.hp).toBe(270);expect(p.maxStamina).toBe(105);
 expect(g.sim.mods('a')).toMatchObject({damageOut:1.08,speed:1.015,cooldown:1/1.04,staminaRecovery:1.05});
 g.sim.damage('dummy',10800,'a','attack');g.step();expect(progress(g).level).toBe(5);expect(p.hp).toBe(p.maxHp);
 p.hp=123;g.sim.damage('dummy',4800,'a','attack');g.step();expect(progress(g).level).toBe(6);expect(p.hp).toBeLessThan(140);
 g.sim.damage('dummy',25200,'a','attack');g.step();expect(progress(g).level).toBe(10);expect(p.hp).toBe(p.maxHp);
 expect(progress(g,'b').level).toBe(1);
});
it('never brings back a fallen defender when an in-flight attack earns a heal level',()=>{
 const g=match();g.sim.damage('a',99999,'horde','KO');g.sim.damage('dummy',13200,'a','late projectile');g.step();
 expect(progress(g).level).toBe(5);expect(progress(g).healedAt).toBe(-1);expect(g.sim.actors.get('a')!.state).toMatchObject({alive:false,hp:0,maxHp:1320});
 expect(g.seats.get('a')!.down).toBe(true);expect(g.view.phase).toBe('active');
});
it('clones progress in snapshots and resets it for another run without affecting Bad Blood',()=>{
 const g=match();g.sim.damage('dummy',2400,'a','attack');g.step();progress(g).level=999;expect(progress(g).level).toBe(2);
 expect(progress(match()).level).toBe(1);
 const b=new ObjectiveMatch('bad-blood');matches.push(b);b.add('a','goku','A');expect(b.snapshot().objective.seats[0].progress).toBeUndefined();expect(b.sim.mods('a').damageOut).toBe(1);
});
it('keeps long-run movement readable while damage and health continue growing',()=>{
 const g=match();g.sim.actors.get('a')!.state.damageDealt=10000000;g.step();
 expect(progress(g).level).toBeGreaterThan(100);expect(g.sim.mods('a').speed).toBe(1.5);expect(g.sim.mods('a').damageOut).toBeGreaterThan(8);expect(Number.isFinite(g.sim.actors.get('a')!.state.hp)).toBe(true);
});
