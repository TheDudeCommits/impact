import * as T from 'three';
import { SignaturePoolUpload } from './SignaturePoolUpload';

export class Roster96Batch {
  readonly mesh: T.InstancedMesh<T.BufferGeometry, T.ShaderMaterial>;
  private readonly tint: T.InstancedBufferAttribute;
  private readonly upload: SignaturePoolUpload;
  private readonly transform = new T.Object3D();
  private used = 0;
  constructor(scene: T.Scene, name: string, geometry: T.BufferGeometry, private readonly capacity: number, sand = false) {
    this.tint = new T.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('effectTint', this.tint);
    const material = new T.ShaderMaterial({
      name, transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false,
      uniforms: { clock: { value: 0 }, sand: { value: sand ? 1 : 0 } },
      vertexShader: `attribute vec4 effectTint; varying vec4 tint; varying vec3 local;
        void main(){tint=effectTint;local=position;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float clock;uniform float sand;varying vec4 tint;varying vec3 local;
        void main(){float grain=fract(sin(dot(floor(local.xy*80.+vec2(clock*7.,clock*-3.)),vec2(12.9898,78.233)))*43758.5453);
          float band=sin(local.y*32.-clock*11.+atan(local.z,local.x)*4.);
          vec3 color=tint.rgb*mix(1.,.78+.22*grain,sand);
          float alpha=tint.a*mix(1.,.64+.36*smoothstep(-.7,.4,band),sand);
          if(alpha<.008)discard;gl_FragColor=vec4(color,alpha);
          #include <colorspace_fragment>
        }`,
    });
    material.forceSinglePass = true;
    this.mesh = new T.InstancedMesh(geometry, material, capacity);
    this.mesh.name = name; this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.upload = new SignaturePoolUpload(this.mesh, this.tint);
    scene.add(this.mesh);
  }
  begin(time: number) { this.used = 0; this.mesh.material.uniforms.clock.value = time; }
  add(p: T.Vector3, q: T.Quaternion, x: number, y: number, z: number, c: T.Color, alpha: number) {
    if (this.used >= this.capacity || alpha <= .008 || Math.min(x, y, z) <= 0) return;
    this.transform.position.copy(p); this.transform.quaternion.copy(q); this.transform.scale.set(x, y, z); this.transform.updateMatrix();
    this.mesh.setMatrixAt(this.used, this.transform.matrix);
    this.tint.setXYZW(this.used++, c.r, c.g, c.b, Math.min(1, alpha));
  }
  end() { this.upload.end(this.used); }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

export function desertBladeGeometry(): T.BufferGeometry {
  const points: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, angle = (u - .5) * 3.1, width = .16 * Math.pow(Math.sin(Math.PI * u), .7);
    for (const side of [-1, 1]) { const r = 1 + side * width; points.push(Math.sin(angle) * r, Math.cos(angle) * r - .35, 0); uv.push(u, (side + 1) / 2); }
    if (i < 24) { const j = i * 2; indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(indices); return g;
}

export function popGreenLeafGeometry(): T.BufferGeometry {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute([0,-.5,0, -.28,-.05,0, 0,0,.08, .25,-.08,0, .08,.5,0], 3));
  g.setIndex([0,1,2,0,2,3,1,4,2,2,4,3]); return g;
}
