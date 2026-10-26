import { afterEach, describe, expect, it } from 'vitest';
import { prompt, promptKey, promptText, keyLabel, padControlFor } from './prompts';
import { bindKey, resetBindings } from '../input/bindings';

const keyboard = { device: 'keyboard', family: 'generic' } as const;
const ps = { device: 'controller', family: 'playstation' } as const;
const xbox = { device: 'controller', family: 'xbox' } as const;

describe('prompts: the key, then the verb', () => {
  afterEach(() => resetBindings('keyboard'));
  it('draws the keyboard key from the bindings', () => {
    expect(promptKey('guard', keyboard)).toBe('<kbd>F</kbd>');
    expect(promptKey('light', keyboard)).toBe('<kbd>J</kbd>');
    expect(promptKey('target', keyboard)).toBe('<kbd>Tab</kbd>');
    expect(promptKey('menu', keyboard)).toBe('<kbd>P</kbd>');
    expect(promptKey('quick1', keyboard)).toBe('<kbd>1</kbd>');
  });
  it('pauses on P, and on Esc once a binding has taken P', () => {
    expect(bindKey('guard', 0, 'KeyP')).toBe(true);
    expect(promptKey('menu', keyboard)).toBe('<kbd>Esc</kbd>');
  });
  it('follows a remapped key everywhere', () => {
    expect(bindKey('guard', 0, 'KeyG')).toBe(true);
    expect(promptKey('guard', keyboard)).toBe('<kbd>G</kbd>');
    expect(keyLabel('guard')).toBe('G');
  });
  it("draws a PlayStation pad's face buttons as their symbols", () => {
    const jump = promptKey('jump', ps);
    expect(jump).toContain('✕'); expect(jump).toContain('ps-face'); expect(jump).toContain('ps-south');
    expect(promptKey('guard', ps)).toContain('L1');
    expect(promptKey('menu', ps)).toContain('OPTIONS');
    expect(promptKey('quick1', ps)).toContain('D ↑');
    expect(promptKey('tree', ps)).toContain('D ↑'); expect(promptKey('tree', keyboard)).toBe('<kbd>T</kbd>');
  });
  it("draws an Xbox pad's own letters", () => {
    expect(promptKey('jump', xbox)).toContain('>A<');
    expect(promptKey('guard', xbox)).toContain('LB');
    expect(promptKey('interact', xbox)).toContain('>A<');
  });
  it('puts the ULTIMATE on L2, the AREA on R2 and AWAKEN on both together (docs/engine/AREA.md)', () => {
    expect(promptKey('ultimate', ps)).toContain('>L2<'); expect(promptKey('ultimate', xbox)).toContain('>LT<');
    expect(promptKey('area', ps)).toContain('>R2<'); expect(promptKey('area', xbox)).toContain('>RT<');
    expect(promptKey('area', keyboard)).toBe('<kbd>G</kbd>');
    expect(promptKey('awaken', ps)).toBe('<kbd class="pad-key">L2</kbd>+<kbd class="pad-key">R2</kbd>');
    expect(promptKey('awaken', xbox)).toBe('<kbd class="pad-key">LT</kbd>+<kbd class="pad-key">RT</kbd>');
    expect(promptKey('awaken', { device: 'controller', family: 'generic' })).toBe('<kbd class="pad-key">LT+RT / L2+R2</kbd>');
    expect(promptKey('awaken', keyboard)).toBe('<kbd>E</kbd>');
    expect(prompt('area', 'AREA', { ...ps, hold: true })).toBe('<span class="ux-prompt"><i>HOLD</i><kbd class="pad-key">R2</kbd><b>AREA</b></span>');
  });
  it('builds one shape: [key] VERB, with HOLD and a detail', () => {
    const p = prompt('interact', 'QUARTERMASTER', { ...keyboard, detail: '◈ 425' });
    expect(p).toBe('<span class="ux-prompt"><kbd>B</kbd><b>QUARTERMASTER</b><small>◈ 425</small></span>');
    expect(prompt('guard', 'GUARD', { ...keyboard, hold: true })).toBe('<span class="ux-prompt"><i>HOLD</i><kbd>F</kbd><b>GUARD</b></span>');
    expect(prompt('light', '<b>', keyboard)).toContain('&lt;b&gt;');
  });
  it('drops the key where the device has none (a click, on a pad)', () => {
    expect(padControlFor('click')).toBeUndefined();
    expect(prompt('click', 'TAKE THE CAMERA', ps)).toBe('<span class="ux-prompt" data-keyless><b>TAKE THE CAMERA</b></span>');
  });
  it('draws placeholders in copy and leaves unknown words alone', () => {
    expect(promptText('{target} locks on. {nope} stays.', keyboard)).toBe('<kbd>Tab</kbd> locks on. {nope} stays.');
    expect(promptText('Use {ultimate} & win', xbox)).toContain('LT');
    expect(promptText('Aim {area}', keyboard)).toBe('Aim <kbd>G</kbd>');
    expect(promptText('a < b', keyboard)).toBe('a &lt; b');
  });
});
