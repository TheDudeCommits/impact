export type MusicPhase = 'lobby' | 'combat' | 'results';
export type AnimeSeries = 'dragon-ball' | 'naruto' | 'one-piece' | 'jojo' | 'bleach' | 'jujutsu-kaisen' | 'berserk' | 'hunter-x-hunter';
export interface MusicTrack { id: string; title: string; artist: string; series: AnimeSeries; category: 'opening' | 'ending' | 'score' | 'film-theme'; url: string; scope: 'homescreen' | 'gameplay' }

function track(id:string,title:string,artist:string,series:AnimeSeries,category:MusicTrack['category'],scope:MusicTrack['scope']='gameplay'):MusicTrack {
  return {id,title,artist,series,category,scope,url:`/assets/music/${id}.m4a`};
}
export const MUSIC_TRACKS:Record<string,MusicTrack>={
  'dragon-ball-cha-la-head-cha-la':track('dragon-ball-cha-la-head-cha-la','CHA-LA HEAD-CHA-LA','Hironobu Kageyama','dragon-ball','opening'),
  'dragon-ball-genkai-toppa-survivor':track('dragon-ball-genkai-toppa-survivor','Genkai Toppa × Survivor','Kiyoshi Hikawa','dragon-ball','opening'),
  'naruto-silhouette':track('naruto-silhouette','Silhouette','KANA-BOON','naruto','opening'),
  'naruto-blue-bird-akano':track('naruto-blue-bird-akano','Blue Bird (Akano cover)','Akano','naruto','opening'),
  'one-piece-we-are-first-take':track('one-piece-we-are-first-take','We Are! (THE FIRST TAKE)','Hiroshi Kitadani','one-piece','opening'),
  'one-piece-memories':track('one-piece-memories','Memories','Maki Otsuki','one-piece','ending'),
  'one-piece-overtaken-epic':track('one-piece-overtaken-epic','Overtaken — Epic Version (Drums of Liberation)','Samuel Kim Music','one-piece','score'),
  'jojo-il-vento-doro':track('jojo-il-vento-doro','il vento d’oro','Yugo Kanno','jojo','score'),
  'jojo-bloody-stream':track('jojo-bloody-stream','BLOODY STREAM','Coda','jojo','opening'),
  'bleach-number-one-bankai':track('bleach-number-one-bankai','Number One - Bankai','Shiro Sagisu','bleach','score'),
  'bleach-asterisk':track('bleach-asterisk','*Asterisk','ORANGE RANGE','bleach','opening'),
  'home-never-meant-to-belong':track('home-never-meant-to-belong','never meant to belong','Shiro SAGISU','bleach','score','homescreen'),
  'home-many-nights':track('home-many-nights','Many Nights','Yasuharu Takanashi, YAIBA','naruto','score','homescreen'),
  'home-girei':track('home-girei','Girei (Pain’s Theme)','Geek Music','naruto','score','homescreen'),
  'home-gats':track('home-gats','Gats','Susumu Hirasawa','berserk','score','homescreen'),
  'home-kingdom-of-predators':track('home-kingdom-of-predators','Kingdom of Predators','Yoshihisa Hirano','hunter-x-hunter','score','homescreen'),
  'hunter-x-hunter-hunting-for-your-dream':track('hunter-x-hunter-hunting-for-your-dream','HUNTING FOR YOUR DREAM','GALNERYUS','hunter-x-hunter','ending','gameplay'),
  'hunter-x-hunter-departure':track('hunter-x-hunter-departure','departure!','Masatoshi Ono','hunter-x-hunter','opening','gameplay'),
  'berserk-tell-me-why':track('berserk-tell-me-why','TELL ME WHY','PENPALS','berserk','opening','gameplay'),
  'jujutsu-kaisen-kaikai-kitan':track('jujutsu-kaisen-kaikai-kitan','Kaikai Kitan','Eve','jujutsu-kaisen','opening','gameplay'),
  'jujutsu-kaisen-specialz':track('jujutsu-kaisen-specialz','SPECIALZ','King Gnu','jujutsu-kaisen','opening','gameplay'),
};
function survivalAlias(id:string,from:string):MusicTrack{return {...MUSIC_TRACKS[from],id,scope:'gameplay'};}
export const SURVIVAL_MUSIC:readonly MusicTrack[]=[
  survivalAlias('rift-gats','home-gats'),
  MUSIC_TRACKS['bleach-number-one-bankai'],
  survivalAlias('rift-girei','home-girei'),
  MUSIC_TRACKS['one-piece-overtaken-epic'],
  survivalAlias('rift-kingdom-of-predators','home-kingdom-of-predators'),
  survivalAlias('rift-never-meant-to-belong','home-never-meant-to-belong'),
];
export let RIFT_SCORE='rift';
export function riftMoment(series:AnimeSeries|undefined,moment:'hunt'|'boss',round=0){RIFT_SCORE=`rift:${series??'rift'}:${moment}:${round}`;}
export function riftMomentReset(){RIFT_SCORE='rift';}
const RIFT_SONGS:Record<AnimeSeries,{hunt:readonly string[];boss:readonly string[]}>={
  'one-piece':{hunt:['one-piece-we-are-first-take','one-piece-memories'],boss:['one-piece-overtaken-epic']},
  bleach:{hunt:['bleach-asterisk'],boss:['bleach-number-one-bankai','rift-never-meant-to-belong']},
  'dragon-ball':{hunt:['dragon-ball-cha-la-head-cha-la'],boss:['dragon-ball-genkai-toppa-survivor']},
  naruto:{hunt:['naruto-silhouette','naruto-blue-bird-akano'],boss:['rift-girei','rift-many-nights']},
  jojo:{hunt:['jojo-bloody-stream'],boss:['jojo-il-vento-doro']},
  'jujutsu-kaisen':{hunt:['jujutsu-kaisen-kaikai-kitan'],boss:['jujutsu-kaisen-specialz']},
  berserk:{hunt:['berserk-tell-me-why'],boss:['rift-gats']},
  'hunter-x-hunter':{hunt:['hunter-x-hunter-departure','hunter-x-hunter-hunting-for-your-dream'],boss:['rift-kingdom-of-predators']},
};
const RIFT_ALIASES:Record<string,MusicTrack>={'rift-many-nights':survivalAlias('rift-many-nights','home-many-nights')};
const riftTrack=(id:string)=>MUSIC_TRACKS[id]??SURVIVAL_MUSIC.find(t=>t.id===id)??RIFT_ALIASES[id];
export function seriesOfUniverse(universe:string|undefined):AnimeSeries|undefined{
  const u=(universe??'').toUpperCase();
  return u.includes('ONE PIECE')?'one-piece':u.includes('BLEACH')?'bleach':u.includes('DRAGON BALL')?'dragon-ball':u.includes('NARUTO')?'naruto'
    :u.includes('JOJO')?'jojo':u.includes('JUJUTSU')?'jujutsu-kaisen':u.includes('BERSERK')?'berserk':u.includes('HUNTER')?'hunter-x-hunter':undefined;
}
import { FIGHTER_SERIES as CARD_SERIES } from '../game/fighterSeries';
const SOUNDTRACK:Readonly<Record<string,AnimeSeries>>={
  'Dragon Ball':'dragon-ball',Naruto:'naruto','Naruto Shippuden':'naruto','One Piece':'one-piece','JoJo’s Bizarre Adventure':'jojo',
  Bleach:'bleach','Jujutsu Kaisen':'jujutsu-kaisen',Berserk:'berserk','Hunter × Hunter':'hunter-x-hunter','Hunter x Hunter':'hunter-x-hunter',
};
export const FIGHTER_SERIES:Record<string,AnimeSeries>=Object.fromEntries(Object.entries(CARD_SERIES).flatMap(([id,series])=>SOUNDTRACK[series]?[[id,SOUNDTRACK[series]]]:[]));
const SCORED_FIGHTERS=new Set<string>(Object.keys(CARD_SERIES).filter(id=>!FIGHTER_SERIES[id]));
export const HOME_MUSIC_IDS = [
  'home-never-meant-to-belong','home-many-nights','home-girei','home-gats','home-kingdom-of-predators',
] as const;
const phases:Record<AnimeSeries,Record<Exclude<MusicPhase,'lobby'>,string>>={
  'dragon-ball':{combat:'dragon-ball-genkai-toppa-survivor',results:'dragon-ball-cha-la-head-cha-la'},
  naruto:{combat:'naruto-silhouette',results:'naruto-blue-bird-akano'},
  'one-piece':{combat:'one-piece-overtaken-epic',results:'one-piece-memories'},
  jojo:{combat:'jojo-il-vento-doro',results:'jojo-bloody-stream'},
  bleach:{combat:'bleach-number-one-bankai',results:'bleach-asterisk'},
  'jujutsu-kaisen':{combat:'jujutsu-kaisen-kaikai-kitan',results:'jujutsu-kaisen-specialz'},
  berserk:{combat:'berserk-tell-me-why',results:'berserk-tell-me-why'},
  'hunter-x-hunter':{combat:'hunter-x-hunter-hunting-for-your-dream',results:'hunter-x-hunter-departure'},
};
export function selectMusicTracks(localFighter:string,opponentFighter:string|undefined,phase:MusicPhase):MusicTrack[]{
  if(phase==='lobby')return HOME_MUSIC_IDS.map(id=>MUSIC_TRACKS[id]);
  if(localFighter==='rift'||localFighter.startsWith('rift:')){
    if(phase==='results')return [SURVIVAL_MUSIC[5],...SURVIVAL_MUSIC.slice(0,5)];
    const [,series,moment,round]=localFighter.split(':');
    const turn=Number(round)||0;
    const songs=RIFT_SONGS[series as AnimeSeries]??RIFT_SONGS[(['jojo','jujutsu-kaisen','berserk','hunter-x-hunter'] as const)[turn%4]];
    const spin=<T,>(list:readonly T[])=>list.map((_,i)=>list[(i+turn)%list.length]);
    const own=(moment==='boss'?[...spin(songs.boss),...spin(songs.hunt)]:[...spin(songs.hunt),...spin(songs.boss)]).map(riftTrack).filter((t):t is MusicTrack=>!!t);
    const seen=new Set(own.map(t=>t.id));
    const scores=SURVIVAL_MUSIC.filter(t=>!seen.has(t.id));
    for(const t of scores)seen.add(t.id);
    const rest=Object.values(RIFT_SONGS).flatMap(each=>[...each.boss,...each.hunt]).map(riftTrack).filter((t):t is MusicTrack=>!!t&&!seen.has(t.id));
    return [...own,...scores,...rest.filter((t,i,all)=>all.findIndex(o=>o.id===t.id)===i)];
  }
  const series=[...new Set([FIGHTER_SERIES[localFighter],opponentFighter?FIGHTER_SERIES[opponentFighter]:undefined])].filter((s):s is AnimeSeries=>Boolean(s));
  if(!series.length&&[localFighter,opponentFighter].some(f=>f!==undefined&&SCORED_FIGHTERS.has(f)))return [...SURVIVAL_MUSIC];
  const primary=series.map(s=>MUSIC_TRACKS[phases[s][phase]]);
  const seen=new Set(primary.map(t=>t.id));
  const remainder=series.flatMap(s=>Object.values(MUSIC_TRACKS).filter(t=>t.scope==='gameplay'&&t.series===s&&!seen.has(t.id)));
  return [...primary,...remainder];
}
