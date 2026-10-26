import { AREA_DEFAULTS } from '../engine/sim/areaMoves';

export type AimSource = 'pad' | 'keyboard' | 'touch';
export interface AimPoint { x: number; z: number }
export interface AreaAimView {
  active: boolean;
  source?: AimSource;
  x: number; z: number;
  fromX: number; fromZ: number;
  range: number; radius: number;
  valid: boolean;
}

const forwardOf = (yaw: number) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
const rightOf = (yaw: number) => ({ x: -Math.cos(yaw), z: Math.sin(yaw) });

export class AreaAim {
  readonly view: AreaAimView = { active: false, x: 0, z: 0, fromX: 0, fromZ: 0, range: AREA_DEFAULTS.range, radius: AREA_DEFAULTS.radius, valid: false };
  private placed = false;
  private share?: { right: number; forward: number };

  get active() { return this.view.active; }

  begin(source: AimSource) {
    this.view.active = true; this.view.source = source; this.placed = false; this.share = undefined;
  }
  cancel() { this.view.active = false; this.view.source = undefined; this.placed = false; this.share = undefined; }
  release(): AimPoint | undefined {
    if (!this.view.active) return undefined;
    const point = this.placed && this.view.valid ? { x: this.view.x, z: this.view.z } : undefined;
    this.cancel();
    return point;
  }

  follow(caster: AimPoint, viewYaw: number, target: AimPoint | undefined, range: number, radius: number, valid: boolean) {
    const v = this.view;
    v.fromX = caster.x; v.fromZ = caster.z; v.range = range; v.radius = radius; v.valid = valid;
    if (!v.active) return;
    if (!this.placed) {
      this.placed = true;
      if (target && Math.hypot(target.x - caster.x, target.z - caster.z) <= range) { v.x = target.x; v.z = target.z; }
      else { const f = forwardOf(viewYaw), d = Math.min(AREA_DEFAULTS.aim, range); v.x = caster.x + f.x * d; v.z = caster.z + f.z * d; }
    }
    if (this.share) {
      const f = forwardOf(viewYaw), r = rightOf(viewYaw);
      v.x = caster.x + (f.x * this.share.forward + r.x * this.share.right) * range;
      v.z = caster.z + (f.z * this.share.forward + r.z * this.share.right) * range;
    }
    this.clamp();
  }

  nudge(right: number, forward: number, viewYaw: number) {
    if (!this.view.active || !this.placed || !Number.isFinite(right) || !Number.isFinite(forward)) return;
    const f = forwardOf(viewYaw), r = rightOf(viewYaw);
    this.view.x += f.x * forward + r.x * right; this.view.z += f.z * forward + r.z * right;
    this.share = undefined;
    this.clamp();
  }

  place(right: number, forward: number) {
    if (!this.view.active || !Number.isFinite(right) || !Number.isFinite(forward)) return;
    const length = Math.hypot(right, forward), k = length > 1 ? 1 / length : 1;
    this.share = { right: right * k, forward: forward * k };
    this.placed = true;
  }

  private clamp() {
    const v = this.view, dx = v.x - v.fromX, dz = v.z - v.fromZ, d = Math.hypot(dx, dz);
    if (d > v.range && d > 0) { v.x = v.fromX + dx / d * v.range; v.z = v.fromZ + dz / d * v.range; }
  }
}
