export interface IntroSound { impact(): void; roar(): void; stamp(): void }

const PANELS: { image: string; lines: [string, string?]; from: 'left' | 'right' | 'up' | 'down' | 'zoom' }[] = [
  { image: '/assets/survival/intro/1.webp', lines: ['THE SKY TORE OPEN.', 'A RIFT BETWEEN EVERY WORLD THERE IS.'], from: 'zoom' },
  { image: '/assets/survival/intro/2.webp', lines: ['THROUGH IT POURED THE VILLAINS AND DEMONS', 'OF EVERY UNIVERSE.'], from: 'right' },
  { image: '/assets/survival/intro/3.webp', lines: ['CITIES FELL. PEOPLE RAN.', 'THE WORLD BEGAN TO BURN.'], from: 'left' },
  { image: '/assets/survival/intro/4.webp', lines: ['ONLY THE HEROES STILL STAND', 'BETWEEN THE RIFT AND WHAT IS LEFT.'], from: 'down' },
  { image: '/assets/survival/intro/5.webp', lines: ['HOLD THE LINE. SURVIVE.', 'SAVE THE WORLD.'], from: 'zoom' },
];
const chosen = () => document.querySelector<HTMLElement>('.home-fighter[aria-pressed="true"]')?.dataset.fighter;
const HOLD = 4.2, TITLE = 2.6;
const KEY = 'rift-intro-seen';

export class RiftIntro {
  private root: HTMLElement;
  private timers: number[] = [];
  private resolve?: () => void;
  private started = 0;
  sound?: IntroSound;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'rift-intro hidden';
    this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-label', 'Arcade Survival: the story');
    this.root.innerHTML = `<div class="rift-intro-stage"></div><div class="rift-intro-lines" aria-live="polite"></div>
      <div class="rift-intro-title"><span class="rift-intro-kanji">最後の戦い</span><strong>THE RIFT</strong><small>ARCADE SURVIVAL</small></div>
      <button type="button" class="rift-intro-skip">SKIP <b>▶▶</b></button><i class="rift-intro-progress"></i>`;
    parent.append(this.root);
    this.root.addEventListener('pointerdown', event => { event.preventDefault(); this.skip(); });
  }

  get open() { return !this.root.classList.contains('hidden'); }

  static wanted() {
    if (new URLSearchParams(location.search).has('intro')) return true;
    if (new URLSearchParams(location.search).has('autopilot')) return false;
    try { return localStorage.getItem(KEY) !== '1'; } catch { return true; }
  }

  preload() { for (const panel of PANELS) { const img = new Image(); img.decoding = 'async'; img.src = panel.image; } }

  play(): Promise<void> {
    this.stop();
    try { localStorage.setItem(KEY, '1'); } catch { }
    this.root.classList.remove('hidden', 'titled', 'leaving');
    const stage = this.root.querySelector<HTMLElement>('.rift-intro-stage')!, lines = this.root.querySelector<HTMLElement>('.rift-intro-lines')!;
    stage.replaceChildren(); lines.replaceChildren();
    this.started = performance.now();
    this.root.style.setProperty('--intro-length', `${PANELS.length * HOLD + TITLE}s`);
    const progress = this.root.querySelector<HTMLElement>('.rift-intro-progress')!;
    progress.classList.remove('run'); void progress.offsetWidth; progress.classList.add('run');
    window.addEventListener('keydown', this.keyed, true);
    PANELS.forEach((panel, i) => {
      this.at(i * HOLD, () => {
        const frame = document.createElement('div');
        frame.className = `rift-intro-panel from-${panel.from}`;
        frame.style.setProperty('--tilt', `${i % 2 ? 1.6 : -1.8}deg`);
        const img = new Image(); img.alt = ''; img.src = panel.image; img.draggable = false;
        const hero = i === PANELS.length - 1 ? chosen() : undefined;
        if (hero && /^[a-z]+$/.test(hero)) { frame.classList.add('hero'); img.src = `/assets/home/sprites/${hero}-poster.webp`; }
        frame.append(img);
        stage.append(frame);
        for (const old of [...stage.children].slice(0, -1)) { old.classList.add('out'); window.setTimeout(() => old.remove(), 700); }
        lines.replaceChildren();
        this.sound?.impact();
        if (i === 1) this.at(i * HOLD + .5, () => this.sound?.roar());
      });
      panel.lines.forEach((line, k) => {
        if (!line) return;
        this.at(i * HOLD + .55 + k * .75, () => {
          const box = document.createElement('p');
          box.className = `rift-intro-line${k ? ' second' : ''}`;
          box.textContent = line;
          lines.append(box);
          this.sound?.stamp();
        });
      });
    });
    this.at(PANELS.length * HOLD, () => { this.root.classList.add('titled'); lines.replaceChildren(); this.sound?.impact(); });
    this.at(PANELS.length * HOLD + TITLE, () => this.finish());
    return new Promise(resolve => { this.resolve = resolve; });
  }

  skip() { if (this.open && performance.now() - this.started > 250) this.finish(); }
  close() { if (this.open) this.finish(); }

  private keyed = (event: KeyboardEvent) => {
    if (!this.open || event.repeat) return;
    event.preventDefault(); event.stopPropagation();
    this.skip();
  };
  private at(seconds: number, fn: () => void) { this.timers.push(window.setTimeout(fn, seconds * 1000)); }
  private stop() { for (const timer of this.timers) window.clearTimeout(timer); this.timers = []; window.removeEventListener('keydown', this.keyed, true); }
  private finish() {
    this.stop();
    this.root.classList.add('leaving');
    window.setTimeout(() => { this.root.classList.add('hidden'); this.root.classList.remove('leaving', 'titled'); }, 420);
    const resolve = this.resolve; this.resolve = undefined; resolve?.();
  }
}
