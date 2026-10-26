import {installCameraCutaway} from './CameraCutaway';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

import { AUTHORED_BUILDINGS, BACKDROP_CASTLE, CITY_TERRACES, PODIUM_DIMENSIONS, STONE_ARCH, HARBOR_BRIDGES, TORII, SAKURA_TREES, GARDEN_TREES, PROP_CLUSTERS,
  QUAY_FLANKS, QUAY_ROCKS, HARBOR_CHESTS, HARBOR_DOCKS } from '../game/environmentLayout';
export { ENVIRONMENT_COLLIDERS } from '../game/environmentLayout';
export type { EnvironmentCollider } from '../game/environmentLayout';

interface Part { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }
interface Template { parts: Part[]; size: THREE.Vector3 }
interface Batch { template: Template; matrices: THREE.Matrix4[]; shadow: boolean; occluder: boolean }

const BASE = '/assets/environment/';
export const ENVIRONMENT_ASSET_URLS: Readonly<Record<string, string>> = Object.freeze({
  ...Object.fromEntries(['building-grand', 'building-shop', 'building-courtyard', 'dojo', 'pagoda', 'torii',
    'river-bridge', 'sakura', 'bush', 'ivy', 'poster', 'lantern', 'wall-tall', 'stone-podium'].map(name => [`asian-${name}`, `${BASE}asian/${name}.glb`])),
  ...Object.fromEntries(['castle-wall', 'structure-platform-dock', 'structure-fence', 'barrel', 'crate', 'crate-bottles',
    'chest', 'boat-row-small', 'boat-row-large', 'rocks-a', 'rocks-b'].map(name => [name, `${BASE}harbor/${name}.glb`])),
  'stone-arch': `${BASE}stone-arch/bridge.glb`,
  'asian-garden-tree': `${BASE}asian/sakura.glb`,
  'kokura-castle': `${BASE}kokura-keep/keep.glb`,
});
export class ArenaEnvironment {
  public readonly occluders: THREE.Object3D[] = [];
  public readonly root = new THREE.Group();
  private readonly loader: GLTFLoader;
  private readonly textureLoader: THREE.TextureLoader;
  private readonly sourceErrors = new Set<string>();
  private readonly templates = new Map<string, Template>();
  private readonly batches = new Map<string, Batch>();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();
  private readonly sharedTextures = new Map<string, THREE.Texture>();
  private readonly sourceScenes: THREE.Object3D[] = [];
  private loadPromise?: Promise<void>;
  private disposed = false;
  private water?: THREE.Mesh;
  private waterMaterial?: THREE.MeshStandardMaterial;
  private readonly waterTime = { value: 0 };

  constructor(private readonly scene: THREE.Scene) {
    this.root.name = 'MangaHarborEnvironment';
    const manager = new THREE.LoadingManager();
    manager.onError = url => this.sourceErrors.add(url);
    this.loader = new GLTFLoader(manager);
    this.textureLoader = new THREE.TextureLoader(manager);
    scene.add(this.root);
  }

  public load(onProgress?: (label: string) => void): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('ArenaEnvironment has been disposed'));
    this.loadPromise ??= this.loadAssets(onProgress).catch(error => {
      this.dispose();
      throw error;
    });
    return this.loadPromise;
  }

  private async loadAssets(onProgress?: (label: string) => void): Promise<void> {
    onProgress?.('Loading Japanese harbor architecture');
    const tasks: Promise<unknown>[] = Object.entries(ENVIRONMENT_ASSET_URLS).map(([key, url]) => this.loadModel(key, url));
    const texturePaths = ['paving/pavement_01_diff_2k.jpg', 'paving/pavement_01_nor_gl_2k.jpg',
      'paving/pavement_01_rough_2k.jpg'];
    const maps: THREE.Texture[] = [];
    tasks.push(...texturePaths.map(async (path, i) => {
      const texture = await this.textureLoader.loadAsync(BASE + path);
      this.textures.add(texture);
      maps[i] = texture;
    }));
    const results = await Promise.allSettled(tasks);
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length || this.sourceErrors.size) {
      throw new Error(`Harbor source assets failed to load: ${[...this.sourceErrors,
        ...failures.map(f => String(f.reason))].join('; ')}`);
    }
    if (this.disposed) {
      this.releaseResources();
      throw new Error('ArenaEnvironment was disposed while loading');
    }
    onProgress?.('Assembling the stone plaza and harbor');
    this.configureStone();
    this.configureHarborWood();
    this.buildGround(maps[0], maps[1], maps[2]);
    this.buildStreets();
    this.buildQuays();
    this.buildSkyline();
    this.buildProps();
    this.flushBatches();
    this.root.updateMatrixWorld(true);
    onProgress?.('Harbor ready');
  }

  private async loadModel(key: string, path: string): Promise<void> {
    const gltf: GLTF = await this.loader.loadAsync(path);
    this.sourceScenes.push(gltf.scene);
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.add(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        this.materials.add(material);
        for (const [property, value] of Object.entries(material)) {
          if (!(value instanceof THREE.Texture)) continue;
          value.anisotropy = 8;
          const family = key.startsWith('asian-') ? 'rg' : key === 'kokura-castle' ? 'avatta-kokura' : 'harbor';
          const identity = `${family}:${value.name}:${value.colorSpace}:${value.wrapS}:${value.wrapT}:${value.channel}:${value.offset.toArray()}:${value.repeat.toArray()}:${value.rotation}`;
          const existing = value.name ? this.sharedTextures.get(identity) : undefined;
          if (existing) (material as unknown as Record<string, unknown>)[property] = existing;
          else { if (value.name) this.sharedTextures.set(identity, value); this.textures.add(value); }
        }
        if (material instanceof THREE.MeshStandardMaterial) {
          if (key !== 'kokura-castle') {
            material.metalness = 0;
            material.roughness = .88;
          }
          if (key === 'stone-arch') this.gradeSourceMaterial(material, 'arch');
          if (key.startsWith('asian-')) {
            if (material.name.includes('Roof')) this.gradeSourceMaterial(material, 'roof');
            else if (material.name.includes('Cocnrate')) this.gradeSourceMaterial(material, 'cream');
            else if (material.name.includes('Bricks')) this.gradeSourceMaterial(material,
              material.name.includes('Random') ? 'worn-stone' : 'stone');
            else if (material.name.includes('Wood') && !material.name.includes('Red') && key !== 'asian-torii') material.color.multiplyScalar(.67);
            material.normalScale.clampScalar(-.38, .38);
            if (key === 'asian-sakura' || key === 'asian-garden-tree') material.alphaTest = material.alphaTest || .5;
            if (key === 'asian-garden-tree' && material.name.includes('Sakura')) this.gradeSourceMaterial(material, 'foliage');
          }
        }
      }
    });
    this.templates.set(key, this.makeTemplate(gltf.scene));
  }

  private gradeSourceMaterial(material: THREE.MeshStandardMaterial,
    kind: 'arch' | 'stone' | 'worn-stone' | 'cream' | 'roof' | 'foliage'): void {
    const grades = {
      arch: 'diffuseColor.rgb=mix(vec3(.18,.21,.22),vec3(.98,.94,.82),smoothstep(.02,.24,sourceValue));',
      stone: 'diffuseColor.rgb=mix(vec3(.16,.20,.22),vec3(.94,.91,.81),smoothstep(.045,.26,sourceValue));',
      'worn-stone': 'diffuseColor.rgb=mix(vec3(.15,.19,.20),vec3(.91,.87,.74),smoothstep(.03,.20,sourceValue));',
      cream: 'diffuseColor.rgb=mix(vec3(.29,.30,.27),vec3(.97,.93,.81),smoothstep(.06,.32,sourceValue));',
      roof: 'diffuseColor.rgb=mix(vec3(.025,.065,.11),vec3(.13,.33,.48),smoothstep(.055,.23,sourceValue));',
      foliage: 'diffuseColor.rgb=mix(vec3(.035,.085,.04),vec3(.31,.47,.11),smoothstep(.08,.70,sourceValue));',
    };
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
        `#include <map_fragment>
float sourceValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
${grades[kind]}`);
    };
    material.customProgramCacheKey = () => `terraced-harbor-source-grade-${kind}-v1`;
    material.needsUpdate = true;
  }

  private makeTemplate(source: THREE.Object3D): Template {
    const parts: Part[] = [];
    const bounds = new THREE.Box3();
    source.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      geometry.computeBoundingBox();
      bounds.union(geometry.boundingBox!);
      parts.push({ geometry, material: object.material });
      this.geometries.add(geometry);
    });
    if (!parts.length || bounds.isEmpty()) throw new Error(`Empty environment source ${source.name}`);
    const center = bounds.getCenter(new THREE.Vector3());
    for (const part of parts) part.geometry.translate(-center.x, -bounds.min.y, -center.z);
    return { parts, size: bounds.getSize(new THREE.Vector3()) };
  }

  private configureStone(): void {
    const authoredBricks = [...this.materials].find(material =>
      material instanceof THREE.MeshStandardMaterial && material.name === 'RG Bricks') as THREE.MeshStandardMaterial | undefined;
    if (!authoredBricks?.map) return;
    const brickMap = authoredBricks.map;
    brickMap.wrapS = brickMap.wrapT = THREE.RepeatWrapping;
    for (const part of this.templates.get('castle-wall')!.parts) {
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.onBeforeCompile = shader => {
          shader.uniforms.harborBrickMap = { value: brickMap };
          shader.vertexShader = 'varying vec3 vHarborPosition;\nvarying vec3 vHarborNormal;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
            vec4 harborPosition = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              harborPosition = instanceMatrix * harborPosition;
            #endif
            vHarborPosition = (modelMatrix * harborPosition).xyz;
            vHarborNormal = normalize(mat3(modelMatrix) * objectNormal);`);
          shader.fragmentShader = 'uniform sampler2D harborBrickMap;\nvarying vec3 vHarborPosition;\nvarying vec3 vHarborNormal;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            vec2 masonryUv = (abs(vHarborNormal.y) > 0.6 ? vHarborPosition.xz : vec2(vHarborPosition.x + vHarborPosition.z, vHarborPosition.y)) / 3.6;
            vec3 masonry = texture2D(harborBrickMap, masonryUv).rgb;
            float stoneValue = dot(masonry, vec3(0.2126, 0.7152, 0.0722));
            diffuseColor.rgb = mix(vec3(.16,.20,.22),vec3(.94,.91,.81),smoothstep(.045,.26,stoneValue));`);
        };
        material.customProgramCacheKey = () => 'sourced-rg-coursed-brick-ivory-quay-v3';
        material.needsUpdate = true;
      }
    }
  }

  private configureHarborWood(): void {
    const sourceWood = [...this.materials].find(material => material instanceof THREE.MeshStandardMaterial
      && material.name === 'RG Wood 1' && material.map) as THREE.MeshStandardMaterial | undefined;
    if (!sourceWood?.map) return;
    const grainMap = sourceWood.map;
    grainMap.wrapS = grainMap.wrapT = THREE.RepeatWrapping;
    for (const key of ['barrel', 'crate', 'crate-bottles', 'chest', 'boat-row-small', 'boat-row-large', 'structure-platform-dock', 'structure-fence']) {
      for (const part of this.templates.get(key)!.parts) for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.roughness = .94;
        material.onBeforeCompile = shader => {
          shader.uniforms.harborWoodMap = { value: grainMap };
          shader.vertexShader = 'varying vec3 vCargoPosition;\nvarying vec3 vCargoNormal;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
            vec4 cargoPosition=vec4(transformed,1.);
            vec3 cargoNormal=objectNormal;
            #ifdef USE_INSTANCING
              cargoPosition=instanceMatrix*cargoPosition;
              cargoNormal=mat3(instanceMatrix)*cargoNormal;
            #endif
            vCargoPosition=(modelMatrix*cargoPosition).xyz;
            vCargoNormal=normalize(mat3(modelMatrix)*cargoNormal);`);
          shader.fragmentShader = 'uniform sampler2D harborWoodMap;\nvarying vec3 vCargoPosition;\nvarying vec3 vCargoNormal;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            vec2 grainUv=abs(vCargoNormal.y)>.6?vCargoPosition.xz:vec2(vCargoPosition.x+vCargoPosition.z,vCargoPosition.y);
            vec3 grain=texture2D(harborWoodMap,grainUv/1.8).rgb;
            float grainValue=dot(grain,vec3(.2126,.7152,.0722));
            float timber=smoothstep(.025,.16,diffuseColor.r-diffuseColor.b);
            float iron=smoothstep(.015,.12,diffuseColor.b-diffuseColor.r);
            vec3 timberColor=vec3(.38,.22,.095)*(.65+grainValue*2.1);
            diffuseColor.rgb=mix(diffuseColor.rgb*.75,timberColor,timber);
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.065,.085,.105),iron);`);
        };
        material.customProgramCacheKey = () => 'kenney-palette-rg-grain-v1';
        material.needsUpdate = true;
      }
    }
  }

  private add(key: string, x: number, y: number, z: number, scale: number | THREE.Vector3 = 1,
    rotation = 0, shadow = true, occluder = false): void {
    const template = this.templates.get(key);
    if (!template) throw new Error(`Environment template ${key} is unavailable`);
    const batchKey = `${key}:${shadow ? 'near' : 'far'}:${occluder}`;
    let batch = this.batches.get(batchKey);
    if (!batch) {
      batch = { template, matrices: [], shadow, occluder };
      this.batches.set(batchKey, batch);
    }
    const scaling = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale;
    batch.matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotation), scaling));
  }

  private fit(key: string, x: number, y: number, z: number, width: number, height: number, depth: number,
    rotation = 0, shadow = true, occluder = false): void {
    const size = this.templates.get(key)!.size;
    this.add(key, x, y, z, new THREE.Vector3(width / size.x, height / size.y, depth / size.z),
      rotation, shadow, occluder);
  }

  private buildGround(diffuse: THREE.Texture, normal: THREE.Texture, roughness: THREE.Texture): void {
    for (const map of [diffuse, normal, roughness]) {
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = 8;
    }
    diffuse.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = roughness.colorSpace = THREE.NoColorSpace;
    const paving = new THREE.MeshStandardMaterial({
      map: diffuse, normalMap: normal, roughnessMap: roughness,
      normalScale: new THREE.Vector2(.28, .28), color: 0xffffff, roughness: .94, metalness: 0,
    });
    this.materials.add(paving);
    paving.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
        `#include <map_fragment>
float pavementValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
diffuseColor.rgb=mix(vec3(.13,.17,.19),vec3(.94,.90,.78),smoothstep(.045,.50,pavementValue));`);
    };
    paving.customProgramCacheKey = () => 'ivory-harbor-paving-v3';
    const surface = (name: string, width: number, depth: number, x: number, z: number) => {
      const geometry = new THREE.PlaneGeometry(width, depth);
      geometry.rotateX(-Math.PI / 2);
      const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
      for (let i = 0; i < positions.count; i++) uv.setXY(i,
        (positions.getX(i) + x) / 6.6, (positions.getZ(i) + z) / 6.6);
      const mesh = new THREE.Mesh(geometry, paving);
      mesh.name = name;
      mesh.position.set(x, 0, z);
      mesh.receiveShadow = true;
      this.geometries.add(geometry);
      this.root.add(mesh);
    };
    surface('Main walkable plaza', 160, 108, 0, 26);
    surface('Far harbor promenade and visual city base', 160, 90, 0, -87);
    for (const x of [-27, 27]) surface('Stone harbor crossing', 10, 14, x, -35);
    const waterGeometry = new THREE.PlaneGeometry(168, 14);
    waterGeometry.rotateX(-Math.PI / 2);
    this.waterMaterial = new THREE.MeshStandardMaterial({ color: 0x057daf, roughness: .26,
      metalness: 0, emissive: 0x005b89, emissiveIntensity: .10, envMapIntensity: .22 });
    this.waterMaterial.onBeforeCompile = shader => {
      shader.uniforms.harborWaterTime = this.waterTime;
      shader.vertexShader = 'varying vec2 vCanalPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvCanalPosition=(modelMatrix*vec4(position,1.)).xz;');
      shader.fragmentShader = 'uniform float harborWaterTime;\nvarying vec2 vCanalPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float canalX=vCanalPosition.x,canalZ=vCanalPosition.y;
        float rippleX=sin(canalX*1.6+canalZ*.55+harborWaterTime*1.2)*.08+sin(canalX*.43-canalZ*.74-harborWaterTime*.7)*.055;
        float rippleZ=sin(canalZ*3.4+canalX*.23-harborWaterTime*1.6)*.12;
        normal=normalize(mat3(viewMatrix)*vec3(rippleX,1.,rippleZ));`);
    };
    this.waterMaterial.customProgramCacheKey = () => 'source-sky-reflected-canal-v2';
    this.water = new THREE.Mesh(waterGeometry, this.waterMaterial);
    this.water.name = 'Open blue harbor canal';
    this.water.position.set(0, -.2, -35);
    this.root.add(this.water);
    this.geometries.add(waterGeometry);
    this.materials.add(this.waterMaterial);
  }

  private buildStreets(): void {
    for (const building of AUTHORED_BUILDINGS) {
      if (building.z < -42) continue;
      this.add(`asian-${building.asset}`, building.x, building.y, building.z, building.scale,
        building.rotation, building.shadow ?? false, true);
    }
    for (const [x, z, rotation] of [[-9.04, -4, Math.PI / 2], [9.04, -4, -Math.PI / 2],
      [-9.04, -12, Math.PI / 2], [9.04, -12, -Math.PI / 2],
      [-7.15, -19.8, Math.PI / 2], [7.15, -19.8, -Math.PI / 2]] as const) {
      this.add('asian-lantern', x, 3.15, z, 1.75, rotation, true);
      this.add('asian-poster', Math.sign(x) * 8.13, 1.2, z, 3.5, rotation, true);
    }
  }

  private buildQuays(): void {
    for (const z of [-28, -42]) {
      for (let x = -78; x <= 78; x += 2.8) {
        if ((x > -33.5 && x < -20.5) || (x > 20.5 && x < 33.5)) continue;
        const height = z === -28 && Math.abs(x) < 22 ? .4 : 1.25;
        this.fit('castle-wall', x, -.05, z, 2.8, height, 1.4, 0, z === -28, true);
      }
    }
    for (const x of [-27, 27]) {
      const bridge = HARBOR_BRIDGES.find(b => b.x === x)!;
      this.add('asian-river-bridge', x, -.13514 * bridge.scale, bridge.z, bridge.scale, Math.PI / 2, true, true);
      for (const dx of [-5, 5]) {
        for (let z = -41; z < -28; z += 2.8) {
          this.fit('castle-wall', x + dx, -.05, z, 2.8, 1.3, .8, Math.PI / 2, true, true);
        }
      }
    }
    for (const dock of HARBOR_DOCKS) {
      this.fit('structure-platform-dock', dock.x, dock.y, dock.z, dock.width, dock.height, dock.depth, 0, true);
    }
    const boatWaterline = (scale: number) => -.2 - .24 * scale;
    this.add('boat-row-large', -7, boatWaterline(1.15), -36, 1.15, .18, false);
    this.add('boat-row-small', 12, boatWaterline(1.25), -37.5, 1.25, -.25, false);
    this.add('boat-row-small', -45, boatWaterline(1.1), -34.7, 1.1, .32, false);
  }

  private buildSkyline(): void {
    for (const terrace of CITY_TERRACES) {
      for (let layer = 0; layer < terrace.layers; layer++) {
        for (let col = 0; col < terrace.columns; col++) for (let row = 0; row < terrace.rows; row++) {
          if (layer < terrace.layers - 1 && col > 0 && col < terrace.columns - 1 && row > 0 && row < terrace.rows - 1) continue;
          this.add('asian-stone-podium', terrace.x + (col - (terrace.columns - 1) / 2) * PODIUM_DIMENSIONS[0],
            terrace.baseY + layer * PODIUM_DIMENSIONS[1], terrace.z + (row - (terrace.rows - 1) / 2) * PODIUM_DIMENSIONS[2], 1, 0, false, !terrace.backdrop);
        }
      }
    }
    for (const building of AUTHORED_BUILDINGS) {
      if (building.z >= -42) continue;
      this.add(`asian-${building.asset}`, building.x, building.y, building.z, building.scale,
        building.rotation, false, !building.backdrop);
    }
    const keep = BACKDROP_CASTLE;
    this.add('kokura-castle', keep.x, keep.y, keep.z,
      keep.height / this.templates.get('kokura-castle')!.size.y, keep.rotation, false, false);
    this.add('stone-arch', STONE_ARCH.x, STONE_ARCH.y, STONE_ARCH.z, STONE_ARCH.scale, STONE_ARCH.rotation, true, true);
    this.add('asian-torii', TORII.x, TORII.y, TORII.z, TORII.scale, TORII.rotation, false, true);
    for (const dx of [-4.8, 4.8]) this.add('asian-lantern', TORII.x + dx, TORII.y + 4.9, TORII.z, 1.9, 0, false);
    for (const tree of SAKURA_TREES) {
      this.add('asian-sakura', tree.x, 0, tree.z, tree.scale, tree.rotation, tree.z > -30);
    }
    for (const tree of GARDEN_TREES) {
      this.add('asian-garden-tree', tree.x, tree.y, tree.z, tree.scale, tree.rotation, false, !tree.backdrop);
    }
    this.buildTerraceGardens();
    for (const flank of QUAY_FLANKS) {
      this.fit('castle-wall', flank.x, 0, flank.z, flank.length, flank.height, flank.depth, Math.PI / 2, false, true);
    }
  }

  private buildTerraceGardens(): void {
    const groups = [
 {id:'01-west-retaining-garden', bushes:[[-36,2.372757,-62,4.2],[-32,2.372757,-62.4,4.8],[-29,2.372757,-62.1,3.6]],ivy:[[-35,.12,-59.00,1.45],[-29,.15,-59.00,1.4],[-27.8,.35,-59.00,1.25]]},
 {id:'02-center-retaining-garden',bushes:[[9,2.372757,-62.1,4.3],[14.7,2.372757,-62.7,4.9]],ivy:[[9,.12,-59.00,1.45],[15,.25,-59.00,1.3]]},
 {id:'03-west-middle-garden',bushes:[[-34,4.745514,-69,5.4],[-29.7,4.745514,-69,4.9]],ivy:[[-34,2.5,-64.10,1.4],[-29,2.55,-64.10,1.35]]},
 {id:'04-center-middle-garden',bushes:[[9,4.745514,-70,5.5],[4,4.745514,-71,4.5]],ivy:[[9,2.55,-64.10,1.4]]},
 {id:'05-upper-west-garden',bushes:[[-45,7.118271,-91,6.8],[-30.8,7.118271,-99,6.5],[-45,7.118271,-96,5.2]],ivy:[]},
 {id:'06-upper-center-garden',bushes:[[4,7.118271,-94,6.2],[6.5,7.118271,-88,7.6],[6.5,7.118271,-99,6.0]],ivy:[]},
 {id:'07-upper-east-garden',bushes:[[37,7.118271,-92,6.5],[37,7.118271,-99,5.5]],ivy:[]},
] as const;
    const patterns = [[-.17, -.12, .94, .31], [.19, -.035, 1.035, 1.73], [-.025, .19, 1.025, 2.79]] as const;
    for (const group of groups) {
      group.bushes.forEach(([x, y, z, sourceScale], anchor) => {
        const support = CITY_TERRACES.find(t => Math.abs(t.baseY + t.height - y) < .001
          && Math.abs(t.x - x) <= t.width / 2 && Math.abs(t.z - z) <= t.depth / 2);
        if (!support) throw new Error(`Unsupported source garden ${group.id}:${anchor}`);
        for (const [dx, dz, variation, turn] of patterns) {
          const scale = sourceScale * .55 * variation, rotation = x * .19 + turn + anchor * .47;
          const c = Math.abs(Math.cos(rotation)), s = Math.abs(Math.sin(rotation));
          const halfX = (1.052069 * c + 1.037288 * s) * scale / 2;
          const halfZ = (1.052069 * s + 1.037288 * c) * scale / 2;
          const px = Math.min(support.x + support.width / 2 - halfX - .025,
            Math.max(support.x - support.width / 2 + halfX + .025, x + dx * sourceScale));
          const pz = Math.min(support.z + support.depth / 2 - halfZ - .025,
            Math.max(support.z - support.depth / 2 + halfZ + .025, z + dz * sourceScale));
          this.add('asian-bush', px, y, pz, scale, rotation, false, false);
        }
      });
      for (const [x, y, z, scale] of group.ivy) this.add('asian-ivy', x, y, z, scale, 0, false, false);
    }
  }

  private buildProps(): void {
    for (let i = 0; i < PROP_CLUSTERS.length; i++) {
      const [x, z, side] = PROP_CLUSTERS[i];
      this.add('barrel', x, 0, z, 1.05, .12 * i, true);
      this.add('crate', x + side * 1.6, 0, z + .6, 1.3, -.08 * i, true);
      const waterfrontCargo = (x === -7.8 && z === -25.6) || (x === 8.3 && z === -25.5);
      this.add(waterfrontCargo ? 'crate-bottles' : 'crate', x + side * 1.5, .99, z + .55,
        waterfrontCargo ? .66 : .95, waterfrontCargo ? -.2 : .09 + .11 * i, true);
      if (waterfrontCargo) this.add('barrel', x + side * .5, 0, z + .9, .62, .3, true);
      if (i % 2 === 0) this.add('crate-bottles', x + side * 2.8, 0, z - .8, 1, .2, true);
      else this.add('barrel', x + side * 2.8, 0, z - .7, .86, -.3, true);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        this.fit('structure-fence', side * 16, 0, -19 + i * 2.5,
          2.5, 1.1, .22, Math.PI / 2, true);
      }
    }
    for (const chest of HARBOR_CHESTS) this.add('chest', chest.x, 0, chest.z, chest.scale, chest.rotation, true);
    for (const rock of QUAY_ROCKS) this.add(rock.asset, rock.x, rock.y, rock.z, rock.scale, rock.rotation, false);
  }

  private flushBatches(): void {
    let drawCalls = 0, triangles = 0, instances = 0;
    for (const [name, batch] of this.batches) {
      for (const part of batch.template.parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, batch.matrices.length);
        mesh.name = name;
        batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = batch.shadow;
        mesh.receiveShadow = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        this.root.add(mesh);
        if (batch.occluder) this.occluders.push(mesh);
        for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])installCameraCutaway(material);
        instances += batch.matrices.length;
        triangles += (part.geometry.index?.count ?? part.geometry.getAttribute('position').count) / 3 * batch.matrices.length;
        drawCalls += Array.isArray(part.material) ? part.material.length : 1;
      }
    }
    this.root.userData.environmentBudget = { instancedDrawCalls: drawCalls, staticSurfaceDrawCalls: 5,
      triangles: triangles + 10, instances, notes: 'Main pass estimate; shadow/outline passes are renderer-owned.' };
    this.batches.clear();
  }

  public update(time: number): void {
    this.waterTime.value = time;
    if (this.water) this.water.position.y = -.2 + Math.sin(time * .6) * .012;
  }

  private releaseResources(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.geometries.clear(); this.materials.clear(); this.textures.clear();
    this.templates.clear(); this.batches.clear(); this.sharedTextures.clear(); this.sourceScenes.length = 0;
  }

  public dispose(): void {
    this.disposed = true;
    this.scene.remove(this.root);
    this.root.traverse(object => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    this.root.clear();
    this.occluders.length = 0;
    this.water = undefined;
    this.waterMaterial = undefined;
    this.releaseResources();
  }
}
