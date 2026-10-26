import * as THREE from 'three';
import { noiseGLSL } from '../vfx/noise';

const STRIDE = 12;
const vertex = `
attribute vec4 aA;attribute vec4 aB;attribute vec4 aC;
varying vec2 vS;varying float vLen;varying float vW;varying vec4 vC;varying float vHeat;
void main(){
  vec3 a=aA.xyz,b=aB.xyz;vec3 d=b-a;d.y=0.;float len=length(d);vec3 dir=len>1e-4?d/len:vec3(1.,0.,0.);
  vec3 side=vec3(-dir.z,0.,dir.x);float w=aA.w;
  float s=position.x*(len+2.*w)-w;
  vec3 p=a+dir*s+side*position.y*w;p.y=mix(a.y,b.y,clamp(s/max(len,1e-3),0.,1.))+.015;
  vS=vec2(s,position.y);vLen=len;vW=w;vC=aC;vHeat=aB.w;
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`;
const fragment = `
varying vec2 vS;varying float vLen;varying float vW;varying vec4 vC;varying float vHeat;
${noiseGLSL}
void main(){
  float s=vS.x,t=vS.y,seed=vC.a*37.;
  float ends=smoothstep(-vW*.9,vW*.6,s)*smoothstep(-vW*.9,vW*.4,vLen-s);
  if(ends<.01)discard;
  float wob=snoise(vec3(s*.9,seed,0.))*.28+snoise(vec3(s*3.1,seed,1.))*.1;
  float half_=(.55+.3*snoise(vec3(s*1.7,seed,2.)))*ends;
  float d=abs(t-wob);
  float slit=1.-smoothstep(0.,.2*half_+.02,d);
  float grit=snoise(vec3(s*6.,t*4.,seed));
  float char_=1.-smoothstep(.25*half_,half_,d+grit*.12);
  if(char_<.01&&slit<.01)discard;
  // Hot where the blade is now, cooling over the three metres behind it.
  float heat=vHeat*(.25+.75*exp(-max(0.,vLen-s)*.55));
  vec3 glow=vC.rgb*(slit*(1.4+1.6*heat)+char_*heat*.35);
  float fade=clamp(vHeat*4.,0.,1.);
  gl_FragColor=vec4(glow*fade,char_*.82*fade);
}`;

export class FloorGashes {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private data: Float32Array;
  private buffer: THREE.InstancedInterleavedBuffer;
  private count = 0;
  private drawn = false;
  constructor(scene: THREE.Scene, readonly capacity = 8, name = 'signature-floor-gash') {
    const geometry = new THREE.InstancedBufferGeometry();
    const cols = 8, pos: number[] = [], index: number[] = [];
    for (let i = 0; i <= cols; i++) pos.push(i / cols, -1, 0, i / cols, 1, 0);
    for (let i = 0; i < cols; i++) { const a = i * 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geometry.setIndex(index);
    this.data = new Float32Array(capacity * STRIDE);
    this.buffer = new THREE.InstancedInterleavedBuffer(this.data, STRIDE, 1); this.buffer.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aA', new THREE.InterleavedBufferAttribute(this.buffer, 4, 0));
    geometry.setAttribute('aB', new THREE.InterleavedBufferAttribute(this.buffer, 4, 4));
    geometry.setAttribute('aC', new THREE.InterleavedBufferAttribute(this.buffer, 4, 8));
    geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      name: 'SignatureFloorGash', vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, toneMapped: false,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geometry, material); this.mesh.name = name; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    this.mesh.onAfterRender = () => { this.drawn = true; };
    scene.add(this.mesh);
  }
  begin() { this.count = 0; }
  add(a: THREE.Vector3, b: THREE.Vector3, width: number, heat: number, color: THREE.Color, seed: number) {
    if (this.count >= this.capacity || heat <= .003) return;
    const o = this.count++ * STRIDE, d = this.data;
    d[o] = a.x; d[o + 1] = a.y; d[o + 2] = a.z; d[o + 3] = width;
    d[o + 4] = b.x; d[o + 5] = b.y; d[o + 6] = b.z; d[o + 7] = Math.min(1, heat);
    d[o + 8] = color.r; d[o + 9] = color.g; d[o + 10] = color.b; d[o + 11] = (seed % 97) / 97;
  }
  end() {
    this.mesh.geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0 || !this.drawn;
    if (this.count > 0) { this.buffer.clearUpdateRanges(); this.buffer.addUpdateRange(0, this.count * STRIDE); this.buffer.needsUpdate = true; }
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
