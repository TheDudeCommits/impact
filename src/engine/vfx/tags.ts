import type { ElementKitId } from '../sim/archetypes';
import catalogJson from './armory/catalog.json';
import curatedJson from './armory/curated.json';

export const MATERIALS = ['fire', 'magma', 'blackfire', 'explosion', 'ice', 'water', 'wind', 'lightning', 'light', 'energy', 'dark', 'gravity', 'space',
  'earth', 'metal', 'plant', 'poison', 'blood', 'ink', 'time', 'arcane', 'sound', 'spirit', 'beast', 'tech', 'impact', 'slash'] as const;
export type Material = typeof MATERIALS[number];

export const ROLES = ['aura', 'charge', 'slash', 'impact', 'projectile', 'beam', 'stream', 'wave', 'pillar', 'ring', 'field', 'nova', 'rain', 'ground',
  'barrier', 'summon', 'trail', 'thread', 'buff'] as const;
export type Role = typeof ROLES[number];
export type Look = 'cel' | 'painterly' | 'realistic' | 'neutral';
export type Scale = 'small' | 'medium' | 'large' | 'huge';
export type Cost = 'light' | 'medium' | 'heavy';
export type World = 'dragon-ball' | 'one-piece' | 'naruto' | 'bleach' | 'jujutsu-kaisen' | 'my-hero-academia' | 'demon-slayer' | 'one-punch-man'
  | 'hunter-x-hunter' | 'chainsaw-man' | 'jojo' | 'attack-on-titan' | 'evangelion' | 'tokyo-ghoul';

export interface EffectTags {
  materials: Material[];
  kits: ElementKitId[];
  roles: Role[];
  look: Look;
  scale: Scale;
  cost: Cost;
  worlds: World[];
  curated: boolean;
  note?: string;
}

export interface CatalogEffect {
  id: string; label: string; school: string; accent: string; cast: 'line' | 'zone'; blurb: string; pack: string;
  entry: string; export: string; config?: string; files: string[]; shared: boolean; packages: string[]; seams: string[]; assets: string[];
  hash: string; licence: { ok: boolean; notes: string[] };
}
export interface Catalog {
  format: 1;
  armory: { commit: string; dirty: boolean; count: number; schools: { id: string; label: string; accent: string }[] };
  shared: string[];
  effects: CatalogEffect[];
}
export const CATALOG = catalogJson as Catalog;
type Curated = Partial<Omit<EffectTags, 'curated'>>;
const CURATED = curatedJson as unknown as Record<string, Curated>;

export const MATERIAL_KITS: Readonly<Record<Material, readonly ElementKitId[]>> = {
  fire: ['fire'], magma: ['fire', 'earth'], blackfire: ['blackflame'], explosion: ['explosion'], ice: ['ice'], water: ['windwater'],
  wind: ['windwater'], lightning: ['lightning'], light: ['beam'], energy: ['beam'], dark: ['domain', 'haki'], gravity: ['gravity'],
  space: ['domain', 'gravity'], earth: ['earth'], metal: ['slash', 'strings'], plant: ['strings', 'summon'], poison: ['domain'],
  blood: ['strings'], ink: ['domain'], time: ['domain'], arcane: ['domain'], sound: ['strength'], spirit: ['summon', 'haki'],
  beast: ['summon'], tech: ['mecha'], impact: ['strength', 'haki'], slash: ['slash'],
};

const SCHOOL_MATERIALS: Readonly<Record<string, readonly Material[]>> = {
  frost: ['ice'], flame: ['fire'], storm: ['lightning'], arcane: ['arcane'], tide: ['water'], forge: ['metal'], chrono: ['time'],
  blood: ['blood'], hive: ['beast'], stone: ['earth'], void: ['dark'], lumen: ['light'], ink: ['ink'], verdant: ['plant'],
  aether: ['wind'], beast: ['beast'], ki: ['energy'], tech: ['tech'], blade: ['slash'], fx: [],
};

const WORDS: [RegExp, Material][] = [
  [/\b(fire(?!s\b|d\b|ing\b)|flame|blaze|burn|ember|inferno|pyre|scorch|cinder|ashen|torch|wildfire|hellfire|sunspear|solar)/i, 'fire'],
  [/\b(magma|lava|molten|volcan|obsidian)/i, 'magma'],
  [/\b(black[- ]?(fire|flame)|amaterasu|hellblaze|dark flame)/i, 'blackfire'],
  [/\b(explo|blast|bomb|detonat|kaboom|grenade|shrapnel|nova)/i, 'explosion'],
  [/\b(ice|frost|freez|glaci|snow|hail|rime|crystal|cryo)/i, 'ice'],
  [/\b(water|tide|tidal|brine|geyser|torrent|flood|bubble|undertow|deluge|splash|sea\b|foam)/i, 'water'],
  [/\b(wind|gale|cyclone|tornado|gust|slipstream|vortex|feather|airblast|air blade)/i, 'wind'],
  [/\b(lightning|thunder|bolt|electr|volt|chain ?arc|railgun|plasma)/i, 'lightning'],
  [/\b(light(?!ning|s\b)|holy|radian|halo|prism|dawn|lumen|benediction|godspear)/i, 'light'],
  [/\b(ki\b|beam|laser|ray\b|energy|kamehameha|spirit bomb|genki|ki wave|energy wave)/i, 'energy'],
  [/\b(void|shadow|dark|umbral|night|eclipse|abyss|entropy)/i, 'dark'],
  [/\b(gravit|singularity|black hole|implod|collapse|sinkhole)/i, 'gravity'],
  [/\b(portal|rift|domain|realm|dimension|space|stasis|barrier|seal|cage|warp)/i, 'space'],
  [/\b(stone|rock|earth|boulder|quake|tecton|sand|spine|monolith|crag|fault)/i, 'earth'],
  [/\b(blade|sword|steel|chain|anvil|gear|saw|metal|iron|forge|arsenal)/i, 'metal'],
  [/\b(vine|thorn|root|bloom|tree|grove|spore|mycel|petal|flower|leaf)/i, 'plant'],
  [/\b(poison|venom|acid|toxic|plague|miasma)/i, 'poison'],
  [/\b(blood|hemo|sanguine|crimson tide)/i, 'blood'],
  [/\b(ink|sumi|brush|calligraph|script|origami|paper)/i, 'ink'],
  [/\b(time|chrono|hourglass|rewind|clock)/i, 'time'],
  [/\b(rune|glyph|arcane|magic circle|sigil|spell)/i, 'arcane'],
  [/\b(sonic|sound|resonan|shockwave|roar)/i, 'sound'],
  [/\b(soul|spirit|ghost|wraith|spectral|phantom)/i, 'spirit'],
  [/\b(dragon|wolf|shark|serpent|phoenix|kraken|wasp|locust|swarm|beast|bird|summon)/i, 'beast'],
  [/\b(drone|mech|robot|missile|rocket|tech|cyber|gatling|muzzle|turret|piston)/i, 'tech'],
  [/\b(impact|punch|fist|palm|kick|heel|uppercut|slam|smash|pound|crash|hit\b|blow|rush|flurry|shock)/i, 'impact'],
  [/\b(slash|cut|iaido|crescent|draw|cleave|sever|edge|blade wave|katana)/i, 'slash'],
];

const ROLE_WORDS: [RegExp, Role][] = [
  [/\b(aura|wreath|cloak|mantle|shell around|catches fire|flare|rage)/i, 'aura'],
  [/\b(charge|gather|compress|build)/i, 'charge'],
  [/\b(slash|cut|crescent|cleave|iaido|draw|sever)/i, 'slash'],
  [/\b(impact|hit|punch|kick|palm|blow|smash|crash|star flash|uppercut|heel|pound)/i, 'impact'],
  [/\b(fireball|lance|spear|javelin|bolt|shot|missile|orb|arrow|thrown|hurled|lobbed|flies|projectile)/i, 'projectile'],
  [/\b(beam|laser|ray|column of light|kamehameha)/i, 'beam'],
  [/\b(stream|breath|cone|jet|flamethrower|gout|spray)/i, 'stream'],
  [/\b(wave|races|walks down|wake\b|surge|tide|sweeps? (across|along) the floor)/i, 'wave'],
  [/\b(pillar|column|spire|tower|geyser|erupts? up)/i, 'pillar'],
  [/\b(ring|circle|crown|halo|around the)/i, 'ring'],
  [/\b(field|zone|area|across the circle|spreads|floor of|pool)/i, 'field'],
  [/\b(nova|burst|explo|detonat|blast|shockwave|dome)/i, 'nova'],
  [/\b(rain|shower|falls?|meteor|from the sky|starfall|hail)/i, 'rain'],
  [/\b(crater|fissure|quake|cracks?|floor (opens|splits)|tears the floor|erupt)/i, 'ground'],
  [/\b(wall|barrier|shield|ward|cage|prison|seal|dome)/i, 'barrier'],
  [/\b(summon|dragon|wolf|shark|serpent|phoenix|kraken|bird|beast|swarm|flock)/i, 'summon'],
  [/\b(dash|afterimage|blink|trail|step|through the target)/i, 'trail'],
  [/\b(lash|whip|chain|thread|string|vine|tether|web)/i, 'thread'],
  [/\b(buff|empower|heal|bless)/i, 'buff'],
];

const CEL = /\b(cel|toon|cartoon|anime|ink outline|hand-drawn|drawn|sprite|manga|impact frame|hard colour bands|banded)/i;
const PAINTERLY = /\b(painted|brush|ink|sumi|watercolou?r)/i;

function unique<T>(list: T[]) { return [...new Set(list)]; }

export function ruleTags(effect: CatalogEffect): Omit<EffectTags, 'curated'> {
  const text = `${effect.label} ${effect.blurb}`;
  const materials = unique([...(SCHOOL_MATERIALS[effect.school] ?? []), ...WORDS.filter(([re]) => re.test(text)).map(([, m]) => m)]);
  if (materials.includes('blackfire') && materials.includes('fire')) materials.splice(materials.indexOf('fire'), 1);
  let roles = unique(ROLE_WORDS.filter(([re]) => re.test(text)).map(([, r]) => r));
  if (!roles.length) roles = effect.cast === 'zone' ? ['field'] : ['projectile'];
  const zone = effect.cast === 'zone';
  const scale: Scale = /\b(huge|colossal|world|sky|storm of|rain|meteor shower|moonfall|cathedral|titan|apocalyp)/i.test(text) ? 'huge'
    : zone || roles.includes('nova') || roles.includes('pillar') ? 'large'
    : roles.includes('impact') || roles.includes('aura') || roles.includes('trail') ? 'small' : 'medium';
  const worlds: World[] = /^ki_/.test(effect.id) ? ['dragon-ball'] : [];
  return {
    materials,
    kits: unique(materials.flatMap(m => MATERIAL_KITS[m])),
    roles,
    look: CEL.test(text) ? 'cel' : PAINTERLY.test(text) ? 'painterly' : 'neutral',
    scale,
    cost: /\b(raymarch|volumetric|storm of|swarm|thousand|chain of|every)/i.test(text) ? 'heavy' : zone ? 'medium' : 'light',
    worlds,
  };
}

const memo = new Map<string, EffectTags>();
export function tagsOf(effect: CatalogEffect): EffectTags {
  let tags = memo.get(effect.id);
  if (!tags) {
    const curated = CURATED[effect.id];
    const ruled = ruleTags(effect);
    tags = { ...ruled, ...curated, curated: !!curated };
    if (curated?.materials && !curated.kits) tags.kits = unique(curated.materials.flatMap(m => MATERIAL_KITS[m]));
    memo.set(effect.id, tags);
  }
  return tags;
}
export const effectById = (id: string) => CATALOG.effects.find(e => e.id === id);
