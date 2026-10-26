import {ENEMIES,type EnemyDefinition,type EnemyClips,type EnemyMove} from '../../survival/enemies';
const clips:EnemyClips={idle:['idle'],run:['run'],walk:['walk'],hit:['hit'],down:['knockdown'],getup:['getup'],death:['die'],taunt:['roar'],guard:['roar']};
const own=(name:string)=>`/assets/objectives/enemies/${name}.glb`;
const attack=(name:string,heavy=false):EnemyMove=>({name,slot:heavy?'heavy':'light',clip:[heavy?'kick':'punch'],clipSeconds:heavy?1.4333:2.2,duration:heavy?1.4:1.1,contacts:[heavy?.72:.54],damage:heavy?48:25,range:heavy?2.7:2,radius:heavy?.8:.55,stamina:0,cooldown:heavy?2.8:1.3,stun:.35,knockback:heavy?7:3,style:'melee',lunge:heavy?3:2,minRange:0,maxRange:heavy?3.2:2.4});
const projectile=(name:string,element:EnemyMove['element']):EnemyMove=>({name,slot:'special',clip:['cast'],clipSeconds:2.5,duration:2.2,contacts:[1.42],damage:24,range:18,radius:.45,stamina:0,cooldown:8,stun:.3,knockback:3,style:'projectile',speed:27,minRange:4,maxRange:16,element});
interface Family {id:string;name:string;series:string;model:string;motion?:'humanoid';gunner?:string;heavy?:string;heavyNative?:boolean;native?:'cipher';element?:EnemyMove['element'];height?:number;}
const GENERATED='Generated for Jump with Meshy; existing shared humanoid motion. Last Stand adaptation.';
const families:Family[]=[
 {id:'shinobi',name:'Masked shinobi',series:'Naruto Shippuden',model:own('masked-shinobi'),motion:'humanoid',element:'steel',height:1.9},
 {id:'hollow',name:'Hollow',series:'Bleach',model:own('hollow-stalker'),motion:'humanoid',heavy:own('hollow-golem'),heavyNative:true,element:'cero'},
 {id:'cell',name:'Cell Jr.',series:'Dragon Ball',model:own('cell-scout'),element:'ki',height:1.45},
 {id:'pirate',name:'Beast pirate',series:'One Piece',model:own('beast-raider'),element:'sound'},
 {id:'chess',name:'Chess soldier',series:'One Piece',model:own('chess-guard'),motion:'humanoid',element:'steel'},
 {id:'cipher',name:'Cipher Pol agent',series:'One Piece',model:own('cipher-agent'),native:'cipher',element:'steel'},
 {id:'curse',name:'Cursed spirit',series:'Jujutsu Kaisen',model:own('cursed-spirit'),motion:'humanoid',element:'dark'},
 {id:'ant',name:'Chimera ant soldier',series:'Hunter × Hunter',model:own('chimera-ant'),motion:'humanoid',element:'jade'},
 {id:'apostle',name:'Apostle spawn',series:'Berserk',model:own('apostle-beast'),motion:'humanoid',element:'blood'},
 {id:'undead',name:'Vampire guard',series:'JoJo',model:own('vampire-guard'),native:'cipher',element:'blood'},
];
export const SIEGE_ENEMY_IDS:string[]=[];
for(const f of families)for(const rank of ['fodder','gunner','brute','captain','medic','sapper'] as const){
 const id=`siege-${f.id}-${rank}`,heavy=rank==='brute'||rank==='captain';
 if(ENEMIES[id])throw new Error(`Last Stand enemy collides with shared kit: ${id}`);
 let moves=[attack(f.name+' strike'),attack(f.name+' heavy',true)];
 let stateClips=clips;
 if(f.native==='cipher'){
  stateClips={...ENEMIES.kaku.clips,down:['_slammed'],getup:['_jump_end'],blown:['_slammed'],land:['_slammed'],dash:['_dodge','_boost'],jump:['_boost'],fall:['_slammed']};moves=ENEMIES.kaku.moves.slice(0,2).map(m=>({...m,damage:m.damage*.58,rest:undefined,callout:false,cooldown:2.2}));
 }
 if(!f.native){
  const monster=['hollow','curse','ant','apostle','undead'].includes(f.id);
  const blades=['shinobi','pirate','chess'].includes(f.id);
  const light=monster?'claw':blades?'slash':'jab';
  const heavyClip=f.id==='hollow'&&heavy?'hammer':monster?'combo':blades?'charged-slash':'uppercut';
  const seconds:Record<string,number>={claw:2.2,slash:1.2333,jab:1.4,hammer:1.5667,combo:2.3,'charged-slash':1.8,uppercut:1.0333};
  moves=moves.map((m,i)=>({...m,clip:[i?heavyClip:light],clipSeconds:seconds[i?heavyClip:light]}));
  stateClips={...clips,taunt:['cast'],walk:monster?['walk-monster','walk']:['walk'],run:monster?['run-sprint','run']:['run-charge','run'],blown:['launched','hit'],land:['knockdown'],fall:['launched']};
 }
 if(rank==='gunner'){
  const shot=projectile(f.id==='shinobi'?'Thrown kunai':f.id==='hollow'?'Cero':f.id==='cell'?'Ki blast':'Ranged assault',f.element);
  if(f.native==='cipher')shot.clip=['_combo_b'];
  moves=[shot,moves[0]];
 }
 const def:EnemyDefinition={id,name:`${f.name}${rank==='fodder'?'':rank==='gunner'?' · ranged':rank==='brute'?' · breaker':` · ${rank}`}`,series:f.series,role:rank==='gunner'?'gunner':heavy?'brute':'fodder',brain:rank==='gunner'?'gunner':heavy?'brute':'swarm',model:heavy?(f.heavy??f.model):rank==='gunner'?(f.gunner??f.model):f.model,motion:heavy&&f.heavyNative?undefined:f.motion,height:(f.height??1.95)*(heavy?1.22:1),hp:heavy?600:rank==='gunner'?130:180,size:heavy?1.25:1,poise:heavy?180:undefined,speed:heavy?.62:.8,knockbackIn:heavy?.5:1,stunIn:heavy?.8:1,moves,clips:stateClips,xp:heavy?6:1,score:heavy?260:60,cost:heavy?4:1,color:0xc0a785};
 ENEMIES[id]=def;SIEGE_ENEMY_IDS.push(id);
}
