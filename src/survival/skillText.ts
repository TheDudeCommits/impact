import { burnAt, upgrade } from './upgrades';
import { BRANCHES, TIERS, TIER_POINTS, TREE_NODE, branchPoints, forkOf, keystoneOf, rankOf, maxRank, takenInstead, type SkillNode } from './skillTree';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const less = (base: number, n: number) => pct(1 - Math.pow(base, n));

export function rankText(id: string, n: number, level = 1): string {
  if (n <= 0) return '';
  switch (id) {
    case 'iron-fist': return `+${15 * n}% damage with every attack.`;
    case 'keen-eye': return `+${8 * n}% chance to land a critical hit.`;
    case 'focus': return `Your moves recharge ${less(.9, n)} faster.`;
    case 'burning-blade': return `Your hits set enemies alight: ${burnAt(2 + 10 * n, level)} damage a second for 3 seconds.`;
    case 'thunder-chain': return `${pct(.2 + .05 * (n - 1))} of your hits arc lightning into ${1 + n} nearby enemies, ${30 + 15 * n} damage each.`;
    case 'executioner': return `+${60 * n}% damage to enemies under 30% health.`;
    case 'flying-slash': return `Every ${Math.max(4, 7 - n)}th hit of an unbroken combo throws a crescent through everything ahead: ${45 + 45 * n} damage.`;
    case 'rending-cut': return `Your heavy blows leave a cut that bursts a moment later for ${pct(.3 + .3 * n)} of the blow, all round the body.`;
    case 'afterimage': return `Your specials strike again as an afterimage half a second later, for ${pct(.2 + .2 * n)} of each blow.`;
    case 'counter-art': return `A just guard (a block on the beat) blasts everything around you for ${110 * n}.`;
    case 'limit-break': return '+30% damage, critical hits deal +50%, and awakening lasts 8 seconds longer.';
    case 'god-speed': return '+20% speed, your moves recharge 25% faster, and they cost half the stamina.';
    case 'shockwave': return `Every ${Math.max(4, 10 - n * 2)}th hit you land releases a shockwave around you: ${40 + 30 * n} damage.`;
    case 'chain-reaction': return `Enemies burst when they die, dealing ${pct(.35 * n)} of their health to everything near them.`;
    case 'ki-surge': return `Your specials and ultimates deal ${12 * n}% more damage.`;
    case 'flash-step': return `Your dash cuts through every enemy you pass, for ${15 + 45 * n}.`;
    case 'burst-point': return `Every special hit bursts round what it hit, for ${pct(.15 + .15 * n)} of the blow.`;
    case 'blazing-ki': return `Your specials set the ground they hit burning for 3 seconds: ${burnAt(10 + 15 * n, level)} a second to whatever stands in it.`;
    case 'storm-ki': return `Your specials call lightning down on ${1 + n} enemies near what they hit, ${40 + 30 * n} each.`;
    case 'ki-vortex': return `Your specials drag the crowd within ${3 + 2 * n} metres toward what they hit.`;
    case 'ultimate-echo': return `Your ultimate strikes again a moment later, for ${pct(.2 + .3 * n)} of each blow.`;
    case 'ultimate-rush': return `An ultimate that lands gives back ${10 + 20 * n}% of the meter.`;
    case 'awakening-nova': return `Awakening bursts out of you: ${100 + 250 * n} to everything within 9 metres, and the lesser enemies are stunned.`;
    case 'ki-armor': return 'While awakened, take 40% less damage and heal 2% of your health a second.';
    case 'limitless': return 'While awakened, your moves recharge three times as fast.';
    case 'killing-intent': return 'Every kill takes 0.35 seconds off every move still recharging.';
    case 'tough-body': return `+${200 * n} maximum health (and it heals you as you take it).`;
    case 'fleet-foot': return `+${9 * n}% movement speed.`;
    case 'second-breath': return `Attacks cost ${less(.78, n)} less stamina, and it comes back ${4 * n} a second faster.`;
    case 'bloodlust': return `Heal ${3 * n}% of the damage you deal.`;
    case 'guardian': return `Take ${less(.9, n)} less damage.`;
    case 'gravity': return `Orbs are pulled in from ${60 * n}% further away.`;
    case 'training': return `+${20 * n}% experience from every orb.`;
    case 'soul-harvest': return `Every kill heals ${(.5 * n).toFixed(1).replace(/\.0$/, '')}% of your maximum health; a boss, 5%.`;
    case 'fighting-spirit': return `Your ultimate charges ${30 * n}% faster.`;
    case 'awakened-soul': return `Awakening lasts ${5 * n} seconds longer and charges ${25 * n}% faster.`;
    case 'overdrive': return `Start every wave with ${Math.min(100, 50 * n)}% of your ultimate.`;
    case 'undying-will': return `When you fall, rise again with half your health${n > 1 ? ` - ${n} times a run` : ' - once a run'}.`;
    case 'berserker-armor': return 'Below half health the armor takes over: +50% damage, +20% speed and 8% lifesteal.';
    case 'momentum': return `An unbroken combo hits harder: +${Math.round((.02 + .02 * n) * 100)}% damage every 10 hits, up to +${Math.round((.02 + .02 * n) * 500)}%.`;
    case 'overflow': return `A special that lands pours ${8 * n}% into your ultimate (once a cast).`;
    case 'second-wind': return 'Once a round, falling under 25% health brings 35% of it back.';
    default: return upgrade(id).describe(n - 1, level);
  }
}

function buildRankText(id:string,n:number,level:number,picks:readonly string[]):string {
  const has=(id:string)=>picks.includes(id);
  if(id==='burning-blade'&&has('searing-edge'))return `Your hits burn for ${burnAt((2+10*n)*1.8,level)} damage a second for 3 seconds, including Searing Edge.`;
  if(id==='thunder-chain'&&(has('forked-current')||has('focused-current'))){
    const fork=has('forked-current'),chance=.2+.05*(n-1)+(fork?0:.1),damage=(30+15*n)*(fork?.8:1.6);
    return `${pct(chance)} of your hits arc lightning into ${1+n+(fork?2:0)} nearby enemies, ${Number(damage.toFixed(1))} damage each, including ${fork?'Forked Current':'Focused Current'}.`;
  }
  if(id==='flash-step'&&(has('phase-strike')||has('slipstream'))){const strike=has('phase-strike');return `Your dash cuts through every enemy you pass for ${Number(((15+45*n)*(strike?1.7:.7)).toFixed(1))}, including ${strike?'Phase Strike':'Slipstream'}.`;}
  if(id==='guardian'&&has('anchored-soul'))return `Take ${pct(1-Math.pow(.9,n)*.88)} less damage, including Anchored Soul.`;
  return rankText(id,n,level);
}

export interface Requirement { text: string; met: boolean }
export interface NodeInfo {
  name: string; kanji: string;
  kind: 'TECHNIQUE' | 'PASSIVE' | 'KEY PASSIVE';
  tags: string[];
  rank: number; max: number;
  now?: string; next?: string;
  requires: Requirement[];
  seals: string[];
  flavour: string;
}

export function nodeInfo(node: SkillNode, picks: readonly string[], level = 1, unlocked: readonly string[] = []): NodeInfo {
  const def = upgrade(node.id), rank = rankOf(picks, node.id), max = maxRank(node.id);
  const branch = BRANCHES.find(b => b.id === node.branch)!, tier = TIERS[node.tier];
  const kind: NodeInfo['kind'] = node.keystone ? 'KEY PASSIVE' : node.technique ? 'TECHNIQUE' : 'PASSIVE';
  const tags = [branch.name, tier.name, ...(node.path ? [`PATH OF ${node.path}`] : [])];
  const requires: Requirement[] = [];
  if (node.requires) requires.push({ text: `Learn ${upgrade(node.requires).name}`, met: rankOf(picks, node.requires) > 0 });
  if (node.unlock) requires.push({ text: unlocked.includes(node.id) ? 'Unlocked with shards' : `Unlock it with ${node.unlock} shards: RIFT PROFILE, after a run`, met: unlocked.includes(node.id) });
  const need = TIER_POINTS[node.tier], spent = branchPoints(picks, node.branch);
  if (need) requires.push({ text: `${need} points spent in ${branch.name} (${Math.min(spent, need)}/${need})`, met: spent >= need });
  const seals: string[] = [];
  if (node.fork) {
    const others = forkOf(node.fork).filter(other => other.id !== node.id);
    const instead = takenInstead(picks, node.id);
    if (instead) requires.push({ text: `The path of ${instead.path ?? upgrade(instead.id).name} was chosen instead`, met: false });
    else if (!rank) seals.push(...others.map(other => `${upgrade(other.id).name}${other.path ? ` (${other.path})` : ''}`));
  }
  if (node.keystone) {
    const key = keystoneOf(picks);
    if (key && key.id !== node.id) requires.push({ text: `A build has one key passive: ${upgrade(key.id).name} was taken`, met: false });
    else if (!key) seals.push('every other key passive');
  }
  return {
    name: def.name, kanji: def.kanji, kind, tags, rank, max,
    now: rank ? buildRankText(node.id, rank, level, picks) : undefined,
    next: rank < max ? buildRankText(node.id, rank + 1, level, picks) : undefined,
    requires, seals, flavour: node.line,
  };
}

export { TREE_NODE };
