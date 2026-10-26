export const FX_LOOKS = ['ice-a', 'ice-b', 'ice-c'] as const;
export type FxLook = typeof FX_LOOKS[number];

const asLook = (value: unknown): FxLook | undefined => (FX_LOOKS as readonly unknown[]).includes(value) ? value as FxLook : undefined;

let built: unknown, devServer = false;
try { built = import.meta.env.VITE_ICE_LOOK; devServer = import.meta.env.DEV === true; } catch { built = undefined; devServer = false; }

export const CHOSEN_LOOK: FxLook = 'ice-a';
export const BUILD_LOOK: FxLook = asLook(built) ?? CHOSEN_LOOK;

export function fxLook(search: string = typeof location === 'object' && location ? location.search : '', dev: boolean = devServer): FxLook | undefined {
  if (dev) {
    let asked: string | null = null;
    try { asked = new URLSearchParams(search).get('fx'); } catch { asked = null; }
    if (asked === 'today') return undefined;
    const look = asLook(asked);
    if (look) return look;
  }
  return BUILD_LOOK;
}
