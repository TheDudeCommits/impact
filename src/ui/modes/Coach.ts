import type { CombatEvent, GameSnapshot } from '../../game/types';
import { RULES } from '../../game/objectives/model';
import { ULTIMATE_COST } from '../../game/moves';
import { AWAKENING_COST } from '../../game/awakening';
import { boundTo } from '../../input/bindings';
import { FIGHTERS } from '../../config';
import { GUARD_GUIDE } from '../guardGuide';
import { prompt, type PromptAction } from '../prompts';
import type { HudLayoutId, ModeHudFrame } from '../hud/modeHud';
import { coachOn, coachShown, markCoachShown } from './prefs';
import type { ModeId } from './catalogue';
import './coach.css';

interface Tip { id: string; fire(f: ModeHudFrame, state: CoachState): boolean; text(f: ModeHudFrame, state: CoachState): { action?: PromptAction; verb: string; detail?: string }; done?: (f: ModeHudFrame, state: CoachState) => boolean }
interface CoachState { activeAt: number; targetPressed: boolean; downName?: string; heroDown?: string; blockedAt?: number; parried?: boolean }
const SECONDS = 4.5;
export const MAX_TIPS = 4;
const name = (f: ModeHudFrame, id?: string) => { const p = f.snapshot.players.find(p => p.id === id); return p ? (p.isBot || p.name === 'Fighter' ? FIGHTERS[p.fighter].name : p.name).toUpperCase() : ''; };

const lockOn: Tip = { id: 'lock-on', fire: (f, s) => f.now - s.activeAt > 6000 && !s.targetPressed, text: () => ({ action: 'target', verb: 'LOCK ON', detail: 'AGAIN TO SWITCH TARGET' }), done: (_f, s) => s.targetPressed };
const ultimate: Tip = { id: 'ultimate', fire: f => (f.self.ultimate ?? 0) >= ULTIMATE_COST, text: () => ({ action: 'ultimate', verb: 'ULTIMATE READY' }), done: f => f.self.action === 'ultimate' };
const awaken: Tip = { id: 'awaken', fire: f => !f.self.awakened && (f.self.awakening ?? 0) >= AWAKENING_COST, text: () => ({ action: 'awaken', verb: 'AWAKEN', detail: 'YOUR TRANSFORMATION IS READY' }), done: f => !!f.self.awakened };
const opening = (id: string, words: (f: ModeHudFrame) => string): Tip => ({ id, fire: (f, s) => f.now - s.activeAt > 1800, text: f => ({ verb: words(f) }) });
const PARRY = GUARD_GUIDE.find(g => g.name === 'Perfect Parry')!;
const parry: Tip = { id: 'parry', fire: (f, s) => !s.parried && s.blockedAt !== undefined && f.now - s.blockedAt < 6000, text: () => ({ action: 'guard', verb: PARRY.name.toUpperCase(), detail: `TAP ${PARRY.how.toUpperCase()}` }), done: (_f, s) => !!s.parried };

export const TIPS: Readonly<Record<ModeId, readonly Tip[]>> = {
  'rift-war':[opening('lanes',()=> 'PUSH WITH YOUR WAVE · DESTROY THEIR CORE'),lockOn,ultimate,awaken],
  duel: [opening('duel-goal', () => 'BEST OF THREE · WIN TWO ROUNDS'), parry, ultimate, awaken],
  royale: [opening('royale-goal', f => `${f.snapshot.players.length} FIGHTERS · LAST ONE STANDING WINS`), lockOn, parry, ultimate, awaken],
  training: [{ id: 'dummy', fire: (f, s) => f.now - s.activeAt > 2500, text: () => ({ action: 'quick1', verb: 'DUMMY', detail: 'STANDING STILL OR FIGHTING BACK' }) }, lockOn, parry, ultimate, awaken],
  arcade: [
    { id: 'rift', fire: f => (f.run?.dungeon?.progress ?? 0) >= .5, text: () => ({ verb: 'FILL THE RIFT · THE GUARDIAN COMES' }) },
    { id: 'relic', fire: f => (f.run?.relics?.length ?? 0) > 0, text: () => ({ verb: "RELIC · A GUARDIAN'S POWER IS YOURS" }) },
    ultimate,
  ],
  'last-stand': [
    opening('gate', () => 'PROTECT THE GATE · ITS BAR IS YOUR LIFE'),
    { id: 'rescue', fire: (_f, s) => !!s.downName, text: (_f, s) => ({ verb: `STAND BESIDE ${s.downName} TO REVIVE`, detail: `${RULES.rescueSeconds} SECONDS` }) },
    { id: 'shop', fire: f => (f.objective?.village?.points ?? 0) >= 300, text: f => ({ action: 'interact', verb: 'QUARTERMASTER', detail: `◈ ${f.objective?.village?.points} · INSIDE THE GATE` }) },
    lockOn,
  ],
  'bad-blood': [
    opening('sides', () => `VILLAINS ${RULES.villainMultiplier}× · HEROES RETURN ONCE`),
    { id: 'return', fire: (_f, s) => !!s.heroDown, text: (_f, s) => ({ verb: `${s.heroDown} RETURNS IN ${RULES.heroReviveSeconds}s`, detail: 'KEEP ONE HERO STANDING' }) },
    parry, lockOn, ultimate,
  ],
};

export class Coach {
  private readonly el = document.createElement('div');
  private state: CoachState = { activeAt: 0, targetPressed: false };
  private showing?: { tip: Tip; until: number; mode: ModeId };
  private layout?: HudLayoutId;
  private selfId = '';
  constructor(private readonly root: HTMLElement) {
    this.el.className = 'coach-tip'; this.el.setAttribute('role', 'status'); this.el.setAttribute('aria-live', 'polite');
    window.addEventListener('keydown', event => { if (boundTo('target', event.code)) this.state.targetPressed = true; });
  }
  frame(f: ModeHudFrame, layout: HudLayoutId) {
    if (layout !== this.layout) { this.layout = layout; this.state = { activeAt: 0, targetPressed: false }; this.hide(); }
    if (f.phase !== 'active' || !f.self.alive && layout !== 'last-stand' && layout !== 'bad-blood') { if (f.phase !== 'active') this.state.activeAt = 0; this.hide(); return; }
    if (!this.state.activeAt) this.state.activeAt = f.now;
    this.selfId = f.self.id;
    const zone = this.root.querySelector<HTMLElement>('.mode-hud [data-zone="6"]');
    if (zone && this.el.parentElement !== zone) zone.append(this.el);
    if (this.showing) {
      const { tip, until } = this.showing;
      if (f.now > until || tip.done?.(f, this.state)) this.hide(); else return;
    }
    if (!coachOn()) return;
    const mode = layout, shown = coachShown(mode);
    if (shown.length >= MAX_TIPS) return;
    const tip = TIPS[mode].find(t => !shown.includes(t.id) && t.fire(f, this.state));
    if (!tip) return;
    markCoachShown(mode, tip.id);
    const { action, verb, detail } = tip.text(f, this.state);
    this.el.innerHTML = action ? prompt(action, verb, { detail }) : `<span class="ux-prompt" data-keyless><b>${verb}</b>${detail ? `<small>${detail}</small>` : ''}</span>`;
    this.el.classList.add('on');
    this.showing = { tip, until: f.now + SECONDS * 1000, mode };
  }
  event(event: CombatEvent, snapshot: GameSnapshot, layout: HudLayoutId) {
    if (event.targetId && event.targetId === this.selfId) {
      if (event.kind === 'blocked') this.state.blockedAt = performance.now();
      else if (event.kind === 'just-guard') this.state.parried = true;
    }
    if (event.kind !== 'eliminated' || !event.targetId) return;
    const frame = { snapshot } as ModeHudFrame;
    const victim = snapshot.players.find(p => p.id === event.targetId);
    if (!victim || victim.enemy) return;
    const own = snapshot.players.find(p => p.team && p.id !== victim.id && p.team === victim.team);
    if (layout === 'last-stand' && own) this.state.downName = name(frame, victim.id);
    if (layout === 'bad-blood' && victim.team === 'heroes') this.state.heroDown = name(frame, victim.id);
  }
  clear() { this.layout = undefined; this.state = { activeAt: 0, targetPressed: false }; this.hide(); }
  private hide() { this.showing = undefined; this.el.classList.remove('on'); }
}
