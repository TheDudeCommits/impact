import type { FighterId } from '../../game/types';

export type BodyType = 'blade' | 'fists' | 'kicks' | 'polearm' | 'caster' | 'giant';
export type ElementKitId = 'fire' | 'blackflame' | 'explosion' | 'ice' | 'lightning' | 'beam' | 'haki' | 'slash'
  | 'domain' | 'gravity' | 'summon' | 'windwater' | 'earth' | 'strings' | 'mecha' | 'strength';

export const BODY_TYPES: Readonly<Record<BodyType, { label: string; about: string }>> = {
  blade: { label: 'Blades', about: 'Swords, axes and chainsaws: draw, slash and iai clip sets, and a weapon-tip socket for trails.' },
  fists: { label: 'Fists', about: 'Strikers and brawlers: jab, straight and uppercut sets, and a palm socket for charge orbs.' },
  kicks: { label: 'Kicks', about: 'Kick-led fighters: kick strings and foot sockets.' },
  polearm: { label: 'Polearms & clubs', about: 'Kanabo, bisento, staff, Clima-Tact and gunbai: long-reach swing sets.' },
  caster: { label: 'Casters', about: 'Controllers whose moves are mostly the effect: gestures more than swings.' },
  giant: { label: 'Giants & mecha', about: 'EVAs, Titans, kaiju and armour: a heavy gait and a bigger body.' },
};

export const ELEMENT_KITS: Readonly<Record<ElementKitId, { label: string; about: string }>> = {
  fire: { label: 'Fire & magma', about: 'Flame streams, burning fists, pillars of fire, magma fists and meteors.' },
  blackflame: { label: 'Black flame', about: 'Fire that reads dark: Amaterasu, Hellblaze, the Darkness Flame.' },
  explosion: { label: 'Explosions', about: 'Palm blasts, thunder spears and planet-sized bombs.' },
  ice: { label: 'Ice', about: 'Crystal fields, ice lances and frozen floors.' },
  lightning: { label: 'Lightning', about: 'Arcs, electric auras, strikes from the sky and lightning-fast steps.' },
  beam: { label: 'Beams, ki & light', about: 'Kamehameha, Galick Gun, Cero, lasers and the charge before them.' },
  haki: { label: 'Haki', about: "Conqueror's black lightning and armament coating, for One Piece only." },
  slash: { label: 'Slash waves', about: 'Flying slashes, iai cuts, sword trails and blade storms.' },
  domain: { label: 'Domains & cursed energy', about: 'Domain expansions, ROOM, Tsukuyomi and cursed-energy strikes.' },
  gravity: { label: 'Gravity & void', about: 'Pulls, pushes, black holes and psychic force.' },
  summon: { label: 'Summons & stands', about: 'Stands, Susanoo, Kurama, Bodhisattva, shadow soldiers.' },
  windwater: { label: 'Wind & water', about: 'Air-pressure smashes, Rasenshuriken, tornadoes and water styles.' },
  earth: { label: 'Earth & alchemy', about: 'Transmutation, ground spikes, quakes and floor-breaking strength.' },
  strings: { label: 'Strings & petals', about: 'Threads, bungee gum, blooming hands and blade petals.' },
  mecha: { label: 'Titans & mecha', about: 'EVAs, Titans, kaiju and armour: the bridge to a Mecha pack.' },
  strength: { label: 'Raw strength', about: 'Fists, kicks and barrages that hit like trucks with no element at all.' },
};

const list = (ids: string) => ids.split(/\s+/).filter(Boolean) as FighterId[];

const BODY_LISTS: Readonly<Record<BodyType, readonly FighterId[]>> = {
  blade: list(`toji rengoku ichigo mihawk roger shanks gintoki kenpachi byakuya yamamoto aizen rukia akame tanjiro yuta griffith esdeath
    goku-black hiei law zoro mikasa levi eren sung-jinwoo edward-elric nanami meliodas escanor guts denji aokiji`),
  fists: list(`ace grimmjow goku vegeta gohan-beast broly jiren saitama garou luffy jotaro dio josuke jolyne all-might deku
    bakugo endeavor akaza yuji gon killua netero might-guy tsunade sakura jinbe ken-kaneki meruem pikachu akainu
    golden-frieza minato naruto kakashi sasuke itachi blackbeard`),
  kicks: list('sanji kizaru boa-hancock hinata yoruichi'),
  polearm: list('kaido yamato whitebeard enel nami madara'),
  caster: list('usopp crocodile gojo sukuna makima tatsumaki pain nico-robin doflamingo hisoka jiraiya todoroki'),
  giant: list('shinji asuka kaiju-no-8 alphonse-elric'),
};

const ELEMENT_LISTS: Readonly<Record<ElementKitId, readonly FighterId[]>> = {
  fire: list('rengoku ace endeavor yamamoto jiraiya madara sanji tanjiro todoroki escanor akainu'),
  blackflame: list('sasuke itachi hiei meliodas'),
  explosion: list('usopp bakugo levi golden-frieza'),
  ice: list('aokiji esdeath rukia todoroki'),
  lightning: list('kakashi sasuke killua enel pikachu nami yoruichi deku minato kaido yamato'),
  beam: list('goku vegeta gohan-beast goku-black golden-frieza broly jiren grimmjow aizen ichigo saitama kizaru'),
  haki: list('luffy shanks roger whitebeard kaido mihawk yamato zoro boa-hancock blackbeard jinbe'),
  slash: list(`toji rengoku zoro mihawk ichigo byakuya kenpachi gintoki akame mikasa levi eren sukuna yuta tanjiro griffith guts sung-jinwoo
    denji roger shanks esdeath goku-black edward-elric nanami`),
  domain: list('gojo sukuna yuji yuta nanami law itachi'),
  gravity: list('pain blackbeard tatsumaki makima aizen gojo'),
  summon: list('jotaro dio josuke jolyne naruto netero sung-jinwoo madara'),
  windwater: list('crocodile jinbe garou naruto nami all-might deku tatsumaki hinata tanjiro'),
  earth: list('crocodile edward-elric alphonse-elric whitebeard tsunade sakura kaiju-no-8'),
  strings: list('usopp doflamingo jolyne hisoka byakuya nico-robin sakura boa-hancock'),
  mecha: list('shinji asuka eren kaiju-no-8 alphonse-elric'),
  strength: list('toji saitama garou might-guy tsunade jiren akaza netero gon all-might luffy jotaro yuji ken-kaneki meruem broly guts sanji'),
};

const BODY_OF = new Map<FighterId, BodyType>();
for (const [type, ids] of Object.entries(BODY_LISTS) as [BodyType, readonly FighterId[]][]) for (const id of ids) BODY_OF.set(id, type);
const ELEMENTS_OF = new Map<FighterId, ElementKitId[]>();
for (const [kit, ids] of Object.entries(ELEMENT_LISTS) as [ElementKitId, readonly FighterId[]][]) for (const id of ids) ELEMENTS_OF.set(id, [...(ELEMENTS_OF.get(id) ?? []), kit]);

export const bodyTypeOf = (id: FighterId): BodyType | undefined => BODY_OF.get(id);
export const elementKitsOf = (id: FighterId): readonly ElementKitId[] => ELEMENTS_OF.get(id) ?? [];
export const membersOfKit = (kit: ElementKitId): readonly FighterId[] => ELEMENT_LISTS[kit];
export const membersOfBody = (type: BodyType): readonly FighterId[] => BODY_LISTS[type];
