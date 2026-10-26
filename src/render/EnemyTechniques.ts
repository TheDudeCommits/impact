import * as THREE from 'three';
import { VfxKit } from './vfx/VfxKit';
import { SPRITE, ORIENT } from './vfx/SparkField';
import { energyOrbMaterial } from './vfx/EnergyOrbMaterial';
import { crater, CHARCOAL, CHARCOAL_SHADE } from './survival/crater';
import type { Element } from './vfx/palette';
import { ENEMIES, type EnemyMove } from '../survival/enemies';
import type { CombatEvent } from '../game/types';
import type { FeedItem } from '../survival/SurvivalGame';
import { BossFx } from './survival/bossFx';
import { INK_ON, INK_MARK_PARS, inkUniforms } from './rift/ink';


const E = (spike: number, rim: number, light = rim, ink = 0x10131a): Element => ({ spike, rim, light, ink });
export const ENEMY_ELEMENTS: Record<NonNullable<EnemyMove['element']>, Element> = {
  steel: E(0xf4f8ff, 0xb8c8d8, 0xdfe8f0), fire: E(0xfff1b0, 0xff4a1e, 0xff7a2a, 0x1c0a04), magma: E(0xffe0a0, 0xff3a0a, 0xff5a1e, 0x1c0602),
  light: E(0xfffbe0, 0xffd21e, 0xfff09a), ice: E(0xf0fbff, 0x7fd8ff, 0xbfefff), lightning: E(0xf2fbff, 0x5aa8ff, 0x9fd0ff, 0x0c1426),
  dark: E(0xf0e0ff, 0x7a3cff, 0x9a6cff, 0x0c0420), ki: E(0xe8f6ff, 0x3a9cff, 0x7fc8ff), sound: E(0xffffff, 0xffe9b0, 0xffffff), blood: E(0xffd2d8, 0xe0142e, 0xff3048, 0x050103),
  cero: E(0xffe0e4, 0xff1e3c, 0xff4a5e, 0x14020a), jade: E(0xe8fff0, 0x2ee88a, 0x7affb8, 0x021408),
};
const TELL = E(0xffffff, 0xff2a3a, 0xff4a5a);

const WARN_VERTEX = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WARN_FRAGMENT = `
uniform float uFill; uniform float uAlpha; uniform float uShape; uniform float uArc; uniform vec3 uColor; uniform float uTime;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float inside, edge, along;
  if (uShape < .5) { float r = length(p); inside = step(r, 1.0); edge = smoothstep(.9, .96, r) * inside; along = r; }
  else if (uShape < 1.5) { float r = length(p); float a = abs(atan(p.x, p.y)); inside = step(r, 1.0) * step(a, uArc); edge = max(smoothstep(.9, .96, r), smoothstep(uArc - .06, uArc, a)) * inside; along = r; }
  else { inside = step(abs(p.x), 1.0) * step(p.y, 1.0) * step(-1.0, p.y); edge = max(smoothstep(.86, .96, abs(p.x)), smoothstep(.94, .99, abs(p.y))) * inside; along = vUv.y; }
  if (inside < .5) discard;
  float fill = step(along, uFill) * .38;
  float stripes = step(.5, fract((p.x + p.y) * 6.0 - uTime * 3.0)) * .08;
  float a = max(edge * .9, fill + stripes * inside);
  gl_FragColor = vec4(uColor * (1.4 + edge), a * uAlpha);
}`;

const WARN_INK_VERTEX = `varying vec2 vUv; varying vec2 vGround; void main(){ vUv = uv; vec4 world = modelMatrix * vec4(position, 1.0); vGround = world.xz; gl_Position = projectionMatrix * viewMatrix * world; }`;
const WARN_INK_FRAGMENT = `
uniform float uFill; uniform float uAlpha; uniform float uShape; uniform float uArc; uniform vec3 uColor; uniform float uTime;
${INK_MARK_PARS}
varying vec2 vUv;
varying vec2 vGround;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float inside, edge, along;
  if (uShape < .5) { float r = length(p); inside = step(r, 1.0); edge = smoothstep(.88, .95, r) * inside; along = r; }
  else if (uShape < 1.5) { float r = length(p); float a = abs(atan(p.x, p.y)); inside = step(r, 1.0) * step(a, uArc); edge = max(smoothstep(.88, .95, r), smoothstep(uArc - .08, uArc, a)) * inside; along = r; }
  else { inside = step(abs(p.x), 1.0) * step(p.y, 1.0) * step(-1.0, p.y); edge = max(smoothstep(.84, .94, abs(p.x)), smoothstep(.93, .99, abs(p.y))) * inside; along = vUv.y; }
  if (inside < .5) discard;
  float reached = step(along, uFill);
  float due = smoothstep(.9, 1.0, uFill);
  float hatch = inkMarkHatch(vGround, 2.4, .14 + .38 * reached);
  float a = max(edge, hatch) * inside;
  a = max(a, inside * reached * due * .8);
  gl_FragColor = vec4(mix(uInkDanger, uInkHot, due * reached), a * uAlpha);
}`;

interface Warning { mesh: THREE.Mesh; uniforms: Record<string, THREE.IUniform>; born: number; due: number; until: number }
interface Shot { event: CombatEvent; move: EnemyMove; el: Element; mesh: THREE.Mesh; material: THREE.ShaderMaterial; start: THREE.Vector3; end: THREE.Vector3; release: number; travel: number; landed: boolean; arc: number }
interface Beam { event: CombatEvent; move: EnemyMove; el: Element; start: THREE.Vector3; end: THREE.Vector3; release: number; until: number; seed: number }
interface Pending { event: CombatEvent; move: EnemyMove; el: Element; at: number; done: boolean; kind: 'erupt' | 'glint' | 'slash' }
interface Drop { el: Element; element: string; mesh: THREE.Mesh; material: THREE.ShaderMaterial; from: THREE.Vector3; to: THREE.Vector3; lands: number; radius: number;
  look?: string; fall: number }
interface Streak { el: Element; from: THREE.Vector3; to: THREE.Vector3; born: number; seed: number }

const WARNINGS = 28;
const DROP_FALL = .42;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class EnemyTechniques {
  private kit: VfxKit;
  private warnings: Warning[] = [];
  private shots: Shot[] = [];
  private beams: Beam[] = [];
  private pending: Pending[] = [];
  private sphere = new THREE.SphereGeometry(1, 20, 14);
  private seen = new Set<number>();
  private drops: Drop[] = [];
  private vents: { x: number; y: number; z: number; lands: number; radius: number }[] = [];
  private streaks: Streak[] = [];
  private fed = 0;
  private readonly boss: BossFx;
  private findBody?: (id: string) => { x: number; y: number; z: number; height: number } | undefined;
  private shownOn?: { impactFrame(strength: number, at?: THREE.Vector3): void; techniqueGrade(color: number, strength: number, seconds: number): void };
  get bodyOf() { return this.findBody; }
  set bodyOf(find) { this.findBody = find; this.boss.bodyOf = find; }
  get screen() { return this.shownOn; }
  set screen(screen) { this.shownOn = screen; this.boss.screen = screen; }
  constructor(private scene: THREE.Scene) {
    this.kit = VfxKit.for(scene);
    this.boss = new BossFx(scene);
    this.boss.warnLine = (x, y, z, yaw, width, length, born, due, color) => this.warn('line', x, y, z, yaw, width, length, born, due, color);
    this.boss.warnRing = (x, y, z, radius, born, due, color) => this.warn('ring', x, y, z, 0, radius, 0, born, due, color);
    const plane = new THREE.PlaneGeometry(2, 2); plane.rotateX(-Math.PI / 2);
    for (let i = 0; i < WARNINGS; i++) {
      const uniforms = { uFill: { value: 0 }, uAlpha: { value: 0 }, uShape: { value: 0 }, uArc: { value: .6 }, uColor: { value: new THREE.Color(0xff2a3a) }, uTime: { value: 0 } };
      const mesh = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: INK_ON ? { ...uniforms, ...inkUniforms } : uniforms, vertexShader: INK_ON ? WARN_INK_VERTEX : WARN_VERTEX, fragmentShader: INK_ON ? WARN_INK_FRAGMENT : WARN_FRAGMENT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, toneMapped: false }));
      mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 2;
      scene.add(mesh);
      this.warnings.push({ mesh, uniforms, born: -1e9, due: 0, until: -1e9 });
    }
  }

  reset() {
    for (const w of this.warnings) { w.until = -1e9; w.mesh.visible = false; }
    for (const shot of this.shots) { shot.mesh.removeFromParent(); shot.material.dispose(); }
    this.shots.length = 0; this.beams.length = 0; this.pending.length = 0; this.seen.clear();
    for (const drop of this.drops) { drop.mesh.removeFromParent(); drop.material.dispose(); }
    this.drops.length = 0; this.streaks.length = 0; this.vents.length = 0; this.fed = 0;
    this.boss.reset();
  }

  feed(items: readonly FeedItem[], time: number) {
    for (const item of items) {
      if (item.id <= this.fed) continue;
      this.fed = item.id;
      if (item.kind === 'hazard' && item.x !== undefined && item.z !== undefined) this.hazard(item, time);
      else if (item.kind === 'blink' && item.points?.length === 2) this.blink(item, time);
      else this.boss.feed(item, time);
    }
  }

  private hazard(item: FeedItem, time: number) {
    const element = (item.text ?? 'steel') as keyof typeof ENEMY_ELEMENTS;
    const el = ENEMY_ELEMENTS[element] ?? ENEMY_ELEMENTS.steel;
    const x = item.x!, y = item.y ?? 0, z = item.z!, radius = item.radius ?? 1.5, lands = item.value ?? time + 1, look = item.sub;
    this.warn('target', x, y, z, 0, radius + .25, 0, Math.min(time, item.at), lands, el.rim);
    if (look === 'blink') return;
    if (look === 'vent') { this.vents.push({ x, y, z, lands, radius }); return; }
    const material = energyOrbMaterial(); material.uniforms.uTint.value.setHex(look === 'meteor' ? 0xff5a1e : el.rim);
    const mesh = new THREE.Mesh(this.sphere, material); mesh.visible = false; mesh.frustumCulled = false;
    mesh.scale.setScalar(look === 'meteor' ? Math.max(1.2, radius * .38) : look === 'lance' ? .35 : Math.max(.3, radius * .42));
    this.scene.add(mesh);
    const a = (item.id * 2.399) % (Math.PI * 2), high = look === 'meteor' ? 38 : 17, side = look === 'meteor' ? 14 : 5;
    this.drops.push({ el, element, mesh, material, from: new THREE.Vector3(x + Math.sin(a) * side, y + high, z + Math.cos(a) * side), to: new THREE.Vector3(x, y + .25, z), lands, radius,
      look, fall: look === 'meteor' ? 1.3 : look === 'zeus' ? .12 : DROP_FALL });
  }

  private blink(item: FeedItem, time: number) {
    const def = item.enemy ? ENEMIES[item.enemy] : undefined;
    const el = ENEMY_ELEMENTS[def?.moves.find(m => m.element)?.element ?? 'steel'];
    const [a, b] = item.points!;
    const h = (def?.height ?? 2) * .55;
    const from = new THREE.Vector3(a.x, a.y + h, a.z), to = new THREE.Vector3(b.x, b.y + h, b.z);
    const k = this.kit;
    for (const p of [from, to]) {
      k.ring(p.x, p.y, p.z, .2, 2.2, time, .22, 0xffffff, el.rim, .06);
      k.pulse(p.x, p.y, p.z, el.light, 7, 7, time, .22);
      k.dustRing(p.x, p.y - h, p.z, 6, .3, 2.6, .6, time, .5);
    }
    k.hitSpark(to.x, to.y, to.z, el, 0, time);
    this.streaks.push({ el, from, to, born: time, seed: item.id * 7919 });
  }

  private warn(shape: 'ring' | 'cone' | 'line' | 'target', x: number, y: number, z: number, yaw: number, size: number, length: number, born: number, due: number, color = 0xff2a3a) {
    const w = this.warnings.reduce((oldest, candidate) => candidate.until < oldest.until ? candidate : oldest, this.warnings[0]);
    w.born = born; w.due = due; w.until = due + .18;
    w.uniforms.uShape.value = shape === 'cone' ? 1 : shape === 'line' ? 2 : 0;
    (w.uniforms.uColor.value as THREE.Color).setHex(color);
    w.mesh.position.set(x, y + .04, z);
    w.mesh.rotation.set(0, yaw, 0);
    if (shape === 'line') { w.mesh.scale.set(size, 1, length / 2); w.mesh.position.set(x + Math.sin(yaw) * length / 2, y + .04, z + Math.cos(yaw) * length / 2); }
    else w.mesh.scale.set(size, 1, size);
    w.mesh.visible = true;
  }

  handle(events: readonly CombatEvent[], time: number) {
    for (const event of events) {
      if (!event.enemy || event.kind !== 'cast' || this.seen.has(event.id)) continue;
      this.seen.add(event.id); if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!);
      const def = ENEMIES[event.enemy];
      const move = def?.moves.find(m => m.name === event.move) ?? def?.moves.find(m => m.slot === event.slot);
      if (!def || !move || !event.origin || !event.endpoint) continue;
      const el = ENEMY_ELEMENTS[move.element ?? 'steel'];
      const release = event.serverTime + move.contacts[0];
      const start = new THREE.Vector3(event.origin.x, event.origin.y, event.origin.z), end = new THREE.Vector3(event.endpoint.x, event.endpoint.y, event.endpoint.z);
      const yaw = Math.atan2(end.x - start.x, end.z - start.z);
      const floor = start.y - 1.05 * (def.size ?? 1);
      if (move.guardBreak || def.role === 'boss' || move.telegraph) this.pending.push({ event, move, el: move.guardBreak ? TELL : el, at: event.serverTime + Math.max(0, move.contacts[0] - .45), done: false, kind: 'glint' });
      if (move.style === 'melee') this.pending.push({ event, move, el, at: release, done: false, kind: 'slash' });
      const shape = move.telegraph;
      if (shape === 'ring' || move.style === 'field') this.warn('ring', end.x, floor, end.z, yaw, move.radius + .45, 0, event.serverTime, release);
      else if (shape === 'cone') this.warn('cone', start.x, floor, start.z, yaw, move.range + .4, 0, event.serverTime, release);
      else if (shape === 'line' || move.style === 'beam') this.warn('line', start.x, floor, start.z, yaw, move.radius + .3, start.distanceTo(end), event.serverTime, release, 0xffa01e);
      else if (shape === 'target') this.warn('target', end.x, floor, end.z, yaw, move.radius + .6, 0, event.serverTime, release);
      if (move.style === 'field') this.pending.push({ event, move, el, at: release, done: false, kind: 'erupt' });
      if (move.style === 'projectile' || move.style === 'bomb') {
        for (let i = 0; i < move.contacts.length; i++) {
          const material = energyOrbMaterial(); material.uniforms.uTint.value.setHex(el.rim);
          const mesh = new THREE.Mesh(this.sphere, material); mesh.visible = false; mesh.frustumCulled = false;
          mesh.scale.setScalar(Math.min(move.style === 'bomb' ? 1.8 : 1.2, Math.max(.18, move.radius * (move.style === 'bomb' ? .45 : .5))));
          this.scene.add(mesh);
          const travel = start.distanceTo(end) / (move.speed ?? 26);
          this.shots.push({ event, move, el, mesh, material, start: start.clone(), end: end.clone(), release: event.serverTime + move.contacts[i], travel, landed: false, arc: move.style === 'bomb' ? Math.min(4, start.distanceTo(end) * .25) : 0 });
        }
      }
      if (move.style === 'beam') this.beams.push({ event, move, el, start, end, release, until: event.serverTime + move.duration - .1, seed: event.seed ?? event.id });
      if (move.callout && move.slot === 'ultimate') this.screen?.techniqueGrade(el.rim, .7, move.duration);
    }
    for (const event of events) {
      if (event.kind !== 'hit' || !event.enemy || !event.endpoint) continue;
      for (const shot of this.shots) if (!shot.landed && shot.event.actorId === event.actorId && event.serverTime >= shot.release - .02) {
        shot.end.set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
        shot.travel = Math.max(.02, event.serverTime - shot.release);
      }
    }
  }

  update(time: number) {
    const k = this.kit;
    this.boss.update(time);
    for (const w of this.warnings) {
      if (time > w.until || time < w.born) { w.mesh.visible = false; continue; }
      const fill = Math.min(1, (time - w.born) / Math.max(.05, w.due - w.born));
      w.uniforms.uFill.value = fill; w.uniforms.uTime.value = time;
      w.uniforms.uAlpha.value = time > w.due ? Math.max(0, 1 - (time - w.due) / .18) : Math.min(1, (time - w.born) / .12);
      w.mesh.visible = true;
    }
    for (const p of this.pending) {
      if (p.done || time < p.at) continue;
      p.done = true;
      const body = this.bodyOf?.(p.event.actorId);
      if (p.kind === 'glint' && body) {
        const h = body.height;
        k.ring(body.x, body.y + h * .8, body.z, .1, 1.4, time, .28, 0xffffff, p.el.rim, .05);
        k.hitSpark(body.x, body.y + h * .8, body.z, p.el, 0, time);
        k.pulse(body.x, body.y + h * .7, body.z, p.el.light, 5, 5, time, .3);
      } else if (p.kind === 'slash' && body) {
        const yaw = Math.atan2(p.event.endpoint!.x - p.event.origin!.x, p.event.endpoint!.z - p.event.origin!.z);
        const r = Math.min(p.move.range, 3);
        k.ring(body.x + Math.sin(yaw) * r * .6, body.y + body.height * .5, body.z + Math.cos(yaw) * r * .6, .2, 1.1 + p.move.radius, time, .16, 0xffffff, p.el.rim, .05);
      } else if (p.kind === 'erupt') {
        const e = p.event.endpoint!, floor = e.y - 1.05;
        crater(k, e.x, floor, e.z, true, time, p.el);
        k.ring(e.x, floor + .1, e.z, .4, (p.move.radius + .6) * 2, time, .45, 0xffffff, p.el.rim, .2, 'flat');
        for (let i = 0; i < 3; i++) { const a = (i + Math.random() * .5) / 3 * Math.PI * 2; k.smoke(e.x + Math.cos(a) * p.move.radius * .5, floor + .4, e.z + Math.sin(a) * p.move.radius * .5, Math.cos(a) * 2, 3 + Math.random() * 2, Math.sin(a) * 2, 1.1, time, .6, CHARCOAL, CHARCOAL_SHADE); }
        k.pulse(e.x, floor + 1.5, e.z, p.el.light, 14, 12, time, .6, 2);
        this.screen?.impactFrame(.35);
      }
    }
    this.pending = this.pending.filter(p => !p.done || time - p.at < 1);
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      const t = (time - shot.release) / Math.max(.02, shot.travel);
      if (t < 0) { shot.mesh.visible = false; if (time - shot.event.serverTime > 8) { shot.mesh.removeFromParent(); shot.material.dispose(); this.shots.splice(i, 1); } continue; }
      if (t >= 1) {
        const e = shot.end;
        if (shot.move.style === 'bomb') {
          crater(k, e.x, e.y - 1, e.z, true, time, shot.el); k.hitSpark(e.x, e.y, e.z, shot.el, 3, time); k.pulse(e.x, e.y + .5, e.z, shot.el.light, 16, 12, time, .6, 2);
          k.ring(e.x, e.y - .9, e.z, .5, (shot.move.radius + .5) * 2, time, .5, 0xffffff, shot.el.rim, .2, 'flat');
        } else { k.hitSpark(e.x, e.y, e.z, shot.el, 1, time); k.pulse(e.x, e.y, e.z, shot.el.light, 5, 6, time, .25); }
        shot.mesh.removeFromParent(); shot.material.dispose(); this.shots.splice(i, 1); continue;
      }
      _a.lerpVectors(shot.start, shot.end, t); _a.y += Math.sin(t * Math.PI) * shot.arc;
      shot.mesh.position.copy(_a); shot.mesh.visible = true;
      shot.material.uniforms.uTime.value = time;
      if (Math.random() < .6) k.puff(_a.x, _a.y, _a.z, 0, .2, 0, shot.mesh.scale.x * 1.4, time, .25, .4);
      k.pulse(_a.x, _a.y, _a.z, shot.el.light, 3, 4, time, .05, .5);
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const t = 1 - (drop.lands - time) / drop.fall;
      if (t < 0) { drop.mesh.visible = false; continue; }
      if (t >= 1) {
        const e = drop.to, floor = e.y - .25;
        if (drop.look === 'zeus') {
          const sky = new THREE.Vector3(e.x + (Math.random() - .5) * 3, e.y + 16, e.z + (Math.random() - .5) * 3), ground = new THREE.Vector3(e.x, floor + .1, e.z);
          this.streaks.push({ el: drop.el, from: sky, to: ground, born: time, seed: (time * 997) | 0 });
          k.crackle(sky, ground, .15, drop.el, 8, time);
        }
        if (drop.look === 'meteor') { this.screen?.impactFrame(.9); k.ring(e.x, floor + .1, e.z, .6, drop.radius * 2.6, time, .8, 0xffffff, drop.el.rim, .28, 'flat'); }
        crater(k, e.x, floor, e.z, drop.radius > 1.7, time, drop.el);
        k.ring(e.x, floor + .08, e.z, .3, (drop.radius + .4) * 2, time, .4, 0xffffff, drop.el.rim, .18, 'flat');
        k.pulse(e.x, floor + 1, e.z, drop.el.light, 12, 9, time, .45, 2);
        if (drop.element === 'magma' || drop.element === 'fire') for (let j = 0; j < 2; j++) { const a = j * Math.PI + drop.lands; k.smoke(e.x + Math.cos(a) * .4, floor + .5, e.z + Math.sin(a) * .4, Math.cos(a) * 1, 3.2 + j * 1.4, Math.sin(a) * 1, .9 + drop.radius * .35, time, .85, 0x7a3418, 0x160806); }
        else k.hitSpark(e.x, floor + .6, e.z, drop.el, 2, time);
        drop.mesh.removeFromParent(); drop.material.dispose(); this.drops.splice(i, 1); continue;
      }
      _a.lerpVectors(drop.from, drop.to, t * t);
      drop.mesh.position.copy(_a); drop.mesh.visible = true;
      drop.material.uniforms.uTime.value = time;
      if (Math.random() < .4) k.puff(_a.x, _a.y, _a.z, 0, 1.5, 0, drop.mesh.scale.x * 1.6, time, .3, .45);
      k.pulse(_a.x, _a.y, _a.z, drop.el.light, 4, 5, time, .05, .6);
    }
    for (let i = this.vents.length - 1; i >= 0; i--) {
      const vent = this.vents[i];
      if (time < vent.lands) continue;
      this.vents.splice(i, 1);
      const sp = k.sparks.spec, el = ENEMY_ELEMENTS.fire, floor = vent.y;
      crater(k, vent.x, floor, vent.z, true, time, el);
      for (let j = 0, n = k.n(16, 6); j < n; j++) {
        sp.reset(SPRITE.streak, time + j * .012, .55 + Math.random() * .25).pos(vent.x + (Math.random() - .5) * vent.radius * .5, floor + .3, vent.z + (Math.random() - .5) * vent.radius * .5)
          .velocity((Math.random() - .5) * 2.4, 10 + Math.random() * 8, (Math.random() - .5) * 2.4);
        sp.orient = ORIENT.velocity; sp.sized(.1, .06, .5); sp.stretch = 5; sp.gravity = 10; sp.hot(el.spike, 1.9).cool(el.rim, .5); k.sparks.emit();
      }
      for (let j = 0; j < 4; j++) k.smoke(vent.x + (Math.random() - .5) * .6, floor + .7 + j * 1.3, vent.z + (Math.random() - .5) * .6, (Math.random() - .5) * .5, 2.6 + j * .5, (Math.random() - .5) * .5, 1.1 + j * .4, time + j * .07, 1.5, 0x4a1c10, 0x100402);
      k.ring(vent.x, floor + .08, vent.z, .3, vent.radius * 2.2, time, .45, 0xffffff, el.rim, .22, 'flat');
      k.pulse(vent.x, floor + 1.5, vent.z, el.light, 14, 11, time, .5, 2);
    }
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const streak = this.streaks[i], life = (time - streak.born) / .2;
      if (life >= 1 || life < 0) { if (life >= 1) this.streaks.splice(i, 1); continue; }
      k.beams.draw(streak.from, streak.to, Math.max(.02, life), streak.seed, .28, streak.el.rim, streak.el.spike, 1 - life, 1, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const beam = this.beams[i];
      if (time > beam.until + .3) { this.beams.splice(i, 1); continue; }
      if (time < beam.release - .15) continue;
      const life = Math.min(.999, Math.max(.02, (time - (beam.release - .15)) / Math.max(.2, beam.until - beam.release + .3)));
      k.beams.draw(beam.start, beam.end, life, beam.seed, Math.max(.3, beam.move.radius * .8), beam.el.rim, beam.el.spike, time >= beam.release ? 1 : .3, 1, 1);
      _b.copy(beam.end); k.pulse(_b.x, _b.y, _b.z, beam.el.light, 10, 9, time, .08, 2);
    }
  }

  dispose() { this.reset(); for (const w of this.warnings) { w.mesh.removeFromParent(); (w.mesh.material as THREE.Material).dispose(); } this.sphere.dispose(); }
}
