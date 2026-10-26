import { FIGHTERS } from '../config';
import { AWAKENINGS } from '../game/awakening';
import { selectLaboratoryFighter } from '../fighterLab';
import type { FighterId } from '../game/types';
import './modes/modeSheet.css';
import './fighterLaboratory.css';

export class FighterLaboratory {
  private readonly dialog = document.createElement('dialog');
  private readonly start: HTMLButtonElement;
  private readonly status: HTMLElement;
  private pending = false;
  constructor(host: HTMLElement, private fighter: FighterId, private readonly enter: (fighter:FighterId) => Promise<boolean>) {
    const definition = FIGHTERS[fighter];
    this.dialog.className = 'mode-sheet fighter-lab-entry';
    this.dialog.setAttribute('aria-labelledby', 'fighter-lab-title');
    this.dialog.innerHTML = `<section class="fighter-lab-art"><img src="/assets/home/fighters/${fighter}.webp" alt="${definition.name}" width="933" height="1400"><span class="ms-stamp">IN REVIEW</span></section>
      <section class="fighter-lab-copy"><button class="ms-close" type="button" aria-label="Back to roster">×</button>
      <span class="ms-kicker">FIGHTER LABORATORY</span><h2 id="fighter-lab-title">${definition.name.toUpperCase()}</h2>
      <div class="ms-facts"><span>OFFLINE TRAINING</span></div>
      <p class="ms-goal" data-lab-goal></p><p data-lab-description></p>
      <button class="ms-go" type="button" data-lab-start autofocus><span><b data-lab-label></b><small>OFFLINE · NO ACCOUNT REWARDS</small></span><i aria-hidden="true">→</i></button>
      <p class="ms-status" role="status" aria-live="polite"></p><p class="ms-hint">Use the Training menu to change the dummy and practice each technique.</p></section>`;
    this.start = this.dialog.querySelector<HTMLButtonElement>('[data-lab-start]')!;
    this.status = this.dialog.querySelector<HTMLElement>('[role=status]')!;
    this.start.addEventListener('click', () => { void this.begin(); });
    this.dialog.querySelector('.ms-close')!.addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    host.append(this.dialog);
    this.paint();
  }
  get open() { return this.dialog.open; }
  show(fighter = this.fighter) {
    if(this.pending || !selectLaboratoryFighter(fighter))return;
    this.fighter=fighter;this.paint();
    if(!this.open)this.dialog.showModal();
    this.start.focus();
  }
  close() { this.dialog.close(); }
  controller(action: string) {
    if (!this.open) return false;
    if (action === 'confirm') void this.begin();
    else if (action === 'back') this.close();
    return true;
  }
  private async begin() {
    if (this.pending) return;
    this.pending = true; this.start.disabled = true; this.status.textContent = ''; this.close();
    let entered = false;
    try { entered = await this.enter(this.fighter); }
    catch (error) { console.warn('Fighter laboratory could not start', error); }
    finally {
      this.pending = false; this.start.disabled = false;
      if (!entered) { this.status.textContent = 'Training could not start. Please try again.'; this.show(); }
    }
  }
  private paint(){
    const definition=FIGHTERS[this.fighter];
    const image=this.dialog.querySelector<HTMLImageElement>('.fighter-lab-art img')!;
    image.src=`/assets/home/fighters/${this.fighter}.webp`;image.alt=definition.name;
    this.dialog.querySelector('#fighter-lab-title')!.textContent=definition.name.toUpperCase();
    this.dialog.querySelector('[data-lab-goal]')!.textContent=`Take ${definition.name} into the Training Ground.`;
    this.dialog.querySelector('[data-lab-description]')!.textContent=`This fighter is still being reviewed. Practice ${definition.moves[0]}, ${definition.moves[2]} and ${AWAKENINGS[this.fighter].name} against a training dummy.`;
    this.dialog.querySelector('[data-lab-label]')!.textContent=`TRAIN AS ${definition.name.toUpperCase()}`;
  }
}
