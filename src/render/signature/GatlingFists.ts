import * as THREE from 'three';

const vertex = `varying vec3 vN;varying vec3 vV;varying float vHeat;
void main(){vHeat=instanceColor.r;mat3 m=mat3(instanceMatrix);vN=normalize(normalMatrix*(m*normal));
vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const fragment = `uniform float uTime;varying vec3 vN;varying vec3 vV;varying float vHeat;
void main(){
  vec3 n=normalize(vN),v=normalize(vV);
  float key=dot(n,normalize(vec3(.35,.8,.45)));
  vec3 col=key>.55?vec3(.24,.04,.045):key>.05?vec3(.1,.016,.022):vec3(.03,.007,.012);
  float shine=smoothstep(.9,.96,dot(n,normalize(v+vec3(.3,.9,.2))));
  col+=vec3(.75,.42,.4)*shine;
  float rim=smoothstep(.72,.97,1.-max(0.,dot(n,v)));
  col+=vec3(1.6,.22,.06)*rim*vHeat*(.85+.15*sin(uTime*31.));
  gl_FragColor=vec4(col,1.);
}`;
const inkVertex = `uniform float uWidth;uniform vec2 uViewport;
void main(){vec4 clip=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);
  vec2 d=(projectionMatrix*vec4(normalize(normalMatrix*(mat3(instanceMatrix)*normal)),0.)).xy;float l=length(d);
  if(l>1e-5)clip.xy+=d/l*uWidth*2./uViewport*clip.w;clip.z+=.0004*clip.w;gl_Position=clip;}`;
const viewport = new THREE.Vector4();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Color();
const FORWARD = new THREE.Vector3(0, 0, 1);

export class GatlingFists {
  private armGeometry = new THREE.CylinderGeometry(.7, 1, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, .5);
  readonly material: THREE.ShaderMaterial;
  private ink: THREE.ShaderMaterial;
  readonly fists: THREE.InstancedMesh;
  private fistInk: THREE.InstancedMesh;
  private arms: THREE.InstancedMesh;
  private armInk: THREE.InstancedMesh;
  private count = 0;
  constructor(scene: THREE.Scene, private fistGeometry: THREE.BufferGeometry, readonly capacity = 48) {
    this.material = new THREE.ShaderMaterial({ name: 'GatlingFist', vertexShader: vertex, fragmentShader: fragment, toneMapped: false, uniforms: { uTime: { value: 0 } } });
    this.ink = new THREE.ShaderMaterial({ name: 'GatlingFistInk', vertexShader: inkVertex, fragmentShader: 'void main(){gl_FragColor=vec4(.02,.01,.02,1.);}', side: THREE.BackSide,
      uniforms: { uWidth: { value: 2.4 }, uViewport: { value: new THREE.Vector2(1600, 900) } } });
    this.fists = new THREE.InstancedMesh(fistGeometry, this.material, capacity);
    this.fistInk = new THREE.InstancedMesh(fistGeometry, this.ink, capacity);
    this.arms = new THREE.InstancedMesh(this.armGeometry, this.material, capacity);
    this.armInk = new THREE.InstancedMesh(this.armGeometry, this.ink, capacity);
    this.fistInk.instanceMatrix = this.fists.instanceMatrix; this.armInk.instanceMatrix = this.arms.instanceMatrix;
    this.fists.name = 'gatling-fists'; this.arms.name = 'gatling-arms'; this.fistInk.name = 'gatling-fist-ink'; this.armInk.name = 'gatling-arm-ink';
    this.fistInk.onBeforeRender = renderer => { renderer.getCurrentViewport(viewport); if (viewport.w > 0) (this.ink.uniforms.uViewport.value as THREE.Vector2).set(viewport.z, viewport.w); };
    for (const mesh of [this.fists, this.fistInk, this.arms, this.armInk]) {
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0; mesh.visible = false; scene.add(mesh);
    }
    for (const mesh of [this.fists, this.arms]) { mesh.setColorAt(0, _c.setRGB(0, 0, 0)); mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage); }
  }
  begin(time: number) { this.count = 0; this.material.uniforms.uTime.value = time; }
  add(shoulder: THREE.Vector3, fist: THREE.Vector3, size: number, thick: number, heat: number) {
    if (this.count >= this.capacity || size < .005) return;
    const i = this.count++;
    _d.subVectors(fist, shoulder);
    const length = _d.length();
    if (length > 1e-4) _d.divideScalar(length); else _d.copy(FORWARD);
    _q.setFromUnitVectors(FORWARD, _d);
    this.fists.setMatrixAt(i, _m.compose(fist, _q, _s.setScalar(size)));
    this.fists.setColorAt(i, _c.setRGB(heat, 0, 0));
    const reach = Math.max(0, length - size * 1.1);
    this.arms.setMatrixAt(i, _m.compose(shoulder, _q, _s.set(reach > .15 ? thick : 0, reach > .15 ? thick : 0, Math.max(1e-3, reach))));
    this.arms.setColorAt(i, _c.setRGB(heat * .12, 0, 0));
  }
  end() {
    for (const mesh of [this.fists, this.fistInk, this.arms, this.armInk]) { mesh.count = this.count; mesh.visible = this.count > 0; }
    this.fists.instanceMatrix.needsUpdate = this.arms.instanceMatrix.needsUpdate = true;
    if (this.fists.instanceColor) this.fists.instanceColor.needsUpdate = true;
    if (this.arms.instanceColor) this.arms.instanceColor.needsUpdate = true;
  }
  reset() { this.count = 0; this.end(); }
  dispose() {
    for (const mesh of [this.fists, this.fistInk, this.arms, this.armInk]) { mesh.removeFromParent(); mesh.dispose(); }
    this.armGeometry.dispose(); this.material.dispose(); this.ink.dispose();
  }
}
