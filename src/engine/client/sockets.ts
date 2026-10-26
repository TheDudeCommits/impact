import { crocodileStrikeSide } from '../../game/fighters/crocodile';
import * as THREE from 'three';
import type { FighterId, PlayerState } from '../../game/types';
import { MOVES } from '../../game/moves';
import type { Fighter } from '../../render/Fighter';
import { nicoRobinStrikePoint } from '../../render/signature/NicoRobinBloomPose';
import { kaijuStrikeJoint, KAIJU_KNUCKLE_SOCKETS } from '../../game/fighters/kaiju-no-8';
import { erenBlade, erenTitanFist, EREN_SWORD_SOCKETS, EREN_TITAN_KNUCKLES } from '../../game/fighters/eren';
import { asukaStrikeSocket } from '../../game/fighters/asuka';
import { ASUKA_KNIFE } from '../../render/signature/AsukaField';
import { asukaSurfacePoint } from '../../render/signature/AsukaSurface';
import { shinjiStrikePoint } from '../../render/signature/ShinjiSurface';
import { neteroSurfacePoint } from '../../render/signature/NeteroContactSurface';
import { neteroDrawnPalmPoint } from '../../render/signature/NeteroBodhisattva';
import { jolyneStrikeJoint } from '../../render/signature/JolyneStoneThread';
import { jolyneStandSurfacePoint } from '../../render/signature/JolyneStandSurface';
import { mightGuyStrikePoint } from '../../render/signature/MightGuyGates';
import { AKAME_BLADE } from '../../render/signature/AkameMurasame';
import { pikachuStrikePoint } from '../../render/signature/PikachuVolt';
import { garouStrikeJoint } from '../../render/signature/GarouWaterStream';
import { garouSurfacePoint } from '../../render/signature/GarouContactSurface';
import { esdeathStrikeJoint, ESDEATH_RAPIER_TIP } from '../../game/fighters/esdeath';
import { mikasaStrikeJoint, MIKASA_SWORD_SOCKETS } from '../../game/fighters/mikasa';
import { alphonseStrikePoint } from '../../render/signature/AlphonseBastion';
import { kanekiContactPoint } from '../../render/signature/KanekiRinkaku';
import { grimmjowStrikeJoint } from '../../game/fighters/grimmjow';
import { byakuyaStrikeSide } from '../../game/fighters/byakuya';
import { BYAKUYA_BLADE } from '../../render/signature/ByakuyaSenbonzakura';
import { YAMAMOTO_SWORD_SOCKET } from '../../game/fighters/yamamoto';
import { painStrikeJoint, PAIN_RECEIVER_TIP } from '../../render/signature/PainGravity';
import { edwardStrikePoint } from '../../render/signature/EdwardAlchemy';
import { minatoStrikeSide } from '../../game/fighters/minato';
import { makimaStrikeJoint, makimaCommandPoint } from '../../render/signature/MakimaControl';
import { tatsumakiStrikePoint } from '../../render/signature/TatsumakiPsychic';
import { escanorStrikeJoint, escanorRhittaVisible, ESCANOR_RHITTA_EDGE } from '../../game/fighters/escanor';
import { meliodasStrikeJoint, meliodasBladePoint } from '../../render/signature/MeliodasHellblaze';
import { sakuraStrikeSide } from '../../game/fighters/sakura';
import { aokijiStrikeJoint, AOKIJI_SABER_SOCKET } from '../../game/fighters/aokiji';
import { doflamingoStrikePoint } from '../../render/signature/DoflamingoStrings';
import { blackbeardStrikePoint } from '../../render/signature/BlackbeardEmperor';
import { hisokaStrikeJoint } from '../../render/signature/HisokaBungeeGum';
import { jiraiyaStrikeSocket, JIRAIYA_MOUTH_OFFSET } from '../../game/fighters/jiraiya';
import { tsunadeStrikeSocket } from '../../game/fighters/tsunade';
import { hinataStrikeSide } from '../../game/fighters/hinata';
import { gintokiBokkenPoint } from '../../render/signature/GintokiSilverSoul';
import { kizaruStrikeJoint } from '../../game/fighters/kizaru';
import { yamatoKanaboPoint } from '../../render/signature/YamatoOni';
import { kizaruFingerPoint } from '../../render/signature/KizaruGlint';
import { jinbeStrikeSide } from '../../game/fighters/jinbe';
import { allMightContact } from '../../render/signature/AllMightPressure';
import { yujiStrikeJoint } from '../../render/signature/YujiBlackFlash';
import { todorokiStrikesLeft } from '../../game/fighters/todoroki';
import { bakugoContact, bakugoPalm } from '../../render/signature/BakugoExplosions';
import { dekuContact, dekuSocket } from '../../render/signature/DekuCowling';
import { denjiSawContact } from '../../render/signature/DenjiChainsaw';
import { akainuMagmaContact, akainuMagmaSocket } from '../../render/signature/AkainuMagma';
import { boaFingertip, boaHeelContact } from '../../render/signature/BoaEmpress';
import { SHAMBLES_TAKE } from '../../render/law/shambles';

export type SocketKind = 'strike' | 'contact' | 'charge';
type Vec3 = readonly [number, number, number];

export interface SocketContext {
  readonly body: Fighter;
  readonly shown: Fighter;
  readonly state: PlayerState;
  readonly clip: string | undefined;
  readonly time: number | undefined;
  readonly phase: number;
  readonly shownClip: string | undefined;
  readonly shownTime: number;
  readonly shownPhase: number;
  readonly elapsed: number;
  readonly form: boolean;
  readonly shownForm: boolean;
  readonly formBody: Fighter | undefined;
  readonly index: number | undefined;
  contacts(): readonly number[];
  ender(state: PlayerState): string | undefined;
  readonly head: THREE.Object3D | undefined;
  readonly rightHand: THREE.Object3D | undefined;
}

export type SocketPoint =
  | 'handR' | 'handL' | 'handRL' | 'handLR'
  | 'strike' | 'form strike'
  | 'root'
  | { readonly joint: string; readonly of?: 'own' | 'shown' | 'drawn'; readonly at?: Vec3; readonly stale?: true }
  | { readonly bone: string; readonly of?: 'own' | 'shown'; readonly at?: Vec3; readonly stale?: true }
  | { readonly node: string; readonly of?: 'own' | 'shown'; readonly at: Vec3; readonly stale?: true }
  | { readonly solve: (ctx: SocketContext, out: THREE.Vector3) => boolean }
  | { readonly first: readonly (SocketPoint | string)[] }
  | { readonly mid: readonly [SocketPoint | string, SocketPoint | string] }
  | { readonly always: SocketPoint | string };

export type SocketRule = string | SocketPoint | ((ctx: SocketContext) => string | SocketPoint | undefined);

export interface FighterSockets {
  readonly points?: Readonly<Record<string, SocketPoint>>;
  readonly socket?: SocketRule;
  readonly strike?: SocketRule;
  readonly contact?: SocketRule;
  readonly charge?: SocketRule;
  readonly hands?: { readonly toward: string; readonly by: number };
  readonly formHands?: 'awakened';
  readonly unarmed?: true;
}

const scratch = new THREE.Vector3(), forward = new THREE.Vector3(), across = new THREE.Vector3(), other = new THREE.Vector3(), scale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const solve = (place: (ctx: SocketContext, out: THREE.Vector3) => boolean): SocketPoint => ({ solve: place });
const always = (place: (ctx: SocketContext, out: THREE.Vector3) => unknown): SocketPoint => ({ solve: (ctx, out) => { place(ctx, out); return true; } });
const nearest = (ctx: SocketContext) => {
  const contacts = ctx.contacts();
  let index = 0;
  for (let i = 1; i < contacts.length; i++) if (Math.abs(contacts[i] - ctx.elapsed) < Math.abs(contacts[index] - ctx.elapsed)) index = i;
  return index;
};
const nodes = new WeakMap<THREE.Object3D, Map<string, THREE.Object3D | null>>();
const named = (model: THREE.Object3D, name: string) => {
  let found = nodes.get(model);
  if (!found) nodes.set(model, found = new Map());
  if (!found.has(name)) found.set(name, model.getObjectByName(name) ?? null);
  return found.get(name) ?? undefined;
};

const neteroPoint = solve((ctx, out) => {
  const state = ctx.state;
  if (state.action === 'ultimate' && !state.branch) {
    const contacts = MOVES.netero.ultimate.contacts, t = state.actionTime * state.actionDuration;
    let contact = ctx.index ?? 0;
    if (ctx.index === undefined) for (let i = 1; i < contacts.length; i++) if (t > (contacts[i - 1] + contacts[i]) * .5) contact = i;
    if (contact > 0) return neteroDrawnPalmPoint(ctx.body, contact, out);
  }
  return neteroSurfacePoint(ctx.shown.model, state.action, ctx.shownClip, out);
});
const standBody = (ctx: SocketContext) => {
  const stand = ctx.body.stand ? ctx.body : ctx.body.standSource;
  return stand?.stand && stand.group.visible && stand.group.parent ? stand : undefined;
};
const standContact = (ctx: SocketContext, stand: Fighter, fighter: 'jolyne' | 'josuke') => {
  const state = stand.state, alternate = !ctx.ender(state) && (state.action === 'special' || state.action === 'ultimate');
  let contact = ctx.index ?? 0;
  if (ctx.index === undefined && alternate) {
    const times = MOVES[fighter][state.action as 'special' | 'ultimate'].contacts, t = state.actionTime * state.actionDuration;
    let distance = Infinity;
    for (let i = 0; i < times.length; i++) { const gap = Math.abs(t - times[i]); if (gap < distance) { distance = gap; contact = i; } }
  }
  return { state, contact, alternate };
};
const lowerWeapons = new WeakMap<Fighter, { spear?: { bone: THREE.Bone; tip: THREE.Vector3 }; dagger?: { bone: THREE.Bone; tip: THREE.Vector3 } } | null>();
const sukunaWeapon = solve((ctx, out) => {
  const body = ctx.body;
  let weapons = lowerWeapons.get(body);
  if (weapons === undefined) {
    weapons = null;
    const find = (mesh: string, joint: string, pick: (p: THREE.Vector3, hand: THREE.Vector3) => number) => {
      const skinned = body.model.getObjectByName(mesh) as THREE.SkinnedMesh | undefined;
      const bone = body.model.getObjectByName(joint) as THREE.Bone | undefined;
      if (!skinned?.isSkinnedMesh || !bone) return undefined;
      const index = skinned.skeleton.bones.indexOf(bone);
      if (index < 0) return undefined;
      const inverse = skinned.skeleton.boneInverses[index], position = skinned.geometry.attributes.position, p = new THREE.Vector3(), best = new THREE.Vector3();
      const hand = new THREE.Vector3().applyMatrix4(inverse.clone().invert());
      let score = -Infinity;
      for (let i = 0; i < position.count; i++) { p.fromBufferAttribute(position, i).applyMatrix4(skinned.bindMatrix); const s = pick(p, hand); if (s > score) { score = s; best.copy(p); } }
      return { bone, tip: best.applyMatrix4(inverse) };
    };
    const spear = find('weapon_spear', 'Spear', p => -p.y), dagger = find('weapon_dagger', 'Dagger', (p, hand) => p.distanceTo(hand) - (p.y > hand.y ? 1 : 0));
    if (spear || dagger) weapons = { spear, dagger };
    lowerWeapons.set(body, weapons);
  }
  const s = ctx.state;
  if (!weapons || !ctx.form) return false;
  const lower = s.action === 'light' ? (s.chain ?? 0) === 1 ? weapons.dagger : weapons.spear : s.action === 'heavy' ? weapons.spear : undefined;
  if (!lower) return false;
  out.copy(lower.tip).applyMatrix4(lower.bone.matrixWorld);
  return true;
});

const kickHips = new THREE.Vector3();
const mikasaKick = solve((ctx, out) => {
  if (ctx.shownClip !== 'Rush 2') return false;
  const hips = ctx.body.drawnJoint('Hips'), foot = ctx.body.drawnJoint('RightToeBase') ?? ctx.body.drawnJoint('RightFoot');
  if (!hips || !foot) return false;
  const floor = ctx.body.group.position.y;
  foot.getWorldPosition(out);
  return out.y - floor > .6 * (hips.getWorldPosition(kickHips).y - floor);
});

export const FIGHTER_SOCKETS: Readonly<Partial<Record<FighterId, FighterSockets>>> = {
  toji: { socket: { node: 'TojiBladeTip', of: 'shown', at: [0,0,0] } },
  usopp: { socket: { joint: 'RightHand', of: 'drawn' } },
  crocodile: {
    points: { Left: { joint: 'LeftHand', of: 'drawn', at: [.7357524, -.0154704, -.0047152] }, Right: { joint: 'RightHand', of: 'drawn' } },
    socket: ctx => crocodileStrikeSide(ctx.state.action, ctx.time ?? 0, ctx.clip),
  },
  rengoku: { socket: { node: 'RengokuBladeTip', of: 'shown', at: [0,0,0] } },
  akame: { socket: { bone: 'sword', of: 'shown', at: AKAME_BLADE.tip } },
  yamamoto: { socket: { joint: 'RightHand', of: 'drawn', at: YAMAMOTO_SWORD_SOCKET.tip } },
  esdeath: {
    points: { LeftHand: { joint: 'LeftHand', of: 'drawn' }, RightHand: { first: [{ joint: 'Sword', of: 'shown', at: ESDEATH_RAPIER_TIP }, { node: 'Sword', of: 'shown', at: ESDEATH_RAPIER_TIP }] } },
    socket: ctx => esdeathStrikeJoint(ctx.state.action, ctx.clip),
  },
  mikasa: {
    points: { LeftHand: { joint: 'LeftHand', of: 'drawn', at: MIKASA_SWORD_SOCKETS.LeftHand.tip }, RightHand: { joint: 'RightHand', of: 'drawn', at: MIKASA_SWORD_SOCKETS.RightHand.tip }, kick: mikasaKick },
    socket: ctx => ({ first: ['kick', mikasaStrikeJoint(ctx.clip ?? '', ctx.index, ctx.phase)] }),
  },
  byakuya: {
    points: { Left: { joint: 'LeftHand', of: 'drawn' }, Right: { node: 'Sword', of: 'shown', at: BYAKUYA_BLADE.tip, stale: true } },
    socket: ctx => byakuyaStrikeSide(ctx.state.action, ctx.time ?? 0, ctx.clip, ctx.index),
  },
  aokiji: {
    points: {
      LeftFoot: { joint: 'LeftFoot' },
      saber: { solve: (ctx, out) => !!named(ctx.body.model, 'Aokiji_Ice_Saber')?.visible && placeIn(ctx, { joint: 'AokijiSaber', at: AOKIJI_SABER_SOCKET.tip, stale: true }, out) },
    },
    socket: ctx => ({ first: aokijiStrikeJoint(ctx.state.action, ctx.time, ctx.clip) === 'LeftFoot' ? ['LeftFoot', 'saber', 'handR'] : ['saber', 'handR'] }),
  },
  escanor: {
    socket: ctx => {
      const action = ctx.shown.state.action, time = ctx.shownTime, clip = ctx.shownClip;
      const side = action === 'ultimate' && ctx.index !== undefined ? ctx.index === 1 ? 'LeftHand' : 'RightHand' : escanorStrikeJoint(action, time, clip);
      const edge = side === 'RightHand' && (action === 'light' || action === 'heavy') && escanorRhittaVisible(action, time, clip);
      return edge ? { joint: side, of: 'shown', at: (ctx.shown === ctx.body ? ESCANOR_RHITTA_EDGE.base : ESCANOR_RHITTA_EDGE.form).middle, stale: true } : { joint: side, of: 'shown' };
    },
  },
  asuka: {
    points: {
      RightFoot: solve((ctx, out) => asukaSurfacePoint(ctx.body, 'rightHeel', out)),
      LeftHand: solve((ctx, out) => asukaSurfacePoint(ctx.body, 'leftPalm', out)),
      RightHand: { bone: 'progressiveknife', of: 'shown', at: ASUKA_KNIFE.tip, stale: true },
    },
    socket: ctx => asukaStrikeSocket(ctx.shown.state.action, ctx.shownClip ?? '', ctx.shownPhase, ctx.index),
  },
  'kaiju-no-8': { socket: ctx => { const side = kaijuStrikeJoint(ctx.shownClip ?? '', ctx.index, ctx.shownPhase); return { joint: side, of: 'shown', at: KAIJU_KNUCKLE_SOCKETS[side], stale: true }; } },
  eren: { socket: ctx => {
    if (ctx.shownForm) { const side = erenTitanFist(ctx.shownClip ?? '', ctx.index, ctx.shownPhase); return { joint: side, of: 'shown', at: EREN_TITAN_KNUCKLES[side], stale: true }; }
    const blade = erenBlade(ctx.shownClip ?? '', ctx.index, ctx.shownPhase);
    return { bone: blade.toLowerCase(), of: 'shown', at: EREN_SWORD_SOCKETS[blade].tip };
  } },
  pain: {
    points: { RightHand: { joint: 'RightHand', of: 'drawn', at: PAIN_RECEIVER_TIP }, LeftHand: { joint: 'LeftHand', of: 'drawn' } },
    socket: ctx => painStrikeJoint(ctx.state.action, ctx.clip, ctx.index ?? ((ctx.time ?? 0) < .955 ? 0 : 1)),
  },
  grimmjow: { unarmed: true, socket: ctx => ({ joint: grimmjowStrikeJoint(ctx.state.action, ctx.shownClip, ctx.index), of: 'drawn' }) },
  minato: { socket: ctx => ({ joint: `${minatoStrikeSide(ctx.shown.state.action, ctx.shownTime, ctx.shownClip, ctx.index)}Hand`, of: 'shown' }) },
  tsunade: { socket: ctx => ({ joint: tsunadeStrikeSocket(ctx.shown.state.action, ctx.shownTime, ctx.shownClip, ctx.index), of: 'shown' }) },
  sakura: {
    points: { Left: { joint: 'LeftHand', of: 'shown' }, Right: { joint: 'RightHand', of: 'shown' }, Both: { first: [{ mid: ['Right', 'Left'] }, 'Right'] } },
    socket: ctx => sakuraStrikeSide(ctx.shown.state.action, ctx.shownTime, ctx.shownClip, ctx.index),
  },
  hiei: { socket: { joint: 'RightHand', of: 'shown' } },
  kenpachi: { socket: { joint: 'RightHand', of: 'shown' } },
  jiraiya: {
    points: {
      Mouth: solve((ctx, out) => {
        const head = ctx.shown.joints.get('Head');
        if (!head) return false;
        head.getWorldPosition(out);
        const size = ctx.shown.group.getWorldScale(scale).x;
        forward.set(0, 0, 1).transformDirection(ctx.shown.group.matrixWorld);
        out.addScaledVector(forward, JIRAIYA_MOUTH_OFFSET.forward * size).addScaledVector(UP, JIRAIYA_MOUTH_OFFSET.up * size);
        return true;
      }),
    },
    socket: ctx => { const socket = jiraiyaStrikeSocket(ctx.shown.state.action, ctx.shownTime, ctx.shownClip, ctx.index); return socket === 'Mouth' ? 'Mouth' : { joint: socket, of: 'shown' }; },
  },
  hinata: { points: { Both: 'handLR', Left: 'handL', Right: 'handR' }, socket: ctx => hinataStrikeSide(ctx.state.action, ctx.elapsed, ctx.clip, ctx.index) },
  jinbe: { points: { Both: 'handLR', Left: 'handL', Right: 'handR' }, socket: ctx => ctx.state.action === 'light' && (ctx.clip === 'Karate Palm' || ctx.clip === 'Rush 3') ? 'Right' : jinbeStrikeSide(ctx.state.action, ctx.elapsed, ctx.clip) },
  yoruichi: { socket: ctx => {
    const joint = ({ 'Flash Heel': 'RightFoot', 'Aerial Flash Heel': 'RightFoot', 'Thunder Heel': 'LeftFoot', 'Rush 3': 'LeftFoot', 'Rush 1': 'LeftHand', 'Hakuda Elbow': 'RightForeArm' } as Record<string, string>)[ctx.clip ?? ''];
    return joint ? { joint } : undefined;
  } },
  kizaru: {
    points: { finger: always((ctx, out) => kizaruFingerPoint(ctx.body, out)) },
    socket: ctx => ctx.clip === 'Finger Laser' ? 'finger' : { joint: kizaruStrikeJoint(ctx.clip, ctx.time ?? 0, ctx.index ?? 0) },
  },
  todoroki: { strike: ctx => todorokiStrikesLeft(ctx.state.action, ctx.ender(ctx.state)) ? 'handL' : undefined },
  broly: { strike: ctx => ctx.shownClip === 'Rush 1' ? 'handL' : undefined },
  yuji: { socket: ctx => ({ joint: yujiStrikeJoint(ctx.state.action, ctx.clip, ctx.index === undefined && ctx.state.action === 'ultimate' ? nearest(ctx) : ctx.index) }) },
  hisoka: { socket: ctx => ({ joint: hisokaStrikeJoint(ctx.state.action, ctx.clip, ctx.index === undefined && ctx.state.action === 'ultimate' ? nearest(ctx) : ctx.index) }) },
  meliodas: {
    points: { LeftHand: { first: [solve((ctx, out) => meliodasBladePoint(ctx.body, out)), { joint: 'LeftHand', of: 'shown' }] }, RightHand: { joint: 'RightHand', of: 'shown' } },
    socket: ctx => meliodasStrikeJoint(ctx.shown.state.action, ctx.shownClip),
  },
  netero: { socket: neteroPoint, strike: { first: [neteroPoint, 'root'] }, charge: { first: [neteroPoint, 'root'] } },
  garou: { socket: solve((ctx, out) => {
    const body = ctx.shown, t = ctx.shownTime;
    const contact = ctx.index ?? (t < .74 ? 0 : t < 1.335 ? 1 : t < 1.93 ? 2 : t < 2.625 ? 3 : 4);
    const hand = body.joints.get(garouStrikeJoint(body.state.action, ctx.shownClip, contact));
    if (!hand) return false;
    garouSurfacePoint(hand, ctx.shownForm, body.state.action, ctx.shownClip, contact, out);
    return true;
  }) },
  'ken-kaneki': { socket: solve((ctx, out) => {
    const t = ctx.shownTime, contact = ctx.index ?? (t < .85 ? 0 : t < 1.575 ? 1 : t < 2.485 ? 2 : 3);
    return kanekiContactPoint(ctx.body, ctx.state.action, ctx.shownClip, contact, out);
  }) },
  makima: { socket: solve((ctx, out) => {
    const t = ctx.time ?? 0, contact = ctx.index ?? (t < .91 ? 0 : t < 1.635 ? 1 : t < 2.425 ? 2 : 3);
    return makimaCommandPoint(ctx.body, out, makimaStrikeJoint(ctx.state.action, ctx.clip, contact) === 'LeftHand' ? 'Left' : 'Right');
  }) },
  shinji: { socket: solve((ctx, out) => {
    const state = ctx.shown.state, moves = MOVES.shinji.ultimate.contacts;
    const contact = ctx.index ?? (state.action === 'ultimate' && state.actionTime * state.actionDuration > (moves[0] + moves[1]) * .5 ? 1 : 0);
    return shinjiStrikePoint(ctx.body, out, ctx.shownClip, contact);
  }) },
  'nico-robin': { socket: solve((ctx, out) => nicoRobinStrikePoint(ctx.body, out, ctx.body.displayedClipName, ctx.body.displayedClipTime, ctx.index)) },
  'might-guy': { socket: always((ctx, out) => mightGuyStrikePoint(ctx.shown, out, ctx.shownClip, ctx.shownTime, ctx.index)) },
  pikachu: { socket: always((ctx, out) => pikachuStrikePoint(ctx.body, out, ctx.clip, ctx.time, ctx.index)) },
  doflamingo: { socket: always((ctx, out) => doflamingoStrikePoint(ctx.body, out, ctx.clip, ctx.time, ctx.index)) },
  blackbeard: { socket: always((ctx, out) => blackbeardStrikePoint(ctx.body, out, ctx.clip, ctx.time, ctx.index)) },
  tatsumaki: { socket: always((ctx, out) => tatsumakiStrikePoint(ctx.body, out, ctx.clip, ctx.time, ctx.index)) },
  'alphonse-elric': { socket: always((ctx, out) => alphonseStrikePoint(ctx.body, out, ctx.clip, ctx.time, ctx.index)) },
  'edward-elric': { socket: always((ctx, out) => edwardStrikePoint(ctx.body, out, ctx.clip, ctx.time, ctx.index)) },
  gintoki: { socket: solve((ctx, out) => gintokiBokkenPoint(ctx.body, out)) },
  yamato: { socket: always((ctx, out) => yamatoKanaboPoint(ctx.body, out)) },
  jolyne: { socket: solve((ctx, out) => {
    const stand = standBody(ctx);
    if (!stand) return false;
    const { state, contact } = standContact(ctx, stand, 'jolyne'), clip = stand.displayedClipName;
    const joint = stand.joints.get(jolyneStrikeJoint(state.action, clip, contact));
    if (!joint) return false;
    jolyneStandSurfacePoint(joint, clip, contact, out);
    return true;
  }) },
  josuke: { socket: solve((ctx, out) => {
    const stand = standBody(ctx);
    if (!stand) return false;
    const { contact, alternate } = standContact(ctx, stand, 'josuke');
    const joint = stand.joints.get(alternate && contact % 2 === 1 ? 'LeftHand' : 'RightHand');
    if (!joint) return false;
    joint.getWorldPosition(out);
    return true;
  }) },
  'all-might': { contact: solve((ctx, out) => allMightContact(ctx.body, ctx.index ?? 0, out, ctx.clip)) },
  bakugo: { charge: always((ctx, out) => bakugoPalm(ctx.body, 'Right', out)), contact: solve((ctx, out) => bakugoContact(ctx.body, ctx.index ?? 0, out, ctx.clip)) },
  deku: { charge: always((ctx, out) => dekuSocket(ctx.body, 'RightHandIndex3', out)), contact: solve((ctx, out) => dekuContact(ctx.body, ctx.index ?? 0, out, ctx.clip)) },
  akainu: { charge: always((ctx, out) => akainuMagmaSocket(ctx.body, 'Left', out)), contact: solve((ctx, out) => akainuMagmaContact(ctx.body, out, ctx.clip)) },
  denji: { charge: solve((ctx, out) => denjiSawContact(ctx.body, 0, out, ctx.clip)), contact: solve((ctx, out) => denjiSawContact(ctx.body, ctx.index ?? 0, out, ctx.clip)) },
  'boa-hancock': { charge: always((ctx, out) => boaFingertip(ctx.body, out)), contact: solve((ctx, out) => boaHeelContact(ctx.body, ctx.index ?? 0, out)) },
  nanami: { charge: 'strike', contact: 'strike' },
  sanji: { contact: { always: { joint: 'RightFoot' } } },
  itachi: { contact: ctx => ctx.state.action === 'heavy' ? { always: { joint: 'LeftFoot' } } : undefined },
  law: { contact: ctx => (ctx.state.action === 'special' || ctx.state.action === 'ultimate') && ctx.body.slotClip(ctx.state, ['Gamma Knife', 'Counter Shock', SHAMBLES_TAKE.open.clip]) ? 'handL' : undefined },
  ace: { charge: ctx => ctx.state.action === 'heavy' && !ctx.state.branch ? 'handRL' : undefined },
  guts: { charge: ctx => ctx.state.action === 'heavy' && !ctx.state.branch ? 'strike' : 'handL' },
  roger: { charge: ctx => ctx.state.action === 'special' ? 'handL' : undefined },
  aizen: { charge: ctx => ctx.state.action === 'special' ? solve((c, out) => {
    const group = c.body.group;
    out.set(group.position.x - Math.sin(group.rotation.y) * .35, group.position.y + 1.55, group.position.z - Math.cos(group.rotation.y) * .35);
    return true;
  }) : undefined },
  goku: { charge: 'handRL' },
  vegeta: { charge: ctx => ctx.state.action === 'special' || ctx.state.action === 'ultimate' ? 'handRL' : undefined, hands: { toward: 'handmiddle1', by: .65 } },
  naruto: {
    formHands: 'awakened',
    charge: always((ctx, out) => {
      const body = ctx.body, state = ctx.state;
      if (ctx.formBody && state.awakened) return ctx.formBody.chargePosition(out);
      if (ctx.form && ctx.head) {
        ctx.head.getWorldPosition(out);
        const size = body.group.getWorldScale(scale).x;
        return out.addScaledVector(forward.set(0, 0, 1).transformDirection(body.group.matrixWorld), .3 * size);
      }
      out.copy(body.handR);
      if (state.action === 'ultimate') return out.lerp(body.handL, .5);
      const own = !body.slotClip(state);
      if (state.action === 'special' && !own) return out.addScaledVector(UP, .15);
      if (state.action === 'heavy' && !own && ctx.rightHand) {
        const index = body.bones.get('righthandindex1'), pinky = body.bones.get('righthandpinky1'), middle = body.bones.get('righthandmiddle1');
        if (index && pinky && middle) {
          ctx.rightHand.getWorldPosition(out);
          const fingers = middle.getWorldPosition(forward).sub(out).normalize();
          const normal = index.getWorldPosition(across).sub(pinky.getWorldPosition(other)).cross(fingers).normalize();
          return out.addScaledVector(fingers, .07).addScaledVector(normal, .14);
        }
      }
      return out.addScaledVector(forward.set(Math.sin(body.group.rotation.y), 0, Math.cos(body.group.rotation.y)), .08).addScaledVector(UP, .04);
    }),
  },
  kaido: { strike: 'form strike' },
  sukuna: { strike: { first: ['form strike', sukunaWeapon] } },
};

export type SocketAsk = { -readonly [K in keyof SocketContext]: SocketContext[K] };
export function socketAsk(body: Fighter, contacts: () => readonly number[], ender: (state: PlayerState) => string | undefined): SocketAsk {
  return { body, shown: body, state: body.state, clip: undefined, time: undefined, phase: 0, shownClip: undefined, shownTime: 0, shownPhase: 0,
    elapsed: 0, form: false, shownForm: false, formBody: undefined, index: undefined, contacts, ender, head: undefined, rightHand: undefined };
}

function nodeOf(ctx: SocketContext, point: { joint?: string; bone?: string; node?: string; of?: 'own' | 'shown' | 'drawn' }) {
  const body = point.of === 'shown' ? ctx.shown : ctx.body;
  if (point.joint !== undefined) return point.of === 'drawn' ? ctx.body.drawnJoint(point.joint) : body.joints.get(point.joint);
  if (point.bone !== undefined) return body.bones.get(point.bone);
  return named(body.model, point.node!);
}

function placeIn(ctx: SocketContext, point: SocketPoint | string, out: THREE.Vector3, points?: Readonly<Record<string, SocketPoint>>): boolean {
  if (typeof point === 'string') {
    switch (point) {
      case 'handR': out.copy(ctx.body.handR); return true;
      case 'handL': out.copy(ctx.body.handL); return true;
      case 'handRL': out.copy(ctx.body.handR).lerp(ctx.body.handL, .5); return true;
      case 'handLR': out.copy(ctx.body.handL).lerp(ctx.body.handR, .5); return true;
      case 'strike': ctx.body.strikePoint(out); return true;
      case 'form strike': if (!ctx.formBody || ctx.form) return false; ctx.formBody.strikePoint(out); return true;
      case 'root': out.copy(ctx.body.group.position); return true;
    }
    const own = points?.[point];
    return own !== undefined && placeIn(ctx, own, out, points);
  }
  if ('solve' in point) return point.solve(ctx, out);
  if ('first' in point) { for (const each of point.first) if (placeIn(ctx, each, out, points)) return true; return false; }
  if ('mid' in point) {
    if (!placeIn(ctx, point.mid[0], out, points)) return false;
    const second = new THREE.Vector3();
    if (!placeIn(ctx, point.mid[1], second, points)) return false;
    out.lerp(second, .5);
    return true;
  }
  if ('always' in point) { placeIn(ctx, point.always, out, points); return true; }
  const node = nodeOf(ctx, point);
  if (!node) return false;
  if (!point.at) node.getWorldPosition(out);
  else if (point.stale) out.set(point.at[0], point.at[1], point.at[2]).applyMatrix4(node.matrixWorld);
  else node.localToWorld(out.set(point.at[0], point.at[1], point.at[2]));
  return true;
}

export function placeSocket(kind: SocketKind, ctx: SocketContext, out: THREE.Vector3): boolean {
  const sockets = FIGHTER_SOCKETS[ctx.state.fighter];
  const rule = sockets?.[kind] ?? sockets?.socket;
  if (rule === undefined) return false;
  const point = typeof rule === 'function' ? rule(ctx) : rule;
  return point !== undefined && placeIn(ctx, point, out, sockets!.points);
}

export interface DeclaredNode { readonly kind: 'joint' | 'bone' | 'node'; readonly name: string }
export function declaredNodes(fighter: FighterId): DeclaredNode[][] {
  const out: DeclaredNode[][] = [], sockets = FIGHTER_SOCKETS[fighter];
  const named = (point: SocketPoint | string | undefined): DeclaredNode[] => {
    if (point === undefined || typeof point === 'string') return [];
    if ('first' in point) return point.first.flatMap(named);
    if ('mid' in point || 'always' in point || 'solve' in point) return [];
    if ('joint' in point && point.joint !== undefined) return [{ kind: 'joint', name: point.joint }];
    if ('bone' in point && point.bone !== undefined) return [{ kind: 'bone', name: point.bone }];
    return 'node' in point ? [{ kind: 'node', name: point.node }] : [];
  };
  const walk = (point: SocketPoint | string | undefined): void => {
    if (point === undefined || typeof point === 'string') return;
    if ('mid' in point) { point.mid.forEach(walk); return; }
    if ('always' in point) { walk(point.always); return; }
    if ('first' in point) { const any = named(point); if (any.length) out.push(any); point.first.forEach(each => { if (typeof each !== 'string' && ('mid' in each || 'always' in each)) walk(each); }); return; }
    const one = named(point);
    if (one.length) out.push(one);
  };
  for (const point of Object.values(sockets?.points ?? {})) walk(point);
  for (const rule of [sockets?.socket, sockets?.strike, sockets?.contact, sockets?.charge]) if (rule !== undefined && typeof rule !== 'function') walk(rule);
  return out;
}
