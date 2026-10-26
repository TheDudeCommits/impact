import { isReleasedFighter } from '../rosterAvailability';
import {tidyName} from '../displayName';
import {defenderOrders,type DefenderOrder} from './defenderOrders';
import {Teamwork} from './teamwork';
import {defaultRules,type CustomRules} from '../social/custom';
import {ArenaSimulation} from '../simulation';
import {COMBO_HP,COMBO_STAMINA,MOVES} from '../moves';
import {HELD} from '../economy/fighters';
import type {CollisionWorld,CombatEvent,FighterId,Vec3} from '../types';
import {ObjectiveBrain} from './ObjectiveBrain';
import {LastStand} from './lastStand';
import {villageCollision} from './villageStructures';
import {CAPACITY,OBJECTIVE_STAGE,RULES,factionOf,isBadBloodFighter,type ObjectiveAccess,type ObjectiveKind,type ObjectiveSeat,type ObjectiveSnapshot,type ObjectiveTeam,type ObjectiveView,type RolePreference} from './model';
const POOL=(Object.keys(MOVES) as FighterId[]).filter(f=>isReleasedFighter(f)&&!HELD.has(f));
export class ObjectiveMatch {
  readonly sim:ArenaSimulation;
  readonly seats=new Map<string,ObjectiveSeat>();
  readonly siege?:LastStand;
  private brains=new Map<string,ObjectiveBrain>();
  private events:CombatEvent[]=[];
  private deaths=new Set<string>();
  private teamwork=new Teamwork();
  private orders=new Map<string,DefenderOrder>();private ordersAt=-Infinity;
  readonly view:ObjectiveView;
  constructor(readonly kind:ObjectiveKind,collision?:CollisionWorld,seed=1,access:ObjectiveAccess='host',round=1,readonly rules:CustomRules=defaultRules(kind)){
    this.sim=new ArenaSimulation({roomMode:'training',trainingBot:false,respawn:false,stage:OBJECTIVE_STAGE[kind],collision:kind==='last-stand'?villageCollision(collision):collision,seed,capacity:kind==='last-stand'?64:6,
      maxStamina:kind==='bad-blood'?COMBO_STAMINA:undefined,maxHp:kind==='bad-blood'?COMBO_HP:undefined});
    this.sim.status='waiting';
    this.view={kind,phase:'lobby',round,access,hostId:null,seats:[],capacity:CAPACITY[kind],startsAt:null,startedAt:0,endsAt:0,winner:null,reason:'',fillBots:access!=='solo'&&access!=='host'};
    if(kind==='last-stand'){this.siege=new LastStand(this.sim,()=>[...this.seats.keys()].map(id=>this.sim.actors.get(id)!.state),seed);this.view.village=this.siege.view;}
  }
  private count(team:ObjectiveTeam){return [...this.seats.values()].filter(s=>s.team===team).length;}
  add(id:string,fighter:FighterId,name:string,preference:RolePreference='auto',bot=false){
    if(!isReleasedFighter(fighter))throw new Error('This fighter is not available.');
    if(this.view.phase!=='lobby'||this.seats.has(id)||this.seats.size>=CAPACITY[this.kind])throw new Error('This match has already started or is full.');
    if(this.kind==='bad-blood'&&!isBadBloodFighter(fighter))throw new Error('Choose a fighter from the Bad Blood roster.');
    const team:ObjectiveTeam=this.kind==='last-stand'?'defenders':factionOf(fighter);
    if(this.kind==='bad-blood'&&preference!=='auto'&&preference!==team)throw new Error(`This fighter belongs to the ${team}. Choose a fighter from your team.`);
    if(this.kind==='bad-blood'&&this.count(team)>=3)throw new Error(`The ${team} team is full. Choose a fighter from the other side.`);
    const seat:ObjectiveSeat={id,fighter,name:tidyName(name,18),team,bot,points:0,spent:0,repairs:0,revives:0,bosses:0,revivesLeft:team==='heroes'?1:0,rescue:0,down:false};
    this.seats.set(id,seat);this.sim.addPlayer(id,fighter,seat.name,bot,this.spawn(seat));this.sim.setTeam(id,team);this.siege?.register(id);
    if(team==='villains'){
      const boost=RULES.villainMultiplier,state=this.sim.actors.get(id)!.state;
      this.sim.setMaxHp(id,COMBO_HP*boost);
      state.maxStamina=(state.maxStamina??100)*boost;state.stamina=state.maxStamina;
      this.sim.setMods(id,{damageOut:boost,speed:boost,cooldown:1/boost,staminaRecovery:boost,meterGain:boost,awakenGain:boost});
    }
    if(!bot&&this.view.hostId===null)this.view.hostId=id;
    if(bot)this.attachBrain(id);return seat;
  }
  role(id:string,role:RolePreference){const seat=this.seats.get(id);return this.view.phase==='lobby'&&!!seat&&(role==='auto'||role===seat.team);}
  setFill(id:string,fill:unknown){if(this.view.phase!=='lobby'||this.view.hostId!==id||this.kind!=='last-stand'||typeof fill!=='boolean')return false;this.view.fillBots=fill;return true;}
  buy(id:string,item:unknown){if(this.view.phase!=='active')return 'The match is not active.';return this.siege?.buy(id,item)??(this.siege?undefined:'There is no defence shop in Bad Blood.');}
  private attachBrain(id:string){const actor=this.sim.actors.get(id);if(actor){actor.external=true;actor.state.isBot=true;this.brains.set(id,new ObjectiveBrain(id,this.brains.size+1,this.rules.difficulty));}}
  disconnect(id:string,away:boolean){const seat=this.seats.get(id);if(seat)seat.disconnected=away||undefined;this.sim.clearPlayerInput(id);}
  remove(id:string){
    const seat=this.seats.get(id);if(!seat)return;
    if(this.view.phase==='lobby'){this.siege?.unregister(id);this.seats.delete(id);this.brains.delete(id);this.sim.removePlayer(id);}
    else {seat.bot=true;seat.disconnected=false;seat.name='Bot · '+seat.name.slice(0,12);this.sim.actors.get(id)!.state.name=seat.name;this.attachBrain(id);}
    if(this.view.hostId===id)this.view.hostId=[...this.seats.values()].find(s=>!s.bot)?.id??null;
  }
  private spawn(seat:ObjectiveSeat):Vec3{
    const peers=[...this.seats.values()].filter(s=>s.team===seat.team),i=Math.max(0,peers.findIndex(s=>s.id===seat.id));
    if(this.kind==='last-stand')return {x:(i-(peers.length-1)/2)*3,y:0,z:12};
    return {x:seat.team==='heroes'?-12:12,y:0,z:(i-1)*6};
  }
  start(){
    if(this.view.phase!=='lobby'||!this.seats.size)return false;
    let n=0;
    const fill=(team:ObjectiveTeam,number:number)=>{const deck=this.sim.shuffle(POOL.filter(f=>team==='defenders'||isBadBloodFighter(f)&&factionOf(f)===team));while(this.count(team)<number){const id='mode-bot-'+(++n),used=new Set([...this.seats.values()].map(s=>s.fighter)),fighter=deck.find(f=>!used.has(f))??deck[n%deck.length];this.add(id,fighter,fighter.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '),team,true);}};
    if(this.kind==='bad-blood'){fill('heroes',3);fill('villains',3);}else if(this.view.fillBots)fill('defenders',4);
    this.view.phase='countdown';this.view.startsAt=this.sim.serverTime+RULES.countdown;return true;
  }
  submit(id:string,input:unknown){return this.sim.submitInput(id,input);}
  private begin(){
    this.view.phase='active';this.view.startsAt=null;this.view.startedAt=this.sim.serverTime;this.sim.status='active';
    for(const seat of this.seats.values()){this.sim.clearPlayerInput(seat.id);this.sim.place(seat.id,this.spawn(seat),seat.team==='villains'?-Math.PI/2:seat.team==='heroes'?Math.PI/2:Math.PI);}
    this.siege?.begin();
  }
  step(dt=1/60,waiting?:ReadonlySet<string>){
    if(!Number.isFinite(dt)||dt<=0||dt>.05)throw new Error('Invalid objective timestep');
    if(this.view.phase==='over'){this.sim.serverTime+=dt;this.sim.tick++;return;}
    if(this.view.phase==='active'){
      const players=this.sim.playerStates(),view={...this.view,seats:[...this.seats.values()]};
      if(this.sim.serverTime>=this.ordersAt){this.orders=defenderOrders(players,view,this.orders);this.ordersAt=this.sim.serverTime+.35;}
      const orders=this.orders;
      for(const [id,brain] of this.brains){const order=orders.get(id);this.seats.get(id)!.duty=order;this.sim.command(id,brain.command(players,view,this.sim.serverTime,this.sim.stage,order??null));}
      this.siege?.beforeStep();
    }
    this.sim.step(dt,waiting);
    if(this.view.phase==='countdown'&&this.sim.serverTime+1e-6>=(this.view.startsAt??Infinity))this.begin();
    const events=this.sim.drainEvents().map(event=>{const enemy=this.sim.actors.get(event.actorId)?.state.enemy;return enemy?{...event,fighter:undefined,enemy}:event;});this.events.push(...events);
    if(this.view.phase!=='active')return;
    this.teamwork.update(events,this.sim.playerStates(),this.sim.serverTime,id=>{const seat=this.seats.get(id);if(seat){seat.assists=(seat.assists??0)+1;const c=this.siege?.contributions.get(id);if(c)c.assists=(c.assists??0)+1;}});
    this.siege?.afterStep(events);
    const alive=(team:ObjectiveTeam)=>[...this.seats.values()].some(s=>s.team===team&&this.sim.actors.get(s.id)!.state.alive);
    if(this.kind==='last-stand'){
      if(this.siege!.view.hp<=0){this.finish('horde','The Hidden Leaf Village has fallen.');return;}
      if(!alive('defenders')){this.finish('horde','All defenders fell together.');return;}
    }else if(!alive('heroes')||!alive('villains')){this.finish(!alive('heroes')&&!alive('villains')?'draw':alive('heroes')?'heroes':'villains','No fighters remain standing on the opposing team.');return;}
    this.handleDeaths(dt);
    this.events.push(...this.sim.drainEvents());
  }
  private handleDeaths(dt:number){
    const now=this.sim.serverTime;
    for(const seat of this.seats.values()){
      const p=this.sim.actors.get(seat.id)!.state;
      if(!p.alive&&!this.deaths.has(p.id)){
        this.deaths.add(p.id);seat.down=true;
        if(seat.team==='heroes'&&seat.revivesLeft>0){seat.revivesLeft--;seat.reviveAt=now+RULES.heroReviveSeconds;}
      }
      if(p.alive)continue;
      if(this.kind==='last-stand'){
        const helpers=[...this.seats.values()].filter(s=>s.id!==seat.id&&!s.disconnected&&this.sim.actors.get(s.id)!.state.alive&&Math.abs(this.sim.actors.get(s.id)!.state.y-p.y)<2&&Math.hypot(this.sim.actors.get(s.id)!.state.x-p.x,this.sim.actors.get(s.id)!.state.z-p.z)<=RULES.rescueRadius);
        seat.rescue=helpers.length?Math.min(1,seat.rescue+dt/RULES.rescueSeconds*(1+(helpers.length-1)*.5)):Math.max(0,seat.rescue-dt/6);
        if(seat.rescue>=1){this.rise(seat,.35);for(const helper of helpers){helper.revives++;this.siege!.contributions.get(helper.id)!.revives++;}}
      }else if(seat.reviveAt!==undefined&&now>=seat.reviveAt)this.rise(seat,1);
    }
  }
  private rise(seat:ObjectiveSeat,share:number){const p=this.sim.actors.get(seat.id)!.state;this.sim.revive(seat.id,p.maxHp*share);this.sim.clearPlayerInput(seat.id);seat.down=false;seat.rescue=0;seat.reviveAt=undefined;this.deaths.delete(seat.id);}
  private finish(team:ObjectiveTeam|'horde'|'draw',reason:string){
    this.view.phase='over';this.view.winner=team;this.view.reason=reason;this.view.endsAt=this.sim.serverTime;this.sim.status='finished';
    this.sim.winnerId=[...this.seats.values()].find(s=>s.team===team&&this.sim.actors.get(s.id)?.state.alive)?.id??null;
    for(const a of this.sim.actors.values()){this.sim.clearPlayerInput(a.state.id);a.cast=null;if(a.state.alive){a.state.action=a.state.team===team?'victory':'idle';a.state.actionStarted=this.sim.serverTime;a.state.actionDuration=0;}}
  }
  snapshot(consume=false):ObjectiveSnapshot{
    const base=this.sim.snapshot(),events=this.events.slice();if(consume)this.events=[];
    return {...base,events,objective:{...this.view,village:this.siege?{...this.siege.view,challenge:this.siege.view.challenge?{...this.siege.view.challenge}:undefined,nextChallenge:this.siege.view.nextChallenge?{...this.siege.view.nextChallenge}:undefined,chapter:this.siege.view.chapter?{...this.siege.view.chapter}:undefined,traps:this.siege.view.traps?.map(t=>({...t})),specialists:this.siege.view.specialists?.map(s=>({...s,linked:[...s.linked]})),emergency:this.siege.view.emergency?{...this.siege.view.emergency,helpers:[...this.siege.view.emergency.helpers]}:undefined,director:this.siege.view.director?{...this.siege.view.director}:undefined,upgrades:{...this.siege.view.upgrades},incoming:[...this.siege.view.incoming],lanes:[...this.siege.view.lanes],plan:this.siege.view.plan?{...this.siege.view.plan,lanes:[...this.siege.view.plan.lanes]}:undefined,structures:this.siege.view.structures.map(s=>({...s})),warnings:this.siege.view.warnings?.map(w=>({...w}))}:undefined,seats:[...this.seats.values()].map(s=>({...s,...(this.siege?.contributions.get(s.id)??{}),progress:this.siege?.levels.view(s.id)}))}};
  }
  dispose(){this.sim.dispose();}
}
