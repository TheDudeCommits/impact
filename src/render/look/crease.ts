import * as THREE from 'three';

export interface CreaseOptions {
  seed: number; grow: number;
  full: number;
  shortest: number;
}
export const CREASE: CreaseOptions = { seed: .2, grow: .11, full: .5, shortest: 3 };

function analyse(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const count = position?.count ?? 0;
  if (count < 3) return null;
  const index = geometry.getIndex();
  const corners = index ? index.count : count;
  if (corners < 3) return null;
  const plain = !(position as unknown as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute && !position.normalized && position.itemSize === 3;
  const src = plain ? position.array as ArrayLike<number> : null;
  const X = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    if (src) { X[i * 3] = src[i * 3]; X[i * 3 + 1] = src[i * 3 + 1]; X[i * 3 + 2] = src[i * 3 + 2]; }
    else { X[i * 3] = position.getX(i); X[i * 3 + 1] = position.getY(i); X[i * 3 + 2] = position.getZ(i); }
  }
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = X[i * 3], y = X[i * 3 + 1], z = X[i * 3 + 2];
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }
  const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  if (!(size > 0)) return null;
  const step = size * 2e-5, weld = new Int32Array(count), firsts = new Int32Array(count), Q = new Int32Array(count * 3);
  const cap = 1 << Math.ceil(Math.log2(count * 2 + 2)), table = new Int32Array(cap).fill(-1);
  let n = 0;
  for (let i = 0; i < count; i++) {
    const qx = Math.round((X[i * 3] - minX) / step), qy = Math.round((X[i * 3 + 1] - minY) / step), qz = Math.round((X[i * 3 + 2] - minZ) / step);
    Q[i * 3] = qx; Q[i * 3 + 1] = qy; Q[i * 3 + 2] = qz;
    let h = (Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663) ^ Math.imul(qz, 83492791)) & (cap - 1), id = -1;
    for (;;) {
      const j = table[h];
      if (j < 0) { table[h] = i; id = n; firsts[n++] = i; break; }
      if (Q[j * 3] === qx && Q[j * 3 + 1] === qy && Q[j * 3 + 2] === qz) { id = weld[j]; break; }
      h = (h + 1) & (cap - 1);
    }
    weld[i] = id;
  }
  const P = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) { const i = firsts[v]; P[v * 3] = X[i * 3]; P[v * 3 + 1] = X[i * 3 + 1]; P[v * 3 + 2] = X[i * 3 + 2]; }
  const tris = Math.floor(corners / 3), T = new Int32Array(tris * 3), N = new Float32Array(n * 3);
  const ix = index ? index.array : null;
  let kept = 0;
  for (let t = 0; t < tris; t++) {
    const a = weld[ix ? ix[t * 3] : t * 3], b = weld[ix ? ix[t * 3 + 1] : t * 3 + 1], c = weld[ix ? ix[t * 3 + 2] : t * 3 + 2];
    if (a === b || b === c || a === c) continue;
    T[kept * 3] = a; T[kept * 3 + 1] = b; T[kept * 3 + 2] = c; kept++;
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    N[a * 3] += nx; N[a * 3 + 1] += ny; N[a * 3 + 2] += nz;
    N[b * 3] += nx; N[b * 3 + 1] += ny; N[b * 3 + 2] += nz;
    N[c * 3] += nx; N[c * 3 + 1] += ny; N[c * 3 + 2] += nz;
  }
  for (let v = 0; v < n; v++) { const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1; N[v * 3] /= l; N[v * 3 + 1] /= l; N[v * 3 + 2] /= l; }
  const tdeg = new Int32Array(n + 1);
  for (let k = 0; k < kept * 3; k++) tdeg[T[k] + 1]++;
  for (let v = 0; v < n; v++) tdeg[v + 1] += tdeg[v];
  const tadj = new Int32Array(kept * 3), tfill = tdeg.slice(0, n);
  for (let t = 0; t < kept; t++) for (let e = 0; e < 3; e++) { const v = T[t * 3 + e]; tadj[tfill[v]++] = t; }
  const degree = new Int32Array(n + 1), list = new Int32Array(kept * 6), stamp = new Int32Array(n).fill(-1), uses = new Int32Array(n), boundary = new Uint8Array(n);
  let filled = 0;
  for (let v = 0; v < n; v++) {
    degree[v] = filled;
    for (let k = tdeg[v]; k < tdeg[v + 1]; k++) {
      const t = tadj[k];
      for (let e = 0; e < 3; e++) {
        const u = T[t * 3 + e]; if (u === v) continue;
        if (stamp[u] !== v) { stamp[u] = v; uses[u] = 0; list[filled++] = u; }
        uses[u]++;
      }
    }
    for (let k = degree[v]; k < filled; k++) if (uses[list[k]] === 1) boundary[v] = 1;
  }
  degree[n] = filled;
  const adj = list.subarray(0, filled);
  const K = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const from = degree[v], to = degree[v + 1];
    if (to - from < 3) continue;
    let cx = 0, cy = 0, cz = 0, d2 = 0;
    for (let k = from; k < to; k++) {
      const u = adj[k], dx = P[u * 3] - P[v * 3], dy = P[u * 3 + 1] - P[v * 3 + 1], dz = P[u * 3 + 2] - P[v * 3 + 2];
      cx += dx; cy += dy; cz += dz; d2 += dx * dx + dy * dy + dz * dz;
    }
    const m = to - from;
    K[v] = 2 * (cx * N[v * 3] + cy * N[v * 3 + 1] + cz * N[v * 3 + 2]) / m / Math.sqrt(Math.max(d2 / m, 1e-24));
  }
  const S = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    if (boundary[v]) continue;
    const from = degree[v], to = degree[v + 1];
    let sum = K[v] * 2, w = 2;
    for (let k = from; k < to; k++) { sum += K[adj[k]]; w++; }
    S[v] = sum / w;
  }
  return { count, weld, n, T, degree, adj, tdeg, tadj, S };
}

export function creaseConcavity(geometry: THREE.BufferGeometry): Float32Array {
  const a = analyse(geometry), out = new Float32Array(geometry.getAttribute('position')?.count ?? 0);
  if (a) for (let i = 0; i < a.count; i++) out[i] = a.S[a.weld[i]];
  return out;
}

export function creaseDepths(geometry: THREE.BufferGeometry, options: CreaseOptions = CREASE): Float32Array {
  const out = new Float32Array(geometry.getAttribute('position')?.count ?? 0);
  const a = analyse(geometry);
  if (!a) return out;
  const { count, weld, n, T, degree, adj, tdeg, tadj, S } = a;
  const mark = new Uint8Array(n), queue: number[] = [];
  for (let v = 0; v < n; v++) if (S[v] >= options.seed) { mark[v] = 1; queue.push(v); }
  while (queue.length) {
    const v = queue.pop()!;
    for (let k = degree[v]; k < degree[v + 1]; k++) { const u = adj[k]; if (!mark[u] && S[u] >= options.grow) { mark[u] = 1; queue.push(u); } }
  }
  const order: number[] = [];
  for (let v = 0; v < n; v++) if (mark[v]) order.push(v);
  order.sort((a, b) => S[b] - S[a]);
  const kept2 = new Uint8Array(n);
  for (const v of order) {
    let closes = false;
    for (let k = tdeg[v]; k < tdeg[v + 1] && !closes; k++) {
      const t = tadj[k]; let others = 0;
      for (let e = 0; e < 3; e++) { const u = T[t * 3 + e]; if (u !== v && kept2[u]) others++; }
      if (others === 2) closes = true;
    }
    if (!closes) kept2[v] = 1;
  }
  const run = new Int32Array(n).fill(-1), sizes: number[] = [];
  for (let v = 0; v < n; v++) {
    if (!kept2[v] || run[v] >= 0) continue;
    const id = sizes.length, stack = [v]; run[v] = id; let size2 = 0;
    while (stack.length) { const a = stack.pop()!; size2++; for (let k = degree[a]; k < degree[a + 1]; k++) { const b = adj[k]; if (kept2[b] && run[b] < 0) { run[b] = id; stack.push(b); } } }
    sizes.push(size2);
  }
  const depth = new Float32Array(n);
  for (let v = 0; v < n; v++) if (kept2[v] && sizes[run[v]] >= options.shortest) depth[v] = Math.min(1, Math.max(.05, (S[v] - options.grow) / (options.full - options.grow)));
  for (let i = 0; i < count; i++) out[i] = depth[weld[i]];
  return out;
}
