import * as THREE from 'three';
import { noiseGLSL } from '../vfx/noise';

const common = `
uniform vec3 uCenter;uniform float uTime;uniform float uBright;uniform float uRadius;uniform float uFloor;
${noiseGLSL}
float h1(float n){return fract(sin(n*127.1)*43758.5453);}
vec3 h3v(float n){return vec3(h1(n),h1(n+17.3),h1(n+41.9));}
/** The Domain's cuts across the sky: K strokes live at a time, each on a great circle of its own, flashing and gone. */
/** The heaped bones round the horizon: their top, as a height over the horizon at each bearing - mounds, and the
 *  round bumps of skulls along them. */
float bones(vec3 ray){
  float az=atan(ray.z,ray.x);
  float mound=.035+.05*(.5+.5*snoise(vec3(az*2.1,3.,0.)))+.025*(.5+.5*snoise(vec3(az*5.3,7.,0.)));
  float skull=fract(az*38./6.28318),bump=sqrt(max(0.,1.-pow(skull*2.-1.,2.)))*.011*(.6+.4*h1(floor(az*38./6.28318)));
  return mound+bump;
}
float cuts(vec3 ray){
  float sum=0.;
  for(int k=0;k<5;k++){
    float clock=uTime*5.5+float(k)*.379,slot=floor(clock),age=fract(clock);
    float seed=slot*7.13+float(k)*3.71;
    vec3 n=normalize(h3v(seed)*2.-1.);
    // Each stroke a stretch of its great circle, round a centre in the upper sky in front of no one in particular.
    vec3 mid=normalize(vec3(h1(seed+5.)*2.-1.,.15+h1(seed+9.)*.6,h1(seed+13.)*2.-1.));
    mid=normalize(mid-n*dot(mid,n));
    float d=abs(dot(ray,n));
    float along=acos(clamp(dot(normalize(ray-n*dot(ray,n)),mid),-1.,1.));
    float span=.35+h1(seed+21.)*.55;
    float line=(exp(-d*d*6.e4)+.35*exp(-d*d*4.e3))*smoothstep(span,span*.6,along);
    float flash=(1.-smoothstep(0.,.8,age))*step(.25,h1(seed+33.));
    sum+=line*flash;
  }
  return sum;
}
vec3 sky(vec3 ray){
  float h=ray.y;
  vec3 horizon=vec3(.3,.012,.02),low=vec3(.075,.002,.008),high=vec3(.01,.0,.004);
  vec3 col=mix(horizon,low,smoothstep(-.02,.22,h));
  col=mix(col,high,smoothstep(.18,.75,h));
  // Torn cloud low over the sea, drifting, lit red underneath.
  vec2 p=ray.xz/(max(h,.0)+.28);
  float n=snoise(vec3(p*1.3+vec2(uTime*.025,-uTime*.017),uTime*.04))*.6+snoise(vec3(p*3.1,uTime*.07))*.4;
  float cloud=smoothstep(.05,.7,n)*smoothstep(.0,.12,h)*(1.-smoothstep(.45,.85,h));
  col=mix(col,vec3(.035,.0,.006),cloud*.8);
  col+=vec3(.5,.04,.035)*cloud*(1.-cloud)*.3*smoothstep(.0,.25,h);
  col+=vec3(1.7,.55,.5)*cuts(ray)*uBright;
  // The bones, black against the red, a rim of it along their tops.
  float top=bones(ray);
  if(h<top){col=mix(vec3(.018,.0,.004),col,smoothstep(top-.004,top,h)*.6);col+=vec3(.25,.02,.02)*smoothstep(top-.012,top,h)*.5;}
  return col;
}
/** The cuts that fall in the sea, laid open across it on the floor, white-hot, closing as they go. */
float seaCuts(vec2 at){
  float sum=0.;
  for(int k=0;k<4;k++){
    float clock=uTime*4.+float(k)*.43,slot=floor(clock),age=fract(clock);
    float seed=slot*5.31+float(k)*9.17;
    vec2 c=uCenter.xz+(vec2(h1(seed),h1(seed+3.))*2.-1.)*uRadius*.75;
    float a=h1(seed+7.)*6.28318;vec2 dir=vec2(cos(a),sin(a)),nrm=vec2(-dir.y,dir.x);
    vec2 p=at-c;float along=dot(p,dir),across=abs(dot(p,nrm));
    float len=1.+h1(seed+11.)*1.6,open=(1.-age)*(1.-age);
    float w=.035*(1.-smoothstep(len*.5,len,abs(along)))*open;
    sum+=smoothstep(w,w*.2,across)*step(abs(along),len);
  }
  return sum;
}
vec3 sea(vec3 ray,vec3 at){
  float r=length(at.xz-uCenter.xz);
  vec3 refl=vec3(ray.x,-ray.y,ray.z);
  // The swell bends the mirror a little.
  float swell=snoise(vec3(at.xz*.6,uTime*.35))*.04;
  vec3 col=sky(normalize(refl+vec3(swell,0.,swell)))*vec3(.75,.15,.14)+vec3(.11,.004,.012);
  // A wet sheen where the sky's light catches the swell.
  col+=vec3(.6,.08,.07)*pow(max(0.,snoise(vec3(at.xz*1.4,uTime*.5))),6.)*.5;
  col+=vec3(.6,.05,.05)*pow(.5+.5*sin(r*2.6-uTime*2.4),14.)*exp(-r*.18)*.45*uBright;
  col+=vec3(.5,.04,.05)*smoothstep(uRadius*.88,uRadius,r)*.45;
  col+=vec3(1.9,.6,.5)*seaCuts(at.xz)*uBright;
  return col;
}
/** Where a ray from the eye leaves the Domain's sphere; the sea or the sky along it. */
float exitAt(vec3 ray){vec3 o=cameraPosition-uCenter;float b=dot(o,ray),c=dot(o,o)-uRadius*uRadius,h=b*b-c;return h<0.?0.:-b+sqrt(h);}
vec3 domainAlong(vec3 ray){
  float t=exitAt(ray);
  if(ray.y<-1e-4){float tf=(uFloor-cameraPosition.y)/ray.y;if(tf>0.&&tf<t)return sea(ray,cameraPosition+ray*tf);}
  return sky(ray);
}`;
const quadVertex = `varying vec2 vNdc;void main(){vNdc=position.xy;gl_Position=vec4(position.xy,0.,1.);}`;
const quadFragment = `${common}
uniform mat4 uInvProjection;uniform mat4 uCameraWorld;uniform float uInside;
varying vec2 vNdc;
void main(){
  if(uInside<.5)discard;
  vec4 v=uInvProjection*vec4(vNdc,1.,1.);
  vec3 ray=normalize(mat3(uCameraWorld)*normalize(v.xyz/v.w));
  gl_FragColor=vec4(domainAlong(ray),1.);
}`;
const meshVertex = `varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const shellFragment = `${common}
uniform float uInside;varying vec3 vWorld;
void main(){
  if(uInside>.5)discard;
  vec3 ray=normalize(vWorld-cameraPosition);
  gl_FragColor=vec4(domainAlong(ray),1.);
}`;
const floorFragment = `${common}
varying vec3 vWorld;
void main(){
  if(length(vWorld.xz-uCenter.xz)>uRadius)discard;
  vec3 ray=normalize(vWorld-cameraPosition);
  gl_FragColor=vec4(sea(ray,vWorld),1.);
}`;

type Shrine = { meshes: THREE.Mesh[]; materials: THREE.ShaderMaterial[]; busy: boolean; shown: boolean };
const eye = new THREE.Vector3();
const ROOM = (name: string) => name === 'MangaHarborEnvironment' || name.startsWith('Stage:') || name === 'look-sky' || name === 'look-atmosphere';

export class MalevolentShrineDomain {
  private quad = new THREE.PlaneGeometry(2, 2);
  private sphereGeometry = new THREE.SphereGeometry(1, 48, 32);
  private floorGeometry = new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2);
  private pool: Shrine[] = [];
  private live = new Map<string, Shrine>();
  private eye = new THREE.Vector3(0, 1e6, 0);
  private hidden: THREE.Object3D[] = [];
  private inside = false;
  constructor(private scene: THREE.Scene, capacity = 2) {
    for (let i = 0; i < capacity; i++) this.pool.push(this.make());
    const first = this.pool[0];
    for (const m of first.meshes) { m.visible = true; m.scale.setScalar(.001); m.position.set(0, -60, 0); }
    first.meshes[2].onAfterRender = () => { if (!first.busy) this.hide(first); first.meshes[2].onAfterRender = () => {}; };
  }
  private material(vertex: string, fragment: string, extra: Partial<THREE.ShaderMaterialParameters>) {
    return new THREE.ShaderMaterial({
      name: 'MalevolentShrine', vertexShader: vertex, fragmentShader: fragment, toneMapped: false, fog: false,
      uniforms: { uCenter: { value: new THREE.Vector3() }, uTime: { value: 0 }, uBright: { value: 1 }, uRadius: { value: 1 }, uFloor: { value: 0 },
        uInvProjection: { value: new THREE.Matrix4() }, uCameraWorld: { value: new THREE.Matrix4() }, uInside: { value: 0 } },
      ...extra,
    });
  }
  private make(): Shrine {
    const materials = [
      this.material(quadVertex, quadFragment, { depthTest: false, depthWrite: false }),
      this.material(meshVertex, floorFragment, {}),
      this.material(meshVertex, shellFragment, { side: THREE.BackSide }),
    ];
    const names = ['malevolent-shrine-backdrop', 'malevolent-shrine-sea', 'malevolent-shrine-shell'];
    const geometries = [this.quad, this.floorGeometry, this.sphereGeometry];
    const orders = [-2, -1, -1];
    const v: Shrine = { meshes: [], materials, busy: false, shown: false };
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
  private hide(v: Shrine) { for (const m of v.meshes) m.visible = false; }
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
  begin() { for (const v of this.live.values()) v.shown = false; this.inside = false; }
  end() { for (const [id, v] of this.live) if (!v.shown) { v.busy = false; this.hide(v); this.live.delete(id); } this.room(this.inside); }
  reset() { for (const v of this.live.values()) { v.busy = false; this.hide(v); } this.live.clear(); this.room(false); }
  dispose() { this.reset(); for (const v of this.pool) { for (const m of v.meshes) m.removeFromParent(); for (const m of v.materials) m.dispose(); } this.quad.dispose(); this.sphereGeometry.dispose(); this.floorGeometry.dispose(); }
}
