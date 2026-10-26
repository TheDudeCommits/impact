import { mediaArt } from '../mediaArt';
import * as THREE from 'three';
import { FIGHTERS } from '../../config';
import type { FighterId } from '../../game/types';
import { css, DOWN_COLOUR } from './seats';
import {ObservedSize} from '../ObservedSize';


export interface MarkSubject {
  id: string; name: string; fighter: FighterId; colour: number;
  hp: number; maxHp: number; down: boolean; rescue: number;
  at: THREE.Vector3;
}

const _p = new THREE.Vector3(), _v = new THREE.Vector3();
const EDGE = 54;

export class AllyMarks {
  readonly element: HTMLElement;
  private readonly marks = new Map<string, HTMLElement>();
  private readonly measured:ObservedSize;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'sv-marks';
    this.element.setAttribute('aria-hidden', 'true');
    parent.append(this.element);
    this.measured=new ObservedSize(this.element);
  }

  place(subjects: readonly MarkSubject[], camera: THREE.Camera, self: THREE.Vector3 | undefined) {
    const w = this.measured.width || window.innerWidth, h = this.measured.height || window.innerHeight;
    const seen = new Set<string>();
    for (const subject of subjects) {
      seen.add(subject.id);
      const el = this.mark(subject);
      el.classList.toggle('down', subject.down);
      el.style.setProperty('--c', css(subject.down ? DOWN_COLOUR : subject.colour));
      el.style.setProperty('--hp', String(Math.max(0, Math.min(1, subject.hp / Math.max(1, subject.maxHp)))));
      el.style.setProperty('--p', String(Math.max(0, Math.min(1, subject.rescue))));
      _p.copy(subject.at); _p.y += subject.down ? 1.3 : 2.25;
      _v.copy(_p).applyMatrix4(camera.matrixWorldInverse);
      const behind = _v.z > -.1;
      _p.project(camera);
      let x = (_p.x * .5 + .5) * w, y = (1 - (_p.y * .5 + .5)) * h;
      const inside = !behind && x > EDGE && x < w - EDGE && y > EDGE && y < h - EDGE;
      el.classList.toggle('off', !inside);
      let angle = 0;
      if (!inside) {
        const dx = behind ? _v.x : x - w / 2, dy = behind ? Math.max(Math.abs(_v.x) * .6, 1) : y - h / 2;
        const scale = Math.min((w / 2 - EDGE) / Math.max(1e-3, Math.abs(dx)), (h / 2 - EDGE) / Math.max(1e-3, Math.abs(dy)));
        x = w / 2 + dx * scale; y = h / 2 + dy * scale;
        angle = Math.atan2(dy, dx);
      }
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.setProperty('--a', `${angle.toFixed(3)}rad`);
      const far = self ? Math.hypot(subject.at.x - self.x, subject.at.z - self.z) : 0;
      const range = el.querySelector<HTMLElement>('.sv-mark-far')!;
      const text = !inside || subject.down ? `${Math.round(far)}m` : '';
      if (range.textContent !== text) range.textContent = text;
    }
    for (const [id, el] of this.marks) if (!seen.has(id)) { el.remove(); this.marks.delete(id); }
  }

  private mark(subject: MarkSubject) {
    let el = this.marks.get(subject.id);
    if (el) return el;
    el = document.createElement('div');
    el.className = 'sv-mark';
    const portrait = mediaArt(FIGHTERS[subject.fighter]?.portrait ?? '');
    el.innerHTML = `<span class="sv-mark-arrow"></span><span class="sv-mark-card"><span class="sv-mark-face">${portrait ? `<img alt="" src="${portrait}">` : ''}</span>`
      + `<span class="sv-mark-text"><b></b><i class="sv-mark-hp"><i></i></i></span></span>`
      + `<span class="sv-mark-revive"><span class="sv-mark-cross"></span><b>REVIVE</b></span><small class="sv-mark-far"></small>`;
    el.querySelector('b')!.textContent = subject.name.toUpperCase().slice(0, 12);
    this.element.append(el);
    this.marks.set(subject.id, el);
    return el;
  }

  clear() { for (const el of this.marks.values()) el.remove(); this.marks.clear(); }
}

export const ALLY_MARKS: { current?: AllyMarks } = {};
