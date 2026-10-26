import * as THREE from 'three';
import { noiseGLSL } from '../vfx/noise';

const common = `
uniform vec3 uCenter;uniform float uTime;uniform float uBright;uniform float uRadius;uniform float uFloor;
${noiseGLSL}
float h1(float n){return fract(sin(n*127.1)*43758.5453);}
float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
vec3 space(vec3 ray,vec3 d){
  vec3 cell=floor(d*46.);float h=h3(cell);vec3 f=fract(d*46.)-.5;
  float star=step(.972,h)*(1.-smoothstep(.03,.16,length(f)))*(.6+.4*sin(uTime*3.+h*40.));
  vec3 fine=floor(d*120.);vec3 g=fract(d*120.)-.5;
  float dust=step(.988,h3(fine))*(1.-smoothstep(.04,.22,length(g)))*.55;
  vec3 toC=normalize(uCenter-cameraPosition);
  vec3 u=normalize(cross(toC,abs(toC.y)>.95?vec3(1.,0.,0.):vec3(0.,1.,0.)));vec3 v=cross(u,toC);
  float ang=acos(clamp(dot(ray,toC),-1.,1.));float phi=atan(dot(ray,v),dot(ray,u));
  float lanes=(phi+3.14159)/6.28318*96.;float lane=floor(lanes);float lh=h1(lane);
  float thin=1.-smoothstep(.0,.42,abs(fract(lanes)-.5));
  float seg=fract(ang*1.3+uTime*(.5+lh*.9)+lh*7.);
  float stream=thin*step(.72,lh)*smoothstep(0.,.08,seg)*(1.-smoothstep(.12,.5,seg))*smoothstep(.05,.5,ang);
  float rays=pow(.5+.5*sin(phi*17.+snoise(vec3(phi*2.,uTime*.3,1.))*2.5),5.)*exp(-ang*2.3);
  float core=exp(-ang*3.6);
  vec3 cyan=vec3(.35,1.,1.9),violet=vec3(.9,.35,1.9);
  vec3 col=vec3(.004,.003,.012)+mix(violet,cyan,core)*(core*.6+rays*.4)*uBright;
  col+=vec3(1.5,1.5,1.7)*star+vec3(.9,.95,1.2)*dust+mix(vec3(.8,.9,1.6),vec3(1.4,1.2,2.),lh)*stream*1.1;
  return col;
}
vec3 mirror(vec3 ray,vec3 at){
  float r=length(at.xz-uCenter.xz);
  vec3 refl=vec3(ray.x,-ray.y,ray.z);
  vec3 col=space(refl,normalize(refl))*.32;
  col+=vec3(.35,.7,1.4)*pow(.5+.5*sin(r*3.2-uTime*4.),18.)*exp(-r*.22)*.5*uBright;
  col+=vec3(.6,.35,1.4)*smoothstep(uRadius*.9,uRadius,r)*.35;
  return col;
}
/** Where a ray from the eye leaves the Domain's sphere; the floor or space along it. */
float exitAt(vec3 ray){vec3 o=cameraPosition-uCenter;float b=dot(o,ray),c=dot(o,o)-uRadius*uRadius,h=b*b-c;return h<0.?0.:-b+sqrt(h);}
vec3 voidAlong(vec3 ray){
  float t=exitAt(ray);
  if(ray.y<-1e-4){float tf=(uFloor-cameraPosition.y)/ray.y;if(tf>0.&&tf<t)return mirror(ray,cameraPosition+ray*tf);}
  vec3 at=cameraPosition+ray*t;return space(ray,normalize(at-uCenter));
}`;
const quadVertex = `varying vec2 vNdc;void main(){vNdc=position.xy;gl_Position=vec4(position.xy,0.,1.);}`;
const quadFragment = `${common}
uniform mat4 uInvProjection;uniform mat4 uCameraWorld;uniform float uInside;
varying vec2 vNdc;
void main(){
  if(uInside<.5)discard;
  vec4 v=uInvProjection*vec4(vNdc,1.,1.);
  vec3 ray=normalize(mat3(uCameraWorld)*normalize(v.xyz/v.w));
  gl_FragColor=vec4(voidAlong(ray),1.);
}`;
const meshVertex = `varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const shellFragment = `${common}
uniform float uInside;varying vec3 vWorld;
void main(){
  if(uInside>.5)discard;
  vec3 ray=normalize(vWorld-cameraPosition);
  gl_FragColor=vec4(voidAlong(ray),1.);
}`;
const floorFragment = `${common}
varying vec3 vWorld;
void main(){
  if(length(vWorld.xz-uCenter.xz)>uRadius)discard;
  vec3 ray=normalize(vWorld-cameraPosition);
  gl_FragColor=vec4(mirror(ray,vWorld),1.);
}`;

type Void = { meshes: THREE.Mesh[]; materials: THREE.ShaderMaterial[]; busy: boolean; shown: boolean };
const eye = new THREE.Vector3();
const ROOM = (name: string) => name === 'MangaHarborEnvironment' || name.startsWith('Stage:') || name === 'look-sky' || name === 'look-atmosphere';

export class InfiniteVoid {
  private quad = new THREE.PlaneGeometry(2, 2);
  private sphereGeometry = new THREE.SphereGeometry(1, 48, 32);
  private floorGeometry = new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2);
  private pool: Void[] = [];
  private live = new Map<string, Void>();
  private eye = new THREE.Vector3(0, 1e6, 0);
  private hidden: THREE.Object3D[] = [];
  constructor(private scene: THREE.Scene, capacity = 2) {
    for (let i = 0; i < capacity; i++) this.pool.push(this.make());
    const first = this.pool[0];
    for (const m of first.meshes) { m.visible = true; m.scale.setScalar(.001); m.position.set(0, -60, 0); }
    first.meshes[2].onAfterRender = () => { if (!first.busy) this.hide(first); first.meshes[2].onAfterRender = () => {}; };
  }
  private material(vertex: string, fragment: string, extra: Partial<THREE.ShaderMaterialParameters>) {
    return new THREE.ShaderMaterial({
      name: 'InfiniteVoid', vertexShader: vertex, fragmentShader: fragment, toneMapped: false, fog: false,
      uniforms: { uCenter: { value: new THREE.Vector3() }, uTime: { value: 0 }, uBright: { value: 1 }, uRadius: { value: 1 }, uFloor: { value: 0 },
        uInvProjection: { value: new THREE.Matrix4() }, uCameraWorld: { value: new THREE.Matrix4() }, uInside: { value: 0 } },
      ...extra,
    });
  }
  private make(): Void {
    const materials = [
      this.material(quadVertex, quadFragment, { depthTest: false, depthWrite: false }),
      this.material(meshVertex, floorFragment, {}),
      this.material(meshVertex, shellFragment, { side: THREE.BackSide }),
    ];
    const names = ['infinite-void-backdrop', 'infinite-void-floor', 'infinite-void-shell'];
    const geometries = [this.quad, this.floorGeometry, this.sphereGeometry];
    const orders = [-2, -1, -1];
    const v: Void = { meshes: [], materials, busy: false, shown: false };
    materials.forEach((material, i) => {
      const mesh = new THREE.Mesh(geometries[i], material); mesh.name = names[i]; mesh.renderOrder = orders[i];
      mesh.frustumCulled = false; mesh.visible = false; mesh.castShadow = mesh.receiveShadow = false;
      mesh.onBeforeRender = (_renderer, _scene, camera) => {
        const u = material.uniforms; camera.getWorldPosition(eye); this.eye.copy(eye);
        u.uInside.value = eye.distanceTo(u.uCenter.value as THREE.Vector3) < (u.uRadius.value as number) * .98 ? 1 : 0;
        (u.uInvProjection.value as THREE.Matrix4).copy(camera.projectionMatrixInverse); (u.uCameraWorld.value as THREE.Matrix4).copy(camera.matrixWorld);
      };
      this.scene.add(mesh); v.meshes.push(mesh);
    });
    return v;
  }
  private hide(v: Void) { for (const m of v.meshes) m.visible = false; }
  private room(hide: boolean) {
    if (hide === this.hidden.length > 0) return;
    if (!hide) { for (const o of this.hidden) o.visible = true; this.hidden.length = 0; return; }
    for (const root of this.scene.children) {
      if (!ROOM(root.name) || !root.visible) continue;
      root.traverse(o => { const m = o as THREE.Mesh; if ((m.isMesh || (o as THREE.Points).isPoints) && o.visible) { o.visible = false; this.hidden.push(o); } });
    }
  }
  show(id: string, center: THREE.Vector3, floor: number, radius: number, open: number, time: number, bright = 1) {
    let v = this.live.get(id);
    if (!v) { v = this.pool.find(p => !p.busy) ?? this.pool[0]; v.busy = true; this.live.set(id, v); }
    v.shown = true;
    const r = Math.max(.05, radius * open), rise = center.y - floor, floorRadius = Math.sqrt(Math.max(0, r * r - rise * rise));
    for (const m of v.materials) { const u = m.uniforms; (u.uCenter.value as THREE.Vector3).copy(center); u.uTime.value = time; u.uBright.value = bright; u.uRadius.value = r; u.uFloor.value = floor; }
    const [backdrop, disc, shell] = v.meshes;
    shell.position.copy(center); shell.scale.setScalar(r);
    disc.position.set(center.x, floor + .01, center.z); disc.scale.setScalar(Math.max(.01, floorRadius));
    backdrop.visible = shell.visible = true; disc.visible = floorRadius > .02;
    if (this.eye.distanceTo(center) < r * .98) this.inside = true;
  }
  private inside = false;
  begin() { for (const v of this.live.values()) v.shown = false; this.inside = false; }
  end() { for (const [id, v] of this.live) if (!v.shown) { v.busy = false; this.hide(v); this.live.delete(id); } this.room(this.inside); }
  reset() { for (const v of this.live.values()) { v.busy = false; this.hide(v); } this.live.clear(); this.room(false); }
  dispose() { this.reset(); for (const v of this.pool) { for (const m of v.meshes) m.removeFromParent(); for (const m of v.materials) m.dispose(); } this.quad.dispose(); this.sphereGeometry.dispose(); this.floorGeometry.dispose(); }
}
