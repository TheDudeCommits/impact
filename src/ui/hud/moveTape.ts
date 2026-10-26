const SHOW_MS = 1800;
const NAMED_ON_USE = new Set(['2', '3', '4']);

export class MoveTape {
  private el?: HTMLElement;
  private until = 0;
  private was = new WeakMap<HTMLElement, { active: boolean; ready: boolean }>();

  tick(root: HTMLElement, bar: HTMLElement, now: number) {
    const on = root.dataset.moves === 'pad' && root.dataset.skin === 'halo';
    let name = '', ready = false;
    for (const card of bar.querySelectorAll<HTMLElement>('.move-slot.ik-card')) {
      const active = card.classList.contains('active'), isReady = card.classList.contains('ready');
      const was = this.was.get(card);
      this.was.set(card, { active, ready: isReady });
      if (!on || !was) continue;
      const move = card.dataset.move, awakening = card.id === 'awakening-card';
      if (active && !was.active && move !== undefined && NAMED_ON_USE.has(move)) { name = this.label(card); ready = false; }
      else if (isReady && !was.ready && (move === '4' || awakening)) { name = this.label(card); ready = true; }
    }
    if (name) this.show(bar, name, ready, now);
    else if (this.el?.classList.contains('on') && (!on || now > this.until)) this.el.classList.remove('on');
  }

  private label(card: HTMLElement) { return (card.querySelector('.ik-cap')?.textContent ?? '').trim(); }

  private show(bar: HTMLElement, name: string, ready: boolean, now: number) {
    if (!this.el || this.el.parentElement !== bar) {
      this.el = document.createElement('span');
      this.el.className = 'mv-tape';
      this.el.setAttribute('aria-hidden', 'true');
      bar.append(this.el);
    }
    this.el.textContent = name;
    if (ready) { const em = document.createElement('em'); em.textContent = ' READY'; this.el.append(em); }
    this.el.classList.remove('on'); void this.el.offsetWidth; this.el.classList.add('on');
    this.until = now + SHOW_MS;
  }
}
