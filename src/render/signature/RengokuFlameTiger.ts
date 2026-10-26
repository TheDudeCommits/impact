import * as T from 'three';
import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';
import type { VfxKit } from '../vfx/VfxKit';
import { SignaturePoolUpload } from './SignaturePoolUpload';

export const RENGOKU_TIGER_ASSET = '/assets/vfx/rengoku/flame-tiger.webp';
export const RENGOKU_TIGER_LIMITS = Object.freeze({ impacts: 6, crescents: 12, lifetime: .65, radius: 3.5, loadTimeoutMs: 4000 });
let readyInstances = 0;
export const rengokuFlameTigerReady = (): boolean => readyInstances > 0;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const u = clamp(n); return u * u * (3 - 2 * u); };
const Z = new T.Vector3(0, 0, 1), RIGHT = new T.Vector3(1, 0, 0);

function crescentGeometry(): T.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i <= 28; i++) {
    const u = i / 28, a = (u - .5) * 4.6, thickness = Math.sin(u * Math.PI) * .065;
    for (const side of [-1, 1]) {
      const r = 1 + side * thickness;
      positions.push(Math.sin(a) * r, Math.cos(a) * r, 0); uvs.push(u, (side + 1) * .5);
    }
    if (i < 28) { const j = i * 2; indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  return geometry;
}

class TigerBatch {
  readonly mesh: T.InstancedMesh<T.BufferGeometry, T.ShaderMaterial>;
  private readonly tint: T.InstancedBufferAttribute;
  private readonly object = new T.Object3D();
  private readonly upload: SignaturePoolUpload;
  private used = 0;
  constructor(scene: T.Scene, name: string, geometry: T.BufferGeometry, private capacity: number, sprite: boolean) {
    this.tint = new T.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('tigerTint', this.tint);
    const material = new T.ShaderMaterial({ name, transparent: true, depthWrite: false, depthTest: true,
      side: T.DoubleSide, toneMapped: false, uniforms: { map: { value: null }, ready: { value: 0 } },
      vertexShader: sprite
        ? `attribute vec4 tigerTint;varying vec4 tint;varying vec2 tex;void main(){tint=tigerTint;tex=uv;vec4 p=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*p;}`
        : `attribute vec4 tigerTint;varying vec4 tint;varying vec2 tex;void main(){tint=tigerTint;tex=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: sprite
        ? `uniform sampler2D map;uniform float ready;varying vec4 tint;varying vec2 tex;void main(){if(ready<.5)discard;vec4 c=texture2D(map,tex);float a=c.a*tint.a;if(a<.015)discard;gl_FragColor=vec4(c.rgb*tint.rgb,a);\n#include <colorspace_fragment>\n}`
        : `varying vec4 tint;varying vec2 tex;void main(){float a=tint.a*sin(tex.x*3.14159265);if(a<.01)discard;vec3 c=mix(tint.rgb,vec3(1.,.93,.64),1.-smoothstep(.1,.8,abs(tex.y-.5)*2.));gl_FragColor=vec4(c,a);\n#include <colorspace_fragment>\n}` });
    material.forceSinglePass = true;
    this.mesh = new T.InstancedMesh(geometry, material, capacity);
    this.mesh.name = name; this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.upload = new SignaturePoolUpload(this.mesh, this.tint); scene.add(this.mesh);
  }
  begin() { this.used = 0; }
  add(at: T.Vector3, rotation: T.Quaternion, x: number, y: number, alpha: number, fire = false) {
    if (this.used >= this.capacity || alpha <= .005) return;
    this.object.position.copy(at); this.object.quaternion.copy(rotation); this.object.scale.set(x, y, 1); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.used, this.object.matrix);
    this.tint.setXYZW(this.used++, 1, fire ? .24 : 1, fire ? .025 : 1, clamp(alpha));
  }
  end() { this.upload.end(this.used); }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

type TigerImpact = { actor: string; born: number; radius: number; yaw: number; point: T.Vector3 };

export class RengokuFlameTiger {
  private readonly tiger: TigerBatch;
  private readonly crescents: TigerBatch;
  private readonly impacts: TigerImpact[] = Array.from({ length: RENGOKU_TIGER_LIMITS.impacts }, () => ({ actor: '', born: 0, radius: 0, yaw: 0, point: new T.Vector3() }));
  private readonly seenIds = new Float64Array(64).fill(NaN);
  private readonly seenTimes = new Float64Array(64).fill(NaN);
  private readonly point = new T.Vector3();
  private readonly rotation = new T.Quaternion();
  private readonly flat = new T.Quaternion().setFromAxisAngle(RIGHT, -Math.PI / 2);
  private cursor = 0; private seenCursor = 0;
  private texture?: T.Texture; private loading?: Promise<void>; private cancelLoad?: () => void;
  private ready = false; private disposed = false;

  constructor(scene: T.Scene, private readonly kit: Pick<VfxKit, 'budget'>) {
    this.tiger = new TigerBatch(scene, 'rengoku-flame-tiger', new T.PlaneGeometry(1, 1), RENGOKU_TIGER_LIMITS.impacts, true);
    this.crescents = new TigerBatch(scene, 'rengoku-tiger-crescents', crescentGeometry(), RENGOKU_TIGER_LIMITS.crescents, false);
  }

  load(ids: readonly string[]): Promise<void> {
    if (this.disposed || !ids.includes('rengoku')) return Promise.resolve();
    return this.loading ??= new Promise<void>(resolve => {
      let finished = false;
      const finish = (texture?: T.Texture) => {
        if (finished) { texture?.dispose(); return; }
        finished = true; clearTimeout(timer); this.cancelLoad = undefined;
        if (texture && !this.disposed) {
          texture.colorSpace = T.SRGBColorSpace; texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter;
          this.texture = texture; this.ready = true; readyInstances++;
          this.tiger.mesh.material.uniforms.map.value = texture; this.tiger.mesh.material.uniforms.ready.value = 1;
        } else texture?.dispose();
        resolve();
      };
      const timer = setTimeout(() => finish(), RENGOKU_TIGER_LIMITS.loadTimeoutMs);
      this.cancelLoad = () => finish();
      try { new T.TextureLoader().load(RENGOKU_TIGER_ASSET, finish, undefined, () => finish()); }
      catch { finish(); }
    });
  }

  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'winner') { this.reset(); return; }
    if (event.kind === 'eliminated' || event.kind === 'respawn'
      || ((event.kind === 'rejected' || event.kind === 'whiff') && event.slot === 'area')) {
      for (const impact of this.impacts) if (impact.actor === event.actorId) impact.actor = '';
      return;
    }
    if (!this.ready || event.fighter !== 'rengoku' || event.kind !== 'impact' || event.slot !== 'area' || event.branch || !event.endpoint) return;
    const at = event.endpoint;
    if (![at.x, at.y, at.z, event.id, event.serverTime].every(Number.isFinite)) return;
    for (let i = 0; i < this.seenIds.length; i++) if (this.seenIds[i] === event.id && this.seenTimes[i] === event.serverTime) return;
    const index = this.seenCursor++ % this.seenIds.length;
    this.seenIds[index] = event.id; this.seenTimes[index] = event.serverTime;
    const impact = this.impacts[this.cursor++ % this.impacts.length];
    impact.actor = event.actorId; impact.born = event.serverTime;
    impact.radius = Number.isFinite(event.radius) ? Math.min(RENGOKU_TIGER_LIMITS.radius, Math.max(.35, event.radius!)) : RENGOKU_TIGER_LIMITS.radius;
    impact.yaw = fighters?.get(event.actorId)?.state.yaw ?? 0;
    impact.point.set(at.x, at.y, at.z);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    this.tiger.begin(); this.crescents.begin();
    for (const impact of this.impacts) {
      if (!impact.actor) continue;
      const age = time - impact.born;
      if (!fighters.get(impact.actor)?.state.alive || age >= RENGOKU_TIGER_LIMITS.lifetime) { impact.actor = ''; continue; }
      if (age < 0 || !Number.isFinite(age)) continue;
      const u = age / RENGOKU_TIGER_LIMITS.lifetime;
      const alpha = smooth(age / .045) * (1 - smooth((age - .16) / .49));
      const width = impact.radius * (.78 + .22 * smooth(age / .13)), height = width / 1.5;
      this.point.copy(impact.point); this.point.y += height * .5 + .06;
      this.rotation.identity(); this.tiger.add(this.point, this.rotation, width, height, alpha * .92);
      this.point.copy(impact.point); this.point.y += .065;
      const size = impact.radius * (.50 + u * .25), count = this.kit.budget >= .65 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        this.rotation.setFromAxisAngle(Z, impact.yaw + i * Math.PI + u * (i ? -1.4 : 1.4)).premultiply(this.flat);
        this.crescents.add(this.point, this.rotation, size, size, alpha * .58, true);
      }
    }
    this.tiger.end(); this.crescents.end();
  }

  reset() {
    for (const impact of this.impacts) impact.actor = '';
    this.seenIds.fill(NaN); this.seenTimes.fill(NaN); this.cursor = this.seenCursor = 0;
    this.tiger.begin(); this.tiger.end(); this.crescents.begin(); this.crescents.end();
  }
  dispose() {
    if (this.disposed) return;
    this.reset(); this.disposed = true; this.cancelLoad?.();
    if (this.ready) { readyInstances--; this.ready = false; }
    this.texture?.dispose(); this.texture = undefined;
    this.tiger.dispose(); this.crescents.dispose();
  }
}
