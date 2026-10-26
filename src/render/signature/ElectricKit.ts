import * as THREE from 'three';
import { BoltBatch } from './BoltBatch';
import { GlowBatch, GLOW, SPARK, STAR, RING } from './GlowBatch';
import { LightVolumes } from './LightVolumes';
import { LightningPainter, type BoltStyle } from './Lightning';

export const TICK_HZ = 30;
export const LIGHTNING = {
  glow: new THREE.Color(.26, .6, 2.2),
  deep: new THREE.Color(.1, .26, 1.5),
  halo: new THREE.Color(.1, .32, 1.1),
  light: new THREE.Color(.3, .55, 1.5),
  spark: new THREE.Color(.7, 1.1, 2.4),
};
interface Trail { points: THREE.Vector3[]; times: number[]; head: number; size: number; last: number }
const TRAIL = 14;

export class ElectricKit {
  readonly bolts: BoltBatch;
  readonly glows: GlowBatch;
  readonly halos: GlowBatch;
  readonly lights: LightVolumes;
  readonly painter: LightningPainter;
  density = 1;
  time = 0;
  dt = 0;
  tick = 0;
  private last = -1;
  private lastTick = -1;
  private trails = new Map<string, Trail>();
  private style: BoltStyle = { width: .03, color: LIGHTNING.glow, levels: 3, jag: .3, branches: 1, branchLength: .5, taper: .3 };
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3();
  private tint = new THREE.Color();
  constructor(scene: THREE.Scene, name: string, capacity = 2400) {
    this.bolts = new BoltBatch(capacity, name);
    this.glows = new GlowBatch(96, name + '-glow');
    this.halos = new GlowBatch(64, name + '-halo', true);
    this.lights = new LightVolumes(4, name + '-light');
    this.painter = new LightningPainter(this.bolts, 192);
    scene.add(this.bolts.mesh, this.glows.mesh, this.halos.mesh, this.lights.mesh);
  }
  begin(time: number, density: number) {
    this.dt = this.last < 0 ? 0 : THREE.MathUtils.clamp(time - this.last, 0, .05); this.last = time;
    this.time = time; this.density = Math.max(.35, density); this.tick = Math.floor(time * TICK_HZ);
    this.bolts.begin(); this.glows.begin(time); this.halos.begin(time); this.lights.begin();
  }
  get ticked() { return this.tick !== this.lastTick; }
  end(sparkColor = LIGHTNING.spark) {
    this.painter.sparksUpdate(this.dt, sparkColor);
    this.lastTick = this.tick;
    this.bolts.end(); this.glows.end(); this.halos.end(); this.lights.end();
  }
  arc(a: THREE.Vector3, b: THREE.Vector3, seed: number, width: number, color = LIGHTNING.glow, intensity = 1, branches = 0, levels = 3, jag = .28) {
    const s = this.style; s.width = width; s.color = color; s.intensity = intensity; s.branches = branches; s.levels = levels; s.jag = jag; s.branchLength = .5; s.taper = .5; s.core = .18;
    this.painter.bolt(a, b, seed, s);
  }
  ball(center: THREE.Vector3, power: number, salt: number, floor = NaN, color = LIGHTNING.glow, light = LIGHTNING.light, reach = .62) {
    if (power < .02) return;
    const d = this.density, tick = this.tick, flicker = .78 + .22 * Math.sin(tick * 2.7 + salt) * Math.sin(tick * 1.3);
    this.glows.add(center, .27 * power, color, 1, SPARK, .36, (tick + salt) % 97);
    this.halos.add(center, .85 * power, this.tint.copy(color).multiplyScalar(.32), .6 * flicker, GLOW, .05);
    const s = this.style; s.width = .026 * Math.min(1.4, power); s.color = color; s.intensity = 1; s.levels = 3; s.jag = .34; s.branches = 1; s.branchLength = .55; s.taper = .3; s.core = .17;
    this.painter.burst(center, reach * power, Math.max(4, Math.round(11 * d)), tick, salt, s);
    if (this.ticked) this.painter.emit(center, Math.round(3 * d * Math.min(1.5, power)), 3.2 * power, tick * 7 + salt, .011, .4);
    this.lights.add(center, 2.8 * Math.min(1.2, power), light, .55 * flicker * Math.min(1, power));
    if (Number.isFinite(floor) && center.y - floor < 1.7) {
      const strikes = Math.max(1, Math.round(2 * d));
      for (let i = 0; i < strikes; i++) {
        const step = Math.floor(tick / 2), r = this.painter.rng.seed(step * 19 + i * 131 + salt * 7);
        if (r.next() < .3) continue;
        const angle = r.next() * Math.PI * 2, far = .35 + .75 * r.next();
        this.b.set(center.x + Math.cos(angle) * far, floor + .01, center.z + Math.sin(angle) * far);
        this.arc(center, this.b, step * 31 + i + salt, .016 * power, color, .85, 1, 3, .32);
        this.c.set(this.b.x + Math.cos(angle + 1) * .35, floor + .01, this.b.z + Math.sin(angle + 1) * .35);
        this.arc(this.b, this.c, step * 37 + i + salt, .012 * power, color, .7, 0, 2, .45);
      }
    }
  }
  trail(id: string, point: THREE.Vector3, power: number, salt: number, color = LIGHTNING.glow) {
    let t = this.trails.get(id);
    if (!t) { t = { points: Array.from({ length: TRAIL }, () => new THREE.Vector3()), times: new Array(TRAIL).fill(-9), head: 0, size: 0, last: -9 }; this.trails.set(id, t); }
    if (this.time - t.last > .018) { t.head = (t.head + 1) % TRAIL; t.points[t.head].copy(point); t.times[t.head] = this.time; t.size = Math.min(TRAIL, t.size + 1); t.last = this.time; }
    else t.points[t.head].copy(point);
    if (power < .02) return;
    for (let k = 0; k < t.size - 1; k++) {
      const i = (t.head - k + TRAIL) % TRAIL, j = (i - 1 + TRAIL) % TRAIL, age = this.time - t.times[j];
      if (age > .28) break;
      const fade = (1 - age / .28) * power;
      this.arc(t.points[i], t.points[j], this.tick * 3 + k * 17 + salt, .022 * fade + .004, color, fade, k % 3 === 0 ? 1 : 0, 2, .5);
    }
  }
  forget(id: string) { this.trails.delete(id); }
  flash(center: THREE.Vector3, strength: number, salt: number, reach = 1.3, color = LIGHTNING.glow) {
    if (strength < .02) return;
    this.glows.add(center, .75 * strength, color, 1, STAR, .2, salt);
    this.glows.add(center, .8 * strength, color, .8, RING, .06, salt, .35 + .5 * (1 - strength));
    this.halos.add(center, 1.2 * strength, this.tint.copy(color).multiplyScalar(.45), .55 * strength, GLOW, .1);
    const s = this.style; s.width = .034 * strength + .006; s.color = color; s.intensity = 1; s.levels = 3; s.jag = .32; s.branches = 2; s.branchLength = .5; s.taper = .3; s.core = .24;
    this.painter.burst(center, reach * (.6 + .4 * strength), Math.max(5, Math.round(12 * this.density)), this.tick, salt + 5, s);
    this.lights.add(center, 3.8 * strength, LIGHTNING.light, .75 * strength);
  }
  reset() { this.painter.clearSparks(); this.trails.clear(); this.last = -1; this.bolts.begin(); this.glows.begin(0); this.halos.begin(0); this.lights.begin(); this.bolts.end(); this.glows.end(); this.halos.end(); this.lights.end(); }
  dispose() { this.bolts.dispose(); this.glows.dispose(); this.halos.dispose(); this.lights.dispose(); }
}
