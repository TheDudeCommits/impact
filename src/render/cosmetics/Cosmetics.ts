import * as THREE from 'three';
import type { Worn } from '../../game/economy/catalog';
import { CELESTIAL, LIVING_STAGES, ONI, SKIN, livingStage, skinMaterial, skinShared, skinUniforms, type SkinUniforms } from './skins';
import { auraShared, makeAura, type Aura } from './auras';
import { makeTrail, type Trail } from './trails';
import { makeKnockout, type Effect } from './knockouts';
import { makeKillFx, type KillFx } from './kills';
import { makeBurst } from './bursts';

const FORM_SKIN: Record<string, number> = { 'form-oni': ONI, 'form-celestial': CELESTIAL, 'form-negative': SKIN['skin-negative'] };
const LIVING_CLIMB = 1.3;
const FULL_GAP = .22;

interface Wearer {
  id: string;
  worn: Worn;
  tint: THREE.Color;
  skin: SkinUniforms;
  aura?: Aura; auraId?: string;
  trail?: Trail; trailId?: string;
  speed: number; was: THREE.Vector3;
  height: number;
  bodies: THREE.Object3D[];
  dressed: WeakSet<THREE.Material>;
  nextLook: number;
  at: THREE.Vector3; seen: boolean;
  hips: WeakMap<THREE.Object3D, THREE.Object3D | null>;
  kills: number; style: number; awake: boolean;
  stage: number; stageFrom: number; stageAt: number;
  formAura?: Aura; formAuraId?: string;
  lastKill: number; burst: number; count: number; lastFull: number;
}
const _hips = new THREE.Vector3();

export class Cosmetics {
  private readonly wearers = new Map<string, Wearer>();
  self?: string;
  constructor(readonly scene: THREE.Scene) {}
  wornBy(id: string | undefined): Worn | undefined { return id ? this.wearers.get(id)?.worn : undefined; }

  wear(id: string, worn: Worn | undefined, height = 1.75, tint = 0xbfe0ff) {
    let wearer = this.wearers.get(id);
    if (!wearer) {
      wearer = { id, worn: {}, tint: new THREE.Color(), skin: skinUniforms(), bodies: [], dressed: new WeakSet(), hips: new WeakMap(), nextLook: 0, at: new THREE.Vector3(), was: new THREE.Vector3(), speed: 0, height, seen: false,
        kills: 0, style: 0, awake: false, stage: 0, stageFrom: 0, stageAt: -99, lastKill: -99, burst: 0, count: 0, lastFull: -99 };
      this.wearers.set(id, wearer);
    }
    wearer.worn = worn ?? {}; wearer.height = height; wearer.tint.set(tint);
    this.skinOf(wearer);
    if (wearer.auraId !== wearer.worn.aura) {
      wearer.aura?.dispose();
      wearer.auraId = wearer.worn.aura; wearer.aura = wearer.auraId ? makeAura(wearer.auraId) : undefined;
      if (wearer.aura) this.scene.add(wearer.aura.root);
    }
    if (wearer.trailId !== wearer.worn.trail) {
      wearer.trail?.dispose();
      wearer.trailId = wearer.worn.trail; wearer.trail = wearer.trailId ? makeTrail(wearer.trailId, wearer.tint) : undefined;
      if (wearer.trail) this.scene.add(wearer.trail.root);
    }
    wearer.nextLook = 0;
  }
  drop(id: string) {
    const wearer = this.wearers.get(id);
    if (!wearer) return;
    wearer.skin.uCosSkin.value = 0;
    wearer.aura?.dispose(); wearer.trail?.dispose(); wearer.formAura?.dispose();
    this.wearers.delete(id);
  }
  clear() {
    for (const id of [...this.wearers.keys()]) this.drop(id);
    for (const effect of this.effects) effect.dispose(); this.effects.length = 0;
    for (const pool of this.pools.values()) pool.fx.dispose(); this.pools.clear();
  }
  get worn() { return this.wearers.size > 0 || this.effects.length > 0 || this.pools.size > 0; }

  react(id: string, state: { kills?: number; style?: number; awake?: boolean }) {
    const wearer = this.wearers.get(id);
    if (!wearer) return;
    const awake = !!state.awake, kills = state.kills ?? 0;
    if (kills < wearer.kills) { wearer.stage = wearer.stageFrom = livingStage(kills); wearer.stageAt = -99; }
    wearer.kills = kills; wearer.style = state.style ?? 0;
    if (awake !== wearer.awake) {
      wearer.awake = awake;
      if (awake && wearer.worn.form && wearer.seen) this.play(makeBurst(wearer.worn.form, wearer.at, wearer.height, this.clock));
    }
    this.skinOf(wearer);
  }
  onStage?: (id: string, stage: number) => void;

  private readonly pools = new Map<string, { fx: KillFx; used: number }>();
  eye = 0;
  killed(id: string, x: number, y: number, z: number, big: boolean): { effect: string; full: boolean } | undefined {
    const wearer = this.wearers.get(id), effect = wearer?.worn.kill;
    if (!wearer || !effect) return undefined;
    let pool = this.pools.get(effect);
    if (!pool) {
      const fx = makeKillFx(effect);
      if (!fx) return undefined;
      pool = { fx, used: this.clock }; this.pools.set(effect, pool); this.scene.add(fx.root);
    }
    const now = this.clock;
    wearer.burst = now - wearer.lastKill < .35 ? wearer.burst + 1 : 1; wearer.lastKill = now;
    const full = (big || wearer.burst === 3 || ++wearer.count % 5 === 0) && now - wearer.lastFull >= FULL_GAP;
    if (full) wearer.lastFull = now;
    pool.used = now;
    pool.fx.emit(x, y, z, full, now, this.eye);
    return { effect, full };
  }
  killEffectOf(id: string) { return this.wearers.get(id)?.worn.kill; }

  private skinOf(wearer: Wearer) {
    const form = wearer.awake ? wearer.worn.form : undefined;
    const skin = form ? FORM_SKIN[form] ?? 0 : SKIN[wearer.worn.skin ?? ''] ?? 0;
    wearer.skin.uCosSkin.value = skin;
    if (skin !== SKIN['skin-living-ink']) return;
    const stage = livingStage(wearer.kills);
    if (stage !== wearer.stage) {
      wearer.stageFrom = wearer.stage; wearer.stage = stage; wearer.stageAt = this.clock;
      if (stage > wearer.stageFrom) { if (wearer.seen) this.play(makeBurst('skin-living-ink', wearer.at, wearer.height, this.clock, stage)); this.onStage?.(wearer.id, stage); }
    }
  }
  private play(effect: Effect | undefined) { if (effect) { this.scene.add(effect.root); this.effects.push(effect); } }
  heightOf(id: string) { return this.wearers.get(id)?.height; }

  private readonly effects: Effect[] = [];
  knockout(id: string, x: number, y: number, z: number, height: number, delay = 0) {
    this.play(makeKnockout(id, new THREE.Vector3(x, y, z), height, this.clock + delay));
  }
  private clock = 0;
  where(id: string) { const wearer = this.wearers.get(id); return wearer?.seen ? wearer.at : undefined; }

  update(time: number, dt: number) {
    this.clock = time;
    skinShared.uCosTime.value = auraShared.uAuraTime.value = time % 3600;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      if (effect.update(time)) { effect.root.updateMatrixWorld(true); continue; }
      effect.dispose(); this.effects.splice(i, 1);
    }
    for (const [id, pool] of this.pools) if (time - pool.used > 30) { pool.fx.dispose(); this.pools.delete(id); }
    for (const wearer of this.wearers.values()) {
      if (time >= wearer.nextLook) { wearer.nextLook = time + .25; this.look(wearer); }
      const body = wearer.bodies.find(each => each.visible && each.parent);
      const came = !!body && !wearer.seen;
      wearer.seen = !!body;
      if (body) {
        wearer.was.copy(wearer.at);
        body.getWorldPosition(wearer.at);
        const hips = wearer.hips.get(body);
        if (hips) { hips.getWorldPosition(_hips); wearer.at.x = _hips.x; wearer.at.z = _hips.z; }
        wearer.skin.uCosOrigin.value.copy(wearer.at);
        const moved = came || dt <= 0 ? 0 : wearer.at.distanceTo(wearer.was) / dt;
        wearer.speed = moved > 80 ? 0 : wearer.speed + (moved - wearer.speed) * .5;
      }
      const live = wearer.skin.uCosLive.value;
      live.set(LIVING_STAGES[wearer.stageFrom], LIVING_STAGES[wearer.stage], Math.min(1, (time - wearer.stageAt) / LIVING_CLIMB), wearer.height);
      const formAura = wearer.awake && wearer.worn.form ? wearer.worn.form : undefined;
      if (wearer.formAuraId !== formAura) {
        wearer.formAura?.dispose();
        wearer.formAuraId = formAura; wearer.formAura = formAura ? makeAura(formAura) : undefined;
        if (wearer.formAura) this.scene.add(wearer.formAura.root);
      }
      if (wearer.formAura) { wearer.formAura.update(time, dt, wearer.at, wearer.height, wearer.seen); wearer.formAura.root.updateMatrixWorld(true); }
      if (wearer.aura) {
        wearer.aura.level?.(wearer.style / 6);
        wearer.aura.update(time, dt, wearer.at, wearer.height, wearer.seen && !wearer.formAura); wearer.aura.root.updateMatrixWorld(true);
      }
      if (wearer.trail) { wearer.trail.update(time, dt, wearer.at, wearer.height, wearer.speed, wearer.bodies, wearer.seen); wearer.trail.root.updateMatrixWorld(true); }
    }
  }

  private look(wearer: Wearer) {
    wearer.bodies = this.scene.getObjectsByProperty('name', `fighter-${wearer.id}`);
    for (const body of wearer.bodies) if (!wearer.hips.has(body)) {
      let hips: THREE.Object3D | null = null;
      body.traverse(node => { if (!hips && (node as THREE.Bone).isBone && /hips|pelvis/i.test(node.name)) hips = node; });
      wearer.hips.set(body, hips);
    }
    if (!SKIN[wearer.worn.skin ?? ''] && !wearer.worn.form) return;
    for (const body of wearer.bodies) body.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!material || wearer.dressed.has(material)) continue;
        wearer.dressed.add(material);
        skinMaterial(material, wearer.skin);
      }
    });
  }
}
