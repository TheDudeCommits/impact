import type { CombatEvent, GameSnapshot, PlayerState } from '../../game/types';
import type { RunView } from '../../survival/SurvivalGame';
import { objectiveOf } from '../../game/objectives/model';
import type { PadFamily } from '../../input/gamepad';
import { modeOfSnapshot } from '../modes/catalogue';
import { EventCursor, HUD_ZONES, hudPhaseOf, type HudLayoutId, type HudZone, type ModeHud, type ModeHudFactory, type ModeHudFrame, type ModeHudMount } from './modeHud';
import { MODE_HUDS } from './registry';
import { FALLS } from '../results/placement';
import './zones.css';

export interface ZoneLayer { combat: HTMLElement; zone(id: HudZone): HTMLElement; clear(): void }
export function domZoneLayer(root: HTMLElement): ZoneLayer | undefined {
  const combat = root.querySelector<HTMLElement>('.combat-hud');
  if (!combat) return undefined;
  const layer = document.createElement('div');
  layer.className = 'mode-hud'; layer.setAttribute('aria-live', 'off');
  const zones = new Map<HudZone, HTMLElement>();
  for (const id of HUD_ZONES) { const zone = document.createElement('div'); zone.dataset.zone = id; layer.append(zone); zones.set(id, zone); }
  combat.append(layer);
  return { combat, zone: id => zones.get(id)!, clear: () => { for (const zone of zones.values()) zone.replaceChildren(); } };
}

export const rolling = () => typeof document === 'object' && !!document.querySelector('.cutin:not([hidden]), .cine-bar[style*="display: block"]');

export class ModeHudHost {
  runView: () => RunView | undefined = () => undefined;
  onLayout?: (layout: HudLayoutId) => void;
  local: () => boolean = () => false;
  paused: () => boolean = () => this.local();
  pausable: () => boolean = () => this.local();
  frame?: ModeHudFrame;
  readonly listeners: { frame(frame: ModeHudFrame, layout: HudLayoutId): void; event?(event: CombatEvent, snapshot: GameSnapshot, layout: HudLayoutId): void; clear?(): void }[] = [];
  private layer?: ZoneLayer;
  private id?: HudLayoutId;
  private module?: ModeHud;
  private readonly cursor = new EventCursor();
  constructor(private readonly root: HTMLElement, private readonly survival: () => boolean,
    private readonly registry: Readonly<Record<HudLayoutId, ModeHudFactory>> = MODE_HUDS,
    private readonly makeLayer: (root: HTMLElement) => ZoneLayer | undefined = domZoneLayer,
    private readonly cinema: () => boolean = rolling) {}
  get layout() { return this.id; }

  update(snapshot: GameSnapshot, self: PlayerState, target: PlayerState | undefined) {
    const id = modeOfSnapshot(snapshot, this.survival());
    if (id === 'royale' || id === 'duel') FALLS.observe(snapshot);
    if (id !== this.id) this.mount(id);
    const objective = objectiveOf(snapshot), run = id === 'arcade' ? this.runView() : undefined;
    const phase = hudPhaseOf(snapshot, objective, run);
    if (this.root.dataset.hudPhase !== phase) this.root.dataset.hudPhase = phase;
    const cinema = this.cinema();
    if (cinema !== ('cinema' in this.root.dataset)) { if (cinema) this.root.dataset.cinema = ''; else delete this.root.dataset.cinema; }
    const input = this.root.dataset.input === 'controller' ? 'controller' : this.root.dataset.input === 'touch' ? 'touch' : 'keyboard';
    const family = (this.root.dataset.pad ?? 'generic') as PadFamily;
    const frame: ModeHudFrame = { snapshot, self, target, phase, objective, run, input, family, now: performance.now() };
    this.frame = frame;
    this.guard(() => this.module?.update(frame));
    for (const listener of this.listeners) this.guard(() => listener.frame(frame, id));
  }
  snapshot(snapshot: GameSnapshot) {
    const fresh = this.cursor.take(snapshot);
    const module = this.module, layout = this.id;
    for (const event of fresh) {
      if (module?.event) this.guard(() => module.event!(event, snapshot));
      if (layout) for (const listener of this.listeners) if (listener.event) this.guard(() => listener.event!(event, snapshot, layout));
    }
  }
  clear() {
    this.unmount(); this.id = undefined; this.frame = undefined; this.cursor.reset(); FALLS.reset();
    for (const listener of this.listeners) this.guard(() => listener.clear?.());
    delete this.root.dataset.hud; delete this.root.dataset.hudPhase; delete this.root.dataset.cinema;
  }

  private mount(id: HudLayoutId) {
    this.unmount();
    this.layer ??= this.makeLayer(this.root);
    this.id = id; this.root.dataset.hud = id;
    this.guard(() => this.onLayout?.(id));
    if (!this.layer) return;
    const layer = this.layer, module = this.registry[id]();
    const mount: ModeHudMount = { root: this.root, combat: layer.combat, zone: zone => layer.zone(zone) };
    this.module = module;
    this.guard(() => module.mount(mount));
  }
  private unmount() {
    const module = this.module; this.module = undefined;
    if (module) this.guard(() => module.unmount());
    this.layer?.clear();
  }
  private guard(fn: () => void) { try { fn(); } catch (error) { console.error('[mode HUD]', this.id, error); } }
}
