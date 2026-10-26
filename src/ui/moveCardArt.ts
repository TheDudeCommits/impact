import { areaArtUrl, decodeMoveArt, moveSheetUrl } from './moveSheet';
import { ART_X } from './hud/inked';

export class MoveCardArt {
  private wanted = '';
  constructor(private readonly card: HTMLElement, private readonly load = decodeMoveArt) {}
  show(fighter: string, panel: number, ownSheet = false) {
    const area = panel === 4;
    const url = area ? areaArtUrl(fighter) : ownSheet ? undefined : moveSheetUrl(fighter);
    const key = `${fighter}:${panel}:${ownSheet}:${url ?? ''}`;
    if (this.wanted === key) return;
    this.wanted = key;
    const put = (ready: boolean) => {
      if (this.wanted !== key) return;
      const glyph = area && (!url || !ready);
      this.card.querySelectorAll<HTMLElement>('.ik-art').forEach(art => {
        art.classList.toggle('ik-glyph', glyph);
        art.classList.toggle('ik-area-art', area && !glyph);
        art.style.setProperty('--art-x', area ? '50%' : ART_X[panel]);
        if (url && ready) art.style.setProperty('--move-sheet', `url('${url}')`);
        else art.style.removeProperty('--move-sheet');
      });
    };
    if (area || !url) put(false);
    if (url) void this.load(url).then(() => put(true), () => put(false));
  }
}
