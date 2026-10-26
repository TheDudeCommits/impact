import { FIGHTERS } from '../config';
import { AWAKENINGS } from '../game/awakening';
import type { FighterId } from '../game/types';
import { homeSeries } from '../ui/HomeRosterOrder';
import type { CoatPart } from './vfx/ArmamentCoat';
import { SHELL, type ShellLook } from './vfx/AuraShell';
import type { MoteKind } from './vfx/sparking/Motes';


export type PowerKind = 'ki' | 'haki' | 'reiatsu' | 'chakra' | 'cursed' | 'nen' | 'plain';
export type ShellStyle = 'flame' | 'haze' | 'smoke' | 'cloak' | 'curse' | 'shroud';

export interface AwakenedPower {
  kind: PowerKind;
  shell?: ShellStyle;
  glow?: number;
  colours?: readonly [number, number];
  look?: Partial<ShellLook>;
  onForm?: boolean;
  electric?: boolean;
  arcs?: number;
  edge?: number;
  conqueror?: boolean;
  coat?: readonly CoatPart[];
  motes?: readonly [MoteKind, number, number];
  physical?: boolean;
}

const shade = (hex: number, k: number) => Math.round((hex >> 16 & 255) * k) << 16 | Math.round((hex >> 8 & 255) * k) << 8 | Math.round((hex & 255) * k);
const HAZE_CORE = 0x060206;
export const HAKI_EDGE = { crimson: 0xff1a2e, violet: 0xa838ff, gold: 0xffb020, green: 0x3fe07a, rose: 0xff3fa0 } as const;

export const SHOP_GLOW = .3;
const ELSEWHERE: AwakenedPower = { kind: 'plain' };

export const WORLDS: Readonly<Record<string, AwakenedPower>> = {
  'Dragon Ball': { kind: 'ki', shell: 'flame', electric: true, onForm: true },
  'One Piece': { kind: 'haki', shell: 'haze', glow: 0, onForm: true },
  'Bleach': { kind: 'reiatsu', shell: 'smoke', onForm: true },
  'Naruto': { kind: 'chakra', shell: 'cloak', motes: ['bubble', 0xbfe4ff, 0x3f8cff] },
  'Jujutsu Kaisen': { kind: 'cursed', shell: 'curse', colours: [0x0a1030, 0x3f8cff] },
  'Hunter × Hunter': { kind: 'nen', shell: 'shroud' },
  'My Hero Academia': { kind: 'plain' },
  'Demon Slayer': { kind: 'plain', motes: ['flame', 0xffb441, 0xe84b26] },
  'Attack on Titan': { kind: 'plain', motes: ['steam', 0xffffff, 0xc4ccd4], onForm: true },
  'Fullmetal Alchemist': { kind: 'plain', arcs: 0x6fd0ff },
  'Neon Genesis Evangelion': { kind: 'plain', shell: 'shroud', glow: .2, colours: [0xff8a2a, 0xd8301a], look: { thick: .06, alpha: .6 },
    motes: ['ripple', 0xffb060, 0xff5a1a], onForm: true },
};

const OWN: Readonly<Partial<Record<FighterId, Partial<AwakenedPower>>>> = {
  broly: { electric: false },
  luffy: { conqueror: true, shell: undefined }, zoro: { conqueror: true, edge: HAKI_EDGE.green, coat: ['weapon'] },
  shanks: { conqueror: true, coat: ['weapon'] }, roger: { conqueror: true, edge: HAKI_EDGE.gold, coat: ['weapon'] },
  whitebeard: { conqueror: true, coat: ['weapon'] }, kaido: { conqueror: true, edge: HAKI_EDGE.violet, coat: ['weapon'] },
  yamato: { conqueror: true, coat: ['weapon'] }, doflamingo: { conqueror: true, edge: HAKI_EDGE.rose, coat: ['legs'] },
  'boa-hancock': { conqueror: true, edge: HAKI_EDGE.rose, coat: ['legs'] }, ace: { conqueror: true },
  blackbeard: { edge: HAKI_EDGE.violet, coat: ['hands'], motes: ['gloom', 0x2a1838, 0x05020a] }, mihawk: { coat: ['weapon'] },
  jinbe: { coat: ['hands'], motes: ['spray', 0xe8fdff, 0x42c4df] }, kizaru: { motes: ['glint', 0xfff3c0, 0xf9c238] },
  akainu: { motes: ['ember', 0xffb040, 0xb01c08] }, crocodile: { motes: ['sand', 0xe9d3a0, 0xa57c45] },
  'nico-robin': { motes: ['petal', 0xffb8dc, 0xd0508c] },
  pain: { motes: ['bubble', 0xd8c4ff, 0x7a4ad8] }, hinata: { motes: ['bubble', 0xe8f0ff, 0xbaa9f0] },
  minato: { onForm: true, glow: .2, colours: [0xffd24a, 0xd88a10], motes: ['bubble', 0xfff0b0, 0xffb020] },
  jiraiya: { onForm: true, glow: .2, colours: [0xffa24a, 0xc8501a], motes: ['bubble', 0xffd0a0, 0xe86a20] },
  sakura: { onForm: true, glow: .2, colours: [0xff9ccc, 0xc24a8a], motes: ['bubble', 0xffd0e6, 0xf06aa8] },
  tsunade: { onForm: true, glow: .2, colours: [0x8ff0c0, 0x2aa86a], motes: ['bubble', 0xd8ffe8, 0x4ad890] },
  'might-guy': { shell: 'smoke', onForm: true, colours: [0xff6a4a, 0xb0141c], motes: ['steam', 0xffb4a0, 0xc23a34] },
  yuta: { colours: [0x160c2c, 0xff9ee6] }, nanami: { colours: [0x0a1030, 0x58b8ff] },
  sukuna: { onForm: true, colours: [0x16040a, 0xff2a3a] },
  deku: { arcs: 0x35ff8a },
  endeavor: { shell: 'flame', motes: ['ember', 0xffc060, 0xe8421a] },
  bakugo: { motes: ['pop', 0xffd27a, 0xff791e] }, todoroki: { motes: ['frost', 0xf4ffff, 0x8fe0f5] },
  'all-might': { motes: ['steam', 0xfffbee, 0xd8c890] },
  tanjiro: { motes: ['flame', 0xffa040, 0xff4a10] }, akaza: { motes: ['frost', 0xd8ecff, 0x6a9cff] },
  levi: { arcs: 0xd8ffe8 }, mikasa: { arcs: 0xffe0e0 },
  tatsumaki: { shell: 'shroud', motes: ['rubble', 0xbfffe0, 0x5dffac] }, saitama: { motes: ['steam', 0xfff6e0, 0xd8b890] },
  garou: { motes: ['glint', 0xdfe6ff, 0x8e87ff] },
  meliodas: { shell: 'curse', onForm: true, colours: [0x0a0612, 0x8a3fd8] },
  escanor: { shell: 'shroud', onForm: true, colours: [0xffd870, 0xffa020] },
  makima: { shell: 'haze', glow: 0, colours: [0x0a0406, 0x8a1c1c] }, denji: { motes: ['pop', 0xffe0a0, 0xff8a2a] },
  akame: { shell: 'curse', onForm: true, colours: [0x14040c, 0xdd2949] }, esdeath: { motes: ['frost', 0xffffff, 0x9fe5ff] },
  guts: { shell: 'curse', onForm: true, colours: [0x0a0508, 0xe0202a] },
  hiei: { shell: 'curse', onForm: true, colours: [0x08050c, 0x9a55e0] },
  'sung-jinwoo': { shell: 'curse', onForm: true, colours: [0x0a0614, 0x7a4df8] },
  'kaiju-no-8': { arcs: 0x57f0d0, motes: ['steam', 0xe8fff8, 0x8ad8c8] },
  gintoki: { physical: true },
  ichigo: { colours: [0x0b0a12, 0xe01a30], look: { band: .26, soft: .2, alpha: 1 } }, aizen: { colours: [0xb070ff, 0x3a1070] },
  kenpachi: { colours: [0xffd42a, 0xa86a00] }, grimmjow: { colours: [0x58c8ff, 0x0b4ec2] },
  byakuya: { colours: [0xff9ed2, 0xc23f86], motes: ['petal', 0xffc4e4, 0xe0559e] },
  yamamoto: { colours: [0xffa53a, 0xd8361a] },
  rukia: { colours: [0x9fdcf2, 0xf4feff], glow: .15, motes: ['frost', 0xffffff, 0x9fdcf2] },
  yoruichi: { colours: [0xf6f0ff, 0xa663ee], electric: true },
  gojo: { kind: 'plain', shell: undefined, colours: undefined }, killua: { kind: 'plain', shell: undefined },
  gon: { kind: 'plain', shell: 'flame', onForm: true },
  toji: { kind: 'plain', shell: undefined, colours: undefined, physical: true },
};

const resolved = new Map<FighterId, AwakenedPower>();
const looks = new Map<FighterId, ShellLook>();
export function shellLook(fighter: FighterId): ShellLook {
  let look = looks.get(fighter);
  if (!look) { const power = awakenedPower(fighter); looks.set(fighter, look = { ...SHELL[power.shell ?? 'flame'], ...power.look }); }
  return look;
}
export const wakesInOwnBody = (fighter: FighterId) => AWAKENINGS[fighter].kind === 'aura' && !FIGHTERS[fighter].formModel;

export function awakenedPower(fighter: FighterId): AwakenedPower {
  let power = resolved.get(fighter);
  if (!power) {
    const look = AWAKENINGS[fighter];
    power = { ...(WORLDS[homeSeries(fighter)] ?? ELSEWHERE), ...OWN[fighter] };
    if (!power.onForm && !wakesInOwnBody(fighter)) { power.shell = undefined; if (!OWN[fighter]?.motes) power.motes = undefined; }
    if (power.shell) power.glow ??= look.flames ? look.auraGlow ?? 1 : SHOP_GLOW;
    if (power.shell === 'haze') power.colours ??= [HAZE_CORE, shade(power.edge ?? HAKI_EDGE.crimson, .62)];
    resolved.set(fighter, power);
  }
  return power;
}
