import { challengeFor, SiegeChallenges, type SiegeChallenge } from './siegeChallenges';
import {AssaultDirector,type DirectorView} from './assaultDirector';
import {VillageEmergency,type EmergencyView} from './villageEmergency';
import {SiegeSpecialists,SPECIALIST_NAMES,type SpecialistRole,type SpecialistView} from './siegeSpecialists';
import type {ArenaSimulation} from '../simulation';
import type {CombatEvent,PlayerState} from '../types';
import {ENEMIES,kitOf,type EnemyDefinition} from '../../survival/enemies';
import {EnemyBrain,TokenPool} from '../../survival/brains';
import {FighterLevels} from './fighterProgress';
import {SIEGE_PACING,siegeBoss,siegeBossTier,siegeCount,siegeLimit,type SiegeBossTier} from './siegePacing';
import {assaultPlan} from './assaultPlan';
import {siegeArmy} from './siegeRoster';
import {siegeChapter,type TrapTheme} from './siegeChapters';
import {SiegeTraps,type TrapView} from './siegeTraps';
import {BossRain,type SiegeWarning} from './bossRain';
import {VillageStructures,type VillageStructure} from './villageStructures';
import {SiegeBrain} from './SiegeBrain';

export const VILLAGE={name:'Hidden Leaf Village',x:0,z:24,radius:6,maxHp:12000,shop:{x:-11,z:24,radius:3.5}} as const;
export const LANES=[{name:'WEST ROAD',x:-27,z:-40},{name:'FOREST ROAD',x:0,z:-40},{name:'EAST ROAD',x:27,z:-40}] as const;
export const DEFENCES={
  repair:{name:'Repair crew',description:'Restore 20% of village health.',cost:300,max:0},
  walls:{name:'Reinforced walls',description:'Add 25% base health and restore that amount.',cost:650,max:5},
  seals:{name:'Barrier seals',description:'Reduce siege damage by 12% per tier.',cost:850,max:4},
  ballista:{name:'Watchtower volley',description:'The village fires at nearby attackers.',cost:1000,max:4},
  traps:{name:'Lane snares',description:'Restrain enemies at three defended approaches. Combine with charges or watchtowers.',cost:750,max:3},
  charges:{name:'Trap payloads',description:'Install timed charges. Restrained targets take 65% more trap damage.',cost:900,max:3},
} as const;
export type DefenceId=keyof typeof DEFENCES;
export interface LanePressure {lane:number;level:0|1|2|3;targets:string[];x:number;z:number;structure:string;}
export interface VillageView {challenge?:SiegeChallenge;nextChallenge?:SiegeChallenge;pressure?:LanePressure[];name:string;hp:number;maxHp:number;points:number;wave:number;remaining:number;nextWaveAt:number;phase:'preparation'|'assault';upgrades:Record<DefenceId,number>;kills:number;bosses:number;damageBlocked:number;incoming:string[];boss:string|null;bossTier?:SiegeBossTier;bossActor?:string;bossPhase?:number;bossPhaseAt?:number;underAttackUntil:number;lanes:number[];plan?:{title:string;hint:string;lanes:number[];total:number};warnings?:SiegeWarning[];structures:VillageStructure[];specialists?:SpecialistView[];emergency?:EmergencyView;director?:DirectorView;chapter?:{id:string;title:string;number:number;commander:string;lastWave:number;trap:TrapTheme};traps?:TrapView[];}
export interface Contribution {points:number;spent:number;repairs:number;revives:number;bosses:number;rescues?:number;supplies?:number;bossDamage?:number;assists?:number;}
type Raider={id:string;def:EnemyDefinition;brain:EnemyBrain;lane:number;role?:SpecialistRole;deadAt?:number;siege:SiegeBrain;boss:boolean};
const dist=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
export class LastStand {
  readonly view:VillageView={name:VILLAGE.name,hp:VILLAGE.maxHp,maxHp:VILLAGE.maxHp,points:0,wave:0,remaining:0,nextWaveAt:0,phase:'preparation',upgrades:{repair:0,walls:0,seals:0,ballista:0,traps:0,charges:0},kills:0,bosses:0,damageBlocked:0,incoming:[],boss:null,underAttackUntil:0,lanes:[0,0,0],structures:[]};
  readonly contributions=new Map<string,Contribution>();
  readonly levels:FighterLevels;
  readonly specialists:SiegeSpecialists;
  readonly traps:SiegeTraps;
  readonly emergency=new VillageEmergency();
  readonly director=new AssaultDirector();
  readonly challenges=new SiegeChallenges();
  private raiders=new Map<string,Raider>();
  private readonly living:Raider[]=[];private readonly crowd:PlayerState[]=[];
  private pool=new TokenPool({melee:3,shots:2,brutes:1});
  private pending:{kind:string;lane:number;role?:SpecialistRole;boss?:boolean}[]=[];
  private roll:number;private random=()=>{this.roll=this.roll*16807%2147483647;return this.roll/2147483647;};
  private serial=0;private nextSpawn=0;private nextVolley=0;private nextShot=0;
  private plannedWave=0;private seed:number;
  private rain:BossRain;
  readonly structures:VillageStructures;
  constructor(private sim:ArenaSimulation,private defenders:()=>PlayerState[],seed=4711){this.traps=new SiegeTraps(sim);this.specialists=new SiegeSpecialists(sim);this.seed=seed;this.roll=Math.max(1,seed);this.levels=new FighterLevels(sim);this.structures=new VillageStructures(sim);this.view.structures=this.structures.view;this.pool.gaps={melee:.3,shots:.65,brutes:.8};this.rain=new BossRain(sim,defenders,this.random);this.view.warnings=this.rain.warnings;this.planWave(1);}
  register(id:string){this.contributions.set(id,{points:0,spent:0,repairs:0,revives:0,bosses:0});this.levels.register(id);}
  unregister(id:string){this.contributions.delete(id);this.levels.remove(id);}
  begin(){this.planWave(1);this.view.nextWaveAt=this.sim.serverTime+SIEGE_PACING.firstBreak;}
  price(id:DefenceId){return Math.round(DEFENCES[id].cost*(1+this.view.upgrades[id]*.6));}
  buy(playerId:string,value:unknown):string|undefined{
    if(typeof value!=='string'||!Object.hasOwn(DEFENCES,value))return 'Choose a village upgrade.';
    const id=value as DefenceId,p=this.sim.actors.get(playerId)?.state,credit=this.contributions.get(playerId);
    if(!p?.alive||!credit)return 'Only a standing defender can buy upgrades.';
    if(dist(p,VILLAGE.shop)>VILLAGE.shop.radius||Math.abs(p.y)>3)return 'Visit the quartermaster inside the village.';
    const def=DEFENCES[id],level=this.view.upgrades[id],cost=this.price(id);
    if(def.max&&level>=def.max)return 'This defence is fully upgraded.';
    if(id==='repair'&&this.view.hp>=this.view.maxHp)return 'The village is already at full health.';
    if(this.view.points<cost)return 'Your team needs more points.';
    this.view.points-=cost;credit.spent+=cost;
    const before=this.view.hp,missing=this.view.maxHp-before;
    if(id==='repair')this.structures.repair(this.view.maxHp*.2);
    else {this.view.upgrades[id]++;if(id==='walls')this.structures.reinforce();if(id==='seals')this.structures.seals(this.view.upgrades.seals);}
    this.view.hp=this.structures.hp;this.view.maxHp=this.structures.maxHp;
    if(id==='repair')credit.repairs+=Math.min(missing,Math.max(0,this.view.hp-before));
  }
  private planWave(wave:number){
    this.plannedWave=wave;
    const army=siegeArmy(wave,this.seed),chapter=siegeChapter(wave,this.seed);
    if(this.view.chapter?.number!==chapter.number)this.traps.reset();
    this.view.chapter={id:chapter.definition.id,title:chapter.definition.title,number:chapter.number,commander:chapter.commander,lastWave:chapter.lastWave,trap:chapter.definition.trap};
    const plan=assaultPlan(wave,this.seed);
    const count=siegeCount(wave,this.defenders().length);
    this.pending=Array.from({length:count},(_,i)=>({kind:i%plan.bruteEvery===plan.bruteEvery-1?army.brute:i%plan.rangedEvery===plan.rangedEvery-1?army.gunner:army.fodder,lane:plan.lanes[i%plan.lanes.length]}));
    for(let i=9;i<this.pending.length;i+=12){const roles:SpecialistRole[]=wave===1?['captain']:wave===2?['captain','medic']:['captain','medic','sapper'];const role=roles[(Math.floor(i/12)+wave-1)%roles.length];this.pending[i]={...this.pending[i],kind:army.specialists[role],role};}
    this.view.boss=siegeBoss(wave,this.seed);this.view.bossTier=siegeBossTier(wave)??undefined;
    this.view.bossActor=undefined;this.view.bossPhase=0;this.view.bossPhaseAt=0;
    if(this.view.boss)this.pending.splice(Math.floor(count*.25),0,{kind:this.view.boss,lane:1,boss:true});
    this.view.incoming=[...new Set(this.pending.map(p=>p.kind))];
    this.view.nextChallenge=challengeFor(wave,this.seed,this.pending.length,this.pending.filter(p=>p.role||p.boss).length);
    this.view.plan={title:this.view.boss?`${this.view.bossTier!.toUpperCase()}-TIER BOSS SIEGE`:plan.title,hint:`${army.name} · ${this.view.boss?'Break the escort, then the boss':plan.hint}`,lanes:[0,1,2].map(lane=>this.pending.filter(p=>p.lane===lane).length),total:this.pending.length};
  }
  private openWave(){
    const v=this.view;this.emergency.endWave(v.wave,this.sim.serverTime);v.wave++;v.phase='assault';if(this.plannedWave!==v.wave)this.planWave(v.wave);
    v.points+=this.challenges.finish(this.sim.serverTime);
    this.challenges.start(v.nextChallenge!,this.sim.serverTime);v.challenge=this.challenges.view;
    v.remaining=this.pending.length;this.nextSpawn=this.sim.serverTime;
    this.emergency.begin(v.wave,this.sim.serverTime,(v.wave/2+this.seed)%2===0?0:2);
    this.pool.rations={melee:Math.min(9,2+Math.ceil(v.wave/3)+this.defenders().length),shots:Math.min(5,1+Math.floor(v.wave/4)),brutes:Math.min(3,1+Math.floor(v.wave/7))};
  }
  private spawn(kind:string,lane:number,role?:SpecialistRole,boss=false){
    const def=ENEMIES[kind];if(!def)throw new Error(`Last Stand cannot spawn ${kind}`);
    const id='siege-'+(++this.serial),at=LANES[lane],wave=this.view.wave;
    const players=this.defenders().length,hpScale=(1+(wave-1)*(boss?.06:.1))*(1+(players-1)*(boss?.18:.12));
    this.sim.addCombatant(id,{enemy:kind,name:role?SPECIALIST_NAMES[role]:def.name,team:'horde',kit:kitOf(def),maxHp:(boss?Math.max(1500,def.hp):def.hp*.6)*(role?1.35:1)*hpScale,size:def.size,poise:def.poise,breaker:def.breaker??boss,armour:boss,anchored:def.anchored,girth:def.girth,spawn:{x:at.x+(this.random()-.5)*5,y:0,z:at.z},mods:{damageOut:.65+(wave-1)*.11,speed:boss?def.speed:Math.max(.7,def.speed*1.15),damageIn:def.damageIn??1,stunIn:def.stunIn??1,knockbackIn:def.knockbackIn??1}});
    this.raiders.set(id,{id,def,brain:new EnemyBrain(id,def,this.sim.serverTime,()=>this.random()),lane,role,siege:new SiegeBrain(id,def,this.sim.serverTime,this.random()),boss});
    if(role)this.specialists.register(id,role);
    if(!boss&&this.emergency.view?.kind==='supplies'&&!this.emergency.view.carrier)this.emergency.carrier(id);
    if(boss){this.view.bossActor=id;this.view.bossPhaseAt=this.sim.serverTime;}
  }
  beforeStep(){
    const now=this.sim.serverTime,v=this.view;
    this.rain.update();
    const squad=this.defenders();
    this.director.update(now,squad,v.hp/v.maxHp,v.kills);v.director={...this.director.view};
    if(v.phase==='preparation'&&now>=v.nextWaveAt)this.openWave();
    const alive=this.living,crowd=this.crowd;alive.length=0;crowd.length=0;
    for(const raider of this.raiders.values()){const p=this.sim.actors.get(raider.id)?.state;if(p?.alive){alive.push(raider);crowd.push(p);}}
    if(v.phase==='assault'&&this.pending.length&&now>=this.nextSpawn){
      const slots=Math.min(this.director.batch,siegeLimit(v.wave,squad.length)-alive.length,60-this.sim.actors.size);
      for(let n=0;n<slots&&this.pending.length;n++){const next=this.pending.splice(this.director.index(this.pending,v.boss),1)[0];this.spawn(next.kind,next.lane,next.role,next.boss);}
      this.nextSpawn=now+this.director.gap*assaultPlan(v.wave,this.seed).pace;
    }
    const defenders=squad.filter(p=>p.alive);
    this.traps.update(crowd,v.upgrades,v.chapter!.trap,v.wave);
    v.traps=this.traps.snapshot();
    this.specialists.update(crowd);
    const constructs=this.structures.living();
    for(const r of alive){const id=r.id;
      const p=this.sim.actors.get(id)!.state;
      if(r.boss){
        const phase=p.hp/p.maxHp<=.3?2:p.hp/p.maxHp<=.65?1:0;
        if(phase>r.brain.phase){r.brain.enterPhase(phase,now);v.bossPhase=phase;v.bossPhaseAt=now;}
        if(now<r.brain.roaring){this.sim.command(id,{moveX:0,moveZ:0,yaw:p.yaw});continue;}
      }
      let nearest:PlayerState|undefined,nearestSquared=Infinity;
      for(const defender of defenders){const squared=(defender.x-p.x)**2+(defender.z-p.z)**2;if(squared<nearestSquared){nearestSquared=squared;nearest=defender;}}
      let post=constructs.find(s=>s.id!=='village-keep');
      for(const s of constructs)if(s.id!=='village-keep'&&(!post||dist(s,p)<dist(post,p)))post=s;
      post??=constructs[0];
      const role=this.specialists.role(id);
      const engaged=role!=='sapper'&&nearest&&dist(nearest,p)<(r.boss?28:r.def.brain==='gunner'?18:11);
      const target=engaged?nearest:post;if(!target)continue;
      const special=this.specialists.command(p,r.def,target,crowd);if(special){this.sim.command(id,special);continue;}
      const waypoint=gateWaypoint(p,target),slow=this.traps.slow(p.id,now,v.upgrades.traps);
      if(r.boss&&!waypoint){const command=r.brain.think(p,{sim:this.sim,now,target,tokens:this.pool,random:()=>this.random(),crowd,wave:v.wave,rank:Math.floor(v.wave/3)});command.moveX*=slow;command.moveZ*=slow;this.sim.command(id,command);}
      else {
        const command=r.siege.command(this.sim,p,target,now,slow,now>=this.nextShot);
        if(command.attack&&r.def.brain==='gunner'&&dist(p,target)>4)this.nextShot=now+SIEGE_PACING.shotGap;
        this.sim.command(id,command);
      }
    }
    if(v.upgrades.ballista&&now>=this.nextVolley){this.nextVolley=now+3;const targets=crowd.filter(p=>p.alive&&dist(p,VILLAGE)<30).sort((a,b)=>dist(a,VILLAGE)-dist(b,VILLAGE)).slice(0,v.upgrades.ballista);for(const p of targets)this.sim.damage(p.id,(95+v.upgrades.ballista*35)*this.traps.volleyMultiplier(p.id,now),'village-defence','Watchtower volley');}
  }
  afterStep(events:readonly CombatEvent[]){
    const v=this.view,now=this.sim.serverTime;
    this.levels.update();
    const emergency=this.emergency.view;
    const reward=this.emergency.update(now,this.defenders(),[...this.raiders.keys()].map(id=>this.sim.actors.get(id)?.state).filter((p):p is PlayerState=>!!p),emergency?.carrier?this.sim.actors.get(emergency.carrier)?.state:undefined);
    if(reward){
      this.challenges.emergency(emergency!.kind,now);v.points+=reward.points;
      if(v.phase==='preparation')v.points+=this.challenges.finish(now);
      for(const id of reward.helpers){const c=this.contributions.get(id);if(c){
        const key=emergency!.kind==='rescue'?'rescues':'supplies';
        c[key]=(c[key]??0)+1;c.points+=reward.points/reward.helpers.length;
      }}
    }
    v.emergency=this.emergency.view;v.specialists=this.specialists.view;
    for(const e of events)if(e.kind==='hit'&&e.targetId&&this.raiders.get(e.targetId)?.boss){const c=this.contributions.get(e.actorId);if(c)c.bossDamage=(c.bossDamage??0)+(e.damage??0);}
    this.rain.consume(events);
    this.structures.sync(events,now);v.hp=this.structures.hp;v.maxHp=this.structures.maxHp;
    for(const event of events)if(event.kind==='hit'&&this.structures.view.some(s=>s.id===event.targetId)){
      this.challenges.damage(event.damage??0);
      v.underAttackUntil=now+2.5;
      const reduction=v.upgrades.seals*.12;v.damageBlocked+=(event.damage??0)*reduction/Math.max(.01,1-reduction);
    }
    for(const [id,r] of this.raiders){const p=this.sim.actors.get(id)?.state;if(p?.alive)continue;
      if(r.deadAt===undefined){if(r.role||r.boss)this.challenges.leader(now);r.deadAt=now;v.kills++;this.pool.release(id);const points=r.boss?250:r.def.role==='brute'?50:25;v.points+=points;if(r.boss)v.bosses++;
        const killer=events.find(e=>e.kind==='eliminated'&&e.targetId===id)?.actorId,credit=killer?this.contributions.get(killer):undefined;if(credit){credit.points+=points;if(r.boss)credit.bosses++;}}
      if(now-r.deadAt>SIEGE_PACING.bodySeconds){this.sim.removePlayer(id);this.raiders.delete(id);}
    }
    const threats:PlayerState[][]=[[],[],[]];v.lanes.fill(0);v.remaining=this.pending.length;
    for(const r of this.raiders.values()){const p=this.sim.actors.get(r.id)?.state;if(p?.alive){v.remaining++;v.lanes[r.lane]++;threats[r.lane].push(p);}}
    v.pressure=LANES.map((_road,lane)=>{
      const preferred=lane===0?'village-west':lane===2?'village-east':'village-keep';
      const post=v.structures.find(s=>s.id===preferred&&s.hp>0)??v.structures.find(s=>s.id==='village-keep')!;
      let nearest=Infinity;for(const p of threats[lane])nearest=Math.min(nearest,dist(p,post));
      const level:0|1|2|3=!threats[lane].length?0:nearest<7||nearest<16&&post.hp/post.maxHp<.35?3:nearest<22?2:1;
      return {lane,level,targets:threats[lane].map(p=>p.id),x:post.x,z:post.z,structure:post.id};
    });
    this.challenges.tick(now);
    if(v.phase==='assault'&&v.remaining===0){
      v.nextWaveAt=now+SIEGE_PACING.break;
      const grace=emergency?.id===v.wave&&emergency.phase==='active'?Math.min(v.nextWaveAt,emergency.endsAt):now;
      if(emergency?.id===v.wave&&emergency.phase==='active')emergency.endsAt=grace;
      v.points+=this.challenges.finish(now,grace);v.phase='preparation';this.planWave(v.wave+1);
    }
  }
}

export function gateWaypoint(from:{x:number;z:number},to:{x:number;z:number}){
  if((from.z<20)===(to.z<20)){
    const dx=to.x-from.x;
    const blocked=[-8.7,8.7].some(x=>{
      if(Math.abs(dx)<.001)return false;
      const a=Math.max(0,Math.min((x-1.2-from.x)/dx,(x+1.2-from.x)/dx));
      const b=Math.min(1,Math.max((x-1.2-from.x)/dx,(x+1.2-from.x)/dx));
      if(a>b)return false;
      const z1=from.z+(to.z-from.z)*a,z2=from.z+(to.z-from.z)*b;
      return Math.max(z1,z2)>17.95&&Math.min(z1,z2)<22.05;
    });
    if(!blocked)return undefined;
    const front=from.z<20,z=front?16:24;
    return {x:Math.abs(from.x)>7&&(front?from.z>16.5:from.z<23.5)?from.x:to.x,z};
  }
  const dz=to.z-from.z;
  if(Math.abs(dz)<.001||Math.max(from.z,to.z)<18||Math.min(from.z,to.z)>22)return undefined;
  const entry=Math.max(0,Math.min((18-from.z)/dz,(22-from.z)/dz));
  const exit=Math.min(1,Math.max((18-from.z)/dz,(22-from.z)/dz));
  const dx=to.x-from.x;
  if(Math.max(Math.abs(from.x+dx*entry),Math.abs(from.x+dx*exit))<=6.5)return undefined;
  const approaching=dz>0,near=approaching?15:26,far=approaching?26:15;
  const align=Math.abs(from.x)>6.5||Math.abs(from.x)>1&&(approaching?from.z<18:from.z>22);
  return {x:0,z:align?near:far};
}
