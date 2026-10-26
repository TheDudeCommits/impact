import refreshedArt from './moveArtVersions.json';
import type { FighterId } from '../game/types';
import { packArt } from '../engine/packs/active';


const FORM_SHEETS: Partial<Record<FighterId, string>> = { naruto: 'naruto-kurama', eren: 'eren-titan' };
export function moveSheetOf(fighter: FighterId, awakened: boolean) {
  return awakened ? FORM_SHEETS[fighter] ?? fighter : fighter;
}
export function moveSheetsFor(fighter: FighterId) {
  const base = moveSheetOf(fighter, false), awake = moveSheetOf(fighter, true);
  return awake === base ? [base] : [base, awake];
}
export const moveSheetUrl = (sheet: string) => packArt(sheet, 'moves') ?? `/assets/ui/moves/${sheet}.webp${sheet in refreshedArt?'?v='+refreshedArt[sheet as keyof typeof refreshedArt]:''}`;

export function areaArtUrl(fighter: string): string | undefined {
  const key = `area/${fighter}`;
  const version = (refreshedArt as Record<string, string>)[key];
  return version ? `/assets/ui/moves/${key}.webp?v=${version}` : undefined;
}

export function warmAreaArt(fighter: string) {
  const url = areaArtUrl(fighter);
  if (url) void decodeMoveArt(url).catch(() => undefined);
}

const held = new Map<string, HTMLImageElement>();
export function decodeMoveArt(url: string): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  let image = held.get(url);
  if (!image) { image = new Image(); image.decoding = 'async'; image.src = url; held.set(url, image); }
  return image.decode();
}

export class MoveSheet {
  shown = '';
  private wanted = '';
  private ready = new Set<string>();
  private loading = new Map<string, Promise<void>>();
  constructor(private readonly apply: (sheet: string) => void, private readonly load: (sheet: string) => Promise<void> = sheet => decodeMoveArt(moveSheetUrl(sheet)).catch(() => undefined)) {}
  warm(sheet: string) { void this.fetch(sheet); warmAreaArt(sheet); }
  now(sheet: string) { this.wanted = sheet; this.put(sheet); void this.fetch(sheet); }
  want(sheet: string) {
    this.wanted = sheet;
    if (sheet === this.shown) return;
    if (this.ready.has(sheet) || !this.shown) { this.now(sheet); return; }
    void this.fetch(sheet).then(() => { if (this.wanted === sheet && this.shown !== sheet) this.put(sheet); });
  }
  private put(sheet: string) { this.shown = sheet; this.apply(sheet); }
  private fetch(sheet: string) {
    let pending = this.loading.get(sheet);
    if (!pending) { pending = this.load(sheet).then(() => { this.ready.add(sheet); }); this.loading.set(sheet, pending); }
    return pending;
  }
}
