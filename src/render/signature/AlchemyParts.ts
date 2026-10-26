import * as THREE from 'three';
import type { MoveStage, StageLook } from './MoveStage';
import { SignaturePoolUpload } from './SignaturePoolUpload';
import { bolt, polygon } from './StageStrokes';

const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _x = new THREE.Vector3(1, 0, 0), _z = new THREE.Vector3(0, 0, 1), _q = new THREE.Quaternion();
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
export const STONE = new THREE.Color(0x9a8972), STONE_DARK = new THREE.Color(0x5b5248);

function stoneGeometry() {
  const points: THREE.Vector3[] = [], rings = 6, sides = 7, radii = [.92, .76, 1, .71, .89, .80, .96];
  const levels = [-.5, -.34, -.08, .12, .34, .5], widths = [.90, 1, .78, .88, .52, .29];
  for (let row = 0; row < rings; row++) for (let i = 0; i < sides; i++) {
    const angle = i * TAU / sides + [0, .03, -.13, .06, -.08, .12][row], r = radii[(i + row % 2) % sides] * widths[row];
    const chip = row === 3 && i === 1 ? .48 : row === 4 && i === 5 ? .55 : 1;
    points.push(new THREE.Vector3(Math.cos(angle) * r * chip + Math.sin(row * 1.7) * .09, levels[row] + (row === 0 || row === rings - 1 ? 0 : Math.sin(i * 2.7 + row) * .044), Math.sin(angle) * r * chip + Math.cos(row * 1.3) * .065));
  }
  const vertices: number[] = [], bary: number[] = [];
  const tri = (a: number, b: number, c: number) => { for (const [i, k] of [[a, 0], [c, 1], [b, 2]]) { vertices.push(points[i].x, points[i].y, points[i].z); bary.push(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0); } };
  for (let row = 0; row < rings - 1; row++) for (let i = 0; i < sides; i++) { const next = (i + 1) % sides; tri(row * sides + i, row * sides + next, (row + 1) * sides + i); tri(row * sides + next, (row + 1) * sides + next, (row + 1) * sides + i); }
  for (let i = 1; i < sides - 1; i++) { tri(0, i + 1, i); tri((rings - 1) * sides, (rings - 1) * sides + i, (rings - 1) * sides + i + 1); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('rockBary', new THREE.Float32BufferAttribute(bary, 3)); geometry.computeVertexNormals();
  return geometry;
}

export class StoneBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly tint: THREE.InstancedBufferAttribute;
  private readonly upload: SignaturePoolUpload;
  private readonly object = new THREE.Object3D();
  private used = 0;
  constructor(scene: THREE.Scene, name: string, private readonly capacity: number) {
    const geometry = stoneGeometry();
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('alchemyTint', this.tint);
    const material = new THREE.ShaderMaterial({ name, transparent: true, depthWrite: true, forceSinglePass: true, side: THREE.FrontSide, toneMapped: false,
      vertexShader: 'attribute vec3 rockBary;varying vec3 vBary;varying vec3 vRock;attribute vec4 alchemyTint;varying vec4 vTint;varying vec3 vNormal;void main(){vBary=rockBary;vRock=position;vTint=alchemyTint;mat3 m=mat3(instanceMatrix);vec3 n=normal/vec3(dot(m[0],m[0]),dot(m[1],m[1]),dot(m[2],m[2]));vNormal=normalize(normalMatrix*m*n);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec3 vBary;varying vec3 vRock;varying vec4 vTint;varying vec3 vNormal;void main(){if(vTint.a<.005)discard;float n=dot(normalize(vNormal),normalize(vec3(.4,.7,.5)));float band=n>.3?1.:n>-.25?.78:.46;vec3 edge=smoothstep(vec3(0.),fwidth(vBary)*1.25,vBary);float ink=min(edge.x,min(edge.y,edge.z));float grain=fract(sin(dot(floor(vRock*vec3(33.,41.,37.)),vec3(12.9898,78.233,39.425)))*43758.5453);float chalk=.88+grain*.15;gl_FragColor=vec4(vTint.rgb*band*chalk*mix(.70,1.,ink),vTint.a);\n#include <colorspace_fragment>\n}' });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = name; this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.upload = new SignaturePoolUpload(this.mesh, this.tint);
    scene.add(this.mesh);
  }
  begin() { this.used = 0; }
  get count() { return this.used; }
  pillar(base: THREE.Vector3, dir: THREE.Vector3, width: number, height: number, turn = 0, color: THREE.Color = STONE, alpha = 1) {
    if (this.used >= this.capacity || alpha <= .005 || width <= .01 || height <= .01) return;
    const o = this.object;
    o.quaternion.setFromUnitVectors(UP, dir).multiply(_q.setFromAxisAngle(UP, turn));
    o.position.copy(base).addScaledVector(dir, height * .5); o.scale.set(width, height, width); o.updateMatrix();
    this.mesh.setMatrixAt(this.used, o.matrix); this.tint.setXYZW(this.used++, color.r, color.g, color.b, Math.min(1, alpha));
  }
  end() { this.upload.end(this.used); }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

export function transmutationCircle(st: MoveStage, at: THREE.Vector3, radius: number, look: StageLook, k: number, intensity = 1, spin = 0, weight = 1) {
  if (k <= .02 || intensity <= .02 || radius <= .05) return;
  _a.copy(at); _a.y += .05;
  const sides = st.n(24, 12), width = Math.max(.03, radius * .018) * weight, inner = radius * .74;
  const reach = Math.min(1, k * 1.6) * inner;
  polygon(st, _a, _x, _z, reach, 3, width, look.main, intensity, spin, look.heart);
  polygon(st, _a, _x, _z, reach, 3, width, look.main, intensity, spin + Math.PI, look.heart);
  if (k > .4) polygon(st, _a, _x, _z, inner, sides, width * .9, look.main, intensity * Math.min(1, (k - .4) / .2), spin, look.heart);
  if (k > .6) { const closed = Math.min(1, (k - .6) / .4); polygon(st, _a, _x, _z, radius, sides, width * 1.5, look.main, intensity * 1.1, -spin * .6, look.heart, 0, Math.max(1, Math.round(sides * closed))); }
}

export function reaction(st: MoveStage, at: THREE.Vector3, radius: number, height: number, look: StageLook, k: number, time: number, seed = 0, count = 6) {
  if (k <= .02) return;
  const tick = Math.floor(time * 30);
  for (let i = 0, n = st.n(count, 3); i < n; i++) {
    const slot = Math.floor((tick + i * 2) / 3), ang = hash(seed + i * 7.3 + slot * 1.9) * TAU, r = radius * Math.sqrt(hash(seed + i * 3.1 + slot * 2.7)), lean = (hash(seed + i + slot) - .5) * 1.2;
    _a.set(at.x + Math.cos(ang) * r, at.y + .04, at.z + Math.sin(ang) * r);
    _b.set(_a.x + Math.cos(ang + 1.7) * lean, at.y + height * (.35 + .65 * hash(seed + i * 5.9 + slot)), _a.z + Math.sin(ang + 1.7) * lean);
    bolt(st, _a, _b, .05, look.main, k * (.7 + .5 * hash(i + tick)), tick + i * 13, height * .16, 5, look.heart);
  }
}
