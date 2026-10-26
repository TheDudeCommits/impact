import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LegCapsules, type GarmentCollide } from '../src/render/look/garmentCollide';
import { SPRING_PROFILES, type SpringProfile } from '../src/render/SecondaryMotion';

class Before {
  private readonly joints: THREE.Object3D[][] = [];
  private readonly radii: number[] = [];
  private readonly from: THREE.Vector3[] = [];
  private readonly to: THREE.Vector3[] = [];
  private readonly feet: THREE.Object3D[] = [];
  private readonly sole: number;
  private floorY = -Infinity;
  private readonly foot = new THREE.Vector3();
  readonly ok: boolean;
  constructor(private readonly root: THREE.Object3D, private readonly spec: GarmentCollide) {
    const named = (name: string) => { let found: THREE.Object3D | undefined; root.traverse(o => { if (!found && o.name === name) found = o; }); return found; };
    for (const side of ['Left', 'Right']) {
      const hip = named(`${side}UpLeg`), knee = named(`${side}Leg`), ankle = named(`${side}Foot`);
      if (!hip || !knee || !ankle) continue;
      this.joints.push([hip, knee], [knee, ankle]); this.radii.push(spec.thigh, spec.shin);
      this.feet.push(ankle);
    }
    for (let i = 0; i < this.joints.length; i++) { this.from.push(new THREE.Vector3()); this.to.push(new THREE.Vector3()); }
    this.ok = this.joints.length === 4;
    root.updateMatrixWorld(true);
    const base = new THREE.Vector3(); root.getWorldPosition(base);
    let lowest = Infinity; for (const f of this.feet) lowest = Math.min(lowest, f.getWorldPosition(this.foot).y - base.y);
    this.sole = Number.isFinite(lowest) ? Math.max(0, lowest) : 0;
  }
  update() {
    if (!this.ok) return;
    for (let i = 0; i < this.joints.length; i++) { this.joints[i][0].getWorldPosition(this.from[i]); this.joints[i][1].getWorldPosition(this.to[i]); }
    let lowest = Infinity; for (const f of this.feet) lowest = Math.min(lowest, f.getWorldPosition(this.foot).y);
    this.floorY = Math.min(lowest - this.sole, this.root.getWorldPosition(this.foot).y) + this.spec.floor;
  }
  pushLink(head: THREE.Vector3, tail: THREE.Vector3, length: number) {
    const _closest = new THREE.Vector3(), _away = new THREE.Vector3(), _segment = new THREE.Vector3();
    if (!this.ok) return false;
    let moved = false;
    for (let pass = 0; pass < 3; pass++) {
      let any = false;
      for (let i = 0; i < this.joints.length; i++) {
        const a = this.from[i], r = this.radii[i];
        _segment.subVectors(this.to[i], a);
        const span = _segment.lengthSq();
        const t = span > 1e-9 ? THREE.MathUtils.clamp(_away.subVectors(tail, a).dot(_segment) / span, 0, 1) : 0;
        _closest.copy(a).addScaledVector(_segment, t);
        _away.subVectors(tail, _closest);
        const d = _away.length();
        if (d >= r) continue;
        if (d > 1e-5) _away.divideScalar(d); else { _away.set(head.x - _closest.x, 0, head.z - _closest.z); if (_away.lengthSq() < 1e-8) _away.set(1, 0, 0); _away.normalize(); }
        tail.copy(_closest).addScaledVector(_away, r);
        any = true;
      }
      if (!any) break;
      moved = true;
      _away.subVectors(tail, head); const reach = _away.length();
      if (reach > 1e-6) tail.copy(head).addScaledVector(_away, length / reach);
    }
    if (tail.y < this.floorY) {
      const rise = THREE.MathUtils.clamp((this.floorY - head.y) / length, -1, .95);
      _away.set(tail.x - head.x, 0, tail.z - head.z);
      if (_away.lengthSq() < 1e-10) _away.set(1, 0, 0);
      _away.normalize().multiplyScalar(Math.sqrt(1 - rise * rise) * length);
      tail.set(head.x + _away.x, head.y + rise * length, head.z + _away.z);
      moved = true;
    }
    return moved;
  }
}

function legs(seed: number) {
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const root = new THREE.Group();
  for (const [side, x] of [['Left', .1], ['Right', -.1]] as const) {
    const hip = new THREE.Bone(); hip.name = `${side}UpLeg`; hip.position.set(x, .95, 0); root.add(hip);
    const knee = new THREE.Bone(); knee.name = `${side}Leg`; knee.position.set(0, -.45, 0); hip.add(knee);
    const ankle = new THREE.Bone(); ankle.name = `${side}Foot`; ankle.position.set(0, -.42, 0); knee.add(ankle);
    const toe = new THREE.Bone(); toe.name = `${side}ToeBase`; toe.position.set(0, -.06, .14); ankle.add(toe);
    hip.rotation.set((r() - .5) * 1.6, (r() - .5) * .6, (r() - .5) * .5);
    knee.rotation.set(r() * 1.4, 0, 0);
    ankle.rotation.set((r() - .5) * .8, 0, 0);
  }
  root.updateMatrixWorld(true);
  return { root, r };
}
function specs() {
  const out: [string, GarmentCollide][] = [];
  for (const [id, profile] of Object.entries(SPRING_PROFILES) as [string, Partial<SpringProfile>][]) {
    if (profile.legs) out.push([id, profile.legs]);
    for (const chain of profile.chains ?? []) if (chain.profile.legs) out.push([`${id} ${chain.match}`, chain.profile.legs]);
  }
  return out;
}

describe('the foot capsule round a garment\'s links', () => {
  it('is set by Griffith\'s cape alone: every other garment\'s legs spec is as it was', () => {
    const footed = specs().filter(([, spec]) => spec.foot !== undefined).map(([where]) => where);
    expect(footed).toEqual(['griffith /^Detail_CLOTH_griffith(-femto)?_hem_/']);
    expect(specs().length).toBeGreaterThan(footed.length);
  });

  it('collides a garment without it exactly as the code before it did, link for link', () => {
    const plain: GarmentCollide[] = [...specs().filter(([, spec]) => spec.foot === undefined).map(([, spec]) => spec),
      { thigh: .1, shin: .085, floor: .015 }, { thigh: .12, shin: .15, floor: .015 }];
    let compared = 0;
    for (const spec of plain) for (let seed = 1; seed <= 25; seed++) {
      const { root, r } = legs(seed * 7919);
      const now = new LegCapsules(root, spec), then = new Before(root, spec);
      now.update(); then.update();
      expect(now.ok).toBe(then.ok);
      for (let k = 0; k < 40; k++) {
        const head = new THREE.Vector3((r() - .5) * .6, .3 + r() * .9, (r() - .5) * .6);
        const length = .05 + r() * .3;
        const tail = head.clone().add(new THREE.Vector3(r() - .5, -r(), r() - .5).normalize().multiplyScalar(length));
        const a = tail.clone(), b = tail.clone();
        expect(now.pushLink(head, a, length)).toBe(then.pushLink(head, b, length));
        expect(a.toArray()).toEqual(b.toArray());
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(1000);
  });

  it('keeps a link out of the boot where a garment asks for it', () => {
    const { root } = legs(3);
    const capsules = new LegCapsules(root, { thigh: .1, shin: .085, floor: .015, foot: .12 });
    capsules.update();
    const ankle = root.getObjectByName('LeftFoot')!.getWorldPosition(new THREE.Vector3());
    const toe = root.getObjectByName('LeftToeBase')!.getWorldPosition(new THREE.Vector3());
    const middle = ankle.clone().lerp(toe, .5);
    const head = middle.clone().add(new THREE.Vector3(0, .3, -.15)), tail = middle.clone().add(new THREE.Vector3(0, .02, 0));
    const length = head.distanceTo(tail);
    expect(capsules.pushLink(head, tail, length)).toBe(true);
    const segment = new THREE.Line3(ankle, toe), closest = segment.closestPointToPoint(tail, true, new THREE.Vector3());
    expect(tail.distanceTo(closest), 'pushed out of the boot from 2 cm').toBeGreaterThan(.1);
    expect(tail.distanceTo(head)).toBeCloseTo(length, 5);
  });
});
