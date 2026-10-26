export interface AssaultPlan {
  title: string;
  hint: string;
  lanes: readonly number[];
  rangedEvery: number;
  bruteEvery: number;
  pace: number;
}

export function assaultPlan(wave: number, seed = 0): AssaultPlan {
  if (wave > 6 && seed) {
    const variant = ((Math.imul(seed | 0, 31) ^ Math.imul(wave, 7919)) >>> 0) % 9;
    if (variant === 6) return {title:'CROSSFIRE',hint:'Close on the rifle lines before they pin the gates',lanes:[0,2,0,2,1],rangedEvery:4,bruteEvery:12,pace:1.1};
    if (variant === 7) return {title:'SPLIT SPEAR',hint:'Break the heavy escort on both roads',lanes:[0,0,2,2,1],rangedEvery:10,bruteEvery:6,pace:1};
    if (variant === 8) return {title:'FALSE RETREAT',hint:'Cover the far road while the vanguard draws you in',lanes:[1,1,1,1,0,2,0,2],rangedEvery:8,bruteEvery:9,pace:.95};
  }
  const cycle = (Math.max(1, Math.floor(wave)) - 1) % 6;
  if (cycle === 0) return {title:'VANGUARD',hint:'Intercept the advance',lanes:[1,1,1,0,2,0,2],rangedEvery:8,bruteEvery:10,pace:1};
  if (cycle === 1) return {title:'PINCER',hint:'Hold both flanks',lanes:[0,2],rangedEvery:8,bruteEvery:10,pace:1};
  if (cycle === 2) return {title:'GATE CRASHERS',hint:'Cut down the vanguard',lanes:[1,0,2,1],rangedEvery:8,bruteEvery:10,pace:1};
  if (cycle === 3) {
    const flank = Math.floor((wave - 1) / 6) % 2 ? 0 : 2;
    return {title:flank===0?'WESTERN RUSH':'EASTERN RUSH',hint:'Reinforce the threatened road',lanes:[flank,flank,flank,1],rangedEvery:9,bruteEvery:8,pace:.8};
  }
  if (cycle === 4) return {title:'ENCIRCLEMENT',hint:'Break through the encircling ranks',lanes:[0,2,1],rangedEvery:7,bruteEvery:10,pace:.9};
  return {title:'BREAKTHROUGH',hint:'Stop the heavy vanguard',lanes:[1,1,0,2],rangedEvery:9,bruteEvery:6,pace:1};
}
