import * as THREE from 'three';
import type { CombatEvent } from '../game/types';

interface Burst { point: THREE.Vector3; born: number; life: number; size: number; colour: THREE.Color; upward: boolean; }

export class ClashEffects {
  private sparkGeometry = new THREE.PlaneGeometry(1, 1);
  private sparkMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false,
    uniforms: { clock: { value: 0 } },
    vertexShader: `varying vec2 p;varying vec3 tint;
      void main(){p=uv;tint=instanceColor;
      gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 p;varying vec3 tint;
      void main(){
        vec2 d=p-vec2(.5);
        float core=1.0-smoothstep(.0,.16,length(d));
        float streak=(1.0-smoothstep(.0,.06,abs(d.y)))*(1.0-smoothstep(.1,.5,abs(d.x)));
        float a=clamp(core+streak*.8,0.0,1.0);
        if(a<.01)discard;
        // The white centre goes past 1.0 so the bloom (threshold 1.1) catches
        // it; the coloured streak around it stays under, and stays readable.
        gl_FragColor=vec4(mix(tint,vec3(1.8,1.75,1.6),core*.8),a*.85);
      }`,
  });
  private sparks = new THREE.InstancedMesh(this.sparkGeometry, this.sparkMaterial, 320);
  private ringGeometry = new THREE.RingGeometry(.42, 1, 32);
  private spare: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private rings: { mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; born: number; life: number; size: number; flat: boolean }[] = [];
  private bursts: Burst[] = [];
  private seen = new Set<number>();
  private transform = new THREE.Object3D();
  private colour = new THREE.Color();
  private eye = new THREE.Vector3();

  constructor(private scene: THREE.Scene) {
    this.sparks.count = 0;
    this.sparks.setColorAt(0, new THREE.Color(0xffffff));
    this.sparks.frustumCulled = false;
    this.sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparks.name = 'clash-sparks';
    scene.add(this.sparks);
  }

  warmup() { this.spare.push(this.ring()); }
  hideWarmup() { for (const mesh of this.spare) mesh.visible = false; }

  private ring() {
    const mesh = this.spare.pop() ?? new THREE.Mesh(this.ringGeometry, new THREE.MeshBasicMaterial({
      color: 0xffffff, toneMapped: false, transparent: true, opacity: .9,
      depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }));
    mesh.visible = true; mesh.name = 'clash-ring';
    if (!mesh.parent) this.scene.add(mesh);
    return mesh;
  }

  private flash(point: THREE.Vector3, colour: number, size: number, life: number, now: number, flat = false) {
    const mesh = this.ring();
    mesh.material.color.set(colour);
    mesh.position.copy(point);
    mesh.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0);
    this.rings.push({ mesh, born: now, life, size, flat });
  }

  private spray(point: THREE.Vector3, colour: number, size: number, now: number, upward = false) {
    this.bursts.push({ point: point.clone(), born: now, life: .42, size,
      colour: new THREE.Color(colour), upward });
    if (this.bursts.length > 16) this.bursts.shift();
  }

  handle(events: readonly CombatEvent[]) {
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
      const at = event.origin ?? event.endpoint;
      if (!at) continue;
      const point = new THREE.Vector3(at.x, at.y, at.z);
      const now = event.serverTime;
      switch (event.kind) {
        case 'just-guard': break;
        case 'projectile-clash':
          this.flash(point, 0xffe9a8, 4.4, .5, now);
          this.spray(point, 0xfff4cf, 1.3, now);
          break;
        case 'wall-splat':
          this.spray(point, 0xcdd9e2, .9, now);
          break;
        case 'break':
          this.flash(point.setY(point.y + .2), 0xffd9a0, 3.4, .34, now);
          this.spray(point, 0xffe8c4, 1.1, now);
          break;
        case 'ground-bounce':
          this.flash(point, 0xd9cdb4, 3.6, .45, now, true);
          this.spray(point, 0xcfc2a6, 1, now, true);
          break;
        default: break;
      }
    }
  }

  update(time: number, camera?: THREE.Camera, density = 1) {
    this.sparkMaterial.uniforms.clock.value = time;
    this.facing = camera ? camera.getWorldPosition(this.eye) : undefined;
    this.count = 0;
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      const age = time - burst.born;
      if (age > burst.life || age < -1) { this.bursts.splice(i, 1); continue; }
      this.emit(time, burst.point, burst.colour, burst.size * (1 + age * 2.2), i * 7 + 1, burst.upward, density);
    }
    this.sparks.count = this.count;
    this.sparks.instanceMatrix.needsUpdate = true;
    if (this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate = true;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      const age = time - ring.born;
      if (age > ring.life || age < -1) {
        ring.mesh.visible = false; this.spare.push(ring.mesh); this.rings.splice(i, 1); continue;
      }
      const t = age / ring.life;
      ring.mesh.scale.setScalar(ring.size * (.3 + t * .9));
      ring.mesh.material.opacity = (1 - t) * .8;
      if (!ring.flat && camera) ring.mesh.quaternion.copy(camera.quaternion);
    }
  }
  private count = 0;
  private facing?: THREE.Vector3;

  private emit(time: number, point: THREE.Vector3, colour: THREE.Color, size: number, seed: number, upward: boolean, density: number) {
    const eye = this.facing;
    const facing = eye ? Math.atan2(eye.x - point.x, eye.z - point.z) : 0;
    const tongues = Math.max(2, Math.round(7 * density));
    for (let i = 0; i < tongues && this.count < 320; i++) {
      const phase = (time * 2.4 + i * .618 + seed) % 1;
      const angle = (i * 2.399963 + seed * 6.28) % 6.28318;
      const reach = size * (.25 + phase * .95);
      const rise = upward ? phase * size * 1.4 : Math.sin(angle * 2.1 + seed) * size * .55;
      this.transform.position.set(point.x + Math.cos(angle) * reach, point.y + rise, point.z + Math.sin(angle) * reach);
      this.transform.rotation.set(0, facing, angle);
      const scale = size * .34 * (1 - phase * .75);
      this.transform.scale.set(scale * 2.2, scale, 1);
      this.transform.updateMatrix();
      this.sparks.setMatrixAt(this.count, this.transform.matrix);
      this.sparks.setColorAt(this.count++, this.colour.copy(colour));
    }
  }

  reset() {
    for (const ring of this.rings) { ring.mesh.visible = false; this.spare.push(ring.mesh); }
    this.rings.length = 0;
    this.bursts.length = 0;
    this.sparks.count = 0;
    this.seen.clear();
  }

  dispose() {
    this.reset();
    for (const mesh of this.spare) { mesh.removeFromParent(); mesh.material.dispose(); }
    this.spare.length = 0;
    this.sparks.removeFromParent(); this.sparks.dispose();
    this.sparkGeometry.dispose(); this.sparkMaterial.dispose(); this.ringGeometry.dispose();
  }
}
