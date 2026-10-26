import {ENEMIES} from '../../survival/enemies';
import {siegeChapter} from './siegeChapters';

const family=(id:string,name:string)=>({name,fodder:`siege-${id}-fodder`,gunner:`siege-${id}-gunner`,brute:`siege-${id}-brute`,specialists:{captain:`siege-${id}-captain`,medic:`siege-${id}-medic`,sapper:`siege-${id}-sapper`}});
export const SIEGE_ARMIES=[
 {name:'MARINES',fodder:'marine',gunner:'marine-rifleman',brute:'marine-brute',specialists:{captain:'marine-brute',medic:'marine',sapper:'marine'}},
 family('shinobi','MASKED SHINOBI'),family('hollow','HOLLOWS'),family('cell','CELL BROOD'),family('pirate','BEAST PIRATES'),family('cipher','CIPHER POL'),family('chess','CHESS SOLDIERS'),family('curse','CURSED SPIRITS'),family('ant','CHIMERA ANTS'),family('apostle','APOSTLES'),family('undead','VAMPIRIC HUSKS'),
];

export function siegeArmy(wave:number,seed=1){
  return SIEGE_ARMIES[siegeChapter(wave,seed).definition.army];
}

for(const army of SIEGE_ARMIES)for(const id of [army.fodder,army.gunner,army.brute]){
  if(!ENEMIES[id]?.model||!ENEMIES[id]?.moves.length)throw new Error(`Last Stand army has no playable kit: ${id}`);
}
