import * as THREE from 'three';
import { MOVES } from '../../game/moves';
import type { Fighter } from '../Fighter';
import { Afterimages } from '../vfx/Afterimages';
import { ghostTint } from '../vfx/palette';
import { BoltBatch } from './BoltBatch';
import { GlowBatch, GLOW, RING, STAR } from './GlowBatch';
import { LightVolumes } from './LightVolumes';
import { SIGNATURE, involvesLocal } from './context';

const HEAVY = MOVES.goku.heavy, TELEPORT = HEAVY.teleport!, LIGHT = MOVES.vegeta.light;
export const APPEAR_HOLD = .04;
export function transmissionHidden(fighter: string, action: string, elapsed: number, branch?: string) {
  return fighter === 'goku' && action === 'heavy' && !branch && elapsed >= TELEPORT.vanish && elapsed < TELEPORT.appear + APPEAR_HOLD;
}
const PALE = new THREE.Color(1.4, 1.9, 2.6), SKY = new THREE.Color(.35, .8, 1.9), SKY_LIGHT = new THREE.Color(.45, .8, 1.5);
const VIOLET = new THREE.Color(.9, .55, 2.4), VIOLET_DEEP = new THREE.Color(.5, .25, 1.6), VIOLET_LIGHT = new THREE.Color(.7, .5, 1.6);
const UP = new THREE.Vector3(0, 1, 0);
const BURSTS = 12;
type BurstKind = 'vanish' | 'arrive' | 'flare';
interface Burst { kind: BurstKind; born: number; at: THREE.Vector3; facing: THREE.Vector3; live: boolean }
interface Track { cast: number; vanished: boolean; back: boolean; flared: boolean }

export class SaiyanTechniques {
  private glows = new GlowBatch(96, 'saiyan-glow', true);
  private streaks = new BoltBatch(160, 'saiyan-streaks');
  private lights = new LightVolumes(4, 'saiyan-light');
  private ghosts: Afterimages;
  private tracks = new Map<string, Track>();
  private hidden = new Set<Fighter>();
  private bursts: Burst[] = Array.from({ length: BURSTS }, () => ({ kind: 'flare' as BurstKind, born: 0, at: new THREE.Vector3(), facing: new THREE.Vector3(), live: false }));
  private next = 0;
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3();
  constructor(scene: THREE.Scene) {
    scene.add(this.glows.mesh, this.streaks.mesh, this.lights.mesh);
    this.ghosts = new Afterimages(scene, 2);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, density: number) {
    this.glows.begin(time); this.streaks.begin(); this.lights.begin();
    const d = Math.max(.35, density);
    for (const f of this.hidden) { let present = false; for (const g of fighters.values()) if (g === f) { present = true; break; } if (!present) this.hidden.delete(f); }
    for (const f of fighters.values()) {
      const s = f.state, elapsed = s.actionTime * s.actionDuration;
      const cast = (s.actionSeq ?? 0) * 7919 + s.actionStarted;
      let track = this.tracks.get(s.id);
      if (s.fighter === 'goku' || s.fighter === 'vegeta') {
        if (!track) {
          track = { cast: NaN, vanished: false, back: false, flared: false }; this.tracks.set(s.id, track);
          if (s.fighter === 'goku') this.ghosts.prepare(f);
        }
        if (track.cast !== cast) { track.cast = cast; track.vanished = track.back = track.flared = false; }
      }
      const transmission = s.alive && s.fighter === 'goku' && s.action === 'heavy' && !s.branch;
      if (transmission && track) this.transmission(f, track, elapsed, time, d);
      else if (this.hidden.has(f)) { f.group.visible = true; this.hidden.delete(f); }
      if (track && s.alive && s.fighter === 'vegeta' && s.action === 'light' && (s.chain ?? 0) === 0 && s.grounded) this.straight(f, track, elapsed, time, d);
    }
    this.drawBursts(time, d);
    this.ghosts.retain(fighters);
    this.ghosts.update(time);
    this.glows.end(); this.streaks.end(); this.lights.end();
  }

  private transmission(f: Fighter, track: Track, elapsed: number, time: number, d: number) {
    const s = f.state;
    if (elapsed < TELEPORT.vanish) {
      const k = THREE.MathUtils.smoothstep(elapsed, .06, TELEPORT.vanish - .02);
      if (k > 0) {
        this.a.copy(f.handR).addScaledVector(UP, .1);
        this.glows.add(this.a, .1 + .12 * k, PALE, .9 * k, STAR, .3, Math.floor(time * 30) % 97);
        this.glows.add(this.a, .3 + .15 * k, SKY, .35 * k * d, GLOW, .05);
      }
      return;
    }
    if (transmissionHidden(s.fighter, s.action, elapsed, s.branch)) {
      if (!track.vanished) {
        track.vanished = true;
        if (f.group.visible) this.ghosts.spawn(f, ghostTint('goku', !!s.awakened), time, .34, .85);
        this.burst('vanish', time, f.group.position, s.yaw);
        if (involvesLocal(s.id)) SIGNATURE.screen?.speedLines?.(.7);
      }
      f.group.visible = false; this.hidden.add(f);
      return;
    }
    if (this.hidden.has(f)) { f.group.visible = true; this.hidden.delete(f); }
    if (!track.back && track.vanished) {
      track.back = true;
      this.burst('arrive', time, f.group.position, s.yaw);
      if (involvesLocal(s.id, s.target ?? undefined)) SIGNATURE.screen?.speedLines?.(1);
    }
  }

  private straight(f: Fighter, track: Track, elapsed: number, time: number, d: number) {
    const contact = LIGHT.contacts[0];
    if (elapsed < contact) {
      const k = THREE.MathUtils.smoothstep(elapsed, .05, contact);
      if (k > 0) {
        this.glows.add(f.handR, .08 + .1 * k, VIOLET, .8 * k, GLOW, .3);
        this.glows.add(f.handR, .22 + .12 * k, VIOLET_DEEP, .3 * k * d, GLOW, .05);
      }
      return;
    }
    if (!track.flared && elapsed < contact + .15) {
      track.flared = true;
      this.burst('flare', time, f.handR, f.group.rotation.y);
    }
  }

  private burst(kind: BurstKind, time: number, at: THREE.Vector3, yaw: number) {
    const b = this.bursts[this.next]; this.next = (this.next + 1) % BURSTS;
    b.kind = kind; b.born = time; b.at.copy(at); b.facing.set(Math.sin(yaw), 0, Math.cos(yaw)); b.live = true;
  }

  private drawBursts(time: number, d: number) {
    for (let i = 0; i < BURSTS; i++) {
      const b = this.bursts[i];
      if (!b.live) continue;
      const age = time - b.born;
      if (age < -.5 || age > .45) { b.live = false; continue; }
      if (age < 0) continue;
      if (b.kind === 'flare') this.flare(b, age, d);
      else this.shun(b, age, d, b.kind === 'arrive');
    }
  }

  private flare(b: Burst, age: number, d: number) {
    const life = .22;
    if (age > life) { b.live = false; return; }
    const u = age / life, fade = 1 - u;
    this.glows.add(b.at, .26 + .18 * u, VIOLET, 1.3 * fade * fade, STAR, .22, (b.born * 997) % 89);
    this.glows.add(b.at, .15 + .35 * u, VIOLET, .7 * fade, RING, .06, 0, .78);
    this.glows.add(b.at, .35, VIOLET_DEEP, .45 * fade * d, GLOW, .05);
    const n = Math.round(6 * d);
    for (let k = 0; k < n; k++) {
      const spin = k * 2.39996 + b.born * 7, spread = .45;
      this.c.set(Math.cos(spin) * spread, Math.sin(spin) * spread * .7, 1).normalize();
      const fx = b.facing.x, fz = b.facing.z;
      this.a.set(fz * this.c.x + fx * this.c.z, this.c.y, -fx * this.c.x + fz * this.c.z);
      const from = .1 + .9 * u, to = from + .25 * fade;
      this.streaks.segment(this.b.copy(b.at).addScaledVector(this.a, from), this.c.copy(b.at).addScaledVector(this.a, to), .025, VIOLET, fade, .35);
    }
    this.lights.add(b.at, 2.4, VIOLET_LIGHT, .9 * fade);
  }

  private shun(b: Burst, age: number, d: number, arriving: boolean) {
    const life = arriving ? .26 : .22;
    if (age > life) { b.live = false; return; }
    const u = age / life, fade = 1 - u;
    this.a.copy(b.at).addScaledVector(UP, 1.05);
    this.glows.add(this.a, arriving ? .35 + .25 * u : .75 - .35 * u, PALE, (arriving ? 1.1 : 1) * fade * fade, STAR, .25, (b.born * 991) % 83);
    this.glows.add(this.a, arriving ? .3 + .7 * u : 1 - .7 * u, SKY, (arriving ? .55 : .8) * fade, RING, .05, 0, .8);
    const n = Math.round((arriving ? 10 : 8) * d);
    for (let k = 0; k < n; k++) {
      const angle = k / Math.max(1, n) * Math.PI * 2 + b.born * 3, radius = arriving ? .7 * fade + .2 : .35 + .5 * u;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      const low = arriving ? .2 + 1.2 * u : .1 + 1.4 * u, high = low + .7 * fade + .2;
      this.streaks.segment(this.b.set(b.at.x + x, b.at.y + low, b.at.z + z), this.c.set(b.at.x + x, b.at.y + high, b.at.z + z), .02, SKY, fade, .45);
    }
    this.lights.add(this.a, 3, SKY_LIGHT, (arriving ? .8 : .7) * fade);
  }

  reset() {
    for (const f of this.hidden) f.group.visible = true;
    this.hidden.clear(); this.tracks.clear();
    for (const b of this.bursts) b.live = false;
    this.ghosts.clear();
    this.glows.begin(0); this.streaks.begin(); this.lights.begin(); this.glows.end(); this.streaks.end(); this.lights.end();
  }

  dispose() { this.reset(); this.ghosts.dispose(); this.glows.dispose(); this.streaks.dispose(); this.lights.dispose(); }
}
