import type { AttackSlot, FighterId } from '../../game/types';
import type { ComboKey } from '../../game/combos';

export interface Element { spike: number; rim: number; light: number; ink: number }

const E = (spike: number, rim: number, light = rim, ink = 0x10131a): Element => ({ spike, rim, light, ink });

export const PHYSICAL = E(0xffe45c, 0xff8a14, 0xffc873);
const KI_BLUE = E(0xbff4ff, 0x08baff, 0x46c3ff);
const KI_GOLD = E(0xfff3b0, 0xffb21e, 0xffc84a);
const KI_PURPLE = E(0xf0d6ff, 0x9a3cff, 0xa860ff);
const CHAKRA_BLUE = E(0xd6f7ff, 0x2fb8ff, 0x5fd4ff);
const CHAKRA_ORANGE = E(0xfff0c2, 0xff8a1c, 0xffa040);
const LIGHTNING = E(0xf2fbff, 0x5aa8ff, 0x9fd0ff, 0x0c1426);
const FIRE = E(0xfff1b0, 0xff4a1e, 0xff7a2a, 0x1c0a04);
const HAKI = E(0xffe2c8, 0xf0321c, 0xff5a3a, 0x16050a);
const SLASH_GREEN = E(0xeafff0, 0x3fd97a, 0x9cf0b0, 0x08140c);
const BLACK_RED = E(0xffd2d8, 0xe0142e, 0xff3048, 0x050103);
const STAND_PURPLE = E(0xf0e2ff, 0x9d63ff, 0xb48cff, 0x120a24);
const STAND_GOLD = E(0xfff4c2, 0xf2b01e, 0xffd24a, 0x1a1204);
const CURSED_BLUE = E(0xd8f6ff, 0x2ec4ff, 0x46d8ff, 0x061020);
const CURSED_PURPLE = E(0xffd8fb, 0xb03cff, 0xd050ff, 0x14061c);
const ROOM_BLUE = E(0xdaf6ff, 0x3f9dff, 0x7fe0ff, 0x06101e);
const SHOCK_YELLOW = E(0xfffbd0, 0xffd21e, 0xffe95a, 0x1a1404);
const STEEL = E(0xf4f8ff, 0xb8c8d8, 0xdfe8f0, 0x10141a);
const SPIRIT = E(0xe2fbff, 0x2d9bff, 0x6fd8ff, 0x06142a);
const BEAST_VIOLET = E(0xefe2ff, 0x8d4dff, 0x9b64ff, 0x0e0620);
const CURSED_RED = E(0xffe0d8, 0xff2a1e, 0xff4a36, 0x1c0404);
const KAMUI_VIOLET = E(0xf0e0ff, 0x7a3cff, 0x9a6cff, 0x0c0420);
const DRAGON_VIOLET = E(0xf2e8ff, 0x9a5cff, 0xb890ff, 0x0c0418);
const QUAKE_WHITE = E(0xffffff, 0x9fd0ff, 0xe4f2ff, 0x0a1220);
const CONQUEROR = E(0xffe2e2, 0xd0102a, 0xff2a3a, 0x060002);
const PIRATE_KING = E(0xfff4d6, 0xe0a020, 0xffcf4a, 0x080400);
const HOGYOKU = E(0xf4ecff, 0x8a3cff, 0xb48cff, 0x0a0414);
const KUROHITSUGI = E(0xe8dcff, 0x3a0a6a, 0x7a3cff, 0x020006);
const CURSE = E(0xffd8dc, 0xd81f3a, 0xff4a5a, 0x120204);
const FUGA = E(0xfff0c0, 0xff5a1e, 0xff8a3a, 0x1c0604);
const WHITE_HAWK = E(0xffffff, 0xa9c4ff, 0xe4ecff, 0x0a0e18);
const NIKA = E(0xffffff, 0xffd98a, 0xfff2d6, 0x120a04);
const ECLIPSE = E(0xeee2ff, 0x4a2a8a, 0x8a5cff, 0x020006);
const ROYAL_JADE = E(0xeafff2, 0x2fd07a, 0x8af0b8, 0x041a0e);
const DECREE = E(0xf4fff8, 0x3ae88a, 0xb8ffd8, 0x02100a);
const ROSE = E(0xffe2f6, 0xe83aa8, 0xff8ad8, 0x14020e);
const PRIDE_RED = E(0xffe2dc, 0xe8202a, 0xff5a4a, 0x140204);
const GOLDEN = E(0xfff4cc, 0xffb21e, 0xffd86a, 0x140e02);
const DEATH_BEAM = E(0xffe8fb, 0xd82ab0, 0xff6ad8, 0x12020e);
const DEATH_BALL = E(0xffe2cc, 0xff4a12, 0xff8a3a, 0x1a0602);
const BEAST = E(0xf6f2ff, 0xc23a7a, 0xe08ad0, 0x10040c);
const MASENKO = E(0xfffbe0, 0xffd21e, 0xffe46a, 0x140f02);
const BEAM_CANNON = E(0xfff4d6, 0xffae1e, 0xc890ff, 0x12060e);
const ONE_PUNCH = E(0xfffbe8, 0xffd23a, 0xfff0a0, 0x14100a);
const SERIOUS = E(0xffffff, 0xff4a2a, 0xffb080, 0x140404);
const DESTRUCTIVE = E(0xfff0f4, 0xff4a8a, 0xff9ac0, 0x14040a);
const COMPASS = E(0xeaf4ff, 0x4a7aff, 0x9ab8ff, 0x060a1a);
const SHARINGAN = E(0xffe6e6, 0xe8202e, 0xff6a6a, 0x140204);
const BLACK_FLAME = E(0xe8d6ff, 0x3a0a4a, 0x7a3a9a, 0x020004);
const UCHIHA = E(0xffe2e2, 0xc8202e, 0xff5a5a, 0x120203);
const MAJESTIC = E(0xfff2c8, 0xff6a1a, 0xffa040, 0x1a0602);
const METEOR = E(0xffe8c0, 0xd2581c, 0xff9a40, 0x140602);
const SUSANOO_BLUE = E(0xece6ff, 0x5b4ae8, 0x9a8cff, 0x060418);
const WATER = E(0xf0fbff, 0x2e8cff, 0x8ad0ff, 0x02101e);
const SUN_FIRE = E(0xfff4c8, 0xff5a1f, 0xffb040, 0x1a0602);
const WINGS_STEEL = E(0xf4fff8, 0x4aa874, 0xc8f0d8, 0x06140c);
const SHADOW = E(0xf0e8ff, 0x6a3df0, 0xa88aff, 0x08021a);
const NEN = E(0xfff6d2, 0xf0a018, 0xffd062, 0x160c02);

const TABLE: Record<FighterId, Record<Exclude<AttackSlot, 'area'>, Element>> = {
  toji:{light:E(0xe8f0ec,0x9aa7a2,0x171d24),heavy:E(0xe8f0ec,0x9aa7a2,0x171d24),special:E(0xe8f0ec,0x9aa7a2,0x171d24),ultimate:E(0xe8f0ec,0x9aa7a2,0x171d24)},
  crocodile:{light:E(0xf5e7c9,0xc99b55,0x81643c),heavy:E(0xf5e7c9,0xc99b55,0x81643c),special:E(0xf5e7c9,0xc99b55,0x81643c),ultimate:E(0xf5e7c9,0xc99b55,0x81643c)},
  usopp:{light:E(0xeaffc5,0x83b442,0x365822),heavy:E(0xeaffc5,0x83b442,0x365822),special:E(0xeaffc5,0x83b442,0x365822),ultimate:E(0xeaffc5,0x83b442,0x365822)},
  sakura:{light:E(0xffe6f1,0xf397c3,0x593849),heavy:E(0xffe6f1,0xf397c3,0x593849),special:E(0xffe6f1,0xf397c3,0x593849),ultimate:E(0xffe6f1,0xf397c3,0x593849)},
  meliodas:{light:E(0xf7eaff,0x9d4fed,0x130d20),heavy:E(0xf7eaff,0x9d4fed,0x130d20),special:E(0xf7eaff,0x9d4fed,0x130d20),ultimate:E(0xf7eaff,0x9d4fed,0x130d20)},
  escanor:{light:E(0xfff4ce,0xffba43,0xee6318),heavy:E(0xfff4ce,0xffba43,0xee6318),special:E(0xfff4ce,0xffba43,0xee6318),ultimate:E(0xfff4ce,0xffba43,0xee6318)},
  tatsumaki:{light:E(0xeaffef,0x5dffac,0x6c847a),heavy:E(0xeaffef,0x5dffac,0x6c847a),special:E(0xeaffef,0x5dffac,0x6c847a),ultimate:E(0xeaffef,0x5dffac,0x6c847a)},
  makima:{light:E(0xffedce,0xd69b47,0x782822),heavy:E(0xffedce,0xd69b47,0x782822),special:E(0xffedce,0xd69b47,0x782822),ultimate:E(0xffedce,0xd69b47,0x782822)},
  kenpachi:{light:E(0xffedba,0xffbd27,0x23170b),heavy:E(0xffedba,0xffbd27,0x23170b),special:E(0xffedba,0xffbd27,0x23170b),ultimate:E(0xffedba,0xffbd27,0x23170b)},
  minato:{light:E(0xffedbd,0xffcf50,0x967128),heavy:E(0xe7fbff,0x4bd6ff,0x3290ba),special:E(0xffedbd,0xffcf50,0x967128),ultimate:E(0xe7fbff,0x4bd6ff,0x967128)},
  'nico-robin':{light:E(0xffeaf7,0xf8b7de,0x834985),heavy:E(0xfff0fa,0xd58db8,0x522a54),special:E(0xffeaf7,0xf8b7de,0x834985),ultimate:E(0xfff0fa,0xd58db8,0x522a54)},
  'kaiju-no-8':{light:E(0xe7fff8,0x57d7bd,0x10221f),heavy:E(0xf3fff5,0x61ead0,0x10221f),special:E(0xd2fff0,0x57d7bd,0x10221f),ultimate:E(0xf0fff7,0x61ead0,0x10221f)},
  eren:{light:E(0xf4fff8,0x4aa874,0xc8f0d8,0x06140c),heavy:E(0xf4fff8,0x4aa874,0xc8f0d8,0x06140c),special:E(0xf4fff8,0x4aa874,0xc8f0d8,0x06140c),ultimate:E(0xf4fff8,0x4aa874,0xc8f0d8,0x06140c)},
  asuka:{light:E(0xfff1d0,0xff9a30,0x281419),heavy:E(0xfff1d0,0xf02b32,0x281419),special:E(0xfff1d0,0xff9a30,0x281419),ultimate:E(0xfff1d0,0xf02b32,0x281419)},
  netero:{light:E(0xfff1c0,0xe5bd54,0x47311a),heavy:E(0xfff1c0,0xe5bd54,0x47311a),special:E(0xfff1c0,0xe5bd54,0x47311a),ultimate:E(0xfff1c0,0xe5bd54,0x47311a)},
  shinji:{light:E(0xf5e6ff,0x9b5ce4,0x201129),heavy:E(0xffe6a3,0xffab38,0x291221),special:E(0xffe6a3,0xffab38,0x291221),ultimate:E(0xffe6a3,0xf36b28,0x291221)},
  jolyne:{light:E(0xf4fff5,0x6fdadd,0x131925),heavy:E(0xf4fff5,0x88db9e,0x131925),special:E(0xf4fff5,0x6fdadd,0x131925),ultimate:E(0xf4fff5,0x88db9e,0x131925)},
  'might-guy':{light:E(0xf2ffff,0x85d8ed,0x10272b),heavy:E(0xf2ffff,0x85d8ed,0x10272b),special:E(0xf2ffff,0x85d8ed,0x10272b),ultimate:E(0xffb4a0,0xe73a3e,0x250a0c)},
  akame:{light:E(0xffbbbd,0xef2148,0x170b18),heavy:E(0xffbbbd,0xef2148,0x170b18),special:E(0xffbbbd,0xef2148,0x170b18),ultimate:E(0xffeceb,0xef2148,0x170b18)},
  pikachu:{light:E(0xfffee8,0xffb51f,0x302408),heavy:E(0xe8f8ff,0x9fdcff,0x302408),special:E(0xfffee8,0xffb51f,0x302408),ultimate:E(0xfffee8,0xffb51f,0x302408)},
  garou:{light:E(0xc4f3ff,0x2696ec,0x140d18),heavy:E(0xc4f3ff,0x2696ec,0x140d18),special:E(0xc4f3ff,0x2696ec,0x140d18),ultimate:E(0xc4f3ff,0x9b8cff,0x140d18)},
  esdeath:{light:E(0xf0fbff,0x91dfff,0x326da7),heavy:E(0xf0fbff,0x91dfff,0x326da7),special:E(0xf0fbff,0x91dfff,0x326da7),ultimate:E(0xf0fbff,0x91dfff,0x326da7)},
  mikasa:{light:E(0xf5fbff,0xb8cdd8,0x354652),heavy:E(0xf5fbff,0xb8cdd8,0x354652),special:E(0xf5fbff,0xb8cdd8,0x354652),ultimate:E(0xf5fbff,0xb8cdd8,0x354652)},
  'alphonse-elric':{light:E(0xf6fbff,0x8197a3,0x303d45),heavy:E(0xf6fbff,0x8197a3,0x303d45),special:E(0xd9ffff,0x66ddeb,0x284c5c),ultimate:E(0xd9ffff,0x66ddeb,0x284c5c)},
  'ken-kaneki':{light:E(0xffb7cb,0xbc2456,0x140d18),heavy:E(0xffb7cb,0xbc2456,0x140d18),special:E(0xffb7cb,0xbc2456,0x140d18),ultimate:E(0xffe2ec,0xbc2456,0x140d18)},
  grimmjow:{light:E(0xf3ffff,0x49c9e9,0x124b66),heavy:E(0xf3ffff,0x49c9e9,0x124b66),special:E(0xffffff,0x25d7f2,0x10405e),ultimate:E(0xffffff,0x25d7f2,0x10405e)},
  byakuya:{light:E(0xffeff8,0xf794ca,0x43294b),heavy:E(0xffeff8,0xf794ca,0x43294b),special:E(0xffeff8,0xf794ca,0x43294b),ultimate:E(0xffffff,0xffdbea,0x43294b)},
  rengoku:{light:E(0xfff5d3,0xffb441,0xe84b26),heavy:E(0xfff5d3,0xffb441,0xe84b26),special:E(0xfff5d3,0xffb441,0xe84b26),ultimate:E(0xfff5d3,0xffb441,0xe84b26)},
  yamamoto:{light:E(0xfff5d3,0xffc14c,0x6b554b),heavy:E(0xfff5d3,0xff571c,0x341c13),special:E(0xfff5d3,0xff571c,0x341c13),ultimate:E(0xfff5d3,0xff571c,0x341c13)},
  pain:{light:E(0xe5dfee,0x62586b,0x181222),heavy:E(0xf3eefa,0xab8fd4,0x181222),special:E(0xf3eefa,0xab8fd4,0x181222),ultimate:E(0xf3eefa,0xab8fd4,0x181222)},
  'edward-elric':{light:E(0xf6fbff,0xb8d6e4,0x627181),heavy:E(0xe7fbff,0x62cfff,0x466b86),special:E(0xe7fbff,0x62cfff,0x9a8972),ultimate:E(0xe7fbff,0x62cfff,0x9a8972)},
  hiei:{light:E(0xcfacff,0x8053b9,0x171121),heavy:E(0xcfacff,0x8053b9,0x171121),special:E(0xcfacff,0x8053b9,0x171121),ultimate:E(0xcfacff,0x8053b9,0x171121)},
  aokiji:{light:E(0xe9faff,0x83c7e7,0x306b9e),heavy:E(0xe9faff,0x83c7e7,0x306b9e),special:E(0xe9faff,0x83c7e7,0x306b9e),ultimate:E(0xe9faff,0x83c7e7,0x306b9e)},
  doflamingo:{light:E(0xfffaf1,0xf074ad,0x301425),heavy:E(0xfffaf1,0xf074ad,0x301425),special:E(0xfffaf1,0xf64d47,0x301425),ultimate:E(0xfffaf1,0xf074ad,0x301425)},
  hisoka:{light:E(0xffd9f2,0xf072cc,0x3c123f),heavy:E(0xffd9f2,0xf072cc,0x3c123f),special:E(0xfffcf7,0xf072cc,0x3c123f),ultimate:E(0xffd9f2,0xf072cc,0x3c123f)},
  blackbeard:{light:E(0xb074e5,0x41165e,0x100917),heavy:E(0xf1fbff,0x89c9e0,0x556577),special:E(0xb074e5,0x41165e,0x100917),ultimate:E(0xf1fbff,0x89c9e0,0x41165e)},
  nanami:{light:E(0xdff5c2,0x78c6b0,0x556577),heavy:E(0xdff5c2,0x78c6b0,0x556577),special:E(0xdff5c2,0x78c6b0,0x556577),ultimate:E(0xdff5c2,0x78c6b0,0x556577)},
  josuke:{light:E(0xffd9ef,0x80dcf2,0x556577),heavy:E(0xffd9ef,0x80dcf2,0x556577),special:E(0xffd9ef,0x80dcf2,0x556577),ultimate:E(0xffd9ef,0x80dcf2,0x556577)},
  tsunade:{light:E(0xebfff7,0x63efb3,0x51765f),heavy:E(0xebfff7,0x63efb3,0x55545d),special:E(0xebfff7,0x63efb3,0x55545d),ultimate:E(0xebfff7,0x63efb3,0x55545d)},
  jiraiya:{light:E(0xf3faff,0x99be8b,0x51765f),heavy:E(0xf3faff,0x59baff,0x2b5ca0),special:E(0xffdc60,0xf46e26,0xb93021),ultimate:E(0xffdc60,0xf46e26,0xb93021)},
  hinata:{light:E(0xe8faff,0x9abdf5,0x5c97d5),heavy:E(0xe8faff,0x9abdf5,0x5c97d5),special:E(0xe8faff,0x9abdf5,0x5c97d5),ultimate:E(0xe8faff,0x9abdf5,0x5c97d5)},
  gintoki:{light:E(0xf7f2df,0x9dc6e8,0x80705d),heavy:E(0xf7f2df,0x9dc6e8,0x80705d),special:E(0xf7f2df,0x9dc6e8,0x80705d),ultimate:E(0xf7f2df,0x9dc6e8,0x80705d)},
  kizaru:{light:E(0xfffbe4,0xf9c238,0xffe18a),heavy:E(0xfffbe4,0xf9c238,0xffe18a),special:E(0xfffbe4,0xf9c238,0xffe18a),ultimate:E(0xfffbe4,0xf9c238,0xffe18a)},
  yamato:{light:HAKI,heavy:E(0xf5edff,0xc9adeb,0x8b5ed4),special:E(0xf5edff,0xc9adeb,0x8b5ed4),ultimate:E(0xf5edff,0xc9adeb,0x8b5ed4)},
  jinbe:{light:WATER,heavy:WATER,special:WATER,ultimate:E(0xe8fdff,0x42c4df,0x198bb5)},
  enel:{light:PHYSICAL,heavy:LIGHTNING,special:LIGHTNING,ultimate:E(0xeaffff,0x70d9ff,0xf9d25b)},
  yuta:{light:CURSE,heavy:CURSE,special:E(0xf4ebff,0xbda0df,0x826ba5),ultimate:E(0xf4ebff,0xbda0df,0x826ba5)},
  rukia:{light:WATER,heavy:WATER,special:WATER,ultimate:E(0xf6ffff,0x97e1ed,0xc1f4ff)},
  yuji:{light:CURSE,heavy:CURSE,special:CURSE,ultimate:E(0xfbe9e8,0xee4967,0x150305)},
  todoroki:{light:WATER,heavy:FIRE,special:WATER,ultimate:E(0xe4ffff,0x58d9f3,0xa9eeff)},
  endeavor:{light:FIRE,heavy:FIRE,special:FIRE,ultimate:FIRE},
  yoruichi:{light:PHYSICAL,heavy:LIGHTNING,special:LIGHTNING,ultimate:E(0xf4eaff,0xa663ee,0xc3a4ff)},
  goku: { light: PHYSICAL, heavy: PHYSICAL, special: KI_BLUE, ultimate: SPIRIT },
  vegeta: { light: KI_GOLD, heavy: E(0xd6f6ff, 0x2dbeff, 0x46caff), special: KI_PURPLE, ultimate: KI_GOLD },
  naruto: { light: CHAKRA_ORANGE, heavy: CHAKRA_BLUE, special: E(0xeefcff, 0x6fd6ff, 0x9fe6ff), ultimate: BEAST_VIOLET },
  luffy: { light: HAKI, heavy: HAKI, special: HAKI, ultimate: HAKI },
  sanji: { light: FIRE, heavy: FIRE, special: FIRE, ultimate: FIRE },
  ace: { light: FIRE, heavy: FIRE, special: FIRE, ultimate: FIRE },
  zoro: { light: SLASH_GREEN, heavy: SLASH_GREEN, special: SLASH_GREEN, ultimate: SLASH_GREEN },
  kakashi: { light: STEEL, heavy: LIGHTNING, special: LIGHTNING, ultimate: KAMUI_VIOLET },
  sasuke: { light: STEEL, heavy: LIGHTNING, special: E(0xe8d6ff, 0x5a1a9a, 0x8a4ad6, 0x040108), ultimate: E(0xf2e6ff, 0xb469ff, 0xc890ff, 0x10061c) },
  killua: { light: LIGHTNING, heavy: LIGHTNING, special: LIGHTNING, ultimate: LIGHTNING },
  ichigo: { light: BLACK_RED, heavy: BLACK_RED, special: BLACK_RED, ultimate: BLACK_RED },
  guts: { light: BLACK_RED, heavy: BLACK_RED, special: FIRE, ultimate: BLACK_RED },
  jotaro: { light: PHYSICAL, heavy: STAND_PURPLE, special: STAND_PURPLE, ultimate: STAND_PURPLE },
  dio: { light: STAND_GOLD, heavy: STEEL, special: STAND_GOLD, ultimate: STAND_GOLD },
  gojo: { light: CURSED_BLUE, heavy: CURSED_BLUE, special: CURSED_PURPLE, ultimate: CURSED_BLUE },
  law: { light: ROOM_BLUE, heavy: ROOM_BLUE, special: ROOM_BLUE, ultimate: SHOCK_YELLOW },
  kaido: { light: HAKI, heavy: HAKI, special: E(0xeef8ff, 0x8ab8ff, 0xc0dcff, 0x0a0f1c), ultimate: DRAGON_VIOLET },
  whitebeard: { light: STEEL, heavy: STEEL, special: QUAKE_WHITE, ultimate: QUAKE_WHITE },
  mihawk: { light: SLASH_GREEN, heavy: SLASH_GREEN, special: SLASH_GREEN, ultimate: SLASH_GREEN },
  'all-might': { light: PHYSICAL, heavy: PHYSICAL, special: QUAKE_WHITE, ultimate: QUAKE_WHITE },
  bakugo: { light: PHYSICAL, heavy: FIRE, special: FIRE, ultimate: FIRE },
  deku: { light: PHYSICAL, heavy: PHYSICAL, special: SLASH_GREEN, ultimate: SLASH_GREEN },
  broly: { light: PHYSICAL, heavy: PHYSICAL, special: SLASH_GREEN, ultimate: SLASH_GREEN },
  denji: { light: STEEL, heavy: STEEL, special: STEEL, ultimate: STEEL },
  akainu: { light: FIRE, heavy: FIRE, special: FIRE, ultimate: FIRE },
  'boa-hancock': { light: ROSE, heavy: HAKI, special: ROSE, ultimate: ROSE },
  nami: { light: STEEL, heavy: STEEL, special: WATER, ultimate: SHOCK_YELLOW },
  shanks: { light: STEEL, heavy: CONQUEROR, special: CONQUEROR, ultimate: CONQUEROR },
  roger: { light: STEEL, heavy: PIRATE_KING, special: PIRATE_KING, ultimate: PIRATE_KING },
  aizen: { light: HOGYOKU, heavy: HOGYOKU, special: HOGYOKU, ultimate: KUROHITSUGI },
  sukuna: { light: CURSE, heavy: CURSE, special: CURSE, ultimate: FUGA },
  griffith: { light: WHITE_HAWK, heavy: WHITE_HAWK, special: WHITE_HAWK, ultimate: ECLIPSE },
  meruem: { light: ROYAL_JADE, heavy: ROYAL_JADE, special: ROYAL_JADE, ultimate: DECREE },
  'goku-black': { light: ROSE, heavy: ROSE, special: ROSE, ultimate: ROSE },
  jiren: { light: PRIDE_RED, heavy: PRIDE_RED, special: PRIDE_RED, ultimate: PRIDE_RED },
  'golden-frieza': { light: DEATH_BEAM, heavy: GOLDEN, special: DEATH_BEAM, ultimate: DEATH_BALL },
  'gohan-beast': { light: BEAST, heavy: BEAST, special: MASENKO, ultimate: BEAM_CANNON },
  saitama: { light: ONE_PUNCH, heavy: ONE_PUNCH, special: ONE_PUNCH, ultimate: SERIOUS },
  akaza: { light: DESTRUCTIVE, heavy: DESTRUCTIVE, special: COMPASS, ultimate: DESTRUCTIVE },
  itachi: { light: SHARINGAN, heavy: SHARINGAN, special: BLACK_FLAME, ultimate: SHARINGAN },
  madara: { light: UCHIHA, heavy: UCHIHA, special: MAJESTIC, ultimate: METEOR },
  tanjiro: { light: WATER, heavy: WATER, special: WATER, ultimate: SUN_FIRE },
  levi: { light: WINGS_STEEL, heavy: WINGS_STEEL, special: WINGS_STEEL, ultimate: WINGS_STEEL },
  'sung-jinwoo': { light: SHADOW, heavy: SHADOW, special: SHADOW, ultimate: SHADOW },
  gon: { light: NEN, heavy: NEN, special: NEN, ultimate: NEN },
};

const FORM_TABLE: Partial<Record<FighterId, Record<'light' | 'heavy' | 'special' | 'ultimate', Element>>> = {
  eren:{light:E(0xe7fff1,0x45896e,0x11231d),heavy:E(0xfff0cc,0xc6a268,0x262318),special:E(0xd2f7e2,0x45896e,0x11231d),ultimate:E(0xffedbc,0xe4b450,0x262318)},
};
const AWAKENED_SANJI = E(0xe6f6ff, 0x3f8cff, 0x7fc8ff);
const AWAKENED: Partial<Record<FighterId, Element>> = {
  goku: KI_GOLD, vegeta: KI_GOLD, naruto: CHAKRA_ORANGE, luffy: NIKA, ace: FIRE, sanji: AWAKENED_SANJI,
  mihawk: SLASH_GREEN, zoro: SLASH_GREEN, ichigo: BLACK_RED, guts: BLACK_RED, killua: LIGHTNING, gojo: CURSED_BLUE, law: ROOM_BLUE,
  kaido: DRAGON_VIOLET, whitebeard: QUAKE_WHITE, shanks: CONQUEROR, roger: PIRATE_KING, aizen: HOGYOKU, sukuna: CURSE, griffith: ECLIPSE, meruem: DECREE, 'goku-black': ROSE, jiren: PRIDE_RED, 'golden-frieza': GOLDEN,
  'gohan-beast': BEAST, saitama: SERIOUS, akaza: COMPASS, itachi: SHARINGAN,
  madara: SUSANOO_BLUE, tanjiro: SUN_FIRE, levi: WINGS_STEEL, 'sung-jinwoo': SHADOW, gon: NEN,
};

const RUSH: Partial<Record<FighterId, Partial<Record<number, Element>>>> = {
  gojo: { 3: CURSED_RED }, kakashi: { 3: LIGHTNING }, naruto: { 3: CHAKRA_ORANGE }, ichigo: { 3: BLACK_RED }, killua: { 3: LIGHTNING },
  ace: { 1: FIRE, 2: FIRE, 3: FIRE }, sanji: { 3: FIRE }, jotaro: { 3: STAND_PURPLE }, dio: { 3: STAND_GOLD },
};

const KI_WHITE = E(0xf6fcff, 0x3fb8ff, 0x9fdcff, 0x06142a);
const KURAMA = E(0xffe6c8, 0xff3c14, 0xff6a2a, 0x1c0604);
const PURPLE_LIGHTNING = E(0xf4e8ff, 0x9a4aff, 0xbf94ff, 0x0c0418);
const STEEL_BLOOD = E(0xf2f6fa, 0xc0222a, 0xffb4a8, 0x0c0204);
const KAIOKEN = E(0xffe2dc, 0xff2a24, 0xff5a46, 0x1c0404);
const SOLAR = E(0xffffff, 0xfff0a0, 0xfffbe6, 0x14100a);
const WIND = E(0xeefcff, 0x6fd6ff, 0x9fe6ff, 0x061420);
const EARTH = E(0xfff0d8, 0xb08850, 0xe0c8a0, 0x1a1006);
const FROST = E(0xf4fdff, 0x8fd8ff, 0xd0f4ff, 0x061420);
const BLACK_FLASH = E(0xff6a5a, 0x9a0014, 0xff2a30, 0x000000);
const INFINITY_PALE = E(0xf4fbff, 0x9fe6ff, 0xd8f6ff, 0x061426);
export const ENDER_ELEMENTS: Partial<Record<FighterId, { base: Element; keys?: Partial<Record<ComboKey, Element>>; awakened?: Element; awakenedKeys?: Partial<Record<ComboKey, Element>> }>> = {
  goku: { base: KI_WHITE, keys: { lh: KI_GOLD, llh: KAIOKEN, llls: SOLAR, airSpecial: KI_BLUE }, awakened: KI_GOLD },
  vegeta: { base: KI_PURPLE, keys: { llh: KI_GOLD, llls: KI_GOLD, airSpecial: KI_GOLD }, awakened: KI_GOLD },
  naruto: { base: CHAKRA_ORANGE, keys: { lllh: CHAKRA_BLUE, llls: WIND, airSpecial: CHAKRA_BLUE }, awakened: KURAMA, awakenedKeys: { airSpecial: BEAST_VIOLET } },
  luffy: { base: HAKI, keys: { airSpecial: FIRE }, awakened: NIKA, awakenedKeys: { llls: LIGHTNING, airSpecial: FIRE } },
  mihawk: { base: SLASH_GREEN },
  zoro: { base: SLASH_GREEN, keys: { airHeavy: FIRE } },
  sanji: { base: FIRE, awakened: AWAKENED_SANJI },
  ace: { base: FIRE },
  law: { base: ROOM_BLUE },
  gojo: { base: CURSED_BLUE, keys: { lh: BLACK_FLASH, llls: INFINITY_PALE, airSpecial: CURSED_PURPLE } },
  jotaro: { base: STAND_PURPLE },
  dio: { base: STAND_GOLD, keys: { llls: FROST } },
  ichigo: { base: BLACK_RED },
  guts: { base: STEEL_BLOOD, keys: { llls: FIRE, airSpecial: FIRE } },
  killua: { base: LIGHTNING, keys: { lh: STEEL } },
  kakashi: { base: LIGHTNING, keys: { lh: WATER, lllh: EARTH, llls: EARTH, airSpecial: PURPLE_LIGHTNING } },
  sasuke: { base: PURPLE_LIGHTNING, keys: { lllh: FIRE } },
};
export function enderElement(fighter: FighterId | undefined, key: ComboKey | undefined, awakened = false): Element | undefined {
  const row = fighter && key ? ENDER_ELEMENTS[fighter] : undefined;
  if (!row || !key) return undefined;
  if (awakened) return row.awakenedKeys?.[key] ?? row.awakened ?? row.keys?.[key] ?? row.base;
  return row.keys?.[key] ?? row.base;
}

export function elementFor(fighter: FighterId | undefined, slot?: AttackSlot, awakened = false, chain = 0, branch?: ComboKey): Element {
  if (!fighter) return PHYSICAL;
  const ender = branch && (slot === 'heavy' || slot === 'special') ? enderElement(fighter, branch, awakened) : undefined;
  if (ender) return ender;
  const rush = slot === 'light' && chain > 0 ? RUSH[fighter]?.[chain] : undefined;
  if (rush) return rush;
  const form = awakened ? FORM_TABLE[fighter] : undefined;
  if (form) return form[slot === 'area' ? 'special' : slot ?? 'light'];
  if (awakened && (slot === undefined || slot === 'light' || slot === 'heavy')) return AWAKENED[fighter] ?? TABLE[fighter].light;
  return TABLE[fighter][slot === 'area' ? 'special' : slot ?? 'light'];
}

const TECHNIQUE: Partial<Record<FighterId, Partial<Record<AttackSlot, number>>>> = {
  goku: { special: 0x46c3ff, ultimate: 0x5fd4ff }, kakashi: { heavy: 0x8fd0ff, special: 0x8fd0ff, ultimate: 0x9a6cff },
  naruto: { heavy: 0x5fd4ff, special: 0x7fdcff }, gojo: { special: 0xc050ff, ultimate: 0x9a60ff },
  ichigo: { special: 0xff3048, ultimate: 0xd01830 }, luffy: { special: 0xff3a2a }, sasuke: { ultimate: 0xb469ff },
};
export function techniqueColour(fighter: FighterId, slot: AttackSlot, awakened = false, branch?: ComboKey): number {
  const ender = branch && (slot === 'heavy' || slot === 'special') ? enderElement(fighter, branch, awakened) : undefined;
  if (ender) return ender.light;
  if (awakened && fighter === 'naruto') return 0xff8a2a;
  return TECHNIQUE[fighter]?.[slot] ?? elementFor(fighter, slot, awakened).light;
}

const GRADE: Partial<Record<FighterId, Partial<Record<AttackSlot, number>>>> = {
  goku: { special: 0x3a8cff, ultimate: 0x3a8cff }, kakashi: { special: 0x3a8cff, ultimate: 0x8a4dff },
  naruto: { special: 0x3a8cff, ultimate: 0x8a4dff }, gojo: { special: 0x8a4dff, ultimate: 0x8a4dff },
  ichigo: { special: 0xd0203a, ultimate: 0xd0203a }, luffy: { special: 0xd0203a }, sasuke: { ultimate: 0x8a4dff },
  killua: { special: 0x3a8cff, ultimate: 0x3a8cff },
};
export function gradeHue(fighter: FighterId, slot: AttackSlot, awakened = false, branch?: ComboKey): number {
  const ender = branch && (slot === 'heavy' || slot === 'special') ? enderElement(fighter, branch, awakened) : undefined;
  if (ender) return ender.rim;
  if (awakened && fighter === 'naruto') return 0xff7a1a;
  return GRADE[fighter]?.[slot] ?? techniqueColour(fighter, slot, awakened);
}
const SHOP_GRADE = .25;
const SHOP: ReadonlySet<FighterId> = new Set<FighterId>(['kaido', 'whitebeard', 'shanks', 'roger', 'aizen', 'sukuna', 'griffith', 'meruem',
  'goku-black', 'jiren', 'golden-frieza', 'gohan-beast', 'saitama', 'akaza', 'itachi', 'madara', 'tanjiro', 'levi', 'sung-jinwoo', 'gon']);
export function gradeStrength(fighter: FighterId): number { return SHOP.has(fighter) ? SHOP_GRADE : 1; }

export function ghostTint(fighter: FighterId, awakened = false, slot?: AttackSlot, chain = 0): number {
  if (slot === 'light' && chain > 0) { const rush = RUSH[fighter]?.[chain]; if (rush) return rush.light; }
  if (awakened) return (AWAKENED[fighter] ?? TABLE[fighter].special).light;
  return GHOSTS[fighter] ?? 0xbfe6ff;
}
const GHOSTS: Partial<Record<FighterId, number>> = { goku: 0x7fd8ff, vegeta: 0x8aa8ff, naruto: 0xffb54a, luffy: 0xff6a4a, sanji: 0xffa04a,
  ace: 0xff8a2a, zoro: 0x8af0a8, kakashi: 0x9fd8ff, sasuke: 0xb48cff, killua: 0xbfe6ff, ichigo: 0xff5068, guts: 0xff4a4a,
  jotaro: 0xb48cff, dio: 0xffd24a, gojo: 0x7fe6ff, law: 0x7fc8ff,
  kaido: 0xffa63a, whitebeard: 0x5ac8ff, shanks: 0xff5a64, roger: 0xff4040, aizen: 0xa060ff, sukuna: 0xff4a5e,
  griffith: 0xf4f0ff, meruem: 0x6af0a0, 'goku-black': 0xff7ae0, jiren: 0xff5a4a, 'golden-frieza': 0xffd04a,
  'gohan-beast': 0xc49aff, saitama: 0xff5a3a, akaza: 0xff7ab0, itachi: 0xff4a5a, madara: 0x9a8cff, tanjiro: 0x6ac8ff,
  levi: 0x7ae0a0, 'sung-jinwoo': 0x9a6aff, gon: 0xffc840,
  tatsumaki: 0x86ffc4 };
