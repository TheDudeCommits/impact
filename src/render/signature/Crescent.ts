import * as THREE from 'three';
import { noiseGLSL } from '../vfx/noise';
import { skipHiddenChildren } from '../hiddenMatrices';

export const ENERGY = 0, DARK = 1;
export interface CrescentStyle { mode: number; edge: THREE.Color; body: THREE.Color; glow: THREE.Color; light: THREE.Color }
export const CRESCENT = {
  getsuga: { mode: DARK, edge: new THREE.Color(3.4, .5, .32), body: new THREE.Color(.012, .002, .004), glow: new THREE.Color(2.1, .12, .08), light: new THREE.Color(1.5, .2, .14) },
  mugetsu: { mode: DARK, edge: new THREE.Color(2.4, .16, .2), body: new THREE.Color(.004, .001, .003), glow: new THREE.Color(1.2, .05, .12), light: new THREE.Color(.8, .05, .12) },
  zoro: { mode: ENERGY, edge: new THREE.Color(2.4, 3.4, 2.1), body: new THREE.Color(.3, 1.45, .45), glow: new THREE.Color(.25, 1.6, .45), light: new THREE.Color(.4, 1.25, .5) },
} satisfies Record<string, CrescentStyle>;

export function crescentGeometry(arc = 1.1, thick = .36, wide = .42, segments = 44, around = 14) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments * 2 - 1, theta = u * arc, body = Math.max(0, 1 - u * u);
    const T = thick * Math.pow(body, .7) + .004, W = wide * Math.pow(body, .55) + .003;
    for (let j = 0; j <= around; j++) {
      const phi = j / around * Math.PI * 2, c = Math.cos(phi), s = Math.sin(phi);
      const r = 1 - T * .5 + T * .5 * c, z = W * .5 * s * (.2 + .8 * (1 - c) * .5);
      positions.push(r * Math.cos(theta), r * Math.sin(theta), z);
      uvs.push(u, (1 + c) * .5);
      if (i < segments && j < around) { const a = i * (around + 1) + j, b = a + around + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

const vertex = `uniform float uExpand;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position+normal*uExpand,1.);vV=-mv.xyz;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*mv;}`;
const fragment = `
uniform vec3 uEdge;uniform vec3 uBody;uniform vec3 uGlow;uniform float uFade;uniform float uTime;uniform float uSeed;uniform float uMode;uniform float uHeat;uniform float uExpand;
varying vec2 vUv;varying vec3 vN;varying vec3 vV;
${noiseGLSL}
void main(){
  float facing=abs(dot(normalize(vN),normalize(vV)));
  float rim=pow(1.-facing,1.7);
  float line=pow(1.-facing,4.);
  float u=vUv.x,lead=vUv.y;
  float n=snoise(vec3(u*5.+uSeed,lead*2.5-uTime*3.,uTime*.9));
  float m=snoise(vec3(u*13.-uSeed,lead*7.+uTime*5.,uTime*1.7));
  // The tips burn away rather than ending on a clean point.
  float tip=1.-smoothstep(.62,.98,abs(u)+n*.1+m*.05);
  if(tip<.01)discard;
  float edge=smoothstep(.8,.97,lead+n*.03);
  float back=1.-smoothstep(0.,.35,lead+m*.08);
  vec3 rgb;float alpha;
  if(uExpand>0.){
    // The hull: the same blade grown along its normals and drawn by its back
    // faces, so it shows only as a band round the body's silhouette - a
    // burning rim that holds from any side, torn by the noise into flame.
    float torn=smoothstep(-.35,.25,n+m*.5);
    rgb=uGlow*(1.1+.6*n)*uHeat*torn;alpha=0.;
  }else if(uMode>.5){
    // Black to the silhouette; only the last sliver of the rim burns.
    rgb=uBody+uGlow*line*(1.4+.5*n)*uHeat+uEdge*edge*(1.1+.4*m)*uHeat;
    alpha=.985-back*.12*(.5+.5*m);
  }else{
    rgb=uBody*(.55+.45*n)*(.55+.45*facing)+uGlow*rim*1.1+uEdge*(edge*1.35+rim*rim*.55);
    rgb*=uHeat;alpha=.32+.4*rim+.2*edge;
  }
  float seen=tip*uFade;
  gl_FragColor=vec4(rgb*seen,alpha*seen);
}`;
export function crescentMaterial() {
  return new THREE.ShaderMaterial({
    name: 'SignatureCrescent', vertexShader: vertex, fragmentShader: fragment,
    uniforms: { uEdge: { value: new THREE.Color() }, uBody: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uFade: { value: 0 }, uTime: { value: 0 }, uSeed: { value: 0 }, uMode: { value: 0 }, uHeat: { value: 1 }, uExpand: { value: 0 } },
    transparent: true, depthWrite: false, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
}

export class Crescents {
  readonly group = new THREE.Group();
  private meshes: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private hulls: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private count = 0;
  private drawn = false;
  private hullDrawn = false;
  constructor(scene: THREE.Scene, readonly geometry: THREE.BufferGeometry, capacity = 12, name = 'signature-crescent') {
    const base = crescentMaterial(); this.group.name = name + '-pool';
    skipHiddenChildren(this.group);
    for (let i = 0; i < capacity; i++) {
      const mesh = new THREE.Mesh(geometry, i ? base.clone() : base);
      mesh.name = name; mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.visible = i === 0;
      const hull = new THREE.Mesh(geometry, base.clone()); hull.material.side = THREE.BackSide;
      hull.name = name + '-rim'; hull.frustumCulled = false; hull.renderOrder = 3; hull.visible = false;
      this.meshes.push(mesh); this.hulls.push(hull); this.group.add(mesh, hull);
    }
    const first = this.meshes[0], hull = this.hulls[0]; first.position.set(0, -50, 0); first.scale.setScalar(.001);
    hull.position.copy(first.position); hull.scale.copy(first.scale); hull.visible = true;
    first.onAfterRender = () => { this.drawn = true; };
    hull.onAfterRender = () => { this.hullDrawn = true; };
    scene.add(this.group);
  }
  begin() { this.count = 0; }
  add(position: THREE.Vector3, quaternion: THREE.Quaternion, sx: number, sy: number, sz: number, style: CrescentStyle, fade: number, seed: number, time: number, heat = 1, rim = 0) {
    if (this.count >= this.meshes.length || fade <= .004) return;
    const index = this.count++;
    this.place(this.meshes[index], position, quaternion, sx, sy, sz, style, fade, seed, time, heat, 0);
    if (rim > 0) this.place(this.hulls[index], position, quaternion, sx, sy, sz, style, fade, seed, time, heat, rim); else this.hulls[index].visible = false;
  }
  private place(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>, position: THREE.Vector3, quaternion: THREE.Quaternion, sx: number, sy: number, sz: number, style: CrescentStyle, fade: number, seed: number, time: number, heat: number, rim: number) {
    const u = mesh.material.uniforms;
    mesh.position.copy(position); mesh.quaternion.copy(quaternion); mesh.scale.set(sx, sy, sz); mesh.visible = true;
    (u.uEdge.value as THREE.Color).copy(style.edge); (u.uBody.value as THREE.Color).copy(style.body); (u.uGlow.value as THREE.Color).copy(style.glow);
    u.uMode.value = style.mode; u.uFade.value = Math.min(1, fade); u.uTime.value = time; u.uSeed.value = seed % 97; u.uHeat.value = heat; u.uExpand.value = rim;
  }
  end() { for (let i = this.count; i < this.meshes.length; i++) { if (i || this.drawn) this.meshes[i].visible = false; if (i || this.hullDrawn) this.hulls[i].visible = false; } }
  dispose() { this.group.removeFromParent(); for (const m of [...this.meshes, ...this.hulls]) m.material.dispose(); this.geometry.dispose(); }
}
