import * as THREE from 'three';
import { noiseGLSL } from '../vfx/noise';

const vertex = `varying vec2 vNdc;void main(){vNdc=position.xy;gl_Position=vec4(position.xy,0.,1.);}`;
const fragment = `
uniform float uProgress;uniform float uTime;uniform float uAspect;uniform vec2 uOrigin;uniform vec2 uDir;uniform vec3 uEdge;uniform vec3 uBody;
varying vec2 vNdc;
${noiseGLSL}
void main(){
  if(uProgress<=0.||uProgress>=1.)discard;
  vec2 q=vec2(vNdc.x*uAspect,vNdc.y),o=vec2(uOrigin.x*uAspect,uOrigin.y);
  vec2 dir=normalize(uDir),perp=vec2(-dir.y,dir.x);
  float p=uProgress;
  float n=snoise(vec3(q*2.6,uTime*2.2))*.09+snoise(vec3(q*8.,uTime*4.))*.035;
  // The front: an arc that leaves the caster and outruns the frame.
  float sweep=pow(smoothstep(0.,.5,p),.8)*6.;
  float R=1.6+sweep*1.6;
  vec2 c=o+dir*(sweep*1.15-R);
  float front=length(q-c)-R+n;
  // Its hollow: a second arc behind it, so it is a crescent until it closes.
  float R2=R*.86*(1.-smoothstep(.18,.46,p));
  vec2 c2=c-dir*R*.42+perp*R*.2;
  float hollow=length(q-c2)-R2+n*.7;
  float black=(1.-smoothstep(-.01,.01,front))*smoothstep(-.01,.01,hollow);
  float rim=(exp(-abs(front)*22.)+exp(-abs(hollow)*26.)*(1.-smoothstep(-.01,.01,front)))*(1.-smoothstep(.5,.62,p));
  // Held: red veins crawl through the black.
  float hold=smoothstep(.42,.56,p)*(1.-smoothstep(.86,.94,p));
  float vein=pow(1.-abs(snoise(vec3(q*1.1+dir*uTime*.6,uTime*.7))),48.)*smoothstep(-.2,.4,snoise(vec3(q*.7,uTime*.3)));
  // The cut: a white-red line along the slash, then the two halves part.
  float side=dot(q-o,perp)+n*.6;
  float cut=smoothstep(.78,.84,p),open=smoothstep(.84,1.,p);
  float gap=open*open*2.6;
  float kept=smoothstep(gap-.01,gap+.01,abs(side));
  float line=exp(-abs(abs(side)-gap)*(60.-40.*open))*cut*(1.-open*.6);
  black*=kept;
  vec3 rgb=uEdge*(rim*1.6+vein*hold*.55*black)+vec3(3.,1.6,1.4)*line+uBody*black;
  gl_FragColor=vec4(rgb,black);
}`;

export class ScreenWipe {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly from = new THREE.Vector3();
  readonly toward = new THREE.Vector3();
  private a = new THREE.Vector3(); private b = new THREE.Vector3();
  private drawn = false;
  constructor(scene: THREE.Scene, edge = new THREE.Color(2.2, .14, .12), body = new THREE.Color(.006, .001, .004)) {
    const material = new THREE.ShaderMaterial({
      name: 'SignatureScreenWipe', vertexShader: vertex, fragmentShader: fragment,
      uniforms: { uProgress: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 16 / 9 }, uOrigin: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2(1, 0) }, uEdge: { value: edge }, uBody: { value: body } },
      transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.name = 'mugetsu-screen-wipe'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1_000_001;
    this.mesh.onAfterRender = () => { this.drawn = true; };
    this.mesh.onBeforeRender = (renderer, _scene, camera) => {
      const u = material.uniforms, size = renderer.getDrawingBufferSize(this.size);
      u.uAspect.value = size.y > 0 ? size.x / size.y : 16 / 9;
      this.a.copy(this.from).project(camera); this.b.copy(this.toward).project(camera);
      const behind = this.a.z > 1;
      (u.uOrigin.value as THREE.Vector2).set(behind ? 0 : THREE.MathUtils.clamp(this.a.x, -1.2, 1.2), behind ? 0 : THREE.MathUtils.clamp(this.a.y, -1.2, 1.2));
      const dx = (this.b.x - this.a.x) * u.uAspect.value, dy = this.b.y - this.a.y;
      if (!behind && this.b.z <= 1 && Math.hypot(dx, dy) > .05) (u.uDir.value as THREE.Vector2).set(dx, dy).normalize(); else (u.uDir.value as THREE.Vector2).set(1, .25).normalize();
    };
    scene.add(this.mesh);
  }
  private size = new THREE.Vector2();
  set(progress: number, time: number) {
    const u = this.mesh.material.uniforms;
    u.uProgress.value = progress; u.uTime.value = time;
    this.mesh.visible = (progress > 0 && progress < 1) || !this.drawn;
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
