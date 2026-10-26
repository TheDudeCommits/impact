const TURN_SPEED = 3, TURN_ACCEL = 14, TILT_SPEED = 1.5;
const SWING_SECONDS = .3, HALF_TURN_SECONDS = .42, DOUBLE = .32;
const SWITCH_REPEAT = .22;
const PITCH_MIN = -.28, PITCH_MAX = .72;

const wrapped = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const ease = (t: number) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
const LEFT = ['KeyO', 'ArrowLeft'], RIGHT = ['BracketLeft', 'ArrowRight'];

export interface LookInput { keys: ReadonlySet<string>; yaw: number; pitch: number; sensitivity: number }
export interface LookScene {
  me?: { x: number; z: number; yaw: number };
  threat?: { x: number; z: number }; boss?: { x: number; z: number }; target?: { x: number; z: number };
  locked?: boolean;
}

export class RiftCamera {
  private turn = 0;
  private swing?: { from: number; by: number; t: number; seconds: number };
  private held = new Set<string>();
  private lastI = -1;
  private switchAt = -1;
  private clock = 0;
  private basis?: { yaw: number; keys: string };
  onSwitch: (dir: -1 | 1) => void = () => {};

  steer(dt: number, input: LookInput, scene: LookScene = {}, movementYaw = input.yaw) {
    const seconds = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
    this.clock += seconds;
    const keys = input.keys, now = this.clock;
    const pressed = (code: string) => { const down = keys.has(code), was = this.held.has(code); if (down) this.held.add(code); else this.held.delete(code); return down && !was; };
    if (pressed('KeyI')) {
      const twice = now - this.lastI < DOUBLE; this.lastI = now;
      const me = scene.me, at = twice ? undefined : scene.threat ?? scene.boss ?? scene.target;
      const goal = me && at ? Math.atan2(at.x - me.x, at.z - me.z) : input.yaw + Math.PI;
      this.startSwing(input, goal, movementYaw, SWING_SECONDS);
    }
    if (pressed('KeyU')) this.startSwing(input, input.yaw + Math.PI, movementYaw, HALF_TURN_SECONDS);
    const left = LEFT.some(code => keys.has(code)), right = RIGHT.some(code => keys.has(code));
    if (scene.locked) {
      this.turn = 0;
      if ((left || right) && left !== right && now - this.switchAt >= SWITCH_REPEAT) { this.switchAt = now; this.onSwitch(left ? -1 : 1); }
      if (!left && !right) this.switchAt = -1;
    } else {
      const want = (Number(left) - Number(right)) * TURN_SPEED * input.sensitivity;
      this.turn = want === 0 ? 0 : this.turn + (want - this.turn) * Math.min(1, TURN_ACCEL * seconds);
    }
    if (this.swing) {
      if (this.turn !== 0) this.swing = undefined;
      else {
        const s = this.swing;
        s.t = Math.min(1, s.t + seconds / s.seconds);
        input.yaw = s.from + s.by * ease(s.t);
        if (s.t >= 1) this.swing = undefined;
      }
    }
    if (this.turn !== 0) input.yaw += this.turn * seconds;
    const tilt = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
    if (tilt) input.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, input.pitch + tilt * TILT_SPEED * seconds * input.sensitivity));
    if (this.basis && this.basis.keys !== this.moveKeys(keys)) this.basis = undefined;
  }

  movementBasis(current: number) { return this.basis?.yaw ?? current; }

  private startSwing(input: LookInput, goal: number, movementYaw: number, seconds: number) {
    const by = wrapped(goal - input.yaw);
    if (Math.abs(by) < .03) return;
    this.swing = { from: input.yaw, by, t: 0, seconds };
    const keys = this.moveKeys(input.keys);
    if (keys && !this.basis) this.basis = { yaw: movementYaw, keys };
  }
  private moveKeys(keys: ReadonlySet<string>) { return MOVE_KEYS.filter(code => keys.has(code)).join(''); }

  reset() { this.clock = 0; this.turn = 0; this.swing = undefined; this.basis = undefined; this.held.clear(); this.lastI = -1; this.switchAt = -1; }
}
