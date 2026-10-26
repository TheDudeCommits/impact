import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { installCameraCutaway } from '../CameraCutaway';
import { lookStageMaterial } from '../look/stageMaterials';
import { STAGES, type StageId } from '../../game/stages';

export type KitPiece = string;

export interface Placement {
  x: number; z: number; y?: number; rot?: number;
  scale?: number; width?: number; height?: number; sx?: number; sy?: number; sz?: number;
  tilt?: number; roll?: number; tint?: number;
  shadow?: boolean;
}

interface Part { geometry: THREE.BufferGeometry; material: THREE.Material }
interface Template { parts: Part[]; size: THREE.Vector3; vertices: number }
interface Copy { matrix: THREE.Matrix4; tint?: number; shadow?: boolean; near: boolean }

const BAKE_LIMIT = 24_000;
const SHADOW_REACH = 14;

export class StageKit {
  private readonly loader = new GLTFLoader();
  private readonly templates = new Map<KitPiece, Template>();
  private readonly copies = new Map<KitPiece, Copy[]>();
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly materials = new Map<string, THREE.Material>();
  readonly shadows = new Set<KitPiece>();
  grade?: (material: THREE.MeshStandardMaterial, piece: KitPiece) => void;

  private readonly images = new Map<string, Promise<THREE.Texture>>();

  constructor(readonly root: THREE.Object3D, readonly stage: StageId) {
    this.loader.register(parser => {
      const load = parser.loadImageSource.bind(parser);
      parser.loadImageSource = (index, loader) => {
        const uri = (parser.json as { images?: { uri?: string }[] }).images?.[index]?.uri;
        if (!uri || uri.startsWith('data:')) return load(index, loader);
        const url = new URL(THREE.LoaderUtils.resolveURL(uri, (parser.options as { path?: string }).path ?? ''), document.baseURI).href;
        let image = this.images.get(url);
        if (!image) { image = load(index, loader); this.images.set(url, image); }
        return image.then(texture => texture.clone());
      };
      return { name: 'stage-kit-shared-images' };
    });
  }

  static url(piece: KitPiece) { return piece.startsWith('/') ? piece : `/assets/environment/${piece}.glb`; }

  async load(pieces: readonly KitPiece[]) {
    const pending = [...new Set(pieces)].filter(p => !this.templates.has(p));
    await Promise.all(Array.from({ length: 3 }, async () => { while (pending.length) await this.loadOne(pending.shift()!); }));
  }

  has(piece: KitPiece) { return this.templates.has(piece); }
  size(piece: KitPiece) { return this.template(piece).size; }
  pieceMaterials(piece: KitPiece) { return this.template(piece).parts.map(p => p.material); }
  material(piece: KitPiece, pattern: RegExp) {
    const found = this.template(piece).parts.find(p => pattern.test(p.material.name))?.material;
    if (!found) throw new Error(`StageKit: ${piece} has no material ${pattern}`);
    return found;
  }

  private template(piece: KitPiece) {
    const t = this.templates.get(piece);
    if (!t) throw new Error(`StageKit: ${piece} is not loaded`);
    return t;
  }

  private async loadOne(piece: KitPiece) {
    const url = StageKit.url(piece);
    const gltf: GLTF = await this.loader.loadAsync(url);
    gltf.scene.updateMatrixWorld(true);
    const json = gltf.parser.json as { textures?: { source?: number }[]; images?: { uri?: string }[] };
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    const imageOf = (texture: THREE.Texture) => {
      const index = (gltf.parser.associations.get(texture) as { textures?: number } | undefined)?.textures;
      const source = index === undefined ? undefined : json.textures?.[index]?.source;
      const uri = source === undefined ? undefined : json.images?.[source]?.uri;
      return uri && !uri.startsWith('data:') ? new URL(uri, `http://kit${base}`).pathname : `${url}#${source ?? texture.uuid}`;
    };
    const parts: Part[] = [], bounds = new THREE.Box3(), made = new Map<THREE.Material, THREE.Material>();
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const source = Array.isArray(object.material) ? object.material[0] : object.material;
      let material = made.get(source);
      if (!material) { material = this.shared(source, piece, imageOf); made.set(source, material); }
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      geometry.computeBoundingBox(); bounds.union(geometry.boundingBox!);
      parts.push({ geometry, material });
      object.geometry.dispose();
    });
    if (!parts.length) throw new Error(`StageKit: ${piece} is empty`);
    const centre = bounds.getCenter(new THREE.Vector3());
    for (const part of parts) part.geometry.translate(-centre.x, -bounds.min.y, -centre.z);
    const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const p of parts) byMaterial.set(p.material, [...(byMaterial.get(p.material) ?? []), p.geometry]);
    const merged: Part[] = [];
    for (const [material, list] of byMaterial) {
      const geometry = list.length === 1 ? list[0] : mergeGeometries(list.map(plain));
      if (!geometry) throw new Error(`StageKit: ${piece} parts do not merge`);
      if (list.length > 1) list.forEach(g => g.dispose());
      merged.push({ geometry, material });
    }
    this.templates.set(piece, { parts: merged, size: bounds.getSize(new THREE.Vector3()), vertices: merged.reduce((n, p) => n + p.geometry.getAttribute('position').count, 0) });
  }

  private shared(source: THREE.Material, piece: KitPiece, imageOf: (t: THREE.Texture) => string) {
    const s = source as THREE.MeshStandardMaterial;
    const maps: string[] = [];
    for (const [key, value] of Object.entries(s)) if (value instanceof THREE.Texture) maps.push(`${key}=${imageOf(value)}`);
    const key = [s.name, s.color?.getHexString(), s.emissive?.getHexString(), s.alphaTest, s.transparent, s.side, s.vertexColors, ...maps.sort()].join('|');
    const existing = this.materials.get(key);
    if (existing) { disposeMaterial(source); return existing; }
    for (const [slot, value] of Object.entries(s)) if (value instanceof THREE.Texture) {
      const id = `${imageOf(value)}|${value.colorSpace}|${value.wrapS}|${value.wrapT}|${value.repeat.toArray()}|${value.offset.toArray()}`;
      const known = this.textures.get(id);
      if (known && known !== value) { value.dispose(); (s as unknown as Record<string, unknown>)[slot] = known; }
      else { value.anisotropy = 4; this.textures.set(id, value); }
    }
    const looked = lookStageMaterial(source, this.stage, piece);
    if (looked instanceof THREE.MeshStandardMaterial) {
      looked.roughness = Math.max(.82, looked.roughness); looked.metalness = 0;
      looked.normalScale.multiplyScalar(.45);
      if (looked.alphaTest > 0) looked.alphaTest = .45;
      this.grade?.(looked, piece);
    }
    installCameraCutaway(looked);
    this.materials.set(key, looked);
    return looked;
  }

  place(piece: KitPiece, at: Placement) {
    const t = this.template(piece);
    let s = at.scale ?? 1;
    if (at.width !== undefined) s = at.width / Math.max(t.size.x, 1e-6);
    else if (at.height !== undefined) s = at.height / Math.max(t.size.y, 1e-6);
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(at.x, at.y ?? 0, at.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(at.tilt ?? 0, at.rot ?? 0, at.roll ?? 0, 'YXZ')),
      new THREE.Vector3(s * (at.sx ?? 1), s * (at.sy ?? 1), s * (at.sz ?? 1)));
    const list = this.copies.get(piece) ?? [];
    const { halfX, halfZ } = STAGES[this.stage];
    const near = Math.abs(at.x) < halfX + SHADOW_REACH && Math.abs(at.z) < halfZ + SHADOW_REACH;
    list.push({ matrix, tint: at.tint, shadow: at.shadow, near });
    this.copies.set(piece, list);
  }

  flush(name = this.stage, cellSize = 0) {
    const added: THREE.Mesh[] = [];
    const bakes = new Map<string, { material: THREE.Material; shadow: boolean; geometries: THREE.BufferGeometry[] }>();
    const tinted = new Set<THREE.Material>();
    for (const [piece, list] of this.copies) if (list.some(c => c.tint !== undefined)) for (const part of this.template(piece).parts) tinted.add(part.material);
    for (const m of tinted) { (m as THREE.MeshStandardMaterial).vertexColors = true; m.needsUpdate = true; }
    const colour = new THREE.Color();
    for (const [piece, all] of this.copies) {
      const t = this.template(piece);
      const groups = new Map<string, Copy[]>();
      for (const copy of all) {
        const shadow = copy.shadow ?? (this.shadows.has(piece) && copy.near);
        const e = copy.matrix.elements;
        const cell = cellSize > 0 ? `${Math.floor(e[12] / cellSize)}:${Math.floor(e[14] / cellSize)}` : 'all';
        const key = `${shadow}|${cell}`;
        const list = groups.get(key) ?? []; list.push(copy); groups.set(key, list);
      }
      for (const [group, list] of groups) {
      const shadow = group.startsWith('true|');
      if (!list.length) continue;
      if (t.vertices * list.length > BAKE_LIMIT) {
        for (const part of t.parts) {
          if (tinted.has(part.material) && !part.geometry.getAttribute('color')) paint(part.geometry, colour.setHex(0xffffff));
          const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
          list.forEach((c, i) => mesh.setMatrixAt(i, c.matrix));
          if (list.some(c => c.tint !== undefined)) list.forEach((c, i) => mesh.setColorAt(i, colour.setHex(c.tint ?? 0xffffff)));
          mesh.name = `${name}:${piece}`;
          mesh.castShadow = shadow; mesh.receiveShadow = true;
          mesh.computeBoundingBox(); mesh.computeBoundingSphere();
          this.root.add(mesh); added.push(mesh);
        }
        continue;
      }
      for (const part of t.parts) {
        const key = `${part.material.uuid}|${group}`;
        const bake = bakes.get(key) ?? { material: part.material, shadow, geometries: [] };
        for (const c of list) {
          const g = plain(part.geometry).applyMatrix4(c.matrix);
          if (tinted.has(part.material)) paint(g, colour.setHex(c.tint ?? 0xffffff));
          bake.geometries.push(g);
        }
        bakes.set(key, bake);
      }
      }
    }
    for (const bake of bakes.values()) {
      const geometry = mergeGeometries(bake.geometries);
      bake.geometries.forEach(g => g.dispose());
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, bake.material);
      mesh.name = `${name}:baked:${bake.material.name}`;
      mesh.castShadow = bake.shadow; mesh.receiveShadow = true;
      geometry.computeBoundingSphere();
      this.root.add(mesh); added.push(mesh);
    }
    this.copies.clear();
    return added;
  }

  dispose() {
    for (const t of this.templates.values()) for (const part of t.parts) part.geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    for (const texture of this.textures.values()) texture.dispose();
    this.templates.clear(); this.materials.clear(); this.textures.clear(); this.copies.clear(); this.images.clear();
  }
}

function plain(source: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  const position = source.getAttribute('position') as THREE.BufferAttribute;
  const float = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, size: number) => {
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = a.getComponent(i, k);
    return new THREE.BufferAttribute(out, size);
  };
  g.setAttribute('position', float(position, 3));
  const normal = source.getAttribute('normal'), uv = source.getAttribute('uv');
  g.setAttribute('normal', normal ? float(normal as THREE.BufferAttribute, 3) : new THREE.BufferAttribute(new Float32Array(position.count * 3), 3));
  g.setAttribute('uv', uv ? float(uv as THREE.BufferAttribute, 2) : new THREE.BufferAttribute(new Float32Array(position.count * 2), 2));
  if (source.index) g.setIndex(Array.from(source.index.array));
  else g.setIndex(Array.from({ length: position.count }, (_, i) => i));
  if (!normal) g.computeVertexNormals();
  return g;
}

function paint(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.getAttribute('position').count, out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
}

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
  material.dispose();
}
