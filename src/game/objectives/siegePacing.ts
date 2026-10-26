import {chapterBoss} from './siegeChapters';
export type SiegeBossTier='low'|'mid'|'high';
export const SIEGE_PACING={firstBreak:4,break:6,spawnGap:.65,batch:3,bodySeconds:1.8,shotGap:1.2,rifleRecovery:8} as const;
export function siegeBossTier(wave:number):SiegeBossTier|null{return wave%10===0?'high':wave%5===0?'mid':wave%3===0?'low':null;}
export function siegeBoss(wave:number,seed:number){return chapterBoss(wave,seed,siegeBossTier(wave));}
export const siegeCount=(wave:number,players:number)=>Math.min(120,22+wave*4+Math.max(0,players-1)*8);
export const siegeLimit=(wave:number,players:number)=>Math.min(36,20+Math.min(wave,8)+Math.max(0,players-1)*3);
