export function packWanted(): string | undefined {
  const built = import.meta.env?.VITE_PACK as string | undefined;
  if (built) return built;
  if (!(import.meta.env?.DEV || import.meta.env?.MODE === 'fighter-lab') || typeof location !== 'object') return undefined;
  return new URLSearchParams(location.search).get('pack') ?? undefined;
}

const wanted = packWanted();
if (wanted) {
  try {
    const [{ PACKS }, { applyPack }] = await Promise.all([import('../../packs'), import('./apply')]);
    const pack = PACKS[wanted];
    if (pack) applyPack(pack);
    else console.warn(`[packs] No pack "${wanted}"; this build knows ${Object.keys(PACKS).join(', ')}.`);
  } catch (error) { console.error('[packs] The pack could not be put on:', error); }
}
