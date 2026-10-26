import * as THREE from 'three';

interface Request { x: number; y: number; z: number; r: number; g: number; b: number; intensity: number; distance: number; weight: number; taken: boolean }
const colour = new THREE.Color();
const EXPOSURE = 12;
const BODIES = 16, LOW = .3, HIGH = 1.6, RADIUS = .2;

export class LightPool {
  readonly lights: THREE.PointLight[];
  private requests: Request[] = Array.from({ length: 48 }, () => ({ x: 0, y: 0, z: 0, r: 0, g: 0, b: 0, intensity: 0, distance: 1, weight: 0, taken: false }));
  private n = 0;
  private bodies = new Float32Array(BODIES * 3);
  private bodyCount = 0;
  constructor(scene: THREE.Scene, count = 4) {
    this.lights = Array.from({ length: count }, (_, i) => {
      const light = new THREE.PointLight(0xffffff, 0, 8, 2);
      light.name = `vfx-light-${i}`; light.castShadow = false; scene.add(light); return light;
    });
  }

  request(x: number, y: number, z: number, hex: number, intensity: number, distance: number, priority = 1) {
    if (intensity <= .01 || this.n >= this.requests.length) return;
    const q = this.requests[this.n++];
    colour.setHex(hex);
    q.x = x; q.y = y; q.z = z; q.r = colour.r; q.g = colour.g; q.b = colour.b; q.intensity = intensity; q.distance = distance;
    q.weight = intensity * Math.sqrt(distance) * priority; q.taken = false;
  }

  body(i: number, x: number, y: number, z: number) {
    if (i >= BODIES) return;
    this.bodies[i * 3] = x; this.bodies[i * 3 + 1] = y; this.bodies[i * 3 + 2] = z; this.bodyCount = Math.max(this.bodyCount, i + 1);
  }
  bodiesDone(count: number) { this.bodyCount = Math.min(BODIES, count); }

  flush() {
    for (const light of this.lights) {
      let best = -1;
      for (let i = 0; i < this.n; i++) if (!this.requests[i].taken && (best < 0 || this.requests[i].weight > this.requests[best].weight)) best = i;
      if (best < 0) { light.intensity = 0; continue; }
      const q = this.requests[best]; q.taken = true;
      let cap = Infinity;
      for (let b = 0; b < this.bodyCount; b++) {
        const bx = this.bodies[b * 3], by = this.bodies[b * 3 + 1], bz = this.bodies[b * 3 + 2];
        const dy = q.y < by + LOW ? by + LOW - q.y : q.y > by + HIGH ? q.y - by - HIGH : 0;
        const d = Math.max(.25, Math.sqrt((q.x - bx) * (q.x - bx) + (q.z - bz) * (q.z - bz) + dy * dy) - RADIUS);
        cap = Math.min(cap, EXPOSURE * d * d);
      }
      light.position.set(q.x, q.y, q.z); light.color.setRGB(q.r, q.g, q.b); light.intensity = Math.min(q.intensity, cap); light.distance = q.distance;
    }
    this.n = 0;
  }

  clear() { this.n = 0; for (const light of this.lights) light.intensity = 0; }
  dispose() { for (const light of this.lights) light.removeFromParent(); }
}
