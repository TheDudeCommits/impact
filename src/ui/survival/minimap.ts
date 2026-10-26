import type { RunView } from '../../survival/SurvivalGame';
import { css as hexCss, seatColour } from './seats';
import {ObservedSize} from '../ObservedSize';

export const MAP_VIEW = { yaw: 0 };

export const HORDE_DOTS = { n: 0, x: new Float32Array(640), z: new Float32Array(640), kind: new Uint8Array(640),
  threat: new Uint8Array(640) };
const DOT_COLOUR = ['#e8303c', '#ffcf5a', '#ff7a2a'];

const RANGE = 30;
const AFFIX_COLOUR = ['#ffcf5a', '#ff6a2a', '#8fc4ff', '#7ff0ff', '#d8ff5a'];

export class Minimap {
  readonly element: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private size = 0;
  private shown = false;
  private readonly measured:ObservedSize;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('canvas');
    this.element.className = 'sv-map hidden';
    this.element.setAttribute('aria-hidden', 'true');
    parent.append(this.element);
    this.ctx = this.element.getContext('2d')!;
    this.measured=new ObservedSize(this.element);
  }

  hide() { if (this.shown) { this.shown = false; this.element.classList.add('hidden'); } }

  update(view: RunView, time: number) {
    const me = view.spots?.[0];
    const wanted = !!me && (view.phase === 'fight' || view.phase === 'draft');
    if (!wanted) { this.hide(); return; }
    if (!this.shown) { this.shown = true; this.element.classList.remove('hidden'); }
    const css = this.measured.width || 160, dpr = Math.min(2, window.devicePixelRatio || 1), px = Math.round(css * dpr);
    if (px !== this.size) { this.size = this.element.width = this.element.height = px; }
    const ctx = this.ctx, s = px, c = s / 2, r = s / 2 - 3 * dpr, k = r / RANGE;
    const turn = MAP_VIEW.yaw, cos = Math.cos(turn), sin = Math.sin(turn);
    const place = (x: number, z: number) => {
      const dx = x - me!.x, dz = z - me!.z;
      const right = dx * cos - dz * sin, ahead = dx * sin + dz * cos;
      return { x: c - right * k, y: c - ahead * k, d: Math.hypot(right, ahead) };
    };
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = 'rgba(10,10,12,.72)'; ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = dpr;
    for (const m of [10, 20]) { ctx.beginPath(); ctx.arc(c, c, m * k, 0, Math.PI * 2); ctx.stroke(); }
    const { halfX, halfZ } = view.bounds ?? { halfX: 34, halfZ: 34 };
    const corners = [place(-halfX, -halfZ), place(halfX, -halfZ), place(halfX, halfZ), place(-halfX, halfZ)];
    ctx.beginPath(); corners.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    ctx.strokeStyle = 'rgba(255,249,239,.38)'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = dpr;
    for (let i = 0; i < HORDE_DOTS.n; i++) {
      const p = place(HORDE_DOTS.x[i], HORDE_DOTS.z[i]);
      if (p.d * k > r - 2 * dpr) continue;
      const kind = HORDE_DOTS.kind[i], size = (kind === 2 ? 3.2 : kind === 1 ? 2.8 : 1.9) * dpr;
      ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = DOT_COLOUR[kind] ?? DOT_COLOUR[0]; ctx.fill();
      if (kind) ctx.stroke();
    }
    ctx.restore();
    const pulse = .6 + .4 * Math.sin(time * 6);
    for (const pack of view.dungeon?.elites ?? []) {
      const p = place(pack.x, pack.z), out = p.d * k > r - 7 * dpr;
      const angle = Math.atan2(p.y - c, p.x - c);
      const at = out ? { x: c + Math.cos(angle) * (r - 7 * dpr), y: c + Math.sin(angle) * (r - 7 * dpr) } : p;
      const colour = pack.elite ? AFFIX_COLOUR[pack.affix ?? 0] ?? '#ffcf5a' : pack.awake ? `rgba(235,40,52,${pulse})` : '#b3242e';
      ctx.fillStyle = colour; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5 * dpr;
      if (out) {
        ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(angle);
        ctx.beginPath(); ctx.moveTo(5 * dpr, 0); ctx.lineTo(-3 * dpr, -4.5 * dpr); ctx.lineTo(-3 * dpr, 4.5 * dpr); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore();
        continue;
      }
      const size = (2.6 + Math.min(4, pack.left * .45)) * dpr;
      ctx.beginPath();
      if (pack.elite) { ctx.moveTo(at.x, at.y - size * 1.3); ctx.lineTo(at.x + size * 1.3, at.y); ctx.lineTo(at.x, at.y + size * 1.3); ctx.lineTo(at.x - size * 1.3, at.y); ctx.closePath(); }
      else ctx.arc(at.x, at.y, size, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    if (view.ward) {
      const p = place(view.ward.x, view.ward.z), edge = r - 9 * dpr;
      const at = p.d * k > edge ? { x: c + (p.x - c) / (p.d * k) * edge, y: c + (p.y - c) / (p.d * k) * edge } : p;
      const size = Math.max(5 * dpr, Math.min(view.ward.radius * k, 16 * dpr));
      ctx.beginPath(); ctx.arc(at.x, at.y, size, 0, Math.PI * 2);
      ctx.fillStyle = view.ward.held ? 'rgba(255,207,90,.28)' : 'rgba(74,184,255,.24)'; ctx.fill();
      ctx.lineWidth = 2.4 * dpr; ctx.strokeStyle = view.ward.held ? '#ffcf5a' : '#4ab8ff'; ctx.stroke();
    }
    for (const boss of view.bosses) {
      if (boss.x === undefined || boss.z === undefined || boss.hp <= 0) continue;
      const p = place(boss.x, boss.z);
      const at = p.d * k > r - 8 * dpr ? { x: c + (p.x - c) / (p.d * k) * (r - 8 * dpr), y: c + (p.y - c) / (p.d * k) * (r - 8 * dpr) } : p;
      const size = (boss.champion ? 4 : 6) * dpr;
      ctx.beginPath(); ctx.arc(at.x, at.y, size, 0, Math.PI * 2);
      ctx.fillStyle = '#0b0c0e'; ctx.fill(); ctx.lineWidth = 2.2 * dpr; ctx.strokeStyle = '#ff2a3a'; ctx.stroke();
      ctx.beginPath(); ctx.arc(at.x, at.y, size * .38, 0, Math.PI * 2); ctx.fillStyle = '#ff2a3a'; ctx.fill();
    }
    view.spots.forEach((spot, i) => {
      const member = view.party[i];
      let p = i ? place(spot.x, spot.z) : { x: c, y: c, d: 0 };
      if (i && member?.down) {
        if (p.d * k > r - 7 * dpr) p = { x: c + (p.x - c) / (p.d * k) * (r - 7 * dpr), y: c + (p.y - c) / (p.d * k) * (r - 7 * dpr), d: 0 };
        const a = (5 + 1.5 * pulse) * dpr;
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.beginPath(); ctx.arc(0, 0, a * 1.25, 0, Math.PI * 2); ctx.fillStyle = '#0b0c0e'; ctx.fill();
        ctx.lineWidth = 2 * dpr; ctx.strokeStyle = `rgba(255,42,58,${.6 + .4 * pulse})`; ctx.stroke();
        ctx.fillStyle = '#ff2a3a'; ctx.fillRect(-a * .22, -a * .7, a * .44, a * 1.4); ctx.fillRect(-a * .7, -a * .22, a * 1.4, a * .44);
        ctx.restore();
        return;
      }
      if (p.d * k > r) return;
      const facing = spot.yaw - turn;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-facing);
      const a = (i ? 5 : 6.5) * dpr;
      ctx.beginPath(); ctx.moveTo(0, -a * 1.2); ctx.lineTo(a * .8, a * .8); ctx.lineTo(0, a * .35); ctx.lineTo(-a * .8, a * .8); ctx.closePath();
      ctx.fillStyle = i ? hexCss(seatColour(member?.seat)) : '#fff9ef'; ctx.fill(); ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = '#000'; ctx.stroke();
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.lineWidth = 3 * dpr; ctx.strokeStyle = '#0b0c0e'; ctx.stroke();
    ctx.beginPath(); ctx.arc(c, c, r - 2.5 * dpr, 0, Math.PI * 2);
    ctx.lineWidth = 1.2 * dpr; ctx.strokeStyle = 'rgba(255,249,239,.8)'; ctx.stroke();
  }
}
