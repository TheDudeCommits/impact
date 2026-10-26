import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIM_RADIUS, AIM_SLOP, AreaDrag, CooldownLeft, dragBase, STICK_DEADZONE, STICK_FULL, STICK_RADIUS, stickVector, TOUCH_BUTTONS, type AimStep } from '../src/input/touch';
import { Input, TOUCH_LOOK } from '../src/input';
import { promptKey, promptText, prompt } from '../src/ui/prompts';
import type { PadState } from '../src/input/gamepad';

const R = STICK_RADIUS;
describe('touch stick maths (input/touch.ts)', () => {
  it('reads nothing inside the deadzone', () => {
    expect(stickVector(0, 0)).toEqual([0, 0]);
    expect(stickVector(R * STICK_DEADZONE * .99, 0)).toEqual([0, 0]);
    expect(stickVector(0, -R * STICK_DEADZONE * .5)).toEqual([0, 0]);
  });
  it('reads full speed from STICK_FULL of the reach out, and never more', () => {
    const [forward] = stickVector(0, -R * STICK_FULL);
    expect(forward).toBeCloseTo(1, 6);
    const [, right] = stickVector(R * 2, 0);
    expect(right).toBeCloseTo(1, 6);
    const [f, r] = stickVector(R, R);
    expect(Math.hypot(f, r)).toBeCloseTo(1, 6);
  });
  it('is a straight line from the deadzone to full speed', () => {
    const half = R * (STICK_DEADZONE + (STICK_FULL - STICK_DEADZONE) / 2);
    expect(stickVector(half, 0)[1]).toBeCloseTo(.5, 6);
  });
  it('reads as the pad\'s left stick: up is forward, right is right', () => {
    const [upF, upR] = stickVector(0, -R);
    expect(upF).toBeGreaterThan(.99); expect(upR).toBe(0);
    const [downF] = stickVector(0, R);
    expect(downF).toBeLessThan(-.99);
    const [leftF, leftR] = stickVector(-R, 0);
    expect(leftF).toBe(0); expect(leftR).toBeLessThan(-.99);
    const [df, dr] = stickVector(R * .4, -R * .4);
    expect(df).toBeCloseTo(dr, 9);
  });
  it('is safe with bad input', () => {
    expect(stickVector(NaN, 4)).toEqual([0, 0]);
    expect(stickVector(4, Infinity)).toEqual([0, 0]);
    expect(stickVector(10, 10, 0)).toEqual([0, 0]);
  });
  it('drags the base behind a thumb that has gone past the reach', () => {
    expect(dragBase(100, 100, 130, 100, 58)).toEqual([100, 100]);
    const [x, y] = dragBase(100, 100, 300, 100, 58);
    expect(x).toBeCloseTo(242, 6); expect(y).toBe(100);
    expect(Math.hypot(300 - x, 100 - y)).toBeCloseTo(58, 6);
  });
  it('shows how much of a cooldown is left', () => {
    const left = new CooldownLeft();
    expect(left.of(0)).toBe(0);
    expect(left.of(2)).toBe(1);
    expect(left.of(1)).toBeCloseTo(.5);
    expect(left.of(0)).toBe(0);
    expect(left.of(4)).toBe(1);
  });
});

function fixture() {
  const win = new EventTarget(), canvas = Object.assign(new EventTarget(), { requestPointerLock: vi.fn() });
  const doc = Object.assign(new EventTarget(), { hidden: false, pointerLockElement: canvas });
  let pads: PadState[] = [];
  vi.stubGlobal('window', win); vi.stubGlobal('document', doc); vi.stubGlobal('navigator', { getGamepads: () => pads });
  const input = new Input(canvas as unknown as HTMLCanvasElement);
  input.enabled = true; input.update(1 / 60);
  const pad = (axes: number[]) => { pads = [{ index: 0, id: 'Xbox', mapping: 'standard', connected: true, axes, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }]; };
  return { input, pad, win, canvas };
}
afterEach(() => vi.unstubAllGlobals());
describe('touch controls feed Input as the pad and the mouse do', () => {
  it('the stick moves exactly as the pad\'s left stick at the same reading', () => {
    const viaPad = fixture(); viaPad.pad([.5, -.7, 0, 0]); viaPad.input.update(1 / 60);
    const padMove = viaPad.input.command(null, .4);
    vi.unstubAllGlobals();
    const viaTouch = fixture();
    const length = Math.hypot(.5, .7), scale = Math.min(1, (length - .18) / (1 - .18)) / length;
    viaTouch.input.touchHold(.7 * scale, .5 * scale, false, false);
    const touchMove = viaTouch.input.command(null, .4);
    expect(touchMove.moveX).toBeCloseTo(padMove.moveX, 9);
    expect(touchMove.moveZ).toBeCloseTo(padMove.moveZ, 9);
  });
  it('held buttons guard and fly; presses fire once', () => {
    const { input } = fixture();
    input.touchHold(0, 0, true, true);
    let command = input.command(null);
    expect(command.guard).toBe(true); expect(command.jumpHeld).toBe(true);
    input.touchPress('light'); input.touchPress('dash');
    command = input.command(null);
    expect(command.attack).toBe('light'); expect(command.dash).toBe(true);
    command = input.command(null);
    expect(command.attack).toBeUndefined(); expect(command.dash).toBeUndefined();
    input.touchHold(0, 0, false, false);
    expect(input.command(null).guard).toBe(false);
    expect(input.mode).toBe('touch');
  });
  it('LOCK calls onTarget and JUMP is interact first, as the pad\'s jump is', () => {
    const { input } = fixture();
    const target = vi.fn(); input.onTarget = target;
    input.touchPress('target'); expect(target).toHaveBeenCalledTimes(1);
    input.onInteract = () => true; input.touchPress('jump');
    expect(input.command(null).jump).toBeUndefined();
    input.onInteract = () => false; input.touchPress('jump');
    expect(input.command(null).jump).toBe(true);
  });
  it('a drag turns the view by the mouse\'s constants, and nothing while disabled', () => {
    const { input } = fixture();
    input.yaw = 1; input.pitch = .1;
    input.touchLook(100, 20);
    expect(input.yaw).toBeCloseTo(1 - 100 * .0023 * TOUCH_LOOK, 9);
    expect(input.pitch).toBeCloseTo(.1 + 20 * .0018 * TOUCH_LOOK, 9);
    input.touchLook(0, 10000);
    expect(input.pitch).toBe(.72);
    input.enabled = false; const yaw = input.yaw; input.touchLook(300, 0);
    expect(input.yaw).toBe(yaw);
  });
  it('clear() lets go of everything the touch controls held', () => {
    const { input } = fixture();
    input.touchHold(1, 0, true, true); input.clear();
    const command = input.command(null);
    expect(command.moveX).toBe(0); expect(command.moveZ).toBe(0); expect(command.guard).toBe(false); expect(command.jumpHeld).toBeUndefined();
  });
});

describe('the AREA button: drag from it to aim, let go to cast, drag back onto it to cancel (docs/engine/AREA.md)', () => {
  const move = (step: AimStep | undefined) => { expect(step?.phase).toBe('move'); return step as Extract<AimStep, { phase: 'move' }>; };
  it('is one of the on-screen buttons, labelled as its prompts are', () => {
    expect(TOUCH_BUTTONS).toContainEqual(['area', 'AREA']);
    expect(promptKey('area', { device: 'touch', family: 'generic' })).toBe('<kbd class="touch-key">AREA</kbd>');
  });
  it('a tap - nothing past the slop from where the finger landed - aims nothing, and lifting casts at the aim\'s own start', () => {
    const drag = new AreaDrag(500, 300, 31, AIM_RADIUS, 512, 296);
    expect(drag.move(512 + AIM_SLOP * .6, 296 + AIM_SLOP * .6)).toBeUndefined();
    expect(drag.casts).toBe(true);
  });
  it('reads the drag from the button\'s centre as a share of the reach: up is forward, never longer than 1', () => {
    const drag = new AreaDrag(500, 300, 31);
    expect(drag.move(500, 300 - AIM_RADIUS / 2)).toEqual({ phase: 'move', right: 0, forward: .5 });
    const right = move(drag.move(500 + AIM_RADIUS * 3, 300));
    expect(right.right).toBeCloseTo(1, 9); expect(right.forward).toBe(0);
    const back = move(drag.move(200, 600));
    expect(Math.hypot(back.right, back.forward)).toBeCloseTo(1, 9); expect(back.right).toBeLessThan(0); expect(back.forward).toBeLessThan(0);
    expect(drag.casts).toBe(true);
    const near = new AreaDrag(500, 300, 31);
    expect(move(near.move(500, 280)).forward).toBeCloseTo(20 / AIM_RADIUS, 9);
    expect(move(near.move(500, 296)).forward).toBeCloseTo(4 / AIM_RADIUS, 9);
  });
  it('dragged clear of the button and back onto it puts the aim away, once; the finger then does nothing and lifting casts nothing', () => {
    const drag = new AreaDrag(500, 300, 31);
    move(drag.move(500, 200));
    expect(drag.move(510, 295)).toEqual({ phase: 'cancel' });
    expect(drag.move(500, 150)).toBeUndefined();
    expect(drag.move(505, 300)).toBeUndefined();
    expect(drag.casts).toBe(false);
  });
  it('a thumb rolling on the button\'s rim never cancels', () => {
    const drag = new AreaDrag(500, 300, 31);
    move(drag.move(500 + 31 + AIM_SLOP * .9, 300));
    expect(move(drag.move(515, 300)).right).toBeCloseTo(15 / AIM_RADIUS, 9);
    expect(drag.casts).toBe(true);
  });
  it('feeds Input.touchAim: the drag places the aim at its share of the move\'s range, letting go casts there', () => {
    const { input } = fixture(); input.yaw = 0;
    input.touchAim('start'); expect(input.aim.active).toBe(true); expect(input.mode).toBe('touch');
    input.aim.follow({ x: 0, z: 0 }, 0, undefined, 14, 4, true);
    const step = move(new AreaDrag(500, 300, 31).move(500, 300 - AIM_RADIUS / 2));
    input.touchAim('move', step.right, step.forward);
    input.aim.follow({ x: 0, z: 0 }, 0, undefined, 14, 4, true);
    expect(input.command(null).attack).toBeUndefined();
    input.touchAim('end');
    expect(input.command(null)).toMatchObject({ attack: 'area', aim: { x: 0, z: 7 } });
    expect(input.aim.active).toBe(false);
  });
  it('a tap casts at the aim\'s own start (the locked target in range); a cancelled aim casts nothing', () => {
    const { input } = fixture();
    input.touchAim('start'); input.aim.follow({ x: 0, z: 0 }, 0, { x: 3, z: 4 }, 14, 4, true); input.touchAim('end');
    expect(input.command(null)).toMatchObject({ attack: 'area', aim: { x: 3, z: 4 } });
    input.touchAim('start'); input.aim.follow({ x: 0, z: 0 }, 0, undefined, 14, 4, true); input.touchAim('cancel');
    expect(input.aim.active).toBe(false);
    input.touchAim('end');
    expect(input.command(null).attack).toBeUndefined();
  });
});

describe('prompts on a touch screen', () => {
  const touch = { device: 'touch', family: 'generic' } as const;
  it('names the on-screen button, never a keyboard key', () => {
    expect(promptKey('guard', touch)).toBe('<kbd class="touch-key">GUARD</kbd>');
    expect(promptKey('ultimate', touch)).toBe('<kbd class="touch-key">ULT</kbd>');
    expect(promptKey('forward', touch)).toBe('<kbd class="touch-key">STICK</kbd>');
    expect(promptKey('interact', touch)).toBe('<kbd class="touch-key">JUMP</kbd>');
  });
  it('a tapped thing is the verb alone, and its placeholder is not printed', () => {
    expect(promptKey('quick1', touch)).toBe('');
    expect(prompt('quick1', 'DUMMY', touch)).toBe('<span class="ux-prompt" data-keyless><b>DUMMY</b></span>');
    expect(promptText('{quick2} resets positions; hold {guard} to block.', touch)).toBe(' resets positions; hold <kbd class="touch-key">GUARD</kbd> to block.');
  });
});

describe('PAUSE and the emote button find a gap along the top', () => {
  it('takes the first stretch wide enough past the taken ones', async () => {
    const { firstGap } = await import('../src/input/touch');
    expect(firstGap([], 250, 836, 96)).toBe(250);
    expect(firstGap([[310, 540], [646, 852]], 253, 836, 44)).toBe(253);
    expect(firstGap([[310, 540], [646, 852]], 253, 836, 96)).toBe(540);
    expect(firstGap([[360, 491], [597, 852]], 253, 836, 96)).toBe(253);
    expect(firstGap([[260, 500], [520, 852]], 253, 836, 44)).toBeUndefined();
  });
});
