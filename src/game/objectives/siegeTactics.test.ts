import {afterEach,expect,it} from 'vitest';
import {ArenaSimulation} from '../simulation';
import {ENEMIES,kitOf} from '../../survival/enemies';
import {SiegeSpecialists} from './siegeSpecialists';
import {VillageEmergency} from './villageEmergency';
import {AssaultDirector} from './assaultDirector';
import {ObjectiveMatch} from './ObjectiveMatch';
const clean:{dispose():void}[]=[];afterEach(()=>clean.splice(0).forEach(g=>g.dispose()));
function world(){const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,respawn:false});clean.push(sim);sim.status='active';return sim;}
function enemy(sim:ArenaSimulation,id:string,x=0,z=0){const def=ENEMIES.marine;sim.addCombatant(id,{enemy:def.id,team:'horde',kit:kitOf(def),maxHp:300,spawn:{x,y:0,z}});return sim.actors.get(id)!.state;}
it('captains protect ordinary allies without stacking, and losing the captain removes protection',()=>{
 const s=world(),a=enemy(s,'a'),b=enemy(s,'b',1),c=enemy(s,'c',2),roles=new SiegeSpecialists(s);roles.register(a.id,'captain');roles.register(b.id,'captain');s.setMods(c.id,{damageIn:.8});
 roles.update([a,b,c]);expect(s.mods(c.id).damageIn).toBeCloseTo(.52);expect(s.mods(a.id).damageIn).toBe(1);
 const boss=enemy(s,'boss',2);boss.enemy='kaido';roles.update([a,b,c,boss]);expect(s.mods(boss.id).damageIn).toBe(1);
 a.alive=false;b.action='hurt';roles.update([a,b,c]);expect(s.mods(c.id).damageIn).toBe(.8);expect(roles.view.map(r=>r.id)).toEqual(['b']);
 b.action='idle';roles.update([b,c]);expect(s.mods(c.id).damageIn).toBeCloseTo(.52);c.x=15;roles.update([b,c]);expect(s.mods(c.id).damageIn).toBe(.8);
});
it('medics channel an interruptible animation and have a finite healing supply',()=>{
 const s=world(),p=enemy(s,'medic'),friend=enemy(s,'hurt',2),roles=new SiegeSpecialists(s);roles.register(p.id,'medic');friend.hp=50;
 const tick=()=>{roles.update([p,friend]);s.command(p.id,roles.command(p,ENEMIES.marine,friend,[p,friend])??{moveX:0,moveZ:0,yaw:0});s.step(1/60);s.drainEvents();};
 for(let i=0;i<2.5*60;i++)tick();expect(p.move).toBe('Mending seal');expect(roles.view[0].charging).toBeGreaterThan(s.serverTime);
 s.damage(p.id,1,'test','Interrupt');for(let i=0;i<2*60;i++)tick();expect(friend.hp).toBe(50);expect(roles.view[0].charges).toBe(3);
 for(let i=0;i<50*60;i++)tick();expect(friend.hp).toBeCloseTo(212);expect(roles.view[0].charges).toBe(0);
});
it('demolition damage lands only after its visible wind-up and uses village mitigation',()=>{
 const s=world(),p=enemy(s,'sapper'),post=enemy(s,'village-west',0,2),roles=new SiegeSpecialists(s);post.team='defenders';post.hp=post.maxHp=5000;s.setMods(post.id,{damageIn:.5});roles.register(p.id,'sapper');
 const tick=()=>{roles.update([p]);s.command(p.id,roles.command(p,ENEMIES.marine,post,[p])??{moveX:0,moveZ:0,yaw:0});s.step(1/60);s.drainEvents();};
 for(let i=0;i<4*60;i++)tick();expect(post.hp).toBe(5000);expect(roles.view[0].charging).toBeGreaterThan(s.serverTime);
 for(let i=0;i<.5*60;i++)tick();expect(post.hp).toBeLessThan(5000);expect(post.hp).toBeGreaterThanOrEqual(4835);
});
it('optional rescue works solo, requires clear ground, expires without penalty and pays once',()=>{
 const s=world(),p=enemy(s,'hero',-23,-5);p.team='defenders';const threat=enemy(s,'threat',-23,-4),event=new VillageEmergency();event.begin(2,0,0);let paid=0;
 for(let i=1;i<=60;i++)paid+=event.update(i/10,[p],[threat],undefined)?.points??0;expect(paid).toBe(0);expect(event.view!.contested).toBe(true);
 threat.alive=false;for(let i=61;i<=110;i++)paid+=event.update(i/10,[p],[threat],undefined)?.points??0;expect(paid).toBe(470);expect(event.view!.helpers).toEqual(['hero']);expect(event.view!.phase).toBe('secured');
 event.begin(4,12,2);event.update(70,[p],[],undefined);expect(event.view!.phase).toBe('missed');expect(p.hp).toBe(300);
});
it('convoy cargo follows its carrier, drops where defeated and survives removal of the body',()=>{
 const s=world(),p=enemy(s,'hero',10,0),carrier=enemy(s,'carrier',10,0),event=new VillageEmergency();event.begin(4,0,2);event.carrier(carrier.id);
 event.update(1,[p],[carrier],carrier);expect(event.view!.x).toBe(10);expect(event.view!.progress).toBe(0);
 carrier.alive=false;event.update(2,[p],[carrier],carrier);let paid=0;
 for(let i=21;i<=65;i++)paid+=event.update(i/10,[p],[],undefined)?.points??0;expect(paid).toBe(540);expect(event.view!.phase).toBe('secured');
});
it('the director makes short rescue openings, rewards fast clears with surges and cannot starve bosses',()=>{
 const s=world(),p=enemy(s,'hero'),director=new AssaultDirector();p.team='defenders';director.update(1,[p],1,0);p.hp=60;director.update(6,[p],1,0);expect(director.view.state).toBe('rally');expect(director.batch).toBe(2);
 director.update(12,[p],1,0);expect(director.view.state).toBe('advance');const ordinaryRate=director.batch/director.gap;p.hp=300;director.update(20,[p],1,15);expect(director.view.state).toBe('surge');expect(director.batch/director.gap).toBeGreaterThan(ordinaryRate*1.5);
 const pending=[{kind:'grunt',lane:1},{kind:'boss',lane:1},{kind:'grunt',lane:director.view.lane}];expect(director.index(pending,'boss')).toBe(0);pending.shift();expect(director.index(pending,'boss')).toBe(0);
});
it('snapshot tactics are isolated and optional events never keep a cleared wave alive',()=>{
 const g=new ObjectiveMatch('last-stand',undefined,9,'solo');clean.push(g);g.add('me','goku','Me');g.start();for(let i=0;i<4*60;i++)g.step();g.siege!.view.wave=1;g.siege!.view.nextWaveAt=g.sim.serverTime;
 for(let i=0;i<120*60&&g.siege!.view.wave<3;i++){for(const p of g.sim.playerStates())if(p.team==='horde'&&p.alive)g.sim.damage(p.id,1e6,'me','Clear');g.step();}
 expect(g.siege!.view.wave).toBe(3);const snapshot=g.snapshot().objective.village!;expect(snapshot.emergency).toBeDefined();snapshot.emergency!.helpers.push('fake');expect(g.siege!.view.emergency!.helpers).not.toContain('fake');snapshot.director!.lane=99;expect(g.siege!.view.director!.lane).not.toBe(99);
});
