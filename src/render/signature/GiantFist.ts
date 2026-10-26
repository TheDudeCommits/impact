import * as THREE from 'three';
import { fireFistGeometry } from '../vfx/FireFistGeometry';

const toonVertex = `uniform float uSquash;varying vec3 vN;varying vec3 vV;varying vec3 vP;
void main(){vec3 p=position;p.z*=1.-uSquash*.35;p.xy*=1.+uSquash*.22;vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(p,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const toonFragment = `uniform vec3 uHeat;uniform float uTime;varying vec3 vN;varying vec3 vV;varying vec3 vP;
void main(){
  vec3 n=normalize(vN),v=normalize(vV);
  float key=dot(n,normalize(vec3(.35,.8,.45)));
  // Three flat bands of Busoshoku black-crimson: cel shading, not a gradient.
  vec3 col=key>.55?vec3(.3,.045,.04):key>.05?vec3(.13,.018,.02):vec3(.035,.008,.012);
  // The Haki's flame pattern, licking back from the knuckles.
  float lick=sin(vP.x*5.+sin(vP.z*3.+uTime*2.)*1.5)+sin(vP.z*4.-uTime*3.+vP.y*3.);
  col=mix(col,vec3(.55,.08,.03)*(.7+.3*key),smoothstep(1.1,1.5,lick)*.8);
  // The Haki shine: one hard highlight band.
  float shine=smoothstep(.93,.97,dot(n,normalize(v+vec3(.3,.9,.2))));
  col+=vec3(.8,.45,.4)*shine;
  // A thin hot edge only: the fist is long and seen side-on, so most of it
  // is at a grazing angle and a broad fresnel lit the whole of it orange.
  float rim=smoothstep(.8,.97,1.-max(0.,dot(n,v)));
  col+=uHeat*rim*.7*(1.+.25*sin(uTime*23.));
  gl_FragColor=vec4(col,1.);
}`;
const inkVertex = `uniform float uSquash;uniform float uWidth;uniform vec2 uViewport;
void main(){vec3 p=position;p.z*=1.-uSquash*.35;p.xy*=1.+uSquash*.22;vec4 clip=projectionMatrix*modelViewMatrix*vec4(p,1.);
  vec2 d=(projectionMatrix*vec4(normalize(normalMatrix*normal),0.)).xy;float l=length(d);
  if(l>1e-5)clip.xy+=d/l*uWidth*2./uViewport*clip.w;clip.z+=.0004*clip.w;gl_Position=clip;}`;
const viewport = new THREE.Vector4();
type Fist = { group: THREE.Group; fist: THREE.Mesh; fistInk: THREE.Mesh; arm: THREE.Mesh; armInk: THREE.Mesh; busy: boolean; shown: boolean };

export class GiantFists {
  private fistGeometry: THREE.BufferGeometry;
  private ownGeometry: boolean;
  private armGeometry = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).rotateX(Math.PI / 2);
  readonly material: THREE.ShaderMaterial;
  private ink: THREE.ShaderMaterial;
  private pool: Fist[] = [];
  private live = new Map<string, Fist>();
  private toward = new THREE.Vector3(); private mid = new THREE.Vector3();
  private forward = new THREE.Vector3(0, 0, 1);
  constructor(scene: THREE.Scene, capacity = 2, geometry?: THREE.BufferGeometry) {
    this.ownGeometry = !geometry; this.fistGeometry = geometry ?? fireFistGeometry();
    this.material = new THREE.ShaderMaterial({ name: 'GiantFist', vertexShader: toonVertex, fragmentShader: toonFragment, toneMapped: false,
      uniforms: { uHeat: { value: new THREE.Color(2.4, .35, .1) }, uTime: { value: 0 }, uSquash: { value: 0 } } });
    this.ink = new THREE.ShaderMaterial({ name: 'GiantFistInk', vertexShader: inkVertex, fragmentShader: 'void main(){gl_FragColor=vec4(.02,.01,.02,1.);}', side: THREE.BackSide,
      uniforms: { uSquash: { value: 0 }, uWidth: { value: 3 }, uViewport: { value: new THREE.Vector2(1600, 900) } } });
    for (let i = 0; i < capacity; i++) {
      const group = new THREE.Group(); group.name = 'luffy-giant-fist'; group.visible = i === 0;
      const material = i ? this.material.clone() : this.material, ink = i ? this.ink.clone() : this.ink;
      const fist = new THREE.Mesh(this.fistGeometry, material), fistInk = new THREE.Mesh(this.fistGeometry, ink);
      const arm = new THREE.Mesh(this.armGeometry, material), armInk = new THREE.Mesh(this.armGeometry, ink);
      fistInk.onBeforeRender = renderer => { renderer.getCurrentViewport(viewport); if (viewport.w > 0) (ink.uniforms.uViewport.value as THREE.Vector2).set(viewport.z, viewport.w); };
      for (const m of [fist, fistInk, arm, armInk]) { m.frustumCulled = false; m.castShadow = false; }
      group.add(fist, fistInk, arm, armInk); scene.add(group);
      this.pool.push({ group, fist, fistInk, arm, armInk, busy: false, shown: false });
    }
    const first = this.pool[0]; first.group.position.set(0, -50, 0); first.group.scale.setScalar(.001);
    first.fist.onAfterRender = () => { if (!first.busy) first.group.visible = false; first.fist.onAfterRender = () => {}; };
  }
  begin(time: number) { for (const f of this.live.values()) f.shown = false; for (const f of this.pool) ((f.fist.material as THREE.ShaderMaterial).uniforms.uTime.value = time); }
  show(id: string, at: THREE.Vector3, aim: THREE.Vector3, size: number, shoulder: THREE.Vector3 | null, squash = 0) {
    let f = this.live.get(id);
    if (!f) { f = this.pool.find(p => !p.busy) ?? this.pool[0]; f.busy = true; this.live.set(id, f); }
    f.shown = true; f.group.visible = true; f.group.position.set(0, 0, 0); f.group.scale.setScalar(1);
    f.fist.position.copy(at); f.fist.quaternion.setFromUnitVectors(this.forward, aim); f.fist.scale.setScalar(size);
    f.fistInk.position.copy(at); f.fistInk.quaternion.copy(f.fist.quaternion); f.fistInk.scale.copy(f.fist.scale);
    (f.fist.material as THREE.ShaderMaterial).uniforms.uSquash.value = squash; (f.fistInk.material as THREE.ShaderMaterial).uniforms.uSquash.value = squash;
    const wrist = this.toward.copy(aim).multiplyScalar(-1.2 * size).add(at);
    const showArm = !!shoulder && shoulder.distanceTo(wrist) > .2;
    f.arm.visible = f.armInk.visible = showArm;
    if (showArm) {
      this.mid.copy(shoulder!).add(wrist).multiplyScalar(.5);
      const length = shoulder!.distanceTo(wrist), thick = .32 * Math.sqrt(size) + .12;
      f.arm.position.copy(this.mid); f.arm.lookAt(wrist); f.arm.scale.set(thick, thick, length);
      f.armInk.position.copy(f.arm.position); f.armInk.quaternion.copy(f.arm.quaternion); f.armInk.scale.copy(f.arm.scale);
    }
  }
  end() { for (const [id, f] of this.live) if (!f.shown) { f.busy = false; f.group.visible = false; this.live.delete(id); } }
  reset() { for (const f of this.live.values()) { f.busy = false; f.group.visible = false; } this.live.clear(); }
  dispose() { this.reset(); for (const f of this.pool) { f.group.removeFromParent(); (f.fist.material as THREE.Material).dispose(); (f.fistInk.material as THREE.Material).dispose(); } if (this.ownGeometry) this.fistGeometry.dispose(); this.armGeometry.dispose(); }
}
