import type { MoveDefinition } from '../../game/moves';
import type { AttackSlot, FighterId } from '../../game/types';
import { bodyTypeOf, elementKitsOf, type ElementKitId } from '../sim/archetypes';
import { CATALOG, MATERIAL_KITS, tagsOf, type CatalogEffect, type EffectTags, type Material, type Role, type Scale, type World } from './tags';

export type CastSlot = AttackSlot | 'body';

export interface Need {
  fighter: FighterId; slot: CastSlot; moveName?: string;
  kits: ElementKitId[]; roles: Role[]; scale: Scale; shape: 'line' | 'zone' | 'any'; world?: World; words: string[];
}
export interface Match { effect: CatalogEffect; tags: EffectTags; score: number; reasons: string[] }

const SERIES_WORLDS: [RegExp, World][] = [
  [/dragon ball/i, 'dragon-ball'], [/one piece/i, 'one-piece'], [/naruto|boruto/i, 'naruto'], [/bleach/i, 'bleach'],
  [/jujutsu/i, 'jujutsu-kaisen'], [/hero academia/i, 'my-hero-academia'], [/demon slayer|kimetsu/i, 'demon-slayer'], [/one punch/i, 'one-punch-man'],
  [/hunter\s*[x×]\s*hunter/i, 'hunter-x-hunter'], [/chainsaw man/i, 'chainsaw-man'],
  [/jojo/i, 'jojo'], [/attack on titan/i, 'attack-on-titan'], [/evangelion/i, 'evangelion'], [/tokyo ghoul/i, 'tokyo-ghoul'],
];
export const worldOf = (series?: string): World | undefined => series ? SERIES_WORLDS.find(([re]) => re.test(series))?.[1] : undefined;

const NAME_MATERIALS: [RegExp, Material][] = [
  [/\b(fire|flame|blaze|burn|hell ?fire|heat|ember|inferno|sun|solar|prominence|kagutsuchi|jakka|hiken|entei|enkai)/i, 'fire'],
  [/\b(magma|lava|volcan|meteor volcano|eruption)/i, 'magma'],
  [/\b(amaterasu|hellblaze|darkness flame|black flame)/i, 'blackfire'],
  [/\b(ice|frost|freez|glaci|snow|cold|frozen|pheasant|ice age)/i, 'ice'],
  [/\b(lightning|thunder|chidori|raikiri|kirin|bolt|electr|volt|godspeed)/i, 'lightning'],
  [/\b(water|wave|tide|sea|torrent|aqua)/i, 'water'],
  [/\b(wind|gale|tornado|cyclone|rasen ?shuriken)/i, 'wind'],
  [/\b(explo|blast|bomb|howitzer|grenade|ap shot)/i, 'explosion'],
  [/\b(beam|kamehameha|cannon|gun|laser|galick|final flash|ray|wave)/i, 'energy'],
  [/\b(light|holy|getsuga)/i, 'light'],
  [/\b(gravity|shinra|tensei|almighty push|planetary|chibaku)/i, 'gravity'],
  [/\b(domain|void|infinite|shrine|reality)/i, 'space'],
  [/\b(earth|rock|stone|quake|tremor)/i, 'earth'],
  [/\b(string|thread|web|parasite)/i, 'metal'],
];

const AREA_ROLES: Record<NonNullable<NonNullable<MoveDefinition['area']>['look']>, Role[]> = {
  burst: ['nova', 'ring', 'field', 'pillar'], zone: ['field', 'ring', 'ground', 'rain'], rain: ['rain', 'field', 'pillar'], pillar: ['pillar', 'nova', 'ring', 'field'],
};
function rolesFor(slot: CastSlot, move: MoveDefinition | undefined, blade: boolean): Role[] {
  if (slot === 'body') return ['aura', 'buff'];
  if (slot === 'area' || move?.area) return AREA_ROLES[move?.area?.look ?? 'burst'] ?? AREA_ROLES.burst;
  const style = move?.style ?? 'melee';
  if (slot === 'light') return blade ? ['slash', 'impact', 'trail'] : ['impact', 'slash', 'trail'];
  if (slot === 'heavy') return style === 'projectile' ? ['projectile', 'stream', 'wave', 'thread'] : blade ? ['slash', 'wave', 'impact', 'ground'] : ['impact', 'stream', 'ground', 'wave'];
  if (slot === 'special') {
    switch (style) {
      case 'projectile': return ['projectile', 'stream', 'wave', 'thread', 'beam'];
      case 'beam': return ['beam', 'stream', 'wave'];
      case 'field': return ['field', 'ring', 'rain', 'pillar', 'ground', 'barrier'];
      case 'bomb': return ['nova', 'projectile', 'rain'];
      default: return blade ? ['slash', 'wave', 'trail', 'impact'] : ['impact', 'stream', 'wave', 'trail'];
    }
  }
  return style === 'beam' ? ['beam', 'nova', 'pillar'] : style === 'bomb' ? ['nova', 'rain', 'projectile']
    : style === 'field' ? ['field', 'ring', 'rain', 'pillar'] : ['nova', 'pillar', 'ring', 'field', 'summon', 'slash', 'beam'];
}
const SCALES: Scale[] = ['small', 'medium', 'large', 'huge'];
function scaleFor(slot: CastSlot, move?: MoveDefinition): Scale {
  if (slot === 'body' || slot === 'light') return 'small';
  if (slot === 'area') return 'large';
  if (slot === 'heavy') return 'medium';
  if (slot === 'special') return (move?.range ?? 0) >= 20 || (move?.radius ?? 0) >= 2 ? 'large' : 'medium';
  return 'large';
}
const LINE_ROLES = new Set<Role>(['slash', 'projectile', 'beam', 'stream', 'wave', 'thread', 'trail', 'impact']);

export function needOf(fighter: FighterId, slot: CastSlot, move?: MoveDefinition, series?: string): Need {
  const name = slot === 'body' ? '' : move?.name ?? '';
  const named = NAME_MATERIALS.filter(([re]) => re.test(name)).map(([, m]) => m);
  const own = elementKitsOf(fighter);
  const fromName = [...new Set(named.flatMap(m => MATERIAL_KITS[m]))];
  const kits = fromName.filter(k => own.includes(k)).length ? fromName.filter(k => own.includes(k)) : own.length ? [...own] : fromName;
  const roles = rolesFor(slot, move, bodyTypeOf(fighter) === 'blade');
  const shape = slot === 'body' ? 'any' : LINE_ROLES.has(roles[0]) ? 'line' : 'zone';
  const words = name.toLowerCase().split(/[^a-zà-ÿ]+/).filter(w => w.length > 2 && !['the', 'and', 'style', 'art', 'technique', 'no', 'of'].includes(w));
  return { fighter, slot, ...(name ? { moveName: name } : {}), kits, roles, scale: scaleFor(slot, move), shape, world: worldOf(series), words };
}

const SYNONYMS: Record<string, string[]> = {
  fist: ['fist', 'punch', 'knuckle'], punch: ['punch', 'fist'], sun: ['sun', 'solar', 'dawn', 'nova'], dragon: ['dragon', 'wyrm', 'serpent'],
  wall: ['wall', 'barrier', 'ward'], arrow: ['arrow', 'lance', 'spear', 'bolt'], spear: ['spear', 'lance', 'javelin'], bomb: ['blast', 'explosion', 'bomb'],
  cannon: ['blast', 'beam', 'cannon'], meteor: ['meteor', 'cinder'], volcano: ['magma', 'lava', 'volcanic'], tornado: ['tornado', 'cyclone', 'vortex'],
  spider: ['web', 'lash', 'thread'], slash: ['slash', 'crescent', 'cut'], cut: ['cut', 'slash'], prison: ['prison', 'cage', 'ward'],
  bird: ['bird', 'flock', 'feather', 'phoenix'], pheasant: ['bird', 'phoenix', 'feather'], wolf: ['wolf'], shark: ['shark'], wave: ['wave'],
  blade: ['blade', 'sword', 'slash'], sword: ['sword', 'blade', 'katana'], kick: ['kick', 'heel'], palm: ['palm'], quake: ['quake', 'fault'],
  rain: ['rain', 'shower'], storm: ['storm'], lightning: ['lightning', 'thunder', 'bolt'], thunder: ['thunder', 'lightning'],
  fireflies: ['ember', 'flock'], hotarubi: ['ember', 'flock'], firefly: ['ember', 'flock'], hell: ['hell', 'inferno'], pillar: ['pillar', 'column'],
};

export interface RankOptions { limit?: number; exclude?: readonly string[]; uncleared?: boolean }
export function rank(need: Need, options: RankOptions = {}): Match[] {
  const out: Match[] = [];
  for (const effect of CATALOG.effects) {
    if (options.exclude?.includes(effect.id)) continue;
    if (!effect.licence.ok && !options.uncleared) continue;
    const tags = tagsOf(effect), reasons: string[] = [];
    if (tags.worlds.length && (!need.world || !tags.worlds.includes(need.world))) continue;
    let score = 0;
    const kitHit = tags.kits.filter(k => need.kits.includes(k));
    if (kitHit.length) { score += 4; reasons.push(`${kitHit.join('/')} kit`); } else if (need.kits.length) score -= 2;
    const roleIndex = need.roles.findIndex(r => tags.roles.includes(r));
    if (roleIndex >= 0) { score += 3 - roleIndex * .5; reasons.push(`role: ${need.roles[roleIndex]}`); }
    if (need.shape === 'any' || need.shape === effect.cast) score += 1; else score -= .5;
    const gap = Math.abs(SCALES.indexOf(tags.scale) - SCALES.indexOf(need.scale));
    score += gap === 0 ? 1 : gap === 1 ? .4 : -.5;
    if (tags.look === 'cel') { score += .6; reasons.push('cel look'); } else if (tags.look === 'painterly') score += .3;
    if (tags.cost === 'heavy' && (need.slot === 'light' || need.slot === 'heavy')) { score -= 1; reasons.push('heavy for a quick move'); }
    const text = `${effect.label} ${effect.blurb}`.toLowerCase();
    const hits = need.words.filter(w => (SYNONYMS[w] ?? [w]).some(s => text.includes(s)));
    if (hits.length) { score += 1.2 * hits.length; reasons.push(`name: ${hits.join(', ')}`); }
    if (tags.curated) score += .2;
    out.push({ effect, tags, score: Math.round(score * 100) / 100, reasons });
  }
  out.sort((a, b) => b.score - a.score || a.effect.id.localeCompare(b.effect.id));
  return out.slice(0, options.limit ?? 8);
}
