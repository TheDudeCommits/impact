import {ObjectiveMatch} from './ObjectiveMatch';
import {ENEMIES} from '../../survival/enemies';
import {expect,it} from 'vitest';
import {challengeFor,SiegeChallenges} from './siegeChallenges';
import {assaultPlan} from './assaultPlan';
it('seeds varied goals and matching side objectives without changing milestone waves',()=>{
 expect(challengeFor(2,3,30,2).kind).toBe('rescue');expect(challengeFor(4,3,30,2).kind).toBe('supplies');
 expect(new Set([1,2,3,4,5,6].map(seed=>challengeFor(3,seed,30,3).kind)).size).toBe(3);
 expect(challengeFor(3,8,30,3)).toEqual(challengeFor(3,8,30,3));expect(challengeFor(500,8,120,12).reward).toBeLessThanOrEqual(800);
 expect(new Set(Array.from({length:40},(_,i)=>assaultPlan(i+7,4711).title)).size).toBeGreaterThan(6);
 for(let w=1;w<=6;w++)expect(assaultPlan(w,4711)).toEqual(assaultPlan(w));
});
it('pays once only after a completed wave and counts actual village damage without repair exploits',()=>{
 const c=new SiegeChallenges();const goal={...challengeFor(1,3,30,3),kind:'bulwark' as const,target:600};c.start(goal,1);c.damage(590);expect(c.view!.state).toBe('active');expect(c.finish(60)).toBe(goal.reward);expect(c.finish(61)).toBe(0);
 c.start(goal,70);c.damage(601);c.damage(-1000);c.tick(71);expect(c.view!.state).toBe('missed');expect(c.finish(80)).toBe(0);
});
it('keeps failure optional and fences timed, specialist and emergency completion',()=>{
 const c=new SiegeChallenges();const goal=challengeFor(1,3,30,3);c.start({...goal,kind:'swift',target:10},20);expect(c.finish(30)).toBe(goal.reward);c.start({...goal,kind:'swift',target:10},40);expect(c.finish(50.01)).toBe(0);
 c.start({...goal,kind:'leaders',target:2},0);c.leader(10);expect(c.finish(20)).toBe(0);c.start({...goal,kind:'leaders',target:2},0);c.leader(10);c.leader(10);c.leader(10);expect(c.view!.current).toBe(2);expect(c.finish(20)).toBe(goal.reward);
 c.start({...goal,kind:'leaders',target:2},0);c.leader(89);c.leader(90.01);expect(c.finish(100)).toBe(0);
 c.start({...goal,kind:'leaders',target:2},0);c.leader(90);c.leader(90);expect(c.finish(180)).toBe(goal.reward);
 c.start(challengeFor(2,3,30,3),0);c.emergency('supplies');expect(c.view!.current).toBe(0);c.emergency('rescue');expect(c.finish(20)).toBe(c.view!.reward);
});

it('announces a goal, awards completion once and isolates snapshots in an actual match',()=>{
 const g=new ObjectiveMatch('last-stand',undefined,3,'solo');
 try {
  g.add('me','goku','Me');g.start();expect(g.siege!.view.nextChallenge?.wave).toBe(1);
  let earned=0;
  for(let i=0;i<90*60;i++){
   for(const p of g.sim.playerStates())if(p.team==='horde'&&p.alive){earned+=ENEMIES[p.enemy!]!.role==='brute'?50:25;g.sim.damage(p.id,1e6,'me','Test strike');}
   g.step();if(g.siege!.view.wave===1&&g.siege!.view.phase==='preparation')break;
  }
  const city=g.siege!.view;expect(city.phase).toBe('preparation');expect(city.challenge?.state).toBe('secured');expect(city.points).toBe(earned+city.challenge!.reward);
  const snapshot=g.snapshot().objective.village!;snapshot.challenge!.reward=100000;snapshot.nextChallenge!.target=9999;
  expect(city.challenge!.reward).toBeLessThan(100000);expect(city.nextChallenge!.target).not.toBe(9999);
  const before=city.points;g.step();expect(city.points).toBe(before);
 }finally{g.dispose();}
});

it('lets a cleared wave secure its side objective during regroup without postponing the next assault',()=>{
 const g=new ObjectiveMatch('last-stand',undefined,3,'solo');
 try {
  g.add('me','goku','Me');g.start();
  for(let i=0;i<90*60;i++){
   for(const p of g.sim.playerStates())if(p.team==='horde'&&p.alive)g.sim.damage(p.id,1e6,'me','Test strike');
   g.step();if(g.siege!.view.wave===2&&g.siege!.view.phase==='preparation')break;
  }
  const city=g.siege!.view,event=city.emergency!,goal=city.challenge!,starts=city.nextWaveAt,before=city.points;
  expect(city.wave).toBe(2);expect(event.phase).toBe('active');expect(goal.state).toBe('active');
  expect(goal.endsAt).toBe(starts);expect(event.endsAt).toBe(starts);
  g.sim.place('me',{x:event.x,y:0,z:event.z});
  for(let i=0;i<4.3*60;i++)g.step();
  expect(city.phase).toBe('preparation');expect(event.phase).toBe('secured');expect(goal.state).toBe('secured');
  expect(city.points).toBe(before+event.reward+goal.reward);expect(g.siege!.contributions.get('me')!.rescues).toBe(1);
  const paid=city.points;
  for(let i=0;i<2*60;i++)g.step();
  expect(city.wave).toBe(3);expect(city.points).toBe(paid);expect(city.nextWaveAt).toBe(starts);
 }finally{g.dispose();}
});

it('closes ignored objectives at the next assault so a fast clear cannot hide the following convoy',()=>{
 const g=new ObjectiveMatch('last-stand',undefined,3,'solo');
 try {
  g.add('me','goku','Me');g.start();
  let rescue:ReturnType<typeof challengeFor>|undefined;
  for(let i=0;i<100*60;i++){
   for(const p of g.sim.playerStates())if(p.team==='horde'&&p.alive)g.sim.damage(p.id,1e6,'me','Test strike');
   g.step();if(g.siege!.view.wave===2)rescue=g.siege!.view.challenge;
   if(g.siege!.view.wave===4)break;
  }
  expect(rescue?.state).toBe('missed');expect(g.siege!.view.wave).toBe(4);
  expect(g.siege!.view.emergency).toMatchObject({id:4,kind:'supplies',phase:'active'});
  expect(g.siege!.view.challenge).toMatchObject({wave:4,kind:'supplies',state:'active',current:0});
 }finally{g.dispose();}
});
