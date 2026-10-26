import * as THREE from 'three';
import type { Fighter } from '../Fighter';

const MARKERS = 4;
const FADE_IN = .15, FADE_OUT = .25;
type Marker = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  uniforms: { uFill: { value: number }; uAlpha: { value: number }; uTime: { value: number }; uColor: { value: THREE.Color } };
  key: number; actorId: string; born: number; release: number; due: number; until: number; active: boolean;
};
const VERTEX = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const FRAGMENT = `varying vec2 vUv;uniform float uFill;uniform float uAlpha;uniform float uTime;uniform vec3 uColor;
void main(){vec2 p=vUv*2.0-1.0;float r=length(p);if(r>1.03)discard;
  float edge=smoothstep(.925,.975,r)*(1.0-smoothstep(.985,1.03,r));
  float dash=step(.45,fract(atan(p.y,p.x)*3.8197+uTime*.6));
  float band=smoothstep(.8,.82,r)*(1.0-smoothstep(.845,.865,r))*dash*.55;
  float fill=(1.0-smoothstep(uFill-.015,uFill,r))*(.08+.2*r*r);
  float front=smoothstep(uFill-.06,uFill,r)*(1.0-smoothstep(uFill,uFill+.012,r))*step(.03,uFill)*.75;
  float a=(edge*.95+band+fill+front)*uAlpha;
  gl_FragColor=vec4(mix(uColor,vec3(1.0),edge*.45+front*.4)*(1.0+edge*.9+front*.6),a);}`;

export class BlastAreas {
  private markers: Marker[] = [];
  private plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  constructor(scene: THREE.Scene) {
    for (let i = 0; i < MARKERS; i++) {
      const uniforms = { uFill: { value: 0 }, uAlpha: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color() } };
      const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -3, toneMapped: false });
      const mesh = new THREE.Mesh(this.plane, material); mesh.name = 'ultimate-blast-area'; mesh.frustumCulled = false; mesh.renderOrder = 2;
      mesh.scale.setScalar(.001); mesh.position.set(0, -50, 0);
      const marker: Marker = { mesh, uniforms, key: -1, actorId: '', born: 0, release: 0, due: 0, until: -1e9, active: false };
      mesh.onAfterRender = () => { if (!marker.active) mesh.visible = false; };
      scene.add(mesh); this.markers.push(marker);
    }
  }
  mark(key: number, actorId: string, x: number, floor: number, z: number, radius: number, born: number, release: number, due: number, color: number) {
    const same = this.markers.find(m => m.active && (m.key === key || m.actorId === actorId && Math.abs(m.born - born) < .3));
    if (same) { same.mesh.position.set(x, floor + .04, z); return; }
    const marker = this.markers.find(m => !m.active) ?? this.markers.reduce((a, b) => a.born <= b.born ? a : b);
    marker.key = key; marker.actorId = actorId; marker.born = born; marker.release = release; marker.due = due; marker.until = due + FADE_OUT; marker.active = true;
    marker.uniforms.uColor.value.setHex(color);
    marker.mesh.position.set(x, floor + .04, z); marker.mesh.scale.set(radius, 1, radius); marker.mesh.visible = true;
  }
  move(key: number, x: number, floor: number, z: number, due: number) {
    const m = this.markers.find(m => m.active && m.key === key);
    if (!m) return;
    m.mesh.position.set(x, floor + .04, z);
    if (m.until >= m.due + FADE_OUT - 1e-6) m.until = due + FADE_OUT;
    m.due = due;
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>) {
    for (const m of this.markers) {
      if (!m.active) continue;
      const actor = fighters.get(m.actorId);
      if (time < m.release - .02 && time > m.born + .1 && (!actor || !actor.state.alive || actor.state.action !== 'ultimate')) m.until = Math.min(m.until, time + FADE_OUT);
      if (time > m.until || time < m.born - .1) { m.active = false; m.mesh.visible = false; continue; }
      const fadeIn = THREE.MathUtils.clamp((time - m.born) / FADE_IN, 0, 1), fadeOut = THREE.MathUtils.clamp((m.until - time) / FADE_OUT, 0, 1);
      m.uniforms.uAlpha.value = fadeIn * fadeOut;
      m.uniforms.uFill.value = THREE.MathUtils.clamp((time - m.born) / Math.max(.05, m.due - m.born), 0, 1);
      m.uniforms.uTime.value = time;
      m.mesh.visible = true;
    }
  }
  showing() { return this.markers.filter(m => m.active).map(m => ({ key: m.key, x: m.mesh.position.x, z: m.mesh.position.z, radius: m.mesh.scale.x, due: m.due })); }
  reset() { for (const m of this.markers) { m.active = false; m.until = -1e9; m.mesh.visible = false; } }
  dispose() { this.reset(); for (const m of this.markers) { m.mesh.removeFromParent(); m.mesh.material.dispose(); } this.markers = []; this.plane.dispose(); }
}
