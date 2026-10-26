import * as THREE from 'three';

const MAX = 48;

const VERTEX = `
attribute vec3 aNext;
attribute vec2 aRibbon;
varying float vAcross;
void main() {
	vec3 along = normalize( aNext - position + vec3( 0.0, 1e-4, 0.0 ) );
	vec3 side = normalize( cross( along, normalize( cameraPosition - position ) ) );
	vAcross = aRibbon.x;
	gl_Position = projectionMatrix * viewMatrix * vec4( position + side * aRibbon.x * aRibbon.y, 1.0 );
}`;
const FRAGMENT = `
uniform float uBoltGlow;
varying float vAcross;
void main() {
	float core = 1.0 - abs( vAcross );
	gl_FragColor = vec4( vec3( 2.2, 2.1, 3.0 ) * uBoltGlow * ( .35 + core * core * 1.6 ), 1.0 );
}`;

export class Bolt {
  readonly mesh: THREE.Mesh;
  private readonly glow = { value: 0 };
  private readonly position = new Float32Array(MAX * 4 * 3);
  private readonly next = new Float32Array(MAX * 4 * 3);
  private readonly ribbon = new Float32Array(MAX * 4 * 2);
  private readonly geometry = new THREE.BufferGeometry();

  constructor() {
    const index: number[] = [];
    for (let q = 0; q < MAX; q++) { const o = q * 4; index.push(o, o + 1, o + 2, o + 2, o + 1, o + 3); }
    this.geometry.setIndex(index);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.position, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aNext', new THREE.BufferAttribute(this.next, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aRibbon', new THREE.BufferAttribute(this.ribbon, 2).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({ uniforms: { uBoltGlow: this.glow }, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.name = 'rift-bolt'; this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = -4;
  }

  strike(lens: THREE.Vector3, forward: THREE.Vector3) {
    const fx = forward.x, fz = forward.z, rx = -fz, rz = fx;
    const far = 85 + Math.random() * 40, across = (Math.random() - .5) * 70;
    const x = lens.x + fx * far + rx * across, z = lens.z + fz * far + rz * across;
    let quads = 0;
    const fork = (from: THREE.Vector3, to: THREE.Vector3, steps: number, width: number, jag: number) => {
      let a = from.clone();
      for (let i = 1; i <= steps && quads < MAX; i++) {
        const t = i / steps, b = from.clone().lerp(to, t);
        if (i < steps) b.add(new THREE.Vector3((Math.random() - .5) * jag, (Math.random() - .5) * jag * .3, (Math.random() - .5) * jag));
        this.quad(quads++, a, b, width * (1 - t * .45));
        a = b;
      }
    };
    const top = new THREE.Vector3(x + (Math.random() - .5) * 20, 95, z + (Math.random() - .5) * 20), foot = new THREE.Vector3(x, -2, z);
    fork(top, foot, 16, .9, 9);
    for (let f = 0; f < 2; f++) {
      const from = top.clone().lerp(foot, .2 + Math.random() * .35);
      fork(from, from.clone().add(new THREE.Vector3((Math.random() - .5) * 40, -20 - Math.random() * 25, (Math.random() - .5) * 40)), 6, .45, 6);
    }
    this.geometry.setDrawRange(0, quads * 6);
    for (const name of ['position', 'aNext', 'aRibbon']) (this.geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
  }

  private quad(q: number, a: THREE.Vector3, b: THREE.Vector3, width: number) {
    const corners: [THREE.Vector3, THREE.Vector3, number][] = [[a, b, -1], [a, b, 1], [b, a, 1], [b, a, -1]];
    corners.forEach(([p, n, side], i) => {
      const v = q * 4 + i;
      this.position.set([p.x, p.y, p.z], v * 3);
      this.next.set([n.x, n.y, n.z], v * 3);
      this.ribbon.set([side, width], v * 2);
    });
  }

  set flash(value: number) { this.glow.value = value; this.mesh.visible = value > .02; }

  dispose() { this.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
