import { VfxKit } from '../vfx/VfxKit';

export function subscribeSplashes(listener: (x: number, z: number, size: number, dx: number, dz: number) => void) {
  const heard: Parameters<typeof VfxKit.splashed.add>[0] = (_scene, x, z, size, dx, dz) => listener(x, z, size, dx, dz);
  VfxKit.splashed.add(heard);
  return () => { VfxKit.splashed.delete(heard); };
}

export function splashImpulse(x: number, z: number, size: number, dx = 0, dz = 0) {
  const lean = Math.hypot(dx, dz) > .1 ? .35 * size / Math.hypot(dx, dz) : 0;
  return { x: x + dx * lean, z: z + dz * lean, radius: .3 + size * .55, depth: Math.min(.09, .006 + size * size * .035) };
}
