import type { HudLayoutId, ModeHudFrame } from '../hud/modeHud';
import './hudPrompts.css';

const STRIP_KEY = 'rift-strip-matches', STRIP_SECONDS = 60, STRIP_MATCHES = 3;
const read = () => { try { return Number(globalThis.localStorage?.getItem(STRIP_KEY)) || 0; } catch { return 0; } };
const write = (n: number) => { try { globalThis.localStorage?.setItem(STRIP_KEY, String(n)); } catch { } };

export const stripShown = (matchesBefore: number, secondsIn: number) => matchesBefore < STRIP_MATCHES && secondsIn < STRIP_SECONDS;

export class HudPrompts {
  private startedAt = 0;
  private counted = false;
  private before = read();
  constructor(private readonly root: HTMLElement) {}
  frame(f: ModeHudFrame, _layout: HudLayoutId) {
    if (f.phase !== 'active') { this.startedAt = 0; return; }
    if (!this.startedAt) {
      this.startedAt = f.now;
      if (!this.counted) { this.counted = true; this.before = read(); write(this.before + 1); }
    }
    const show = stripShown(this.before, (f.now - this.startedAt) / 1000);
    if (show !== ('strip' in this.root.dataset)) { if (show) this.root.dataset.strip = ''; else delete this.root.dataset.strip; }
  }
  clear() { this.startedAt = 0; this.counted = false; delete this.root.dataset.strip; }
}
