import * as THREE from 'three';
import { BoltBatch } from '../../signature/BoltBatch';
import { LightningPainter, type BoltStyle } from '../../signature/Lightning';

const SHAPE = `
varying vec3 vShape;varying vec3 vColor;varying float vCore;varying float vI;
float across(){float ax=max(0.,max(-vShape.x,vShape.x-vShape.z));return length(vec2(ax,vShape.y));}`;
const GLOW = `${SHAPE}
void main(){
  float r=across();
  if(r>=1.)discard;
  gl_FragColor=vec4(vColor*pow(1.-r,1.5)*1.2*min(1.,vI),1.);
}`;
const STROKE = `${SHAPE}
uniform vec2 uPart;
void main(){
  float r=across(),aa=fwidth(r)*1.2,k=min(1.,vI);
  float cover=1.-smoothstep(vCore*uPart.x-aa,vCore*uPart.x+aa,r);
  if(cover<=.003)discard;
  gl_FragColor=vec4(mix(vec3(.016,.0,.01),vColor,uPart.y)*cover*k,cover*k);
}`;

export const HAKI = { glow: new THREE.Color(1.7, .06, .14), deep: new THREE.Color(.55, .01, .05) };
export function hakiEdge(hex: number) {
  const glow = new THREE.Color(hex), peak = Math.max(glow.r, glow.g, glow.b, 1e-3);
  glow.multiplyScalar(1.7 / peak);
  return { glow, deep: glow.clone().multiplyScalar(.32) };
}

export class HakiBolts {
  readonly batch: BoltBatch;
  readonly painter: LightningPainter;
  private strokes: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>[];
  private style: BoltStyle = { width: .04, color: HAKI.glow, levels: 4, jag: .36, branches: 2, branchLength: .5, taper: .35, core: .5 };
  constructor(scene: THREE.Scene, capacity = 2400) {
    this.batch = new BoltBatch(capacity, 'haki-bolts', 1.5);
    const light = this.batch.mesh.material;
    this.batch.mesh.material = new THREE.ShaderMaterial({
      name: 'HakiGlow', vertexShader: light.vertexShader, fragmentShader: GLOW, uniforms: light.uniforms,
      transparent: true, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendEquationAlpha: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    light.dispose();
    this.strokes = [new THREE.Vector2(1.6, .72), new THREE.Vector2(1, 0)].map((part, i) => {
      const mesh = new THREE.Mesh(this.batch.mesh.geometry, new THREE.ShaderMaterial({
        name: i ? 'HakiInk' : 'HakiEdge', vertexShader: light.vertexShader, fragmentShader: STROKE, uniforms: { ...light.uniforms, uPart: { value: part } },
        transparent: true, depthWrite: false, toneMapped: false,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      }));
      mesh.name = i ? 'haki-ink' : 'haki-edge'; mesh.frustumCulled = false; mesh.renderOrder = this.batch.mesh.renderOrder + 1 + i;
      return mesh;
    });
    this.painter = new LightningPainter(this.batch, 96);
    scene.add(this.batch.mesh, ...this.strokes);
  }
  begin() { this.batch.begin(); }
  end() { this.batch.end(); for (const mesh of this.strokes) mesh.visible = this.batch.mesh.visible; }
  bolt(a: THREE.Vector3, b: THREE.Vector3, seed: number, width: number, intensity = 1, branches = 2, edge: THREE.Color = HAKI.glow, levels = 4) {
    const s = this.style; s.width = width; s.intensity = intensity; s.branches = branches; s.color = edge; s.levels = levels;
    this.painter.bolt(a, b, seed, s);
  }
  dispose() { for (const mesh of this.strokes) { mesh.removeFromParent(); mesh.material.dispose(); } this.batch.dispose(); }
}
