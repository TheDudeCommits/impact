import * as THREE from 'three';
import { MOVES } from '../../game/moves';
import type { Fighter } from '../Fighter';
import { BoltBatch } from './BoltBatch';
import { GlowBatch, GLOW, RING } from './GlowBatch';
import { LightVolumes } from './LightVolumes';
import { gradeOnce, GRADE } from './context';
import { SaiyanTechniques } from './SaiyanTechniques';

const SPIRIT_HEIGHT = 4.65, SPIRIT_RADIUS = 2.3;
const MOVE = MOVES.goku.ultimate, RELEASE = MOVE.contacts[0];
const PALE = new THREE.Color(.9, 1.5, 2.6), BLUE = new THREE.Color(.25, .75, 2.2), DEEP = new THREE.Color(.03, .2, .8), LIGHT = new THREE.Color(.35, .75, 1.6);
const UP = new THREE.Vector3(0, 1, 0);

export class SpiritBombEffects {
  private streaks = new BoltBatch(900, 'spirit-bomb-streams');
  private glows = new GlowBatch(96, 'spirit-bomb-glow', true);
  private lights = new LightVolumes(3, 'spirit-bomb-light');
  private center = new THREE.Vector3(); private dir = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3();
  private saiyan: SaiyanTechniques;
  constructor(scene: THREE.Scene) { scene.add(this.streaks.mesh, this.glows.mesh, this.lights.mesh); this.saiyan = new SaiyanTechniques(scene); }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, density: number) {
    this.saiyan.update(time, fighters, density);
    this.streaks.begin(); this.glows.begin(time); this.lights.begin();
    const d = Math.max(.35, density);
    for (const f of fighters.values()) {
      const s = f.state;
      if (s.fighter !== 'goku' || s.action !== 'ultimate' || !s.alive) continue;
      const t = s.actionTime * s.actionDuration;
      if (t > RELEASE + .04) continue;
      gradeOnce(s.id, s.actionStarted, GRADE.ki, .45, RELEASE + .6, s.id, s.target ?? undefined);
      const charge = THREE.MathUtils.clamp(t / RELEASE, 0, 1), build = .35 + .65 * THREE.MathUtils.smoothstep(t, 0, 1.2);
      const radius = SPIRIT_RADIUS * (.14 + .86 * Math.pow(charge, .8));
      this.center.copy(f.group.position).addScaledVector(UP, SPIRIT_HEIGHT);
      const n = Math.round(64 * d);
      for (let i = 0; i < n; i++) {
        const phase = (time * (.55 + .25 * ((i * .37) % 1)) + i * .618) % 1;
        const z = .95 - 1.25 * ((i + .5) / n), ring = Math.sqrt(Math.max(0, 1 - z * z)), az = i * 2.399963;
        this.dir.set(Math.cos(az) * ring, z, Math.sin(az) * ring);
        const far = 7 + 9 * ((i * .61) % 1), r = radius + (far - radius) * (1 - phase) * (1 - phase), len = Math.min(r - radius, .6 + 2.2 * (1 - phase));
        if (len <= .05) continue;
        this.a.copy(this.center).addScaledVector(this.dir, r); this.b.copy(this.center).addScaledVector(this.dir, r - len);
        const k = Math.sin(Math.PI * phase) * build;
        this.streaks.segment(this.a, this.b, .03 + .05 * phase, i % 3 ? BLUE : PALE, k, .35);
      }
      const motes = Math.round(28 * d);
      for (let i = 0; i < motes; i++) {
        const phase = (time * .6 + i * .618) % 1, a = i * 2.399 + time * .8, r = (2.6 + 1.5 * ((i * .43) % 1)) * (1 - phase * .85);
        this.a.set(f.group.position.x + Math.cos(a) * r, f.group.position.y + .1 + phase * (SPIRIT_HEIGHT - radius - .2), f.group.position.z + Math.sin(a) * r);
        this.glows.add(this.a, .06 + .05 * (i % 3), PALE, (1 - phase) * build, GLOW, .5);
      }
      this.glows.add(this.center, radius * 1.12, PALE, .7 * build, RING, .04, i32(time), .9);
      this.glows.add(this.center, radius * 1.7, DEEP, .45 * build, GLOW, .0001);
      this.glows.add(f.handR, .35 + .25 * charge, BLUE, .8 * build, GLOW, .2);
      this.glows.add(f.handL, .35 + .25 * charge, BLUE, .8 * build, GLOW, .2);
      this.lights.add(this.center, radius * 3.2 + 2, LIGHT, .9 * charge + .2);
      this.lights.add(this.a.copy(f.group.position).addScaledVector(UP, 1), 5, LIGHT, .55 * build);
    }
    this.streaks.end(); this.glows.end(); this.lights.end();
  }
  reset() { this.saiyan.reset(); this.streaks.begin(); this.glows.begin(0); this.lights.begin(); this.streaks.end(); this.glows.end(); this.lights.end(); }
  dispose() { this.saiyan.dispose(); this.streaks.dispose(); this.glows.dispose(); this.lights.dispose(); }
}
const i32 = (time: number) => Math.floor(time * 30) % 97;
