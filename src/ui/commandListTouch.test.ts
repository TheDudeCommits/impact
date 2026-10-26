import { describe, expect, it } from 'vitest';
import { commandList } from './commandList';

describe('the move list on a touch screen (overnight UX, 9 October 2026)', () => {
  it("names the on-screen buttons, never the keyboard's keys", () => {
    const html = commandList('naruto', 'touch', 'generic');
    expect(html).toContain('<kbd class="touch-key">LIGHT</kbd>');
    expect(html).toContain('<kbd class="touch-key">JUMP</kbd>');
    expect(html).toContain('<kbd class="touch-key">ULT</kbd>');
    expect(html).toContain('<kbd class="touch-key">AREA</kbd>');
    expect(html).not.toMatch(/<kbd>(J|K|Q|R|G|E|F|Space)<\/kbd>/);
  });
  it('keeps the keyboard\'s keys with a keyboard', () => {
    expect(commandList('naruto', 'keyboard', 'generic')).toMatch(/<kbd>J<\/kbd>/);
  });
  it('lists the AREA move on G (R2 on a pad) between the special and the ultimate; a pad\'s AWAKEN is L2 + R2', () => {
    const keys = commandList('naruto', 'keyboard', 'generic'), pad = commandList('naruto', 'controller', 'playstation');
    expect(keys).toMatch(/<kbd>G<\/kbd><\/span><span class="cmd-name">[^<]+<\/span><span class="cmd-tags"><b>Area<\/b>/);
    expect(keys.indexOf('<b>Area</b>')).toBeLessThan(keys.indexOf('<b>Ultimate</b>'));
    expect(pad).toContain('<kbd class="pad-key">R2</kbd></span>');
    expect(pad).toContain('<kbd class="pad-key">L2</kbd>+<kbd class="pad-key">R2</kbd></span>');
  });
});
