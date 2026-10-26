import * as THREE from 'three';
import {FireField, type FireSpot} from '../rift/fire';
import {addShaderPatch} from '../look/shaderPatch';

export class ObjectiveAmbience {
  readonly root = new THREE.Group();
  private time = {value: 0};
  private empty = new THREE.DataTexture(new Uint8Array(8), 1, 2);
  private fires = new FireField(16, {uBroken: {value: this.empty}, uRiftTime: this.time});
  private banner?: THREE.MeshStandardMaterial;

  constructor(private variant: 'leaf' | 'blood') {
    this.empty.needsUpdate = true;
    this.root.name = 'Wind, cloth and fire';
    this.root.add(this.fires.root);
  }

  async load() {
    const map = await new THREE.TextureLoader().loadAsync('/assets/environment/objectives/war-banners.webp');
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    this.banner = new THREE.MeshStandardMaterial({map, roughness: 1, side: THREE.DoubleSide, color: 0xd8ccc0});
    addShaderPatch(this.banner, 'objective-cloth-v1', shader => {
      shader.uniforms.uClothTime = this.time;
      shader.vertexShader = 'uniform float uClothTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float freeCloth = pow(1.0 - uv.y, 1.3);
        transformed.z += freeCloth * (sin(position.y * 1.7 + uClothTime * 1.8) * .13 + sin(position.x * 4.0 + position.y * 2.0 - uClothTime * 2.7) * .055);
        transformed.x += freeCloth * sin(uClothTime * .9 + position.y * 1.5) * .06;`);
    });
  }

  cloth(x: number, y: number, z: number, width: number, height: number, rotation = 0) {
    if (!this.banner) throw new Error('Load ambience before placing cloth');
    const geometry = new THREE.PlaneGeometry(width, height, 12, 24);
    const uv = geometry.attributes.uv, p = geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      uv.setX(i, uv.getX(i) * .498 + (this.variant === 'leaf' ? .001 : .501));
      if (uv.getY(i) < .08) p.setY(i, p.getY(i) + .055 * Math.sin(i * 19.13));
    }
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, this.banner);
    mesh.position.set(x, y, z); mesh.rotation.y = rotation;
    mesh.receiveShadow = true; this.root.add(mesh);
  }

  fire(spots: FireSpot[]) { this.fires.set(spots); }
  fireLevel(level:number) { this.fires.level.value=level; }
  update(time: number) { this.time.value = time; this.fires.update(time); }
  dispose() { this.empty.dispose(); }
}

export function weatherStone(material: THREE.MeshStandardMaterial, wet: boolean) {
  addShaderPatch(material, `objective-stone-${wet ? 'wet' : 'dry'}-v1`, shader => {
    const noise = `
      varying vec3 vStoneWorld;
      float sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float sNoise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(sHash(i),sHash(i+vec2(1,0)),f.x),mix(sHash(i+vec2(0,1)),sHash(i+vec2(1,1)),f.x),f.y); }
      float sWear(vec2 p) { return sNoise(p*.14)*.65+sNoise(p*.53)*.25+sNoise(p*2.3)*.1; }
    `;
    shader.vertexShader = 'varying vec3 vStoneWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStoneWorld=(modelMatrix*vec4(position,1.0)).xyz;');
    shader.fragmentShader = noise + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float wear=sWear(vStoneWorld.xz);
      float damp=smoothstep(.54,.73,wear);
      diffuseColor.rgb *= mix(.69,1.12,smoothstep(.24,.68,wear));
      diffuseColor.rgb = mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.53,.65,.68),damp*${wet ? '.7' : '.22'});
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,${wet ? '.21' : '.63'},damp*${wet ? '.88' : '.3'});`);
  });
}
