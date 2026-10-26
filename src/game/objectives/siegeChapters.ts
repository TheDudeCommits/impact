import './siegeEnemies';
import {ENEMIES} from '../../survival/enemies';

export type TrapTheme='wire'|'purify'|'harpoon'|'discharge';
export interface SiegeChapter {
  id:string; title:string; army:number; commanders:readonly string[];
  low:readonly string[]; mid:readonly string[]; trap:TrapTheme;
}
export const SIEGE_CHAPTERS:readonly SiegeChapter[]=[
  {id:'naval-blockade',title:'NAVAL BLOCKADE',army:0,commanders:['akainu'],low:['sentomaru'],mid:['aokiji','kizaru'],trap:'harpoon'},
  {id:'hollow-moon',title:'THE HOLLOW MOON',army:2,commanders:['aizen'],low:['grimmjow','hollow-ichigo'],mid:['ulquiorra','kenpachi'],trap:'purify'},
  {id:'shinobi-siege',title:'SHADOWS OF THE LEAF',army:1,commanders:['madara'],low:['siege-shinobi-captain'],mid:['siege-shinobi-brute'],trap:'wire'},
  {id:'emperor-raid',title:'THE EMPERORS’ RAID',army:4,commanders:['kaido','blackbeard','whitebeard'],low:['king'],mid:['king'],trap:'harpoon'},
  {id:'zero-mortals',title:'SKY OF DESTRUCTION',army:3,commanders:['jiren','goku-black','golden-frieza'],low:['siege-cell-captain'],mid:['goku-black','golden-frieza'],trap:'discharge'},
  {id:'government-agents',title:'ORDERS TO ERASE',army:5,commanders:['lucci'],low:['kaku','jabra','blueno'],mid:['kaku','jabra'],trap:'wire'},
  {id:'whole-cake',title:'THE EMPRESS’ COURT',army:6,commanders:['bigmom'],low:['siege-chess-captain'],mid:['katakuri'],trap:'harpoon'},
  {id:'cursed-night',title:'NIGHT OF CURSES',army:7,commanders:['sukuna'],low:['siege-curse-captain'],mid:['siege-curse-brute'],trap:'purify'},
  {id:'ant-invasion',title:'THE KING’S NEST',army:8,commanders:['meruem'],low:['siege-ant-captain'],mid:['siege-ant-brute'],trap:'wire'},
  {id:'eclipse',title:'UNDER THE ECLIPSE',army:9,commanders:['griffith'],low:['siege-apostle-captain'],mid:['siege-apostle-brute'],trap:'purify'},
  {id:'eternal-night',title:'THE ENDLESS NIGHT',army:10,commanders:['dio'],low:['siege-undead-captain'],mid:['siege-undead-brute'],trap:'purify'},
];
export const MARINE_BOSSES=new Set(['sentomaru','aokiji','kizaru','akainu']);
const hash=(n:number)=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;};
export function siegeChapter(wave:number,seed:number){
  const chapter=Math.floor((Math.max(1,Math.floor(wave))-1)/10);
  const deck=SIEGE_CHAPTERS.map((entry,i)=>({entry,key:hash((seed|0)^Math.imul(i+1,2654435761))})).sort((a,b)=>a.key-b.key);
  const definition=deck[chapter%deck.length].entry;
  const commander=definition.commanders[hash((seed|0)+chapter*104729)%definition.commanders.length];
  return {definition,number:chapter+1,firstWave:chapter*10+1,lastWave:chapter*10+10,commander};
}
export function chapterBoss(wave:number,seed:number,tier:'low'|'mid'|'high'|null){
  if(!tier)return null;
  const chapter=siegeChapter(wave,seed);
  if(tier==='high')return chapter.commander;
  const pool=chapter.definition[tier].filter(id=>id!==chapter.commander);
  return pool[hash((seed|0)+wave*7919)%pool.length];
}
for(const c of SIEGE_CHAPTERS)for(const id of [...c.commanders,...c.low,...c.mid]){
  if(!ENEMIES[id]?.model||!ENEMIES[id]?.moves.length)throw new Error(`Unplayable chapter encounter: ${c.id}/${id}`);
  if(c.army===0&&!MARINE_BOSSES.has(id))throw new Error(`Non-Marine boss assigned Marines: ${id}`);
}
