import type { RunView, PartyMember } from '../../survival/SurvivalGame';
import { FIGHTERS } from '../../config';
import { prompt } from '../prompts';
import type { ModeHud, ModeHudFrame, ModeHudMount } from './modeHud';
import { el, Text, Markup, Fill, Flag, Data, MiniPlate, PromptLane, grouped, clockOf, pulse } from './kit';
import { KoChain, pointsCopy } from './modeCopy';
import './arcadeHud.css';

interface Member { id: string; plate: MiniPlate; state: string }

export function createArcadeHud(): ModeHud { return new ArcadeHud(); }

class ArcadeHud implements ModeHud {
  private score!: HTMLElement; private scoreN!: Text; private style!: HTMLElement; private styleRank!: Data;
  private styleLetter!: Text; private styleWord!: Text; private styleMult!: Text; private styleFill!: Fill;
  private kos!: Text; private time!: Text; private chain!: Text; private chainShown!: Flag; private chainFading!: Flag;
  private level!: HTMLElement; private levelN!: Text; private levelXp!: Fill;
  private tree!: HTMLButtonElement; private treeMarkup!: Markup; private treeShown!: Flag; private treeInput = ''; private treeFamily = '';
  private party!: HTMLElement; private members: Member[] = []; private partyKey = ''; private lane?: PromptLane;
  private lent: { node: HTMLElement; parent: Element; next: Element | null }[] = [];
  private shownScore = 0; private scoreAt = 0; private writtenScore = -1; private shownKills = -1; private shownTime = -1;
  private shownLevel = -1; private shownLetter = ''; private shownMult = -1; private shownPoints = -1;
  private readonly koChain = new KoChain(); private chainWritten = -1;

  mount(m: ModeHudMount) {
    this.score = el('div', 'ah-score', m.zone('3'));
    el('small', 'ah-score-label', this.score, 'SCORE');
    this.scoreN = new Text(el('strong', '', this.score));
    this.style = el('div', 'ah-style', this.score); this.styleRank = new Data(this.style, 'rank');
    this.styleLetter = new Text(el('b', '', this.style)); this.styleWord = new Text(el('span', '', this.style)); this.styleMult = new Text(el('em', '', this.style));
    this.styleFill = new Fill(el('i', '', el('i', 'ah-style-track', this.style)));
    const meta = el('div', 'ah-meta', this.score);
    this.kos = new Text(el('span', '', meta)); this.time = new Text(el('span', '', meta));
    const chain = el('span', 'ah-chain hidden', meta); this.chain = new Text(chain);
    this.chainShown = new Flag(chain); this.chainShown.set(true); this.chainFading = new Flag(chain, 'fading');

    const personal = el('div', 'ah-personal', m.zone('1b'));
    const strip = el('div', 'ah-progress', personal);
    this.level = el('div', 'ah-level', strip);
    el('small', '', this.level, 'LV'); this.levelN = new Text(el('b', '', this.level));
    this.levelXp = new Fill(el('i', '', el('i', 'ah-xp', this.level)));
    this.tree = el('button', 'ah-tree hidden', strip); this.tree.type = 'button';
    this.tree.setAttribute('aria-label', 'Open the skill tree');
    this.tree.onclick = () => document.querySelector<HTMLButtonElement>('#sv-points')?.click();
    this.treeMarkup = new Markup(this.tree); this.treeShown = new Flag(this.tree); this.treeShown.set(true);
    this.party = el('div', 'ah-party hk-mini-row', personal);
    this.lane = new PromptLane(m.zone('6'));

    this.lend(document.querySelector<HTMLElement>('.sv-hud .sv-relics'), m.zone('3b'));
    this.lend(document.querySelector<HTMLElement>('.sv-hud .sv-map'), m.zone('5'));
  }
  private lend(node: HTMLElement | null, zone: HTMLElement) {
    if (!node?.parentElement) return;
    this.lent.push({ node, parent: node.parentElement, next: node.nextElementSibling });
    zone.append(node);
  }

  update(f: ModeHudFrame) {
    const run = f.run;
    if (!run) return;
    const now = f.now;
    const dt = this.scoreAt ? Math.min(.5, (now - this.scoreAt) / 1000) : 1; this.scoreAt = now;
    this.shownScore += (run.score - this.shownScore) * (1 - Math.exp(-dt * 9));
    if (Math.abs(run.score - this.shownScore) < 1 || run.score < this.shownScore) this.shownScore = run.score;
    const score = Math.round(this.shownScore);
    if (score !== this.writtenScore) { this.writtenScore = score; this.scoreN.set(grouped.format(score)); }
    const style = run.style;
    if (style.letter !== this.shownLetter) {
      const up = this.shownLetter !== '' && style.rank > Number(this.style.dataset.rank ?? 0);
      this.shownLetter = style.letter; this.styleLetter.set(style.letter); this.styleWord.set(style.word.toUpperCase()); this.styleRank.set(String(style.rank));
      if (up) pulse(this.style, 'up');
    }
    if (style.multiplier !== this.shownMult) { this.shownMult = style.multiplier; this.styleMult.set(`×${style.multiplier.toFixed(1)}`); }
    this.styleFill.set(style.fill);
    if (run.kills !== this.shownKills) { this.shownKills = run.kills; this.kos.set(`${grouped.format(run.kills)} KO`); }
    const seconds = Math.floor(run.time);
    if (seconds !== this.shownTime) { this.shownTime = seconds; this.time.set(clockOf(seconds)); }
    this.updateChain(run, now);

    if (run.level !== this.shownLevel) { this.shownLevel = run.level; this.levelN.set(String(run.level)); }
    this.levelXp.set(run.xp / Math.max(1, run.xpNext));
    const points = run.points;
    this.treeShown.set(points <= 0 || run.phase === 'over');
    if (points > 0) {
      if (points !== this.shownPoints || f.input !== this.treeInput || f.family !== this.treeFamily) {
        this.treeInput = f.input; this.treeFamily = f.family;
        this.treeMarkup.set(prompt(f.input === 'controller' ? 'quick1' : 'tree', 'SKILL TREE', { device: f.input, family: f.family, detail: pointsCopy(points) }));
        if (points > this.shownPoints && this.shownPoints >= 0) pulse(this.tree, 'earned');
      }
    }
    this.shownPoints = points;

    this.updateParty(run.party);
    this.lane?.setCritical(run.party.length > 1 && !!run.party[0]?.down);
  }

  unmount() {
    for (const { node, parent, next } of this.lent) { if (next && next.parentElement === parent) parent.insertBefore(node, next); else parent.append(node); }
    this.lane?.clear(); this.lent = []; this.members = []; this.partyKey = '';
  }

  private updateChain(run: RunView, now: number) {
    const chain = this.koChain.update(run.party[0] ? run.party[0].kills ?? 0 : run.kills, now);
    this.chainShown.set(!chain.live); this.chainFading.set(chain.fading);
    if (chain.live && chain.n !== this.chainWritten) { this.chainWritten = chain.n; this.chain.set(`CHAIN ${chain.n}`); }
  }

  private updateParty(party: readonly PartyMember[]) {
    let key = '';
    for (let i = 1; i < party.length; i++) key += `${party[i].id}:${party[i].fighter}|`;
    if (key !== this.partyKey) {
      this.partyKey = key; this.party.replaceChildren(); this.members = [];
      for (let i = 1; i < party.length; i++) {
        const ally = party[i], plate = new MiniPlate(this.party, 'ah-ally');
        plate.face.set(ally.fighter); plate.name.set((!ally.name || ally.name === 'Fighter' ? FIGHTERS[ally.fighter].name : ally.name).toUpperCase());
        this.members.push({ id: ally.id, plate, state: '' });
      }
    }
    for (const member of this.members) {
      let ally: PartyMember | undefined;
      for (const p of party) if (p.id === member.id) ally = p;
      if (!ally) continue;
      const state = ally.down ? (ally.rescue > 0 ? `✚ REVIVING ${Math.round(ally.rescue * 100)}%` : '✚ DOWN · STAND OVER THEM') : ally.joining ? 'JOINING AT THE BOSS' : '';
      if (state !== member.state) { member.state = state; member.plate.state.set(state); }
      member.plate.down.set(ally.down && ally.rescue <= 0);
      member.plate.reviving.set(ally.down && ally.rescue > 0);
      member.plate.hp.set(ally.down ? ally.rescue : ally.hp / Math.max(1, ally.maxHp));
    }
  }
}
