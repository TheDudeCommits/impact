import * as THREE from 'three';
import { viewHeight, viewWidth } from '../viewport';
import { el, Text, Flag } from './kit';
import { hudView } from './hudView';
import { comboKeepOut } from './inked';

const _p = new THREE.Vector3(), _v = new THREE.Vector3();

export interface EdgeFrame { top: number; bottom: number; left: number; right: number }

export class EdgeTag {
  readonly root: HTMLElement;
  readonly title: Text; readonly detail: Text;
  readonly pulse: Flag;
  private readonly arrow: HTMLElement; private readonly hidden: Flag; private readonly lead: Flag;
  private x = NaN; private y = NaN; private turn = NaN; private w = 0; private h = 0; private sized = 0;
  key = ''; count = -1;
  constructor(parent: HTMLElement, className = '') {
    this.root = el('div', `hk-edge hidden ${className}`.trim(), parent);
    this.root.setAttribute('aria-hidden', 'true');
    const copy = el('div', '', this.root);
    this.title = new Text(el('b', '', copy)); this.detail = new Text(el('small', '', copy));
    this.arrow = el('i', 'hk-edge-arrow', this.root);
    this.hidden = new Flag(this.root); this.lead = new Flag(this.root, 'lead'); this.pulse = new Flag(this.root, 'pulse');
    this.hidden.set(true);
  }
  hide() { this.hidden.set(true); }
  place(atX: number, atY: number, atZ: number, frame: EdgeFrame, side: -1 | 0 | 1, now: number) {
    const w = viewWidth(), h = viewHeight(), camera = hudView.camera;
    let x: number, y: number, dx: number, dy: number, onScreen = false;
    if (camera) {
      _p.set(atX, atY, atZ); _v.copy(_p).applyMatrix4(camera.matrixWorldInverse); _p.project(camera);
      const behind = _v.z >= 0;
      x = (_p.x * .5 + .5) * w; y = (-_p.y * .5 + .5) * h;
      dx = behind ? _v.x : x - w / 2; dy = behind ? Math.max(4, Math.abs(_v.z) * .4) : y - h / 2;
      onScreen = !behind && x > frame.left && x < frame.right && y > frame.top * .5 && y < frame.bottom;
    } else { dx = side; dy = side ? 0 : -1; x = w / 2; y = h / 2; }
    this.hidden.set(false);
    if (now - this.sized > 1000 || !this.w) { this.sized = now; const r = this.root.getBoundingClientRect(); this.w = r.width || 120; this.h = r.height || 28; }
    if (onScreen) {
      x -= this.w / 2; y -= this.h + 14; dx = 0; dy = 1;
    } else {
      const length = Math.max(.001, Math.hypot(dx, dy)); dx /= length; dy /= length;
      const cx = w / 2, cy = (frame.top + frame.bottom) / 2;
      const reach = Math.min((dx > 0 ? frame.right - cx : cx - frame.left) / Math.max(.001, Math.abs(dx)), (dy > 0 ? frame.bottom - cy : cy - frame.top) / Math.max(.001, Math.abs(dy)));
      x = cx + dx * reach; y = cy + dy * reach;
      x = dx > .35 ? x - this.w : dx < -.35 ? x : x - this.w / 2;
      y = dy > .35 ? y - this.h : dy < -.35 ? y : y - this.h / 2;
    }
    x = Math.round(Math.max(frame.left, Math.min(frame.right - this.w, x)));
    y = Math.round(Math.max(frame.top, Math.min(frame.bottom - this.h, y)));
    if (!onScreen) {
      const c = comboKeepOut();
      if (x < c.right && x + this.w > c.left && y < c.bottom && y + this.h > c.top) {
        const below = Math.round(c.bottom + 6), above = Math.round(c.top - this.h - 6);
        y = below + this.h <= frame.bottom ? below : above >= frame.top ? above : y;
      }
    }
    const turn = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
    if (x !== this.x || y !== this.y) { this.x = x; this.y = y; this.root.style.transform = `translate(${x}px,${y}px)`; }
    if (turn !== this.turn) { this.turn = turn; this.arrow.style.setProperty('--turn', `${turn}deg`); }
    this.lead.set(dx < -.35);
  }
}

let frameW = 0, frameH = 0;
const frameValue: EdgeFrame = { top: 0, bottom: 0, left: 0, right: 0 };
export function edgeFrame(): EdgeFrame {
  const w = viewWidth(), h = viewHeight();
  if (w === frameW && h === frameH) return frameValue;
  frameW = w; frameH = h;
  const phone = h <= 520 || w <= 620, edge = phone ? 8 : 16;
  frameValue.left = edge; frameValue.right = w - edge;
  frameValue.top = Math.round(h * (phone ? .3 : .2)); frameValue.bottom = Math.round(h * (phone ? .62 : .7));
  return frameValue;
}
