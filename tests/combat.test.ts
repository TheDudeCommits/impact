import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { CHASE_SECONDS, MOVES } from '../src/game/moves';
import type { AttackSlot, FighterId, PlayerInput } from '../src/game/types';
import { METEOR_COMBINATION, withMove } from './retiredMoves';

function bout(fighter:FighterId,gap=1.6){
  const sim=new ArenaSimulation({trainingBot:false});
  sim.addPlayer('a',fighter,'A',false,{x:0,y:0,z:0});
  sim.addPlayer('b','goku','B',false,{x:0,y:0,z:gap});
  let seq=0;
  const input=(id:string,more:Partial<PlayerInput>)=>sim.submitInput(id,{seq:seq++,moveX:0,moveZ:0,yaw:0,...more});
  const step=(seconds:number)=>{for(let i=0;i<Math.round(seconds*60);i++)sim.step();};
  return {sim,input,step};
}

describe('combo and cancel rules', () => {
  it('cancels a landed light into a heavy before the light would finish', () => {
    const {sim,input,step}=bout('zoro');
    const light=MOVES.zoro.light;
    input('a',{attack:'light',targetId:'b'});
    step(light.contacts[0]+.06);
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);
    input('a',{attack:'heavy',targetId:'b'});
    step(.05);
    expect(sim.getPlayer('a')!.action).toBe('heavy');
  });

  it('keeps a whiffed light fully committed', () => {
    const {sim,input,step}=bout('zoro',14);
    input('a',{attack:'light',targetId:'b'});
    step(MOVES.zoro.light.contacts[0]+.06);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
    input('a',{attack:'heavy',targetId:'b'});
    sim.step();
    expect(sim.getPlayer('a')!.action).toBe('light');
  });

  it('lets a landed heavy carry on into anything', () => {
    withMove('goku','heavy',METEOR_COMBINATION,()=>{
    const {sim,input,step}=bout('goku');
    input('a',{attack:'heavy',targetId:'b'});
    step(MOVES.goku.heavy.contacts[0]+.06);
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);
    input('a',{attack:'light',targetId:'b'});
    step(.12);
    expect(sim.getPlayer('a')!.action).toBe('light');
    });
    const launch=bout('zoro');
    launch.input('a',{attack:'heavy',targetId:'b'});
    launch.step(MOVES.zoro.heavy.contacts[0]+.06);
    expect(launch.sim.getPlayer('b')!.action).toBe('launched');
    launch.input('a',{attack:'light',targetId:'b'});
    launch.step(.12);
    expect(launch.sim.getPlayer('a')!.action).toBe('dash');
    launch.step(CHASE_SECONDS);
    expect(launch.sim.getPlayer('a')!.action).toBe('light');
    expect(launch.sim.getPlayer('a')!.grounded).toBe(false);
  });

  it('gives a whiffed heavy nothing at all', () => {
    const {sim,input,step}=bout('zoro',14);
    input('a',{attack:'heavy',targetId:'b'});
    step(MOVES.zoro.heavy.contacts[0]+.06);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
    input('a',{attack:'light',targetId:'b'});
    step(.12);
    expect(sim.getPlayer('a')!.action).toBe('heavy');
  });

  it('gives movement back during recovery instead of freezing the whole move', () => {
    const {sim,input,step}=bout('zoro');
    const heavy=MOVES.zoro.heavy;
    input('a',{attack:'heavy',targetId:'b'});
    step(heavy.contacts[heavy.contacts.length-1]+.12);
    const before=sim.getPlayer('a')!.x;
    input('a',{moveX:1});
    step(.25);
    expect(Math.abs(sim.getPlayer('a')!.x-before)).toBeGreaterThan(.2);
  });

  it('steps a melee attacker into the strike even with no authored lunge', () => {
    expect(MOVES.luffy.light.lunge).toBeUndefined();
    const {sim,input,step}=bout('luffy',3.2);
    const before=sim.getPlayer('a')!.z;
    input('a',{attack:'light',targetId:'b'});
    step(MOVES.luffy.light.contacts[0]);
    expect(sim.getPlayer('a')!.z).toBeGreaterThan(before+.1);
  });

  it('still refuses a chain the route does not allow', () => {
    const {sim,input,step}=bout('zoro');
    sim.actors.get('a')!.state.ultimate=100;
    input('a',{attack:'ultimate',targetId:'b'});
    const ultimate=MOVES.zoro.ultimate;
    step(ultimate.contacts[0]+.06);
    for(const slot of ['light','heavy','special'] as AttackSlot[]){
      input('a',{attack:slot,targetId:'b'});
      sim.step();
      expect(sim.getPlayer('a')!.action).toBe('ultimate');
    }
  });
});

describe('impact and reactions', () => {
  it('freezes both fighters on contact and resumes them together', () => {
    const {sim,input,step}=bout('zoro');
    input('a',{attack:'light',targetId:'b'});
    step(MOVES.zoro.light.contacts[0]+.04);
    const attacker=sim.getPlayer('a')!,victim=sim.getPlayer('b')!;
    expect(victim.hp).toBeLessThan(1000);
    expect(attacker.hitstop).toBe(true);
    expect(victim.hitstop).toBe(true);
    const frozen={a:attacker.actionTime,az:attacker.z,bz:victim.z};
    sim.step();
    expect(sim.getPlayer('a')!.actionTime).toBe(frozen.a);
    expect(sim.getPlayer('a')!.z).toBe(frozen.az);
    expect(sim.getPlayer('b')!.z).toBe(frozen.bz);
    step(.2);
    expect(sim.getPlayer('a')!.hitstop).toBe(false);
    expect(sim.getPlayer('a')!.actionTime).toBeGreaterThan(frozen.a);
  });

  it('answers a jab, a heavy and a broken guard with different reactions', () => {
    const jab=bout('naruto');
    jab.input('a',{attack:'light',targetId:'b'});
    jab.step(MOVES.naruto.light.contacts[0]+.06);
    expect(jab.sim.getPlayer('b')!.action).toBe('flinch');

    const launch=bout('zoro');
    launch.input('a',{attack:'heavy',targetId:'b'});
    launch.step(MOVES.zoro.heavy.contacts[0]+.2);
    expect(launch.sim.getPlayer('b')!.action).toBe('launched');
    expect(launch.sim.getPlayer('b')!.grounded).toBe(false);

    const broken=bout('zoro');
    const guard=(fight:ReturnType<typeof bout>,seconds:number)=>{
      for(let frame=0;frame<Math.round(seconds*60);frame++){
        if(frame%12===0)fight.input('b',{guard:true,yaw:Math.PI});
        fight.sim.step();
      }
    };
    broken.input('a',{attack:'heavy',targetId:'b'});
    guard(broken,MOVES.zoro.heavy.contacts[0]+.2);
    expect(broken.sim.getPlayer('b')!.action).toBe('guard');
  });

  it('carries a launch through landing, knockdown and getting up', () => {
    const {sim,input,step}=bout('zoro');
    input('a',{attack:'heavy',targetId:'b'});
    const seen:string[]=[];
    for(let frame=0;frame<210;frame++){
      const victim=sim.getPlayer('b')!;
      if(seen[seen.length-1]!==victim.action)seen.push(victim.action);
      sim.step();
    }
    const order=seen.filter(a=>['launched','knockdown','getup','idle'].includes(a));
    expect(order.indexOf('launched')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('knockdown')).toBeGreaterThan(order.indexOf('launched'));
    expect(order.indexOf('getup')).toBeGreaterThan(order.indexOf('knockdown'));
    const rising=sim.actors.get('b')!;
    expect(sim.getPlayer('b')!.action).toBe('idle');
    step(.1);
    expect(rising.state.alive).toBe(true);
  });

  it('lets a launched fighter recover in the air instead of eating the knockdown', () => {
    const teched=bout('zoro'),dropped=bout('zoro');
    for(const bout_ of [teched,dropped]){
      bout_.input('a',{attack:'heavy',targetId:'b'});
      bout_.step(MOVES.zoro.heavy.contacts[0]+.3);
      expect(bout_.sim.getPlayer('b')!.action).toBe('launched');
    }
    teched.input('b',{dash:true});
    teched.step(.05);
    expect(teched.sim.snapshot().events.some(e=>e.kind==='tech'&&e.actorId==='b')).toBe(true);
    expect(teched.sim.getPlayer('b')!.stamina).toBeLessThan(dropped.sim.getPlayer('b')!.stamina);
    teched.step(.9);dropped.step(.9);
    expect(teched.sim.getPlayer('b')!.action).toBe('idle');
    expect(['knockdown','getup']).toContain(dropped.sim.getPlayer('b')!.action);
  });

  it('scales damage down across a string and counts the combo', () => {
    const {sim,input,step}=bout('naruto');
    input('a',{attack:'light',targetId:'b'});
    step(1.4);
    const hits=sim.snapshot().events.filter(e=>e.kind==='hit'&&e.actorId==='a');
    expect(hits).toHaveLength(3);
    expect(hits[1].damage!).toBeLessThan(hits[0].damage!);
    expect(hits[2].damage!).toBeLessThan(hits[1].damage!);
    expect(hits.map(e=>e.combo)).toEqual([1,2,3]);
    expect(sim.getPlayer('a')!.combo).toBe(3);
    step(2);
    expect(sim.getPlayer('a')!.combo).toBe(0);
  });
});

describe('attack armour', () => {
  const casting=(fighter:FighterId,slot:AttackSlot)=>{
    const {sim,input,step}=bout(fighter,2.2);
    sim.actors.get('b')!.state.ultimate=100;
    input('b',{attack:slot,yaw:0});
    step(.1);
    expect(sim.getPlayer('b')!.action).toBe(slot);
    return {sim,input,step};
  };
  const interrupt=(fighter:FighterId,committed:AttackSlot,incoming:AttackSlot)=>{
    const {sim,input,step}=casting(fighter,committed);
    sim.actors.get('a')!.state.ultimate=100;
    input('a',{attack:incoming,targetId:'b'});
    step(MOVES.zoro[incoming].contacts[0]+.35);
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);
    return sim.getPlayer('b')!.action===committed;
  };

  it('never lets a light or a heavy break a committed move', () => {
    expect(interrupt('zoro','special','light')).toBe(true);
    expect(interrupt('zoro','special','heavy')).toBe(true);
  });

  it('lets a special break anything except an ultimate', () => {
    expect(interrupt('zoro','heavy','special')).toBe(false);
    expect(interrupt('zoro','special','special')).toBe(false);
    expect(interrupt('zoro','ultimate','special')).toBe(true);
  });

  it('only lets an ultimate interrupt an ultimate', () => {
    expect(interrupt('zoro','ultimate','ultimate')).toBe(false);
  });
});

describe('air combat', () => {
  const lift=(sim:ArenaSimulation,id:string,y:number)=>{
    const actor=sim.actors.get(id)!;
    actor.state.y=y; actor.state.grounded=false; actor.vy=0;
  };
  const juggleHit=(bout_:ReturnType<typeof bout>,y=6)=>{
    const {sim,input}=bout_;
    sim.actors.get('a')!.state.cooldowns.light=0;
    lift(sim,'a',y); lift(sim,'b',y);
    const before=sim.getPlayer('b')!.hp;
    input('a',{attack:'light',targetId:'b'});
    for(let frame=0;frame<90;frame++){
      sim.step();
      if(sim.getPlayer('b')!.hp!==before)return sim.actors.get('b')!.vy;
      lift(sim,'a',y); lift(sim,'b',y);
    }
    return 0;
  };

  it('lifts an airborne target again on every hit, by less each time', () => {
    const arena=bout('zoro');
    const lifts=[juggleHit(arena),juggleHit(arena),juggleHit(arena),juggleHit(arena)];
    expect(lifts[0]).toBeGreaterThan(0);
    for(let i=1;i<lifts.length;i++)expect(lifts[i]).toBeLessThan(lifts[i-1]);
    expect(arena.sim.actors.get('b')!.juggleHits).toBe(4);
    expect(juggleHit(arena)).toBe(0);
  });

  it('gives back the floor once a juggled fighter lands', () => {
    const arena=bout('zoro');
    expect(juggleHit(arena)).toBeGreaterThan(0);
    expect(arena.sim.actors.get('b')!.juggleHits).toBe(1);
    arena.step(3);
    expect(arena.sim.getPlayer('b')!.grounded).toBe(true);
    expect(arena.sim.actors.get('b')!.juggleHits).toBe(0);
  });

  it('aims an air dash at the locked opponent so a launch can be chased', () => {
    const chase=bout('zoro'),straight=bout('zoro');
    for(const [arena,locked] of [[chase,true],[straight,false]] as const){
      arena.step(.5);
      lift(arena.sim,'a',1);
      Object.assign(arena.sim.actors.get('b')!.state,{y:6,grounded:false,z:5});
      arena.input('a',{dash:true,targetId:locked?'b':null});
      arena.step(.22);
    }
    expect(chase.sim.getPlayer('a')!.y).toBeGreaterThan(3);
    expect(straight.sim.getPlayer('a')!.y).toBeLessThan(chase.sim.getPlayer('a')!.y);
  });

  it('holds a move that started in the air up long enough to finish it', () => {
    const casting=bout('zoro'),falling=bout('zoro');
    for(const arena of [casting,falling])lift(arena.sim,'a',6);
    casting.input('a',{attack:'light',targetId:'b'});
    casting.step(.4); falling.step(.4);
    expect(casting.sim.getPlayer('a')!.y).toBeGreaterThan(falling.sim.getPlayer('a')!.y+.5);
    expect(casting.sim.getPlayer('a')!.action).toBe('light');
  });
});

describe('input buffering', () => {
  it('fires a jump pressed during a move as soon as the move allows it', () => {
    const chasing=bout('zoro'),still=bout('zoro');
    for(const arena of [chasing,still]){
      arena.input('a',{attack:'heavy',targetId:'b'});
      arena.step(MOVES.zoro.heavy.contacts[0]+.05);
    }
    chasing.input('a',{jump:true,jumpHeld:true});
    chasing.step(.02);
    expect(chasing.sim.getPlayer('a')!.grounded).toBe(true);
    chasing.step(.5); still.step(.52);
    expect(chasing.sim.getPlayer('a')!.y).toBeGreaterThan(.5);
    expect(still.sim.getPlayer('a')!.grounded).toBe(true);
  });

  it('keeps a follow-up press alive until the running move can take it', () => {
    const roster:FighterId[]=['zoro','jotaro','ichigo','kakashi','sasuke','sanji','vegeta','goku','luffy','naruto','killua','dio','ace','law','gojo','guts'];
    for(const fighter of roster)for(const delay of [.05,.2,.5,.91]){
      const {sim,input,step}=bout(fighter);
      input('a',{attack:'light',targetId:'b'});
      step(delay);
      input('a',{attack:'light',targetId:'b'});
      const light=MOVES[fighter].light;
      step(light.duration+light.cooldown);
      const casts=sim.snapshot(true).events.filter(e=>e.kind==='cast'&&e.actorId==='a');
      expect(casts.length,`${fighter} at ${delay}s`).toBe(2);
    }
  });

  it('announces a cooldown once however long the press waits on it', () => {
    const {sim,input,step}=bout('zoro');
    sim.actors.get('a')!.state.ultimate=100;
    input('a',{attack:'ultimate',targetId:'b'});
    step(MOVES.zoro.ultimate.contacts.at(-1)!+.5);
    input('a',{attack:'ultimate',targetId:'b'});
    step(MOVES.zoro.ultimate.duration+.4);
    const refusals=sim.snapshot(true).events.filter(e=>e.kind==='rejected'&&e.actorId==='a');
    expect(refusals).toHaveLength(1);
    expect(refusals[0].reason).toBe('cooldown');
  });

  it('drops a queued swing when the player dashes away from it', () => {
    const {sim,input,step}=bout('zoro');
    input('a',{attack:'light',targetId:'b'});
    step(MOVES.zoro.light.contacts[0]-.06);
    input('a',{attack:'light',targetId:'b'});
    step(.05);
    input('a',{dash:true});
    step(MOVES.zoro.light.duration+MOVES.zoro.light.cooldown);
    const casts=sim.snapshot(true).events.filter(e=>e.kind==='cast'&&e.actorId==='a');
    expect(casts,'a change of mind is not a swing a second later').toHaveLength(1);
  });

  it('spends a refused attack instead of retrying it into a stream of notices', () => {
    const {sim,input,step}=bout('zoro');
    input('a',{attack:'ultimate',targetId:'b'});
    step(.3);
    const refusals=sim.snapshot().events.filter(e=>e.kind==='rejected'&&e.actorId==='a');
    expect(refusals).toHaveLength(1);
    expect(refusals[0].reason).toBe('ultimate-meter');
  });
});

describe('air dash reach', () => {
  it('stops beside a close target instead of flying past it', () => {
    const {sim,input,step}=bout('zoro');
    step(.5);
    Object.assign(sim.actors.get('a')!.state,{y:1,grounded:false});
    Object.assign(sim.actors.get('b')!.state,{y:2.4,z:1.2,grounded:false});
    input('a',{dash:true,targetId:'b'});
    step(.22);
    const chaser=sim.getPlayer('a')!,target=sim.getPlayer('b')!;
    expect(Math.hypot(chaser.x-target.x,chaser.y-target.y,chaser.z-target.z)).toBeLessThan(1.8);
  });
});

describe('dash cancel', () => {
  it('lets an attack come straight out of a dash', () => {
    const {sim,input,step}=bout('zoro');
    step(.5);
    input('a',{dash:true});
    step(.05);
    expect(sim.getPlayer('a')!.action).toBe('dash');
    input('a',{attack:'light',targetId:'b'});
    step(.05);
    expect(sim.getPlayer('a')!.action).toBe('light');
  });

  it('will not let a dash erase the recovery of a move that hit nothing', () => {
    const swing = (dash: boolean) => {
      const sim = new ArenaSimulation({ trainingBot: false });
      sim.addPlayer('a', 'zoro', 'A', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: 40 });
      let seq = 0;
      sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, attack: 'heavy' });
      const heavy = MOVES.zoro.heavy;
      const after = Math.round(heavy.contacts[heavy.contacts.length - 1] * 60) + 4;
      for (let i = 0; i < 400; i++) {
        const press: Record<string, unknown> = { seq: seq++, moveX: 0, moveZ: 0, yaw: 0 };
        if (dash && i === after) press.dash = true;
        if (i > after) press.attack = 'light';
        sim.submitInput('a', press as never);
        sim.step();
        for (const e of sim.snapshot(true).events)
          if (e.kind === 'cast' && e.actorId === 'a' && e.slot === 'light') { sim.dispose(); return i; }
      }
      sim.dispose();
      return -1;
    };
    const waited = swing(false), dashed = swing(true);
    expect(waited, 'the whiff has a recovery at all').toBeGreaterThan(40);
    expect(dashed, `dashing cut the whiff recovery from ${waited} frames to ${dashed}`).toBeGreaterThanOrEqual(waited);
  });

  it('still refuses an attack while stunned', () => {
    const {sim,input,step}=bout('zoro');
    input('b',{attack:'heavy',targetId:'a',yaw:Math.PI});
    const string=MOVES.goku.heavy;
    step(string.contacts[string.contacts.length-1]+.1);
    expect(sim.getPlayer('a')!.action).toBe('launched');
    input('a',{attack:'light',targetId:'b'});
    step(.05);
    expect(sim.getPlayer('a')!.action).toBe('launched');
  });
});
