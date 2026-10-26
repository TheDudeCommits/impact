import * as THREE from 'three';

const vertex = `
varying vec3 vView;varying vec3 vCenter;varying float vRadius;varying vec3 vLight;
void main(){
  vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);
  vView=mv.xyz;
  vCenter=(modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
  vRadius=length(instanceMatrix[0].xyz);
  vLight=instanceColor;
  gl_Position=projectionMatrix*mv;
}`;
const fragment = `
varying vec3 vView;varying vec3 vCenter;varying float vRadius;varying vec3 vLight;
void main(){
  vec3 dir=normalize(vView);
  vec3 closest=dir*dot(vCenter,dir);
  float lateral=length(vCenter-closest)/vRadius;
  float f=clamp(1.-lateral*lateral,0.,1.);
  gl_FragColor=vec4(vLight*f*f,0.);
}`;

export class LightVolumes {
  readonly mesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private transform = new THREE.Object3D();
  private color = new THREE.Color();
  count = 0;
  private drawn = false;
  constructor(readonly capacity: number, name: string) {
    const material = new THREE.ShaderMaterial({
      name: 'SignatureLightVolume', vertexShader: vertex, fragmentShader: fragment,
      transparent: true, depthWrite: false, depthTest: true, depthFunc: THREE.GreaterEqualDepth, side: THREE.BackSide, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 10), material, capacity);
    this.mesh.name = name; this.mesh.frustumCulled = false; this.mesh.renderOrder = -2;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, this.color.setRGB(0, 0, 0)); this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.onAfterRender = () => { this.drawn = true; };
  }
  begin() { this.count = 0; }
  add(position: THREE.Vector3, radius: number, color: THREE.Color, intensity: number) {
    if (this.count >= this.capacity || intensity <= .005 || radius <= .01) return;
    this.transform.position.copy(position); this.transform.scale.setScalar(radius); this.transform.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.transform.matrix);
    this.mesh.setColorAt(this.count++, this.color.copy(color).multiplyScalar(intensity));
  }
  end() {
    this.mesh.count = this.count; this.mesh.visible = this.count > 0 || !this.drawn;
    if (this.count > 0) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor!.needsUpdate = true; }
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.dispose(); }
}
