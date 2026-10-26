import * as THREE from 'three';
import { addShaderPatch } from '../look/shaderPatch';
import type { DressContext } from './dressing';

export interface CrowdSpot {
  x: number; y: number; z: number;
  cell: number;
  height: number;
  flip?: boolean;
}

export function crowdCards(c: DressContext, atlas: THREE.Texture, cols: number, rows: number, spots: readonly CrowdSpot[], o: { name?: string; aspect?: number; shade?: number; sway?: number } = {}) {
  if (!spots.length) return undefined;
  const aspect = o.aspect ?? .5;
  const quad = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0);
  const material = new THREE.MeshBasicMaterial({ map: atlas, color: new THREE.Color(o.shade ?? 1, o.shade ?? 1, o.shade ?? 1), alphaTest: .5, side: THREE.DoubleSide, fog: true });
  material.name = o.name ?? 'Crowd cards';
  const time = c.ambient.time;
  addShaderPatch(material, `crowd-cards-${cols}x${rows}-${o.sway ?? 0}`, shader => {
    shader.uniforms.uCrowdTime = time;
    shader.vertexShader = `attribute vec4 aCrowd;\nuniform float uCrowdTime;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
        vec2 crowdUv = vec2( aCrowd.z > .5 ? 1. - uv.x : uv.x, uv.y );
        vMapUv = ( crowdUv + vec2( mod( aCrowd.x, ${cols.toFixed(1)} ), ${(rows - 1).toFixed(1)} - floor( aCrowd.x / ${cols.toFixed(1)} ) ) ) / vec2( ${cols.toFixed(1)}, ${rows.toFixed(1)} );
      #endif`);
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vec4 crowdBase = modelMatrix * vec4( instanceMatrix[3].xyz, 1. );
      vec3 crowdTo = cameraPosition - crowdBase.xyz; crowdTo.y = 0.;
      crowdTo = length( crowdTo ) > 1e-4 ? normalize( crowdTo ) : vec3( 0., 0., 1. );
      vec3 crowdRight = vec3( crowdTo.z, 0., -crowdTo.x );
      float crowdH = aCrowd.y;
      float crowdBob = ${(o.sway ?? 0).toFixed(3)} * crowdH * max( 0., sin( uCrowdTime * ( 5. + aCrowd.w * 3. ) + aCrowd.w * 40. ) );
      vec4 crowdWorld = vec4( crowdBase.xyz + crowdRight * transformed.x * crowdH * ${aspect.toFixed(3)} + vec3( 0., transformed.y * crowdH + crowdBob, 0. ), 1. );
      vec4 mvPosition = viewMatrix * crowdWorld;
      gl_Position = projectionMatrix * mvPosition;`);
  });
  const mesh = new THREE.InstancedMesh(quad, material, spots.length);
  const data = new Float32Array(spots.length * 4);
  const m = new THREE.Matrix4();
  spots.forEach((s, i) => {
    mesh.setMatrixAt(i, m.makeTranslation(s.x, s.y, s.z));
    data.set([s.cell, s.height, s.flip ? 1 : 0, (i * 0.6180339) % 1], i * 4);
  });
  quad.setAttribute('aCrowd', new THREE.InstancedBufferAttribute(data, 4));
  mesh.frustumCulled = false;
  mesh.name = o.name ?? 'crowd';
  c.root.add(mesh);
  return mesh;
}

export function figureAtlas(cols: number, rows: number, w: number, h: number, draw: (g: CanvasRenderingContext2D, index: number, w: number, h: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = cols * w; canvas.height = rows * h;
  const g = canvas.getContext('2d')!;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    g.save(); g.translate(k * w, r * h);
    g.beginPath(); g.rect(0, 0, w, h); g.clip();
    draw(g, r * cols + k, w, h);
    g.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

export function stripSpots(model: THREE.Object3D, pattern: RegExp, o: { spacing: number; height: number; cells: number; rows?: number; tall?: number; rise?: number; back?: number; skip?: number; seed: () => number }) {
  const rng = o.seed, spots: CrowdSpot[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3();
  model.updateMatrixWorld(true);
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !pattern.test((mesh.material as THREE.Material).name ?? '')) return;
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute, index = mesh.geometry.index;
    const corner = (k: number) => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(k) : k).applyMatrix4(mesh.matrixWorld);
    const count = index ? index.count : pos.count;
    for (let t = 0; t + 5 < count; t += 6) {
      const unique: THREE.Vector3[] = [];
      for (let k = 0; k < 6; k++) { const q = corner(t + k); if (!unique.some(u => u.distanceToSquared(q) < 1e-4)) unique.push(q); }
      if (unique.length < 4) continue;
      unique.sort((m, n) => m.y - n.y);
      a.copy(unique[0]); b.copy(unique[1]);
      const tallness = unique[3].y - a.y, width = a.distanceTo(b);
      if (width < 1) continue;
      const out = new THREE.Vector3((a.x + b.x) / 2, 0, (a.z + b.z) / 2).normalize();
      const rows = tallness > (o.tall ?? Infinity) ? (o.rows ?? 1) : 1;
      for (let row = 0; row < rows; row++) {
        for (let d = o.spacing * (.5 + row * .5); d < width - o.spacing * .3; d += o.spacing * (.9 + rng() * .2)) {
          if (rng() < (o.skip ?? .08)) continue;
          p.lerpVectors(a, b, d / width).addScaledVector(out, row * (o.back ?? .9) + (rng() - .5) * .12);
          spots.push({ x: p.x, y: p.y + row * (o.rise ?? 1.5) + .02, z: p.z, cell: Math.floor(rng() * o.cells), height: o.height * (.88 + rng() * .24), flip: rng() < .5 });
        }
      }
    }
  });
  return spots;
}
