import { ULTIMATE_COST } from '../../game/moves';
import type { ModeHud, ModeHudFrame, ModeHudMount } from './modeHud';
import { el, show } from './mainHudKit';
import './duelHud.css';

export function createDuelHud(): ModeHud { return new DuelHud(); }

const STAR = '<svg viewBox="-16 -16 32 32" aria-hidden="true"><path d="M0 -15C1.4 -4 4 -1.4 15 0C4 1.4 1.4 4 0 15C-1.4 4 -4 1.4 -15 0C-4 -1.4 -1.4 -4 0 -15Z"/></svg>';

class DuelHud implements ModeHud {
  private plaque!: HTMLElement;
  private ready!: HTMLElement;
  private readonly pips: HTMLElement[] = [];
  private readonly drawn: number[] = [];

  mount(m: ModeHudMount) {
    this.plaque = el('div', 'duel-plaque', '<i class="dp-x" aria-hidden="true"></i><strong>DUEL</strong><small><b>ROUND 1</b><em>FIRST TO TWO</em></small>');
    this.plaque.hidden = true;
    m.zone('2').append(this.plaque);
    for (const [zone, side] of [['1b', 'own'], ['3b', 'rival']] as const) {
      const pips = el('div', 'duel-pips'); pips.dataset.side = side; pips.setAttribute('aria-label', 'Rounds won');
      m.zone(zone).append(pips); this.pips.push(pips);
    }
    this.ready = el('div', 'duel-ready', '<b>ULTIMATE READY</b>');
    this.ready.setAttribute('role', 'status'); this.ready.hidden = true;
    m.zone('3b').append(this.ready);
  }

  update(f: ModeHudFrame) {
    const { snapshot: s, self, target, phase } = f;
    const duel=s.duel,interval=duel?.phase==='interval';
    show(this.plaque, phase !== 'waiting' || interval);
    this.plaque.classList.toggle('dp-interval', interval);
    if(duel){const round=this.plaque.querySelector('small b')!,rule=this.plaque.querySelector('small em')!;
      const word=`ROUND ${duel.round}`,line=interval?`GET READY · ${Math.max(0,Math.ceil((duel.nextRoundAt??0)-s.serverTime))}`:'FIRST TO TWO';
      if(round.textContent!==word)round.textContent=word;if(rule.textContent!==line)rule.textContent=line;
      const ids=[self.id,s.players.find(p=>p.id!==self.id)?.id];
      this.pips.forEach((node,i)=>{const wins=duel.scores[ids[i]??'']??0,before=this.drawn[i]??wins;this.drawn[i]=wins;
        const markup=Array.from({length:2},(_,n)=>`<i class="${n<wins?(n>=before?'won fresh':'won'):''}">${STAR}</i>`).join('');
        if(node.dataset.wins!==String(wins)){node.dataset.wins=String(wins);node.innerHTML=markup;}node.setAttribute('aria-label',`${wins} rounds won of 2`);});}
    let rival = target;
    if (!rival || rival.id === self.id) for (const p of s.players) if (p.id !== self.id) { rival = p; break; }
    show(this.ready, phase === 'active' && !!rival && rival.alive && rival.ultimate >= ULTIMATE_COST);
  }

  unmount() {
    for (const node of [this.plaque, this.ready, ...this.pips]) node?.remove();
    this.pips.length = 0; this.drawn.length = 0;
  }
}
