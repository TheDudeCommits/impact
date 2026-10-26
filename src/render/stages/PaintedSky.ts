import * as THREE from 'three';

export interface PaintedSkyOptions {
  rotation?: number;
  exposure?: number;
  tint?: number;
  drift?: number;
  horizon?: number;
}

export class PaintedSky {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly drift: number;
  private readonly turn: number;

  constructor(map: THREE.Texture, options: PaintedSkyOptions = {}) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = false; map.minFilter = THREE.LinearFilter; map.magFilter = THREE.LinearFilter;
    map.wrapS = THREE.RepeatWrapping; map.wrapT = THREE.ClampToEdgeWrapping;
    this.turn = options.rotation ?? 0; this.drift = options.drift ?? .0012;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const material = new THREE.ShaderMaterial({
      name: 'PaintedSky',
      uniforms: {
        uMap: { value: map }, uTurn: { value: this.turn / (Math.PI * 2) },
        uExposure: { value: options.exposure ?? 1 }, uTint: { value: new THREE.Color(options.tint ?? 0xffffff) },
        uHorizon: { value: options.horizon ?? 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vec4 view = inverse( projectionMatrix ) * vec4( position.xy, 1.0, 1.0 );
          vDir = transpose( mat3( viewMatrix ) ) * ( view.xyz / view.w );
          gl_Position = vec4( position.xy, .99998, 1.0 );
        }`,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uTurn, uExposure, uHorizon;
        uniform vec3 uTint;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize( vDir );
          float u = atan( d.x, -d.z ) * .15915494 + .5 + uTurn;
          float v = clamp( ( asin( clamp( d.y, -1., 1. ) ) * .63661977 - uHorizon ) * .5 + .5, .002, .998 );
          vec3 colour = texture2D( uMap, vec2( u, v ) ).rgb * uTint * uExposure;
          gl_FragColor = vec4( colour, 1. );
        }`,
      depthWrite: true, depthTest: true, depthFunc: THREE.LessEqualDepth, fog: false, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'Painted sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 999_999;
  }

  static async load(url: string, options: PaintedSkyOptions = {}) {
    const map = await new THREE.TextureLoader().loadAsync(url);
    return new PaintedSky(map, options);
  }

  update(time: number) {
    this.mesh.material.uniforms.uTurn.value = (this.turn + time * this.drift) / (Math.PI * 2);
  }
}
