import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { CombatEvent } from '../../game/types';
import { YUTA_MOVES } from '../../game/fighters/yuta';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import type { VfxKit } from '../vfx/VfxKit';
import { bodyCentre } from '../vfx/VfxKit';
import { armoryDraws } from '../vfx/armory/drawn';
import { SIGNATURE, involvesLocal } from './context';
import { RING } from './GlowBatch';
import { MoveStage, STAGE, stageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const YUTA_RIKA_ASSETS = Object.freeze(['/assets/fighters/yuta-rika1.glb']);
export const YUTA_RIKA_LIMITS = Object.freeze({ manifestations: 4, beams: 24, rings: 96, confirmations: 16, cuts: 12, words: 6 });
export const YUTA_RIKA_BEATS = Object.freeze({ ring: .162, vow: .324, manifest: .504, confirm: .576, charge: 1.44, beam: 2.592, end: 3.2 });
export const isYutaRika = (id: string | undefined) => id === 'yuta';
const PACT_TAIL_END = 1.42;
const PACT_PRESENTATION_ACTIONS = new Set(['awaken', 'idle', 'run', 'guard']);
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1);
const PURPLE = new THREE.Color(0x735aa6), PALE = new THREE.Color(0xf4e9ff), INK = new THREE.Color(0x241b40), PINK = new THREE.Color(0xe7a4cf);
const LOVE_PINK = new THREE.Color(2.1, .72, 1.5), LOVE_WHITE = new THREE.Color(2.7, 2.5, 2.7);
const CURSED = stageLook(0xf5f4ff, 0x7a6cf0, 0x0e0b22), LOVE = stageLook(0xfff4fb, 0xff7ac8, 0x5446c8), RIKA = STAGE.dark;
const HEAVY = YUTA_MOVES.heavy, SPECIAL = YUTA_MOVES.special, ULT = YUTA_MOVES.ultimate;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
class PactBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tint: THREE.InstancedBufferAttribute;
  private object = new THREE.Object3D(); private count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, capacity: number) {
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('pactTint', this.tint);
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      vertexShader: 'attribute vec4 pactTint;varying vec4 vTint;void main(){vTint=pactTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec4 vTint;void main(){if(vTint.a<.004)discard;gl_FragColor=vTint;}' });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity); this.mesh.name = `yuta-${name}`;
    this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.scale.setScalar(0); this.object.updateMatrix(); this.mesh.setMatrixAt(0, this.object.matrix); this.mesh.count = 1; scene.add(this.mesh);
  }
  begin() { this.count = 0; }
  add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, tint: THREE.Color, alpha: number) {
    if (this.count >= this.mesh.instanceMatrix.count || alpha < .004 || Math.min(x, y, z) <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, z); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.object.matrix); this.tint.setXYZW(this.count++, tint.r, tint.g, tint.b, clamp(alpha));
  }
  end() { this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; this.tint.needsUpdate = true; }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
type Confirmation = { actor: string; target: string; seq: number; final: boolean; end: THREE.Vector3 };
type Cut = { p: THREE.Vector3; yaw: number; roll: number; born: number; life: number; size: number; live: boolean };
type Word = { p: THREE.Vector3; born: number; live: boolean };
type Manifestation = { root: THREE.Group; model: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>;
  active?: THREE.AnimationAction; materials: THREE.MeshToonMaterial[]; presence: { value: number }; actor: string; used: boolean; head?: THREE.Object3D;
  warm: { done: boolean } };

export class YutaRika {
  private readonly stage: MoveStage;
  private cuts: Cut[] = Array.from({ length: YUTA_RIKA_LIMITS.cuts }, () => ({ p: new THREE.Vector3(), yaw: 0, roll: 0, born: -1e9, life: 0, size: 0, live: false }));
  private words: Word[] = Array.from({ length: YUTA_RIKA_LIMITS.words }, () => ({ p: new THREE.Vector3(), born: -1e9, live: false }));
  private cutCursor = 0; private wordCursor = 0;
  private c = new THREE.Vector3(); private side = new THREE.Vector3(); private ground = new THREE.Vector3(); private heading = new THREE.Vector3(); private tip = new THREE.Vector3();
  private source?: GLTF; private loading?: Promise<void>; private disposed = false;
  private manifestations: Manifestation[] = [];
  private confirmations: Confirmation[] = Array.from({ length: YUTA_RIKA_LIMITS.confirmations }, () => ({ actor: '', target: '', seq: -1, final: false, end: new THREE.Vector3() }));
  private pacts = Array.from({length:YUTA_RIKA_LIMITS.manifestations},()=>({actor:'',seq:-1,start:0}));
  private pactCursor = 0;
  private cursor = 0; private seen = new Float64Array(64).fill(-1); private seenAt = new Float64Array(64).fill(-1); private seenCursor = 0;
  private beams: PactBatch; private rings: PactBatch;
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private p = new THREE.Vector3(); private dir = new THREE.Vector3(); private q = new THREE.Quaternion();
  constructor(private scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.beams = new PactBatch(scene, 'pure-love-beams', new THREE.CylinderGeometry(.7, 1, 1, 16, 1, true), YUTA_RIKA_LIMITS.beams);
    this.rings = new PactBatch(scene, 'ring-vow-and-speech', new THREE.RingGeometry(.89, 1, 32), YUTA_RIKA_LIMITS.rings);
    this.beams.mesh.renderOrder = 6; this.rings.mesh.renderOrder = 6;
    this.stage = MoveStage.for(scene, kit);
  }
  load(ids: readonly string[]): Promise<void> {
    if (this.disposed || !ids.some(isYutaRika)) return Promise.resolve();
    return this.loading ??= new GLTFLoader().loadAsync(YUTA_RIKA_ASSETS[0]).then(gltf => {
      if (this.disposed) { this.disposeSource(gltf); return; }
      this.source = gltf;
      for (let i = 0; i < YUTA_RIKA_LIMITS.manifestations; i++) {
        const root = new THREE.Group(), model = clone(gltf.scene), presence = { value: 0 }, materials: THREE.MeshToonMaterial[] = [], warm = { done: true };
        model.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = false; object.receiveShadow = false;
          object.frustumCulled = false;
          if (warm.done) { warm.done = false; object.onAfterRender = () => { warm.done = true; }; }
          const convert = (m: THREE.Material) => {
            const old = m as THREE.MeshStandardMaterial;
            const result = new THREE.MeshToonMaterial({ map: old.map, color: 0xb8a8d3, side: THREE.FrontSide, depthWrite: true });
            result.onBeforeCompile = shader => {
              shader.uniforms.pactPresence = presence;
              shader.fragmentShader = 'uniform float pactPresence;\n' + shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nfloat pactDither=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);if(pactDither>pactPresence)discard;');
            };
            result.customProgramCacheKey = () => 'yuta-rika-dither-v1'; materials.push(result); return result;
          };
          object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
        });
        root.name = 'yuta-rika-manual-manifestation'; root.visible = !warm.done; root.userData.warming = !warm.done; root.add(model); this.scene.add(root);
        const mixer = new THREE.AnimationMixer(model), actions = new Map<string, THREE.AnimationAction>();
        for (const clip of gltf.animations) { const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; actions.set(clip.name, action); }
        this.manifestations.push({ root, model, mixer, actions, materials, presence, actor: '', used: false, head: model.getObjectByName('RikaJaw'), warm });
      }
    }).catch(error => { this.loading = undefined; throw error; });
  }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isYutaRika(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'confirm' && event.kind !== 'hit') return;
    const ultimate = event.slot === 'ultimate' && !event.branch;
    if (event.kind === 'confirm' && !ultimate) return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenAt[i] === event.serverTime) return;
    const seen = this.seenCursor++ % this.seen.length; this.seen[seen] = event.id; this.seenAt[seen] = event.serverTime;
    const actor = fighters?.get(event.actorId), seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    const target = event.targetId ? fighters?.get(event.targetId) : undefined;
    if (ultimate && event.kind === 'confirm' && event.targetId) Object.assign(this.confirmations[this.cursor++ % this.confirmations.length], { actor: event.actorId, target: event.targetId, seq, final: false });
    if (ultimate && event.kind === 'hit' && event.contactIndex === 2) {
      for (const receipt of this.confirmations) if (receipt.actor === event.actorId && receipt.seq === seq) {
        if (target) bodyCentre(target, receipt.end); else if (event.endpoint) receipt.end.set(event.endpoint.x, event.endpoint.y, event.endpoint.z); else continue;
        receipt.final = true;
        if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.5, receipt.end);
      }
    }
    if (event.kind === 'hit' && !armoryDraws(event.fighter, event.slot, event.branch, event.actorId)) this.land(event, actor, target);
  }
  private land(e: CombatEvent, actor: Fighter | undefined, target: Fighter | undefined) {
    if (!target && !e.endpoint) return;
    const st = this.stage, t = e.serverTime, point = this.p, dir = this.dir, yaw = actor?.state.yaw ?? 0;
    if (target) bodyCentre(target, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    const floor = blowFloor(actor, target, point.y - 1.05), ground = this.ground.set(point.x, floor, point.z);
    if (actor) dir.subVectors(point, actor.group.position).setY(0);
    if (!actor || dir.lengthSq() < .01) dir.set(Math.sin(yaw), 0, Math.cos(yaw));
    dir.normalize();
    if (e.slot === 'light') { this.cut(point, yaw, .5 + hash(e.id) * .8, t, .2, .9); st.burst(point, CURSED, .38, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      this.cut(point, yaw, .55, t, .34, 2.5 * big); this.cut(point, yaw, -.75, t + .04, .34, 2.2 * big);
      st.burst(point, CURSED, 1.05 * big, t, { dir, floor, clean: true });
      st.shock(ground, CURSED, 4 * big, t, .42);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, CURSED, 2, t, { floor }); st.shock(ground, CURSED, 4.4, t, .45); st.scar(ground, CURSED, 2.2, t + .05, 2); return; }
      const big = e.branch ? .7 : 1, word = this.words[this.wordCursor++ % this.words.length];
      word.p.copy(point); word.born = t; word.live = true;
      st.burst(point, CURSED, 1.8 * big, t, { dir, floor });
      st.dome(point, CURSED, 3.2 * big, t, .55);
      st.shock(ground, CURSED, 5.6 * big, t, .5);
      st.scar(ground, CURSED, 2 * big, t + .05, 2.2);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (e.contactIndex !== 2) {
      this.cut(point, yaw, e.contactIndex ? -.7 : .6, t, .34, 2.4);
      st.burst(point, CURSED, e.contactIndex ? 1.25 : 1, t, { dir, floor, clean: true });
      if (e.contactIndex) st.shock(ground, CURSED, 4.4, t, .42);
      return;
    }
    st.burst(point, LOVE, 2.5, t, { dir, floor });
    st.dome(point, LOVE, 4.4, t, .5);
    st.shock(ground, LOVE, 9, t, .6);
    st.erupt(ground, UP, LOVE, 1.05, 9, t + .1, .6);
    st.scar(ground, LOVE, 3, t + .2, 2.1);
    st.scar(this.c.copy(ground).addScaledVector(dir, 3.4), LOVE, 1.8, t + .25, 1.7);
  }
  private cut(p: THREE.Vector3, yaw: number, roll: number, born: number, life: number, size: number) {
    const cut = this.cuts[this.cutCursor++ % this.cuts.length];
    cut.p.copy(p); cut.yaw = yaw; cut.roll = roll; cut.born = born; cut.life = life; cut.size = size; cut.live = true;
  }
  private arc(p: THREE.Vector3, yaw: number, roll: number, size: number, open: number, fade: number) {
    const st = this.stage, cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll), parts = 7;
    for (let i = 0; i < parts; i++) {
      const u0 = i / parts, u1 = (i + 1) / parts; if (u0 >= open) break;
      const x0 = (u0 * 2 - 1) * size, x1 = (Math.min(u1, open) * 2 - 1) * size, b0 = (1 - (u0 * 2 - 1) ** 2) * size * .22, b1 = (1 - (Math.min(u1, open) * 2 - 1) ** 2) * size * .22;
      this.a.set(p.x + cy * (x0 * cr - b0 * sr), p.y + x0 * sr + b0 * cr, p.z - sy * (x0 * cr - b0 * sr));
      this.b.set(p.x + cy * (x1 * cr - b1 * sr), p.y + x1 * sr + b1 * cr, p.z - sy * (x1 * cr - b1 * sr));
      const thick = Math.sin(Math.PI * (u0 + u1) * .5);
      st.streak(this.a, this.b, size * .075 * thick + .02, CURSED.main, .9 * fade); st.streak(this.a, this.b, size * .022 * thick + .008, CURSED.core, 1.3 * fade);
    }
  }
  private cancel(id: string, targetToo = false) {
    for (const pact of this.pacts) if (pact.actor === id) pact.actor = '';
    for (const receipt of this.confirmations) if (receipt.actor === id || targetToo && receipt.target === id && !receipt.final) receipt.actor = '';
    for (const m of this.manifestations) if (m.actor === id) { m.root.visible = false; m.actor = ''; }
  }
  private manifestation(f: Fighter, clip: string, localTime: number, opacity: number, scale: number): Manifestation | undefined {
    let m = this.manifestations.find(x => x.actor === f.state.id);
    if (!m) m = this.manifestations.find(x => !x.used && !x.actor) ?? this.manifestations.find(x => !x.used);
    if (!m) return;
    m.used = true; m.actor = f.state.id; m.root.visible = opacity > .015; m.root.userData.warming = false; m.presence.value = opacity;
    const yaw = f.group.rotation.y;
    m.root.position.copy(f.group.position); m.root.position.x += Math.cos(yaw) * .68 - Math.sin(yaw) * .95;
    m.root.position.z -= Math.sin(yaw) * .68 + Math.cos(yaw) * .95; m.root.position.y += 1.9;
    m.root.rotation.y = yaw; m.root.scale.setScalar(scale);
    const action = m.actions.get(clip);
    if (action) {
      if (m.active !== action) { m.active?.stop(); action.reset().play(); m.active = action; }
      action.time = Math.max(0, Math.min(localTime, action.getClip().duration - .001)); m.mixer.update(0);
    }
    m.root.updateMatrixWorld(true); return m;
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    this.beams.begin(); this.rings.begin(); for (const m of this.manifestations) m.used = false;
    const detail = this.kit.budget >= .65, st = this.stage.open(time);
    for (const pact of this.pacts) {
      const state = fighters.get(pact.actor)?.state;
      if (!state?.alive || !state.awakened || time-pact.start > PACT_TAIL_END || (state.actionSeq??-1)!==pact.seq || !PACT_PRESENTATION_ACTIONS.has(state.action)) pact.actor='';
    }
    for (const f of fighters.values()) {
      const s = f.state; if (!isYutaRika(s.fighter) || !s.alive) continue;
      const elapsed = s.actionTime * s.actionDuration;
      let pact = this.pacts.find(p=>p.actor===s.id);
      if (s.action === 'awaken') {
        if (!pact) { pact=this.pacts[this.pactCursor++%this.pacts.length];pact.actor=s.id;pact.seq=s.actionSeq??-1;pact.start=time-elapsed; }
        const ring = clamp(elapsed / YUTA_RIKA_BEATS.vow), alpha = Math.sin(clamp(elapsed / .9) * Math.PI);
        this.q.setFromUnitVectors(FRONT, UP); this.rings.add(f.handL, this.q, .055 + .09 * ring, .055 + .09 * ring, 1, PALE, alpha);
      }
      if (pact && PACT_PRESENTATION_ACTIONS.has(s.action)) {
        const age=time-pact.start, appear=clamp((age-.36)/.25), fade=clamp((PACT_TAIL_END-age)/.35);
        if (appear>0 && fade>0) this.manifestation(f,'Rika Manifest',clamp((age-.36)/.84)*1.6,appear*fade,.82+.13*appear);
      } else if (s.awakened && (s.action === 'heavy' || s.action === 'special') && !s.branch) {
        const alpha = Math.sin(clamp(s.actionTime) * Math.PI) * .72;
        this.manifestation(f, 'Rika Command', clamp(s.actionTime), alpha, .82);
      }
      if (s.action === 'special' && !s.branch && elapsed < .56) {
        this.q.setFromAxisAngle(UP, s.yaw); const grow = clamp(elapsed / .55);
        for (let i = 0; i < (detail ? 3 : 1); i++) this.rings.add(f.handL, this.q, .10 + grow * .25 + i * .035, .10 + grow * .25 + i * .035, 1, i % 2 ? INK : PALE, .8 * grow);
      }
      if (s.awakened && s.action !== 'awaken') {
        this.q.setFromAxisAngle(UP, time); this.rings.add(f.handL, this.q, .05, .05, 1, PINK, .55);
      }
      if (s.whiffedAt === undefined && (s.action === 'light' || s.action === 'heavy' || s.action === 'special' || s.action === 'ultimate') && !armoryDraws('yuta', s.action, s.branch, s.id)) this.windup(f, elapsed);
    }
    for (const flight of flights.values()) {
      if (!isYutaRika(flight.fighter) || flight.slot !== 'special' || flight.branch || !flight.released) continue;
      this.q.setFromUnitVectors(FRONT, flight.heading);
      for (let i = 0; i < (detail ? 4 : 2); i++) {
        this.p.copy(flight.position).addScaledVector(flight.heading, -i * .28);
        const radius = .32 + i * .13; this.rings.add(this.p, this.q, radius, radius, 1, i % 2 ? INK : PALE, 1 - i * .17);
      }
      if (armoryDraws('yuta', 'special', undefined, flight.actorId)) continue;
      st.glow(flight.position, 1.25, CURSED.main, .75); st.glow(flight.position, .45, CURSED.core, 1);
      for (let i = 0; i < 4; i++) {
        this.p.copy(flight.position).addScaledVector(flight.heading, -i * .9);
        st.glow(this.p, 1.1 + i * .5, i % 2 ? CURSED.main : CURSED.core, .9 - i * .17, RING, .05, 0, .86);
      }
      st.light(this.p.copy(flight.position).setY(flight.position.y + .2), 7.5, CURSED, .7);
    }
    for (const word of this.words) {
      if (!word.live) continue;
      const age = time - word.born;
      if (age >= .6) { word.live = false; continue; }
      if (age < 0) continue;
      for (let i = 0; i < 3; i++) { const u = (age - i * .08) / .44; if (u > 0 && u < 1) st.glow(word.p, .5 + 3.4 * u, i === 1 ? CURSED.main : CURSED.core, 1.1 * (1 - u), RING, .04, 0, .9); }
      st.light(word.p, 7.5, CURSED, .5 * (1 - age / .6));
    }
    for (const cut of this.cuts) {
      if (!cut.live) continue;
      const age = time - cut.born;
      if (age >= cut.life) { cut.live = false; continue; }
      if (age < 0) continue;
      const w = age / cut.life;
      this.arc(cut.p, cut.yaw, cut.roll, cut.size, Math.min(1, age / .05), w < .4 ? 1 : 1 - (w - .4) / .6);
      st.light(cut.p, 1.6 + cut.size, CURSED, .3 * (1 - w));
    }
    for (const receipt of this.confirmations) {
      if (!receipt.actor) continue;
      const actor = fighters.get(receipt.actor), victim = fighters.get(receipt.target), s = actor?.state;
      if (!actor || !s?.alive || (!victim?.state.alive && !receipt.final) || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== receipt.seq || s.whiffedAt !== undefined) { receipt.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      const alpha = clamp((elapsed - .72) / .4) * clamp((3.2 - elapsed) / .25);
      const m = this.manifestation(actor, 'Rika Pure Love', elapsed, alpha, .92);
      const staged = !armoryDraws('yuta', 'ultimate', undefined, receipt.actor);
      if (staged && elapsed < YUTA_RIKA_BEATS.beam) this.gather(actor, receipt, elapsed);
      if (elapsed < YUTA_RIKA_BEATS.charge) continue;
      this.a.copy(actor.handL);
      if (victim?.state.alive) bodyCentre(victim, this.b); else this.b.copy(receipt.end);
      const charge = clamp((elapsed - YUTA_RIKA_BEATS.charge) / (YUTA_RIKA_BEATS.beam - YUTA_RIKA_BEATS.charge));
      this.dir.subVectors(this.b, this.a).normalize(); this.q.setFromUnitVectors(FRONT, this.dir);
      for (let i = 0; i < (detail ? 3 : 1); i++) this.rings.add(this.a, this.q, .1 + charge * .3 + i * .07, .1 + charge * .3 + i * .07, 1, i % 2 ? PURPLE : PALE, charge);
      if (elapsed < YUTA_RIKA_BEATS.beam || elapsed > 3.06) continue;
      const fade = clamp((3.06 - elapsed) / .15);
      if (staged) { st.beam(this.a, this.b, .5, LOVE, clamp((elapsed - YUTA_RIKA_BEATS.beam) / (3.06 - YUTA_RIKA_BEATS.beam)), receipt.seq + 1, 1); st.speed(.5 * fade, receipt.actor, receipt.target); }
      this.drawBeam(this.a, this.b, .23, fade);
      if (m?.head) { m.head.getWorldPosition(this.a); this.drawBeam(this.a, this.b, .36, fade); }
      if (detail) { this.q.setFromUnitVectors(FRONT, this.dir); this.rings.add(this.b, this.q, .7 + .8 * (1 - fade), .7 + .8 * (1 - fade), 1, PINK, fade); }
    }
    for (const m of this.manifestations) if (!m.used) { m.root.visible = m.root.userData.warming = !m.warm.done; if (!m.warm.done) m.presence.value = 0; m.actor = ''; m.active?.stop(); m.active = undefined; }
    this.beams.end(); this.rings.end(); st.close();
  }
  private windup(f: Fighter, elapsed: number) {
    const st = this.stage, s = f.state, seed = (s.actionSeq ?? 0) * 7.3, hand = f.handR;
    const tip = typeof f.strikePoint === 'function' ? f.strikePoint(this.tip) : this.tip.copy(hand);
    if (s.action === 'light') {
      const k = Math.sin(clamp(s.actionTime) * Math.PI);
      st.streak(hand, tip, .03, CURSED.main, .9 * k); st.glow(tip, .2, CURSED.main, .5 * k); st.light(tip, 1.8, CURSED, .18 * k);
    } else if (s.action === 'heavy') {
      const contact = s.branch ? s.actionDuration * .56 : HEAVY.contacts[0];
      if (elapsed < contact) {
        const k = clamp(elapsed / contact);
        st.streak(hand, tip, .03 + .05 * k, CURSED.main, .5 + .6 * k); st.streak(hand, tip, .015, CURSED.core, k);
        st.charge(tip, CURSED, .2, k, seed);
      } else if (elapsed < contact + .2) {
        const flare = 1 - (elapsed - contact) / .2, yaw = s.yaw ?? f.group.rotation.y;
        this.arc(this.c.copy(hand).lerp(tip, .8).addScaledVector(this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)), .3), yaw, .5, 1.35, 1, flare);
        st.light(this.c, 2.6, CURSED, .3 * flare);
      }
    } else if (s.action === 'special' && !s.branch) {
      if (elapsed < SPECIAL.contacts[0]) st.charge(f.handL, CURSED, .32, elapsed / SPECIAL.contacts[0], seed);
    } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < ULT.contacts[0] + .1) {
      const k = clamp(elapsed / ULT.contacts[0]);
      st.streak(hand, tip, .03 + .04 * k, CURSED.main, .5 + .6 * k); st.charge(tip, CURSED, .22, k, seed);
    }
  }
  private gather(actor: Fighter, receipt: Confirmation, elapsed: number) {
    const st = this.stage, B = YUTA_RIKA_BEATS, feet = actor.group.position, seed = receipt.seq * 2.9;
    const g = clamp((elapsed - B.confirm) / (B.beam - B.confirm)), charge = clamp((elapsed - B.charge) / (B.beam - B.charge));
    st.pool(this.c.copy(feet), 2.6 + 3 * g, RIKA, Math.min(1, .3 + g * 1.1), seed);
    st.ring(feet, 2.3 + .4 * g, 1.2 + 1.7 * g, RIKA, .55 + .45 * g, seed, 8);
    if (charge > 0) { st.charge(actor.handL, LOVE, .3 + .32 * charge, charge, seed); if (charge > .7) st.speed(.5 * (charge - .7) / .3, receipt.actor, receipt.target); }
  }
  private drawBeam(a: THREE.Vector3, b: THREE.Vector3, width: number, alpha: number) {
    this.dir.subVectors(b, a); const length = Math.min(10, this.dir.length()); if (length < .03) return;
    this.dir.normalize(); this.q.setFromUnitVectors(UP, this.dir); this.p.copy(a).addScaledVector(this.dir, length / 2);
    this.beams.add(this.p, this.q, width * 1.3, length, width * 1.3, INK, alpha);
    this.beams.add(this.p, this.q, width, length, width, LOVE_PINK, alpha);
    this.beams.add(this.p, this.q, width * .6, length, width * .6, LOVE_WHITE, alpha);
  }
  reset() {
    for (const pact of this.pacts) pact.actor='';this.pactCursor=0;
    for (const receipt of this.confirmations) receipt.actor = '';
    for (const cut of this.cuts) cut.live = false; for (const word of this.words) word.live = false;
    for (const m of this.manifestations) { m.root.visible = false; m.actor = ''; m.mixer.stopAllAction(); m.active = undefined; }
    this.seen.fill(-1); this.seenAt.fill(-1); this.cursor = this.seenCursor = this.cutCursor = this.wordCursor = 0;
    this.beams.begin(); this.beams.end(); this.rings.begin(); this.rings.end();
    this.stage.reset();
  }
  private disposeSource(gltf: GLTF) {
    const geometry = new Set<THREE.BufferGeometry>(), material = new Set<THREE.Material>(), texture = new Set<THREE.Texture>();
    gltf.scene.traverse(object => { if (!(object instanceof THREE.Mesh)) return; geometry.add(object.geometry);
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) { material.add(m); for (const value of Object.values(m)) if (value instanceof THREE.Texture) texture.add(value); } });
    for (const item of geometry) item.dispose(); for (const item of material) item.dispose(); for (const item of texture) item.dispose();
  }
  dispose() {
    if (this.disposed) return; this.disposed = true; this.reset();
    for (const m of this.manifestations) { m.mixer.uncacheRoot(m.model); m.root.removeFromParent(); for (const material of m.materials) material.dispose();
      m.model.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose(); }); }
    this.manifestations.length = 0; if (this.source) this.disposeSource(this.source); this.source = undefined;
    this.beams.dispose(); this.rings.dispose(); this.stage.release();
  }
}
