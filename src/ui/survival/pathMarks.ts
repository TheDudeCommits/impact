import * as THREE from 'three';
import { PATH_INFO, type PathKind } from '../../survival/paths';
import {ObservedSize} from '../ObservedSize';


export interface ForkSubject { kind: PathKind; x: number; z: number; votes: number }

const _p = new THREE.Vector3(), _v = new THREE.Vector3();
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export class PathMarks {
  readonly element: HTMLElement;
  private readonly marks = new Map<PathKind, HTMLElement>();
  private readonly measured:ObservedSize;
  private width = 0;
  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'sv-portals';
    this.element.setAttribute('aria-hidden', 'true');
    parent.append(this.element);
    this.measured=new ObservedSize(this.element);
  }

  place(forks: readonly ForkSubject[] | undefined, camera: THREE.Camera, party: number) {
    const w = this.measured.width || window.innerWidth, h = this.measured.height || window.innerHeight;
    const width = Math.max(112, Math.min(224, (w - 48) / 3));
    if (width !== this.width) { this.width = width; this.element.style.setProperty('--portal-width', `${width}px`); }
    const edgeX = width / 2 + 12, top = Math.min(154, h * .24) + 108, bottom = h - 154;
    const seen = new Set<PathKind>();
    for (const fork of forks ?? []) {
      seen.add(fork.kind);
      const el = this.mark(fork.kind);
      _p.set(fork.x, 3.9, fork.z);
      _v.copy(_p).applyMatrix4(camera.matrixWorldInverse);
      const behind = _v.z > -.1;
      _p.project(camera);
      let x = (_p.x * .5 + .5) * w, y = (1 - (_p.y * .5 + .5)) * h;
      const inside = !behind && x > 0 && x < w && y > 0 && y < h;
      if (!inside) {
        const dx = behind ? _v.x : x - w / 2, dy = behind ? Math.max(Math.abs(_v.x) * .6, 1) : y - h / 2;
        const scale = Math.min((w / 2 - edgeX) / Math.max(1e-3, Math.abs(dx)), (h / 2 - 108) / Math.max(1e-3, Math.abs(dy)));
        x = w / 2 + dx * scale; y = h / 2 + dy * scale;
      }
      x = Math.max(edgeX, Math.min(w - edgeX, x));
      y = Math.max(top, Math.min(Math.max(top, bottom), y));
      el.classList.toggle('off', !inside);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      const votes = el.querySelector<HTMLElement>('.sv-portal-votes')!;
      const text = party > 1 && fork.votes ? `${fork.votes}/${party}` : '';
      if (votes.textContent !== text) votes.textContent = text;
      el.classList.toggle('voted', fork.votes > 0);
    }
    for (const [kind, el] of this.marks) if (!seen.has(kind)) { el.remove(); this.marks.delete(kind); }
  }

  private mark(kind: PathKind) {
    let el = this.marks.get(kind);
    if (el) return el;
    const info = PATH_INFO[kind];
    el = document.createElement('div');
    el.className = 'sv-portal';
    el.dataset.kind = kind;
    el.style.setProperty('--c', hex(info.color));
    el.innerHTML = `<b class="sv-portal-kanji">${info.kanji}</b><strong>${info.name}</strong><small>${info.line}</small><em class="sv-portal-votes"></em>`;
    this.element.append(el);
    this.marks.set(kind, el);
    return el;
  }
  clear() { for (const el of this.marks.values()) el.remove(); this.marks.clear(); }
}

export const PATH_MARKS: { current?: PathMarks } = {};
