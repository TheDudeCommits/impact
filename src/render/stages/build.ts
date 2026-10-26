import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addShaderPatch } from '../look/shaderPatch';
import { lookStageMaterial } from '../look/stageMaterials';
import { installCameraCutaway } from '../CameraCutaway';
import type { StageId } from '../../game/stages';
import type { StageProp } from '../../game/stageProps';
import type { KitPiece, StageKit } from './StageKit';


export function stageMaterial(stage: StageId, name: string, params: THREE.MeshStandardMaterialParameters) {
  const material = lookStageMaterial(new THREE.MeshStandardMaterial({ name, roughness: .9, metalness: 0, ...params }), stage, name) as THREE.MeshStandardMaterial;
  installCameraCutaway(material);
  return material;
}

export function wearGround(material: THREE.MeshStandardMaterial, o: { key: string; scale?: number; light?: [number, number]; patch?: number; patchAmount?: number; damp?: number; dampTint?: number }) {
  const patch = new THREE.Color(o.patch ?? 0x6b5a44), damp = new THREE.Color(o.dampTint ?? 0x6c7a80);
  const [lo, hi] = o.light ?? [.72, 1.1];
  addShaderPatch(material, `br-wear-${o.key}`, shader => {
    shader.vertexShader = 'varying vec3 vWearWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wearLocal = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        wearLocal = instanceMatrix * wearLocal;
      #endif
      vWearWorld = ( modelMatrix * wearLocal ).xyz;`);
    shader.fragmentShader = `varying vec3 vWearWorld;
      float wHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      float wNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f );
        return mix( mix( wHash( i ), wHash( i + vec2( 1., 0. ) ), f.x ), mix( wHash( i + vec2( 0., 1. ) ), wHash( i + vec2( 1., 1. ) ), f.x ), f.y ); }
      float wWear( vec2 p ) { return wNoise( p * .07 ) * .55 + wNoise( p * .29 ) * .3 + wNoise( p * 1.7 ) * .15; }
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float wear = wWear( vWearWorld.xz * ${(o.scale ?? 1).toFixed(3)} );
      diffuseColor.rgb *= mix( ${lo.toFixed(3)}, ${hi.toFixed(3)}, smoothstep( .22, .7, wear ) );
      diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( ${patch.r.toFixed(3)}, ${patch.g.toFixed(3)}, ${patch.b.toFixed(3)} ) * 1.6, smoothstep( .42, .2, wear ) * ${(o.patchAmount ?? .5).toFixed(3)} );
      float wDamp = smoothstep( .58, .74, wear ) * ${(o.damp ?? .25).toFixed(3)};
      diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( ${damp.r.toFixed(3)}, ${damp.g.toFixed(3)}, ${damp.b.toFixed(3)} ), wDamp );`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix( roughnessFactor, .35, wDamp );`);
  });
}

export function groundPlane(stage: StageId, o: { name: string; map: THREE.Texture; normal?: THREE.Texture; tile: number; size: [number, number]; centre?: [number, number]; y?: number;
  color?: number; roughness?: number; normalScale?: number }) {
  const [w, d] = o.size;
  for (const t of [o.map, o.normal]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / o.tile, d / o.tile); }
  if (o.normal) o.normal.colorSpace = THREE.NoColorSpace;
  const material = stageMaterial(stage, o.name, { map: o.map, normalMap: o.normal ?? null, color: o.color ?? 0xffffff, roughness: o.roughness ?? .92,
    normalScale: new THREE.Vector2(o.normalScale ?? .6, o.normalScale ?? .6) });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), material);
  mesh.position.set(o.centre?.[0] ?? 0, o.y ?? 0, o.centre?.[1] ?? 0);
  mesh.receiveShadow = true; mesh.name = o.name;
  return mesh;
}

export function wallBand(path: [number, number][], o: { height: number; tile: number; inside: [number, number]; pilaster?: number; pilasterWidth?: number; depth?: number; base?: number }) {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, dd: THREE.Vector3, n: THREE.Vector3, ua: number, ub: number) => {
    for (const [p, u, v] of [[a, ua, a.y], [b, ub, b.y], [c, ub, c.y], [a, ua, a.y], [c, ub, c.y], [dd, ua, dd.y]] as [THREE.Vector3, number, number][]) {
      positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z); uvs.push(u / o.tile, v / o.tile);
    }
  };
  const base = o.base ?? -1;
  let along = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const [x0, z0] = path[i], [x1, z1] = path[i + 1];
    const length = Math.hypot(x1 - x0, z1 - z0);
    if (length < 1e-3) continue;
    const n = new THREE.Vector3(-(z1 - z0), 0, x1 - x0).normalize();
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (n.x * (o.inside[0] - mx) + n.z * (o.inside[1] - mz) < 0) n.negate();
    const a = new THREE.Vector3(x0, base, z0), b = new THREE.Vector3(x1, base, z1), c = new THREE.Vector3(x1, o.height, z1), d = new THREE.Vector3(x0, o.height, z0);
    if (new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).dot(n) > 0) quad(a, b, c, d, n, along, along + length);
    else quad(b, a, d, c, n, along + length, along);
    if (o.pilaster) {
      const t = new THREE.Vector3(x1 - x0, 0, z1 - z0).normalize(), w = (o.pilasterWidth ?? 5) / 2, out = o.depth ?? 2.5;
      for (let s = o.pilaster / 2; s < length; s += o.pilaster) {
        const cx = x0 + t.x * s, cz = z0 + t.z * s;
        const box = new THREE.BoxGeometry(w * 2, o.height - base, out * 2).toNonIndexed();
        const yaw = Math.atan2(t.x, t.z) + Math.PI / 2;
        box.rotateY(yaw).translate(cx, (o.height + base) / 2, cz);
        const p = box.getAttribute('position'), nn = box.getAttribute('normal');
        for (let k = 0; k < p.count; k++) {
          positions.push(p.getX(k), p.getY(k), p.getZ(k)); normals.push(nn.getX(k), nn.getY(k), nn.getZ(k));
          const horizontal = Math.abs(nn.getY(k)) > .5 ? p.getX(k) : (Math.abs(nn.getX(k)) > Math.abs(nn.getZ(k)) ? p.getZ(k) : p.getX(k));
          uvs.push(horizontal / o.tile, (Math.abs(nn.getY(k)) > .5 ? p.getZ(k) : p.getY(k)) / o.tile);
        }
        box.dispose();
      }
    }
    along += length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return g;
}

export function roundedRect(x0: number, z0: number, x1: number, z1: number, r: number, steps = 6) {
  const pts: [number, number][] = [];
  const corner = (cx: number, cz: number, a0: number) => { for (let i = 0; i <= steps; i++) { const a = a0 + i / steps * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } };
  corner(x1 - r, z0 + r, -Math.PI / 2); corner(x1 - r, z1 - r, 0); corner(x0 + r, z1 - r, Math.PI / 2); corner(x0 + r, z0 + r, Math.PI);
  return pts;
}

export function placeProps(kit: StageKit, props: readonly StageProp[]) {
  for (const p of props) if (p.piece !== 'column' && p.piece !== 'stump' && p.piece !== 'block' && p.piece !== 'none')
    kit.place(p.piece, { x: p.x, z: p.z, y: p.y, rot: p.rot, scale: p.scale, sy: p.sy, tilt: p.tilt, roll: p.roll, tint: p.tint });
}

export function stoneShapes(props: readonly StageProp[], material: THREE.Material, tile = 3) {
  const parts: THREE.BufferGeometry[] = [];
  for (const p of props) {
    if (p.piece !== 'column' && p.piece !== 'stump' && p.piece !== 'block') continue;
    let g: THREE.BufferGeometry;
    if (p.piece === 'stump') {
      const height = p.length ?? 2.5, radius = p.radius ?? .8;
      g = new THREE.CylinderGeometry(radius, radius * 1.06, height, 14, 3, false);
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > height / 2 - 1e-3) {
        const a = Math.atan2(pos.getZ(i), pos.getX(i));
        pos.setY(i, height / 2 - .45 * (.5 + .5 * Math.sin(a * 2 + p.x)) - .15 * Math.abs(Math.sin(a * 5)));
      }
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * radius / tile, (pos.getY(i) + height / 2) / tile);
      g.computeVertexNormals();
      g.rotateY(p.rot ?? 0).translate(p.x, height / 2 - .05, p.z);
    } else if (p.piece === 'column') {
      const length = p.length ?? 6, radius = p.radius ?? .8;
      g = new THREE.CylinderGeometry(radius, radius * 1.04, length, 14, 4, false);
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), a = Math.atan2(pos.getZ(i), pos.getX(i));
        if (Math.abs(Math.abs(y) - length / 2) < 1e-3) pos.setY(i, y - Math.sign(y) * (.25 + .35 * Math.abs(Math.sin(a * 3 + p.x))));
      }
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * radius / tile, (pos.getY(i) + length / 2) / tile);
      g.computeVertexNormals();
      g.rotateZ(Math.PI / 2).rotateY((p.rot ?? 0) + Math.PI / 2).translate(p.x, radius * .92, p.z);
    } else {
      const [w, h, d] = p.size ?? [2, 2, 2];
      g = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
      const pos = g.getAttribute('position') as THREE.BufferAttribute, uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > h / 2 - 1e-3 && Math.abs(pos.getX(i)) > w / 2 - 1e-3 && Math.abs(pos.getZ(i)) > d / 2 - 1e-3) pos.setY(i, h / 2 - .25);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / tile, uv.getY(i) * h / tile);
      g.computeVertexNormals();
      g.rotateY(p.rot ?? 0).translate(p.x, h / 2 - .1, p.z);
    }
    parts.push(g.index ? g.toNonIndexed() : g);
  }
  if (!parts.length) return undefined;
  const merged = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  const mesh = new THREE.Mesh(merged!, material);
  mesh.castShadow = mesh.receiveShadow = true; mesh.name = 'stone shapes';
  return mesh;
}

export function street(kit: StageKit, pieces: readonly KitPiece[], from: [number, number], to: [number, number], facing: number, rng: () => number,
  o: { gap?: [number, number]; alley?: number; scale?: [number, number]; sink?: number; tints?: readonly number[]; skip?: (x: number, z: number) => boolean } = {}) {
  const dx = to[0] - from[0], dz = to[1] - from[1], length = Math.hypot(dx, dz);
  const tx = dx / length, tz = dz / length;
  const fx = Math.sin(facing), fz = Math.cos(facing);
  let s = 0, count = 0;
  while (s < length) {
    const piece = pieces[Math.floor(rng() * pieces.length)];
    const size = kit.size(piece);
    const scale = (o.scale?.[0] ?? 1) + rng() * ((o.scale?.[1] ?? 1) - (o.scale?.[0] ?? 1));
    const width = size.x * scale, depth = size.z * scale;
    if (s + width > length + 1) break;
    const along = s + width / 2;
    const x = from[0] + tx * along - fx * depth / 2, z = from[1] + tz * along - fz * depth / 2;
    if (!o.skip?.(x, z)) kit.place(piece, { x, z, y: -(o.sink ?? 0), rot: facing, scale, tint: o.tints ? o.tints[Math.floor(rng() * o.tints.length)] : undefined });
    count++;
    s += width + (o.gap?.[0] ?? .3) + rng() * ((o.gap?.[1] ?? 1.2) - (o.gap?.[0] ?? .3));
    if (o.alley && count % o.alley === 0) s += 4 + rng() * 3;
  }
}

export function mergeByMaterial(root: THREE.Object3D, meshes: THREE.Mesh[], name: string) {
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  for (const m of meshes) { const list = groups.get(m.material as THREE.Material) ?? []; list.push(m); groups.set(m.material as THREE.Material, list); }
  for (const [material, list] of groups) {
    if (list.length < 2) { root.add(list[0]); continue; }
    const parts = list.map(m => { m.updateMatrix(); const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; });
    const merged = mergeGeometries(parts);
    parts.forEach(g => g.dispose()); list.forEach(m => m.geometry.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `${name}:${material.name}`; mesh.receiveShadow = true; mesh.castShadow = list.some(m => m.castShadow);
    root.add(mesh);
  }
}

export class ModelProbe {
  private readonly raycaster = new THREE.Raycaster();
  private readonly meshes: THREE.Mesh[] = [];
  constructor(model: THREE.Object3D, keep: (mesh: THREE.Mesh) => boolean = () => true) {
    model.updateMatrixWorld(true);
    model.traverse(o => { if (o instanceof THREE.Mesh && o.visible && keep(o)) this.meshes.push(o); });
  }
  hit(origin: THREE.Vector3, direction: THREE.Vector3, far = 500) {
    this.raycaster.set(origin, direction.normalize()); this.raycaster.far = far;
    return this.raycaster.intersectObjects(this.meshes, false)[0];
  }
  top(x: number, z: number, from = 120) {
    return this.hit(new THREE.Vector3(x, from, z), new THREE.Vector3(0, -1, 0))?.point.y;
  }
}

export function leafGreen(material: THREE.MeshStandardMaterial, [dark, light]: [number, number]) {
  const a = new THREE.Color(dark), b = new THREE.Color(light);
  addShaderPatch(material, `br-leaf-${dark.toString(16)}-${light.toString(16)}`, shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float leafValue = dot( diffuseColor.rgb, vec3( .2126, .7152, .0722 ) );
      diffuseColor.rgb = mix( vec3( ${a.r.toFixed(3)}, ${a.g.toFixed(3)}, ${a.b.toFixed(3)} ), vec3( ${b.r.toFixed(3)}, ${b.g.toFixed(3)}, ${b.b.toFixed(3)} ), smoothstep( .04, .6, leafValue ) );`);
  });
}

export interface CutPart { geometry: THREE.BufferGeometry; material: THREE.Material }
export function cutPiece(model: THREE.Object3D, materials: RegExp, box: THREE.Box3, pivot: THREE.Vector3): CutPart[] {
  model.updateMatrixWorld(true);
  const parts: CutPart[] = [];
  model.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const material = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!materials.test(material.name)) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const pos = g.getAttribute('position') as THREE.BufferAttribute, normal = g.getAttribute('normal') as THREE.BufferAttribute | undefined, uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const p: number[] = [], n: number[] = [], t: number[] = [];
    const c = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      c.set((pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3);
      if (!box.containsPoint(c)) continue;
      for (let k = i; k < i + 3; k++) {
        p.push(pos.getX(k) - pivot.x, pos.getY(k) - pivot.y, pos.getZ(k) - pivot.z);
        if (normal) n.push(normal.getX(k), normal.getY(k), normal.getZ(k));
        if (uv) t.push(uv.getX(k), uv.getY(k));
      }
    }
    g.dispose();
    if (!p.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    if (n.length) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); else geometry.computeVertexNormals();
    if (t.length) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(t, 2));
    parts.push({ geometry, material });
  });
  return parts;
}

export function instanceParts(root: THREE.Object3D, parts: CutPart[], at: { x: number; y?: number; z: number; rot?: number; scale?: number }[], name: string, shadow = false) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), v = new THREE.Vector3();
  for (const part of parts) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, at.length);
    at.forEach((a, i) => mesh.setMatrixAt(i, m.compose(v.set(a.x, a.y ?? 0, a.z), q.setFromAxisAngle(up, a.rot ?? 0), s.setScalar(a.scale ?? 1))));
    mesh.name = `${name}:${part.material.name}`; mesh.receiveShadow = true; mesh.castShadow = shadow;
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
}
