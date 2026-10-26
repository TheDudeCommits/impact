import * as THREE from 'three';


export class LightPools {
  private readonly spots: { x: number; y: number; z: number; size: number; colour: THREE.Color }[] = [];
  private mesh?: THREE.InstancedMesh;
  constructor(private readonly root: THREE.Object3D, private readonly most: number) {}
  add(x: number, z: number, size: number, colour: THREE.Color, y = .1) {
    if (this.spots.length >= this.most) return -1;
    this.spots.push({ x, y, z, size, colour: colour.clone() });
    return this.spots.length - 1;
  }
  colour(slot: number, c: THREE.Color) { if (slot >= 0 && this.mesh) this.mesh.setColorAt(slot, c); }
  update() { if (this.mesh?.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
  finish(name = 'light pools') {
    if (!this.spots.length) return;
    const material = new THREE.MeshBasicMaterial({ map: radial(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true, fog: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    material.name = name;
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material, this.spots.length);
    const m = new THREE.Matrix4();
    this.spots.forEach((s, i) => {
      m.compose(new THREE.Vector3(s.x, s.y, s.z), new THREE.Quaternion(), new THREE.Vector3(s.size, 1, s.size));
      mesh.setMatrixAt(i, m); mesh.setColorAt(i, s.colour);
    });
    mesh.name = name; mesh.renderOrder = 2; mesh.frustumCulled = false;
    this.root.add(mesh);
    this.mesh = mesh;
  }
}

export class Beacons {
  private readonly list: number[] = [];
  constructor(private readonly root: THREE.Object3D, private readonly most: number, private readonly time: { value: number }) {}
  add(x: number, y: number, z: number, size: number, colour: number, rate: number, phase: number, duty: number) {
    if (this.list.length / 12 >= this.most) return;
    const c = new THREE.Color(colour);
    this.list.push(x, y, z, size, c.r, c.g, c.b, rate, phase, duty, 0, 0);
  }
  finish(name = 'beacons', strength = 3) {
    const n = this.list.length / 12;
    if (!n) return;
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const buffer = new THREE.InstancedInterleavedBuffer(new Float32Array(this.list), 12);
    geometry.setAttribute('aAt', new THREE.InterleavedBufferAttribute(buffer, 4, 0));
    geometry.setAttribute('aColour', new THREE.InterleavedBufferAttribute(buffer, 3, 4));
    geometry.setAttribute('aBlink', new THREE.InterleavedBufferAttribute(buffer, 3, 7));
    geometry.instanceCount = n;
    const material = new THREE.ShaderMaterial({
      name,
      uniforms: { uTime: this.time, uStrength: { value: strength } },
      vertexShader: `
        attribute vec4 aAt; attribute vec3 aColour; attribute vec3 aBlink;
        uniform float uTime, uStrength;
        varying vec2 vUv; varying vec3 vColour;
        void main() {
          vUv = position.xy;
          float phase = fract( uTime * abs( aBlink.x ) + aBlink.y );
          float on = aBlink.x > 0.0 ? smoothstep( 0.0, .08, phase ) * ( 1.0 - smoothstep( aBlink.z, aBlink.z + .08, phase ) ) : 1.0;
          // A negative rate: a flame's soft flicker.
          if ( aBlink.x < 0.0 ) on = .82 + .18 * sin( uTime * 7.3 + aBlink.y * 40.0 ) * sin( uTime * 3.1 + aBlink.y * 17.0 );
          vColour = aColour * on * uStrength;
          vec4 centre = modelViewMatrix * vec4( aAt.xyz, 1.0 );
          centre.xy += position.xy * aAt.w * .5;
          gl_Position = projectionMatrix * centre;
        }`,
      fragmentShader: `
        varying vec2 vUv; varying vec3 vColour;
        void main() {
          float d = length( vUv );
          float core = exp( -d * d * 18.0 ), halo = exp( -d * d * 3.5 ) * .35;
          gl_FragColor = vec4( vColour * ( core + halo ), 1.0 );
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.frustumCulled = false; mesh.renderOrder = 3;
    this.root.add(mesh);
  }
}

export function radial() {
  const s = 128, canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(.35, 'rgba(255,255,255,.55)'); grad.addColorStop(.7, 'rgba(255,255,255,.14)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
