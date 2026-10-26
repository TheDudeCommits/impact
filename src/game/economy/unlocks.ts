export interface Unlock { price?: number; level?: number }

export const BANDS = {
  fighterKing: 2400, fighterFirst: 2000,
  fighterSecond: 1600,
  fighterThird: 1200,
} as const;

export const UNLOCKS: Readonly<Record<string, Unlock>> = {
  'fighter-roger': { price: BANDS.fighterKing },
  'fighter-sukuna': { price: BANDS.fighterFirst }, 'fighter-madara': { price: BANDS.fighterFirst }, 'fighter-aizen': { price: BANDS.fighterFirst },
  'fighter-kaido': { price: BANDS.fighterFirst }, 'fighter-whitebeard': { price: BANDS.fighterFirst },
  'fighter-goku-black': { price: BANDS.fighterSecond }, 'fighter-meruem': { price: BANDS.fighterSecond }, 'fighter-jiren': { price: BANDS.fighterSecond },
  'fighter-golden-frieza': { price: BANDS.fighterSecond }, 'fighter-griffith': { price: BANDS.fighterSecond, level: 40 },
  'fighter-itachi': { price: BANDS.fighterThird }, 'fighter-shanks': { price: BANDS.fighterThird }, 'fighter-gohan-beast': { price: BANDS.fighterThird },
  'fighter-tanjiro': { price: BANDS.fighterThird, level: 5 }, 'fighter-levi': { price: BANDS.fighterThird, level: 10 },
  'fighter-gon': { price: BANDS.fighterThird, level: 16 }, 'fighter-sung-jinwoo': { price: BANDS.fighterThird, level: 22 },
  'fighter-saitama': { price: BANDS.fighterThird, level: 30 }, 'fighter-akaza': { price: BANDS.fighterThird, level: 50 },
  'outfit-goku-ssj': { price: 300, level: 3 }, 'outfit-vegeta-ssj': { price: 300, level: 7 },
  'outfit-goku-god': { price: 400 }, 'outfit-vegeta-god': { price: 400 },
  'outfit-goku-blue': { price: 600, level: 18 }, 'outfit-vegeta-blue': { price: 600 },
  'outfit-goku-ui': { price: 900 }, 'outfit-vegeta-ego': { price: 900, level: 32 },
  'outfit-luffy-gear5': { price: 1000 }, 'outfit-luffy-filmred': { price: 800, level: 52 },
  'outfit-luffy-onigashima': { price: 600 }, 'outfit-luffy-marineford': { price: 600, level: 12 },
  'outfit-zoro-onigashima': { price: 600, level: 26 }, 'outfit-zoro-dressrosa': { price: 600 },
  'outfit-sanji-wholecake': { price: 600 }, 'outfit-ace-alabasta': { price: 500, level: 42 },
  'outfit-law-onigashima': { price: 600 }, 'outfit-law-wano': { price: 600, level: 36 },
  'outfit-dio-heaven': { price: 700 }, 'outfit-killua-godspeed': { price: 500, level: 48 },
  'outfit-blackbeard-original': { price: 800 },
  'aura-azure-flame': { level: 2 }, 'aura-thunder-coil': { price: 500 }, 'aura-black-sun': { price: 900 }, 'aura-hundred-seals': { level: 60 },
  'skin-sumi-e': { level: 6 }, 'skin-spectral': { level: 20 }, 'skin-negative': { price: 400 }, 'skin-blood-moon': { level: 38 }, 'skin-gold-leaf': { level: 58 },
  'trail-afterimage': { level: 8 },
  'kill-cranes': { level: 14 }, 'kill-screentone': { level: 28 }, 'kill-seal': { level: 44 }, 'kill-kintsugi': { level: 55 },
  'banner-taiko': { level: 34 },
  'emote-don': { level: 4 }, 'emote-menacing': { level: 24 }, 'emote-speed-lines': { level: 46 },
};

export const ROAD: readonly { level: number; id: string }[] = Object.entries(UNLOCKS)
  .flatMap(([id, how]) => how.level !== undefined ? [{ level: how.level, id }] : [])
  .sort((a, b) => a.level - b.level);
const ROAD_LEVEL = new Map(ROAD.map(step => [step.id, step.level] as const));

export const roadLevel = (id: string) => ROAD_LEVEL.get(id);
export const onRoadAt = (level: number, id: string) => { const at = ROAD_LEVEL.get(id); return at !== undefined && level >= at; };
export const reachedOnRoad = (from: number, to: number) => ROAD.filter(step => step.level > from && step.level <= to);

export const REGULAR_DAY = 6, CASUAL_DAY = 3;
export const PER_MATCH = { sumi: 85, xp: 40 } as const;
export const PACE = {
  firstFighter: 3,
  roadGap: 4,
  fighterDays: 6,
} as const;
