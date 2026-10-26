import { isReleasedFighter, requireReleasedFighter } from '../rosterAvailability';
import {ArenaSimulation,validateInput,type ExternalTargets,type ExternalBody,type ExternalBlow} from '../simulation';
import {COMBO_HP,COMBO_STAMINA,type MoveDefinition} from '../moves';
import {HEROES,VILLAINS,factionOf} from '../objectives/model';
import {tidyName} from '../displayName';
import {NavGrid} from '../botNav';
import type {CollisionWorld,CombatEvent,FighterId,PlayerState,Vec3} from '../types';
import {RiftBrain} from './RiftBrain';
import {RelicEffects} from './RelicEffects';
import {RiftUnitNavigation} from './RiftUnitNavigation';
import {UnitGrid} from './UnitGrid';
import {canSeeFrom} from './vision';
import {RIFT_BASES,RIFT_BOSS,RIFT_CAMPS,RIFT_LENGTHS,RIFT_RUNES,lanePoint,riftStructures,riftClearShot} from './map';
import {botBuildPlan,buildStats,itemPrice,levelThreshold,riftItem,ownedComponent,alreadyEvolved} from './items';
import {riftUnitHeight} from './armyIdentity';
import {warfrontAt,waveComposition} from './warfront';
import {RIFT_BODY_HEIGHT,RIFT_LANES,RIFT_RULES,RIFT_STAGE,RIFT_TEAMS,enemyTeam,buybackCost,type RiftAccess,type RiftEvent,type RiftLane,type RiftSeat,type RiftSnapshot,type RiftStructure,type RiftTeam,type RiftUnit,type RiftUnitKind,type RiftView} from './model';
interface Unit extends RiftUnit,ExternalBody {progress:number;cooldown:number;freezeUntil:number;deadAt:number;homeX:number;homeZ:number;camp:number;lastHitBy?:string;}
interface Structure extends RiftStructure,ExternalBody {cooldown:number;}
export interface RiftOptions {collision?:CollisionWorld;seed?:number;access?:RiftAccess;round?:number;fillBots?:boolean;}
const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const UNIT_KIT:MoveDefinition={name:'Spirit Volley',duration:.5,contacts:[.3],damage:25,range:8,radius:.5,stamina:0,cooldown:1,stun:.1,knockback:.4,style:'projectile'};
export class RiftMatch implements ExternalTargets {
 private readonly relicEffects=new RelicEffects();
 readonly sim:ArenaSimulation;readonly seats=new Map<string,RiftSeat>();readonly view:RiftView;
 private readonly units=new Map<string,Unit>();private readonly structures:Structure[];
 private readonly brains=new Map<string,RiftBrain>();private readonly roster:PlayerState[]=[];
 private readonly humanSeq=new Map<string,number>();private readonly disconnectedAt=new Map<string,number>();private readonly damageLedger=new Map<string,Map<string,number>>();
 private readonly towerPressure=new Map<string,{target:string;shots:number}>();private readonly pings=new Map<string,number>();private readonly campAt=[0,0,0,0];
 private events:CombatEvent[]=[];private eventSerial=0;private unitSerial=0;private waveSerial=0;private crowdClock=0;private nextIncome=0;private nextBotShop=0;
 private readonly scratchPoint={x:0,z:0};
 private readonly unitGrid=new UnitGrid<Unit>();private readonly nearbyUnits:Unit[]=[];
 private readonly strikes=new Map<string,{targetId:string;at:number;damage:number;range:number;ranged:boolean}>();
 private readonly navigation?:NavGrid;
 private readonly unitNavigation=new RiftUnitNavigation();
 constructor(options:RiftOptions={}){
  this.navigation=options.collision?NavGrid.for(RIFT_STAGE):undefined;
  this.sim=new ArenaSimulation({roomMode:'training',trainingBot:false,respawn:false,stage:RIFT_STAGE,collision:options.collision,seed:options.seed??1,capacity:10,maxHp:COMBO_HP,maxStamina:COMBO_STAMINA});
  this.sim.status='waiting';this.sim.external=this;this.sim.assist={magnet:RIFT_RULES.aimMagnet};
  this.structures=riftStructures().map(s=>({...s,height:RIFT_BODY_HEIGHT[s.kind],airborne:false,cooldown:0}));
  this.view={kind:'rift-war',phase:'lobby',access:options.access??'host',round:options.round??1,hostId:null,capacity:10,fillBots:options.fillBots??true,startsAt:null,startedAt:0,endsAt:0,winner:null,reason:'',seats:[],structures:this.structures,units:[],wave:0,nextWaveAt:0,bossAt:0,bossRespawnAt:0,buffs:{heroes:0,villains:0},runes:RIFT_RUNES.map((p,i)=>({...p,id:`rift-rune-${i}`,kind:i?'recovery':'haste',available:false,respawnAt:60})),events:[]};
 }
 add(id:string,fighter:FighterId,name:string,bot=false):RiftSeat {
  if(this.view.phase!=='lobby'||this.seats.has(id)||this.seats.size>=10)throw new Error('This Rift War has already started or is full.');
  requireReleasedFighter(fighter);
  if(!HEROES.includes(fighter)&&!VILLAINS.includes(fighter))throw new Error('Choose a fighter from the Rift War roster.');
  const team=factionOf(fighter),peers=[...this.seats.values()].filter(s=>s.team===team);
  if(peers.length>=5)throw new Error(`The ${team} team is full. Choose a fighter from the other faction.`);
  const lane=(['mid','top','bot','top','bot'] as const)[peers.length];
  const seat:RiftSeat={id,name:tidyName(name,18),fighter,team,bot,lane,gold:RIFT_RULES.startingGold,earned:0,xp:0,level:1,inventory:[],kills:0,deaths:0,assists:0,lastHits:0,structures:0,healing:0,role:peers.length===0?'carry':peers.length<3?'vanguard':'support'};
  this.seats.set(id,seat);this.sim.addPlayer(id,fighter,seat.name,bot,this.spawn(seat));this.sim.setTeam(id,team);this.roster.push(this.sim.actors.get(id)!.state);
  if(bot)this.attachBrain(id);else if(this.view.hostId===null)this.view.hostId=id;
  this.view.seats=[...this.seats.values()];return seat;
 }
 private attachBrain(id:string){const a=this.sim.actors.get(id);if(a){a.external=true;this.brains.set(id,new RiftBrain(id,this.brains.size,this.navigation));}}
 private spawn(seat:RiftSeat):Vec3 {const b=RIFT_BASES[seat.team],i=[...this.seats.values()].filter(s=>s.team===seat.team).findIndex(s=>s.id===seat.id),sign=seat.team==='heroes'?1:-1;return{x:b.x+sign*(4+(i%3)*2),y:0,z:b.z-sign*(4+Math.floor(i/3)*2)};}
 start():boolean {
  if(this.view.phase!=='lobby'||!this.seats.size)return false;
  if(this.view.fillBots){let n=0;for(const team of RIFT_TEAMS){const pool=this.sim.shuffle((team==='heroes'?HEROES:VILLAINS).filter(isReleasedFighter));while([...this.seats.values()].filter(s=>s.team===team).length<5){const fighter=pool.find(f=>![...this.seats.values()].some(s=>s.fighter===f))??pool[n%pool.length];this.add(`rift-bot-${++n}`,fighter,fighter.replace(/-/g,' '),true);}}}
  if(!RIFT_TEAMS.every(team=>[...this.seats.values()].some(s=>s.team===team)))return false;
  this.view.phase='countdown';this.view.startsAt=this.sim.serverTime+RIFT_RULES.countdown;return true;
 }
 setFill(id:string,fill:unknown):boolean {if(id!==this.view.hostId||this.view.phase!=='lobby'||typeof fill!=='boolean')return false;this.view.fillBots=fill;return true;}
 submit(id:string,raw:unknown):boolean {
  const seat=this.seats.get(id),input=validateInput(raw);if(!seat||seat.bot||seat.disconnected||!input)return false;
  if(input.targetId){const target=this.sim.actors.get(input.targetId)?.state??this.units.get(input.targetId)??this.structures.find(s=>s.id===input.targetId);if(target&&(target.team===seat.team||!canSeeFrom(seat.team,target,this.roster,this.units.values(),this.structures)))input.targetId=null;}
  if(seat.recallAt!==undefined&&(Math.hypot(input.moveX,input.moveZ)>.05||input.attack||input.dash||input.jump||input.awaken))seat.recallAt=undefined;
  return this.sim.submitInput(id,input);
 }
 disconnect(id:string,away:boolean){const seat=this.seats.get(id);if(!seat)return;seat.disconnected=away||undefined;this.sim.clearPlayerInput(id);if(away){this.disconnectedAt.set(id,this.sim.serverTime);if(!this.humanSeq.has(id))this.humanSeq.set(id,this.sim.actors.get(id)!.lastSeq);}else{this.disconnectedAt.delete(id);if(!seat.bot){this.brains.delete(id);const actor=this.sim.actors.get(id)!,seq=this.humanSeq.get(id);if(seq!==undefined){actor.lastSeq=seq;this.sim.clearPlayerInput(id);}this.humanSeq.delete(id);}}}
 remove(id:string){const seat=this.seats.get(id);if(!seat)return;if(this.view.phase==='lobby'){this.seats.delete(id);this.sim.removePlayer(id);const i=this.roster.findIndex(p=>p.id===id);if(i>=0)this.roster.splice(i,1);this.view.seats=[...this.seats.values()];}else{seat.bot=true;seat.disconnected=undefined;this.sim.actors.get(id)!.state.isBot=true;this.attachBrain(id);}this.disconnectedAt.delete(id);if(this.view.hostId===id)this.view.hostId=([...this.seats.values()].find(s=>!s.bot&&!s.disconnected)??[...this.seats.values()].find(s=>!s.bot))?.id??null;}
 buy(id:string,itemId:unknown):string|undefined {
  const seat=this.seats.get(id),item=riftItem(itemId),p=this.sim.actors.get(id)?.state;
  if(!seat||!p||this.view.phase!=='active')return 'The match is not active.';
  if(!item)return 'Choose a relic from the shop.';
  if(p.alive&&distance(p,RIFT_BASES[seat.team])>RIFT_RULES.shopRadius)return 'Return to your fountain to buy relics.';
  if(seat.inventory.includes(item.id))return 'You already own this relic.';
  if(alreadyEvolved(seat,item))return 'You already own the upgraded relic.';
  if(seat.level<(item.level??1))return `Reach level ${item.level} to forge a mythic relic.`;
  const component=ownedComponent(seat,item),hasComponent=!!component,price=itemPrice(seat,item);
  if(seat.inventory.length>=6&&!hasComponent)return 'All six relic slots are full.';
  if(seat.gold<price)return 'You need more gold.';
  seat.gold-=price;if(hasComponent)seat.inventory.splice(seat.inventory.indexOf(component!),1);seat.inventory.push(item.id);this.refreshBuild(seat);
  this.emit('purchase',{actorId:id,team:seat.team,x:p.x,z:p.z,text:item.name,value:price});return undefined;
 }
 recall(id:string):string|undefined {
  const seat=this.seats.get(id),a=this.sim.actors.get(id);if(!seat||!a||!a.state.alive||this.view.phase!=='active')return 'You must be alive to recall.';
  if(seat.recallAt!==undefined){seat.recallAt=undefined;return undefined;}
  if(a.cast||a.state.action==='dash'||a.state.guarding)return 'Finish your current action before recalling.';
  seat.recallAt=this.sim.serverTime+RIFT_RULES.recallSeconds;this.sim.clearPlayerInput(id);return undefined;
 }
 buyback(id:string):string|undefined {
  const seat=this.seats.get(id),p=this.sim.actors.get(id)?.state,now=this.sim.serverTime;
  if(!seat||!p||this.view.phase!=='active'||p.alive||seat.respawnAt===undefined)return 'Buyback is only available while waiting to respawn.';
  if(now<(seat.buybackAt??0))return 'Buyback is still cooling down.';
  const cost=buybackCost(seat);if(seat.gold<cost)return 'You need more gold to buy back.';
  seat.gold-=cost;seat.buybackCount=(seat.buybackCount??0)+1;seat.buybackAt=now+180;seat.respawnAt=undefined;seat.recallAt=undefined;
  this.sim.revive(id,p.maxHp);this.sim.place(id,this.spawn(seat),seat.team==='heroes'?Math.PI*.75:-Math.PI*.25);this.sim.clearPlayerInput(id);
  this.emit('buyback',{actorId:id,team:seat.team,x:p.x,z:p.z,value:cost,text:`${seat.name} bought back`});return undefined;
 }
 ping(id:string,lane:unknown):string|undefined {
  const seat=this.seats.get(id);if(!seat||this.view.phase!=='active'||!RIFT_LANES.includes(lane as RiftLane)||this.sim.serverTime<(this.pings.get(id)??-Infinity)+2)return 'Wait a moment before sending another lane call.';
  this.pings.set(id,this.sim.serverTime);seat.lane=lane as RiftLane;
  const bots=[...this.seats.values()].filter(s=>s.team===seat.team&&s.bot);if(bots.length)bots.sort((a,b)=>distance(this.sim.actors.get(a.id)!.state,this.sim.actors.get(id)!.state)-distance(this.sim.actors.get(b.id)!.state,this.sim.actors.get(id)!.state))[0].lane=lane as RiftLane;
  const point=lanePoint(lane as RiftLane,RIFT_LENGTHS[lane as RiftLane]/2);this.emit('ping',{team:seat.team,actorId:id,lane:lane as RiftLane,...point});return undefined;
 }
 step(dt=1/60,waiting?:ReadonlySet<string>){
  if(!Number.isFinite(dt)||dt<=0||dt>.05)throw new Error('Invalid Rift War timestep.');
  if(this.view.phase==='over'){this.sim.serverTime+=dt;this.sim.tick++;return;}
  if(this.view.phase==='active'){
   for(const [id,at] of this.disconnectedAt)if(this.sim.serverTime-at>=12&&!this.brains.has(id))this.attachBrain(id);
   for(const [id,brain] of this.brains){const p=this.sim.actors.get(id)?.state,seat=this.seats.get(id);if(p&&seat)this.sim.command(id,brain.command(p,seat,this.roster,this.view,this.sim.serverTime));}
  }
  this.sim.step(dt,waiting);
  if(this.view.phase==='countdown'&&this.sim.serverTime+1e-6>=(this.view.startsAt??Infinity))this.begin();
  const combat=this.sim.drainEvents();this.events.push(...combat);if(this.events.length>512)this.events.splice(0,this.events.length-512);
  if(this.view.phase!=='active')return;
  this.observeCombat(combat);this.heroes(dt);
  this.crowdClock+=dt;if(this.crowdClock+1e-8>=.05){const elapsed=this.crowdClock;this.crowdClock=0;this.armies(elapsed);}
 }
 private begin(){this.view.phase='active';this.view.startsAt=null;this.view.startedAt=this.sim.serverTime;this.view.nextWaveAt=this.sim.serverTime+RIFT_RULES.firstWave;this.view.bossAt=this.sim.serverTime+RIFT_RULES.bossFirst;this.view.bossRespawnAt=this.view.bossAt;this.nextIncome=this.sim.serverTime+1;this.sim.status='active';for(const seat of this.seats.values()){this.sim.clearPlayerInput(seat.id);this.sim.place(seat.id,this.spawn(seat),seat.team==='heroes'?Math.PI*.75:-Math.PI*.25);}for(const rune of this.view.runes)rune.respawnAt=this.sim.serverTime+60;for(let i=0;i<4;i++)this.campAt[i]=this.sim.serverTime+15;}
 private heroes(dt:number){
  const now=this.sim.serverTime;
  if(now>=this.nextIncome){this.nextIncome+=1;for(const seat of this.seats.values())this.credit(seat,RIFT_RULES.passiveGold,0);}
  for(const seat of this.seats.values()){
   const p=this.sim.actors.get(seat.id)!.state;
   if(this.relicEffects.surgeUntil.has(seat.id)&&now>=this.relicEffects.surgeUntil.get(seat.id)!){this.relicEffects.surgeUntil.delete(seat.id);this.refreshBuild(seat);}
   if(seat.boon&&now>=seat.boon.until)seat.boon=undefined;
   if(seat.hasteUntil!==undefined&&now>=seat.hasteUntil){seat.hasteUntil=undefined;this.refreshBuild(seat);}
   if(!p.alive){if(seat.respawnAt===undefined){seat.deaths++;seat.respawnAt=now+RIFT_RULES.respawnBase+seat.level*RIFT_RULES.respawnPerLevel+Math.min(24,(seat.buybackCount??0)*8);seat.recallAt=undefined;}if(now>=seat.respawnAt){this.sim.revive(seat.id,p.maxHp);this.sim.place(seat.id,this.spawn(seat),seat.team==='heroes'?Math.PI*.75:-Math.PI*.25);this.sim.clearPlayerInput(seat.id);seat.respawnAt=undefined;}continue;}
   if(distance(p,RIFT_BASES[seat.team])<RIFT_RULES.fountainRadius){const hp=p.hp;this.sim.heal(seat.id,p.maxHp*.22*dt);seat.healing+=p.hp-hp;p.stamina=Math.min(p.maxStamina??225,p.stamina+80*dt);}
   if(seat.recallAt!==undefined&&now>=seat.recallAt){this.sim.place(seat.id,this.spawn(seat));this.sim.clearPlayerInput(seat.id);seat.recallAt=undefined;this.emit('recall',{actorId:seat.id,team:seat.team,x:p.x,z:p.z});}
  }
  if(now>=this.nextBotShop){this.nextBotShop=now+1;this.botEconomy();}
 }
 private botEconomy(){
  for(const [id] of this.brains){
   const seat=this.seats.get(id)!,p=this.sim.actors.get(id)!.state;
   if(!p.alive&&seat.level>=6){const core=this.structures.find(s=>s.team===seat.team&&s.kind==='core')!;if(core.hp/core.maxHp<.65||this.view.units.some(u=>u.hp>0&&u.team!==seat.team&&u.team!=='neutral'&&distance(u,core)<18))this.buyback(id);}
   if(p.alive&&distance(p,RIFT_BASES[seat.team])>RIFT_RULES.shopRadius){
    const safe=!this.roster.some(q=>q.alive&&q.team!==seat.team&&distance(q,p)<20)&&!this.view.units.some(u=>u.hp>0&&u.team!==seat.team&&distance(u,p)<12);
    if(safe&&seat.recallAt===undefined&&(p.hp/p.maxHp<.25||seat.gold>2200&&p.hp/p.maxHp<.7))this.recall(id);
    continue;
   }
   for(const item of botBuildPlan(seat.role)){
    if(seat.inventory.includes(item)||alreadyEvolved(seat,riftItem(item)!)||seat.level<(riftItem(item)!.level??1))continue;
    if(this.buy(id,item))break;
   }
  }
 }
 private observeCombat(events:readonly CombatEvent[]){
  const now=this.sim.serverTime;
  for(const event of events){
   const owner=this.seats.get(event.kind==='just-guard'?event.targetId??'':event.actorId);
   if(owner){const player=this.sim.actors.get(owner.id)!.state,reward=this.relicEffects.observe(event,owner,player,now);if(reward){this.sim.heal(owner.id,reward.heal);player.stamina=Math.min(player.maxStamina??225,player.stamina+reward.stamina);this.sim.addMeter(owner.id,reward.ultimate,reward.awakening);if(reward.surge)this.refreshBuild(owner);owner.boon={name:reward.name,until:now+3};}}
   if((event.kind==='hit'||event.kind==='blocked'||event.kind==='guard-break')&&event.targetId&&event.damage&&event.damage>0){const seat=this.seats.get(event.targetId);if(seat){seat.recallAt=undefined;if(this.seats.has(event.actorId)){let ledger=this.damageLedger.get(event.targetId);if(!ledger)this.damageLedger.set(event.targetId,ledger=new Map());ledger.set(event.actorId,now);}}}
   if(event.kind==='eliminated'&&event.targetId){const victim=this.seats.get(event.targetId),killer=this.seats.get(event.actorId);if(!victim)continue;if(killer&&killer.team!==victim.team){killer.kills++;this.credit(killer,260+victim.level*20,180+victim.level*20);}
    const ledger=this.damageLedger.get(victim.id);if(ledger)for(const [id,at] of ledger){const ally=this.seats.get(id);if(ally&&id!==event.actorId&&ally.team!==victim.team&&now-at<10){ally.assists++;this.credit(ally,100,120);}}this.damageLedger.delete(victim.id);
    const p=this.sim.actors.get(victim.id)!.state;this.emit('kill',{actorId:event.actorId,targetId:victim.id,team:killer?.team,x:p.x,z:p.z});
   }
  }
 }
 private refreshBuild(seat:RiftSeat){const stats=buildStats(seat);if((this.relicEffects.surgeUntil.get(seat.id)??0)>this.sim.serverTime)stats.mods.speed=(stats.mods.speed??1)*1.18;if((seat.hasteUntil??0)>this.sim.serverTime)stats.mods.speed=(stats.mods.speed??1)*1.18;this.sim.setMaxHp(seat.id,stats.hp);if(!this.sim.actors.get(seat.id)!.state.alive)this.sim.actors.get(seat.id)!.state.hp=0;this.sim.setMods(seat.id,stats.mods);}
 private credit(seat:RiftSeat,gold:number,xp:number){seat.gold+=gold;seat.earned+=gold;seat.xp+=xp;let changed=false;while(seat.level<RIFT_RULES.maxLevel&&seat.xp>=levelThreshold(seat.level+1)){seat.level++;changed=true;}if(changed){this.refreshBuild(seat);this.sim.heal(seat.id,110);const p=this.sim.actors.get(seat.id)!.state;this.emit('level',{actorId:seat.id,team:seat.team,x:p.x,z:p.z,value:seat.level});}}
 private emit(kind:RiftEvent['kind'],fields:Omit<RiftEvent,'id'|'at'|'kind'>){this.view.events.push({id:++this.eventSerial,at:this.sim.serverTime,kind,...fields});if(this.view.events.length>80)this.view.events.splice(0,this.view.events.length-80);}
 private armies(dt:number){
  const now=this.sim.serverTime;
  this.resolveStrikes();
  if(now>=this.view.nextWaveAt){this.spawnWave();this.view.nextWaveAt+=RIFT_RULES.waveSeconds;}
  for(let i=0;i<4;i++)if(now>=this.campAt[i]&&![...this.units.values()].some(u=>u.camp===i&&u.hp>0)){const at=RIFT_CAMPS[i];this.campAt[i]=this.spawnUnit('neutral','mid','camp',0,at,i)?Infinity:now+5;}
  if(this.view.bossRespawnAt>0&&now>=this.view.bossRespawnAt&&![...this.units.values()].some(u=>u.kind==='boss'&&u.hp>0)){this.view.bossRespawnAt=this.spawnUnit('neutral','mid','boss',0,RIFT_BOSS,-1)?0:now+5;}
  this.unitGrid.rebuild(this.units.values());
  for(const unit of this.units.values()){
   if(unit.hp<=0){if(now-unit.deadAt>1.2){this.units.delete(unit.id);this.unitNavigation.forget(unit.id);}continue;}
   if(now<unit.freezeUntil){unit.state='hurt';continue;}
   this.unitStep(unit,dt);this.unitGrid.moved(unit);if(this.view.phase==='over')return;
  }
  for(const structure of this.structures){if(structure.hp<=0||structure.kind==='barracks'||structure.kind==='core')continue;this.towerStep(structure);if(this.view.phase==='over')return;}
  for(const rune of this.view.runes){if(!rune.available&&now>=rune.respawnAt)rune.available=true;if(!rune.available)continue;for(const p of this.roster){if(!p.alive||distance(p,rune)>2.2)continue;const seat=this.seats.get(p.id)!;if(rune.kind==='recovery'){this.sim.heal(p.id,p.maxHp*.35);p.stamina=p.maxStamina??225;}else{seat.hasteUntil=now+22;this.refreshBuild(seat);this.sim.addMeter(p.id,15,10);}rune.available=false;rune.respawnAt=now+90;this.emit('rune',{actorId:p.id,team:seat.team,x:rune.x,z:rune.z,text:rune.kind});break;}}
  for(const seat of this.seats.values()){if(seat.bot)continue;const actor=this.sim.actors.get(seat.id)!;for(const key of ['target','chosenExternal'] as const){const id=key==='target'?actor.state.target:actor.chosenExternal;if(!id)continue;const target=this.sim.actors.get(id)?.state??this.units.get(id)??this.structures.find(s=>s.id===id);if(!target||!canSeeFrom(seat.team,target,this.roster,this.units.values(),this.structures)){if(key==='target')actor.state.target=null;else actor.chosenExternal=undefined;}}}
  this.view.units.length=0;for(const unit of this.units.values())this.view.units.push(unit);
 }
 private spawnWave(){
  this.view.wave=++this.waveSerial;
  for(const team of RIFT_TEAMS)for(const lane of RIFT_LANES){
   const upgraded=this.structures.some(s=>s.team===enemyTeam(team)&&s.lane===lane&&s.kind==='barracks'&&s.hp<=0);
   const kinds=waveComposition(this.sim.serverTime-this.view.startedAt,this.waveSerial,upgraded);
   for(let i=0;i<kinds.length;i++){const progress=team==='heroes'?i*1.6:this.unitNavigation.laneLength(lane)-i*1.6;this.spawnUnit(team,lane,kinds[i],progress);}
  }
  const front=warfrontAt(this.sim.serverTime-this.view.startedAt);this.emit('wave',{x:0,z:0,value:this.waveSerial,text:`${front.name.toUpperCase()} · WAVE ${this.waveSerial}`});
 }
 private spawnUnit(team:Unit['team'],lane:RiftLane,kind:RiftUnitKind,progress:number,position?:{x:number;z:number},camp=-2){
  if(this.units.size>=RIFT_RULES.unitCap||team!=='neutral'&&[...this.units.values()].filter(u=>u.team===team&&u.lane===lane&&u.hp>0).length>=RIFT_RULES.laneUnitCap)return;
  const at=position??this.unitNavigation.lanePoint(lane,progress,{x:0,z:0}),scale=1+Math.min(1.5,(this.sim.serverTime-this.view.startedAt)/900),hp=(kind==='boss'?6500:kind==='camp'?750:kind==='siege'?520:kind==='super'?700:kind==='ranged'?220:310)*scale;
  const unit:Unit={id:`rift-unit-${++this.unitSerial}`,team,lane,kind,echelon:warfrontAt(this.sim.serverTime-this.view.startedAt).tier,x:at.x,y:0,z:at.z,yaw:team==='villains'?-Math.PI*.25:Math.PI*.75,hp,maxHp:hp,state:team==='neutral'?'idle':'move',target:null,attackAt:0,radius:kind==='boss'?2.8:kind==='siege'?1.1:.6,height:riftUnitHeight({team,kind,empowered:false}),airborne:false,empowered:team!=='neutral'&&this.view.buffs[team]>this.sim.serverTime,progress,cooldown:0,freezeUntil:0,deadAt:0,homeX:at.x,homeZ:at.z,camp};
  unit.height=riftUnitHeight(unit);this.unitNavigation.place(unit);this.units.set(unit.id,unit);return unit;
 }
 private unitStep(unit:Unit,dt:number){
  const now=this.sim.serverTime,neutral=unit.team==='neutral';let target:Unit|Structure|PlayerState|undefined,best=Infinity;
  if(this.strikes.has(unit.id)){unit.state='attack';return;}
  const range=unit.kind==='ranged'?8:unit.kind==='siege'?11:unit.kind==='boss'?5:1.8;
  const aggro=neutral?unit.lastHitBy?16:7:11;
  if(!neutral)for(const other of this.unitGrid.query(unit.x,unit.z,aggro,this.nearbyUnits)){if(other===unit||other.hp<=0||other.team===unit.team||other.team==='neutral')continue;const d=distance(unit,other);if(d<aggro&&(d<best||d===best&&target&&this.unitGrid.before(other,target as Unit))&&riftClearShot(unit,other)){best=d;target=other;}}
  for(const p of this.roster){if(!p.alive||p.team===unit.team)continue;const d=distance(unit,p);if(d<aggro&&d+(neutral?0:1)<best&&riftClearShot(unit,p)){best=d;target=p;}}
  if(!neutral)for(const structure of this.structures){if(structure.team===unit.team||structure.hp<=0||!structure.vulnerable)continue;const d=distance(unit,structure)-structure.radius;if(d<aggro&&d<best&&riftClearShot(unit,structure)){best=d;target=structure;}}
  if(neutral&&distance(unit,{x:unit.homeX,z:unit.homeZ})>20){unit.lastHitBy=undefined;target=undefined;}
  if(target){
   const dx=target.x-unit.x,dz=target.z-unit.z,d=Math.hypot(dx,dz)||1;unit.yaw=Math.atan2(dx,dz);unit.target=target.id;
   const radius='radius' in target?target.radius:.45;
   if(d>range+radius){unit.state='move';const speed=unit.kind==='boss'?3.3:4.1;this.unitNavigation.move(unit.id,unit,target.x,target.z,speed*dt,now);}
   else{unit.state='attack';if(now>=unit.cooldown){unit.cooldown=now+(unit.kind==='boss'?1.6:unit.kind==='siege'?1.8:1.15);unit.attackAt=now;
    const scale=1+Math.min(1,(now-this.view.startedAt)/900),empowered=unit.team!=='neutral'&&this.view.buffs[unit.team]>now;
    const damage=(unit.kind==='boss'?170:unit.kind==='camp'?65:unit.kind==='siege'?75:unit.kind==='super'?56:unit.kind==='ranged'?30:35)*scale*(empowered?1.45:1);
    const windup=unit.kind==='boss'?.75:unit.kind==='siege'?.6:range>5?.45:.3;
    this.strikes.set(unit.id,{targetId:target.id,at:now+windup,damage,range:range+radius+.6,ranged:range>5});
   }}
  }else{
   unit.target=null;
   if(neutral){const dx=unit.homeX-unit.x,dz=unit.homeZ-unit.z,d=Math.hypot(dx,dz);unit.state=d>.5?'move':'idle';if(d>.5)this.unitNavigation.move(unit.id,unit,unit.homeX,unit.homeZ,4*dt,now);else{unit.lastHitBy=undefined;unit.hp=Math.min(unit.maxHp,unit.hp+unit.maxHp*.08*dt);}}
   else{unit.state='move';const direction=unit.team==='heroes'?1:-1;unit.progress=Math.max(0,Math.min(this.unitNavigation.laneLength(unit.lane),unit.progress+direction*4.8*dt));this.unitNavigation.lanePoint(unit.lane,unit.progress,this.scratchPoint);const dx=this.scratchPoint.x-unit.x,dz=this.scratchPoint.z-unit.z,d=Math.hypot(dx,dz);if(d>.05){unit.yaw=Math.atan2(dx,dz);this.unitNavigation.move(unit.id,unit,this.scratchPoint.x,this.scratchPoint.z,5.4*dt,now);}}
  }
  unit.empowered=unit.team!=='neutral'&&this.view.buffs[unit.team]>now;unit.height=riftUnitHeight(unit);
 }
 private towerStep(tower:Structure){
  const now=this.sim.serverTime;let target:Unit|PlayerState|undefined,best=Infinity;
  if(this.strikes.has(tower.id))return;
  for(const p of this.roster){if(!p.alive||p.team===tower.team||distance(p,tower)>RIFT_RULES.towerRange||!riftClearShot(tower,p))continue;const threatening=this.roster.some(ally=>ally.team===tower.team&&ally.alive&&distance(ally,tower)<RIFT_RULES.towerRange&&((this.damageLedger.get(ally.id)?.get(p.id)??-Infinity)>now-2||p.target===ally.id&&['light','heavy','special','ultimate'].includes(p.action)&&p.actionTime<.85));if(threatening){target=p;break;}}
  if(!target)for(const u of this.unitGrid.query(tower.x,tower.z,RIFT_RULES.towerRange,this.nearbyUnits)){if(u.hp<=0||u.team===tower.team||u.team==='neutral')continue;const d=distance(u,tower);if(d<RIFT_RULES.towerRange&&(d<best||d===best&&target&&this.unitGrid.before(u,target as Unit))&&riftClearShot(tower,u)){best=d;target=u;}}
  if(!target)for(const p of this.roster){if(!p.alive||p.team===tower.team)continue;const d=distance(p,tower);if(d<RIFT_RULES.towerRange&&d<best&&riftClearShot(tower,p)){best=d;target=p;}}
  tower.target=target?.id??null;if(!target){this.towerPressure.delete(tower.id);return;}if(now<tower.cooldown)return;
  tower.cooldown=now+1.25;tower.attackAt=now;tower.fireAt=now+.6;const previous=this.towerPressure.get(tower.id),shots='alive' in target?(previous?.target===target.id?Math.min(5,previous.shots+1):0):0;this.towerPressure.set(tower.id,{target:target.id,shots});const damage=(tower.kind==='guardian'?175:145)*(1+shots*.12);
  this.strikes.set(tower.id,{targetId:target.id,at:tower.fireAt,damage,range:RIFT_RULES.towerRange,ranged:true});
 }
 private resolveStrikes(){
  const now=this.sim.serverTime;
  for(const [id,strike] of this.strikes){
   const source=this.units.get(id)??this.structures.find(s=>s.id===id);
   if(!source||source.hp<=0||'freezeUntil'in source&&source.freezeUntil>now){this.strikes.delete(id);continue;}
   if(now<strike.at)continue;
   this.strikes.delete(id);if('fireAt'in source)source.fireAt=undefined;
   const target=this.units.get(strike.targetId)??this.sim.actors.get(strike.targetId)?.state??this.structures.find(s=>s.id===strike.targetId);
   if(!target||target.hp<=0||distance(source,target)>strike.range||!riftClearShot(source,target))continue;
   this.npcDamage(source,target,strike.damage);
   if(strike.ranged)this.emit('bolt',{team:source.team==='neutral'?undefined:source.team,actorId:id,targetId:target.id,x:source.x,z:source.z,value:strike.damage});
  }
 }
 private npcDamage(source:Unit|Structure,target:Unit|Structure|PlayerState,amount:number){
  if('alive' in target){this.sim.strike(source.id,target.id,'light',{...UNIT_KIT,damage:amount,name:source.kind==='tower'||source.kind==='guardian'?'Ward Cannon':source.kind==='boss'?'Rift Guardian':'Spirit Volley'},source,true);return;}
  if('vulnerable' in target)this.damageStructure(target,amount,source.id,source.team as RiftTeam);
  else this.damageUnit(target,amount,source.id);
 }
 private damageUnit(unit:Unit,amount:number,attackerId:string){
  if(unit.hp<=0)return 0;const before=unit.hp;unit.hp=Math.max(0,unit.hp-amount);unit.lastHitBy=attackerId;
  if(unit.hp===0){unit.state='dead';unit.deadAt=this.sim.serverTime;unit.target=null;this.unitKilled(unit,attackerId);}return before-unit.hp;
 }
 private unitKilled(unit:Unit,killerId:string){
  const killer=this.seats.get(killerId),team=killer?.team??this.units.get(killerId)?.team??this.structures.find(s=>s.id===killerId)?.team;
  if(unit.kind==='boss'){
   this.view.bossRespawnAt=this.sim.serverTime+RIFT_RULES.bossRespawn;
   if(team&&team!=='neutral'){this.view.buffs[team]=this.sim.serverTime+RIFT_RULES.bossBuff;for(const seat of this.seats.values())if(seat.team===team)this.credit(seat,320,420);this.emit('boss',{actorId:killerId,team,x:unit.x,z:unit.z,text:'RIFT ASCENDANCY',value:RIFT_RULES.bossBuff});}
  }else if(unit.kind==='camp')this.campAt[unit.camp]=this.sim.serverTime+85;
  const gold=unit.kind==='boss'?200:unit.kind==='camp'?115:unit.kind==='siege'?95:unit.kind==='ranged'?40:55,xp=unit.kind==='camp'?160:unit.kind==='boss'?300:unit.kind==='siege'?120:65;
  if(killer){killer.lastHits++;this.credit(killer,gold,0);}
  if(team&&team!=='neutral'){const nearby=this.roster.filter(p=>p.alive&&p.team===team&&distance(p,unit)<18);if(nearby.length)for(const p of nearby)this.credit(this.seats.get(p.id)!,p.id===killerId?0:Math.round(gold*.18),xp/nearby.length);}
 }
 private damageStructure(structure:Structure,amount:number,attackerId:string,team:RiftTeam){
  if(this.view.phase!=='active'||structure.hp<=0||!structure.vulnerable||structure.team===team)return 0;
  const wave=[...this.units.values()].some(u=>u.hp>0&&u.team===team&&distance(u,structure)<15),fortified=!wave&&structure.kind!=='barracks';
  const before=structure.hp;structure.hp=Math.max(0,structure.hp-amount*(fortified?.18:1));
  if(structure.hp<=0){
   const killer=this.seats.get(attackerId);if(killer)killer.structures++;
   for(const seat of this.seats.values())if(seat.team===team)this.credit(seat,structure.kind==='tower'?180:250,100);
   this.emit(structure.kind==='core'?'core':structure.kind==='barracks'?'barracks':'tower',{team,actorId:attackerId,targetId:structure.id,lane:structure.lane==='base'?undefined:structure.lane,x:structure.x,z:structure.z});this.gates();
   if(structure.kind==='core')this.finish(team,`${team==='heroes'?'The Eclipse Keep':'The Dawn Shrine'} has fallen.`);
  }return before-structure.hp;
 }
 private gates(){for(const s of this.structures){if(s.hp<=0){s.vulnerable=false;continue;}if(s.kind==='tower')s.vulnerable=s.tier===1||!this.structures.some(q=>q.team===s.team&&q.lane===s.lane&&q.kind==='tower'&&q.tier<s.tier&&q.hp>0);else if(s.kind==='barracks')s.vulnerable=!this.structures.some(q=>q.team===s.team&&q.lane===s.lane&&q.kind==='tower'&&q.hp>0);else if(s.kind==='guardian')s.vulnerable=this.structures.some(q=>q.team===s.team&&q.kind==='barracks'&&q.hp<=0);else s.vulnerable=this.structures.some(q=>q.team===s.team&&q.kind==='barracks'&&q.hp<=0)&&!this.structures.some(q=>q.team===s.team&&q.kind==='guardian'&&q.hp>0);}}
 hostile(attackerId:string,body:ExternalBody):boolean {const team=this.seats.get(attackerId)?.team;const target=this.units.get(body.id)??this.structures.find(s=>s.id===body.id);return !!team&&!!target&&target.hp>0&&target.team!==team;}
 locate(id:string):ExternalBody|undefined {const unit=this.units.get(id);if(unit?.hp&&unit.hp>0)return unit;return this.structures.find(s=>s.id===id&&s.hp>0);}
 query(a:Vec3,b:Vec3,radius:number,out:ExternalBody[]):number {
  let n=0;const minX=Math.min(a.x,b.x)-radius-4,maxX=Math.max(a.x,b.x)+radius+4,minZ=Math.min(a.z,b.z)-radius-4,maxZ=Math.max(a.z,b.z)+radius+4;
  for(const u of this.units.values())if(u.hp>0&&u.x>=minX&&u.x<=maxX&&u.z>=minZ&&u.z<=maxZ)out[n++]=u;
  for(const s of this.structures)if(s.hp>0&&s.x>=minX&&s.x<=maxX&&s.z>=minZ&&s.z<=maxZ)out[n++]=s;
  out.length=n;return n;
 }
 receive(body:ExternalBody,blow:ExternalBlow):{damage:number;reaction?:'flinch';killed:boolean}|null {
  if(this.view.phase!=='active'||!this.hostile(blow.attackerId,body))return null;
  const unit=this.units.get(body.id);if(unit){const damage=this.damageUnit(unit,blow.damage,blow.attackerId);if(!damage)return null;if(unit.hp>0){unit.freezeUntil=Math.max(unit.freezeUntil,this.sim.serverTime+Math.min(.45,blow.stun));unit.state='hurt';if(unit.kind!=='boss')this.unitNavigation.push(unit,Math.max(-81,Math.min(81,unit.x+blow.pushX*Math.min(2,blow.knockback*.12))),Math.max(-81,Math.min(81,unit.z+blow.pushZ*Math.min(2,blow.knockback*.12))));}return {damage,reaction:'flinch',killed:unit.hp<=0};}
  const structure=this.structures.find(s=>s.id===body.id);if(!structure)return null;const damage=this.damageStructure(structure,blow.damage,blow.attackerId,this.seats.get(blow.attackerId)!.team);return damage>0?{damage,killed:structure.hp<=0}:null;
 }
 freeze(centre:Vec3,radius:number,seconds:number,attackerId?:string){for(const u of this.units.values())if(u.hp>0&&(!attackerId||this.hostile(attackerId,u))&&distance(u,centre)<radius+u.radius)u.freezeUntil=Math.max(u.freezeUntil,this.sim.serverTime+Math.min(6,seconds));}
 private finish(winner:RiftTeam,reason:string){this.view.phase='over';this.view.winner=winner;this.view.reason=reason;this.view.endsAt=this.sim.serverTime;this.sim.status='finished';this.sim.winnerId=[...this.seats.values()].find(s=>s.team===winner)?.id??null;for(const seat of this.seats.values()){seat.recallAt=undefined;this.sim.clearPlayerInput(seat.id);const a=this.sim.actors.get(seat.id)!;a.cast=null;if(a.state.alive){a.state.action=seat.team===winner?'victory':'idle';a.state.actionStarted=this.sim.serverTime;a.state.actionDuration=0;}}}
 snapshot(consume=false):RiftSnapshot {
  const base=this.sim.snapshot(),events=this.events.slice(),rift:RiftView={...this.view,seats:[...this.seats.values()].map(s=>({...s,inventory:[...s.inventory],boon:s.boon?{...s.boon}:undefined})),structures:this.structures.map(({height,airborne,cooldown,...s})=>({...s})),units:[...this.units.values()].map(({height,airborne,progress,cooldown,freezeUntil,deadAt,homeX,homeZ,camp,lastHitBy,...u})=>({...u})),buffs:{...this.view.buffs},runes:this.view.runes.map(r=>({...r})),events:this.view.events.map(e=>({...e}))};
  if(consume){this.events=[];this.view.events=[];}return {...base,roomMode:'match',events,rift};
 }
 dispose(){this.strikes.clear();this.relicEffects.clear();this.units.clear();this.unitGrid.clear();this.nearbyUnits.length=0;this.unitNavigation.clear();this.brains.clear();this.sim.dispose();}
}
