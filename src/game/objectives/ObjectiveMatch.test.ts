import {describe,it,expect,afterEach} from 'vitest';
import {ObjectiveMatch} from './ObjectiveMatch';
import {ObjectiveBrain} from './ObjectiveBrain';
import {factionOf,VILLAINS} from './model';
import {VILLAGE,LANES,gateWaypoint} from './lastStand';
import {MOVES,STAMINA_REGEN} from '../moves';
import {createRapierCollision} from '../rapierCollision';
import {SIEGE_ARMIES} from './siegeRoster';
import {ENEMIES} from '../../survival/enemies';
const all:ObjectiveMatch[]=[];afterEach(()=>all.splice(0).forEach(g=>g.dispose()));
const advance=(g:ObjectiveMatch,s:number)=>{for(let i=0;i<Math.ceil(s*60);i++)g.step();};
const p=(g:ObjectiveMatch,id='h0')=>g.sim.actors.get(id)!.state;
function blood(){const g=new ObjectiveMatch('bad-blood');all.push(g);for(let i=0;i<3;i++){g.add('h'+i,['goku','naruto','luffy'][i] as 'goku','Hero','heroes');g.add('v'+i,'dio','Villain','villains');}g.start();advance(g,3.1);return g;}
function stand(count=2){const g=new ObjectiveMatch('last-stand',undefined,3,'host');all.push(g);for(let i=0;i<count;i++)g.add('h'+i,'goku','Defender');g.start();advance(g,3.1);return g;}
const kill=(g:ObjectiveMatch,id:string)=>g.sim.damage(id,999999,'test','test');
describe('Bad Blood',()=>{
 it('enforces the owner-approved factions and 3v3 capacity',()=>{const g=new ObjectiveMatch('bad-blood');all.push(g);expect(VILLAINS).toContain('jiren');expect(factionOf('itachi')).toBe('heroes');expect(()=>g.add('bad','goku','Bad','villains')).toThrow('belongs');for(let i=0;i<3;i++)g.add('h'+i,'goku','Hero');expect(()=>g.add('h3','naruto','Fourth')).toThrow('full');g.start();expect([...g.seats.values()].filter(s=>s.team==='villains')).toHaveLength(3);expect([...g.seats.values()].every(s=>factionOf(s.fighter)===s.team)).toBe(true);});
 it('scales villain health, real stamina capacity, movement and recovery only in this mode',()=>{const g=blood();expect(p(g,'v0').maxHp).toBe(1950);expect(p(g,'v0').maxStamina).toBe(292.5);expect(p(g,'v0').stamina).toBe(292.5);expect(p(g,'h0').maxStamina).toBe(225);expect(g.sim.mods('v0')).toMatchObject({damageOut:1.3,speed:1.3,cooldown:1/1.3,staminaRecovery:1.3,meterGain:1.3,awakenGain:1.3});expect(p(g).maxHp).toBe(1500);expect(p(g).maxStamina).toBe(225);p(g,'v0').stamina=285;advance(g,1);expect(p(g,'v0').stamina).toBe(292.5);});
 it('automatically revives a Hero once at three seconds, never earlier or a second time',()=>{const g=blood();kill(g,'h0');g.step();const at=g.seats.get('h0')!.reviveAt!;expect(at-g.sim.serverTime).toBeCloseTo(3);advance(g,2.8);expect(p(g).alive).toBe(false);while(g.sim.serverTime<at+.01)g.step();expect(p(g).alive).toBe(true);expect(p(g).hp).toBe(1500);advance(g,2.1);kill(g,'h0');advance(g,6);expect(p(g).alive).toBe(false);expect(g.seats.get('h0')!.reviveAt).toBeUndefined();});
 it('ends on a simultaneous Hero wipe before pending revivals can fire',()=>{const g=blood();kill(g,'h0');g.step();advance(g,1);kill(g,'h1');kill(g,'h2');g.step();expect(g.view.winner).toBe('villains');advance(g,10);expect(p(g).alive).toBe(false);});
 it('gives Villains no revival and declares a Hero win on their wipe',()=>{const g=blood();kill(g,'v0');advance(g,6);expect(p(g,'v0').alive).toBe(false);kill(g,'v1');kill(g,'v2');g.step();expect(g.view.winner).toBe('heroes');});
 it('prevents ordinary friendly fire and ignores forged scores',()=>{const g=blood();g.sim.strike('h0','h1','heavy',MOVES.goku.heavy);expect(p(g,'h1').hp).toBe(1500);expect(g.submit('h0',{seq:1,moveX:NaN,moveZ:0,yaw:0})).toBe(false);expect(g.submit('h0',{seq:1,moveX:0,moveZ:0,yaw:0,win:true})).toBe(true);g.step();expect(g.view.phase).toBe('active');});
});
describe('Last Stand',()=>{
 it('supports genuine solo, current friend squad and optional four-player bot fill',()=>{const solo=stand(1);expect(solo.seats.size).toBe(1);const bots=new ObjectiveMatch('last-stand',undefined,1,'bots');all.push(bots);bots.add('me','naruto','Me');bots.start();expect(bots.seats.size).toBe(4);expect([...bots.seats.values()].every(s=>s.team==='defenders')).toBe(true);});
 it('never auto-respawns, revives by standing nearby and credits helpers',()=>{const g=stand();g.sim.place('h1',{x:20,y:0,z:14});kill(g,'h0');advance(g,6);expect(p(g).alive).toBe(false);g.sim.place('h1',{x:p(g).x+1,y:0,z:p(g).z});advance(g,4.1);expect(p(g).alive).toBe(true);expect(p(g).hp).toBe(350);expect(g.snapshot().objective.seats.find(s=>s.id==='h1')?.revives).toBe(1);});
 it('loses when the entire squad falls or the village reaches zero',()=>{const g=stand();kill(g,'h0');kill(g,'h1');g.step();expect(g.view.winner).toBe('horde');const village=stand();for(const s of village.siege!.view.structures)kill(village,s.id);village.step();expect(village.view.reason).toContain('Village');});
 it('validates shop distance, living players, shared balance and upgrade caps',()=>{const g=stand();g.siege!.view.points=1000;expect(g.buy('h0','walls')).toContain('Visit');g.sim.place('h0',{...VILLAGE.shop,y:0});g.sim.place('h1',{...VILLAGE.shop,y:0});expect(g.buy('h0','walls')).toBeUndefined();expect(g.siege!.view.points).toBe(350);expect(g.siege!.view.maxHp).toBe(15000);expect(g.buy('h1','walls')).toContain('points');expect(g.buy('h0','godmode')).toContain('Choose');kill(g,'h0');g.step();expect(g.buy('h0','repair')).toContain('standing');expect(g.snapshot().objective.seats.find(s=>s.id==='h0')?.spent).toBe(650);});
 it('spawns Survival enemy kits, gives shared kill points once and advances waves',()=>{const g=stand();advance(g,13);const enemies=g.sim.playerStates().filter(p=>p.team==='horde');expect(enemies.length).toBeGreaterThan(0);for(const e of enemies)g.sim.damage(e.id,99999,'h0','test');g.step();expect(g.siege!.view.points).toBeGreaterThan(0);const points=g.siege!.view.points;g.step();expect(g.siege!.view.points).toBe(points);expect(g.snapshot().objective.seats.find(s=>s.id==='h0')!.points).toBe(points);});
 it('keeps a departed player body and transfers host without a free heal',()=>{const g=stand();p(g).hp=123;g.remove('h0');expect(p(g).hp).toBe(123);expect(g.seats.get('h0')!.bot).toBe(true);expect(g.view.hostId).toBe('h1');});
 it('uses traversable village spawn and shop geometry',async()=>{const collision=await createRapierCollision('hidden-leaf');try{for(const at of [{x:0,y:0,z:16},{x:0,y:0,z:20},{x:-11,y:0,z:24}])expect(collision.penetration(at)).toBeLessThan(.03);}finally{collision.dispose?.();}});
});

describe('mode integration invariants',()=>{
 it('reacts to visible boss warnings after a readable delay and resumes the fight once they expire',()=>{
  const g=stand(),me={...p(g),x:0,z:0},foe={...me,id:'foe',team:'horde',x:10,z:0},view=g.snapshot().objective;
  view.village!.warnings=[{id:1,at:10,kind:'hazard',enemy:'kizaru',actor:'foe',text:'light',x:1,y:0,z:0,radius:2,value:10.7}];
  const brain=new ObjectiveBrain(me.id);
  expect(brain.command([me,foe],view,10).moveX).toBeGreaterThan(0);
  expect(brain.command([me,foe],view,10.3).moveX).toBeLessThan(0);
  expect(brain.command([me,foe],view,10.8).moveX).toBeGreaterThan(0);
 });
 it('uses complete, renderable Survival armies with ranged and heavy roles',()=>{
  for(const army of SIEGE_ARMIES)for(const [role,key] of [['fodder','fodder'],['gunner','gunner'],['brute','brute']] as const){
   const def=ENEMIES[army[key]];expect(def.role).toBe(role);expect(def.model).toMatch(/\.glb$/);expect(def.moves.length).toBeGreaterThan(0);expect(def.clips.idle.length).toBeGreaterThan(0);
  }
 });
 it('helps a threatened teammate and finishes nearby wounded enemies instead of demanding separate duels',()=>{
  const g=blood(),me={...p(g),x:0,z:0},ally={...p(g,'h1'),x:0,z:6,hp:200,target:'v1'},nearest={...p(g,'v0'),x:3,z:0},threat={...p(g,'v1'),x:0,z:8,target:'h1'};
  const view=g.snapshot().objective;
  expect(new ObjectiveBrain(me.id).command([me,ally,nearest,threat],view,10).targetId).toBe('v1');
  ally.hp=1000;threat.target='';threat.hp=150;
  expect(new ObjectiveBrain(me.id).command([me,ally,nearest,threat],view,10).targetId).toBe('v1');
  threat.x=35;expect(new ObjectiveBrain(me.id).command([me,ally,nearest,threat],view,10).targetId).toBe('v0');
 });
 it('commits only the nearest bot to a fallen defender while the other intercepts the raid',()=>{
  const g=stand(3);g.seats.get('h1')!.bot=true;g.seats.get('h2')!.bot=true;kill(g,'h0');g.step();
  const fallen={...p(g),x:0,z:12},near={...p(g,'h1'),x:2,z:12},far={...p(g,'h2'),x:12,z:12},enemy={...p(g,'h2'),id:'raider',team:'horde',x:14,z:12};
  const players=[fallen,near,far,enemy],view=g.snapshot().objective;
  expect(new ObjectiveBrain('h1').command(players,view,10).targetId).toBeUndefined();
  expect(new ObjectiveBrain('h2').command(players,view,10).targetId).toBe('raider');
 });
 it('freezes results time and publishes independent lane counts',()=>{
  const g=stand();const snapshot=g.snapshot();snapshot.objective.village!.lanes[0]=999;expect(g.siege!.view.lanes[0]).not.toBe(999);
  for(const s of g.siege!.view.structures)kill(g,s.id);g.step();const ended=g.view.endsAt;advance(g,5);expect(g.view.endsAt).toBe(ended);
 });
 it('makes bot allies return to enemies threatening the village instead of chasing nearby stragglers',()=>{
  const g=stand();const me={...p(g),x:0,z:-18};const near={...me,id:'near',team:'horde',x:0,z:-20};const gate={...me,id:'gate',team:'horde',x:0,z:20};
  const command=new ObjectiveBrain(me.id).command([me,near,gate],{...g.view,seats:[...g.seats.values()]},g.sim.serverTime);expect(command.targetId).toBe('gate');
 });
 it('applies exactly 1.3x outgoing damage and resting stamina recovery without bonus recovery during guard',()=>{
  const g=blood();g.sim.place('h0',{x:0,y:0,z:0});g.sim.place('v1',{x:0,y:0,z:2});
  g.sim.place('v0',{x:10,y:0,z:0});g.sim.place('h1',{x:10,y:0,z:2});
  const heroHp=p(g,'h1').hp,villainHp=p(g,'v1').hp;
  g.sim.strike('h0','v1','light',MOVES.goku.light);g.sim.strike('v0','h1','light',MOVES.goku.light);
  expect(heroHp-p(g,'h1').hp).toBe(Math.round((villainHp-p(g,'v1').hp)*1.3));
  const a=g.sim.actors.get('v2')!;a.state.stamina=50;advance(g,.5);expect(a.state.stamina).toBeCloseTo(50+STAMINA_REGEN*1.3*.5);
  const stamina=a.state.stamina;for(let i=0;i<30;i++){g.sim.command('v2',{moveX:0,moveZ:0,yaw:0,guard:true});g.step();}expect(a.state.stamina).toBeLessThanOrEqual(stamina);
 });
 it('preannounces boss assets during preparation and cycles through escalating waves',()=>{
  const g=stand();let announced=false,boss=false;
  for(let i=0;i<150*60&&g.siege!.view.wave<4;i++){
    for(const e of g.sim.playerStates().filter(p=>p.team==='horde'&&p.alive)){if(g.siege!.view.boss===e.enemy)boss=true;g.sim.damage(e.id,1e6,'h0','Test clear');}
    g.step();if(g.siege!.view.wave===2&&g.siege!.view.phase==='preparation')announced=!!g.siege!.view.boss&&g.siege!.view.incoming.includes(g.siege!.view.boss!);
  }
  expect(announced).toBe(true);expect(boss).toBe(true);expect(g.siege!.view.wave).toBe(4);expect(g.siege!.view.bosses).toBe(1);
 });
 it('delivers every announced model and lane count across all five armies and six assault formations',()=>{
  const g=stand(),seen=new Set<string>(),waves=new Map<number,{expected:number[];actual:number[];models:Set<string>;total:number}>();
  let prepared=g.snapshot().objective.village!;
  for(let tick=0;tick<1800*60&&g.siege!.view.wave<16;tick++){
   const v=g.siege!.view;
   if(v.phase==='preparation')prepared=g.snapshot().objective.village!;
   if(v.phase==='assault'&&!waves.has(v.wave))waves.set(v.wave,{expected:[...prepared.plan!.lanes],actual:[0,0,0],models:new Set(prepared.incoming),total:prepared.plan!.total});
   for(const enemy of g.sim.playerStates().filter(p=>p.team==='horde'&&p.alive)){
    const wave=waves.get(v.wave)!;
    if(!seen.has(enemy.id)){seen.add(enemy.id);const lane=LANES.map((p,i)=>({i,d:Math.abs(p.x-enemy.x)})).sort((a,b)=>a.d-b.d)[0].i;wave.actual[lane]++;expect(wave.models.has(enemy.enemy!)).toBe(true);}
    g.sim.damage(enemy.id,1e6,'h0','Test clear');
   }
   g.step();
  }
  expect(waves.size).toBe(15);
  for(const wave of waves.values()){expect(wave.actual).toEqual(wave.expected);expect(wave.actual.reduce((n,v)=>n+v,0)).toBe(wave.total);}
  expect(waves.get(2)!.actual[1]).toBe(0);
  expect(waves.get(4)!.actual[2]).toBeGreaterThan(waves.get(4)!.actual[1]*2);
  const snapshot=g.snapshot();snapshot.objective.village!.plan!.lanes[0]=999;expect(g.siege!.view.plan!.lanes[0]).not.toBe(999);
 });
 it('stamps enemy effects with their Survival kit and never a borrowed roster fighter',()=>{
  const g=stand();advance(g,13);const enemy=g.sim.playerStates().find(p=>p.team==='horde')!;
  g.sim.strike(enemy.id,'h0','heavy',MOVES.goku.heavy);g.step();
  const events=g.snapshot().events.filter(e=>e.actorId===enemy.id);expect(events.length).toBeGreaterThan(0);expect(events.every(e=>e.enemy===enemy.enemy&&e.fighter===undefined)).toBe(true);
 });
 it('advances a boss through visible health phases without resetting them or adding health',()=>{
  const g=stand();g.siege!.view.wave=2;g.siege!.view.nextWaveAt=g.sim.serverTime;
  for(let i=0;i<40*60&&!g.siege!.view.bossActor;i++){for(const e of g.sim.playerStates().filter(p=>p.team==='horde'&&p.alive))g.sim.damage(e.id,1e6,'h0','Test clear');g.step();}
  const boss=p(g,g.siege!.view.bossActor!);expect(boss).toBeDefined();boss.hp=boss.maxHp*.64;g.step();
  expect(g.snapshot().objective.village!.bossPhase).toBe(1);const at=g.siege!.view.bossPhaseAt;const hp=boss.hp;
  advance(g,.5);expect(g.siege!.view.bossPhaseAt).toBe(at);expect(boss.hp).toBe(hp);
  boss.hp=boss.maxHp*.29;g.step();expect(g.siege!.view.bossPhase).toBe(2);expect(g.siege!.view.bossPhaseAt).toBeGreaterThan(at!);
  boss.hp=boss.maxHp*.9;g.step();expect(g.siege!.view.bossPhase).toBe(2);
 });
 it('does not permit rooftop revives and routes allies around the solid wall',()=>{
  const g=stand();kill(g,'h0');g.sim.place('h1',{x:p(g).x,y:9,z:p(g).z});g.step();expect(g.seats.get('h0')!.rescue).toBe(0);
  expect(gateWaypoint({x:-20,z:30},{x:-20,z:0})).toEqual({x:0,z:26});expect(gateWaypoint({x:0,z:30},{x:0,z:0})).toBeUndefined();
 });
 it.each([
  [-4.8,15,-11,24], [4.8,15,15,30], [-4.8,26,-20,12],
  [4.8,15,11,24], [-4.8,15,-15,24], [4.8,26,20,12],
  [0,18.5,9.86,18.54], [0,18.5,-9.86,18.54],
  [-11,18.54,11,18.54], [11,18.54,-11,18.54],
  [0,21.5,10,21.5], [-11,21.5,11,21.5],
 ])('completes a diagonal gate rescue with real collision (%s, %s to %s, %s)',async(x,z,targetX,targetZ)=>{
  const g=new ObjectiveMatch('last-stand',await createRapierCollision('hidden-leaf'),1,'host');all.push(g);
  g.add('helper','goku','Helper','defenders');g.add('fallen','naruto','Fallen','defenders');g.start();advance(g,3.2);
  g.siege!.view.nextWaveAt=g.sim.serverTime+60;
  g.sim.place('helper',{x,y:0,z});g.sim.place('fallen',{x:targetX,y:0,z:targetZ});kill(g,'fallen');g.step();
  const brain=new ObjectiveBrain('helper');
  for(let i=0;i<20*60&&!p(g,'fallen').alive;i++){
   g.sim.command('helper',brain.command(g.sim.playerStates(),g.snapshot().objective,g.sim.serverTime));g.step();
  }
  expect(p(g,'fallen').alive).toBe(true);expect(g.seats.get('helper')!.revives).toBe(1);
 });
 it.each([-1,1])('reaches an opponent beside the gate instead of circling through it (%s)',async(side)=>{
  const g=new ObjectiveMatch('last-stand',await createRapierCollision('hidden-leaf'),1,'host');all.push(g);
  g.add('helper','goku','Helper','defenders');g.add('target','naruto','Target','defenders');g.start();advance(g,3.2);
  g.siege!.view.nextWaveAt=g.sim.serverTime+60;
  g.sim.place('helper',{x:0,y:0,z:18.5});g.sim.place('target',{x:side*9.86,y:0,z:18.54});p(g,'target').team='horde';
  const brain=new ObjectiveBrain('helper');
  for(let i=0;i<12*60&&p(g,'target').hp===1000;i++){
   g.sim.command('helper',brain.command(g.sim.playerStates(),g.snapshot().objective,g.sim.serverTime));g.step();
  }
  expect(p(g,'target').hp).toBeLessThan(1000);
 });
});
