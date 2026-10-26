import * as THREE from 'three';
import { noiseGLSL } from '../vfx/noise';

export interface SphereStyle { body: THREE.Color; core: THREE.Color; rimA: THREE.Color; rimB: THREE.Color; spin: number }
export const SPHERES = {
  blue: { body: new THREE.Color(.04, .32, 1.5), core: new THREE.Color(1.1, 1.9, 2.8), rimA: new THREE.Color(.4, 1.4, 2.6), rimB: new THREE.Color(.9, 1.8, 2.8), spin: -1 },
  red: { body: new THREE.Color(1.5, .1, .07), core: new THREE.Color(2.8, 1.5, 1.0), rimA: new THREE.Color(2.6, .5, .3), rimB: new THREE.Color(2.8, 1.1, .5), spin: 1 },
  purple: { body: new THREE.Color(.34, .05, .78), core: new THREE.Color(1.9, 1.3, 2.6), rimA: new THREE.Color(2.4, .3, .45), rimB: new THREE.Color(.4, .75, 2.6), spin: 1.4 },
} satisfies Record<string, SphereStyle>;
const vertex = `varying vec3 vN;varying vec3 vV;varying vec3 vP;
void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const fragment = `
uniform vec3 uBody;uniform vec3 uCore;uniform vec3 uRimA;uniform vec3 uRimB;uniform float uTime;uniform float uSeed;uniform float uFade;uniform float uSpin;
varying vec3 vN;varying vec3 vV;varying vec3 vP;
${noiseGLSL}
void main(){
  vec3 n=normalize(vN),v=normalize(vV);float facing=max(0.,dot(n,v));
  vec3 p=normalize(vP);
  float churn=snoise(p*2.6+vec3(uSeed,uTime*1.6*uSpin,-uTime*.7));
  float fine=snoise(p*7.+vec3(-uTime*2.,uSeed,uTime*1.3));
  float bands=sin(atan(p.z,p.x)*5.+p.y*8.-uTime*9.*uSpin+churn*3.);
  float lines=smoothstep(.55,.97,bands)*(.6+.4*fine);
  // A body with shading, bands of brighter energy across it and only a small
  // white-hot heart: a sphere, not a bloom.
  float key=.55+.45*clamp(n.y*.6+n.x*.2+.4,0.,1.);
  vec3 col=uBody*(.45+.55*churn*.5+.5)*key+uBody*lines*1.8+uCore*pow(facing,10.)*(1.+.3*fine);
  float rim=pow(1.-facing,2.4);
  col+=mix(uRimA,uRimB,smoothstep(-.35,.35,n.x))*rim*1.9;
  float ink=1.-smoothstep(.0,.13,facing);
  col=mix(col,vec3(.02,.004,.04),ink*.9);
  gl_FragColor=vec4(col*uFade,uFade);
}`;
export function energySphereMaterial() {
  return new THREE.ShaderMaterial({
    name: 'SignatureEnergySphere', vertexShader: vertex, fragmentShader: fragment, toneMapped: false, transparent: true, depthWrite: true,
    uniforms: { uBody: { value: new THREE.Color() }, uCore: { value: new THREE.Color() }, uRimA: { value: new THREE.Color() }, uRimB: { value: new THREE.Color() }, uTime: { value: 0 }, uSeed: { value: 0 }, uFade: { value: 1 }, uSpin: { value: 1 } },
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
}

export class EnergySpheres {
  private meshes: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>[] = [];
  private geometry = new THREE.SphereGeometry(1, 40, 28);
  private count = 0;
  private drawn = false;
  constructor(scene: THREE.Scene, capacity = 8, name = 'signature-energy-sphere') {
    const base = energySphereMaterial();
    for (let i = 0; i < capacity; i++) {
      const mesh = new THREE.Mesh(this.geometry, i ? base.clone() : base);
      mesh.name = name; mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.visible = i === 0; scene.add(mesh); this.meshes.push(mesh);
    }
    const first = this.meshes[0]; first.position.set(0, -50, 0); first.scale.setScalar(.001); first.onAfterRender = () => { this.drawn = true; };
  }
  begin() { this.count = 0; }
  add(position: THREE.Vector3, radius: number, style: SphereStyle, time: number, seed = 0, fade = 1) {
    if (this.count >= this.meshes.length || radius <= .005 || fade <= .01) return;
    const mesh = this.meshes[this.count++], u = mesh.material.uniforms;
    mesh.position.copy(position); mesh.scale.setScalar(radius); mesh.rotation.set(0, time * .5 * style.spin, 0); mesh.visible = true;
    (u.uBody.value as THREE.Color).copy(style.body); (u.uCore.value as THREE.Color).copy(style.core); (u.uRimA.value as THREE.Color).copy(style.rimA); (u.uRimB.value as THREE.Color).copy(style.rimB);
    u.uTime.value = time; u.uSeed.value = seed % 31; u.uFade.value = Math.min(1, fade); u.uSpin.value = style.spin;
    mesh.material.depthWrite = fade > .9;
  }
  end() { for (let i = this.count; i < this.meshes.length; i++) if (i || this.drawn) this.meshes[i].visible = false; }
  dispose() { for (const m of this.meshes) { m.removeFromParent(); m.material.dispose(); } this.geometry.dispose(); }
}
