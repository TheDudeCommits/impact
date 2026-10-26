import { RosterSignatureSet, hasRosterSignature } from './signature/RosterSignatureSet';
import { armoryDraws, flightKept } from './vfx/armory/drawn';
import { AllMightPressure, isAllMightPressure } from './signature/AllMightPressure';
import { BakugoExplosions, isBakugoExplosions } from './signature/BakugoExplosions';
import { DekuCowling, isDekuCowling } from './signature/DekuCowling';
import { BrolyBerserker, isBrolyBerserker } from './signature/BrolyBerserker';
import { DenjiChainsaw, isDenjiChainsaw } from './signature/DenjiChainsaw';
import { AkainuMagma, isAkainuMagma } from './signature/AkainuMagma';
import { comboMove, type ComboKey } from '../game/combos';
import * as THREE from 'three';
import { energyOrbMaterial, energyHaloMaterial, energyImpactMaterial, pressureWaveMaterial, groundDustMaterial } from './vfx/EnergyOrbMaterial';
import { fireFistGeometry } from './vfx/FireFistGeometry';
import { fireFistMaterial } from './vfx/FireFistMaterial';
import { windBladeGeometry, windBladeMaterial } from './vfx/WindBlade';
import { VfxKit, bodyCentre, DUST_LIT, DUST_SHADE, DREAM_IMPACT, type ImpactClass, type HitTier } from './vfx/VfxKit';
import { SPRITE, ORIENT } from './vfx/SparkField';
import { MotionFx, type ScreenFx } from './vfx/MotionFx';
import { VictimVeil, installVeil, VEIL } from './vfx/VictimVeil';
import { elementFor, enderElement, ghostTint, techniqueColour, gradeHue, gradeStrength, PHYSICAL, type Element } from './vfx/palette';
import { MOVES, type MoveDefinition } from '../game/moves';
import {moveFor, rushMove} from '../game/awakening';
import type { AttackSlot, CombatEvent, FighterId, PlayerState } from '../game/types';
import { strikeOffsets } from '../engine/sim/areaDamage';
import { Fighter } from './Fighter';
import { LANDED } from '../game/landedBlows';
import { BlastAreas } from './signature/BlastArea';
import { BOMB_COMMIT, BOMB_HOME, bombLead, homeStep, homeWant, inRange } from '../game/bombAim';
import { OPENER_FEED, undecided } from './signature/ultimateClock';
import { GuardFx } from './vfx/GuardFx';
import { NamiWeather } from './signature/NamiWeather';
import { BoaEmpress, isBoaEmpress } from './signature/BoaEmpress';
import { bigBlowOf, cinematicBlowOf } from './bigBlowEvent';
export type { ScreenFx } from './vfx/MotionFx';

type CastView = {
  event: CombatEvent; group: THREE.Group; rings: THREE.Mesh[]; streams?: THREE.InstancedMesh;
  start: THREE.Vector3; end: THREE.Vector3; hitEnd?: THREE.Vector3;
  hitTargetId?: string; hitAt?: number;
  release: number; duration: number; travel: number; released: boolean; contactAt?: number; beamReleasedAt?: number;
  palmCharges?:THREE.Mesh[];
  weapon?:THREE.Object3D;
  ownedMaterial?:THREE.ShaderMaterial; contactIndex?:number;
  kurama?:boolean;
  presentedAge?:number;
  ender?:MoveDefinition;
  aimed?:THREE.Vector3; aimedDone?:boolean;
  foe?:string; foeFloor?:number; homeFrom?:THREE.Vector3;
  floor: number; surface: boolean;
  nextSpark: number; nextRing: number; nextMuzzle: number; nextRock: number; nextTrail: number; nextGather: number; scorched: boolean;
};
type Impact = { born: number; duration: number; size: number; energy: boolean; seed: number; slot?: BurstSlot; ultimate?: boolean; follow?: Fighter; offset?: THREE.Vector3 };
type Glow = { actorId: string; slot: AttackSlot; born: number; release: number; end: number; colour: number; peak: number; reach: number; left?: number };
const rosterFlight = (id: string | undefined, slot?: string, branch?: string, player?: string) =>
  hasRosterSignature(id, slot, branch, player) && !flightKept(id, slot, branch, player);
const WHIFF_FADE = .25;
const BLAST_TINT: Partial<Record<FighterId, number>> = { goku: 0x9fe0ff, naruto: 0xb04bff, ace: 0xff8a2a, gojo: 0x9d7bff, 'golden-frieza': 0xff4a12 };
type BurstSlot = {
  group: THREE.Group; rim: THREE.MeshBasicMaterial; streaks: THREE.InstancedMesh; ink: THREE.InstancedMesh; inkMaterial: THREE.MeshBasicMaterial;
  shell: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>; pressure: THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial>;
  dust: THREE.InstancedMesh<THREE.SphereGeometry, THREE.ShaderMaterial>; debris: THREE.InstancedMesh; debrisMaterial: THREE.MeshBasicMaterial; busy: boolean;
};
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const WHITE = new THREE.Color(1, 1, 1);

export interface Flight { fighter: FighterId; slot: AttackSlot; branch?: ComboKey; actorId?: string; position: THREE.Vector3; heading: THREE.Vector3; origin?: THREE.Vector3; released: boolean; since: number; awakened?: boolean }
export const FLIGHTS = new Map<string, Flight>();
const FLAME_THROWERS = new Set<FighterId>(['luffy', 'sanji', 'ace']);
const KAMEHAMEHA_BALL = .15;
const FLIGHT_DRESSED = new Set<FighterId>([...FLAME_THROWERS, 'killua', 'gojo', 'guts', 'nami', 'boa-hancock', 'akainu', 'broly', 'deku', 'bakugo', 'all-might', 'jinbe', 'yamato', 'yuta', 'rukia', 'todoroki', 'endeavor']);
const KNIFE_THROWERS = new Set<FighterId>(['dio']);
const knifeThrow = (event: CombatEvent) => !event.branch && !!event.fighter && KNIFE_THROWERS.has(event.fighter);
const isSun = (fighter: FighterId | undefined, slot: string | undefined) => fighter === 'ace' && slot === 'ultimate';
const SUN_RADIUS = 2.2;
const SUN_HEIGHT = 3.6;
const CRESCENT_ARC = Math.PI * 1.15;
const flightKey = (cast: { event: CombatEvent; contactIndex?: number }) => `${cast.event.id}:${cast.contactIndex ?? 0}`;
const SPIRIT_RADIUS = 2.3;
export function bigBall(age: number, release: number) {
  return (.05 + THREE.MathUtils.smoothstep(age, .04, release * .92) * .25) * (1 - THREE.MathUtils.smoothstep(age, release + .1, release + .36));
}
const SPIRIT_HEIGHT = 4.65;
export const BIJUDAMA = { held: 2, kurama: 3 } as const;
const DEATH_BALL = 1.5;
const BIJU_FORWARD = new THREE.Vector3();
const BEAM_LOOKS: Record<string, { shell: number; edge: number; light: number; spike: number; scale: number; lit?: number }> = {
  'goku:special': { shell: 0x2fb4ff, edge: 0x0a30d0, light: 0x46c3ff, spike: 0xc8f6ff, scale: .88 },
  'goku-black:special': { shell: 0xff56c5, edge: 0x53094f, light: 0xff80dc, spike: 0xffd5f5, scale: .88 },
  'vegeta:special': { shell: 0xa650ff, edge: 0x3a0aa0, light: 0xa860ff, spike: 0xf0d6ff, scale: .9 },
  'vegeta:ultimate': { shell: 0xffb81c, edge: 0xff5a00, light: 0xffe07a, spike: 0xfff2b0, scale: .72, lit: .55 },
  'gojo:special': { shell: 0xc446ff, edge: 0xff28bc, light: 0xd050ff, spike: 0xffd8fb, scale: .88 },
};

const BEAM_ELEMENTS: Record<string, Element> = Object.fromEntries(Object.entries(BEAM_LOOKS).map(([key, look]) => [key, { spike: look.spike, rim: look.shell, light: look.light, ink: look.edge }]));

export function chargeWasCancelled(event: CombatEvent, release: number, state: PlayerState | undefined, now: number) {
  const age = now - event.serverTime;
  if (!state) return age > .12;
  const sameCast = state.action === event.slot && (event.actionSeq!==undefined&&state.actionSeq===event.actionSeq||Math.abs(state.actionStarted - event.serverTime) < .075);
  if (sameCast && state.alive) return false;
  const actionAge = state.actionStarted - event.serverTime;
  return age > .1 && actionAge >= -1e-6 && actionAge < release - 1 / 120;
}

export function hitTier(slot?: AttackSlot, branch?: ComboKey, chain?: number): HitTier | undefined {
  if (branch === 'llh' || branch === 'airSpecial') return 'launch';
  if (branch === 'lllh') return 'slam';
  if (branch === 'lh' || branch === 'llls' || branch === 'airHeavy') return 'finish';
  if (slot === 'light' && (chain ?? 0) >= 3) return 'finish';
  return undefined;
}

export function impactClass(event: CombatEvent, move?: MoveDefinition): ImpactClass {
  const damage = event.damage ?? 40;
  let cls: ImpactClass = damage < 50 ? 0 : damage < 115 ? 1 : damage < 220 ? 2 : 3;
  if (event.slot === 'light' && (event.chain ?? 0) >= 3) cls = Math.max(cls, 2) as ImpactClass;
  const final = !!move && move.contacts.length > 1 && event.contactIndex === move.contacts.length - 1;
  if (final) cls = Math.max(cls, event.slot === 'ultimate' ? 3 : event.slot === 'light' ? 1 : 2) as ImpactClass;
  const lastBlow = !move || event.contactIndex === undefined || event.contactIndex >= move.contacts.length - 1;
  if (event.slot === 'special' && !event.branch && lastBlow) cls = Math.max(cls, 2) as ImpactClass;
  if (DREAM_IMPACT && event.branch) cls = Math.max(cls, event.branch === 'llh' || event.branch === 'lllh' || event.branch === 'airHeavy' ? 3 : 2) as ImpactClass;
  return cls;
}

export const SCREEN_FLOOR: Partial<Record<AttackSlot, number>> = { heavy: 52, ultimate: 245, area: 40 };
export function screenWorth(event: CombatEvent): number {
  const damage = event.damage ?? 40, floor = event.slot && !event.branch ? SCREEN_FLOOR[event.slot] : undefined;
  if (!floor || damage >= floor || !event.fighter || !event.slot) return damage;
  const move = thrown(event.fighter, event.slot, undefined, false);
  const count = event.slot === 'area' ? strikeOffsets(move).length : move.contacts.length;
  return event.contactIndex === undefined || event.contactIndex >= count - 1 ? floor : damage;
}

export const PANEL_REST = 5, LONG_STRING = 7;
export const IMPACT_FRAME_HOLD = .2;
type Accent = 'shockwave' | 'hammer' | 'smoke' | 'bolt' | 'spiral' | 'tornado' | 'rising' | 'flurry' | 'crescent' | 'cross' | 'room' | 'red' | 'crater';
const FORM_FINISHERS: Partial<Record<FighterId, { shape: Accent; screen: 'speed' | 'fringe' | 'grade' }>> = { eren: { shape: 'flurry', screen: 'fringe' } };
export const FINISHERS: Record<FighterId, { shape: Accent; screen: 'speed' | 'fringe' | 'grade' }> = {
  toji:{shape:'crescent',screen:'speed'},
  crocodile:{shape:'tornado',screen:'fringe'},
  usopp:{shape:'shockwave',screen:'fringe'},
  rengoku:{shape:'crescent',screen:'speed'},
  sakura:{shape:'crater',screen:'fringe'},
  meliodas:{shape:'cross',screen:'fringe'},
  escanor:{shape:'cross',screen:'fringe'},
  tatsumaki:{shape:'tornado',screen:'fringe'},
  makima:{shape:'room',screen:'fringe'},
  kenpachi:{shape:'crescent',screen:'speed'},
  minato:{shape:'spiral',screen:'speed'},
  'nico-robin':{shape:'flurry',screen:'fringe'},
  'kaiju-no-8':{shape:'flurry',screen:'fringe'},
  eren:{shape:'tornado',screen:'speed'},
  asuka:{shape:'crescent',screen:'fringe'},
  netero:{shape:'flurry',screen:'fringe'},
  shinji:{shape:'flurry',screen:'fringe'},
  jolyne:{shape:'flurry',screen:'fringe'},
  'might-guy':{shape:'shockwave',screen:'fringe'},
  akame:{shape:'crescent',screen:'fringe'},
  pikachu:{shape:'crescent',screen:'fringe'},
  garou:{shape:'crescent',screen:'fringe'},
  esdeath:{shape:'crescent',screen:'fringe'},
  mikasa:{shape:'crescent',screen:'fringe'},
  'alphonse-elric':{shape:'crescent',screen:'fringe'},
  'ken-kaneki':{shape:'crescent',screen:'fringe'},
  grimmjow:{shape:'crescent',screen:'fringe'},
  byakuya:{shape:'crescent',screen:'fringe'},
  yamamoto:{shape:'crescent',screen:'fringe'},
  pain:{shape:'room',screen:'fringe'},
  'edward-elric':{shape:'spiral',screen:'speed'},
  hiei:{shape:'cross',screen:'fringe'},
  aokiji:{shape:'rising',screen:'fringe'},
  doflamingo:{shape:'cross',screen:'fringe'},
  hisoka:{shape:'cross',screen:'fringe'},
  blackbeard:{shape:'crater',screen:'fringe'},
  nanami:{shape:'crescent',screen:'speed'},josuke:{shape:'flurry',screen:'fringe'},
  tsunade:{shape:'bolt',screen:'fringe'},jiraiya:{shape:'bolt',screen:'fringe'},
  hinata:{shape:'bolt',screen:'fringe'},gintoki:{shape:'crescent',screen:'speed'},
  kizaru:{shape:'bolt',screen:'speed'},yamato:{shape:'hammer',screen:'fringe'},
  jinbe:{shape:'shockwave',screen:'grade'},enel:{shape:'bolt',screen:'fringe'},
  yuta:{shape:'shockwave',screen:'grade'},
  rukia:{shape:'shockwave',screen:'grade'},
  yuji:{shape:'bolt',screen:'fringe'},
  todoroki:{shape:'shockwave',screen:'grade'},endeavor:{shape:'shockwave',screen:'grade'},yoruichi:{shape:'bolt',screen:'fringe'},
  'all-might': { shape: 'shockwave', screen: 'speed' },
  bakugo: { shape: 'shockwave', screen: 'speed' },
  deku: { shape: 'shockwave', screen: 'speed' },
  broly: { shape: 'shockwave', screen: 'speed' },
  denji: { shape: 'crescent', screen: 'fringe' },
  akainu: { shape: 'crescent', screen: 'grade' },
  mihawk: { shape: 'crescent', screen: 'grade' },
  'boa-hancock': { shape: 'crescent', screen: 'fringe' },
  nami: { shape: 'bolt', screen: 'grade' },
  goku: { shape: 'shockwave', screen: 'speed' }, vegeta: { shape: 'hammer', screen: 'fringe' },
  naruto: { shape: 'smoke', screen: 'grade' }, sasuke: { shape: 'bolt', screen: 'grade' },
  kakashi: { shape: 'bolt', screen: 'speed' }, luffy: { shape: 'spiral', screen: 'speed' },
  zoro: { shape: 'tornado', screen: 'grade' }, sanji: { shape: 'rising', screen: 'grade' },
  jotaro: { shape: 'flurry', screen: 'fringe' }, ichigo: { shape: 'crescent', screen: 'grade' },
  ace: { shape: 'cross', screen: 'grade' }, law: { shape: 'room', screen: 'grade' },
  gojo: { shape: 'red', screen: 'fringe' }, dio: { shape: 'flurry', screen: 'grade' },
  guts: { shape: 'crater', screen: 'fringe' }, killua: { shape: 'bolt', screen: 'speed' },
  kaido: { shape: 'crater', screen: 'fringe' }, whitebeard: { shape: 'shockwave', screen: 'grade' }, shanks: { shape: 'crescent', screen: 'fringe' },
  roger: { shape: 'crescent', screen: 'grade' },
  aizen: { shape: 'room', screen: 'grade' },
  sukuna: { shape: 'cross', screen: 'grade' },
  griffith: { shape: 'crescent', screen: 'speed' },
  meruem: { shape: 'shockwave', screen: 'fringe' },
  'goku-black': { shape: 'shockwave', screen: 'speed' },
  jiren: { shape: 'crater', screen: 'fringe' },
  'golden-frieza': { shape: 'crescent', screen: 'speed' },
  'gohan-beast': { shape: 'hammer', screen: 'fringe' },
  saitama: { shape: 'shockwave', screen: 'speed' },
  akaza: { shape: 'crater', screen: 'fringe' },
  itachi: { shape: 'crescent', screen: 'grade' },
  madara: { shape: 'crater', screen: 'fringe' },
  tanjiro: { shape: 'crescent', screen: 'grade' },
  levi: { shape: 'tornado', screen: 'speed' },
  'sung-jinwoo': { shape: 'cross', screen: 'grade' },
  gon: { shape: 'shockwave', screen: 'speed' },
};
const TOUCH_SPARK = .45, TOUCH_KEPT = 2;

function thrown(fighter: FighterId, slot: AttackSlot, branch: ComboKey | undefined, kurama: boolean, awakened = kurama): MoveDefinition {
  return (branch ? comboMove(fighter, branch, awakened) : undefined) ?? moveFor(fighter, slot, kurama);
}

type Thrown = 'spear' | 'katana' | 'thunder' | 'dagger' | 'jets' | 'quarrel' | 'yoyo';
const THROWN: Partial<Record<FighterId, Partial<Record<AttackSlot, Thrown>>>> = { griffith: { special: 'spear' }, tanjiro: { heavy: 'katana' }, levi: { heavy: 'thunder' } };
const ENDER_THROWN: Partial<Record<FighterId, Partial<Record<ComboKey, Thrown>>>> = { 'sung-jinwoo': { airHeavy: 'dagger' },
  dio: { lh: 'jets' }, guts: { lh: 'quarrel' }, killua: { lh: 'yoyo' } };
const ENDER_SIZE: Partial<Record<FighterId, Partial<Record<ComboKey, number>>>> = {
  sasuke: { lllh: .55, airHeavy: .14 }, ichigo: { llls: .45 }, kakashi: { lh: .5, airHeavy: .3 }, vegeta: { llls: .2 },
};
const ENDER_VOLLEY: Partial<Record<FighterId, Partial<Record<ComboKey, number>>>> = { vegeta: { llls: 5 }, ace: { lh: 3 }, guts: { lh: 3 } };
const ENDER_TRAIL: Partial<Record<FighterId, Partial<Record<ComboKey, 'water' | 'fire'>>>> = { kakashi: { lh: 'water' }, sasuke: { lllh: 'fire' } };
const ENDER_TINT: Partial<Record<FighterId, Partial<Record<ComboKey, number>>>> = { itachi: { airHeavy: 0xff6a1a }, aizen: { lh: 0xffe27a } };
const PLAIN_ENDERS: ReadonlySet<FighterId> = new Set<FighterId>(['guts']);
const WEAPON_PARTS: Record<Thrown, readonly [THREE.BufferGeometry, number, number][]> = {
  spear: [[new THREE.CylinderGeometry(.022, .022, 2.1, 6), 0x5b4a3a, 0], [new THREE.ConeGeometry(.06, .34, 6), 0xdfe5ea, 1.2]],
  katana: [[new THREE.BoxGeometry(.034, .98, .008), 0x1d2328, .18], [new THREE.CylinderGeometry(.075, .075, .02, 10), 0x8a6a2a, -.32], [new THREE.CylinderGeometry(.018, .018, .26, 6), 0x2a2a2a, -.46]],
  thunder: [[new THREE.CylinderGeometry(.03, .03, .9, 8), 0x5e6469, 0], [new THREE.ConeGeometry(.045, .2, 8), 0x9aa1a6, .55], [new THREE.CylinderGeometry(.036, .036, .06, 8), 0xb02020, .3]],
  dagger: [[new THREE.BoxGeometry(.04, .42, .008), 0x9aa1a6, .14], [new THREE.CylinderGeometry(.016, .016, .15, 6), 0x1c1a24, -.15]],
  jets: [[new THREE.CylinderGeometry(.014, .006, 1.7, 6).translate(.07, 0, 0), 0xf4f8ff, 0], [new THREE.CylinderGeometry(.014, .006, 1.7, 6).translate(-.07, 0, 0), 0xf4f8ff, 0]],
  quarrel: [[new THREE.CylinderGeometry(.014, .014, .52, 6), 0x5b4a3a, 0], [new THREE.ConeGeometry(.032, .11, 6), 0x9aa1a6, .31], [new THREE.BoxGeometry(.06, .1, .006), 0xd8d0c0, -.22]],
  yoyo: [[new THREE.CylinderGeometry(.1, .1, .05, 18).rotateZ(Math.PI / 2), 0x9aa1a6, 0], [new THREE.CylinderGeometry(.03, .03, .07, 10).rotateZ(Math.PI / 2), 0x30343a, 0]],
};
const WEAPON_MATERIALS = new Map<number, THREE.MeshStandardMaterial>();
function thrownWeapon(kind: Thrown, origin: { x: number; y: number; z: number }, endpoint: { x: number; y: number; z: number }) {
  const weapon = new THREE.Group(); weapon.name = `thrown-${kind}`;
  for (const [geometry, colour, along] of WEAPON_PARTS[kind]) {
    let material = WEAPON_MATERIALS.get(colour);
    if (!material) { material = new THREE.MeshStandardMaterial({ color: colour, roughness: .45, metalness: colour === 0xdfe5ea || colour === 0x9aa1a6 ? .6 : .1 }); WEAPON_MATERIALS.set(colour, material); }
    const part = new THREE.Mesh(geometry, material); part.position.y = along; weapon.add(part);
  }
  const direction = new THREE.Vector3(endpoint.x - origin.x, endpoint.y - origin.y, endpoint.z - origin.z);
  if (direction.lengthSq() > 1e-6) weapon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return weapon;
}

export class CombatEffects {
  readonly kit: VfxKit;
  readonly veil = new VictimVeil();
  private motion = new MotionFx();
  private casts: CastView[] = [];
  private impacts: Impact[] = [];
  private slots: BurstSlot[] = [];
  private seen = new Set<number>();
  private narutoHeavyCasts=new Set<string>();
  private detonations = new Set<string>();
  private sphere = new THREE.SphereGeometry(1, 32, 24);
  private fistGeometry = fireFistGeometry();
  private ring = new THREE.TorusGeometry(1, .013, 4, 48);
  private windBlade = windBladeGeometry();
  private windMaterial = windBladeMaterial();
  private pressureGeometry = new THREE.RingGeometry(.001, 1, 64, 12);
  private spark = new THREE.ConeGeometry(1, 1, 3);
  private inkGeometry = new THREE.ConeGeometry(1.5, 1.08, 3);
  private crescentGeometry = new THREE.TorusGeometry(1, .16, 6, 28, CRESCENT_ARC);
  private crescentMaterial = new THREE.MeshBasicMaterial({ color: 0xff8a1a, transparent: true, opacity: .92, depthWrite: false, toneMapped: false });
  private core = energyOrbMaterial();
  private spirit = energyOrbMaterial(false, true);
  private halo = energyHaloMaterial();
  private cyan = new THREE.MeshBasicMaterial({ color: 0x36caff, transparent: true, opacity: .7, depthWrite: false, toneMapped: false });
  private violet = energyOrbMaterial(true);
  private scratch = new THREE.Object3D();
  private scratchColor = new THREE.Color();
  private tint = new THREE.Color();
  private direction = new THREE.Vector3();
  private head = new THREE.Vector3();
  private bombAt = new THREE.Vector3();
  private bombAim = new THREE.Vector3();
  private beamDir = new THREE.Vector3();
  private blow = new THREE.Vector3();
  private centre = new THREE.Vector3();
  private limb = new THREE.Vector3();
  private blade = new THREE.Vector3();
  private glows: Glow[] = [];
  private downBeams = Array.from({ length: 2 }, () => ({ from: new THREE.Vector3(), to: new THREE.Vector3(), born: -9, seed: 1 }));
  private warm?: THREE.Group;
  screen?: ScreenFx;
  private lastBlur = -10;
  localId?: string;
  settings?: { effects: number; quality: 'high' | 'medium' | 'low' };
  private lastFrame = -1e9;
  private lastChroma = -1e9;
  private lastPanel = -1e9;
  private touchSeen = 0;
  private touchSparks = new Map<string, { at: number; seq: number; index: number }[]>();

  private blast: BlastAreas;
  readonly guard: GuardFx;
  private weather: NamiWeather;
  private empress: BoaEmpress;
  private chainsaw: DenjiChainsaw;
  private berserker: BrolyBerserker;
  private rosterSignatures: RosterSignatureSet;
  private pressure: AllMightPressure;
  private explosions: BakugoExplosions;
  private cowling: DekuCowling;
  private magma: AkainuMagma;
  constructor(private scene: THREE.Scene) {
    this.kit = VfxKit.for(scene);
    this.guard = new GuardFx(scene, this.kit);
    this.weather = new NamiWeather(scene, this.kit);
    this.empress = new BoaEmpress(scene, this.kit);
    this.chainsaw = new DenjiChainsaw(scene, this.kit);
    this.berserker = new BrolyBerserker(scene, this.kit);
    this.rosterSignatures = new RosterSignatureSet(scene, this.kit);
    this.pressure = new AllMightPressure(scene, this.kit);
    this.explosions = new BakugoExplosions(scene, this.kit);
    this.cowling = new DekuCowling(scene, this.kit);
    this.magma = new AkainuMagma(scene, this.kit);
    this.blast = new BlastAreas(scene);
    for (let i = 0; i < 8; i++) this.slots.push(this.makeSlot());
    this.warmup();
  }

  get density() { return this.kit.density; }
  retainEffects(keep: ReadonlySet<string>): string[] { return this.rosterSignatures.retainEffects(keep); }
  load(ids: readonly FighterId[]) { return Promise.all([this.weather.load(ids), this.empress.load(ids), this.chainsaw.load(ids), this.magma.load(ids), this.berserker.load(ids), this.rosterSignatures.load(ids), this.cowling.load(ids), this.pressure.load(ids), this.explosions.load(ids)]).then(() => {}); }
  set density(value: number) { this.kit.density = value; }
  get quality() { return this.kit.quality; }
  set quality(value: 'high' | 'medium' | 'low') { this.kit.quality = value; }

  private makeSlot(): BurstSlot {
    const group = new THREE.Group(); group.name = 'combat-burst-idle'; group.visible = false;
    const rim = installVeil(new THREE.MeshBasicMaterial({ color: 0x08baff, transparent: true, opacity: .95, depthWrite: false, toneMapped: false }), VEIL.sparks) as THREE.MeshBasicMaterial;
    const streaks = new THREE.InstancedMesh(this.spark, rim, 22);
    streaks.name = 'impact-outward-streaks'; streaks.frustumCulled = false; streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 22; i++) streaks.setColorAt(i, WHITE);
    const inkMaterial = installVeil(new THREE.MeshBasicMaterial({ color: 0x111620, transparent: true, opacity: 1, depthWrite: false, toneMapped: false }), VEIL.sparks) as THREE.MeshBasicMaterial;
    const ink = new THREE.InstancedMesh(this.inkGeometry, inkMaterial, 22);
    ink.name = 'manga-ink-ray-contours'; ink.frustumCulled = false; ink.instanceMatrix = streaks.instanceMatrix; ink.renderOrder = 0; streaks.renderOrder = 1;
    const shellMaterial = energyImpactMaterial(false, .24, false);
    shellMaterial.fragmentShader = shellMaterial.fragmentShader.replace('uniform vec3 uTint;', 'uniform vec3 uTint;uniform vec3 uAccent;').replace('vec3(.01,.22,1.)', 'uAccent');
    shellMaterial.uniforms.uAccent = { value: new THREE.Color().setRGB(.01, .22, 1) };
    const shell = new THREE.Mesh(this.sphere, shellMaterial); shell.name = 'impact-pressure-shell';
    const pressure = new THREE.Mesh(this.pressureGeometry, pressureWaveMaterial()); pressure.name = 'impact-ground-wave'; pressure.rotation.x = -Math.PI / 2; pressure.frustumCulled = false;
    const dust = new THREE.InstancedMesh(this.sphere, groundDustMaterial(), 12); dust.name = 'impact-ground-dust'; dust.frustumCulled = false; dust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const debrisMaterial = installVeil(new THREE.MeshBasicMaterial({ color: 0x6c604b, transparent: true, opacity: 1, depthWrite: false }), VEIL.rubble) as THREE.MeshBasicMaterial;
    const debris = new THREE.InstancedMesh(this.spark, debrisMaterial, 10); debris.name = 'impact-ground-debris'; debris.frustumCulled = false; debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(shell, pressure, dust, debris, streaks, ink); this.scene.add(group);
    return { group, rim, streaks, ink, inkMaterial, shell, pressure, dust, debris, debrisMaterial, busy: false };
  }

  private takeSlot() {
    let slot = this.slots.find(s => !s.busy);
    if (!slot) {
      const oldest = this.impacts.find(i => i.slot)!;
      this.releaseSlot(oldest); this.impacts.splice(this.impacts.indexOf(oldest), 1); slot = oldest.slot!;
    }
    slot.busy = true;
    return slot;
  }
  private releaseSlot(impact: Impact) { const slot = impact.slot; if (!slot) return; slot.busy = false; slot.group.visible = false; slot.group.name = 'combat-burst-idle'; }

  warmup() {
    if (this.warm) return;
    const group = new THREE.Group(); group.name = 'combat-effects-warmup';
    const tinted = this.tintedOrb(0xff8a1a), fist = fireFistMaterial();
    const streams = new THREE.InstancedMesh(this.spark, this.cyan, 1);
    group.add(new THREE.Mesh(this.sphere, this.core), new THREE.Mesh(this.sphere, this.spirit), new THREE.Mesh(this.sphere, this.violet), new THREE.Mesh(this.sphere, this.halo),
      new THREE.Mesh(this.ring, this.cyan), new THREE.Mesh(this.crescentGeometry, this.crescentMaterial), new THREE.Mesh(this.windBlade, this.windMaterial),
      new THREE.Mesh(this.sphere, tinted), new THREE.Mesh(this.fistGeometry, fist), streams);
    group.traverse(o => { o.frustumCulled = false; });
    group.position.set(0, -500, 0); group.scale.setScalar(.001); group.visible = false;
    this.scene.add(group); this.warm = group;
  }
  hideWarmup() { if (this.warm) this.warm.visible = false; }

  private tintedOrb(tint: number) {
    const material = this.core.clone();
    material.uniforms.uTint.value.set(tint);
    material.fragmentShader = material.fragmentShader.replace('vec3(.012,.25,1.0)', 'uTint*1.5').replace('vec3(.05,.2,.7)', 'uTint*.7');
    return material;
  }

  handleAuthoredAreas(events: readonly CombatEvent[], fighters: ReadonlyMap<string, Fighter>) {
    for (const event of events) if (event.slot === 'area' && (
      event.fighter === 'rengoku' && event.kind === 'impact'
      || event.fighter === 'toji' && (event.kind === 'cast' || event.kind === 'release' || event.kind === 'impact')
    )) this.rosterSignatures.handleOwn(event, fighters);
  }

  private bodies?: ReadonlyMap<string, Fighter>;
  handle(events: CombatEvent[], fighters?: ReadonlyMap<string,Fighter>) {
    if (fighters) this.bodies = fighters;
    LANDED.deliver(events);
    for (const event of events) {
      if (this.seen.has(event.id)) continue; this.seen.add(event.id);
      this.weather.handle(event, fighters);
      this.empress.handle(event, fighters);
      this.chainsaw.handle(event, fighters);
      this.berserker.handle(event, fighters);
      this.rosterSignatures.handle(event, fighters);
      if(fighters)this.rosterSignatures.prepareContact(event,fighters,FLIGHTS);
      this.pressure.handle(event, fighters); this.explosions.handle(event, fighters);
      this.cowling.handle(event, fighters);
      this.magma.handle(event, fighters);
      if (event.kind === 'hit' && event.targetId) this.veil.struck(event.targetId, event.serverTime, DREAM_IMPACT && !!hitTier(event.slot, event.branch, event.chain));
      if (event.kind === 'cast' && event.fighter && event.slot && event.origin && event.endpoint) this.cast(event, fighters);
      if (DREAM_IMPACT && event.kind === 'cast' && event.fighter && event.slot) this.windup(event, fighters);
      if (event.kind === 'confirm' && event.fighter && event.slot === 'ultimate') this.confirmed(event, fighters);
      if (event.kind === 'land' && event.origin) {
        this.kit.groundImpact(event.origin.x, event.origin.y, event.origin.z, 0, 1, 0, 3, event.serverTime, undefined, event.origin.y);
        this.kit.pulse(event.origin.x, event.origin.y + 1.6, event.origin.z, 0xffe2b0, 8, 7, event.serverTime, .3);
        this.impacts.push({ born: event.serverTime, duration: .65, size: 1, energy: false, seed: event.id });
      }
      if (event.kind === 'release' && event.fighter === 'goku' && event.branch === 'airSpecial' && event.endpoint) {
        const beam = this.downBeams[0].born <= this.downBeams[1].born ? this.downBeams[0] : this.downBeams[1], e = event.endpoint;
        beam.to.set(e.x, e.y - .3, e.z); beam.from.set(e.x, e.y + 3.4, e.z); beam.born = event.serverTime; beam.seed = event.seed ?? event.id;
      }
      if (event.kind === 'release') {
        const released = event.fighter && event.slot ? thrown(event.fighter, event.slot, event.branch, false) as MoveDefinition & { dashThrough?: boolean } : undefined;
        if(released?.style==='beam'&&!event.branch&&BEAM_LOOKS[`${event.fighter}:${event.slot}`]&&event.origin&&event.endpoint&&!this.casts.some(c=>c.event.actorId===event.actorId&&c.event.slot===event.slot&&Math.abs(event.serverTime-c.event.serverTime-c.release)<1)){
          this.cast({...event,kind:'cast',serverTime:event.serverTime-(released.contacts[0]??0)},fighters);
        }
        if (released?.dashThrough && event.origin && event.endpoint) this.iai(event, fighters);
        for (const cast of this.casts) {
          if (cast.event.actorId === event.actorId && cast.event.slot === event.slot
            && this.releases(cast, event)) {
            cast.beamReleasedAt = event.serverTime;
          }
          if (cast.event.actorId === event.actorId && cast.event.slot === event.slot && event.endpoint && !cast.aimedDone
            && (cast.contactIndex ?? 0) === (event.contactIndex ?? 0) && released?.aimOnRelease
            && Math.abs(event.serverTime - cast.event.serverTime - cast.release) < .35) {
            (cast.aimed ??= new THREE.Vector3()).set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
          }
        }
      }
      if (event.kind === 'projectile-clash') {
        for (const cast of this.casts) if ((cast.event.actorId === event.actorId || cast.event.actorId === event.targetId) && cast.released && cast.contactAt === undefined) cast.contactAt = event.serverTime;
        const at = event.endpoint ?? event.origin;
        if (at) this.kit.hitSpark(at.x, at.y, at.z, elementFor(event.fighter, event.slot), 2, event.serverTime);
      }
      if (event.kind === 'wall-splat' && event.origin) this.wallSplat(event, fighters);
      if (event.kind === 'ground-bounce' && event.origin) {
        const o = event.origin;
        this.kit.groundImpact(o.x, o.y, o.z, 0, 1, 0, 2, event.serverTime, undefined, o.y);
      }
      if (event.kind === 'vanish') this.vanish(event, fighters);
      if (event.kind === 'chase') {
        this.motion.chase(event.actorId, event.serverTime);
        const o = event.origin, chaser = fighters?.get(event.actorId);
        if (o) {
          this.kit.ring(o.x, o.y + 1, o.z, .3, 1.8, event.serverTime, .25, 0xffffff, 0xbfe6ff, .1);
          if (!chaser || chaser.state.grounded) this.kit.dustRing(o.x, chaser ? chaser.group.position.y : o.y, o.z, 5, .2, 3, .8, event.serverTime, .5);
        }
      }
      if (event.kind === 'eliminated') this.knockout(event, fighters);
      if (event.kind === 'just-guard') this.perfectGuard(event, fighters);
      if (event.kind === 'blocked' || event.kind === 'guard-break' || event.kind === 'just-guard') this.guard.event(event, fighters);
      if ((event.kind === 'hit' || event.kind === 'blocked' || event.kind === 'guard-break') && event.endpoint) this.contact(event, fighters);
    }
    if (this.seen.size > 2048) this.seen = new Set(Array.from(this.seen).slice(-1024));
  }

  private cast(event: CombatEvent, fighters?: ReadonlyMap<string,Fighter>) {
    const fighterId = event.fighter!, slot = event.slot!;
    if(fighterId==='naruto'&&slot==='heavy'&&event.actionSeq!==undefined){
      const key=`${event.actorId}:${event.actionSeq}`;if(this.narutoHeavyCasts.has(key))return;
      this.narutoHeavyCasts.add(key);
      if(this.narutoHeavyCasts.size>256)this.narutoHeavyCasts.delete(this.narutoHeavyCasts.values().next().value!);
    }
    const actor=fighters?.get(event.actorId);
    const kurama=fighterId==='naruto'&&!!actor?.state.awakened;
    const move = thrown(fighterId,slot,event.branch,kurama,!!actor?.state.awakened);
    this.technique(event, move, actor);
    if (slot === 'ultimate' && move.style === 'bomb' && event.origin && event.endpoint) {
      const o = event.origin, e = event.endpoint, release = event.serverTime + (move.contacts[0] ?? 0);
      const travel = Math.max(.06, Math.hypot(e.x - o.x, e.y - o.y, e.z - o.z) / (move.speed ?? 20));
      this.blast.mark(event.id, event.actorId, e.x, e.y - 1.05, e.z, move.radius, event.serverTime, release, release + travel, BLAST_TINT[fighterId] ?? 0xffffff);
    }
    const domain = slot === 'ultimate' && (fighterId === 'gojo' || fighterId === 'sukuna') ? move.timeStop : undefined;
    if (domain && event.origin) {
      const o = event.origin, closes = event.serverTime + (move.contacts[domain.contact] ?? 0);
      this.blast.mark(event.id, event.actorId, o.x, o.y - 1.05, o.z, domain.radius, event.serverTime, closes, closes, fighterId === 'sukuna' ? 0xff2a3a : BLAST_TINT.gojo ?? 0xffffff);
    }
    const drawnElsewhere = fighterId === 'nami' && slot === 'ultimate' && !event.branch || fighterId === 'mihawk' && slot === 'special' && !event.branch || ['kakashi','sasuke','zoro','ichigo','jotaro'].includes(fighterId) && !event.branch || fighterId === 'luffy' && slot === 'special' && !event.branch || fighterId === 'aizen' && slot === 'ultimate' || (fighterId === 'shanks' || fighterId === 'gohan-beast') && slot === 'ultimate' || fighterId === 'golden-frieza' && slot === 'special' || fighterId === 'itachi' && slot === 'special' || fighterId === 'madara' && slot === 'special' || fighterId === 'sung-jinwoo' && slot === 'special' || fighterId === 'saitama' && slot === 'heavy' && !event.branch || move.style === 'melee' && !(fighterId === 'naruto' && slot === 'heavy' && (!event.branch || event.branch === 'lllh')) || kurama && move.style === 'melee';
    if (drawnElsewhere) { this.glow(event, move, actor); return; }
    if (event.branch && move.style === 'field') { if (!move.plunge) this.glow(event, move, actor); return; }
    if (this.casts.length >= 24) this.removeCast(this.casts.shift()!);
    const isSpirit = fighterId === 'goku' && slot === 'ultimate';
    const group = new THREE.Group(); group.name = `cast-${event.id}`;
    const flame=FLAME_THROWERS.has(fighterId);
    const gojo=fighterId==='gojo';
    const hiken=fighterId==='ace'&&slot==='special'&&!event.branch;
    const palmRasengan=fighterId==='naruto'&&slot==='heavy'&&!kurama&&(!event.branch||event.branch==='lllh');
    const SHOP_TINT:Partial<Record<FighterId,number>>={nami:0x9adeef,kaido:0xd2c2ff,whitebeard:0xe2f2ff,roger:0xffb21e,aizen:0xb48cff,sukuna:0xff4a5a,'goku-black':0xff6ad8,jiren:0xff3a2a,'golden-frieza':0xff5a1e,'gohan-beast':0xffe25a,gon:0xffc23c,meruem:0x3ae88a,akaza:0x9fdcff};
    const enderTint=event.branch?ENDER_TINT[fighterId]?.[event.branch]??enderElement(fighterId,event.branch,!!actor?.state.awakened)?.rim:undefined;
    const tint=enderTint??(fighterId==='vegeta'?(slot==='special'?0x8731dc:slot==='heavy'?0x2dbeff:0xffc82a):gojo?(slot==='special'?0x9b3dff:0x36e8ff):fighterId==='luffy'?0xff3b13:isSun(fighterId,slot)?0xffc23a:fighterId==='ace'?0xff6a12:fighterId==='guts'?0xff6a1a:SHOP_TINT[fighterId]??0xff8a1a);
    const ownedMaterial=hiken?fireFistMaterial():fighterId==='vegeta'||flame||gojo||fighterId==='guts'||SHOP_TINT[fighterId]!==undefined||enderTint!==undefined?this.tintedOrb(tint):undefined;
    const orb=new THREE.Mesh(this.sphere, ownedMaterial??(isSpirit ? this.spirit : fighterId === 'naruto' && (slot === 'ultimate'||kurama) ? this.violet : this.core));group.add(orb);
    const throwing=event.branch?ENDER_THROWN[fighterId]?.[event.branch]:THROWN[fighterId]?.[slot];
    let weapon:THREE.Object3D|undefined;
    if(throwing&&event.origin&&event.endpoint){orb.visible=false;weapon=thrownWeapon(throwing,event.origin,event.endpoint);weapon.visible=false;group.add(weapon);}
    if(hiken){
      orb.name='hiken-charge';
      const fist=new THREE.Mesh(this.fistGeometry,ownedMaterial);fist.name='hiken-fire-fist';fist.visible=false;
      fist.scale.setScalar(4.4);group.add(fist);
    }
    const rasenshuriken=fighterId==='naruto'&&!kurama&&(slot==='special'&&!event.branch||event.branch==='llls');
    if(rasenshuriken){
      orb.scale.setScalar(.6);
      const blades=new THREE.Group();blades.name='rasenshuriken-wind-blades';
      for(let i=0;i<4;i++){const blade=new THREE.Mesh(this.windBlade,this.windMaterial);blade.rotation.z=i*Math.PI/2;blades.add(blade);}
      group.add(blades);
    }
    if(fighterId==='sanji'&&!event.branch){const crescent=new THREE.Mesh(this.crescentGeometry,this.crescentMaterial);crescent.name='mouton-crescent';crescent.rotation.set(CRESCENT_ARC/2,-Math.PI/2,0);crescent.scale.setScalar(3.4); crescent.visible=false;group.add(crescent);}
    const rings = Array.from({ length: palmRasengan ? 2 : 0 }, (_, i) => {
      const mesh = new THREE.Mesh(this.ring, this.cyan); mesh.rotation.set(i * 1.05, i * .7, 0); group.add(mesh); return mesh;
    });
    let streams: THREE.InstancedMesh | undefined;
    if (isSpirit) {
      streams = new THREE.InstancedMesh(this.spark, this.cyan, 14);
      streams.instanceMatrix.setUsage(THREE.DynamicDrawUsage); streams.frustumCulled = false; group.add(streams);
    }
    const halo = new THREE.Mesh(this.sphere, this.halo); halo.name='cast-energy-halo'; halo.scale.setScalar(isSpirit ? 1.1 : 1.2); if(!ownedMaterial&&!palmRasengan)group.add(halo); this.scene.add(group);
    if(knifeThrow(event)||(isBoaEmpress(fighterId)||isDenjiChainsaw(fighterId)||isAkainuMagma(fighterId)||isBrolyBerserker(fighterId)||rosterFlight(fighterId,slot,event.branch,event.actorId)||isDekuCowling(fighterId)||isBakugoExplosions(fighterId)||isAllMightPressure(fighterId)))group.visible=false;
    const start = new THREE.Vector3(event.origin!.x, event.origin!.y, event.origin!.z), end = new THREE.Vector3(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    const palmCharges=fighterId==='vegeta'&&slot==='ultimate'?[new THREE.Mesh(this.sphere,ownedMaterial),new THREE.Mesh(this.sphere,ownedMaterial)]:undefined;for(const palm of palmCharges??[])this.scene.add(palm);
    const floor = actor ? actor.group.position.y : start.y - 1.05, surface = start.distanceTo(end) < move.range - .4 || end.y - floor < .3;
    const clocks = { nextSpark: 0, nextRing: 0, nextMuzzle: 0, nextRock: 0, nextTrail: 0, nextGather: 0, scorched: false };
    this.casts.push({weapon, event, group, rings, streams, start, end, ownedMaterial,palmCharges,kurama,ender:event.branch?move:undefined,contactIndex:0,release: move.contacts[0], duration: move.duration, travel: start.distanceTo(end) / (move.speed ?? 50), released: false, floor, surface, ...clocks });
    const volley=event.branch?ENDER_VOLLEY[fighterId]?.[event.branch]??1:1;
    if(move.style==='projectile'&&volley>1){
      this.beamDir.copy(end).sub(start).setY(0);if(this.beamDir.lengthSq()<1e-6)this.beamDir.set(0,0,1);this.beamDir.normalize();
      for(let shot=1;shot<volley;shot++){
        const copy=group.clone(),copyMaterial=ownedMaterial?.clone(),side=(shot%2?1:-1)*Math.ceil(shot/2)*.42;
        if(copyMaterial)copy.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===ownedMaterial)o.material=copyMaterial;});this.scene.add(copy);
        const at=end.clone().add(this.direction.set(-this.beamDir.z*side,(shot%3-1)*.2,this.beamDir.x*side));
        this.casts.push({event,group:copy,weapon:weapon?copy.getObjectByName(weapon.name):undefined,ownedMaterial:copyMaterial,ender:move,rings:[],start:start.clone(),end:at,contactIndex:100+shot,release:move.contacts[0]+shot*.07,duration:move.duration+shot*.07,travel:start.distanceTo(at)/(move.speed??50),released:false,floor,surface,...clocks});
      }
    }
    if(move.style==='projectile')for(let index=1;index<move.contacts.length;index++){const copy=group.clone();const copyMaterial=ownedMaterial?.clone();if(copyMaterial)copy.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===ownedMaterial)o.material=copyMaterial;});this.scene.add(copy);this.casts.push({event,group:copy,ownedMaterial:copyMaterial,ender:event.branch?move:undefined,rings:[],start:start.clone(),end:end.clone(),contactIndex:index,release:move.contacts[index],duration:move.duration,travel:start.distanceTo(end)/(move.speed??50),released:false,floor,surface,...clocks});}
  }

  private technique(event: CombatEvent, move: MoveDefinition, actor?: Fighter) {
    const slot = event.slot!, fighter = event.fighter!;
    if (slot !== 'special' && slot !== 'ultimate') return;
    const screen = this.screen;
    if (!screen || typeof screen.techniqueGrade !== 'function') return;
    const self = this.localId !== undefined ? this.bodies?.get(this.localId) : undefined;
    const mine = event.actorId === this.localId || event.targetId === this.localId;
    const near = !!self && !!actor && self.group.position.distanceTo(actor.group.position) < 14;
    const strength = (slot === 'ultimate' ? gradeStrength(fighter) : .7) * (mine ? 1 : near ? .5 : 0);
    const graded = slot === 'ultimate' && move.confirm ? Math.min(move.duration, (move.contacts[0] ?? 0) + OPENER_FEED) : move.duration;
    if (strength > 0) { const hue = gradeHue(fighter, slot, !!actor?.state.awakened, event.branch); if (slot === 'ultimate') screen.techniqueGrade(hue, strength, graded); else screen.techniqueGrade(hue, strength * .8, Math.min(move.duration, (move.contacts[0] ?? 0) + .45), actor?.group.position ?? event.origin, 2.6); }
  }

  private confirmed(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const actor = fighters?.get(event.actorId), screen = this.screen;
    if (!screen || typeof screen.techniqueGrade !== 'function' || !event.fighter) return;
    const self = this.localId !== undefined ? this.bodies?.get(this.localId) : undefined;
    const mine = event.actorId === this.localId || event.targetId === this.localId;
    const near = !!self && !!actor && self.group.position.distanceTo(actor.group.position) < 14;
    const strength = (mine ? 1 : near ? .5 : 0) * gradeStrength(event.fighter);
    if (strength <= 0) return;
    const move = moveFor(event.fighter, 'ultimate', !!actor?.state.awakened);
    screen.techniqueGrade(gradeHue(event.fighter, 'ultimate', !!actor?.state.awakened), strength, Math.max(.3, move.duration - (event.castAge ?? move.contacts[0])));
  }

  private glow(event: CombatEvent, move: MoveDefinition, actor?: Fighter) {
    if ((isBoaEmpress(event.fighter)||isDenjiChainsaw(event.fighter)||isAkainuMagma(event.fighter)||isBrolyBerserker(event.fighter)||hasRosterSignature(event.fighter,event.slot,event.branch,event.actorId)||isDekuCowling(event.fighter)||isBakugoExplosions(event.fighter)||isAllMightPressure(event.fighter))) return;
    const slot = event.slot!, fighter = event.fighter!, awakened = !!actor?.state.awakened;
    const el = elementFor(fighter, slot, awakened, 0, event.branch);
    if (event.branch && PLAIN_ENDERS.has(fighter)) return;
    if (slot === 'light' || slot === 'heavy' && (el === PHYSICAL || el.rim === 0xb8c8d8)) return;
    if (this.glows.length >= 16) this.glows.shift();
    const ultimate = slot === 'ultimate';
    this.glows.push({ actorId: event.actorId, slot, born: event.serverTime, release: Math.max(.05, move.contacts[0]), end: move.duration, colour: techniqueColour(fighter, slot, awakened, event.branch),
      peak: ultimate ? 20 : slot === 'special' ? 14 : 9, reach: ultimate ? 12 : 9 });
  }

  private updateGlow(g: Glow, time: number, fighters: Map<string, Fighter>) {
    const age = time - g.born, actor = fighters.get(g.actorId);
    if (age < -.1 || age > g.end + .3 || !actor) return false;
    if (age > .1 && actor.state.action !== g.slot && age < g.release) return false;
    if (g.slot === 'ultimate' && age > g.release && age < g.end && (actor.state.action !== 'ultimate' || actor.state.whiffedAt !== undefined)) { g.left ??= age; if (age - g.left > WHIFF_FADE) return false; }
    const rise = Math.pow(Math.min(1, Math.max(0, age / g.release)), 1.6);
    const after = age > g.release ? 1 - .55 * Math.min(1, (age - g.release) / Math.max(.1, g.end - g.release)) : 1;
    const out = age > g.end ? 1 - (age - g.end) / .3 : 1;
    const k = rise * after * out * (g.left === undefined ? 1 : 1 - (age - g.left) / WHIFF_FADE);
    if (k > .01) {
      actor.chargePosition(this.limb); const yaw = actor.state.yaw;
      this.kit.lights.request(this.limb.x + Math.sin(yaw) * 1.2, this.limb.y + .2, this.limb.z + Math.cos(yaw) * 1.2, g.colour, g.peak * (.15 + .85 * k), g.reach, 1.5 + (g.actorId === this.localId ? 1 : 0));
    }
    return true;
  }

  private contact(event: CombatEvent, fighters?: ReadonlyMap<string,Fighter>) {
    const point = new THREE.Vector3(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    for (const cast of this.casts) {
      if (cast.event.actorId !== event.actorId || cast.event.slot !== event.slot || event.serverTime < cast.event.serverTime + cast.release - .04) continue;
      const style = thrown(cast.event.fighter!, cast.event.slot!, cast.event.branch, false).style;
      const age = event.serverTime - cast.event.serverTime;
      if (age > cast.release + cast.travel + .2 && age > cast.duration) continue;
      if (style === 'beam' && (!cast.hitEnd || point.distanceToSquared(cast.start) > cast.hitEnd.distanceToSquared(cast.start))) {
        cast.hitEnd = point.clone(); cast.hitTargetId = event.targetId; cast.hitAt = event.serverTime;
      }
      if (style === 'bomb' || style === 'projectile') cast.contactAt = event.serverTime;
    }
    const source = fighters?.get(event.actorId), victim = event.targetId ? fighters?.get(event.targetId) : undefined;
    const fighterId = event.fighter ?? source?.state.fighter, slot = event.slot;
    const move = fighterId && slot ? thrown(fighterId, slot, event.branch, false) : undefined;
    const el = elementFor(fighterId, slot, !!source?.state.awakened, event.chain ?? 0, event.branch);
    const local = this.localId !== undefined && (event.actorId === this.localId || event.targetId === this.localId);
    const floor = victim ? victim.group.position.y : point.y - 1.05;
    const origin = event.origin;
    const time = event.serverTime, seed = event.seed ?? event.id;
    const cls = impactClass(event, move);
    if (event.kind === 'blocked' || event.kind === 'guard-break') {
      if (move?.style === 'bomb') this.detonate(event, point, fighterId, el, local, move.radius);
      this.impacts.push({ born: time, duration: .3, size: 1, energy: false, seed });
      return;
    }
    const finisher = slot === 'light' && (event.chain ?? 0) >= 3;
    if (local) {
      const finalContact = !move || event.contactIndex === undefined || event.contactIndex >= move.contacts.length - 1;
      if (slot === 'ultimate' && finalContact) this.frame(1, IMPACT_FRAME_HOLD);
      else if (slot === 'ultimate' && cls >= 2 && !move?.confirm) this.frame(cls >= 3 ? 1 : .7);
      else if (slot === 'special' && cls >= 2 || finisher && (event.combo ?? 0) >= LONG_STRING) this.moment(.7);
      if (cls >= 3) this.chroma(1);
    }
    const melee = move ? move.style === 'melee' : slot !== 'special';
    const thrownSteel = fighterId === 'dio' && slot === 'heavy' && (!event.branch || ENDER_THROWN.dio?.[event.branch] !== undefined);
    const rasengan = fighterId === 'naruto' && slot === 'heavy' && !source?.state.awakened && !event.branch;
    const bomb = slot === 'ultimate' && move?.style === 'bomb';
    if (!bomb) this.contactPoint(event, source, victim, melee && !rasengan || thrownSteel, point);
    if (rasengan) source?.chargePosition(point);
    const from = source && melee ? this.limb.copy(source.group.position).setY(point.y) : origin ? this.limb.set(origin.x, origin.y, origin.z) : undefined;
    const dir = from ? this.blow.subVectors(point, from) : undefined;
    if (dir) { if (dir.lengthSq() > 1e-6) dir.normalize(); else dir.set(0, 0, 1); }
    const anchor = this.kit.anchorTo(victim, time, .5);
    const big = event.kind === 'hit' && (bigBlowOf(event, !!source?.state.awakened) || cinematicBlowOf(event, !!source?.state.awakened));
    if (big && local && victim && time - this.lastBlur > .3) { this.lastBlur = time; this.screen?.impactBlur?.(slot === 'ultimate' ? 1 : .85, point, source ? [source, victim] : [victim]); }
    if (slot === 'ultimate' && move) {
      if (bomb) { this.detonate(event, point, fighterId, el, local, move.radius); return; }
      const key = `${event.actorId}:${event.serverTime.toFixed(5)}`;
      if (this.detonations.has(key)) return;
      this.detonations.add(key); if (this.detonations.size > 64) this.detonations.delete(this.detonations.values().next().value!);
      if (move.style === 'melee') { if (!this.claimTouchSpark(event)) this.melee(point, el, cls, time, dir, victim, floor, local, seed, anchor, !!source?.armed, hitTier(slot, event.branch, event.chain)); }
      else this.energy(point, time, seed, el, Math.max(cls, 2) as ImpactClass, local, victim, floor, anchor, dir);
      return;
    }
    if (finisher && fighterId && event.kind === 'hit') this.finisherAccent(fighterId, point, dir, victim, floor, time, local, el, !!source?.state.awakened);
    if (DREAM_IMPACT && local && event.kind === 'hit' && cls === 2 && (melee && !rasengan || thrownSteel)) this.screen?.techniqueGrade?.(0xff4a22, .4, .1, point, 5);
    if (DREAM_IMPACT && event.kind === 'hit' && melee && victim && victim.state.grounded && Number.isFinite(floor)) {
      const at = victim.group.position, dx = dir?.x ?? 0, dz = dir?.z ?? 0, h = Math.hypot(dx, dz) || 1;
      if (cls >= 1) this.kit.ring(at.x, floor + .04, at.z, .15, .55 + cls * .2, time, .22 + cls * .03, DUST_LIT, DUST_SHADE, .12, 'flat');
      if (h > 1e-3 && (dx || dz)) this.kit.dustSpray(at.x, floor, at.z, dx / h, dz / h, cls >= 2 ? 4 : 2, 2.2 + cls * .5, .28 + cls * .06, time, .38, 1.2);
    }
    if (DREAM_IMPACT && local && event.kind === 'hit' && cls >= 3 && (melee && !rasengan || thrownSteel)) {
      this.screen?.techniqueGrade?.(0xff4a22, .75, .16, point, 7);
    }
    if (melee && !rasengan || thrownSteel) {
      if (!(melee && !rasengan && this.claimTouchSpark(event))) this.melee(point, el, thrownSteel ? Math.min(cls, 1) as ImpactClass : cls, time, dir, victim, floor, local, seed, anchor, !!source?.armed && !thrownSteel, hitTier(slot, event.branch, event.chain));
      return;
    }
    this.energy(point, time, seed, el, Math.max(cls, 1) as ImpactClass, local, victim, floor, anchor, dir);
    if (fighterId === 'kakashi' && slot === 'special' && !event.branch && victim && event.kind === 'hit') this.shock(victim, time, el);
  }
  private shock(victim: Fighter, time: number, el: Element) {
    const c = bodyCentre(victim, this.head), kit = this.kit;
    for (let pulse = 0; pulse < 3; pulse++) for (let i = 0; i < 2; i++) {
      this.centre.set(c.x + (Math.random() - .5) * .45, c.y - .75, c.z + (Math.random() - .5) * .45);
      this.direction.set(c.x + (Math.random() - .5) * .45, c.y + .85, c.z + (Math.random() - .5) * .45);
      kit.crackle(this.centre, this.direction, .18, el, kit.n(9, 3), time + pulse * .14 + i * .03);
    }
    kit.pulse(c.x, c.y + .3, c.z, el.light, 10, 6, time, .5, 1.5);
  }

  private contactPoint(event: CombatEvent, source: Fighter | undefined, victim: Fighter | undefined, melee: boolean, out: THREE.Vector3) {
    const e = event.endpoint!;
    if(event.fighter==='netero'&&event.slot==='ultimate'&&!event.branch&&(event.contactIndex??0)>0){
      if(source?.meleeContactPoint(event.contactIndex!,out))return out;
      return out.set(e.x,e.y,e.z);
    }
    if (!victim) {
      out.set(e.x, e.y, e.z);
      const o = event.origin;
      if (melee && o) { this.limb.set(e.x - o.x, 0, e.z - o.z); if (this.limb.lengthSq() > 1e-6) out.addScaledVector(this.limb.normalize(), -.3); }
      return out;
    }
    const centre = bodyCentre(victim, this.centre), feet = victim.group.position;
    const lowY = centre.y - .75, highY = centre.y + .75;
    let best = Infinity;
    const consider = (p: THREE.Vector3) => {
      const y = Math.min(highY, Math.max(lowY, p.y)), d = Math.hypot(p.x - centre.x, p.y - y, p.z - centre.z);
      if (d < best) { best = d; out.copy(p); }
    };
    if (melee && source) {
      if (source.meleeContactPoint(event.contactIndex ?? 0, this.limb)) consider(this.limb);
      else {
        consider(source.handR); consider(source.handL);
        const right = source.joints.get('RightFoot'), left = source.joints.get('LeftFoot');
        if (right) consider(right.getWorldPosition(this.limb));
        if (left) consider(left.getWorldPosition(this.limb));
        if (source.armed) {
          source.strikePoint(this.blade);
          this.limb.subVectors(this.blade, source.handR); const length = this.limb.lengthSq();
          const t = length > 1e-6 ? Math.min(1, Math.max(0, ((centre.x - source.handR.x) * this.limb.x + (centre.y - source.handR.y) * this.limb.y + (centre.z - source.handR.z) * this.limb.z) / length)) : 1;
          consider(this.limb.multiplyScalar(t).add(source.handR));
        }
      }
    }
    const ax = source && melee ? source.group.position.x : event.origin?.x ?? feet.x, az = source && melee ? source.group.position.z : event.origin?.z ?? feet.z;
    let nx = ax - centre.x, nz = az - centre.z; const flat = Math.hypot(nx, nz);
    if (flat > 1e-3) { nx /= flat; nz /= flat; } else { nx = Math.sin(victim.state.yaw); nz = Math.cos(victim.state.yaw); }
    if (best > .9) {
      const height = e.y - (feet.y + 1.05);
      out.set(centre.x + nx * .3, Math.min(highY - .2, Math.max(lowY + .3, centre.y + .1 + height)), centre.z + nz * .3);
      return out;
    }
    const y = Math.min(highY, Math.max(lowY, out.y)), dx = out.x - centre.x, dz = out.z - centre.z, radial = Math.hypot(dx, dz);
    if (radial < .24) { out.x = centre.x + nx * .24; out.z = centre.z + nz * .24; }
    out.y = Math.min(highY, Math.max(lowY + .1, y));
    return out;
  }

  private melee(point: THREE.Vector3, el: Element, cls: ImpactClass, time: number, dir: THREE.Vector3 | undefined, victim: Fighter | undefined, floor: number, local: boolean, seed: number, anchor = 0, blade = false, tier?: HitTier) {
    if (DREAM_IMPACT && victim) { const c = bodyCentre(victim, this.head), d = point.distanceTo(c); if (d > .8) point.sub(c).multiplyScalar(.45 / d).add(c); }
    this.kit.hitSpark(point.x, point.y, point.z, el, cls, time, dir, local ? 2 : 1, anchor, blade ? 'slash' : 'burst', tier);
    if (tier && cls >= 2) this.kit.trail(victim, time, blade);
    const feet = victim?.group.position, low = !victim || victim.state.grounded;
    if (cls >= 1 && low && point.y - floor < 1.9) {
      const x = feet?.x ?? point.x, z = feet?.z ?? point.z;
      let dx = dir?.x ?? 0, dz = dir?.z ?? 1; const flat = Math.hypot(dx, dz) || 1; dx /= flat; dz /= flat;
      this.blade.set(dx, 0, dz);
      if (cls >= 2) this.kit.groundImpact(x + dx * .3, floor, z + dz * .3, 0, 1, 0, cls, time, el, floor, this.blade);
      else {
        this.kit.dustSpray(x + dx * .2, floor, z + dz * .2, dx, dz, 3, 2, .3, time, .38);
        this.kit.ring(x, floor + .05, z, .3, 1.8, time, .26, 0xffffff, el.rim, .12, 'flat');
        this.kit.debris.burst(this.kit.n(3, 1), x, floor, z, 0, 1, 0, 4, .8, .07, floor, 1.2);
      }
    }
    this.impacts.push({ born: time, duration: .2 + cls * .03, size: .5 + cls * .1, energy: false, seed });
  }

  private energy(point: THREE.Vector3, time: number, seed: number, el: Element, cls: ImpactClass, local: boolean, victim?: Fighter, floor = point.y - 1.05, anchor = 0, dir?: THREE.Vector3) {
    const slot = this.takeSlot(), radius = cls >= 3 ? .36 : cls >= 2 ? .3 : .25;
    slot.group.name = 'combat-energy-burst'; slot.group.visible = true; slot.group.position.copy(point); slot.group.quaternion.identity();
    const shell = slot.shell, u = shell.material.uniforms;
    u.uSeed.value = seed % 1000; u.uUltimate.value = 0; u.uDuration.value = .24; u.uFloor.value = -1000; u.uAge.value = 0;
    u.uTint.value.setHex(el.rim); (u.uAccent.value as THREE.Color).setHex(el.rim).multiplyScalar(.6);
    shell.visible = true; shell.scale.setScalar(radius);
    slot.pressure.visible = slot.dust.visible = slot.debris.visible = false;
    slot.rim.color.setHex(el.rim); slot.rim.opacity = .95;
    const count = Math.max(5, Math.floor(10 * Math.min(1, this.kit.budget)));
    slot.streaks.count = slot.ink.count = count; slot.streaks.visible = slot.ink.visible = true;
    for (let i = 0; i < count; i++) slot.streaks.setColorAt(i, WHITE);
    if (slot.streaks.instanceColor) slot.streaks.instanceColor.needsUpdate = true;
    this.kit.hitSpark(point.x, point.y, point.z, el, cls, time, dir, local ? 2 : 1, anchor, 'blast');
    if (DREAM_IMPACT && cls >= 2) this.kit.explosion(point.x, point.y, point.z, el, cls >= 3 ? 1.5 : 1.1, time, cls >= 3 ? 12 : 8);
    if (victim?.state.grounded && cls >= 2 && point.y - floor < 1.9) this.kit.groundImpact(victim.group.position.x, floor, victim.group.position.z, 0, 1, 0, cls, time, el, floor);
    const follow = victim, offset = follow ? new THREE.Vector3().subVectors(point, bodyCentre(follow, this.centre)) : undefined;
    this.impacts.push({ born: time, duration: .3, size: radius, energy: true, seed, slot, follow, offset });
  }

  private detonate(event: CombatEvent, point: THREE.Vector3, fighterId: FighterId | undefined, el: Element, local: boolean, radius: number) {
    const key = `${event.actorId}:${event.serverTime.toFixed(5)}`;
    const center = event.origin ? new THREE.Vector3(event.origin.x, event.origin.y, event.origin.z) : point;
    const violet = fighterId === 'naruto';
    if (!this.detonations.has(key)) {
      this.detonations.add(key);
      if (this.detonations.size > 64) this.detonations.delete(this.detonations.values().next().value!);
      if (!armoryDraws(fighterId, event.slot, event.branch, event.actorId)) this.ultimateBurst(center, event.serverTime, event.seed ?? event.id, el, violet, fighterId === 'luffy' || fighterId === 'ace', local, radius);
    }
    if (event.kind === 'hit' && point.distanceToSquared(center) > 2.25) this.energy(point, event.serverTime, event.seed ?? event.id, el, 2, local);
  }

  private ultimateBurst(center: THREE.Vector3, time: number, seed: number, el: Element, violet: boolean, haki: boolean, local: boolean, blast: number) {
    let busy = 0; for (const i of this.impacts) if (i.ultimate) busy++;
    if (busy >= 4) { const oldest = this.impacts.find(i => i.ultimate)!; this.releaseSlot(oldest); this.impacts.splice(this.impacts.indexOf(oldest), 1); }
    const slot = this.takeSlot(), radius = blast;
    slot.group.name = 'combat-ultimate-burst'; slot.group.visible = true; slot.group.position.copy(center); slot.group.quaternion.identity();
    slot.group.position.y += radius - 1.05 + .03;
    const u = slot.shell.material.uniforms;
    u.uSeed.value = seed % 1000; u.uUltimate.value = 1; u.uDuration.value = .3; u.uAge.value = 0;
    u.uTint.value.setHex(haki ? 0xff4a1e : violet ? 0x8543e8 : 0x0062d9); (u.uAccent.value as THREE.Color).setRGB(.01, .22, 1);
    slot.shell.visible = true; slot.shell.scale.setScalar(radius);
    const wave = slot.pressure.material.uniforms;
    wave.uTint.value.setHex(haki ? 0xfa6d32 : violet ? 0x8846ee : 0x069ecc); wave.uSeed.value = seed % 1000; wave.uDust.value = 1.35; wave.uEnergy.value = 1; wave.uReach.value = 7.8;
    slot.pressure.position.set(0, -radius + .015, 0); slot.pressure.visible = false;
    slot.dust.material.uniforms.uSeed.value = seed % 1000; slot.dust.visible = false; slot.debris.visible = true;
    slot.rim.color.set(0xffffff); slot.rim.opacity = 1;
    const count = Math.max(5, Math.floor(22 * Math.min(1, this.kit.budget)));
    slot.streaks.count = slot.ink.count = count; slot.streaks.visible = slot.ink.visible = true;
    for (let i = 0; i < count; i++) slot.streaks.setColorAt(i, this.scratchColor.set(i % 3 === 0 ? (violet ? 0x8e55ff : haki ? 0xff5a2a : 0x159bff) : haki ? 0xffd9b0 : 0xc3f6ff));
    if (slot.streaks.instanceColor) slot.streaks.instanceColor.needsUpdate = true;
    const floor = center.y - 1.05;
    this.kit.hitSpark(center.x, center.y + .6, center.z, el, 3, time, undefined, local ? 3 : 2);
    if (DREAM_IMPACT) this.kit.explosion(center.x, floor + radius * .45, center.z, el, Math.min(4, radius * .7), time, 16);
    this.kit.groundImpact(center.x, floor, center.z, 0, 1, 0, 3, time, el, floor);
    this.kit.scorch(center.x, floor, center.z, 0, 1, 0, radius * 1.05, time, el.light);
    this.kit.ring(center.x, floor + .08, center.z, 1, radius / .86, time, .6, 0xffffff, el.rim, .14, 'flat');
    for (let i = 0, n = this.kit.n(10, 4); i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * .4, c = Math.cos(a), s = Math.sin(a), v = 2.5 + Math.random() * 2;
      const out = radius * .6;
      this.kit.smoke(center.x + c * out, floor + .5, center.z + s * out, c * v, .8 + Math.random(), s * v, (violet ? 1.9 : 1.3) + Math.random() * .5, time + Math.random() * .05, .55);
    }
    this.kit.pulse(center.x, center.y + 2.2, center.z, el.light, 30, 14, time, .9, 3);
    if (local) { this.frame(1); this.chroma(1); }
    this.impacts.push({ born: time, duration: 1.25, size: radius, energy: true, seed, slot, ultimate: true });
  }

  private wallSplat(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const o = event.origin!, body = fighters?.get(event.actorId);
    let nx = 1, nz = 0;
    if (body) {
      const v = (body.velocity as THREE.Vector3 | undefined) ?? this.direction.set(0, 0, 0), s = Math.hypot(v.x, v.z);
      if (s > .5) { nx = -v.x / s; nz = -v.z / s; } else { nx = Math.sin(body.state.yaw); nz = Math.cos(body.state.yaw); }
    }
    const x = o.x - nx * .45, y = o.y + 1.05, z = o.z - nz * .45, time = event.serverTime;
    this.kit.hitSpark(x, y, z, PHYSICAL, 1, time, this.blow.set(nx, .2, nz).normalize());
    this.kit.groundImpact(x, y, z, nx, 0, nz, 2, time, undefined, o.y);
    this.kit.pulse(x + nx * 1.3, y + .3, z + nz * 1.3, 0xffe2b0, 6, 7, time, .3);
  }

  private iai(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const o = event.origin!, e = event.endpoint!, time = event.serverTime, kit = this.kit, sp = kit.sparks.spec;
    const dx = e.x - o.x, dy = e.y - o.y, dz = e.z - o.z, length = Math.hypot(dx, dy, dz);
    if (length < .5) return;
    const ux = dx / length, uy = dy / length, uz = dz / length, el = elementFor(event.fighter, event.slot, false, 0, event.branch);
    const body = fighters?.get(event.actorId);
    if (body) {
      for (let i = 1, n = kit.n(3, 2); i <= n; i++) {
        const back = length * i / (n + 1);
        kit.ghosts.spawn(body, el.light, time + i * .012, .18 + .04 * (n - i), .75 - i * .12, this.head.set(-ux * back, 0, -uz * back));
      }
    }
    const y = Math.min(o.y, e.y) + .15;
    sp.reset(SPRITE.streak, time, .3).pos(e.x, y, e.z).velocity(ux * .01, uy * .01, uz * .01);
    sp.orient = ORIENT.velocity; sp.sized(.05, .03, .5); sp.stretch = length / .05; sp.hot(0xffffff, 2).cool(el.rim, .6); kit.sparks.emit();
    sp.reset(SPRITE.glow, time, .26).pos((o.x + e.x) * .5, y, (o.z + e.z) * .5).sized(.22, .3, .3).hot(el.rim, 1.2);
    sp.orient = ORIENT.axial; sp.axis(ux, uy, uz); sp.stretch = length * .5 / .3; kit.sparks.emit();
    for (let i = 0, n = kit.n(8, 3); i < n; i++) {
      const t = Math.random() * length;
      sp.reset(SPRITE.streak, time, .14 + Math.random() * .1).pos(o.x + ux * t, y + (Math.random() - .5) * .9, o.z + uz * t).velocity(ux * 16, 0, uz * 16);
      sp.orient = ORIENT.velocity; sp.sized(.018, .01, .5); sp.stretch = 3; sp.trail = .05; sp.drag = 6; sp.hot(0xffffff, 1.4).cool(el.rim, 0); kit.sparks.emit();
    }
    if (!body || body.state.grounded) kit.dustSpray(o.x, body ? body.group.position.y : o.y - 1.05, o.z, -ux, -uz, 4, 3, .45, time, .4, .9);
    kit.pulse(e.x - ux * length * .5, y + 1, e.z - uz * length * .5, el.light, 6, 7, time, .25, 1.5);
    if (this.localId !== undefined && event.actorId === this.localId) this.screen?.speedLines(1);
  }

  private vanish(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const body = fighters?.get(event.actorId), time = event.serverTime;
    const tint = body ? ghostTint(body.state.fighter, !!body.state.awakened) : 0xbfe6ff;
    if (body && event.origin) {
      const offset = this.head.set(event.origin.x - body.group.position.x, 0, event.origin.z - body.group.position.z);
      this.kit.ghosts.spawn(body, tint, time, .3, .9, offset);
    }
    const at = event.endpoint ?? body?.group.position;
    if (at) {
      const y = at.y + 1.05, sp = this.kit.sparks.spec;
      sp.reset(SPRITE.core, time, .1).pos(at.x, y, at.z).sized(.5, 1.1, .3).hot(0xffffff, 1.8).cool(tint); this.kit.sparks.emit();
      sp.reset(SPRITE.flare, time, .18).pos(at.x, y, at.z).sized(.9, 1.8, .2).hot(0xffffff, 1.1).cool(tint); this.kit.sparks.emit();
      this.kit.ring(at.x, y, at.z, .3, 2.2, time, .28, 0xffffff, tint, .1);
      this.kit.streaks(at.x, y, at.z, { spike: 0xffffff, rim: tint, light: tint, ink: 0 }, this.kit.n(10, 4), 9, .02, time);
      this.kit.pulse(at.x, y, at.z, tint, 2.5, 6, time, .25);
    }
    if (event.origin) this.kit.dustRing(event.origin.x, event.origin.y, event.origin.z, 5, .2, 2.5, .8, time, .5);
    if (this.localId !== undefined && (event.actorId === this.localId || event.targetId === this.localId)) this.moment(.75);
  }

  private perfectGuard(event: CombatEvent, _fighters?: ReadonlyMap<string, Fighter>) {
    if (this.localId !== undefined && (event.actorId === this.localId || event.targetId === this.localId)) this.frame(.85, IMPACT_FRAME_HOLD * .5);
    for (const cast of this.casts) if (cast.event.actorId === event.actorId && cast.event.slot === event.slot && cast.released && cast.contactAt === undefined) cast.contactAt = event.serverTime;
  }

  private knockout(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const victim = event.targetId ? fighters?.get(event.targetId) : undefined, killer = fighters?.get(event.actorId);
    if (!victim) return;
    const p = victim.group.position, time = event.serverTime;
    const el = killer ? elementFor(killer.state.fighter, 'ultimate', !!killer.state.awakened) : PHYSICAL;
    const local = this.localId !== undefined && (event.actorId === this.localId || event.targetId === this.localId);
    const self = this.localId !== undefined ? fighters?.get(this.localId) : undefined;
    const near = !!self && self.group.position.distanceTo(p) < 16;
    const c = bodyCentre(victim, this.centre), anchor = this.kit.anchorTo(victim, time, .6);
    if (!local && !near) { this.kit.hitSpark(c.x, c.y + .2, c.z, el, 2, time, undefined, 1, anchor); return; }
    this.kit.hitSpark(c.x, c.y + .2, c.z, el, 3, time, undefined, 3, anchor);
    const sp = this.kit.sparks.spec;
    sp.reset(SPRITE.ring, time + .05, .45).pos(c.x, c.y + .2, c.z).sized(.8, 5, .6).hot(0xffffff, 1.3).cool(el.rim, .1); sp.anchor = anchor; this.kit.sparks.emit();
    this.kit.groundImpact(p.x, p.y, p.z, 0, 1, 0, 3, time, el, p.y);
    this.kit.pulse(c.x, c.y + 1.4, c.z, 0xffffff, 14, 12, time, .7, 3);
    if (local) { this.frame(1, IMPACT_FRAME_HOLD); this.chroma(1); }
  }

  private frame(strength: number, hold = 0) {
    const now = performance.now() / 1000;
    if (now - this.lastFrame < .4) { if (hold > 0) this.screen?.extendImpact?.(hold); return; }
    this.lastFrame = this.lastPanel = now; this.screen?.impactFrame(Math.min(1, strength * Math.max(.5, this.kit.density)), undefined, hold);
  }
  private moment(strength: number) {
    if (performance.now() / 1000 - this.lastPanel < PANEL_REST) return;
    this.frame(strength);
  }
  private chroma(amount: number) {
    const now = performance.now() / 1000;
    if (now - this.lastChroma < .12) return;
    this.lastChroma = now; this.screen?.chromaticPulse(Math.min(1, amount * Math.max(.5, this.kit.density)));
  }

  private windups: { actorId: string; born: number; contact: number; el: Element; next: number }[] = [];
  private windup(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const slot = event.slot!, fighterId = event.fighter!, actor = fighters?.get(event.actorId);
    if (!actor) return;
    const move = slot === 'light' && (event.chain ?? 0) > 0 ? rushMove(fighterId, event.chain!, !!actor.state.awakened) : thrown(fighterId, slot, event.branch, false, !!actor.state.awakened);
    const big = !!event.branch || slot === 'heavy' || slot === 'light' && (event.chain ?? 0) >= 3;
    if (!big || move.style !== 'melee' || !(move.contacts[0] > .14)) return;
    if (this.windups.length > 8) this.windups.shift();
    this.windups.push({ actorId: event.actorId, born: event.serverTime, contact: event.serverTime + move.contacts[0], el: elementFor(fighterId, slot, !!actor.state.awakened, event.chain ?? 0, event.branch), next: 0 });
  }
  private drawWindups(time: number, fighters: Map<string, Fighter>) {
    let kept = 0;
    for (const w of this.windups) {
      const body = fighters.get(w.actorId);
      if (!body || time > w.contact) continue;
      this.windups[kept++] = w;
      if (time < w.next || time < w.born) continue;
      w.next = time + 1 / 30;
      const k = THREE.MathUtils.clamp((time - w.born) / Math.max(.05, w.contact - w.born), 0, 1), sp = this.kit.sparks.spec;
      const p = body.strikePoint(this.limb);
      sp.reset(SPRITE.core, time, .07).pos(p.x, p.y, p.z).sized(.08 + .14 * k, .1 + .18 * k, .3).hot(w.el.spike, 1.2 + k).cool(w.el.rim); sp.bias = .2; this.kit.sparks.emit();
      for (let i = 0; i < 2; i++) {
        this.direction.set(Math.random() - .5, Math.random() * .8 - .2, Math.random() - .5).normalize();
        const r = .7 + Math.random() * .5, v = r / .12;
        sp.reset(SPRITE.streak, time, .12).pos(p.x + this.direction.x * r, p.y + this.direction.y * r, p.z + this.direction.z * r).velocity(-this.direction.x * v, -this.direction.y * v, -this.direction.z * v);
        sp.orient = ORIENT.velocity; sp.sized(.02, .012, .5); sp.stretch = 3; sp.trail = .03; sp.bias = .15; sp.hot(w.el.spike, 1.3).cool(w.el.rim, 0); this.kit.sparks.emit();
      }
    }
    this.windups.length = kept;
  }

  private trailSeen = new Map<string, { x: number; y: number; z: number; at: number; next: number }>();
  private launchTrails(time: number, fighters: Map<string, Fighter>) {
    if (!DREAM_IMPACT) return;
    if (this.trailSeen.size > 40) for (const id of this.trailSeen.keys()) if (!fighters.has(id)) this.trailSeen.delete(id);
    for (const [id, body] of fighters) {
      const c = bodyCentre(body, this.head), was = this.trailSeen.get(id);
      if (!was) { this.trailSeen.set(id, { x: c.x, y: c.y, z: c.z, at: time, next: 0 }); continue; }
      const gap = time - was.at;
      if (gap <= 1e-4) continue;
      const vx = (c.x - was.x) / gap, vy = (c.y - was.y) / gap, vz = (c.z - was.z) / gap;
      was.x = c.x; was.y = c.y; was.z = c.z; was.at = time;
      const a = body.state.action, flung = a === 'launched' || a === 'knockdown' || a === 'splat' || (a === 'hurt' || a === 'flinch') && !body.state.grounded;
      const driven = !flung && (a === 'dash' || a === 'light' || a === 'heavy' || a === 'jump');
      const speed = Math.hypot(vx, vy, vz);
      if (!(flung && speed >= 5.5 || driven && speed >= 8.5) || speed > 60 || time < was.next) continue;
      was.next = time + (flung ? 1 / 40 : 1 / 28);
      const ux = vx / speed, uy = vy / speed, uz = vz / speed, sp = this.kit.sparks.spec;
      this.direction.set(Math.random() - .5, Math.random() - .5, Math.random() - .5);
      this.direction.addScaledVector(this.limb.set(ux, uy, uz), -this.direction.dot(this.limb)).normalize().multiplyScalar(.15 + Math.random() * .4);
      const len = Math.min(3.2, .6 + speed * .13), half = len * .5, back = .3 + Math.random() * .5, w = .016 + Math.random() * .012;
      sp.reset(SPRITE.bolt, time, .14 + Math.random() * .08).pos(c.x + this.direction.x - ux * (back + half), c.y + this.direction.y - uy * (back + half), c.z + this.direction.z - uz * (back + half));
      sp.orient = ORIENT.axial; sp.axis(ux, uy, uz); sp.sized(w, w, 1); sp.stretch = half / w;
      if (flung) sp.hot(0x1b2440, .3).cool(0x0b1022, .82); else sp.hot(0xeaf4ff, .3).cool(0xeaf4ff, .5);
      this.kit.sparks.emit();
    }
  }

  private markTouches(time: number, fighters: Map<string, Fighter>) {
    for (const mark of Fighter.touchLog) {
      if (mark.serial <= this.touchSeen) continue;
      this.touchSeen = mark.serial;
      if (mark.guarded) continue;
      const victim = fighters.get(mark.victim), source = fighters.get(mark.attacker);
      if (!victim) continue;
      const awakened = !!source?.state.awakened;
      const ss = source?.state, branch = ss && ss.action === mark.slot && (mark.seq === undefined || ss.actionSeq === undefined || ss.actionSeq === mark.seq) ? ss.branch : undefined;
      const move = mark.slot === 'light' && mark.chain > 0 ? rushMove(mark.fighter, mark.chain, awakened) : thrown(mark.fighter, mark.slot, branch, awakened, awakened);
      const cls = impactClass({ id: 0, kind: 'hit', serverTime: time, actorId: mark.attacker, slot: mark.slot, chain: mark.chain, damage: mark.damage, branch }, move);
      const el = elementFor(mark.fighter, mark.slot, awakened, mark.chain, branch);
      const local = this.localId !== undefined && (mark.attacker === this.localId || mark.victim === this.localId);
      this.veil.struck(mark.victim, time, DREAM_IMPACT && !!hitTier(mark.slot, branch, mark.chain));
      const point = this.centre.set(mark.x, mark.y, mark.z), dir = this.blow.set(mark.hx, 0, mark.hz);
      this.melee(point, el, cls, time, dir, victim, victim.group.position.y, local, mark.serial * 7919, this.kit.anchorTo(victim, time, .5), !!source?.armed, hitTier(mark.slot, branch, mark.chain));
      const key = `${mark.attacker}>${mark.victim}`, pending = this.touchSparks.get(key), spark = { at: time, seq: mark.seq ?? -1, index: mark.index ?? -1 };
      if (pending) { pending.push(spark); if (pending.length > 8) pending.shift(); } else this.touchSparks.set(key, [spark]);
      if (this.touchSparks.size > 64) this.touchSparks.delete(this.touchSparks.keys().next().value!);
    }
  }
  private claimTouchSpark(event: CombatEvent) {
    const pending = this.touchSparks.get(`${event.actorId}>${event.targetId}`);
    if (!pending) return false;
    while (pending.length && event.serverTime - pending[0].at > TOUCH_KEPT) pending.shift();
    let k = 0;
    if (event.actionSeq !== undefined) {
      const index = event.contactIndex ?? 0;
      while (k < pending.length && !(pending[k].seq === event.actionSeq && pending[k].index === index)) k++;
    } else {
      while (k < pending.length && event.serverTime - pending[k].at > TOUCH_SPARK) k++;
      if (k < pending.length && pending[k].at - event.serverTime > .1) return false;
    }
    if (k >= pending.length) return false;
    pending.splice(k, 1);
    return true;
  }
  private finisherAccent(fighter: FighterId, point: THREE.Vector3, dir: THREE.Vector3 | undefined, victim: Fighter | undefined, floor: number, time: number, local: boolean, el: Element, awakened = false) {
    const accent = (awakened ? FORM_FINISHERS[fighter] : undefined) ?? FINISHERS[fighter], kit = this.kit, sp = kit.sparks.spec;
    let hx = dir?.x ?? 0, hz = dir?.z ?? 1; const flat = Math.hypot(hx, hz) || 1; hx /= flat; hz /= flat;
    const anchor = kit.anchorTo(victim, time, .45);
    const c = victim ? bodyCentre(victim, this.head) : this.head.copy(point);
    const up = this.limb.set(0, 1, 0), along = this.blade.set(hx, 0, hz);
    switch (accent.shape) {
      case 'shockwave':
        kit.ring(point.x, point.y, point.z, .2, 2.6, time, .32, 0xffffff, el.rim, .12, 'plane', hx, 0, hz);
        kit.ring(point.x, point.y, point.z, .3, 1.8, time + .04, .26, el.spike, el.rim, .1);
        kit.streaks(point.x, point.y, point.z, el, kit.n(14, 5), 16, .03, time, along, 1.6, 2, 0, anchor);
        break;
      case 'hammer':
        kit.groundImpact(c.x, floor, c.z, 0, 1, 0, 3, time, el, floor);
        kit.ring(c.x, floor + .06, c.z, .3, 3.4, time, .4, 0xffffff, el.rim, .16, 'flat');
        kit.streaks(point.x, point.y, point.z, el, kit.n(10, 4), 11, .026, time, up.set(0, -1, 0), 1.3, 9, 0, anchor);
        break;
      case 'smoke':
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + .4, cs = Math.cos(a), sn = Math.sin(a);
          kit.smoke(c.x + cs * .7, c.y + (i % 2 ? .3 : -.2), c.z + sn * .7, cs * 1.5, .8, sn * 1.5, .9, time + i * .03, .45);
        }
        kit.ring(c.x, c.y, c.z, .3, 2.2, time, .3, 0xffffff, el.rim, .12);
        break;
      case 'bolt':
        for (let i = 0; i < 3; i++) {
          this.centre.set(c.x + (Math.random() - .5) * .5, c.y - .7, c.z + (Math.random() - .5) * .5);
          this.direction.set(c.x + (Math.random() - .5) * .5, c.y + .9, c.z + (Math.random() - .5) * .5);
          kit.crackle(this.centre, this.direction, .2, el, kit.n(8, 3), time + i * .02);
        }
        sp.reset(SPRITE.flare, time, .16).pos(point.x, point.y, point.z).sized(.6, 1.6, .2).hot(0xffffff, 1.6).cool(el.rim); sp.anchor = anchor; kit.sparks.emit();
        break;
      case 'spiral':
        for (let i = 0; i < 3; i++) kit.ring(point.x + hx * i * .35, point.y, point.z + hz * i * .35, .15, .9 + i * .35, time + i * .035, .22, 0xffffff, el.rim, .1, 'plane', hx, 0, hz);
        kit.streaks(point.x, point.y, point.z, el, kit.n(10, 4), 13, .026, time, along, 1.4, 3, 0, anchor);
        break;
      case 'tornado':
        for (let i = 0; i < 4; i++) kit.ring(c.x, floor + .3 + i * .45, c.z, .4, 1.4 + i * .25, time + i * .04, .3, 0xffffff, el.rim, .08, 'flat');
        kit.streaks(c.x, floor + .4, c.z, el, kit.n(12, 5), 9, .024, time, up, 1.5, -2, 0, anchor);
        break;
      case 'rising':
        for (let i = 0, n = kit.n(6, 3); i < n; i++) kit.smoke(c.x + (Math.random() - .5) * .4, floor + .2 + i * .25, c.z + (Math.random() - .5) * .4, 0, 4 + i, 0, .6 + i * .05, time + i * .02, .4, 0xffb347, 0xd9481e);
        kit.streaks(c.x, floor + .3, c.z, el, kit.n(12, 5), 12, .028, time, up, 1.8, -4, 0, anchor);
        break;
      case 'flurry':
        for (let i = 0, n = kit.n(6, 3); i < n; i++) kit.hitSpark(point.x + (Math.random() - .5) * .6, point.y + (Math.random() - .5) * .6, point.z + (Math.random() - .5) * .6, el, 0, time + i * .025, along, 1, anchor);
        break;
      case 'crescent':
        sp.reset(SPRITE.ring, time, .3).pos(c.x, c.y, c.z).sized(.5, 2.1, .6).hot(0xffffff, 1.3).cool(el.rim, .12); sp.orient = ORIENT.plane; sp.axis(hx, 0, hz); sp.anchor = anchor; kit.sparks.emit();
        kit.smoke(c.x - hx * .3, c.y, c.z - hz * .3, hx * 2, .5, hz * 2, 1.2, time, .45, 0x3a0b12, 0x120306);
        break;
      case 'cross':
        for (const tilt of [1, -1]) for (const side of [1, -1]) kit.streaks(point.x, point.y, point.z, el, kit.n(6, 2), 13, .03, time, this.direction.set(-hz * tilt * side, side, hx * tilt * side).normalize(), 2.2, 0, 0, anchor);
        kit.pulse(point.x, point.y, point.z, el.light, 16, 8, time, .3, 2);
        break;
      case 'room':
        kit.ring(c.x, floor + .05, c.z, .5, 2.6, time, .45, 0xffffff, el.rim, .2, 'flat');
        kit.streaks(c.x, floor + .2, c.z, el, kit.n(10, 4), 10, .02, time, up, 2, -1, 0, anchor);
        break;
      case 'red':
        sp.reset(SPRITE.core, time, .12).pos(point.x, point.y, point.z).sized(.4, 1, .3).hot(0xffffff, 2.2).cool(el.rim); sp.anchor = anchor; kit.sparks.emit();
        kit.ring(point.x, point.y, point.z, .2, 2.8, time, .3, el.spike, el.rim, .08);
        kit.pulse(point.x, point.y, point.z, el.light, 24, 10, time, .35, 2);
        break;
      case 'crater':
        kit.groundImpact(c.x, floor, c.z, 0, 1, 0, 3, time, el, floor);
        kit.debris.burst(kit.n(10, 4), c.x, floor, c.z, 0, 1, 0, 8, .9, .15, floor, 2.2);
        kit.ring(c.x, floor + .06, c.z, .5, 4.2, time, .45, 0xffffff, el.rim, .2, 'flat');
        break;
    }
    if (!local || !this.screen) return;
    if (accent.screen === 'speed') this.screen.speedLines(1);
    else if (accent.screen === 'fringe') this.chroma(1);
    else this.screen.techniqueGrade?.(el.light, .35, .25, point, 2.5);
  }

  footstep(step: { x: number; y: number; z: number; speed: number }, time: number) { this.motion.footstep(this.kit, step.x, step.y, step.z, step.speed, time); }

  private removeCast(cast: CastView) { FLIGHTS.delete(flightKey(cast)); cast.group.removeFromParent();cast.ownedMaterial?.dispose(); cast.streams?.dispose(); for(const palm of cast.palmCharges??[])palm.removeFromParent(); }

  private followBomb(c: CastView, move: MoveDefinition, actor: Fighter | undefined, fighters: Map<string, Fighter>, age: number, dt: number, fired: boolean) {
    if (!fired && !c.aimedDone) c.foe = actor?.state.target ?? undefined;
    const foe = c.foe ? fighters.get(c.foe) : undefined;
    if (foe?.state.alive) {
      const at = this.bombAt.copy(foe.group.position);
      if (foe.state.grounded) c.foeFloor = at.y;
      at.y = (foe.state.grounded ? at.y : c.foeFloor ?? c.floor) + 1.05 * (foe.state.size ?? 1);
      const moving = foe.velocity as THREE.Vector3 | undefined, vx = moving?.x ?? 0, vz = moving?.z ?? 0, speed = move.speed ?? 20;
      if (!fired && !c.aimedDone) {
        if (actor && actor.group.position.distanceTo(foe.group.position) <= move.range + 2) {
          const aim = this.bombAim;
          bombLead(c.start, at, vx, vz, speed, aim);
          inRange(aim, actor.group.position, move.range);
          c.end.lerp(aim, 1 - Math.exp(-dt * 14));
          c.travel = c.start.distanceTo(c.end) / speed;
        }
      } else {
        const from = c.aimed ?? (c.homeFrom ??= c.end.clone()), left = c.release + c.travel - age;
        if (left > BOMB_COMMIT) {
          homeStep(c.end, homeWant(at, vx, vz, left, this.bombAim), BOMB_HOME, dt, from);
          inRange(c.end, c.start, move.range);
        }
      }
    }
    this.blast.move(c.event.id, c.end.x, c.end.y - 1.05, c.end.z, c.event.serverTime + c.release + c.travel);
  }

  private miss(c: CastView, move: MoveDefinition, time: number) {
    if ((isBoaEmpress(c.event.fighter)||isDenjiChainsaw(c.event.fighter)||isAkainuMagma(c.event.fighter)||isBrolyBerserker(c.event.fighter)||rosterFlight(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId)||isDekuCowling(c.event.fighter)||isBakugoExplosions(c.event.fighter)||isAllMightPressure(c.event.fighter))) return;
    const fighterId = c.event.fighter!, slot = c.event.slot!, el = elementFor(fighterId, slot, false, 0, c.event.branch);
    if (knifeThrow(c.event)) { this.kit.streaks(c.end.x, c.end.y, c.end.z, el, this.kit.n(6, 3), 5, .015, time); this.kit.ring(c.end.x, c.end.y, c.end.z, .1, .6, time, .15, 0xffffff, el.rim, 0); return; }
    if (move.style === 'bomb') {
      this.ultimateBurst(this.head.copy(c.end), time, c.event.seed ?? c.event.id, el, fighterId === 'naruto', fighterId === 'luffy' || fighterId === 'ace', this.localId === c.event.actorId, move.radius);
      return;
    }
    const cls: ImpactClass = move.damage >= 115 ? 2 : move.damage >= 50 ? 1 : 0;
    const floorHit = c.end.y - c.floor < .45;
    this.kit.hitSpark(c.end.x, c.end.y, c.end.z, el, c.surface ? cls : Math.max(0, cls - 1) as ImpactClass, time);
    if (c.surface) {
      let nx = 0, ny = 1, nz = 0;
      if (!floorHit) { this.beamDir.copy(c.end).sub(c.start).setY(0); if (this.beamDir.lengthSq() < 1e-6) this.beamDir.set(0, 0, 1); this.beamDir.normalize(); nx = -this.beamDir.x; ny = 0; nz = -this.beamDir.z; }
      this.kit.groundImpact(c.end.x, floorHit ? c.floor : c.end.y, c.end.z, nx, ny, nz, Math.max(1, cls) as ImpactClass, time, el, c.floor);
      if (cls >= 1 && !FLIGHT_DRESSED.has(fighterId)) this.kit.scorch(c.end.x, floorHit ? c.floor : c.end.y, c.end.z, nx, ny, nz, 1.2 + cls * .5, time, el.light);
    }
  }

  update(time: number, dt: number, fighters: Map<string, Fighter>) {
    LANDED.clock = time;
    Fighter.settleContacts();
    if (this.settings) { this.kit.density = this.settings.effects; this.kit.quality = this.settings.quality; }
    this.markTouches(time, fighters);
    this.launchTrails(time, fighters);
    if (DREAM_IMPACT) this.drawWindups(time, fighters);
    this.guard.update(time, dt, fighters);
    this.blast.update(time, fighters);
    this.holdVerdictGrades(fighters);
    this.core.uniforms.uTime.value = time; this.spirit.uniforms.uTime.value = time; this.violet.uniforms.uTime.value = time;
    const kit = this.kit;
    kit.beams.begin(time);
    for (const beam of this.downBeams) {
      const age = time - beam.born;
      if (age < 0 || age > .42) continue;
      const look = BEAM_LOOKS['goku:special'];
      kit.beams.draw(beam.from, beam.to, age / .42, beam.seed, .55, look.shell, look.edge, 1);
      kit.lights.request(beam.to.x, beam.to.y + 1, beam.to.z, look.light, 22 * (1 - age / .42), 10, 2.5);
    }
    let kept = 0;
    for (let index = 0; index < this.casts.length; index++) {
      const c = this.casts[index];
      if (this.updateCast(c, time, dt, fighters)) this.casts[kept++] = c;
    }
    this.casts.length = kept;
    kept = 0;
    for (let index = 0; index < this.impacts.length; index++) {
      const impact = this.impacts[index];
      if (this.updateImpact(impact, time)) this.impacts[kept++] = impact;
      else this.releaseSlot(impact);
    }
    this.impacts.length = kept;
    kept = 0;
    for (let index = 0; index < this.glows.length; index++) { const g = this.glows[index]; if (this.updateGlow(g, time, fighters)) this.glows[kept++] = g; }
    this.glows.length = kept;
    this.weather.update(time, fighters, FLIGHTS);
    this.empress.update(time, fighters, FLIGHTS);
    this.chainsaw.update(time, fighters);
    this.berserker.update(time, fighters, FLIGHTS);
    this.rosterSignatures.update(time, fighters, FLIGHTS);
    this.pressure.update(time, fighters, FLIGHTS); this.explosions.update(time, fighters, FLIGHTS);
    this.cowling.update(time, fighters, FLIGHTS);
    this.magma.update(time, fighters, FLIGHTS);
    this.motion.update(time, fighters, kit, this.localId, this.screen);
    this.veil.update(time, dt, fighters);
    kit.track(fighters);
    kit.update(time, dt);
    if ((++this.frames & 63) === 0) kit.ghosts.retain(fighters);
  }
  private frames = 0;

  private holdVerdictGrades(fighters: Map<string, Fighter>) {
    const screen = this.screen;
    if (!screen || typeof screen.techniqueGrade !== 'function') return;
    const self = this.localId !== undefined ? fighters.get(this.localId) : undefined;
    for (const [id, fighter] of fighters) {
      const s = fighter.state;
      if (!s.alive || !undecided(s)) continue;
      const move = MOVES[s.fighter].ultimate;
      if (!move.confirm || s.actionTime * s.actionDuration < move.contacts[0] - .05) continue;
      const mine = id === this.localId || s.target === this.localId;
      const strength = (mine ? 1 : self && self.group.position.distanceTo(fighter.group.position) < 14 ? .5 : 0) * gradeStrength(s.fighter);
      if (strength > 0) screen.techniqueGrade(gradeHue(s.fighter, 'ultimate', !!s.awakened), strength, OPENER_FEED);
    }
  }

  private updateCast(c: CastView, time: number, dt: number, fighters: Map<string, Fighter>) {
    const kit = this.kit;
    if(c.ownedMaterial)c.ownedMaterial.uniforms.uTime.value=time;
    const actor = fighters.get(c.event.actorId),move = c.ender ?? thrown(c.event.fighter!,c.event.slot!,c.event.branch,!!c.kurama,!!actor?.state.awakened);
    const rasengan=c.event.fighter==='naruto'&&c.event.slot==='heavy'&&!c.kurama&&(!c.event.branch||c.event.branch==='lllh');
    const poseAge=rasengan&&actor?.state.action==='heavy'?actor.state.actionTime*actor.state.actionDuration:time-c.event.serverTime;
    const age=rasengan?Math.max(c.presentedAge??-Infinity,poseAge):poseAge;
    if(rasengan)c.presentedAge=age;
    const fired = move.style === 'beam' ? c.beamReleasedAt !== undefined && time >= c.beamReleasedAt : age >= c.release;
    if (c.weapon) c.weapon.visible = age >= c.release - .12;
    const projectile = move.style === 'projectile' || move.style === 'bomb';
    const isSpirit = c.event.fighter === 'goku' && c.event.slot === 'ultimate';
    const life = rasengan ? Math.min(c.duration,c.release+.38) : projectile ? c.release + c.travel + .08 : c.duration;
    const attached=move.style==='beam'||move.style==='melee';
    const interrupted = (attached || !c.released) && !(move.style==='beam'&&c.beamReleasedAt!==undefined&&!actor) && chargeWasCancelled(c.event, attached ? c.duration : c.release, actor?.state, time);
    if (age > life || age < -.1 || c.contactAt !== undefined && time >= c.contactAt || interrupted) {
      if (projectile && c.released && c.contactAt === undefined && !interrupted && age > life) this.miss(c, move, c.event.serverTime + c.release + c.travel);
      this.removeCast(c); return false;
    }
    if (actor && (!fired || attached || !c.released)) {
      actor.chargePosition(c.start);
      if(c.event.fighter==='vegeta'&&c.event.slot==='light'&&c.contactIndex===1)c.start.copy(actor.handL);
      if(c.event.fighter==='sanji')actor.meleeContactPoint(0,c.start);
      if (c.event.slot === 'ultimate'&&move.style==='bomb') {
        if(c.event.fighter==='naruto'){
          const size=(c.kurama?BIJUDAMA.kurama:BIJUDAMA.held)*(.14+.86*Math.pow(THREE.MathUtils.clamp(age/c.release,0,1),.8));
          if(!c.kurama)c.start.addScaledVector(UP,size+.1);
          else c.start.addScaledVector(BIJU_FORWARD.set(Math.sin(actor.state.yaw),.15,Math.cos(actor.state.yaw)),size*.7);
        }else if(c.event.fighter==='golden-frieza'){
          c.start.copy(actor.handL).addScaledVector(UP,DEATH_BALL*(.14+.86*Math.pow(THREE.MathUtils.clamp(age/c.release,0,1),.8))+.12);
        }else c.start.copy(actor.group.position).addScaledVector(UP, isSpirit ? SPIRIT_HEIGHT : isSun(c.event.fighter,c.event.slot) ? SUN_HEIGHT : 2.8);
      }
    }
    c.group.position.copy(c.start);
    const charge = THREE.MathUtils.clamp(age / c.release, 0, 1);
    if(c.palmCharges&&actor){const gathering=age<c.release&&actor.handR.distanceTo(actor.handL)>.24;for(let i=0;i<2;i++){const palm=c.palmCharges[i];palm.visible=gathering;palm.position.copy(i?actor.handL:actor.handR);palm.scale.setScalar(.035+Math.min(1,age/1.4)*.065);}c.group.visible=!gathering;}
    let radius = c.event.slot === 'ultimate' ? (isSpirit ? SPIRIT_RADIUS : 2) * (.14 + .86 * Math.pow(charge, .8)) : .1 + charge * .23;
    if(c.event.fighter==='naruto'){
      if(c.event.slot==='heavy'&&!c.event.branch)radius=(.035+THREE.MathUtils.smoothstep(age,.06,.48)*.18)*(1-THREE.MathUtils.smoothstep(age,c.release+.10,c.release+.38));
      if(c.event.branch==='lllh'&&rasengan)radius=bigBall(age,c.release);
      if(c.event.slot==='ultimate')radius=(c.kurama?BIJUDAMA.kurama:BIJUDAMA.held)*(.14+.86*Math.pow(charge,.8));
    }
    if(c.event.fighter==='vegeta')radius=c.event.slot==='light'?.08+charge*.06:c.event.slot==='heavy'?.07+charge*.18:c.event.slot==='ultimate'?.05+charge*.11:.045+charge*.095;
    if(c.event.fighter==='goku'&&c.event.slot==='special'&&(!c.event.branch||c.event.branch==='airSpecial'))radius=KAMEHAMEHA_BALL*(.3+.7*Math.pow(charge,.8));
    if(c.event.fighter==='goku-black'&&c.event.slot==='special'&&!c.event.branch)radius=KAMEHAMEHA_BALL*(.3+.7*Math.pow(charge,.8));
    if(c.event.fighter==='golden-frieza'&&c.event.slot==='ultimate')radius=DEATH_BALL*(.14+.86*Math.pow(charge,.8));
    if(c.event.fighter==='gohan-beast'&&c.event.slot==='ultimate')radius=.04+charge*.08;
    const flame=FLAME_THROWERS.has(c.event.fighter!),sun=isSun(c.event.fighter,c.event.slot);
    if(sun)radius=SUN_RADIUS*(.12+.88*Math.pow(charge,.7));
    else if(flame)radius=.05+charge*.1;
    if(c.event.fighter==='guts'&&c.event.slot==='heavy'&&!c.event.branch)radius=.001;
    const el = elementFor(c.event.fighter, c.event.slot, !!actor?.state.awakened, 0, c.event.branch);
    if (c.aimed && !c.aimedDone && projectile) {
      c.aimedDone = true;
      if (fired && c.released) { c.start.lerp(c.end, Math.min(1, (age - c.release) / Math.max(.01, c.travel))); c.release = age; }
      c.end.copy(c.aimed); c.travel = c.start.distanceTo(c.end) / (move.speed ?? 50);
      c.group.position.copy(c.start);
    }
    if (move.style === 'bomb' && move.aimOnRelease) this.followBomb(c, move, actor, fighters, age, dt, fired);
    if (fired && projectile) {
      if (!c.released && isSpirit) this.releaseFlash(c.start, c.event.serverTime + c.release);
      const p = Math.min(1, (age - c.release) / Math.max(.01, c.travel));
      radius = c.event.slot === 'ultimate' ? isSpirit ? SPIRIT_RADIUS : 2 : .65;
      if(c.event.fighter==='naruto'&&c.event.slot==='special'&&!c.event.branch)radius=c.kurama?.5:.38;
      if(c.event.branch&&c.ender){radius=ENDER_SIZE[c.event.fighter!]?.[c.event.branch]??(c.event.fighter==='naruto'&&c.event.branch==='llls'?.26:.4);}
      if(c.event.fighter==='naruto'&&c.event.slot==='ultimate')radius=c.kurama?BIJUDAMA.kurama*.9:BIJUDAMA.held;
      if(c.event.fighter==='vegeta')radius=c.event.slot==='light'?.15:.55;
      if(c.event.fighter==='jiren'&&c.event.slot==='special')radius=.9;
      if(c.event.fighter==='golden-frieza'&&c.event.slot==='ultimate')radius=DEATH_BALL;
      if(sun)radius=SUN_RADIUS;
      else if(flame)radius=c.event.fighter==='luffy'?.34:.26;
      if(c.event.fighter==='guts'&&!c.event.branch)radius=c.event.slot==='heavy'?.001:.3;
      const visualEnd=this.direction.copy(c.end);
      if(move.style==='bomb')visualEnd.y=c.end.y-1.05+radius+.03;
      c.group.position.lerp(visualEnd,p);
      if (time >= c.nextTrail && !knifeThrow(c.event) && !(isBoaEmpress(c.event.fighter)||isDenjiChainsaw(c.event.fighter)||isAkainuMagma(c.event.fighter)||isBrolyBerserker(c.event.fighter)||rosterFlight(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId)||isDekuCowling(c.event.fighter)||isBakugoExplosions(c.event.fighter)||isAllMightPressure(c.event.fighter))) {
        c.nextTrail = time + (move.style === 'bomb' ? .05 : .028);
        const sp = kit.sparks.spec, pos = c.group.position;
        if (!FLIGHT_DRESSED.has(c.event.fighter!)) {
          sp.reset(SPRITE.glow, time, .26).at(pos).sized(radius * 1.6, radius * .6, .8).hot(el.rim, .9); kit.sparks.emit();
          sp.reset(SPRITE.streak, time, .22).pos(pos.x + (Math.random() - .5) * radius, pos.y + (Math.random() - .5) * radius, pos.z + (Math.random() - .5) * radius).velocity((Math.random() - .5) * 2, (Math.random() - .5) * 2 + .5, (Math.random() - .5) * 2);
          sp.orient = ORIENT.velocity; sp.sized(.03, .015, .5); sp.stretch = 2; sp.trail = .08; sp.drag = 2; sp.hot(el.spike, 1.4).cool(el.rim, 0); kit.sparks.emit();
        } else if (move.style !== 'bomb' && !(c.event.fighter === 'ace' && c.event.slot === 'heavy' && !c.event.branch)) kit.puff(pos.x, pos.y, pos.z, (Math.random() - .5) * .5, .6, (Math.random() - .5) * .5, radius * 1.4, time, .45, .35);
        const wake = c.event.branch ? ENDER_TRAIL[c.event.fighter!]?.[c.event.branch] : undefined;
        if (wake === 'water') kit.smoke(pos.x, pos.y, pos.z, (Math.random() - .5) * 1.2, .4 + Math.random() * .6, (Math.random() - .5) * 1.2, radius * 1.3, time, .4, 0xeaf8ff, 0x5aa8e8);
        else if (wake === 'fire') kit.smoke(pos.x, pos.y, pos.z, (Math.random() - .5) * .8, .8, (Math.random() - .5) * .8, radius * 1.5, time, .35, 0xffb347, 0xd9481e);
      }
      const clear = Math.min(1, c.group.position.distanceTo(c.start) / 1.5);
      if (!(isBoaEmpress(c.event.fighter)||isDenjiChainsaw(c.event.fighter)||isAkainuMagma(c.event.fighter)||isBrolyBerserker(c.event.fighter)||rosterFlight(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId)||isDekuCowling(c.event.fighter)||isBakugoExplosions(c.event.fighter)||isAllMightPressure(c.event.fighter))) kit.lights.request(c.group.position.x, c.group.position.y, c.group.position.z, el.light, (c.event.slot === 'ultimate' ? 30 : c.event.slot === 'special' ? 12 : 7) * clear, c.event.slot === 'ultimate' ? 14 : 8, c.event.slot === 'ultimate' ? 2.5 : 1.5);
    }
    const chargeHalo=c.group.getObjectByName('cast-energy-halo');
    if(chargeHalo)chargeHalo.visible=!(fired&&(projectile||move.style==='beam'));
    if((FLIGHT_DRESSED.has(c.event.fighter!)||hasRosterSignature(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId)||knifeThrow(c.event))&&projectile){
      const key=flightKey(c);let flight=FLIGHTS.get(key);
      if(!flight){flight={fighter:c.event.fighter!,slot:c.event.slot!,branch:c.event.branch,actorId:c.event.actorId,position:new THREE.Vector3(),heading:new THREE.Vector3(),origin:new THREE.Vector3(),released:false,since:c.event.serverTime+c.release,awakened:!!actor?.state.awakened};FLIGHTS.set(key,flight);}
      if(!flight.released)flight.origin?.copy(c.start);
      flight.position.copy(c.group.position);flight.heading.copy(c.end).sub(c.start).setY(0);if(flight.heading.lengthSq()<1e-6)flight.heading.set(0,0,1);flight.heading.normalize();flight.released=fired;
      const crescent=c.group.getObjectByName('mouton-crescent');
      if(crescent){crescent.visible=fired;c.group.quaternion.setFromUnitVectors(FORWARD,flight.heading);}
      const fireFist=c.group.getObjectByName('hiken-fire-fist');
      if(fireFist){
        fireFist.visible=fired;c.group.getObjectByName('hiken-charge')!.visible=!fired;
        c.group.quaternion.setFromUnitVectors(FORWARD,flight.heading);
      }
    }
    if (!fired && (move.style === 'beam' || c.event.slot === 'ultimate') && age > 0 && time >= c.nextGather && !knifeThrow(c.event) && !(isBoaEmpress(c.event.fighter)||isDenjiChainsaw(c.event.fighter)||isAkainuMagma(c.event.fighter)||isBrolyBerserker(c.event.fighter)||rosterFlight(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId)||isDekuCowling(c.event.fighter)||isBakugoExplosions(c.event.fighter)||isAllMightPressure(c.event.fighter))) {
      c.nextGather = time + .05;
      const sp = kit.sparks.spec, reach = c.event.slot === 'ultimate' ? 3.2 : 1.6, span = .22;
      for (let i = 0; i < kit.n(2, 1); i++) {
        this.head.set(Math.random() - .5, Math.random() - .3, Math.random() - .5).normalize();
        sp.reset(SPRITE.streak, time, span).pos(c.start.x + this.head.x * reach, c.start.y + this.head.y * reach, c.start.z + this.head.z * reach);
        sp.velocity(-this.head.x * reach / span, -this.head.y * reach / span, -this.head.z * reach / span); sp.orient = ORIENT.velocity;
        sp.sized(.025, .01, .8); sp.stretch = 2; sp.trail = .05; sp.hot(el.spike, 1.3).cool(el.rim, 0); kit.sparks.emit();
      }
    }
    if (fired && move.style === 'beam') {
      radius = .075;
      const victim=c.hitTargetId?fighters.get(c.hitTargetId):undefined;
      if(c.hitEnd&&victim&&victim.group.parent){
        bodyCentre(victim,this.centre).addScaledVector(UP,.2);
        const along=this.beamDir.copy(c.end).sub(c.start),span=along.length();
        if(span>.01){along.divideScalar(span);const d=this.head.copy(this.centre).sub(c.start),t=d.dot(along);d.addScaledVector(along,-t);const off=d.length();
          if(t>.5&&t<span+1&&off<move.radius*1.15)c.hitEnd.copy(c.start).addScaledVector(along,t).addScaledVector(d,off>1e-4?Math.min(1,move.radius*.7/off):0);
          else{c.hitEnd=undefined;c.hitTargetId=undefined;}}
      }
      this.drawBeam(c, move, age, time, el, actor);
    } else if (!fired && move.style !== 'melee' && !knifeThrow(c.event) && !(isBoaEmpress(c.event.fighter)||isDenjiChainsaw(c.event.fighter)||isAkainuMagma(c.event.fighter)||isBrolyBerserker(c.event.fighter)||rosterFlight(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId)||isDekuCowling(c.event.fighter)||isBakugoExplosions(c.event.fighter)||isAllMightPressure(c.event.fighter))) {
      const strength = Math.pow(Math.min(1, Math.max(0, age / c.release)), 1.4);
      const glow = techniqueColour(c.event.fighter!, c.event.slot!, !!actor?.state.awakened, c.event.branch);
      const high = move.style === 'bomb', at = this.chargeLight(c, high);
      kit.lights.request(at.x, at.y, at.z, glow, (high ? 50 : c.event.slot === 'ultimate' ? 18 : c.event.slot === 'special' ? 13 : 7) * (.1 + .9 * strength), high ? 16 : c.event.slot === 'ultimate' ? 12 : 9, c.event.slot === 'ultimate' ? 2.5 : 2);
    } else if (rasengan && age < c.release + .38) { const at = this.chargeLight(c, false); kit.lights.request(at.x, at.y, at.z, 0x5fd4ff, 8, 6, 2); }
    if (move.style === 'melee' && age > c.release) c.group.visible = radius>.005;
    c.group.scale.setScalar(radius * (1 + .012 * Math.sin(time * 43)));
    const wind=c.group.getObjectByName('rasenshuriken-wind-blades');
    if(wind){
      this.windMaterial.uniforms.uTime.value=time;
      this.direction.copy(c.end).sub(c.start).setY(0).normalize();
      if(this.direction.lengthSq()>.001)c.group.quaternion.setFromUnitVectors(FORWARD,this.direction);
      c.group.rotateX(-Math.PI*.34*(1-THREE.MathUtils.smoothstep(age-c.release,-.22,.10)));
      wind.rotation.z=time*38;
    }
    for (let i = 0; i < c.rings.length; i++) {
      const ring = c.rings[i];
      ring.visible=!(fired&&move.style==='bomb');
      ring.rotation.x += dt * (3 + i); ring.rotation.z -= dt * (5 + i); ring.scale.setScalar(1.06 + i * .1);
      if (c.event.slot === 'special' && c.event.fighter === 'naruto' && fired) ring.scale.set(3.2, 3.2, .5);
    }
    if (c.streams) {
      c.streams.visible = !fired; c.streams.count = Math.max(5, Math.floor(14 * Math.min(1, kit.budget)));
      for (let i = 0; i < c.streams.count; i++) {
        const angle = i * 2.399963 + (c.event.seed ?? 0) * .00001;
        this.direction.set(Math.cos(angle), .2 + Math.sin(i * 2.17) * .8, Math.sin(angle)).normalize();
        const phase = (age * (.8 + i % 3 * .13) + i * .37) % 1;
        this.scratch.position.copy(this.direction).multiplyScalar(1.02 + (1 - phase) * 1.35);
        this.scratch.quaternion.setFromUnitVectors(UP, this.direction.negate());
        this.scratch.scale.set(.011, .2 + phase * .27, .011); this.scratch.updateMatrix();
        c.streams.setMatrixAt(i, this.scratch.matrix);
      }
      c.streams.instanceMatrix.needsUpdate = true;
    }
    c.released ||= fired; return true;
  }

  private releases(cast: CastView, event: CombatEvent) {
    const late = event.serverTime - cast.event.serverTime - cast.release, RELEASE_LATE = 1;
    if (Math.abs(late) < .06) return true;
    if (late <= 0 || late > RELEASE_LATE || cast.beamReleasedAt !== undefined
      || thrown(cast.event.fighter!, cast.event.slot!, cast.event.branch, !!cast.kurama).style !== 'beam') return false;
    cast.release += late; cast.duration += late;
    return true;
  }

  private chargeLight(c: CastView, high: boolean) {
    const at = this.head.copy(c.group.position);
    if (high) return at;
    this.beamDir.copy(c.end).sub(c.start).setY(0);
    if (this.beamDir.lengthSq() < 1e-6) return at.setY(at.y + 1);
    this.beamDir.normalize();
    return at.addScaledVector(this.beamDir, .8).setY(at.y + .6);
  }

  private releaseFlash(at: THREE.Vector3, time: number) {
    const sp = this.kit.sparks.spec;
    sp.reset(SPRITE.flare, time, .25).at(at).sized(2, 4, .3).hot(0xffffff, 1.4).cool(0x6fd8ff); this.kit.sparks.emit();
    this.kit.ring(at.x, at.y, at.z, 1.5, 4.5, time, .35, 0xffffff, 0x2d9bff, .1);
    this.impacts.push({ born: time, duration: .23, size: .65, energy: true, seed: 1 });
  }

  private drawBeam(c: CastView, move: MoveDefinition, age: number, time: number, el: Element, actor?: Fighter) {
    if(c.event.fighter==='usopp'&&rosterFlight(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId))return;
    const key = c.event.branch ? `${c.event.fighter}:${c.event.branch}` : `${c.event.fighter}:${c.event.slot}`, kit = this.kit, look = BEAM_LOOKS[key] ?? (BEAM_LOOKS[key] = { shell: el.rim, edge: el.ink, light: el.light, spike: el.spike, scale: .85 });
    const end = c.hitEnd ?? c.end, life = (age - c.release) / Math.max(.01, c.duration - c.release);
    const hitting = !!c.hitEnd, contact = hitting || c.surface;
    const radius = move.radius * look.scale;
    if (!kit.beams.draw(c.start, end, life, c.event.seed ?? 1, radius, look.shell, look.edge, contact ? 1 : .35)) return;
    const fade = life < .8 ? 1 : Math.max(0, 1 - (life - .8) / .2);
    const reach = kit.beams.reach(life), dir = this.beamDir.copy(end).sub(c.start), span = dir.length();
    if (span < .01) return;
    dir.divideScalar(span);
    const head = this.head.copy(c.start).addScaledVector(dir, span * reach), sp = kit.sparks.spec;
    const ultimate = c.event.slot === 'ultimate', mine = c.event.actorId === this.localId ? 1 : 0, lit = (look.lit ?? 1) * fade;
    const near = Math.min(1.6, span * reach * .5);
    kit.lights.request(c.start.x + dir.x * near, c.start.y + dir.y * near + .2, c.start.z + dir.z * near, look.light, (ultimate ? 26 : 20) * lit, 10, 3 + mine);
    kit.lights.request(c.start.x + dir.x * span * reach * .5, c.start.y + dir.y * span * reach * .5 + .3, c.start.z + dir.z * span * reach * .5, look.light, (ultimate ? 24 : 18) * lit, 10, 2.5 + mine);
    if (time >= c.nextMuzzle) {
      c.nextMuzzle = time + .07;
      sp.reset(SPRITE.core, time, .1).at(c.start).sized(radius * .8, radius * 1.1, .3).hot(0xffffff, 2.4 * fade).cool(look.shell); kit.sparks.emit();
      sp.reset(SPRITE.flare, time, .12).at(c.start).sized(radius * 1.2, radius * 1.9, .3).hot(0xffffff, .9 * fade).cool(look.shell); sp.rotation = Math.random() * .6; kit.sparks.emit();
      if (fade > .3) {
        sp.reset(SPRITE.ring, time, Math.min(.32, span / 34)).pos(c.start.x + dir.x * 1.2, c.start.y + dir.y * 1.2, c.start.z + dir.z * 1.2).velocity(dir.x * 34, dir.y * 34, dir.z * 34);
        sp.orient = ORIENT.plane; sp.axis(dir.x, dir.y, dir.z); sp.sized(radius * 1.1, radius * 1.4, .8).hot(0xffffff, 1.3).cool(look.shell, .05); kit.sparks.emit();
        const bloom = BEAM_ELEMENTS[key] ?? (BEAM_ELEMENTS[key] = { spike: look.spike, rim: look.shell, light: look.light, ink: look.edge });
        kit.crackle(c.start, head, radius * 1.02, bloom, kit.n(5, 2), time);
      }
    }
    if (reach < .97) return;
    kit.lights.request(head.x - dir.x * 1.1, head.y - dir.y * 1.1 + .3, head.z - dir.z * 1.1, look.light, (contact ? 26 : 12) * lit, contact ? 12 : 9, 3 + mine);
    if (!contact || fade < .15) return;
    const bloom = BEAM_ELEMENTS[key] ?? (BEAM_ELEMENTS[key] = { spike: look.spike, rim: look.shell, light: look.light, ink: look.edge });
    if (time >= c.nextSpark) {
      c.nextSpark = time + .09;
      sp.reset(SPRITE.star, time, .18).at(head).sized(radius * .9, radius * 2.4, .25).hot(look.spike, 1.3).cool(look.shell, .45); sp.rotation = Math.random() * 6.28; sp.bias = radius * .8; kit.sparks.emit();
      sp.reset(SPRITE.core, time, .08).at(head).sized(radius * .9, radius * 1.4, .3).hot(0xffffff, 2.2).cool(look.shell); sp.bias = radius; kit.sparks.emit();
      kit.streaks(head.x, head.y, head.z, bloom, kit.n(7, 2), 13, .035, time, this.blow.copy(dir).negate(), .45);
      if (DREAM_IMPACT) kit.explosion(head.x - dir.x * radius, head.y - dir.y * radius, head.z - dir.z * radius, bloom, radius * (ultimate ? 2.2 : 1.7), time, ultimate ? 4 : 3);
    }
    if (time >= c.nextRing) { c.nextRing = time + .15; kit.ring(head.x, head.y, head.z, radius, radius * 4, time, .28, 0xffffff, look.shell, .06); }
    const floor = c.floor, nearFloor = head.y - floor < 2.4;
    const wall = c.surface && !hitting && end.y - floor > .45;
    if (time >= c.nextRock && (c.surface || nearFloor)) {
      c.nextRock = time + .11;
      if (wall) kit.debris.burst(kit.n(2, 1), head.x, head.y, head.z, -dir.x, 0, -dir.z, 8, .8, .12, floor, 1.8);
      else kit.debris.burst(kit.n(2, 1), head.x, floor, head.z, 0, 1, 0, 7, .7, .12, floor, 1.8);
      this.scratchColor.setHex(DUST_LIT).lerp(this.tint.setHex(look.light), .45);
      kit.smoke(head.x, floor + .25, head.z, (Math.random() - .5) * 4, .8, (Math.random() - .5) * 4, .5, time, .38, this.scratchColor.getHex(), DUST_SHADE);
    }
    if (!c.scorched && (wall || nearFloor)) {
      c.scorched = true;
      if (wall) { kit.scorch(end.x, end.y, end.z, -dir.x, 0, -dir.z, radius * 3, time, look.light); kit.groundImpact(end.x, end.y, end.z, -dir.x, 0, -dir.z, 2, time, bloom, floor); }
      else { kit.scorch(head.x, floor, head.z, 0, 1, 0, radius * 3.2, time, look.light); kit.groundImpact(head.x, floor, head.z, 0, 1, 0, 2, time, bloom, floor); }
    }
  }

  private updateImpact(impact: Impact, time: number) {
    const t = (time - impact.born) / impact.duration;
    if (t > 1) return false;
    const slot = impact.slot;
    if (!slot) return true;
    slot.group.visible = t >= 0;
    if (impact.follow && impact.offset && impact.follow.group.parent) slot.group.position.copy(bodyCentre(impact.follow, this.centre)).add(impact.offset);
    const age = Math.max(0, time - impact.born), ultimate = !!impact.ultimate;
    const shellDuration = slot.shell.material.uniforms.uDuration.value as number;
    const swell = 1 - Math.pow(1 - Math.min(1, age / (ultimate?.22:shellDuration)), 2);
    if(ultimate){
      slot.shell.scale.set(impact.size*(1+swell*.44),impact.size*(1+swell*.20),impact.size*(1+swell*.38));
      slot.shell.material.uniforms.uFloor.value=(-impact.size+.03)/slot.shell.scale.y;
    }else slot.shell.scale.setScalar(impact.size*(1+swell*.9));
    slot.shell.visible = age < shellDuration;
    slot.shell.material.uniforms.uAge.value = age;
    slot.shell.material.uniforms.uTime.value = time;
    if (ultimate) {
      const wave = slot.pressure.material.uniforms;
      const advance = 1 - Math.pow(1 - Math.min(1, age / .66), 2);
      wave.uAge.value = age; wave.uTime.value = time;
      wave.uFront.value = impact.size * .86 + advance * 5.9;
      wave.uWidth.value = .4 + advance * .45;
      wave.uLift.value = .58 * (1 - Math.min(1, age / 1.1));
    }
    const streakLife = ultimate ? .36 : .28, streakAge = Math.min(1, age / streakLife);
    slot.streaks.visible = age < streakLife;
    slot.rim.opacity = ultimate?1-THREE.MathUtils.smoothstep(age,.10,.36):Math.pow(1-streakAge,1.6)*.9;
    for (let i = 0; i < slot.streaks.count; i++) {
      const angle = i * 2.399963 + impact.seed * .11;
      this.direction.set(Math.cos(angle), ultimate ? -.16 + (i % 5) * .24 : Math.sin(i * 2.17) * .65, Math.sin(angle)).normalize();
      const speed = (ultimate ? 4.8 : 4) + i % 3;
      this.scratch.position.copy(this.direction).multiplyScalar(impact.size * .65 + age * speed);
      this.scratch.quaternion.setFromUnitVectors(UP, this.direction);
      const width = (ultimate ? .07+(i%3)*.025 : .026) * (1 - streakAge * .65);
      const length=(ultimate ? 1.75 : .5) * (1 + i % 3 * (ultimate?.13:.24)) * (1 - streakAge * .65);
      this.scratch.scale.set(width,length,width);
      if(ultimate)this.scratch.position.y=Math.max(this.scratch.position.y,-impact.size+.04+Math.abs(this.direction.y)*length*.5+width);
      this.scratch.updateMatrix(); slot.streaks.setMatrixAt(i, this.scratch.matrix);
    }
    slot.streaks.instanceMatrix.needsUpdate = true;
    slot.ink.visible = slot.streaks.visible; slot.inkMaterial.opacity = slot.rim.opacity * .95;
    if(ultimate)this.updateGroundDust(impact,slot,time);
    return true;
  }

  private updateGroundDust(impact:Impact,slot:BurstSlot,time:number){
    const age=Math.max(0,time-impact.born);
    const life=1.05,p=THREE.MathUtils.clamp(age/life,0,1),growth=1-Math.pow(1-p,2);
    const ground=-impact.size+.015;
    const dust=slot.dust;dust.visible=age<life;
    dust.material.uniforms.uTime.value=time;dust.material.uniforms.uAge.value=age;
    dust.material.uniforms.uOpacity.value=.9*(1-THREE.MathUtils.smoothstep(p,.26,1));
    dust.count=Math.max(4,Math.floor(12*Math.min(1,this.kit.budget)));
    for(let i=0;i<dust.count;i++){
      const angle=i*2.399963+impact.seed*.13,radial=.55+growth*3.3+(i%3)*.08;
      this.scratch.position.set(Math.cos(angle)*radial,ground+.12+Math.sin(p*Math.PI)*(.18+i%3*.08),Math.sin(angle)*radial);
      this.scratch.quaternion.identity();
      const width=.34+growth*.5;
      this.scratch.scale.set(width,.13+growth*.26,width*(.75+i%3*.1));
      this.scratch.updateMatrix();dust.setMatrixAt(i,this.scratch.matrix);
    }
    dust.instanceMatrix.needsUpdate=true;
    const debris=slot.debris;debris.visible=age<.8;
    slot.debrisMaterial.opacity=1-THREE.MathUtils.smoothstep(age,.3,.8);
    for(let i=0;i<debris.count;i++){
      const angle=i*2.399963+impact.seed*.13,radial=.55+age*(3.4+i%3*.65);
      this.direction.set(Math.cos(angle),.2,Math.sin(angle)).normalize();
      this.scratch.position.set(Math.cos(angle)*radial,ground+.08+Math.max(0,age*(2.4+i%3*.55)-age*age*4),Math.sin(angle)*radial);
      this.scratch.quaternion.setFromAxisAngle(this.direction,age*(6+i%3));
      this.scratch.scale.set(.11+i%3*.025,.18+i%2*.09,.08+i%3*.018);
      this.scratch.updateMatrix();debris.setMatrixAt(i,this.scratch.matrix);
    }
    debris.instanceMatrix.needsUpdate=true;
  }

  reset() {
    this.casts.forEach(c => this.removeCast(c)); this.impacts.forEach(i => this.releaseSlot(i));
    for (const beam of this.downBeams) beam.born = -9;
    this.casts = []; this.impacts = []; this.seen.clear(); this.narutoHeavyCasts.clear(); this.detonations.clear(); FLIGHTS.clear();
    this.touchSparks.clear(); this.touchSeen = Fighter.touchLog.at(-1)?.serial ?? this.touchSeen; this.lastPanel = -1e9;
    this.kit.clear(); this.motion.clear(); this.blast.reset(); this.guard.reset(); this.weather.reset(); this.empress.reset(); this.chainsaw.reset(); this.magma.reset(); this.berserker.reset(); this.cowling.reset(); this.pressure.reset(); this.explosions.reset(); this.rosterSignatures.reset();
    LANDED.reset();
  }
  dispose() {
    this.reset();
    for (const slot of this.slots) {
      slot.group.removeFromParent(); slot.streaks.dispose(); slot.ink.dispose(); slot.dust.dispose(); slot.debris.dispose();
      for (const m of [slot.rim, slot.inkMaterial, slot.shell.material, slot.pressure.material, slot.dust.material, slot.debrisMaterial]) m.dispose();
    }
    this.slots = []; this.blast.dispose();
    const shared = new Set<THREE.Material>([this.core, this.spirit, this.violet, this.halo, this.cyan, this.crescentMaterial, this.windMaterial]);
    if (this.warm) { this.warm.removeFromParent(); this.warm.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && !shared.has(m)) m.dispose(); }); this.warm = undefined; }
    [this.sphere, this.fistGeometry, this.ring, this.windBlade, this.pressureGeometry, this.spark, this.inkGeometry, this.crescentGeometry].forEach(g => g.dispose());
    shared.forEach(m => m.dispose());
    this.guard.dispose(); this.weather.dispose(); this.empress.dispose(); this.chainsaw.dispose(); this.magma.dispose(); this.berserker.dispose(); this.cowling.dispose(); this.pressure.dispose(); this.explosions.dispose(); this.rosterSignatures.dispose();
    this.kit.release();
  }
}
