import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { FighterId } from '../../game/types';
import { DREAM_FLINCH, DREAM_HURTS, Fighter, clipMotionTable } from '../../render/Fighter';
import { findClipIn } from '../../render/clipMatch';
import { loadTakePack } from './takePacks';
import { retarget, rigOf, type Rig } from './retarget';

export const HURT_DONOR: { readonly fighter: FighterId; readonly file: string; readonly files: readonly string[] } = {
  fighter: 'goku', file: '/assets/fighters/goku-fanim7.glb', files: ['/assets/fighters/goku-fanim7.glb', '/assets/fighters/goku-fanim6.glb'] };
const TAKES: Readonly<Record<string, string>> = { ...DREAM_HURTS, 'dream flinch': DREAM_FLINCH, abdomen: 'heavy-abdomen-fold' };
const OWN_ACTING: ReadonlySet<FighterId> = new Set<FighterId>(['pikachu', 'kaido']);
const REFERENCE = ['_Idle', 'Idle', 'goku-ready', '02-STANCE', 'stance', 'idle'];

export interface HurtDonor { readonly rig: Rig; readonly clips: readonly THREE.AnimationClip[] }
let donor: HurtDonor | undefined;
let loading: Promise<HurtDonor | undefined> | undefined;
async function fetchDonor(): Promise<HurtDonor | undefined> {
  const loader = new GLTFLoader();
  const [pack, ...files] = await Promise.all([loadTakePack(HURT_DONOR.fighter), ...HURT_DONOR.files.map(url => loader.loadAsync(url))]);
  const rig = pack?.light?.open.rig, names = new Set(Object.values(TAKES));
  return rig ? { rig, clips: files.flatMap(file => file.animations.filter(clip => names.has(clip.name))) } : undefined;
}
let load: () => Promise<HurtDonor | undefined> = fetchDonor;

let fits = new WeakMap<THREE.Object3D, Map<string, THREE.AnimationClip | null>>();
let failed = false;
const waiting = new Map<THREE.Object3D, { clips: readonly THREE.AnimationClip[]; fighter: FighterId }>();
const report = new Map<string, { ok: boolean; reason?: string; stray?: number }>();
export const borrowReport = () => Object.fromEntries(report);

function fitAll(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], fighter: FighterId, from: HurtDonor) {
  let byKey = fits.get(scene);
  if (byKey) return byKey;
  fits.set(scene, byKey = new Map());
  const rig = rigOf(scene, findClipIn(clips, REFERENCE)), label = fighter;
  for (const [key, name] of Object.entries(TAKES)) {
    const take = from.clips.find(clip => clip.name === name);
    const result = take ? retarget(from.rig, take, rig) : { reason: `${HURT_DONOR.fighter} has no ${name}` };
    if (result.clip) clipMotionTable(result.clip);
    else if (!report.has(`${label}: ${name}`)) console.info(`Borrowed hurts: ${label} keeps its own hurt for ${name}: ${result.reason}.`);
    report.set(`${label}: ${name}`, result.clip ? { ok: true, stray: +(result.stray ?? 0).toFixed(1) } : { ok: false, reason: result.reason });
    byKey.set(key, result.clip ?? null);
  }
  return byKey;
}
function start() {
  loading ??= load().then(got => {
    donor = got;
    if (got) for (const [scene, { clips, fighter }] of waiting) fitAll(scene, clips, fighter, got);
    else failed = true;
    waiting.clear();
    return got;
  }, error => { console.info(`Borrowed hurts: unavailable (${(error as Error).message}); every body keeps its own.`); failed = true; waiting.clear(); return undefined; });
}
export function borrowedHurt(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], key: string, fighter: FighterId): THREE.AnimationClip | undefined {
  if (!(key in TAKES) || failed || OWN_ACTING.has(fighter)) return undefined;
  if (!donor) { waiting.set(scene, { clips, fighter }); start(); return undefined; }
  return fitAll(scene, clips, fighter, donor).get(key) ?? undefined;
}
export function borrowAhead(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], fighter: FighterId) {
  if (failed || OWN_ACTING.has(fighter)) return;
  if (donor) { fitAll(scene, clips, fighter, donor); return; }
  waiting.set(scene, { clips, fighter });
  start();
}
export function installBorrowedHurts(from?: () => Promise<HurtDonor | undefined>) {
  if (from) load = from;
  Fighter.borrowedHurt = borrowedHurt;
  Fighter.borrowAhead = borrowAhead;
  start();
  return loading!;
}
export function resetBorrowedHurts() {
  donor = undefined; loading = undefined; load = fetchDonor; failed = false; fits = new WeakMap(); waiting.clear(); report.clear();
  Fighter.borrowedHurt = undefined; Fighter.borrowAhead = undefined;
}
