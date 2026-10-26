import type { HudLayoutId, ModeHudFrame } from '../hud/modeHud';
import './lookHint.css';

const CAPTURED_KEY = 'rift-pointer-captured';
const SHOWN_KEY = 'rift-look-hint';
export const QUIET_MS = 8000;
export const SHOW_MS = 3000;
export const SWEEP_SHARE = .6, SWEEP_MS = 2000, SWEEP_EVENTS = 8;

const local = { get: (k: string) => { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } }, set: (k: string) => { try { globalThis.localStorage?.setItem(k, '1'); } catch { } } };
const session = { get: (k: string) => { try { return globalThis.sessionStorage?.getItem(k) ?? null; } catch { return null; } }, set: (k: string) => { try { globalThis.sessionStorage?.setItem(k, '1'); } catch { } } };

export interface LookState {
  fighting: boolean;
  sinceActive: number;
  input: ModeHudFrame['input'];
  touch: boolean;
  alive: boolean;
  pointerFree: boolean;
  captured: boolean;
  shown: boolean;
}

const fighting = (f: ModeHudFrame) => f.phase === 'active' && (!f.run || f.run.phase === 'fight');

export function lookHintAllowed(s: LookState) {
  return s.fighting && s.sinceActive >= QUIET_MS && s.input === 'keyboard' && !s.touch && s.alive && s.pointerFree && !s.captured && !s.shown;
}

export function sweepDetected(moves: readonly (readonly [number, number])[], now: number, width: number) {
  let travel = 0, count = 0;
  for (const [t, dx] of moves) if (now - t <= SWEEP_MS) { travel += dx; count++; }
  return count >= SWEEP_EVENTS && travel >= SWEEP_SHARE * width;
}

export class LookHint {
  private readonly el = document.createElement('div');
  private chip?: HTMLElement | null;
  private activeAt = 0;
  private until = 0;
  private pending = false;
  private captured = local.get(CAPTURED_KEY) === '1';
  private shown = session.get(SHOWN_KEY) === '1';
  private readonly moves: [number, number][] = [];
  private lastX?: number;
  private readonly touch = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;

  constructor(private readonly root: HTMLElement) {
    this.el.className = 'look-hint';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = '<kbd>Click</kbd><span>LOOK WITH THE MOUSE</span>';
    root.append(this.el);
    document.addEventListener('pointerlockchange', () => {
      if (!(document.pointerLockElement instanceof HTMLCanvasElement)) return;
      this.captured = true; local.set(CAPTURED_KEY); this.hide();
    });
    document.addEventListener('pointerlockerror', () => { this.pending = true; });
    window.addEventListener('mousemove', event => this.move(event), { passive: true });
  }

  frame(f: ModeHudFrame, _layout: HudLayoutId) {
    if (!fighting(f)) { this.activeAt = 0; this.pending = false; this.moves.length = 0; this.hide(); return; }
    if (!this.activeAt) this.activeAt = f.now;
    if (this.until && (f.now >= this.until || !this.allowedNow(f, true))) this.hide();
    if (this.pending) {
      this.pending = false;
      if (this.allowedNow(f)) this.show(f.now);
    }
  }
  clear() { this.activeAt = 0; this.pending = false; this.moves.length = 0; this.hide(); }

  private allowedNow(f: ModeHudFrame, showing = false) {
    this.chip ??= this.root.querySelector<HTMLElement>('#pointer-hint');
    return lookHintAllowed({
      fighting: fighting(f), sinceActive: f.now - this.activeAt, input: f.input, touch: this.touch, alive: f.self.alive,
      pointerFree: !!this.chip && !this.chip.classList.contains('hidden'), captured: this.captured, shown: showing ? false : this.shown,
    });
  }
  private move(event: MouseEvent) {
    if (this.shown || this.captured || this.touch || document.pointerLockElement || !this.activeAt) return;
    const lastX = this.lastX; this.lastX = event.clientX;
    if ((event.target as HTMLElement | null)?.id !== 'game-canvas') return;
    const now = performance.now(), dx = Math.abs(event.movementX || (lastX === undefined ? 0 : event.clientX - lastX));
    if (!dx) return;
    this.moves.push([now, dx]);
    while (this.moves.length && now - this.moves[0][0] > SWEEP_MS) this.moves.shift();
    if (sweepDetected(this.moves, now, innerWidth)) { this.moves.length = 0; this.pending = true; }
  }
  private show(now: number) {
    this.shown = true; session.set(SHOWN_KEY);
    this.until = now + SHOW_MS;
    this.el.classList.remove('on'); void this.el.offsetWidth; this.el.classList.add('on');
  }
  private hide() { this.until = 0; this.el.classList.remove('on'); }
}
