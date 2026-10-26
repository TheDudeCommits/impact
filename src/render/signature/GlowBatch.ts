import * as THREE from 'three';

export const GLOW = 0, SPARK = 1, RING = 2, SWIRL = 3, STAR = 4;
const STRIDE = 12;
const vertex = `
attribute vec4 aP;attribute vec4 aC;attribute vec4 aS;
varying vec2 vQ;varying vec4 vC;varying vec4 vS;
void main(){
  vec4 mv=modelViewMatrix*vec4(aP.xyz,1.);
  // Pull the card toward the camera by its radius so a glow round a hand is
  // not cut in half by the arm it surrounds.
  vec3 toward=normalize(-mv.xyz)*min(aP.w*.5,.2);
  mv.xyz+=toward;
  mv.xy+=position.xy*aP.w;
  gl_Position=projectionMatrix*mv;
  vQ=position.xy;vC=aC;vS=aS;
}`;
const fragment = `
uniform float uTime;
varying vec2 vQ;varying vec4 vC;varying vec4 vS;
float h1(float n){return fract(sin(n*127.1)*43758.5453);}
void main(){
  float r=length(vQ);if(r>=1.)discard;
  int type=int(vS.x+.5);float seed=vS.y;float core=vS.z;
  vec3 hot=vec3(2.7,2.9,3.3);
  vec3 col=vec3(0.);
  float a=atan(vQ.y,vQ.x);
  if(type==0){
    col=vC.rgb*pow(1.-r,2.2)+hot*(1.-smoothstep(core*.4,core,r));
  }else if(type==1){
    // Jagged rim: the core's edge wobbles by an angular noise re-rolled with the seed.
    float k=a*1.4323+3.1416*1.4323;float i0=floor(k);float f=fract(k);
    float n=mix(h1(i0+seed*13.),h1(mod(i0+1.,9.)+seed*13.),smoothstep(0.,1.,f));
    float rim=core*(.75+.6*n);
    float body=1.-smoothstep(rim*.55,rim,r);
    // Nine filaments at re-rolled angles, tapering outward.
    float fil=0.;
    for(int j=0;j<9;j++){
      float fj=float(j);float ang=(fj+h1(fj*3.7+seed*5.1))*.6981-3.1416;
      float len=core+(1.-core)*(.35+.65*h1(fj*9.1+seed*2.3));
      float da=abs(mod(a-ang+3.1416,6.2832)-3.1416)*r;
      float w=.035*(1.-r/len)+.004;
      fil=max(fil,(1.-smoothstep(w*.35,w,da))*step(r,len)*(1.-r/len*.6));
    }
    col=vC.rgb*pow(1.-r,2.6)*.9+hot*body+mix(vC.rgb*1.6,hot,.55)*fil;
  }else if(type==2){
    float band=exp(-pow((r-vS.w)/max(.001,core),2.));
    col=vC.rgb*band+hot*pow(band,6.)*.6;
  }else if(type==3){
    // A sphere of core radius whose surface currents spiral round the
    // centre, inside a shell of torn wind that thins out to the edge.
    float spin=uTime*9.+seed;
    float lr=log(max(r,.02));
    float s1=sin(a*3.-lr*7.5+spin*1.6);
    float s2=sin(a*5.+lr*5.+spin*2.3+1.7);
    float inside=1.-smoothstep(core*.96,core*1.02,r);
    float lines=smoothstep(.55,.98,s1)*.8+smoothstep(.75,1.,s2)*.5;
    float depth=sqrt(max(0.,1.-min(1.,r/core)*min(1.,r/core)));
    float body=inside*(.28+.72*lines*(.35+.65*(1.-depth)));
    float center=1.-smoothstep(0.,core*.55,r);
    float edge=exp(-pow((r-core)/(core*.07),2.));
    float shellT=clamp((r-core)/(1.-core),0.,1.);
    float wind=(1.-inside)*smoothstep(.62,1.,sin(a*2.-shellT*5.5+spin*2.7+seed))*pow(1.-shellT,1.6);
    col=vC.rgb*(body*1.4+wind*1.1+edge*.9)+hot*(center*center*1.15+edge*.35+lines*inside*.18);
  }else{
    float rays=exp(-abs(vQ.x)*26.)+exp(-abs(vQ.y)*26.);
    float rot=exp(-abs(vQ.x+vQ.y)*38.)+exp(-abs(vQ.x-vQ.y)*38.);
    float fall=pow(1.-r,1.6);
    col=(vC.rgb*(rays+rot*.45)+hot*(1.-smoothstep(core*.3,core,r)))*fall;
  }
  gl_FragColor=vec4(col*vC.w,1.);
}`;

export class GlowBatch {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private data: Float32Array;
  private buffer: THREE.InstancedInterleavedBuffer;
  count = 0;
  private drawn = false;
  constructor(readonly capacity: number, name: string, additive = false) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    this.data = new Float32Array(capacity * STRIDE);
    this.buffer = new THREE.InstancedInterleavedBuffer(this.data, STRIDE, 1);
    this.buffer.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aP', new THREE.InterleavedBufferAttribute(this.buffer, 4, 0));
    geometry.setAttribute('aC', new THREE.InterleavedBufferAttribute(this.buffer, 4, 4));
    geometry.setAttribute('aS', new THREE.InterleavedBufferAttribute(this.buffer, 4, 8));
    geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      name: additive ? 'SignatureGlowAdd' : 'SignatureGlow', vertexShader: vertex, fragmentShader: fragment,
      uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, toneMapped: false,
      ...(additive ? { blending: THREE.AdditiveBlending } : { blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendEquationAlpha: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }),
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = name; this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    this.mesh.onAfterRender = () => { this.drawn = true; };
  }
  begin(time: number) { this.count = 0; this.mesh.material.uniforms.uTime.value = time; }
  add(position: THREE.Vector3, radius: number, color: THREE.Color, intensity: number, type = GLOW, core = .25, seed = 0, p1 = 0) {
    if (this.count >= this.capacity || intensity <= .003 || radius <= 1e-4) return;
    const o = this.count++ * STRIDE, d = this.data;
    d[o] = position.x; d[o + 1] = position.y; d[o + 2] = position.z; d[o + 3] = radius;
    d[o + 4] = color.r; d[o + 5] = color.g; d[o + 6] = color.b; d[o + 7] = intensity;
    d[o + 8] = type; d[o + 9] = seed; d[o + 10] = core; d[o + 11] = p1;
  }
  end() {
    this.mesh.geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0 || !this.drawn;
    if (this.count > 0) { this.buffer.clearUpdateRanges(); this.buffer.addUpdateRange(0, this.count * STRIDE); this.buffer.needsUpdate = true; }
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
