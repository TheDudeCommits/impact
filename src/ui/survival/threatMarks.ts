import * as THREE from 'three';
import { HORDE_DOTS } from './minimap';


const SECTORS = 12;
const GRUNT_REACH = 7, BOSS_REACH = 20;
const _p = new THREE.Vector3(), _f = new THREE.Vector3();

export class ThreatMarks {
  readonly element: HTMLElement;
  private readonly marks: HTMLElement[] = [];
  private readonly heat = new Float32Array(SECTORS);
  private readonly boss = new Uint8Array(SECTORS);
  private readonly ranged = new Uint8Array(SECTORS);
  private readonly shown = new Float32Array(SECTORS);
  private at = 0;
  nearest?: { x: number; z: number };
  private best = Infinity;
  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'sv-threats';
    this.element.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < SECTORS; i++) {
      const mark = document.createElement('i');
      mark.style.setProperty('--a', `${i / SECTORS * 360}deg`);
      this.element.append(mark);
      this.marks.push(mark);
    }
    parent.append(this.element);
  }

  place(camera: THREE.Camera, me: { x: number; z: number } | undefined, bosses: readonly { x?: number; z?: number; champion?: boolean }[] | undefined, on: boolean) {
    this.heat.fill(0); this.boss.fill(0); this.ranged.fill(0); this.nearest = undefined; this.best = Infinity;
    if (on && me) {
      camera.getWorldDirection(_f);
      const fx = _f.x, fz = _f.z, fl = Math.hypot(fx, fz) || 1, ax = fx / fl, az = fz / fl;
      const mark = (x: number, z: number, weight: number, boss: boolean, shot = false) => {
        _p.set(x, 1.1, z).project(camera);
        const behind = (x - camera.position.x) * ax + (z - camera.position.z) * az < 0;
        if (!behind && Math.abs(_p.x) < .92 && Math.abs(_p.y) < .92) return;
        const dx = x - me.x, dz = z - me.z;
        const ahead = dx * ax + dz * az, right = dx * -az + dz * ax;
        const sector = ((Math.round(Math.atan2(right, ahead) / (Math.PI * 2) * SECTORS) % SECTORS) + SECTORS) % SECTORS;
        this.heat[sector] += weight;
        if (boss) this.boss[sector] = 1;
        if (shot) this.ranged[sector] = 1;
        else if (Math.hypot(dx, dz) < this.best) { this.best = Math.hypot(dx, dz); this.nearest = { x, z }; }
      };
      for (let i = 0; i < HORDE_DOTS.n; i++) {
        if (!HORDE_DOTS.threat[i]) continue;
        const d = Math.hypot(HORDE_DOTS.x[i] - me.x, HORDE_DOTS.z[i] - me.z);
        const shot = HORDE_DOTS.threat[i] === 2, reach = shot ? GRUNT_REACH * 2 : GRUNT_REACH;
        if (d < reach) mark(HORDE_DOTS.x[i], HORDE_DOTS.z[i], .45 + (1 - d / reach) * .55 + (HORDE_DOTS.kind[i] ? .35 : 0), false, shot);
      }
      for (const boss of bosses ?? []) {
        if (boss.x === undefined || boss.z === undefined || boss.champion) continue;
        const d = Math.hypot(boss.x - me.x, boss.z - me.z);
        if (d < BOSS_REACH) mark(boss.x, boss.z, 1.2, true);
      }
    }
    const now = performance.now() / 1000, dt = Math.min(.1, Math.max(0, now - this.at)); this.at = now;
    for (let i = 0; i < SECTORS; i++) {
      this.shown[i] = Math.max(Math.min(1, this.heat[i]), this.shown[i] - dt * 1.4);
      const level = this.shown[i], el = this.marks[i];
      const text = level > .05 ? level.toFixed(2) : '';
      if (el.dataset.level !== text) { el.dataset.level = text; el.style.opacity = text ? String(Math.min(1, .5 + level * .6)) : '0'; }
      el.classList.toggle('boss', !!this.boss[i]);
      el.classList.toggle('shot', !this.boss[i] && !!this.ranged[i]);
    }
  }
  clear() { this.heat.fill(0); this.shown.fill(0); for (const el of this.marks) { el.style.opacity = '0'; el.dataset.level = ''; } }
}

export const THREAT_MARKS: { current?: ThreatMarks } = {};
