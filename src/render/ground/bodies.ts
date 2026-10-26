import * as THREE from 'three';
import { resolveSkeleton } from '../skeleton';

export interface Foot { x: number; y: number; z: number; down: boolean; speed: number }

export interface Body {
  readonly id: string;
  x: number; y: number; z: number;
  vx: number; vz: number;
  yaw: number;
  hx: number; hy: number; hz: number;
  feet: [Foot, Foot];
  stepped: [boolean, boolean];
}

interface Rig { group: THREE.Object3D; hips?: THREE.Object3D; feet: [THREE.Object3D | undefined, THREE.Object3D | undefined]; body: Body }

const _v = new THREE.Vector3();
const FOOT_DOWN = .16, FOOT_STILL = 1.6;

export class Bodies {
  readonly list: Body[] = [];
  private readonly rigs = new Map<THREE.Object3D, Rig>();
  private frames = 0;
  private last = 0;

  update(scene: THREE.Scene, time: number): readonly Body[] {
    const dt = Math.min(.1, Math.max(1e-3, time - this.last)); this.last = time;
    if (this.frames++ % 20 === 0) this.rescan(scene);
    for (const rig of this.rigs.values()) this.read(rig, dt);
    return this.list;
  }

  private rescan(scene: THREE.Scene) {
    const seen = new Set<THREE.Object3D>();
    for (const child of scene.children) {
      if (!child.name.startsWith('fighter-') || child.name.startsWith('fighter-warm-')) continue;
      seen.add(child);
      if (!this.rigs.has(child)) this.rigs.set(child, this.rig(child));
    }
    for (const group of [...this.rigs.keys()]) if (!seen.has(group)) this.rigs.delete(group);
    this.list.length = 0;
    for (const rig of this.rigs.values()) this.list.push(rig.body);
  }

  private rig(group: THREE.Object3D): Rig {
    const bones = new Map<string, THREE.Object3D>();
    group.traverse(o => { if ((o as THREE.Bone).isBone && !bones.has(o.name)) bones.set(o.name, o); });
    const joints = resolveSkeleton(bones.keys());
    const bone = (canonical: string) => { const name = joints.get(canonical); return name ? bones.get(name) : undefined; };
    const p = group.position;
    const foot = (): Foot => ({ x: p.x, y: p.y, z: p.z, down: true, speed: 0 });
    return {
      group, hips: bone('Hips'), feet: [bone('LeftFoot'), bone('RightFoot')],
      body: { id: group.name.slice('fighter-'.length), x: p.x, y: p.y, z: p.z, vx: 0, vz: 0, yaw: group.rotation.y, hx: p.x, hy: p.y + 1, hz: p.z, feet: [foot(), foot()], stepped: [false, false] },
    };
  }

  private read(rig: Rig, dt: number) {
    const b = rig.body, g = rig.group;
    if (!g.visible) { b.stepped[0] = b.stepped[1] = false; return; }
    const p = g.position, k = 1 - Math.exp(-dt * 12);
    b.vx += ((p.x - b.x) / dt - b.vx) * k; b.vz += ((p.z - b.z) / dt - b.vz) * k;
    if (Math.hypot(p.x - b.x, p.z - b.z) > 3) { b.vx = b.vz = 0; }
    b.x = p.x; b.y = p.y; b.z = p.z; b.yaw = g.rotation.y;
    if (rig.hips) { _v.setFromMatrixPosition(rig.hips.matrixWorld); b.hx = _v.x; b.hy = _v.y; b.hz = _v.z; }
    else { b.hx = p.x; b.hy = p.y + 1; b.hz = p.z; }
    const grounded = p.y < .3;
    for (let i = 0; i < 2; i++) {
      const f = b.feet[i as 0 | 1], bone = rig.feet[i as 0 | 1];
      if (bone) _v.setFromMatrixPosition(bone.matrixWorld); else _v.set(p.x, p.y, p.z);
      f.speed = Math.hypot(_v.x - f.x, _v.z - f.z) / dt;
      f.x = _v.x; f.y = _v.y; f.z = _v.z;
      const down = grounded && f.y - p.y < FOOT_DOWN && f.speed < FOOT_STILL;
      b.stepped[i as 0 | 1] = down && !f.down;
      f.down = down;
    }
  }
}
