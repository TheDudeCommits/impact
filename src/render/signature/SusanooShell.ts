import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { awakeningSwapAt, moveFor, rushMove } from '../../game/awakening';
import { comboMove } from '../../game/combos';
import { MOVES } from '../../game/moves';
import type { AttackSlot, FighterId, PlayerState } from '../../game/types';
import type { Fighter } from '../Fighter';
import { setLoomTop } from '../loomRegistry';
import { GhostShell, type GhostPrint } from './GhostShell';
import { SIGNATURE } from './context';
import type { ElectricKit } from './ElectricKit';
import type { BoltStyle } from './Lightning';
import { SPARK } from './GlowBatch';

export const SUSANOO_ASSET = '/assets/fighters/susanoo-loom1.glb';
export const SUSANOO_USERS: readonly FighterId[] = ['sasuke', 'kakashi', 'madara'];
interface Look { body: THREE.Color; rim: number; ink: number; opacity: number; print: GhostPrint;
  wings: number; lightning: boolean;
  height: number }
const CREST = [[/hair/i, 3.2]] as const;
export const SUSANOO_LOOKS: Partial<Record<FighterId, Look>> = {
  sasuke: { body: new THREE.Color(.62, .14, 1.3), rim: 0xd8b0ff, ink: 0x0b0418, opacity: .8, wings: .4, lightning: false, height: 4.4,
    print: { shade: new THREE.Color(.035, .01, .1), light: new THREE.Color(1.3, .98, 2.35), line: 0x0e0420, levels: [.06, .78], flow: 1.1, loom: true, base: 0xffffff, bases: CREST } },
  kakashi: { body: new THREE.Color(.07, .44, 1.45), rim: 0xa8ecff, ink: 0x020b1a, opacity: .8, wings: 0, lightning: true, height: 4.2,
    print: { shade: new THREE.Color(.008, .035, .1), light: new THREE.Color(.82, 1.7, 2.4), line: 0x03101f, levels: [.06, .78], flow: .7, loom: true, base: 0xffffff, bases: CREST } },
  madara: { body: new THREE.Color(.1, .26, 1.6), rim: 0x9ccfff, ink: 0x020818, opacity: .82, wings: .4, lightning: false, height: 4.9,
    print: { shade: new THREE.Color(.01, .02, .12), light: new THREE.Color(.95, 1.45, 2.6), line: 0x020a22, levels: [.06, .8], flow: .9, loom: true, base: 0xffffff, bases: CREST } },
};
export const SUSANOO = { rise: .55, fall: .8, keepUser: .3, keepTarget: .14, near: 1.2, far: 2.6, back: .95, side: 1.25, strikeBack: .35, strikeSide: .9,
  turn: 5, follow: 8, surgeIn: 10, surgeOut: 3, emergeScale: .9, frame: .64, frameMost: 3.1 } as const;
const TAKES = { idle: 'Susanoo idle', rise: 'Susanoo rise', strike: 'Susanoo strike', strikeL: 'Susanoo strike L', guard: 'Susanoo guard', cast: 'Susanoo cast', bow: 'Susanoo bow' } as const;
const CONTACT: Record<string, number> = { [TAKES.strike]: .3 * 1.2, [TAKES.strikeL]: .3 * 1.2, [TAKES.cast]: .35 * 1.5 };
const BOW_RELEASE = .6667;
const JOINT = { hips: 'WAIST_04', chest: 'SPINE3_07', head: 'HEAD_09', armL: 'SHOULDER_L_033', armR: 'SHOULDER_R_055', foreL: 'ELBOW_L_034', foreR: 'ELBOW_R_056',
  handL: 'WRIST_L_036', handR: 'WRIST_R_058', wingL: 'OPTION_02_L_075', wingR: 'OPTION_02_R_080' } as const;
const ARCS: readonly (readonly [keyof typeof JOINT, keyof typeof JOINT])[] = [['armR', 'foreR'], ['foreR', 'handR'], ['armL', 'foreL'], ['foreL', 'handL'], ['hips', 'chest'], ['chest', 'head']];
const BOLT = new THREE.Color(.55, 1.05, 2.6);
const RAIKIRI: BoltStyle = { width: .05, color: BOLT, intensity: 1, levels: 3, jag: .36, branches: 1, branchLength: .7, taper: .3, core: .17 };
const WING_ROOTS = [JOINT.wingL, JOINT.wingR] as const;
const SIDE_SWITCH = .9, SIDE_RATE = 1.6;
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

type Loom = { root: THREE.Group; model: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; current?: THREE.AnimationAction;
  shell: GhostShell; look: Look; joints: Map<string, THREE.Object3D>; low: THREE.Object3D; high: THREE.Object3D;
  presence: number; shownAt: number; bearing: number; height: number; surge: number; placed: boolean; drawn: boolean;
  sideSign: number; sideNow: number; drawnBefore: boolean;
  moveKey: number; contact: number;
  plan: { name: string; time: number; laid: boolean; strike: boolean } };

export class SusanooLooms {
  private source?: GLTF;
  private loading?: Promise<void>;
  private looms = new Map<string, Loom>();
  constructor(private scene: THREE.Scene) { if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __susanoo?: SusanooLooms }).__susanoo = this; }
  load(fighters: Iterable<string>) {
    const users = [...new Set(fighters)].filter(id => SUSANOO_USERS.includes(id as FighterId)) as FighterId[];
    if (!users.length) return Promise.resolve();
    const loading = this.loading ??= new GLTFLoader().loadAsync(SUSANOO_ASSET).then(gltf => { this.source = gltf; })
      .catch(error => { this.loading = undefined; console.warn('The Susanoo did not load; it is drawn without it', error); });
    return loading.then(() => { for (const user of users) if (!this.spares.has(user)) { const look = SUSANOO_LOOKS[user], loom = look && this.build(look); if (loom) this.spares.set(user, loom); } });
  }
  private spares = new Map<FighterId, Loom>();
  get loaded() { return !!this.source; }
  private build(look: Look): Loom | undefined {
    const source = this.source;
    if (!source) return undefined;
    const root = new THREE.Group(), model = clone(source.scene), joints = new Map<string, THREE.Object3D>();
    root.name = 'susanoo'; root.add(model); root.visible = false; this.scene.add(root);
    const wanted = new Set<string>(Object.values(JOINT));
    model.traverse(o => {
      if (wanted.has(o.name)) joints.set(o.name, o);
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (!look.wings && materials.some(m => /wing/i.test(m.name))) mesh.visible = false;
    });
    const mixer = new THREE.AnimationMixer(model), actions = new Map<string, THREE.AnimationAction>();
    for (const clip of source.animations) {
      const action = mixer.clipAction(clip);
      if (clip.name !== TAKES.idle) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
      actions.set(clip.name, action);
    }
    const shell = new GhostShell(model, look.body, look.rim, look.opacity, look.ink, 2.2, false, look.print);
    shell.enabled = true;
    shell.depth.userData.ink = true;
    const low = joints.get(JOINT.hips) ?? root, high = joints.get(JOINT.head) ?? root;
    shell.fadeNear(low, SUSANOO.near, SUSANOO.far); shell.fadeRange(SUSANOO.near, SUSANOO.far, high);
    return { root, model, mixer, actions, shell, look, joints, low, high, presence: 0, shownAt: -1, bearing: 0, height: 0, surge: 0, placed: false, drawn: false, sideSign: 1, sideNow: SUSANOO.side, drawnBefore: false,
      moveKey: NaN, contact: 0, plan: { name: TAKES.idle, time: 0, laid: false, strike: false } };
  }
  private take(loom: Loom, s: PlayerState) {
    const plan = loom.plan, elapsed = s.actionTime * s.actionDuration;
    plan.laid = false; plan.strike = false; plan.time = 0;
    if (s.action === 'awaken') { plan.name = TAKES.rise; plan.time = Math.max(0, elapsed - awakeningSwapAt(s.fighter)); plan.laid = true; return plan; }
    if (s.action === 'ultimate' && s.fighter === 'sasuke') { plan.name = TAKES.bow; plan.time = bowTime(elapsed); plan.laid = plan.strike = true; return plan; }
    const finisher = s.action === 'light' && (s.chain ?? 0) >= 3;
    if (s.action === 'heavy' || s.action === 'special' || s.action === 'ultimate' || finisher) {
      if (s.actionStarted !== loom.moveKey) {
        loom.moveKey = s.actionStarted;
        const ender = s.branch ? comboMove(s.fighter, s.branch, !!s.awakened) : undefined;
        const move = ender ?? (s.action === 'light' ? rushMove(s.fighter, s.chain ?? 0, !!s.awakened) : moveFor(s.fighter, s.action as AttackSlot, !!s.awakened));
        loom.contact = move.contacts[0] ?? s.actionDuration * .4;
      }
      plan.name = s.action === 'special' && !s.branch ? TAKES.cast : ((s.actionSeq ?? 0) & 1) ? TAKES.strikeL : TAKES.strike;
      plan.time = elapsed - loom.contact + CONTACT[plan.name]; plan.laid = plan.strike = true;
      return plan;
    }
    plan.name = s.action === 'guard' ? TAKES.guard : TAKES.idle;
    return plan;
  }
  update(time: number, dt: number, fighters: ReadonlyMap<string, Fighter>, kit?: ElectricKit) {
    const local = SIGNATURE.localId === undefined ? undefined : fighters.get(SIGNATURE.localId);
    for (const [id, loom] of this.looms) if (!fighters.has(id)) { this.drop(loom); this.looms.delete(id); setLoomTop(id, 0); }
    for (const [id, f] of fighters) {
      const s = f.state, look = SUSANOO_LOOKS[s.fighter];
      if (!look) continue;
      const elapsed = s.actionTime * s.actionDuration, arrow = s.fighter === 'sasuke' && s.action === 'ultimate' && !s.awakened;
      const out = s.alive && (!!s.awakened || s.action === 'awaken' || arrow) && !id.startsWith('warm-');
      let loom = this.looms.get(id);
      if (!out && (!loom || loom.presence <= 0)) { if (loom?.drawn) { loom.root.visible = false; loom.drawn = false; setLoomTop(id, 0); } continue; }
      if (!loom) { loom = this.spares.get(s.fighter) ?? this.build(look); this.spares.delete(s.fighter); if (!loom) continue; this.looms.set(id, loom); }
      if (out) {
        if (loom.shownAt < 0) loom.shownAt = time - (s.action === 'awaken' ? Math.max(0, elapsed - awakeningSwapAt(s.fighter)) : arrow ? elapsed : SUSANOO.rise);
        const rise = THREE.MathUtils.smoothstep(time - loom.shownAt, 0, arrow ? .35 : SUSANOO.rise);
        const fall = arrow ? 1 - THREE.MathUtils.smoothstep(elapsed, s.actionDuration - .5, s.actionDuration)
          : s.action === 'awaken' ? 1 : THREE.MathUtils.clamp(((s.awakenedUntil ?? time + 99) - time) / SUSANOO.fall, 0, 1);
        loom.presence = Math.min(rise, fall);
      } else { loom.presence = Math.max(0, loom.presence - dt / SUSANOO.fall); loom.shownAt = -1; }
      const shown = loom.presence > .002;
      loom.root.visible = shown; loom.drawn = shown;
      if (!shown) { loom.placed = false; loom.drawnBefore = false; setLoomTop(id, 0); continue; }
      const take = this.take(loom, s);
      const action = loom.actions.get(take.name);
      if (action && action !== loom.current) {
        action.reset(); action.enabled = true; action.setEffectiveWeight(1); action.play();
        if (loom.current) action.crossFadeFrom(loom.current, loom.current.getClip().name === TAKES.rise ? .4 : .22, false);
        loom.current = action;
      }
      const still = s.hitstop || s.timeStopped;
      if (action && take.laid) { action.timeScale = 0; action.time = THREE.MathUtils.clamp(take.time, 0, action.getClip().duration - 1e-3); }
      else if (action) action.timeScale = 1;
      loom.mixer.update(still ? 0 : dt);
      for (const name of WING_ROOTS) loom.joints.get(name)?.scale.setScalar(look.wings || 1);
      const surgeWant = take.strike ? 1 : 0;
      loom.surge += (surgeWant - loom.surge) * (1 - Math.exp(-dt * (surgeWant > loom.surge ? SUSANOO.surgeIn : SUSANOO.surgeOut)));
      const p = f.group.position;
      if (!loom.placed) { loom.bearing = s.yaw; loom.height = p.y; loom.placed = true; }
      loom.bearing += wrap(s.yaw - loom.bearing) * (1 - Math.exp(-dt * SUSANOO.turn));
      loom.height += (p.y - loom.height) * (1 - Math.exp(-dt * SUSANOO.follow));
      const k = loom.presence, u = loom.surge;
      const fx = Math.sin(loom.bearing), fz = Math.cos(loom.bearing);
      const eye = f.cameraPoint;
      if (eye) { const lateral = (eye.x - p.x) * fz - (eye.z - p.z) * fx; if (lateral > SIDE_SWITCH) loom.sideSign = -1; else if (lateral < -SIDE_SWITCH) loom.sideSign = 1; }
      const sideWant = loom.sideSign * THREE.MathUtils.lerp(SUSANOO.side, SUSANOO.strikeSide, u);
      if (!loom.drawnBefore) loom.sideNow = sideWant; else loom.sideNow += (sideWant - loom.sideNow) * (1 - Math.exp(-dt * SIDE_RATE));
      loom.drawnBefore = true;
      const back = THREE.MathUtils.lerp(SUSANOO.back, SUSANOO.strikeBack, u), side = loom.sideNow;
      const x = p.x - fx * back + fz * side, z = p.z - fz * back - fx * side;
      const foe = s.target ? fighters.get(s.target) : undefined;
      let yaw = loom.bearing;
      if (foe?.state.alive && u > .001) yaw += wrap(Math.atan2(foe.group.position.x - x, foe.group.position.z - z) - loom.bearing) * u;
      loom.root.position.set(x, loom.height, z);
      loom.root.rotation.set(0, yaw, 0);
      const ease = k * k * (3 - 2 * k);
      loom.root.scale.setScalar(look.height * THREE.MathUtils.lerp(SUSANOO.emergeScale, 1, ease));
      loom.root.updateMatrixWorld(true);
      const shell = loom.shell;
      shell.opacity = look.opacity; shell.clock = time; shell.dissolve = 1 - k;
      shell.setWindow(0, f, SUSANOO.keepUser);
      shell.setWindow(1, foe?.state.alive ? foe : undefined, SUSANOO.keepTarget);
      const theirs = local && local !== f && local.state.target ? fighters.get(local.state.target) : undefined;
      shell.setWindow(2, theirs && theirs !== foe && theirs !== f && theirs.state.alive ? theirs : undefined, SUSANOO.keepTarget);
      setLoomTop(id, Math.min(look.height * SUSANOO.frame, SUSANOO.frameMost) * k);
      if (kit && look.lightning && k > .3) {
        const power = k * Math.max(.5, kit.density);
        for (let i = 0; i < ARCS.length; i++) {
          if (((kit.tick + i * 7) % 5) > 3) continue;
          const from = loom.joints.get(JOINT[ARCS[i][0]]), to = loom.joints.get(JOINT[ARCS[i][1]]);
          if (!from || !to) continue;
          from.getWorldPosition(_a); to.getWorldPosition(_b);
          kit.arc(_a, _b, kit.tick * 11 + i * 17, .07 * power, BOLT, .95 * power, 1, 3, .34);
        }
        const hand = loom.joints.get(JOINT.handR);
        if (hand) {
          hand.getWorldPosition(_a);
          kit.glows.add(_a, .9 * power, BOLT, 1, SPARK, .36, kit.tick % 97);
          kit.painter.burst(_a, 1.2 * power, Math.max(4, Math.round(9 * kit.density)), kit.tick, 7, RAIKIRI);
        }
      }
    }
  }
  hand(f: Fighter, side: 'L' | 'R', out: THREE.Vector3) {
    const loom = this.looms.get(f.state.id);
    if (!loom?.drawn) return false;
    const joint = loom.joints.get(side === 'L' ? JOINT.handL : JOINT.handR);
    if (!joint) return false;
    joint.getWorldPosition(out);
    return true;
  }
  presenceOf(f: Fighter) { return this.looms.get(f.state.id)?.presence ?? 0; }
  heightOf(f: Fighter) { const loom = this.looms.get(f.state.id); return loom ? loom.look.height : 0; }
  loomOf(f: Fighter) { const loom = this.looms.get(f.state.id); return loom ? { root: loom.root, take: loom.current?.getClip().name, time: loom.current?.time, presence: loom.presence, shell: loom.shell } : undefined; }
  private drop(loom: Loom) { loom.shell.dispose(); loom.mixer.stopAllAction(); loom.mixer.uncacheRoot(loom.model); loom.root.removeFromParent(); }
  reset() { for (const [id, loom] of this.looms) { this.drop(loom); setLoomTop(id, 0); } this.looms.clear(); }
  dispose() { this.reset(); for (const loom of this.spares.values()) this.drop(loom); this.spares.clear(); }
}

export function bowTime(elapsed: number) {
  const move = MOVES.sasuke.ultimate, L = 4.5, c0 = move.contacts[0];
  const from = Math.max(0, BOW_RELEASE - 1.4 * c0 / L);
  const u = elapsed <= c0 ? from + (BOW_RELEASE - from) * Math.max(0, elapsed) / c0 : BOW_RELEASE + (1 - BOW_RELEASE) * Math.min(1, (elapsed - c0) / Math.max(.1, move.duration - c0));
  return Math.min(L - 1e-3, u * L);
}
