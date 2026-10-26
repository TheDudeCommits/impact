import * as THREE from 'three';

type Kind = 'stone' | 'wood' | 'thatch' | 'plaster' | 'metal';
const made = new Map<Kind, THREE.DataTexture>();

function hash(x: number, y: number, seed: number) {
  const h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function noise(u: number, v: number, cells: number, seed: number) {
  const x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  const w = (a: number) => ((a % cells) + cells) % cells;
  const a = hash(w(xi), w(yi), seed), b = hash(w(xi + 1), w(yi), seed), c = hash(w(xi), w(yi + 1), seed), d = hash(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(u: number, v: number, base: number, seed: number, octaves = 4) {
  let sum = 0, amp = .5, cells = base, norm = 0;
  for (let o = 0; o < octaves; o++) { sum += noise(u, v, cells, seed + o * 17) * amp; norm += amp; amp *= .5; cells *= 2; }
  return sum / norm;
}

export function detailTexture(kind: Kind): THREE.DataTexture {
  const existing = made.get(kind);
  if (existing) return existing;
  const size = 256, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    let value: number;
    if (kind === 'wood') {
      const grain = fbm(u * .25, v * 4, 8, 3, 3);
      value = .72 + .28 * Math.sin((u * 18 + grain * 6) * Math.PI) * .5 + fbm(u, v, 16, 9, 2) * .15;
    } else if (kind === 'thatch') {
      const straw = fbm(u * 6, v * .5, 16, 5, 3);
      value = .6 + .4 * Math.abs(Math.sin((u * 40 + straw * 5) * Math.PI));
    } else if (kind === 'plaster') {
      value = .82 + .18 * fbm(u, v, 8, 11, 4) - (fbm(u, v, 32, 13, 2) > .72 ? .2 : 0);
    } else if (kind === 'metal') {
      value = .7 + .3 * fbm(u, v, 12, 21, 3);
    } else {
      const bx = u * 4 + (Math.floor(v * 6) % 2) * .5, by = v * 6;
      const mortar = Math.min(bx % 1, 1 - (bx % 1), (by % 1), 1 - (by % 1));
      value = (.62 + .38 * fbm(u, v, 8, 7, 4)) * (mortar < .045 ? .45 : 1);
    }
    const c = Math.round(Math.max(0, Math.min(1, value)) * 255), i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = c; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  made.set(kind, texture);
  return texture;
}
export function disposeDetailTextures() { for (const t of made.values()) t.dispose(); made.clear(); }
