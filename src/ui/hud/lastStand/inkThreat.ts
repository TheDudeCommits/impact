import * as THREE from 'three';
import { el, Flag, Text } from '../kit';
import { hudView } from '../hudView';

const _p = new THREE.Vector3(), _v = new THREE.Vector3();
export function sideOf(x: number, y: number, z: number, fallback: -1 | 1): -1 | 1 {
  const camera = hudView.camera;
  if (!camera) return fallback;
  _p.set(x, y, z); _v.copy(_p).applyMatrix4(camera.matrixWorldInverse);
  if (_v.z >= 0) return _v.x < 0 ? -1 : 1;
  _p.project(camera);
  return _p.x < 0 ? -1 : 1;
}

const LEAVES = 4;
export class InkThreat {
  readonly root: HTMLElement;
  private readonly kanji: Text; private readonly count: Text; private readonly hidden: Flag; private readonly hot: Flag;
  constructor(parent: HTMLElement, side: 'left' | 'right') {
    const id = `lsi-${side}`;
    this.root = el('div', `ls-lane ls-ink ls-ink-${side}`, parent);
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = `<svg class="ls-ink-bleed" viewBox="0 0 300 520" preserveAspectRatio="none"><defs>`
      + `<radialGradient id="${id}g" cx="0" cy=".5" r="1"><stop offset="0" stop-color="#dc143c" stop-opacity=".95"/><stop offset=".45" stop-color="#dc143c" stop-opacity=".55"/><stop offset="1" stop-color="#dc143c" stop-opacity="0"/></radialGradient>`
      + `<filter id="${id}f" filterUnits="userSpaceOnUse" x="-60" y="-40" width="420" height="600"><feTurbulence type="fractalNoise" baseFrequency=".022" numOctaves="4" seed="9"/><feDisplacementMap in="SourceGraphic" scale="60"/></filter></defs>`
      + `<g filter="url(#${id}f)"><ellipse cx="0" cy="260" rx="230" ry="250" fill="url(#${id}g)"/><g fill="#dc143c"><circle cx="150" cy="120" r="9"/><circle cx="182" cy="330" r="6"/><circle cx="130" cy="420" r="11"/><circle cx="205" cy="230" r="4"/></g></g></svg>`
      + `<div class="ls-ink-wind"><svg viewBox="0 0 640 360" preserveAspectRatio="none"><path d="M560 190 Q 340 120 70 70"/><path d="M600 250 Q 360 200 110 150"/><path d="M520 300 Q 300 260 60 230"/></svg>`
      + Array.from({ length: LEAVES }, (_, i) => `<i style="--i:${i}"></i>`).join('') + `</div>`
      + `<b class="ls-ink-k"></b><span class="ls-ink-n"><em></em><small>RAIDERS</small></span>`;
    this.kanji = new Text(this.root.querySelector('.ls-ink-k')!); this.count = new Text(this.root.querySelector('.ls-ink-n em')!);
    this.hidden = new Flag(this.root); this.hot = new Flag(this.root, 'hot'); this.hidden.set(true);
  }
  show(kanji: string, raiders: number, hot: boolean) { this.hidden.set(false); this.kanji.set(kanji); this.count.set(raiders > 0 ? String(raiders) : ''); this.root.classList.toggle('no-count', raiders <= 0); this.hot.set(hot); }
  hide() { this.hidden.set(true); }
}
