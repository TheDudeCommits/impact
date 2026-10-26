export const LENS = { x: 0, z: 0, fx: 0, fz: 1, at: -1e9 };

export function seeLens(x: number, z: number, towardX: number, towardZ: number) {
  const dx = towardX - x, dz = towardZ - z, d = Math.hypot(dx, dz);
  if (d < .5) return;
  LENS.x = x; LENS.z = z; LENS.fx = dx / d; LENS.fz = dz / d; LENS.at = Date.now();
}

export function lens() { return Date.now() - LENS.at < 1500 ? LENS : undefined; }
