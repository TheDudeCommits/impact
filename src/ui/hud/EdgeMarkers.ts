import * as THREE from 'three';
import type { FighterId } from '../../game/types';
import { THREAT_HEX } from '../../render/ThreatOutline';
import { mangaPortrait } from '../MangaHome';
import { EDGE_PHONE, faceSticker, hull, inkedFit } from './inked';
import { el, setText, show } from './mainHudKit';
import './edgeMarkers.css';

export interface EdgeSubject { id: string; x: number; y: number; z: number; fighter: FighterId; name: string; colour: string }
export interface EdgeRead { onScreen: boolean; side: -1 | 1; height: number; behind: boolean }
export const BEHIND = 1.92;
const point = new THREE.Vector3();
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function readEdge(camera: THREE.Camera, x: number, y: number, z: number, out: EdgeRead, margin = .08): EdgeRead {
  point.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
  const ahead = -point.z, across = point.x;
  out.side = across >= 0 ? 1 : -1;
  out.behind = Math.abs(Math.atan2(across, ahead)) > BEHIND;
  if (ahead > .05) {
    point.applyMatrix4(camera.projectionMatrix);
    out.onScreen = Math.abs(point.x) <= 1 - margin && Math.abs(point.y) <= 1 - margin;
    out.height = clamp((1 - point.y) / 2, 0, 1);
  } else {
    out.onScreen = false;
    out.height = clamp(.5 - Math.atan2(point.y, Math.hypot(across, ahead)) / 1.6, 0, 1);
  }
  return out;
}

export function stack(tops: number[], order: number[], n: number, gap: number, lo: number, hi: number) {
  for (let i = 0; i < n; i++) order[i] = i;
  for (let i = 1; i < n; i++) { const k = order[i]; let j = i - 1; while (j >= 0 && tops[order[j]] > tops[k]) { order[j + 1] = order[j]; j--; } order[j + 1] = k; }
  let floor = lo;
  for (let i = 0; i < n; i++) { const k = order[i]; tops[k] = Math.max(floor, Math.min(tops[k], hi)); floor = tops[k] + gap; }
  let ceiling = hi;
  for (let i = n - 1; i >= 0; i--) { const k = order[i]; if (tops[k] > ceiling) tops[k] = ceiling; ceiling = tops[k] - gap; }
}

interface Mark { node: HTMLElement; face: HTMLElement; name: HTMLElement; metresText: HTMLElement; way: HTMLElement; fighter: string; colour: string; side: number; top: number; metres: number; behind: boolean; shown: boolean }
const THREAT_CLASS: Record<string, string> = { [THREAT_HEX[1]]: 'threat-block', [THREAT_HEX[2]]: 'threat-unblock' };
const MARK_H = 58, MARK_GAP = 8;

export class EdgeMarkers {
  private readonly marks: Mark[] = [];
  private readonly reads: EdgeRead[] = [];
  private readonly picked: number[] = [];
  private readonly tops: number[] = [];
  private readonly order: number[] = [];
  private readonly sideList: number[] = [];
  private readonly px: number[] = [];
  constructor(zone: HTMLElement, readonly count = 3, readonly range = 30) {
    for (let i = 0; i < count; i++) {
      const rim = 'M6 3 L196 0 L190 54 L0 58 Z';
      const node = el('div', 'edge-mark', hull(196, 58, rim, 'edge-hull').replace('<path ', `<path class="rim" d="${rim}" filter="url(#ik-ink-s)"/><path `));
      const face = el('span', 'edge-face'), text = el('span', 'edge-text'), name = el('b'), detail = el('small'), metresText = el('em'), way = el('span');
      node.setAttribute('aria-hidden', 'true'); node.hidden = true;
      detail.append(metresText, way); text.append(name, detail); node.append(el('i', 'edge-chevron'), face, text); zone.append(node);
      this.marks.push({ node, face, name, metresText, way, fighter: '', colour: '', side: 9, top: -1, metres: -1, behind: false, shown: false });
      this.picked.push(-1); this.tops.push(0); this.order.push(0); this.sideList.push(0); this.px.push(0);
    }
  }
  update(camera: THREE.Camera | undefined, from: { x: number; z: number }, subjects: readonly EdgeSubject[], count: number, width: number, height: number) {
    let n = 0;
    if (camera) for (let i = 0; i < count && n < this.count; i++) {
      const s = subjects[i], distance = Math.hypot(s.x - from.x, s.z - from.z);
      if (distance > this.range) break;
      const read = this.reads[n] ??= { onScreen: true, side: 1, height: .5, behind: false };
      if (readEdge(camera, s.x, s.y, s.z, read).onScreen) continue;
      this.picked[n++] = i;
    }
    const markHeight = MARK_H * inkedFit.k * (inkedFit.phone ? EDGE_PHONE : 1), gap = markHeight + MARK_GAP;
    for (let side = -1; side <= 1; side += 2) {
      const from = inkedFit.phone ? .36 : side < 0 ? .58 : .3, to = inkedFit.phone ? .6 : side < 0 ? .86 : .66;
      const lo = height * from - markHeight / 2, hi = Math.max(lo, height * to - markHeight / 2);
      let m = 0;
      for (let k = 0; k < n; k++) if (this.reads[k].side === side) { this.sideList[m] = k; this.tops[m] = lo + (hi - lo) * this.reads[k].height; m++; }
      stack(this.tops, this.order, m, gap, lo, hi);
      for (let j = 0; j < m; j++) this.px[this.sideList[j]] = this.tops[j];
    }
    for (let k = 0; k < this.count; k++) {
      const mark = this.marks[k];
      if (k >= n) { if (mark.shown) { mark.shown = false; show(mark.node, false); } continue; }
      const s = subjects[this.picked[k]], read = this.reads[k];
      if (mark.fighter !== s.fighter) this.face(mark, s.fighter);
      if (mark.colour !== s.colour) {
        const was = THREAT_CLASS[mark.colour], now = THREAT_CLASS[s.colour];
        mark.colour = s.colour; mark.node.style.setProperty('--edge', s.colour);
        if (was !== now) { if (was) mark.node.classList.remove(was); if (now) mark.node.classList.add(now); }
      }
      if (mark.side !== read.side) { mark.side = read.side; mark.node.dataset.side = read.side < 0 ? 'left' : 'right'; }
      const top = Math.round(this.px[k]);
      if (top !== mark.top) { mark.top = top; mark.node.style.translate = `0 ${top}px`; }
      if (mark.name.textContent !== s.name) { mark.name.textContent = s.name; mark.node.classList.toggle('long', s.name.length > 11); }
      const metres = Math.round(Math.hypot(s.x - from.x, s.z - from.z));
      if (metres !== mark.metres || read.behind !== mark.behind) {
        mark.metres = metres; mark.behind = read.behind;
        setText(mark.metresText, String(metres)); setText(mark.way, read.behind ? ' m · BEHIND YOU' : ' m');
      }
      if (!mark.shown) { mark.shown = true; show(mark.node, true); }
    }
  }
  hide() { for (const mark of this.marks) if (mark.shown) { mark.shown = false; show(mark.node, false); } }
  private face(mark: Mark, fighter: FighterId) {
    mark.fighter = fighter;
    mark.face.dataset.kind = 'head'; mark.face.style.backgroundImage = ''; mark.face.innerHTML = mangaPortrait(fighter);
    void faceSticker(fighter).then(sticker => {
      if (!sticker || mark.fighter !== fighter) return;
      mark.face.innerHTML = ''; mark.face.dataset.kind = 'sticker';
      mark.face.style.setProperty('--aspect', sticker.aspect.toFixed(3)); mark.face.style.backgroundImage = `url('${sticker.url}')`;
    });
  }
  destroy() { for (const mark of this.marks) mark.node.remove(); this.marks.length = 0; }
}
