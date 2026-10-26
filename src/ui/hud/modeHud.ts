import type { CombatEvent, GameSnapshot, PlayerState } from '../../game/types';
import type { RunView } from '../../survival/SurvivalGame';
import type { ObjectiveView } from '../../game/objectives/model';
import type { PadFamily } from '../../input/gamepad';
import type { ModeId } from '../modes/catalogue';

export type HudLayoutId = ModeId;
export const HUD_ZONES = ['1b', '2', '2b', '3', '3b', '5', '6', '6a', '7', '8', '8b', '9'] as const;
export type HudZone = typeof HUD_ZONES[number];
export type HudPhase = 'waiting' | 'active' | 'over';

export interface ModeHudFrame {
  snapshot: GameSnapshot;
  self: PlayerState;
  target?: PlayerState;
  phase: HudPhase;
  objective?: ObjectiveView;
  run?: RunView;
  input: 'keyboard' | 'controller' | 'touch';
  family: PadFamily;
  now: number;
}
export interface ModeHudMount {
  root: HTMLElement;
  combat: HTMLElement;
  zone(id: HudZone): HTMLElement;
}
export interface ModeHud {
  mount(mount: ModeHudMount): void;
  update(frame: ModeHudFrame): void;
  event?(event: CombatEvent, snapshot: GameSnapshot): void;
  unmount(): void;
}
export type ModeHudFactory = () => ModeHud;

export function hudPhaseOf(snapshot: GameSnapshot, objective?: ObjectiveView, run?: RunView): HudPhase {
  if (run) return run.phase === 'over' ? 'over' : run.phase === 'lobby' ? 'waiting' : 'active';
  if (objective) return objective.phase === 'over' ? 'over' : objective.phase === 'active' ? 'active' : 'waiting';
  return snapshot.status === 'finished' ? 'over' : snapshot.status === 'waiting' ? 'waiting' : 'active';
}

export class EventCursor {
  private last = -1;
  private at = -Infinity;
  reset() { this.last = -1; this.at = -Infinity; }
  take(snapshot: GameSnapshot): CombatEvent[] {
    if (snapshot.serverTime < this.at - 1) this.reset();
    this.at = snapshot.serverTime;
    const fresh: CombatEvent[] = [];
    for (const event of snapshot.events) if (event.id > this.last) { fresh.push(event); this.last = event.id; }
    return fresh;
  }
}

export const quietHud = (): ModeHud => ({ mount() {}, update() {}, unmount() {} });
