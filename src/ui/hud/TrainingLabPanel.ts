import { isReleasedFighter } from '../../game/rosterAvailability';
import { FIGHTERS } from '../../config';
import { HELD } from '../../game/economy/fighters';
import type { FighterId, GameSnapshot } from '../../game/types';
import type { LabCommand } from '../../game/training/TrainingLab';
import { fighterCaption, HOME_VOLUMES, HOME_ROSTER } from '../MangaHome';
import type { InkSelect } from '../inkSelect';
import '../inkSelect';
import './trainingLab.css';

const opponents = () => {
  const face = (f:FighterId) => `<option value="${f}" data-face="${f}" data-short="${fighterCaption(f)}">${FIGHTERS[f].name}</option>`;
  const extras=(Object.keys(FIGHTERS) as FighterId[]).filter(f=>isReleasedFighter(f)&&!HELD.has(f)&&!HOME_ROSTER.includes(f));
  return HOME_VOLUMES.map((ids,i)=>`<optgroup label="VOL.${i+1}">${ids.filter(f=>isReleasedFighter(f)&&!HELD.has(f)).map(face).join('')}</optgroup>`).join('')+
    (extras.length?`<optgroup label="OTHER FIGHTERS">${extras.map(face).join('')}</optgroup>`:'');
};

export class TrainingLabPanel {
  readonly node = document.createElement('details');
  private last = '';
  constructor() {
    this.node.className = 'training-lab';
    this.node.innerHTML = `<summary>LABORATORY</summary><section aria-label="Training laboratory"><header class="lab-head"><b>LABORATORY</b><button type="button" data-lab-close aria-label="Close the laboratory">CLOSE ✕</button></header>
      <label>OPPONENT<ink-select layout="faces" data-lab="opponent" label="Training opponent">${opponents()}</ink-select></label>
      <label>DUMMY<ink-select data-lab="behaviour" label="Dummy behaviour"><option value="passive">Stand still</option><option value="combat">Fight back</option><option value="guard">Always block</option><option value="after-hit">Block after first hit</option><option value="playback">Recorded sequence</option><option value="punish">Punishment drill</option></ink-select></label>
      <div class="lab-pair"><label>SPEED<ink-select data-lab="speed" label="Simulation speed"><option value="1">100%</option><option value="0.5">50%</option><option value="0.25">25%</option></ink-select></label><label>SEQUENCE<ink-select data-lab="slot" label="Recording slot"><option value="0">Slot 1</option><option value="1">Slot 2</option><option value="2">Slot 3</option></ink-select></label></div>
      <label class="lab-drill-move" hidden>DRILL ATTACK<ink-select data-lab="drill-move" label="Punishment drill attack"><option value="heavy">Heavy attack</option><option value="special">Special move</option></ink-select></label>
      <div class="lab-actions"><button type="button" data-lab="record">RECORD</button><button type="button" data-lab="stop">STOP</button><button type="button" data-lab="play">PLAY LOOP</button></div>
      <p class="lab-tape" role="status"></p>
      <div class="lab-actions"><button type="button" data-lab="freeze" aria-pressed="false">FREEZE</button><button type="button" data-lab="step">+1 FRAME</button><button type="button" data-lab-reset>RESET POSITIONS</button></div>
      <p class="lab-clock"></p><p class="lab-drill" role="status"></p>
      <small>RECORD controls the dummy for up to 10 seconds. STOP saves it. PLAY LOOP repeats your inputs. RESET keeps your recordings.</small>
    </section>`;
    this.node.addEventListener('toggle', () => { if (this.node.open && document.pointerLockElement) document.exitPointerLock?.(); });
    this.node.addEventListener('change', e => { const pick = e.target as InkSelect; if (pick.dataset.lab) this.send({ lab: pick.dataset.lab as LabCommand['lab'], value: pick.value }); });
    this.node.addEventListener('click', e => {
      const button = (e.target as Element).closest<HTMLButtonElement>('button'); if (!button || button.closest('ink-select')) return;
      if (button.hasAttribute('data-lab-close')) { this.node.open = false; return; }
      if (button.hasAttribute('data-lab-reset')) { this.node.dispatchEvent(new CustomEvent('training-lab', { bubbles: true, detail: 'reset' })); return; }
      this.send({ lab: button.dataset.lab as LabCommand['lab'], value: button.getAttribute('aria-pressed') !== 'true' });
    });
  }
  private send(command: LabCommand) { this.node.dispatchEvent(new CustomEvent('training-lab', { bubbles: true, detail: command })); }
  update(s: GameSnapshot) {
    const lab = s.trainingLab; if (!lab) return;
    const bot = s.players.find(p => p.id === 'sparring-bot');
    const key = JSON.stringify([lab, bot?.fighter]); if (key === this.last) return; this.last = key;
    const select = (name: string, value: string) => { const n = this.node.querySelector<InkSelect>(`[data-lab="${name}"]`)!; if (!n.contains(document.activeElement)) n.value = value; };
    if (bot) select('opponent', bot.fighter);
    select('behaviour', lab.behaviour); select('speed', String(lab.speed)); select('slot', String(lab.slot));
    select('drill-move', lab.drill.move);
    this.node.querySelector<HTMLElement>('.lab-drill-move')!.hidden = lab.behaviour !== 'punish';
    this.node.querySelector('.lab-tape')!.textContent = lab.recording ? `RECORDING DUMMY · ${lab.frames}/600 FRAMES` : `SLOT ${lab.slot + 1} · ${lab.frames ? `${lab.frames} FRAMES · ${(lab.frames / 60).toFixed(1)}s` : 'EMPTY'}`;
    this.node.querySelector<HTMLButtonElement>('[data-lab="play"]')!.disabled = !lab.frames || lab.recording;
    this.node.querySelector<HTMLButtonElement>('[data-lab="record"]')!.disabled = lab.recording;
    const freeze = this.node.querySelector<HTMLButtonElement>('[data-lab="freeze"]')!;
    freeze.textContent = lab.frozen ? 'RESUME' : 'FREEZE'; freeze.setAttribute('aria-pressed', String(lab.frozen));
    this.node.querySelector('.lab-clock')!.textContent = `${lab.frozen ? 'FROZEN' : `${lab.speed * 100}% SPEED`} · FRAME ${lab.frame}`;
    const drill = this.node.querySelector<HTMLElement>('.lab-drill')!;
    drill.hidden = lab.behaviour !== 'punish'; drill.textContent = `${lab.drill.successes}/${lab.drill.attempts} PUNISHES · ${lab.drill.cue}`;
  }
}
