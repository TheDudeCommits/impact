import {ACTIONS,BINDINGS_EVENT,boundTo,getBindings,type BindingAction} from '../input/bindings';

const TURN_SPEED = 3, TURN_ACCEL = 14;
export const SWING_SECONDS = .3, HALF_TURN_SECONDS = .42, DOUBLE = .32, SWING_PEAK = 6.98, BASIS_CATCH = 7;
export const LOCK_HOLD = .45;
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const MODIFIERS = new Set(['ShiftLeft', 'ControlLeft', 'AltLeft']);

function held(action: BindingAction, keys: ReadonlySet<string>) {
  const codes = getBindings().keyboard[action];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    if (keys.has(code) || (MODIFIERS.has(code) && keys.has(code.replace('Left', 'Right')))) return true;
  }
  return false;
}
export function movementMask(keys: ReadonlySet<string>, arrows = true) {
  let mask = 0;
  if (held('forward', keys) || (arrows && keys.has('ArrowUp'))) mask |= 1;
  if (held('left', keys) || (arrows && keys.has('ArrowLeft'))) mask |= 2;
  if (held('backward', keys) || (arrows && keys.has('ArrowDown'))) mask |= 4;
  if (held('right', keys) || (arrows && keys.has('ArrowRight'))) mask |= 8;
  return mask;
}

export function lockHeld(keys: ReadonlySet<string>) {
  if (held('target', keys)) return true;
  const pads = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
  const button = getBindings().controller.target;
  for (const pad of pads) if (pad?.connected && pad.mapping === 'standard' && pad.buttons[button]?.pressed) return true;
  return false;
}

export interface ViewInput { keys: ReadonlySet<string>; yaw: number; sensitivity: number }
export interface Spot { x: number; z: number }

export class ViewKeys {
  private turn = 0;
  private swing?: { from: number; by: number; t: number; seconds: number };
  private pressed = new Set<string>();
  private lastI = -1;
  private clock = 0;
  private basis?: { yaw: number; mask: number; catching: boolean };
  private free = { KeyO: true, BracketLeft: true, KeyI: true, KeyU: true };
  private stale = true;
  private lockFor = 0; private lockFired = false;
  constructor() { if (typeof window !== 'undefined') window.addEventListener(BINDINGS_EVENT, () => { this.stale = true; }); }

  steer(dt: number, input: ViewInput, me?: Spot, target?: Spot, movementYaw = input.yaw, mask = 0, blocked = false) {
    const seconds = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
    this.clock += seconds;
    if (this.stale) { this.stale = false; for (const code of ['KeyO', 'BracketLeft', 'KeyI', 'KeyU'] as const) this.free[code] = !ACTIONS.some(action => boundTo(action, code)); }
    const keys = input.keys, now = this.clock;
    if (this.edge(keys, 'KeyI')) {
      const twice = now - this.lastI < DOUBLE; this.lastI = now;
      const at = twice ? undefined : target;
      this.startSwing(input, me && at ? Math.atan2(at.x - me.x, at.z - me.z) : input.yaw + Math.PI, movementYaw, mask, SWING_SECONDS);
    }
    if (this.edge(keys, 'KeyU')) this.startSwing(input, input.yaw + Math.PI, movementYaw, mask, HALF_TURN_SECONDS);
    const want = (Number(this.down(keys, 'KeyO')) - Number(this.down(keys, 'BracketLeft'))) * TURN_SPEED * input.sensitivity;
    this.turn = want === 0 ? 0 : this.turn + (want - this.turn) * Math.min(1, TURN_ACCEL * seconds);
    if (this.swing) {
      if (this.turn !== 0) this.swing = undefined;
      else {
        const s = this.swing;
        s.t = Math.min(1, s.t + seconds / s.seconds);
        input.yaw = s.from + s.by * ease(s.t);
        if (s.t >= 1) { this.swing = undefined; if (this.basis) this.basis.catching = true; }
      }
    }
    if (this.turn !== 0) input.yaw += this.turn * seconds;
    if (this.basis && (this.basis.mask !== mask || blocked)) this.basis = undefined;
    else if (this.basis?.catching) {
      const gap = wrapped(movementYaw - this.basis.yaw);
      if (Math.abs(gap) < .01) this.basis = undefined;
      else this.basis.yaw += gap * (1 - Math.exp(-BASIS_CATCH * seconds));
    }
  }
  lockHold(dt: number, keys: ReadonlySet<string>) {
    if (!lockHeld(keys)) { this.lockFor = 0; this.lockFired = false; return false; }
    this.lockFor += Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
    if (this.lockFor >= LOCK_HOLD && !this.lockFired) { this.lockFired = true; return true; }
    return false;
  }
  movementBasis(current: number, mask: number) {
    if (this.basis && this.basis.mask !== mask) this.basis = undefined;
    return this.basis?.yaw ?? current;
  }
  private down(keys: ReadonlySet<string>, code: 'KeyO' | 'BracketLeft' | 'KeyI' | 'KeyU') { return this.free[code] && keys.has(code); }
  private edge(keys: ReadonlySet<string>, code: 'KeyI' | 'KeyU') {
    const is = this.down(keys, code), was = this.pressed.has(code);
    if (is) this.pressed.add(code); else this.pressed.delete(code);
    return is && !was;
  }
  private startSwing(input: ViewInput, goal: number, movementYaw: number, mask: number, seconds: number) {
    const by = wrapped(goal - input.yaw);
    if (Math.abs(by) < .03) return;
    this.swing = { from: input.yaw, by, t: 0, seconds: Math.max(seconds, 1.875 * Math.abs(by) / SWING_PEAK) };
    if (mask && !this.basis) this.basis = { yaw: movementYaw, mask, catching: false };
    else if (this.basis) this.basis.catching = false;
  }
  reset() { this.clock = 0; this.turn = 0; this.swing = undefined; this.basis = undefined; this.pressed.clear(); this.lastI = -1; this.lockFor = 0; this.lockFired = false; }
}
