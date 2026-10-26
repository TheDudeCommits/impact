export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface RunStats {
  damage: number;
  damageIn: number;
  speed: number;
  cooldown: number;
  stamina: number;
  meterGain: number;
  awakenGain: number;
  awakenSeconds: number;
  lifesteal: number;
  crit: number;
  critDamage: number;
  staminaRegen: number;
  maxHp: number;
  magnet: number;
  xpGain: number;
  healOnKill: number;
  regen: number;
  shockwaveEvery: number;
  shockwaveDamage: number;
  crescentEvery: number;
  crescentDamage: number;
  rend: number;
  echo: number;
  chainChance: number;
  chain: number;
  chainDamage: number;
  burn: number;
  execute: number;
  parryBlast: number;
  killBlast: number;
  waveMeter: number;
  revives: number;
  berserk: number;
  kiDamage: number;
  flashCut: number;
  burst: number;
  blaze: number;
  storm: number; stormDamage: number;
  vortex: number;
  ultEcho: number;
  ultRefund: number;
  nova: number;
  kiArmor: number;
  limitless: number;
  killRecharge: number;
  momentum: number;
  overflow: number;
  secondWind: number;
}

export const BASE_STATS: Readonly<RunStats> = {
  damage: 1.45, damageIn: 1, speed: 1, cooldown: 1, stamina: .4, staminaRegen: 18, meterGain: .45, awakenGain: .7, awakenSeconds: 0,
  lifesteal: 0, crit: .04, critDamage: 1.75, maxHp: 0, magnet: 3.2, xpGain: 1, healOnKill: 0, regen: 0,
  shockwaveEvery: 0, shockwaveDamage: 0, crescentEvery: 0, crescentDamage: 0, rend: 0, echo: 0, chainChance: 0, chain: 0, chainDamage: 0, burn: 0, execute: 0,
  parryBlast: 0, killBlast: 0, waveMeter: 0, revives: 0, berserk: 0,
  kiDamage: 0, flashCut: 0, burst: 0, blaze: 0, storm: 0, stormDamage: 0, vortex: 0, ultEcho: 0, ultRefund: 0, nova: 0, kiArmor: 1, limitless: 1, killRecharge: 0,
  momentum: 0, overflow: 0, secondWind: 0,
};

export interface UpgradeDefinition {
  id: string;
  name: string;
  kanji: string;
  rarity: Rarity;
  max: number;
  describe: (held: number, level: number) => string;
  apply: (stats: RunStats, stacks: number) => void;
  icon: string;
  bought?: boolean;
  treeOnly?: boolean;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export const UPGRADES: readonly UpgradeDefinition[] = [
  { id: 'iron-fist', name: 'Iron Fist', kanji: '鉄拳', rarity: 'common', max: 6, icon: 'fist',
    describe: () => '+15% damage with every attack.', apply: (s, n) => { s.damage *= 1 + .15 * n; } },
  { id: 'tough-body', name: 'Tough Body', kanji: '頑丈', rarity: 'common', max: 5, icon: 'body',
    describe: () => '+200 maximum health, and heal it now.', apply: (s, n) => { s.maxHp += 200 * n; } },
  { id: 'fleet-foot', name: 'Fleet Foot', kanji: '瞬足', rarity: 'common', max: 3, icon: 'feet',
    describe: () => '+9% movement speed.', apply: (s, n) => { s.speed *= 1 + .09 * n; } },
  { id: 'focus', name: 'Focus', kanji: '集中', rarity: 'common', max: 4, icon: 'focus',
    describe: () => 'Moves recharge 10% faster.', apply: (s, n) => { s.cooldown *= Math.pow(.9, n); } },
  { id: 'second-breath', name: 'Second Breath', kanji: '呼吸', rarity: 'common', max: 3, icon: 'breath',
    describe: () => 'Attacks cost 22% less stamina, and it comes back faster.', apply: (s, n) => { s.stamina *= Math.pow(.78, n); s.staminaRegen += 4 * n; } },
  { id: 'fighting-spirit', name: 'Fighting Spirit', kanji: '闘志', rarity: 'common', max: 4, icon: 'spirit',
    describe: () => 'Your ultimate charges 30% faster.', apply: (s, n) => { s.meterGain *= 1 + .3 * n; } },
  { id: 'gravity', name: 'Gravity', kanji: '引力', rarity: 'common', max: 3, icon: 'magnet',
    describe: () => 'Orbs are pulled in from 60% further away.', apply: (s, n) => { s.magnet *= 1 + .6 * n; } },
  { id: 'training', name: 'Hard Training', kanji: '修行', rarity: 'common', max: 3, icon: 'scroll',
    describe: () => '+20% experience from every orb.', apply: (s, n) => { s.xpGain *= 1 + .2 * n; } },
  { id: 'keen-eye', name: 'Keen Eye', kanji: '見切り', rarity: 'rare', max: 4, icon: 'eye',
    describe: () => '+8% chance to land a critical hit.', apply: (s, n) => { s.crit += .08 * n; } },
  { id: 'bloodlust', name: 'Bloodlust', kanji: '血気', rarity: 'rare', max: 3, icon: 'fang',
    describe: () => 'Heal 3% of the damage you deal.', apply: (s, n) => { s.lifesteal += .03 * n; } },
  { id: 'guardian', name: 'Guardian', kanji: '守護', rarity: 'rare', max: 4, icon: 'shield',
    describe: () => 'Take 10% less damage.', apply: (s, n) => { s.damageIn *= Math.pow(.9, n); } },
  { id: 'shockwave', name: 'Shockwave', kanji: '衝撃', rarity: 'rare', max: 3, icon: 'wave',
    describe: held => held ? `Shockwaves hit harder (+30) and come every ${Math.max(4, 8 - held * 2)} hits.` : 'Every 8th hit releases a shockwave around you.',
    apply: (s, n) => { s.shockwaveEvery = Math.max(4, 10 - n * 2); s.shockwaveDamage = 40 + 30 * n; } },
  { id: 'thunder-chain', name: 'Thunder Chain', kanji: '雷鎖', rarity: 'rare', max: 3, icon: 'bolt',
    describe: held => held ? 'Lightning arcs to one more enemy and hits harder.' : '20% of hits arc lightning into two nearby enemies.',
    apply: (s, n) => { s.chainChance = .2 + .05 * (n - 1); s.chain = 1 + n; s.chainDamage = 30 + 15 * n; } },
  { id: 'burning-blade', name: 'Burning Blade', kanji: '炎刃', rarity: 'rare', max: 3, icon: 'flame',
    describe: (held, level) => held ? `+${burnAt(10, level)} burn damage a second.` : `Hits set enemies alight for ${burnAt(12, level)} damage a second.`,
    apply: (s, n) => { s.burn = 2 + 10 * n; } },
  { id: 'awakened-soul', name: 'Awakened Soul', kanji: '覚醒', rarity: 'rare', max: 3, icon: 'aura',
    describe: () => 'Awakening lasts 5 seconds longer and charges 25% faster.',
    apply: (s, n) => { s.awakenSeconds += 5 * n; s.awakenGain *= 1 + .25 * n; } },
  { id: 'executioner', name: 'Executioner', kanji: '介錯', rarity: 'epic', max: 2, icon: 'blade',
    describe: () => '+60% damage to enemies under 30% health.', apply: (s, n) => { s.execute += .6 * n; } },
  { id: 'soul-harvest', name: 'Soul Harvest', kanji: '魂狩', rarity: 'epic', max: 3, icon: 'soul',
    describe: () => 'Every kill heals 0.5% of your maximum health; a boss, 5%.', apply: (s, n) => { s.healOnKill += .005 * n; } },
  { id: 'counter-art', name: 'Counter Art', kanji: '反撃', rarity: 'epic', max: 2, icon: 'counter',
    describe: held => held ? 'Your parry blast doubles.' : 'A just guard (block on the beat) blasts everything around you.',
    apply: (s, n) => { s.parryBlast = 110 * n; } },
  { id: 'chain-reaction', name: 'Chain Reaction', kanji: '連鎖', rarity: 'epic', max: 2, icon: 'burst',
    describe: () => 'Enemies burst when they die, hurting everything near them.', apply: (s, n) => { s.killBlast = .35 * n; } },
  { id: 'flying-slash', name: 'Flying Slash', kanji: '飛斬', rarity: 'epic', max: 3, icon: 'blade',
    describe: held => held ? `The crescent comes every ${Math.max(4, 6 - held)} hits of a combo, and cuts deeper (+45).` : 'Every 6th hit of an unbroken combo cuts a crescent through everything ahead of you.',
    apply: (s, n) => { s.crescentEvery = Math.max(4, 7 - n); s.crescentDamage = 45 + 45 * n; } },
  { id: 'rending-cut', name: 'Rending Cut', kanji: '斬痕', rarity: 'epic', max: 3, icon: 'rending-cut',
    describe: held => held ? 'The cut bursts harder (+30% of the blow) and wider.' : 'Your heavy blows leave a cut that bursts a moment later - 60% of the blow, round the body.',
    apply: (s, n) => { s.rend = .3 + .3 * n; } },
  { id: 'afterimage', name: 'Afterimage', kanji: '残像', rarity: 'epic', max: 3, icon: 'afterimage',
    describe: held => held ? 'The afterimage strikes harder (+20% of the blow).' : 'Your specials strike again as an afterimage half a second later, for 40% of each blow.',
    apply: (s, n) => { s.echo = .2 + .2 * n; } },
  { id: 'overdrive', name: 'Overdrive', kanji: '暴走', rarity: 'epic', max: 2, icon: 'overdrive',
    describe: () => 'Start every wave with 50% ultimate.', apply: (s, n) => { s.waveMeter = 50 * n; } },
  { id: 'undying-will', name: 'Undying Will', kanji: '不屈', rarity: 'legendary', max: 2, icon: 'phoenix',
    describe: () => 'When you fall, rise again once with half your health.', apply: (s, n) => { s.revives += n; } },
  { id: 'limit-break', name: 'Limit Break', kanji: '限界突破', rarity: 'legendary', max: 1, icon: 'limit',
    describe: () => '+30% damage, critical hits deal +50%, and awakening lasts 8 seconds longer.',
    apply: s => { s.damage *= 1.3; s.critDamage += .5; s.awakenSeconds += 8; } },
  { id: 'god-speed', name: 'God Speed', kanji: '神速', rarity: 'legendary', max: 1, icon: 'wind',
    describe: () => '+20% speed, moves recharge 25% faster and cost no more stamina than a breath.',
    apply: s => { s.speed *= 1.2; s.cooldown *= .75; s.stamina *= .5; } },
  { id: 'berserker-armor', name: 'Berserker Armor', kanji: '狂戦士', rarity: 'legendary', max: 1, icon: 'armor',
    describe: () => 'Below half health the armor takes over: +50% damage, +20% speed and 8% lifesteal.',
    apply: s => { s.berserk = 1; } },
  { id: 'ki-surge', name: 'Ki Surge', kanji: '気功', rarity: 'common', max: 5, icon: 'ki-surge',
    describe: () => 'Specials and ultimates deal 12% more damage.', apply: (s, n) => { s.kiDamage += .12 * n; } },
  { id: 'flash-step', name: 'Flash Step', kanji: '瞬歩', rarity: 'rare', max: 3, icon: 'flash-step',
    describe: held => held ? 'Your dash cuts deeper (+45).' : 'Your dash cuts through every enemy you pass, for 60.', apply: (s, n) => { s.flashCut = 15 + 45 * n; } },
  { id: 'burst-point', name: 'Burst Point', kanji: '発勁', rarity: 'rare', max: 3, icon: 'burst-point',
    describe: held => held ? 'The burst is 15% of the blow stronger, and wider.' : 'Your special hits burst round what they hit, for 30% of the blow.', apply: (s, n) => { s.burst = .15 + .15 * n; } },
  { id: 'blazing-ki', name: 'Blazing Ki', kanji: '炎気', rarity: 'epic', max: 3, icon: 'blazing-ki',
    describe: (held, level) => held ? `The fire burns ${burnAt(15, level)} a second hotter.` : `Your specials set the ground they hit burning for 3 seconds: ${burnAt(25, level)} a second.`,
    apply: (s, n) => { s.blaze = 10 + 15 * n; } },
  { id: 'storm-ki', name: 'Storm Ki', kanji: '雷気', rarity: 'epic', max: 3, icon: 'storm-ki',
    describe: held => held ? 'One more bolt, and every bolt hits harder (+30).' : 'Your specials call lightning down on two enemies near what they hit, 70 each.',
    apply: (s, n) => { s.storm = 1 + n; s.stormDamage = 40 + 30 * n; } },
  { id: 'ki-vortex', name: 'Ki Vortex', kanji: '渦', rarity: 'rare', max: 2, icon: 'ki-vortex',
    describe: held => held ? 'The pull reaches 7 metres.' : 'Your specials drag the crowd within 5 metres toward what they hit.', apply: (s, n) => { s.vortex = 3 + 2 * n; } },
  { id: 'ultimate-echo', name: 'Ultimate Echo', kanji: '残響', rarity: 'epic', max: 2, icon: 'ultimate-echo',
    describe: held => held ? 'The echo strikes harder: 80% of each blow.' : 'Your ultimate strikes again a moment later, for 50% of each blow.', apply: (s, n) => { s.ultEcho = .2 + .3 * n; } },
  { id: 'ultimate-rush', name: 'Ultimate Rush', kanji: '連撃', rarity: 'epic', max: 2, icon: 'ultimate-rush',
    describe: held => held ? 'It gives back half the meter.' : 'An ultimate that lands gives back 30% of the meter.', apply: (s, n) => { s.ultRefund = 10 + 20 * n; } },
  { id: 'awakening-nova', name: 'Awakening Nova', kanji: '覚醒爆', rarity: 'epic', max: 2, icon: 'awakening-nova',
    describe: held => held ? 'The nova hits harder (+250).' : 'Awakening bursts out of you: 350 to everything within 9 metres, and the lesser ones are stunned.',
    apply: (s, n) => { s.nova = 100 + 250 * n; } },
  { id: 'ki-armor', name: 'Ki Armor', kanji: '気鎧', rarity: 'epic', max: 1, icon: 'ki-armor',
    describe: () => 'While awakened, take 40% less damage and heal 2% of your health a second.', apply: s => { s.kiArmor = .6; } },
  { id: 'limitless', name: 'Limitless', kanji: '無限', rarity: 'legendary', max: 1, icon: 'limitless',
    describe: () => 'While awakened, your moves recharge three times as fast.', apply: s => { s.limitless = 3; } },
  { id: 'killing-intent', name: 'Killing Intent', kanji: '殺気', rarity: 'legendary', max: 1, icon: 'killing-intent',
    describe: () => 'Every kill takes 0.35 seconds off every move still recharging.', apply: s => { s.killRecharge = .35; } },
  { id: 'momentum', name: 'Momentum', kanji: '勢い', rarity: 'rare', max: 2, icon: 'momentum', bought: true,
    describe: held => held ? 'Momentum builds harder: +6% damage every 10 hits, up to +30%.' : 'An unbroken combo hits harder: +4% damage every 10 hits, up to +20%.',
    apply: (s, n) => { s.momentum = .02 + .02 * n; } },
  { id: 'overflow', name: 'Overflow', kanji: '溢気', rarity: 'rare', max: 2, icon: 'overflow', bought: true,
    describe: held => held ? 'A special pours in 8% more.' : 'A special that lands pours 8% into your ultimate.',
    apply: (s, n) => { s.overflow = 8 * n; } },
  { id: 'second-wind', name: 'Second Wind', kanji: '再起', rarity: 'epic', max: 1, icon: 'second-wind', bought: true,
    describe: () => 'Once a round, falling under 25% health brings 35% of it back.', apply: s => { s.secondWind = .35; } },
  { id: 'searing-edge', name: 'Searing Edge', kanji: '灼刃', rarity: 'epic', max: 1, icon: 'flame', treeOnly: true,
    describe: () => 'Burning Blade deals 80% more damage per second.', apply: s => { s.burn *= 1.8; } },
  { id: 'cinder-cut', name: 'Cinder Cut', kanji: '灰斬', rarity: 'epic', max: 1, icon: 'blade', treeOnly: true,
    describe: () => 'Heavy hits leave a wound that bursts for an extra 35% of the hit. Adds to Rending Cut.', apply: s => { s.rend += .35; } },
  { id: 'forked-current', name: 'Forked Current', kanji: '分雷', rarity: 'epic', max: 1, icon: 'lightning', treeOnly: true,
    describe: () => 'Thunder Chain reaches 2 additional enemies. Each arc deals 20% less damage.', apply: s => { s.chain += 2; s.chainDamage *= .8; } },
  { id: 'focused-current', name: 'Focused Current', kanji: '集雷', rarity: 'epic', max: 1, icon: 'lightning', treeOnly: true,
    describe: () => 'Thunder Chain deals 60% more damage and gains 10 percentage points of trigger chance.', apply: s => { s.chainDamage *= 1.6; s.chainChance += .1; } },
  { id: 'phase-strike', name: 'Phase Strike', kanji: '瞬撃', rarity: 'epic', max: 1, icon: 'dash', treeOnly: true,
    describe: () => 'Flash Step deals 70% more damage. All attacks cost 10% less stamina.', apply: s => { s.flashCut *= 1.7; s.stamina *= .9; } },
  { id: 'slipstream', name: 'Slipstream', kanji: '風走', rarity: 'epic', max: 1, icon: 'dash', treeOnly: true,
    describe: () => 'Flash Step deals 30% less damage. Gain +10% speed. Move cooldowns are 15% shorter.', apply: s => { s.flashCut *= .7; s.speed += .1; s.cooldown *= .85; } },
  { id: 'iron-reprisal', name: 'Iron Reprisal', kanji: '鉄返', rarity: 'epic', max: 1, icon: 'guard', treeOnly: true,
    describe: () => 'A just guard blasts nearby enemies for 160 damage. Adds to Counter Art.', apply: s => { s.parryBlast += 160; } },
  { id: 'anchored-soul', name: 'Anchored Soul', kanji: '不動', rarity: 'epic', max: 1, icon: 'guard', treeOnly: true,
    describe: () => 'Take 12% less damage, multiplicative with Guardian. Recover 4 more stamina per second.', apply: s => { s.damageIn *= .88; s.staminaRegen += 4; } },

];

export const upgrade = (id: string) => UPGRADES.find(u => u.id === id)!;

export function runStats(picks: readonly string[]): RunStats {
  const stats = { ...BASE_STATS };
  const held = new Map<string, number>();
  for (const id of picks) held.set(id, (held.get(id) ?? 0) + 1);
  for (const def of UPGRADES) {
    const n = held.get(def.id);
    if (n) def.apply(stats, n);
  }
  return stats;
}

export function stacksOf(picks: readonly string[]) {
  const held = new Map<string, number>();
  for (const id of picks) held.set(id, (held.get(id) ?? 0) + 1);
  return held;
}

const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 28, epic: 11, legendary: 0 };

export function offer(picks: readonly string[], random: () => number, legendary = false, luck = 0, unlocked: readonly string[] = []): string[] {
  const held = stacksOf(picks);
  const open = UPGRADES.filter(def => !def.treeOnly && (held.get(def.id) ?? 0) < def.max && (!def.bought || unlocked.includes(def.id)));
  const chosen: string[] = [];
  const weight = (def: UpgradeDefinition) => {
    if (def.rarity === 'legendary') return 0;
    const base = legendary ? { common: 15, rare: 45, epic: 40, legendary: 0 }[def.rarity] : RARITY_WEIGHT[def.rarity];
    const lift = def.rarity === 'common' ? 1 - Math.min(.5, luck * .04) : 1 + luck * .08;
    return base * lift * (held.has(def.id) ? 1.3 : 1);
  };
  if (legendary) {
    const legends = open.filter(def => def.rarity === 'legendary');
    if (legends.length) chosen.push(legends[Math.floor(random() * legends.length)].id);
  }
  if (!legendary && picks.length >= 5 && !DEFENCE.some(id => held.has(id))) {
    const guard = open.filter(def => DEFENCE.includes(def.id) && def.rarity !== 'legendary' && !chosen.includes(def.id));
    if (guard.length) chosen.unshift(guard[Math.floor(random() * guard.length)].id);
  }
  while (chosen.length < 3) {
    const pool = open.filter(def => !chosen.includes(def.id));
    const total = pool.reduce((sum, def) => sum + weight(def), 0);
    if (!pool.length || total <= 0) break;
    let roll = random() * total;
    const hit = pool.find(def => (roll -= weight(def)) <= 0) ?? pool[pool.length - 1];
    chosen.push(hit.id);
  }
  return chosen.slice(0, 3);
}
const DEFENCE = ['tough-body', 'guardian', 'bloodlust', 'undying-will'];

export const describeNext = (id: string, picks: readonly string[], level = 1) => upgrade(id).describe(stacksOf(picks).get(id) ?? 0, level);
export const burnAt = (burn: number, level: number) => Math.round(burn * (1 + Math.max(0, level - 1) * .07));
export { pct };
