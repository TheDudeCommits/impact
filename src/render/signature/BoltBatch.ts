import * as THREE from 'three';

const STRIDE = 12;
const vertex = `
uniform float uViewportH;uniform float uMinPx;
attribute vec4 aA;attribute vec4 aB;attribute vec4 aC;
varying vec3 vShape;varying vec3 vColor;varying float vCore;varying float vI;
void main(){
  vec4 a=modelViewMatrix*vec4(aA.xyz,1.);vec4 b=modelViewMatrix*vec4(aB.xyz,1.);
  vec2 d=b.xy-a.xy;float len=length(d);vec2 dir=len>1e-6?d/len:vec2(1.,0.);vec2 perp=vec2(-dir.y,dir.x);
  vec4 p=mix(a,b,position.x);
  float depth=max(.05,-p.z);
  float px=2.*depth/(projectionMatrix[1][1]*uViewportH);
  float w=max(aA.w,px*uMinPx);
  p.xy+=perp*position.y*w+dir*(position.x*2.-1.)*w;
  gl_Position=projectionMatrix*p;
  float L=len/w;
  vShape=vec3(-1.+position.x*(L+2.),position.y,L);
  vColor=aC.rgb;vCore=aC.w;vI=aB.w*aA.w/w;
}`;
const fragment = `
varying vec3 vShape;varying vec3 vColor;varying float vCore;varying float vI;
void main(){
  float ax=max(0.,max(-vShape.x,vShape.x-vShape.z));
  float r=length(vec2(ax,vShape.y));
  if(r>=1.)discard;
  // A wide coloured glow round a narrow blue-white core: the colour of the
  // lightning has to survive bloom, so the core stays thin and not pure white.
  float glow=pow(1.-r,1.3);
  float core=1.-smoothstep(vCore*.5,vCore,r);
  vec3 col=vColor*glow*1.15+vec3(1.6,2.05,3.0)*core;
  gl_FragColor=vec4(col*vI,1.);
}`;
const viewport = new THREE.Vector4();

export class BoltBatch {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private data: Float32Array;
  private buffer: THREE.InstancedInterleavedBuffer;
  count = 0;
  private drawn = false;
  constructor(readonly capacity: number, name: string, minPixels = 1.25) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    this.data = new Float32Array(capacity * STRIDE);
    this.buffer = new THREE.InstancedInterleavedBuffer(this.data, STRIDE, 1);
    this.buffer.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aA', new THREE.InterleavedBufferAttribute(this.buffer, 4, 0));
    geometry.setAttribute('aB', new THREE.InterleavedBufferAttribute(this.buffer, 4, 4));
    geometry.setAttribute('aC', new THREE.InterleavedBufferAttribute(this.buffer, 4, 8));
    geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      name: 'SignatureBolt', vertexShader: vertex, fragmentShader: fragment,
      uniforms: { uViewportH: { value: 900 }, uMinPx: { value: minPixels } },
      transparent: true, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendEquationAlpha: THREE.MaxEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = name; this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
    this.mesh.onAfterRender = () => { this.drawn = true; };
    this.mesh.onBeforeRender = renderer => { renderer.getCurrentViewport(viewport); if (viewport.w > 0) material.uniforms.uViewportH.value = viewport.w; };
  }
  begin() { this.count = 0; }
  segment(a: THREE.Vector3, b: THREE.Vector3, width: number, color: THREE.Color, intensity = 1, core = .3) {
    if (this.count >= this.capacity || intensity <= .003 || width <= 1e-5) return;
    const o = this.count++ * STRIDE, d = this.data;
    d[o] = a.x; d[o + 1] = a.y; d[o + 2] = a.z; d[o + 3] = width;
    d[o + 4] = b.x; d[o + 5] = b.y; d[o + 6] = b.z; d[o + 7] = intensity;
    d[o + 8] = color.r; d[o + 9] = color.g; d[o + 10] = color.b; d[o + 11] = core;
  }
  end() {
    const geometry = this.mesh.geometry;
    geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0 || !this.drawn;
    if (this.count > 0) { this.buffer.clearUpdateRanges(); this.buffer.addUpdateRange(0, this.count * STRIDE); this.buffer.needsUpdate = true; }
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
