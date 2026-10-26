import { FIGHTERS } from '../config';
import type { FighterId, PlayerState } from '../game/types';
import { moveFor } from '../game/awakening';
import { brushStroke } from './inkSplat';
import './cutIn.css';

export type CutInSide = 'mine' | 'theirs';
export const CUT_IN_SECONDS = .4;
export interface ScreenBox { left: number; top: number; right: number; bottom: number }
type Spot = 'll' | 'lr' | 'ul' | 'ur';
const ORDER: Record<CutInSide, readonly Spot[]> = { mine: ['ll', 'lr', 'ul', 'ur'], theirs: ['lr', 'll', 'ur', 'ul'] };
const EDGE = .032, LIFT = .075, GAP = 10;
const STROKE = brushStroke(11, .62);

export function cutInSide(p: Pick<PlayerState, 'id' | 'fighter' | 'action' | 'alive' | 'awakened' | 'confirmedAt' | 'target'> & { enemy?: unknown }, localId: string): CutInSide | undefined {
  if (p.action !== 'ultimate' || !p.alive || p.enemy) return undefined;
  if (p.id === localId) return 'mine';
  const confirm = !!moveFor(p.fighter, 'ultimate', !!p.awakened).confirm;
  return confirm && p.confirmedAt !== undefined && p.target === localId ? 'theirs' : undefined;
}
export function awakeningCutIn(p: Pick<PlayerState, 'id' | 'action' | 'alive'> & { enemy?: unknown }, localId: string) {
  return p.id === localId && p.action === 'awaken' && p.alive && !p.enemy;
}
export function cutInKey(p: Pick<PlayerState, 'action' | 'actionSeq' | 'actionStarted'>) {
  return p.action === 'awaken' ? `a:${p.actionStarted}` : `u:${p.actionSeq ?? p.actionStarted}`;
}

export function chooseSpot<T extends string>(spots: readonly { spot: T; box: ScreenBox }[], avoid: readonly ScreenBox[]): T {
  let best = spots[0].spot, least = Infinity;
  for (const { spot, box } of spots) {
    let covered = 0;
    for (const a of avoid) {
      const w = Math.min(box.right, a.right + GAP) - Math.max(box.left, a.left - GAP), h = Math.min(box.bottom, a.bottom + GAP) - Math.max(box.top, a.top - GAP);
      if (w > 0 && h > 0) covered += w * h;
    }
    if (covered === 0) return spot;
    if (covered < least) { least = covered; best = spot; }
  }
  return best;
}

export class CutIn {
  readonly element: HTMLElement;
  onShow?: (side: CutInSide) => void;
  spot: Spot | '' = '';
  private timer = 0;
  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'cutin';
    this.element.hidden = true;
    this.element.setAttribute('aria-hidden', 'true');
    parent.append(this.element);
  }
  get open() { return !this.element.hidden; }
  show(fighter: FighterId, move: string, side: CutInSide, avoid: readonly ScreenBox[] = []) {
    clearTimeout(this.timer);
    const def = FIGHTERS[fighter];
    this.element.className = `cutin cutin-${side}`;
    this.element.style.setProperty('--cut-color', def.color);
    this.element.innerHTML = `<div class="cutin-card"><svg class="cutin-stroke" viewBox="0 0 1000 200" preserveAspectRatio="none" focusable="false"><path class="cutin-edge" d="${STROKE}"/><path class="cutin-ink" d="${STROKE}"/></svg><small></small><b></b></div>`;
    const card = this.element.querySelector<HTMLElement>('.cutin-card')!, name = card.querySelector('b')!;
    card.querySelector('small')!.textContent = def.name;
    name.textContent = move;
    this.element.hidden = false;
    const room = card.clientWidth, need = name.scrollWidth;
    if (room > 0 && need > room) name.style.fontSize = `${Math.max(.6, room / need).toFixed(3)}em`;
    this.place(card, side, avoid);
    void this.element.offsetWidth;
    this.element.classList.add('cutin-go');
    this.onShow?.(side);
    this.timer = window.setTimeout(() => this.hide(), CUT_IN_SECONDS * 1000);
  }
  hide() {
    clearTimeout(this.timer);
    this.element.hidden = true; this.element.className = 'cutin'; this.element.innerHTML = '';
  }
  private place(card: HTMLElement, side: CutInSide, avoid: readonly ScreenBox[]) {
    const vw = innerWidth, vh = innerHeight, w = card.offsetWidth, h = card.offsetHeight;
    const edge = vw * EDGE, low = vh * LIFT;
    const hud = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    const plates = hud('.combat-hud .fighter-meter'), cards = hud('.combat-hud .move-bar');
    const under = Math.max(vh * .14, ...plates.map(r => r.bottom)) + 12, above = Math.min(vh - low, ...cards.map(r => r.top)) - 12;
    const at = (left: number, top: number): ScreenBox => ({ left, top, right: left + w, bottom: top + h });
    const boxes: Record<Spot, ScreenBox> = {
      ll: at(edge, vh - low - h), lr: at(vw - edge - w, above - h),
      ul: at(edge, under), ur: at(vw - edge - w, under),
    };
    const panels = hud('#interface .mode-hud > [data-zone]:not([data-zone="8"]) > *');
    this.spot = chooseSpot(ORDER[side].map(spot => ({ spot, box: boxes[spot] })), [...avoid, ...plates, ...cards, ...panels]);
    const box = boxes[this.spot];
    Object.assign(card.style, { left: `${box.left.toFixed(1)}px`, top: `${box.top.toFixed(1)}px`, right: 'auto', bottom: 'auto' });
    card.dataset.spot = this.spot;
  }
}
